// Encrypts a plain tickets page into a password-protected index.html.
// Usage: TICKETS_PASSWORD=... node build.mjs path/to/source.html [out.html]
import { readFileSync, writeFileSync } from "node:fs";
import { pbkdf2Sync, randomBytes, createCipheriv } from "node:crypto";

const [src, out = "index.html"] = process.argv.slice(2);
const password = process.env.TICKETS_PASSWORD;
if (!src || !password) {
  console.error("Usage: TICKETS_PASSWORD=... node build.mjs source.html [out.html]");
  process.exit(1);
}

// Ticket icon for the browser tab (inline SVG, so no extra file to host).
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#0e6b73" d="M6 14h52a2 2 0 0 1 2 2v10a6 6 0 0 0 0 12v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V38a6 6 0 0 0 0-12V16a2 2 0 0 1 2-2z"/><path stroke="#fff" stroke-width="3" stroke-dasharray="4 4" d="M22 18v28"/><path fill="#fff" d="m41 24 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
const ICON = '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' + encodeURIComponent(ICON_SVG) + '">';

const ITER = 250000;
const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, ITER, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const enc = Buffer.concat([cipher.update(withIcon(readFileSync(src, "utf8")), "utf8"), cipher.final(), cipher.getAuthTag()]);
function withIcon(html) {
  return html.includes('rel="icon"') ? html : html.replace("</head>", ICON + "\n</head>");
}
const b64 = b => b.toString("base64");

const shell = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>Tickets</title>
${ICON}
<style>
  :root { --bg:#eef1f4; --ink:#17202e; --muted:#66717f; --line:#d3d9e0; --accent:#0e6b73; --err:#b3261e;
    --font: "Avenir Next","Segoe UI",system-ui,sans-serif; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141b26; --ink:#e8edf3; --muted:#93a0b0; --line:#2b3646; --accent:#5cc4cc; --err:#f2b8b5; } }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg); color:var(--ink); font-family:var(--font); font-size:17px; }
  form { width:100%; max-width:360px; padding:20px; }
  h1 { font-size:2.4rem; font-weight:800; letter-spacing:-0.02em; margin:0 0 20px; }
  input, button { width:100%; font:inherit; padding:12px 14px; border-radius:8px; }
  input { border:1px solid var(--line); background:transparent; color:var(--ink); }
  button { margin-top:12px; border:0; background:var(--accent); color:var(--bg); font-weight:600; cursor:pointer; }
  button:disabled { opacity:.6; cursor:wait; }
  .err { color:var(--err); min-height:1.4em; margin:10px 0 0; }
</style>
</head>
<body>
<form id="f">
  <h1>Tickets</h1>
  <input id="pw" type="password" placeholder="Password" autocomplete="current-password" autofocus required>
  <button id="go">Enter</button>
  <p class="err" id="err" role="alert"></p>
</form>
<script>
  const DATA = { salt: "${b64(salt)}", iv: "${b64(iv)}", ct: "${b64(enc)}", iter: ${ITER} };
  const un = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function open(pw) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: un(DATA.salt), iterations: DATA.iter, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: un(DATA.iv) }, key, un(DATA.ct));
    const html = new TextDecoder().decode(buf);
    try { sessionStorage.setItem("tk", pw); } catch (e) {}
    document.open(); document.write(html); document.close();
  }
  const f = document.getElementById("f"), err = document.getElementById("err"), go = document.getElementById("go");
  f.addEventListener("submit", async ev => {
    ev.preventDefault(); err.textContent = ""; go.disabled = true;
    try { await open(document.getElementById("pw").value); }
    catch (e) { err.textContent = "Wrong password."; go.disabled = false; }
  });
  try { const s = sessionStorage.getItem("tk"); if (s) open(s).catch(() => sessionStorage.removeItem("tk")); } catch (e) {}
</script>
</body>
</html>
`;
writeFileSync(out, shell);
console.log("Wrote " + out);

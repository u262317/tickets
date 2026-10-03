# Tee-time bot (ad hoc)

Playwright script that logs into an Intelligent Golf members' site and books the earliest tee time in a window.
Run it on your own machine; it is a best-guess prototype, so the first runs are for tuning.

## Setup
```
cd tee-time
npm install && npx playwright install chromium
cp .env.example .env   # fill in CLUB_URL, MEMBER_ID, MEMBER_PIN
```

## Use
```
node book.mjs --date 2026-10-10 --after 08:00 --before 10:00 --headed --dry-run   # watch, book nothing
node book.mjs --date 2026-10-10 --after 08:00 --before 10:00                      # really book
```
Screenshots go to `artifacts/`. If it fails, tune the `SELECTORS` block in `book.mjs`.
Check the club's rules on automated booking first. It will not solve captchas or 2FA.

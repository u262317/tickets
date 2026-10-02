# Tickets

A single-page list of upcoming concerts, shows and matches (date, time, name, location).

## Password protection

`index.html` is encrypted (AES-256-GCM, key derived from the password with PBKDF2) and only
decrypts in the browser once the right password is entered. The plain-text page and the
password are **not** stored in this repo.

## Add an event

1. Keep a plain copy of the page (the original `index.html` before encryption) somewhere private.
2. Edit the `EVENTS` array near the bottom of it:

```js
{ name: "Event name", date: "YYYY-MM-DD", time: "HH:MM", location: "Venue, Town" },
```

3. Re-encrypt it:

```
TICKETS_PASSWORD='your password' node build.mjs path/to/plain.html index.html
```

Order doesn't matter; the page sorts by date and moves past events to a "Past" section.

## Host it

Push to GitHub, then Settings > Pages > Deploy from branch (`main`, `/ (root)`).

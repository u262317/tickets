# Tickets

A single-page list of upcoming concerts, shows and matches (date, time, name, location).

## Add an event

Edit the `EVENTS` array near the bottom of `index.html`:

```js
{ name: "Event name", date: "YYYY-MM-DD", time: "HH:MM", location: "Venue, Town" },
```

Order doesn't matter; the page sorts by date and moves past events to a "Past" section.

## Host it

Push to GitHub, then Settings > Pages > Deploy from branch (`main`, `/ (root)`).

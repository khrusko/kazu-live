# Sizel Busevi

A map, timetable, and trip planner for the **KaŽu IDE BUS** county buses in Karlovac County, Croatia. The public site is [busevi.sizel.eu](https://busevi.sizel.eu).

The official schedules stay as PDFs on [kazup.hr](https://www.kazup.hr/index.php/kazu-ide-bus-vozni-red). This app turns them into stops, drawn routes, departures by day, notices, and an admin editor that passengers see on the next refresh.

It is an unofficial page. It is not operated by, or connected to, Karlovačka županija.

## What it does

- A map of all 33 lines (A1–A12, B1–B9, B4/5, C1–C3, D1–D4, E1–E4).
- Trip planning: origin, destination, duration, and transfers.
- A stop opens the rest of today’s departures.
- Buses on the map move **according to the timetable**. This is not GPS. The same layer can later take live coordinates.
- Notices. A heart on a line or stop filters the bell. Without an account the favourite stays in the browser; with an account it is stored on the profile.
- Ticket quote: origin, destination, zone by kilometres, discount, then a price. Online checkout is a reservation, not a real payment.
- An administrator edits departures, stop positions, and road geometry, and publishes notices. The map refreshes every 12 seconds.

Stop coordinates are estimated from place names (OpenStreetMap) and the kilometre marks in the PDFs. They are not official pole positions.

Fares and subsidies follow the [county price page](https://www.kazup.hr/index.php/kazu-ide-bus-cijene-karata): single, daily, monthly, and yearly tickets, zones I–IX. The subsidy applies to monthly and yearly tickets. A tourist with an eVisitor stay gets three daily tickets.

## Run locally

```bash
npm install
npm run dev
```

The app listens on [http://127.0.0.1:3847](http://127.0.0.1:3847).

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@kazide.hr | KazuAdmin2026 |
| Passenger | ana@kazide.hr | Putnik2026 |

Ana already follows lines A1 and A3.

Data lives in `data/network.json` (the initial import) and `data/store.json` (edits, accounts, tickets). `store.json` is created on first launch and is not in git. On Netlify the app directory is read-only, so runtime edits need a writable store outside the deploy image.

## Source note

Departures were read from the PDF timetables published on kazup.hr (September and October 2026; lines A7 and A8 from the files dated 7 October; D3 marked valid from 12 October). The county announced further changes from 12 October for A1, A3, B2, B3, C1, D2, and D3. Where a newer PDF was not attached on the site, the app keeps the last published schedule and a notice says so. An administrator can replace it in the admin.

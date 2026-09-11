# Sugarcane GIS — "My Farm" (customer PWA)

A single-farmer Progressive Web App built on top of your existing
Express/Postgres+PostGIS backend. It reuses `server.js` and your
`parcels` / `ndvi_readings` tables directly — nothing about your
staff dashboard changes or breaks.

## What's in this folder (updated — server.js was restructured, see CHANGELOG.md)

```
server/
  server.js              <- slim composition root, wires everything together
  lib/
    auth.js                <- staff sessions, permissions matrix, demo account seeding
    parcel-status.js       <- shared Status/Crop_Age/Harvest_Status SQL + logic
    migrate.js              <- runs migrations/*.sql in order, once each, on boot
  migrations/
    001_init.sql            <- base schema (users, ndvi_readings, growers, parcels)
    002_farmer_pwa.sql      <- farmer PWA additions (extra columns, farmer_users, etc)
  routes/
    staff-auth.js, growers.js, parcels.js, ndvi.js, route-analysis.js
  farmer-routes.js        <- farmer PWA's own login + API (staff-gated registration)
  public/
    manifest.json        <- PWA manifest ("Add to Home Screen")
    service-worker.js    <- offline caching + push notifications
    icons/                <- app icons
    js/farmer-login.js   <- "Create Login" button on the Growers Directory page
    farmer/
      login.html          <- Screen 1: Login
      index.html          <- Screens 2–11: the app shell (hash-routed)
      css/app.css
      js/app.js             <- all screen logic + Leaflet map + GPS capture
      js/demo-data.js       <- fallback data if the API is unreachable
    (your existing staff dashboard files — untouched)
CHANGELOG.md              <- one line per deploy, keep it updated
```

**Adding a schema change in future:** drop a new numbered file in
`migrations/` (e.g. `003_something.sql`) — never edit `001_init.sql`
or `002_farmer_pwa.sql` after the fact, since production has already
run them. The migration runner tracks what's applied in a
`schema_migrations` table and only runs new files, in order, once
each. This is also what fixed the "relation parcels does not exist"
bug from the first deploy — every migration now runs sequentially
before the server starts accepting requests, instead of several
independent setup functions racing each other at boot.

**Adding a new route module:** create `routes/whatever.js` exporting
`function(app, pool, sharedHelpers) { app.get(...); }`, then
`require("./routes/whatever")(app, pool, { ...whatever it needs })`
in `server.js`.



## How the 12 screens map to the app

| Screen | Where |
|---|---|
| 1. Login | `/farmer/login.html` |
| 2. Home / Dashboard | `#/home` |
| 3. Farm Overview | `#/farm` |
| 4. Farm Map | `#/map` |
| 5. Harvest Updates | `#/harvest` |
| 6. NDVI & Crop Health | `#/ndvi` |
| 7. Alerts & Notifications | `#/alerts` |
| 8. Parcel Details & Coordinates | `#/parcel` |
| 9. Route to Parcel | `#/route` |
| 10. Update Farm Information | `#/update-info` |
| 11. Profile | `#/profile` |
| 12. Add to Home Screen | shown automatically as a banner (Android: real install prompt; iPhone: "tap Share → Add to Home Screen" instructions) |

Everything is real, not decorative:
- **NDVI gauge & trend** — read from `ndvi_readings` (your existing table).
- **Harvest countdown/history** — computed from `Planting_Date` /
  `Harvest_Due` using the same status logic your staff dashboard uses.
- **Map & boundary** — the parcel's real PostGIS polygon, drawn with Leaflet.
- **"Capture from Map"** in Update Farm Information uses the phone's
  actual GPS (`navigator.geolocation`) — a farmer literally walks their
  parcel's corners, taps to capture each one, and saves a real,
  farmer-verified boundary back into `geometry`.
- **Route to Parcel** uses the phone's GPS + your OSRM proxy for a real
  driving route, and falls back to a straight-line distance if OSRM is
  unreachable.
- **Offline** — the service worker caches the app shell, so it opens
  instantly with no signal; it caches the last-loaded farm data too, so
  a farmer in a low-signal field can still see their last-known status.

If the API can't be reached at all (e.g. you're just previewing the UI
with no backend running), every screen quietly falls back to realistic
demo data — matching what you described wanting to show a customer
before the backend is even live.

## Adding new parcels

Farmers can add a parcel from `#/add-parcel` (also reachable from the
home screen and the More menu) using three boundary methods, all
saved through the same `POST /farmer/api/parcel` endpoint:

- **Walk (GPS)** — phone's own GPS, tap "Capture point" at each corner.
  ~3–8 m accuracy; fine for most smallholder plots.
- **Draw on Map** — tap the satellite basemap to place each corner.
- **Import File** — for RTK GPS or Total Station surveys. The receiver
  or survey software does the real accuracy work (cm-level); this app
  just imports the *result* as a CSV (`lat,lng` per line), GeoJSON
  Polygon, or KML. A browser can't perform RTK corrections or process
  raw Total Station angle/distance readings itself — those need to be
  converted to WGS84 lat/lon in the survey software first, same as any
  GIS import.

Whichever method is used, the **Area (Ha) is always computed
server-side** from the real PostGIS geometry (`ST_Area` on a geography
cast) — never trusted from the client — and the method is stored in
the new `Boundary_Source` column so your Survey Department can tell a
phone-GPS boundary from an imported survey at a glance.

## 1. Local test

```bash
cd server
npm install
# either set DATABASE_URL, or leave it unset to use the old localhost:5433 settings
npm start
```

Then, once a farmer account exists (see below), open
`http://localhost:3000/farmer/login.html` on your phone (same Wi-Fi) or
in a desktop browser's device-emulation mode.

### Creating your first farmer login
A farmer account must be linked to a `Grower_ID` that already has a
parcel in your `parcels` table. `POST /farmer/register` now requires
staff auth (`manage_growers` permission — Growers Department, System
Administrator, or Management) so it's no longer an open endpoint.

**Normal way:** log into the staff dashboard, open the Growers
Directory page, and click **"Create Login"** next to a grower. It'll
prompt for a phone number and a temporary password, and creates the
farmer account for you — no terminal needed.

**Manual way** (e.g. scripting many accounts at once), from a terminal
that's already logged into the staff dashboard in the same browser
session — or curl with a staff session cookie attached:

```bash
curl -X POST http://localhost:3000/farmer/register \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=YOUR_STAFF_SESSION_TOKEN" \
  -d '{"grower_id":"GWR-00123","name":"John Mwangi","phone":"0712345678","email":"johnmwangi@example.com","password":"farmer123"}'
```

## 2. Enabling real push notifications (optional, next step)

The service worker already listens for `push` events and shows a
notification. To actually send one, add `web-push` to the backend:

```bash
npm install web-push
npx web-push generate-vapid-keys
```

Then, in `farmer-routes.js`, store each farmer's push subscription
(the app can collect it via `PushManager.subscribe()`) in the
`push_subscription` column already created for you, and call
`webpush.sendNotification(subscription, payload)` whenever a harvest
becomes due or an NDVI reading comes in. This is scaffolded but not
wired up yet, since it needs your own VAPID keys.

---

## You're now doing this from your phone — what changes

You mentioned you used Visual Studio (Code) before. Here's the honest
mapping of what a phone-based workflow looks like:

- **Editing code**: you don't need VS Code at all for small changes —
  I (Claude) can keep editing these files for you in chat and hand you
  updated files each time. For anything you want to poke at yourself
  on the go, **GitHub's mobile web editor** (open your repo at
  github.com in your phone's browser, press `.` — or use "github.dev" —
  to get a lightweight VS Code-in-the-browser) works surprisingly well.
  There's also **Claude Code**, which you can run from the **Claude
  mobile app** — it gives you the same "delegate a coding task" flow
  you'd get on desktop, from your phone.
- **Version control**: put this project in a GitHub repo. You can
  create the repo and upload this folder straight from your phone's
  browser (github.com → New repository → "uploading an existing file").
- **Hosting the app + database**: since this needs PostGIS (real
  geometry columns, `ST_AsGeoJSON`, etc.), the two easiest phone-friendly
  options are:
  - **Render** (render.com) — connect your GitHub repo, it builds and
    deploys `server/` automatically on every push. Add a managed
    Postgres instance from the same dashboard and run
    `CREATE EXTENSION IF NOT EXISTS postgis;` once via their built-in
    SQL console.
  - **Railway** (railway.app) — same idea: GitHub-connected auto
    deploys, one-click Postgres add-on, works entirely from a mobile
    browser.
  - Either way: set the **Root Directory** to `server`, **Build
    Command** to `npm install`, **Start Command** to `npm start`, and
    add a `DATABASE_URL` environment variable pointing at the Postgres
    instance they give you (that's what the `server.js` change above
    reads automatically).
- **After deploy**: your customer's PWA lives at
  `https://your-app.onrender.com/farmer/login.html` — that's the link
  a farmer opens once, then adds to their home screen. No app store.

If you want, I can also generate the exact `render.yaml` (or a Railway
config) for one-click setup once you've picked a provider — just say
which.

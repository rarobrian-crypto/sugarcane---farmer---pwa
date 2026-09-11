# Changelog

One line per deploy — what changed and why, so future-you (or anyone
else) doesn't have to reconstruct it from commit messages.

## Unreleased
- Restructured `server.js` (1,500 lines) into `lib/` (auth, migrations,
  parcel status) and `routes/` (growers, parcels, ndvi, route-analysis,
  staff-auth) modules. No behavior change — same endpoints, same
  permissions, same responses.
- Replaced the ad-hoc `setupXTable()` functions (which ran concurrently
  at boot and caused a real bug — one tried to alter the `parcels`
  table before another had finished creating it) with a proper
  sequential migration runner (`lib/migrate.js` + `migrations/*.sql`).
- Server now waits for migrations to finish before it starts accepting
  requests, closing a startup race window.
- Locked `POST /farmer/register` behind staff auth (`manage_growers`
  permission) — it was previously reachable by anyone on the internet
  with no login. Added a "Create Login" button on the Growers
  Directory page so staff don't need `curl` anymore.

## 2026-09-10
- Added the farmer PWA (`/farmer/*`): dashboard, NDVI, harvest
  tracker, map, route-to-parcel, Add Parcel (GPS walk / manual draw /
  RTK-Total-Station file import), offline support via service worker.
- First production deploy to Render (`sugarcane-farmer-pwa-app`) with
  a separate Postgres instance from the original local database.
- Reconstructed `growers` and `parcels` table schemas as explicit
  `CREATE TABLE` statements — neither had one anywhere in the original
  codebase (they were created by hand in the original local database).

const express = require("express");
const { Pool } = require("pg");

const { runMigrations } = require("./lib/migrate");
const { STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL, computeInitialStatus } = require("./lib/parcel-status");
const {
  requireAuth,
  requirePermission,
  permissionsFor,
  getSession,
  verifyPassword,
  parseCookies,
  SESSIONS,
  SESSION_TTL_MS,
  seedDemoAccounts
} = require("./lib/auth");

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(requireAuth);
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// In production (Render/Railway/etc) set DATABASE_URL and the pool
// below uses it automatically. Locally, with no DATABASE_URL set,
// it falls back to the original hardcoded local settings — so
// local development keeps using your existing local database
// exactly as before, untouched by any of this.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : new Pool({
      host: "localhost",
      port: 5433,
      user: "postgres",
      password: "postgres",
      database: "sugarcane GIS",
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

pool
  .connect()
  .then(async (client) => {
    console.log("✅ Connected to PostgreSQL");
    client.release();
    await runMigrations(pool); // sequential, ordered — see lib/migrate.js
    await seedDemoAccounts(pool);

    // Only start accepting requests once the schema is actually
    // ready — this closes the gap that caused an early deploy bug
    // (a request could previously arrive before migrations finished).
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database Connection Error:", err);
    process.exit(1); // fail loudly on boot rather than silently serving with no DB
  });

app.get("/", (req, res) => {
  res.send("Sugarcane GIS Backend Running");
});

// ======================================
// Route modules
// ======================================

require("./routes/staff-auth")(app, pool, {
  SESSIONS, SESSION_TTL_MS, verifyPassword, parseCookies, getSession, permissionsFor
});

require("./routes/growers")(app, pool, { requirePermission });

require("./routes/parcels")(app, pool, {
  STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL, computeInitialStatus, requirePermission
});

require("./routes/ndvi")(app, pool, { requirePermission });

require("./routes/route-analysis")(app, pool, { requirePermission });

// Farmer PWA (customer-facing app) — separate login + session from
// the staff dashboard above. Everything in here is scoped to the
// logged-in farmer's own grower_id.
require("./farmer-routes")(app, pool, {
  computeInitialStatus, STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL,
  getStaffSession: getSession, permissionsFor
});

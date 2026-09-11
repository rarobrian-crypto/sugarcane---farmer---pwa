const crypto = require("crypto");

// ======================================
// This module is required from server.js:
//   require("./farmer-routes")(app, pool, { computeInitialStatus, STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL });
//
// It adds a second, completely separate login system for
// individual farmers (customers), so it never touches the
// staff `users` table or staff permissions above. A farmer
// can only ever read/write the parcel(s) tied to their own
// Grower_ID.
// ======================================

module.exports = function attachFarmerRoutes(app, pool, shared) {
  const { STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL, computeInitialStatus, getStaffSession, permissionsFor } = shared;

  // Guards a route with the *staff* dashboard's own session +
  // permission system (separate from the farmer session below).
  // Used only for staff actions that happen to live under
  // /farmer/*, like creating a farmer's login — everything else
  // under /farmer/* intentionally bypasses staff auth entirely
  // (see the bypass in server.js's requireAuth).
  function requireStaffPermission(permission) {
    return (req, res, next) => {
      const session = getStaffSession(req);
      if (!session) {
        return res.status(401).json({ success: false, error: "Staff login required." });
      }
      if (!permissionsFor(session.department).includes(permission)) {
        return res.status(403).json({
          success: false,
          error: `Your department (${session.department}) doesn't have access to this action. Requires: ${permission}.`
        });
      }
      req.staffUser = session;
      next();
    };
  }

  const FARMER_SESSIONS = new Map(); // token -> { farmerId, growerId, expires }
  const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — farmers stay logged in on their phone

  function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }
  function verifyPassword(password, salt, hash) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(hashPassword(password, salt), "hex"),
        Buffer.from(hash, "hex")
      );
    } catch (e) {
      return false;
    }
  }
  function parseCookies(req) {
    const header = req.headers.cookie;
    const cookies = {};
    if (!header) return cookies;
    header.split(";").forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return;
      cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    });
    return cookies;
  }
  function getFarmerSession(req) {
    const token = parseCookies(req).farmer_session_token;
    if (!token) return null;
    const session = FARMER_SESSIONS.get(token);
    if (!session) return null;
    if (session.expires < Date.now()) {
      FARMER_SESSIONS.delete(token);
      return null;
    }
    return session;
  }
  function requireFarmerAuth(req, res, next) {
    const session = getFarmerSession(req);
    if (!session) return res.status(401).json({ error: "Not logged in." });
    req.farmer = session;
    next();
  }

  // Table setup for farmer_users/harvest_confirmations and the
  // extra parcels columns now lives in migrations/002_farmer_pwa.sql,
  // run sequentially by lib/migrate.js before the server starts
  // accepting requests (see server.js). This used to duplicate that
  // work here in its own setup() function, which raced against the
  // other ad-hoc setup functions server.js used to have — that race
  // was the root cause of an early "relation parcels does not
  // exist" deploy bug. Migrations fixed it structurally.

  // ---------- Helpers ----------
  async function getParcelForFarmer(parcelId, growerId) {
    const result = await pool.query(
      `SELECT
        "Parcel_ID","Grower_ID","Area_Ha","Variety","Planting_Date","Harvest_Due",
        ${STATUS_SQL}, ${CROP_AGE_SQL}, ${HARVEST_STATUS_SQL},
        "Ratoon_Cycle","Yield_t_ha","Estimated_Tonnage",
        "Land_Surveyed","Survey_Date","Survey_Notes",
        ST_AsGeoJSON(ST_Transform(geometry,4326))::json AS geometry,
        ST_Y(ST_Centroid(geometry)) AS center_lat,
        ST_X(ST_Centroid(geometry)) AS center_lng
      FROM parcels
      WHERE "Parcel_ID" = $1 AND "Grower_ID" = $2`,
      [parcelId, growerId]
    );
    return result.rows[0] || null;
  }

  function toClientParcel(row) {
    const ring = (row.geometry?.coordinates?.[0] || []).slice(0, -1); // drop closing point
    return {
      Parcel_ID: row.Parcel_ID,
      Grower_ID: row.Grower_ID,
      Area_Ha: row.Area_Ha,
      Variety: row.Variety,
      Planting_Date: row.Planting_Date,
      Harvest_Due: row.Harvest_Due,
      Status: row.Status,
      Ratoon_Cycle: row.Ratoon_Cycle,
      Estimated_Tonnage: row.Estimated_Tonnage,
      land_surveyed: row.Land_Surveyed,
      survey_date: row.Survey_Date,
      survey_notes: row.Survey_Notes,
      center: { lat: row.center_lat, lng: row.center_lng },
      boundary: ring.map((c) => [c[1], c[0]]), // -> [lat,lng]
      coordinates_table: ring.map((c) => [c[1], c[0]])
    };
  }

  // ---------- AUTH ----------

  // A farmer account is created by staff (Growers Department or
  // above — the same permission that already gates adding a
  // grower in the staff dashboard), tied to a real Grower_ID
  // already in the system. This used to be an open endpoint;
  // it no longer is.
  app.post("/farmer/register", requireStaffPermission("manage_growers"), async (req, res) => {
    try {
      const { grower_id, name, phone, email, password } = req.body;
      if (!grower_id || !name || !phone || !password) {
        return res.status(400).json({ success: false, error: "grower_id, name, phone and password are required." });
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = hashPassword(password, salt);
      const result = await pool.query(
        `INSERT INTO farmer_users (grower_id, name, phone, email, password_hash, password_salt)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, grower_id, name, phone, email`,
        [grower_id, name, phone, email || null, hash, salt]
      );
      res.json({ success: true, farmer: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/farmer/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({ success: false, error: "Enter your phone/email and password." });
      }
      const result = await pool.query(
        `SELECT * FROM farmer_users WHERE phone = $1 OR email = $1`,
        [identifier]
      );
      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        return res.status(401).json({ success: false, error: "Incorrect phone/email or password." });
      }
      const token = crypto.randomBytes(32).toString("hex");
      FARMER_SESSIONS.set(token, {
        farmerId: user.id,
        growerId: user.grower_id,
        expires: Date.now() + SESSION_TTL_MS
      });
      res.cookie("farmer_session_token", token, {
        httpOnly: true,
        maxAge: SESSION_TTL_MS,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
      res.json({ success: true, name: user.name });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Login failed." });
    }
  });

  app.post("/farmer/logout", (req, res) => {
    const token = parseCookies(req).farmer_session_token;
    if (token) FARMER_SESSIONS.delete(token);
    res.clearCookie("farmer_session_token");
    res.json({ success: true });
  });

  app.get("/farmer/session", (req, res) => {
    const session = getFarmerSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, growerId: session.growerId });
  });

  // ---------- FARM DATA (all scoped to the logged-in farmer) ----------

  app.get("/farmer/api/me", requireFarmerAuth, async (req, res) => {
    try {
      const farmerResult = await pool.query(
        `SELECT name, phone, email, grower_id FROM farmer_users WHERE id = $1`,
        [req.farmer.farmerId]
      );
      const parcelsResult = await pool.query(
        `SELECT "Parcel_ID" FROM parcels WHERE "Grower_ID" = $1 ORDER BY "Parcel_ID"`,
        [req.farmer.growerId]
      );
      if (parcelsResult.rows.length === 0) {
        return res.json({ farmer: farmerResult.rows[0], parcel: null, parcels: [] });
      }
      // MVP: this customer app is built for a single-parcel farmer.
      // If a grower has several parcels, the first is shown by
      // default and the rest are listed for a future parcel-switcher.
      const primary = await getParcelForFarmer(parcelsResult.rows[0].Parcel_ID, req.farmer.growerId);
      res.json({
        farmer: farmerResult.rows[0],
        parcel: toClientParcel(primary),
        parcels: parcelsResult.rows.map((r) => r.Parcel_ID)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your farm." });
    }
  });

  // Lightweight list for a parcel switcher once a farmer has more than one.
  app.get("/farmer/api/parcels", requireFarmerAuth, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT "Parcel_ID","Variety","Area_Ha",${STATUS_SQL}
         FROM parcels WHERE "Grower_ID" = $1 ORDER BY "Parcel_ID"`,
        [req.farmer.growerId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load your parcels." });
    }
  });

  app.get("/farmer/api/parcel/:id", requireFarmerAuth, async (req, res) => {
    try {
      const p = await getParcelForFarmer(req.params.id, req.farmer.growerId);
      if (!p) return res.status(404).json({ error: "Parcel not found." });
      res.json(toClientParcel(p));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load parcel." });
    }
  });

  // Add a brand-new parcel for this farmer. The boundary can come from
  // a phone GPS walk, a manual tap-to-draw, or an imported RTK/Total
  // Station survey file — the client always sends the same shape
  // ([lat,lng] pairs) regardless of source, tagged with how it was made.
  app.post("/farmer/api/parcel", requireFarmerAuth, async (req, res) => {
    try {
      const { variety, planting_date, boundary, boundary_source } = req.body;
      let { parcel_id } = req.body;

      if (!Array.isArray(boundary) || boundary.length < 3) {
        return res.status(400).json({ success: false, error: "A boundary needs at least 3 points." });
      }
      const validSources = ["gps_walk", "manual_draw", "imported_survey"];
      if (!validSources.includes(boundary_source)) {
        return res.status(400).json({ success: false, error: "Invalid boundary source." });
      }

      if (!parcel_id) {
        const countResult = await pool.query(
          `SELECT COUNT(*)::int AS n FROM parcels WHERE "Grower_ID" = $1`,
          [req.farmer.growerId]
        );
        parcel_id = `${req.farmer.growerId}-P${countResult.rows[0].n + 1}`;
      }
      const exists = await pool.query(`SELECT 1 FROM parcels WHERE "Parcel_ID" = $1`, [parcel_id]);
      if (exists.rowCount > 0) {
        return res.status(400).json({ success: false, error: `Parcel ID ${parcel_id} already exists.` });
      }

      const ring = boundary.map((pt) => [pt[1], pt[0]]); // [lat,lng] -> [lng,lat]
      ring.push(ring[0]);
      const geojson = { type: "Polygon", coordinates: [ring] };
      const initialStatus = computeInitialStatus(planting_date, null);

      await pool.query(
        `INSERT INTO parcels
          ("Parcel_ID","Grower_ID","Variety","Status","Planting_Date","Boundary_Source",geometry)
         VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_GeomFromGeoJSON($7),4326))`,
        [parcel_id, req.farmer.growerId, variety || null, initialStatus, planting_date || null, boundary_source, JSON.stringify(geojson)]
      );

      // Area is computed from the real geometry, not estimated client-side.
      const areaResult = await pool.query(
        `UPDATE parcels SET "Area_Ha" = ROUND((ST_Area(geometry::geography) / 10000)::numeric, 2)
         WHERE "Parcel_ID" = $1 RETURNING "Area_Ha"`,
        [parcel_id]
      );

      const p = await getParcelForFarmer(parcel_id, req.farmer.growerId);
      res.json({ success: true, parcel: toClientParcel(p), area_ha: areaResult.rows[0].Area_Ha });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/farmer/api/parcel/:id/ndvi", requireFarmerAuth, async (req, res) => {
    try {
      const owns = await getParcelForFarmer(req.params.id, req.farmer.growerId);
      if (!owns) return res.status(404).json({ error: "Parcel not found." });
      const readings = await pool.query(
        `SELECT avg_ndvi, reading_date FROM ndvi_readings
         WHERE parcel_id = $1 ORDER BY reading_date ASC`,
        [req.params.id]
      );
      if (readings.rows.length === 0) {
        return res.json({ current: 0, status: "No data yet", trend: [] });
      }
      const trend = readings.rows.map((r) => ({
        month: new Date(r.reading_date).toLocaleDateString("en-US", { month: "short" }),
        value: Number(r.avg_ndvi)
      }));
      const current = trend[trend.length - 1].value;
      res.json({
        current,
        status: current >= 0.6 ? "Healthy" : current >= 0.4 ? "Fair" : "Stressed",
        trend
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load crop health." });
    }
  });

  app.get("/farmer/api/parcel/:id/harvest", requireFarmerAuth, async (req, res) => {
    try {
      const p = await getParcelForFarmer(req.params.id, req.farmer.growerId);
      if (!p) return res.status(404).json({ error: "Parcel not found." });
      const daysTo = p.Harvest_Due
        ? Math.ceil((new Date(p.Harvest_Due) - new Date()) / 86400000)
        : null;
      const history = [
        { label: "Planting", date: fmt(p.Planting_Date), state: p.Planting_Date ? "done" : "upcoming" },
        {
          label: "Growth Monitoring",
          date: p.Planting_Date ? `${fmt(p.Planting_Date)} – ${fmt(p.Harvest_Due)}` : "—",
          state: p.Status === "Growing" || p.Status === "Mature" || p.Status === "Harvested" ? "done" : "upcoming"
        },
        { label: "Harvest", date: fmt(p.Harvest_Due), state: p.Status === "Harvested" ? "done" : "upcoming" }
      ];
      res.json({
        status: p.Harvest_Status === "Overdue" ? "Ready for Harvest" : p.Harvest_Status || p.Status,
        days_to_harvest: daysTo,
        estimated_yield: p.Estimated_Tonnage,
        harvest_date: p.Harvest_Due,
        ratoon_cycle: p.Ratoon_Cycle,
        history
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load harvest info." });
    }
  });

  app.post("/farmer/api/parcel/:id/harvest/confirm", requireFarmerAuth, async (req, res) => {
    try {
      const owns = await getParcelForFarmer(req.params.id, req.farmer.growerId);
      if (!owns) return res.status(404).json({ error: "Parcel not found." });
      await pool.query(
        `INSERT INTO harvest_confirmations (parcel_id, confirmed_by) VALUES ($1,$2)`,
        [req.params.id, req.farmer.growerId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Could not save." });
    }
  });

  app.get("/farmer/api/alerts", requireFarmerAuth, async (req, res) => {
    try {
      const farmerResult = await pool.query(`SELECT grower_id FROM farmer_users WHERE id = $1`, [req.farmer.farmerId]);
      const parcelsResult = await pool.query(`SELECT "Parcel_ID" FROM parcels WHERE "Grower_ID" = $1`, [req.farmer.growerId]);
      const alerts = [];
      for (const row of parcelsResult.rows) {
        const p = await getParcelForFarmer(row.Parcel_ID, req.farmer.growerId);
        if (p.Harvest_Status === "Due Soon" || p.Harvest_Status === "Overdue") {
          const daysTo = Math.ceil((new Date(p.Harvest_Due) - new Date()) / 86400000);
          alerts.push({
            id: `harvest-${p.Parcel_ID}`,
            type: "harvest",
            title: p.Harvest_Status === "Overdue" ? "Harvest Overdue" : "Harvest Due Soon",
            body: `Parcel ${p.Parcel_ID} ${daysTo > 0 ? `will be ready for harvest in ${daysTo} days.` : "is ready for harvest."}`,
            time: "today"
          });
        }
        const latestNdvi = await pool.query(
          `SELECT avg_ndvi, reading_date FROM ndvi_readings WHERE parcel_id=$1 ORDER BY reading_date DESC LIMIT 1`,
          [row.Parcel_ID]
        );
        if (latestNdvi.rows[0]) {
          const v = Number(latestNdvi.rows[0].avg_ndvi);
          alerts.push({
            id: `ndvi-${p.Parcel_ID}`,
            type: "crop_health",
            title: v >= 0.6 ? "Crop Health Good" : v >= 0.4 ? "Crop Health Fair" : "Crop Health Alert",
            body: `NDVI ${v.toFixed(2)} (${v >= 0.6 ? "Healthy" : v >= 0.4 ? "Fair" : "Stressed"})`,
            time: fmt(latestNdvi.rows[0].reading_date)
          });
        }
      }
      res.json(alerts);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load alerts." });
    }
  });

  app.put("/farmer/api/parcel/:id/info", requireFarmerAuth, async (req, res) => {
    try {
      const owns = await getParcelForFarmer(req.params.id, req.farmer.growerId);
      if (!owns) return res.status(404).json({ success: false, error: "Parcel not found." });
      const { land_surveyed, survey_date, survey_notes, boundary } = req.body;

      await pool.query(
        `UPDATE parcels SET "Land_Surveyed"=$1, "Survey_Date"=$2, "Survey_Notes"=$3 WHERE "Parcel_ID"=$4`,
        [!!land_surveyed, survey_date || null, survey_notes || null, req.params.id]
      );

      // boundary comes from the app as [lat,lng] pairs captured by GPS
      if (Array.isArray(boundary) && boundary.length >= 3) {
        const ring = boundary.map((pt) => [pt[1], pt[0]]); // -> [lng,lat]
        ring.push(ring[0]);
        const geojson = { type: "Polygon", coordinates: [ring] };
        await pool.query(
          `UPDATE parcels SET geometry = ST_SetSRID(ST_GeomFromGeoJSON($1),4326) WHERE "Parcel_ID"=$2`,
          [JSON.stringify(geojson), req.params.id]
        );
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get("/farmer/api/route", requireFarmerAuth, async (req, res) => {
    try {
      const { startLat, startLng, destLat, destLng } = req.query;
      if (!startLat || !startLng || !destLat || !destLng) {
        return res.status(400).json({ success: false, error: "Missing coordinates." });
      }
      const url =
        "https://router.project-osrm.org/route/v1/driving/" +
        startLng + "," + startLat + ";" + destLng + "," + destLat +
        "?overview=full&geometries=geojson";
      const response = await fetch(url);
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Route lookup failed." });
    }
  });

  function fmt(d) {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date) ? String(d) : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
};

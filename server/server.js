const express = require('express');

const { Pool } = require('pg');

const crypto = require('crypto');

const fs = require('fs');

const path = require('path');

const app = express();

app.use(express.json({ limit:"15mb" }));

// ======================================
// AUTHENTICATION (no external deps -
// uses Node's built-in crypto + a manual
// cookie, since bcrypt/express-session
// aren't in node_modules)
// ======================================

const SESSIONS = new Map(); // token -> { username, department, expires }

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function hashPassword(password, salt){

    return crypto.scryptSync(password, salt, 64).toString("hex");

}

function createUser(password){

    const salt = crypto.randomBytes(16).toString("hex");

    const hash = hashPassword(password, salt);

    return { salt, hash };

}

function verifyPassword(password, salt, hash){

    const attempt = hashPassword(password, salt);

    try{

        return crypto.timingSafeEqual(

            Buffer.from(attempt, "hex"),

            Buffer.from(hash, "hex")

        );

    }
    catch(e){

        return false;

    }

}

function parseCookies(req){

    const header = req.headers.cookie;

    const cookies = {};

    if(!header) return cookies;

    header.split(";").forEach(pair => {

        const idx = pair.indexOf("=");

        if(idx === -1) return;

        const key = pair.slice(0, idx).trim();

        const val = pair.slice(idx + 1).trim();

        cookies[key] = decodeURIComponent(val);

    });

    return cookies;

}

function getSession(req){

    const cookies = parseCookies(req);

    const token = cookies.session_token;

    if(!token) return null;

    const session = SESSIONS.get(token);

    if(!session) return null;

    if(session.expires < Date.now()){

        SESSIONS.delete(token);

        return null;

    }

    return session;

}

// Protects the main app (HTML + API) while leaving the
// login page and its own assets/API reachable.

function requireAuth(req, res, next){

    const openPaths = [

        "/login.html",

        "/login",

        "/logout",

        "/session"

    ];

    if(openPaths.includes(req.path)){

        return next();

    }

    // Static assets (css/js/images) stay reachable so the
    // login page itself can load them.

    if(req.path.startsWith("/css/") ||
       req.path.startsWith("/js/") ||
       req.path.startsWith("/images/")){

        return next();

    }

    // The farmer PWA (customer-facing app) lives under /farmer/*
    // and has its own separate login + session cookie, defined in
    // farmer-routes.js. It must never be gated by the *staff*
    // session check above, so every /farmer/* request (pages,
    // assets, and its own API) skips straight past this middleware.
    // The PWA manifest/service worker/icons at the site root also
    // need to load with no staff session.

    if(req.path.startsWith("/farmer/") ||
       req.path === "/manifest.json" ||
       req.path === "/service-worker.js" ||
       req.path.startsWith("/icons/")){

        return next();

    }

    const session = getSession(req);

    if(!session){

        if(req.path === "/" || req.path.endsWith(".html")){

            return res.redirect("/login.html");

        }

        return res.status(401).json({ error:"Not authenticated" });

    }

    req.user = session;

    next();

}

app.use(requireAuth);

// ======================================
// ROLE-BASED ACCESS CONTROL
//
// Real server-side enforcement, not just hidden buttons -
// each write/sensitive action checks the caller's actual
// session department against this matrix. System
// Administrator always has every permission.
// ======================================

const PERMISSIONS = {

    "Growers Department": [
        "view_dashboard", "view_map", "view_parcels",
        "view_growers", "manage_growers"
    ],

    "Survey Department": [
        "view_dashboard", "view_map", "view_parcels",
        "manage_parcels", "download_data"
    ],

    "Harvesting Department": [
        "view_dashboard", "view_map", "view_parcels",
        "view_harvest", "view_production", "view_ndvi"
    ],

    "Transport Department": [
        "view_dashboard", "view_map", "view_parcels",
        "route_analysis"
    ],

    "Crop Monitoring Department": [
        "view_dashboard", "view_map", "view_parcels",
        "view_ndvi", "manage_ndvi"
    ],

    "Management": [
        "view_dashboard", "view_map", "view_parcels",
        "view_growers", "view_production", "view_harvest",
        "view_analytics", "generate_reports", "download_data",
        "view_ndvi"
    ],

    "System Administrator": [
        "view_dashboard", "view_map", "view_parcels",
        "manage_parcels", "view_growers", "manage_growers",
        "view_production", "view_harvest", "view_analytics",
        "generate_reports", "download_data", "route_analysis",
        "manage_settings", "manage_users", "view_ndvi", "manage_ndvi"
    ]

};

function permissionsFor(department){

    return PERMISSIONS[department] || [];

}

function requirePermission(permission){

    return (req, res, next) => {

        const perms = permissionsFor(req.user?.department);

        if(!perms.includes(permission)){

            return res.status(403).json({

                success:false,

                error:`Your department (${req.user?.department}) doesn't have access to this action. Requires: ${permission}.`

            });

        }

        next();

    };

}

// ======================================
// Serve Frontend
// ======================================

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

// ======================================
// PostgreSQL Pool Connection
// ======================================

// In production (Render/Railway/etc) set DATABASE_URL and the pool
// below uses it automatically. Locally, with no DATABASE_URL set,
// it falls back to the original hardcoded local settings.

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      })
    : new Pool({
        host: 'localhost',
        port: 5433,
        user: 'postgres',
        password: 'postgres',
        database: 'sugarcane GIS',

        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

pool.connect()

.then(client => {

    console.log("✅ Connected to PostgreSQL");

    client.release();

    setupAuthTable();

    setupNdviTable();

    setupCoreTables();

})

.catch(err => {

    console.error("Database Connection Error:", err);

});

// ======================================
// AUTH TABLE + DEMO ACCOUNT SEEDING
// ======================================

const DEMO_ACCOUNTS = [

    { department:"Growers Department",       username:"grower.admin",    password:"password123" },
    { department:"Survey Department",         username:"survey.admin",    password:"password123" },
    { department:"Harvesting Department",     username:"harvest.admin",   password:"password123" },
    { department:"Transport Department",      username:"transport.admin", password:"password123" },
    { department:"Crop Monitoring Department", username:"monitoring.admin", password:"password123" },
    { department:"Management",                username:"mgmt.admin",      password:"password123" },
    { department:"System Administrator",      username:"sysadmin",        password:"password123" }

];

async function setupAuthTable(){

    try{

        await pool.query(`

            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                department TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()

            );

        `);

        let seededCount = 0;

        for(const acct of DEMO_ACCOUNTS){

            const existing = await pool.query(

                "SELECT 1 FROM users WHERE username = $1",

                [acct.username]

            );

            if(existing.rowCount > 0) continue;

            const { salt, hash } = createUser(acct.password);

            await pool.query(

                `INSERT INTO users (username, department, password_hash, password_salt)
                 VALUES ($1, $2, $3, $4)`,

                [acct.username, acct.department, hash, salt]

            );

            seededCount++;

        }

        if(seededCount > 0){

            console.log(`✅ Seeded ${seededCount} new demo account(s) (see DEMO_ACCOUNTS in server.js)`);

        }

        console.log("✅ Auth table ready");

    }
    catch(err){

        console.error("Auth table setup failed:", err.message);

    }

}

// ======================================
// NDVI READINGS TABLE
//
// Stores real recorded NDVI readings per parcel. A
// reading's "source" tells you how the numbers were
// produced:
//   - "drone_multispectral" : computed from an uploaded
//     NIR + Red band pair (real NDVI math, client-side)
//   - "drone_rgb_approx"    : computed from a normal RGB
//     drone photo using a visible-light vegetation index
//     (VARI) - an approximation, not true NDVI, since a
//     standard camera has no NIR band
//   - "satellite"           : manually logged from an
//     external satellite NDVI tool (e.g. Sentinel Hub/EO
//     Browser) - this app has no live satellite feed
//     wired up, so these are entered, not fetched
//   - "manual"              : entered directly, e.g. from
//     desktop software like Pix4D/QGIS that already did
//     the NDVI computation
// ======================================

async function setupNdviTable(){

    try{

        await pool.query(`

            CREATE TABLE IF NOT EXISTS ndvi_readings (

                id SERIAL PRIMARY KEY,
                parcel_id TEXT NOT NULL,
                reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
                avg_ndvi NUMERIC NOT NULL,
                min_ndvi NUMERIC,
                max_ndvi NUMERIC,
                source TEXT NOT NULL,
                image_filename TEXT,
                notes TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT NOW()

            );

        `);

        console.log("✅ NDVI table ready");

    }
    catch(err){

        console.error("NDVI table setup failed:", err.message);

    }

}
//
// Status/Crop_Age/Harvest_Status are derived live from
// Planting_Date and Harvest_Due every time parcels are

// ======================================
// GROWERS + PARCELS TABLES
//
// Neither table had a CREATE statement anywhere in the
// original codebase — they were created by hand in the
// original local database, so their exact DDL was never
// captured in source. This recreates their shape from how
// the rest of server.js actually reads/writes them
// (POST /growers, POST/PUT /addParcel, /parcel/:id), so a
// brand-new deploy (e.g. a fresh Render Postgres) isn't
// stuck with no schema at all. If your original database
// had extra columns beyond what's used here, add them
// manually — this only guarantees the columns this app
// depends on.
// ======================================

async function setupCoreTables(){

    try{

        await pool.query(`

            CREATE EXTENSION IF NOT EXISTS postgis;

            CREATE TABLE IF NOT EXISTS growers (
                grower_id SERIAL PRIMARY KEY,
                grower_name TEXT,
                phone TEXT,
                village TEXT
            );

            CREATE TABLE IF NOT EXISTS parcels (
                "Parcel_ID" TEXT PRIMARY KEY,
                "Grower_ID" TEXT,
                "Variety" TEXT,
                "Status" TEXT,
                "Area_Ha" NUMERIC,
                "Planting_Date" DATE,
                "Harvest_Due" DATE,
                "Ratoon_Cycle" INTEGER,
                "Yield_t_ha" NUMERIC,
                "Estimated_Tonnage" NUMERIC,
                geometry GEOMETRY(Polygon, 4326)
            );

            ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Land_Surveyed" BOOLEAN DEFAULT FALSE;
            ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Survey_Date" DATE;
            ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Survey_Notes" TEXT;
            ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Boundary_Source" TEXT;

        `);

        console.log("✅ Growers/Parcels tables ready");

    }
    catch(err){

        console.error("Growers/Parcels table setup failed:", err.message);

    }

}

// read, rather than relying on a manually-set value that
// goes stale. Thresholds:
//   - "Planned"   : planting date is in the future
//   - "Fallow"    : no planting date set
//   - "Growing"   : planted, more than 45 days from harvest
//   - "Mature"    : within 45 days of the harvest due date
//                   (or, with no harvest date, within 45
//                   days of the 12-month default maturity)
//   - "Harvested" : harvest due date has passed
// ======================================

const STATUS_SQL = `

CASE
    WHEN "Planting_Date" IS NULL THEN 'Fallow'
    WHEN "Planting_Date" > CURRENT_DATE THEN 'Planned'
    WHEN "Harvest_Due" IS NOT NULL AND CURRENT_DATE >= "Harvest_Due" THEN 'Harvested'
    WHEN "Harvest_Due" IS NOT NULL AND CURRENT_DATE >= ("Harvest_Due" - INTERVAL '45 days') THEN 'Mature'
    WHEN "Harvest_Due" IS NULL AND CURRENT_DATE >= ("Planting_Date" + INTERVAL '12 months' - INTERVAL '45 days') THEN 'Mature'
    ELSE 'Growing'
END AS "Status"

`;

const CROP_AGE_SQL = `

CASE
    WHEN "Planting_Date" IS NULL OR "Planting_Date" > CURRENT_DATE THEN NULL
    ELSE (
        DATE_PART('year', AGE(CURRENT_DATE, "Planting_Date")) * 12
        + DATE_PART('month', AGE(CURRENT_DATE, "Planting_Date"))
    )::int
END AS "Crop_Age"

`;

const HARVEST_STATUS_SQL = `

CASE
    WHEN "Harvest_Due" IS NULL THEN NULL
    WHEN CURRENT_DATE >= "Harvest_Due" THEN 'Overdue'
    WHEN CURRENT_DATE >= ("Harvest_Due" - INTERVAL '30 days') THEN 'Due Soon'
    ELSE 'Scheduled'
END AS "Harvest_Status"

`;

// Mirrors the SQL rules above, used only to seed a sane
// initial value on INSERT - the GET endpoints always
// recompute live and are the source of truth.

function computeInitialStatus(plantingDate, harvestDue, today = new Date()){

    const DAY = 24 * 60 * 60 * 1000;

    if(!plantingDate) return "Fallow";

    const plant = new Date(plantingDate);

    if(isNaN(plant)) return "Fallow";

    if(plant > today) return "Planned";

    if(harvestDue){

        const harvest = new Date(harvestDue);

        if(!isNaN(harvest)){

            if(today >= harvest) return "Harvested";

            if(today >= new Date(harvest.getTime() - 45 * DAY)) return "Mature";

            return "Growing";

        }

    }

    const fallbackMatureFrom = new Date(plant.getTime() + (365 - 45) * DAY);

    return (today >= fallbackMatureFrom) ? "Mature" : "Growing";

}

// ======================================
// HOME
// ======================================

app.get('/', (req, res) => {

    res.send("Sugarcane GIS Backend Running");

});

// ======================================
// GROWERS API
// ======================================

app.get('/growers', async (req, res) => {

    try {

        const result = await pool.query(`

            SELECT *

            FROM growers

            ORDER BY grower_id;

        `);

        res.json(result.rows);

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            error:"Database Error"

        });

    }

});

// ======================================
// PARCELS API (GeoJSON)
// ======================================

app.get('/parcels', async (req,res)=>{

    try{

        const result = await pool.query(`

SELECT

"Parcel_ID",
"Grower_ID",
"Area_Ha",
"Variety",
"Planting_Date",
"Harvest_Due",
${STATUS_SQL},
${CROP_AGE_SQL},
${HARVEST_STATUS_SQL},
"Ratoon_Cycle",
"Yield_t_ha",
"Estimated_Tonnage",

ST_AsGeoJSON(
ST_Transform(geometry,4326)
)::json AS geometry

FROM parcels

ORDER BY "Parcel_ID";

`);

        const geojson={

            type:"FeatureCollection",

            features:result.rows.map(row=>({

                type:"Feature",

                geometry:row.geometry,

                properties:{

                    Parcel_ID:row.Parcel_ID,

                    Grower_ID:row.Grower_ID,

                    Area_Ha:row.Area_Ha,

                    Variety:row.Variety,

                    Planting_Date:row.Planting_Date,

                    Harvest_Due:row.Harvest_Due,

                    Status:row.Status,

                    Crop_Age:row.Crop_Age,

                    Harvest_Status:row.Harvest_Status,

                    Ratoon_Cycle:row.Ratoon_Cycle,

                    Yield_t_ha:row.Yield_t_ha,

                    Estimated_Tonnage:row.Estimated_Tonnage

                }

            }))

        };

        res.json(geojson);

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            error:"Database Error"

        });

    }

});

// ======================================
// PARCEL SEARCH API
// ======================================

app.get('/parcel/:id', async(req,res)=>{

    try{

        const result=await pool.query(

`SELECT

"Parcel_ID",
"Grower_ID",
"Area_Ha",
"Variety",
"Planting_Date",
"Harvest_Due",
${STATUS_SQL},
${CROP_AGE_SQL},
${HARVEST_STATUS_SQL},
"Ratoon_Cycle",
"Yield_t_ha",
"Estimated_Tonnage",

ST_AsGeoJSON(
ST_Transform(geometry,4326)
)::json AS geometry

FROM parcels

WHERE "Parcel_ID"=$1;`,

[req.params.id]

);

        if(result.rows.length===0){

            return res.status(404).json({

                message:"Parcel not found"

            });

        }

        const row=result.rows[0];

        res.json({

            type:"Feature",

            geometry:row.geometry,

            properties:{

                Parcel_ID:row.Parcel_ID,

                Grower_ID:row.Grower_ID,

                Area_Ha:row.Area_Ha,

                Variety:row.Variety,

                Planting_Date:row.Planting_Date,

                Harvest_Due:row.Harvest_Due,

                Status:row.Status,

                Crop_Age:row.Crop_Age,

                Harvest_Status:row.Harvest_Status,

                Ratoon_Cycle:row.Ratoon_Cycle,

                Yield_t_ha:row.Yield_t_ha,

                Estimated_Tonnage:row.Estimated_Tonnage

            }

        });

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            error:"Database Error"

        });

    }

});

//------------------------------------------------------
// ADD NEW PARCEL
//------------------------------------------------------

app.post("/addParcel", requirePermission("manage_parcels"), async (req,res)=>{

 try{

    const p = req.body;

    //-----------------------------------------
    // Convert drawn coordinates into GeoJSON
    //-----------------------------------------

    const ring = [...p.geometry, p.geometry[0]];

    const geojson = {

        type: "Polygon",

        coordinates: [ring]

    };

    //-----------------------------------------
    // Basic validation
    //-----------------------------------------

    if(!p.parcel_id || !p.grower_id || !Array.isArray(p.geometry) || p.geometry.length < 3){

        return res.status(400).json({

            success:false,

            error:"Parcel ID, Grower and a drawn boundary (3+ points) are required."

        });

    }

    const initialStatus = computeInitialStatus(p.planting_date, p.harvest_due);

    //-----------------------------------------
    // Save parcel
    //-----------------------------------------

    await pool.query(

`
INSERT INTO parcels
(
    "Parcel_ID",
    "Grower_ID",
    "Variety",
    "Status",
    "Area_Ha",
    "Planting_Date",
    "Harvest_Due",
    "Ratoon_Cycle",
    "Yield_t_ha",
    "Estimated_Tonnage",
    geometry
)
VALUES
(
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,

    ST_SetSRID(

        ST_GeomFromGeoJSON($11),

        4326

    )

)
`,

    [

        p.parcel_id,

        p.grower_id,

        p.variety,

        initialStatus,

        p.area,

        p.planting_date || null,

        p.harvest_due || null,

        p.ratoon_cycle || null,

        p.yield_t_ha || null,

        p.estimated_tonnage || null,

        JSON.stringify(geojson)

    ]

    );

    const lons = ring.map(c => c[0]);
    const lats = ring.map(c => c[1]);

    res.json({

        success:true,

        parcel_id:p.parcel_id,

        bounds:[

            [Math.min(...lats), Math.min(...lons)],

            [Math.max(...lats), Math.max(...lons)]

        ]

    });

}
catch(err){

    console.error(err);

    res.status(500).json({

        success:false,

        error:err.message

    });

}   

});

//------------------------------------------------------
// UPDATE EXISTING PARCEL
//------------------------------------------------------

app.put("/parcel/:id", requirePermission("manage_parcels"), async (req,res)=>{

    try{

        const p = req.body;

        const result = await pool.query(

`
UPDATE parcels
SET
    "Grower_ID" = $1,
    "Variety" = $2,
    "Planting_Date" = $3,
    "Harvest_Due" = $4,
    "Ratoon_Cycle" = $5,
    "Yield_t_ha" = $6,
    "Estimated_Tonnage" = $7
WHERE "Parcel_ID" = $8
RETURNING "Parcel_ID";
`,

            [

                p.grower_id,

                p.variety,

                p.planting_date || null,

                p.harvest_due || null,

                p.ratoon_cycle || null,

                p.yield_t_ha || null,

                p.estimated_tonnage || null,

                req.params.id

            ]

        );

        if(result.rows.length === 0){

            return res.status(404).json({

                success:false,

                error:"Parcel not found."

            });

        }

        res.json({

            success:true,

            parcel_id:result.rows[0].Parcel_ID

        });

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            success:false,

            error:err.message

        });

    }

});

//------------------------------------------------------
// DELETE PARCEL
//------------------------------------------------------

app.delete("/parcel/:id", requirePermission("manage_parcels"), async (req,res)=>{

    try{

        const result = await pool.query(

            `DELETE FROM parcels WHERE "Parcel_ID" = $1 RETURNING "Parcel_ID";`,

            [req.params.id]

        );

        if(result.rows.length === 0){

            return res.status(404).json({

                success:false,

                error:"Parcel not found."

            });

        }

        res.json({

            success:true

        });

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            success:false,

            error:err.message

        });

    }

});
console.log("========== REGISTERING POST /growers ==========");
app.post("/growers", requirePermission("manage_growers"), async (req, res) => {
    
    try{

        const {

            grower_name,

            phone,

            village

        } = req.body;

        const result = await pool.query(

            `
            INSERT INTO growers
            (
                grower_name,
                phone,
                village
            )

            VALUES

            ($1,$2,$3)

            RETURNING *;
            `,

            [

                grower_name,

                phone,

                village

            ]

        );

        res.json(result.rows[0]);

    }

    catch(err){

        console.error(err);

        res.status(500).json({

            error:"Unable to save grower"

        });

    }

});
// ======================================
// AUTH ROUTES
// ======================================

app.post("/login", async (req, res) => {

    try{

        const { username, password } = req.body;

        if(!username || !password){

            return res.status(400).json({

                success:false,

                error:"Username and password are required."

            });

        }

        const result = await pool.query(

            "SELECT * FROM users WHERE username = $1",

            [username]

        );

        const user = result.rows[0];

        if(!user || !verifyPassword(password, user.password_salt, user.password_hash)){

            return res.status(401).json({

                success:false,

                error:"Invalid username or password."

            });

        }

        const token = crypto.randomBytes(32).toString("hex");

        SESSIONS.set(token, {

            username:user.username,

            department:user.department,

            expires:Date.now() + SESSION_TTL_MS

        });

        res.cookie("session_token", token, {

            httpOnly:true,

            maxAge:SESSION_TTL_MS,

            sameSite:"lax",

            secure: process.env.NODE_ENV === "production"

        });

        res.json({

            success:true,

            username:user.username,

            department:user.department

        });

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            success:false,

            error:"Login failed."

        });

    }

});

app.post("/logout", (req, res) => {

    const cookies = parseCookies(req);

    if(cookies.session_token){

        SESSIONS.delete(cookies.session_token);

    }

    res.clearCookie("session_token");

    res.json({ success:true });

});

app.get("/session", (req, res) => {

    const session = getSession(req);

    if(!session){

        return res.status(401).json({ authenticated:false });

    }

    res.json({

        authenticated:true,

        username:session.username,

        department:session.department,

        permissions:permissionsFor(session.department)

    });

});

// ======================================
// START SERVER
// ======================================

// ======================================
// NDVI READINGS API
// ======================================

// Latest reading per parcel - used to color the NDVI map
// and compute the summary stats/charts.

app.get("/ndvi", requirePermission("view_ndvi"), async (req, res) => {

    try{

        const result = await pool.query(`

            SELECT DISTINCT ON (parcel_id) *
            FROM ndvi_readings
            ORDER BY parcel_id, reading_date DESC, created_at DESC;

        `);

        res.json(result.rows);

    }
    catch(err){

        console.error(err);

        res.status(500).json({ error:"Database error" });

    }

});

// Full history for one parcel - for the "NDVI Over Time"
// chart.

app.get("/ndvi/:parcelId", requirePermission("view_ndvi"), async (req, res) => {

    try{

        const result = await pool.query(

            `SELECT * FROM ndvi_readings
             WHERE parcel_id = $1
             ORDER BY reading_date ASC`,

            [req.params.parcelId]

        );

        res.json(result.rows);

    }
    catch(err){

        console.error(err);

        res.status(500).json({ error:"Database error" });

    }

});

// Record a new reading. Stats (avg/min/max NDVI) are
// computed by the browser from real pixel data (or typed
// in manually) - this endpoint just persists what it's
// given, plus optionally saves an uploaded image.

app.post("/ndvi", requirePermission("manage_ndvi"), async (req, res) => {

    try{

        const p = req.body;

        if(!p.parcel_id || p.avg_ndvi === undefined || p.avg_ndvi === null){

            return res.status(400).json({

                success:false,

                error:"Parcel and average NDVI are required."

            });

        }

        const validSources = [

            "drone_multispectral", "drone_rgb_approx",
            "satellite", "manual"

        ];

        if(!validSources.includes(p.source)){

            return res.status(400).json({

                success:false,

                error:"Invalid source type."

            });

        }

        let imageFilename = null;

        if(p.image_base64){

            const matches = p.image_base64.match(/^data:image\/(\w+);base64,(.+)$/);

            if(matches){

                const ext = matches[1] === "jpeg" ? "jpg" : matches[1];

                const buffer = Buffer.from(matches[2], "base64");

                imageFilename = `ndvi_${p.parcel_id}_${Date.now()}.${ext}`;

                fs.writeFileSync(

                    path.join(__dirname, "public/images/ndvi_uploads", imageFilename),

                    buffer

                );

            }

        }

        const result = await pool.query(

            `INSERT INTO ndvi_readings
             (parcel_id, reading_date, avg_ndvi, min_ndvi, max_ndvi, source, image_filename, notes, created_by)
             VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,

            [

                p.parcel_id,
                p.reading_date || null,
                p.avg_ndvi,
                p.min_ndvi || null,
                p.max_ndvi || null,
                p.source,
                imageFilename,
                p.notes || null,
                req.user?.username || null

            ]

        );

        res.json({ success:true, reading:result.rows[0] });

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            success:false,

            error:"Unable to save NDVI reading."

        });

    }

});

// ======================================
// ROUTE ANALYSIS PROXY (permission-gated)
//
// The frontend used to call OSRM directly from the
// browser, which anyone could still do via devtools
// regardless of whether the button was hidden. Routing
// it through our own server means the permission check
// actually blocks the action, not just the UI.
// ======================================

app.get("/api/route", requirePermission("route_analysis"), async (req, res) => {

    try{

        const { startLat, startLng, destLat, destLng } = req.query;

        if(!startLat || !startLng || !destLat || !destLng){

            return res.status(400).json({

                success:false,

                error:"Missing coordinates."

            });

        }

        const url =

            "https://router.project-osrm.org/route/v1/driving/" +

            startLng + "," + startLat + ";" + destLng + "," + destLat +

            "?overview=full&geometries=geojson";

        const response = await fetch(url);

        const data = await response.json();

        res.json(data);

    }
    catch(err){

        console.error(err);

        res.status(500).json({

            success:false,

            error:"Route lookup failed."

        });

    }

});

// ======================================
// FARMER PWA ROUTES (customer-facing app)
//
// Separate login + session from the staff dashboard above.
// Everything here is scoped to the logged-in farmer's own
// grower_id — a farmer can only ever see/edit their own
// parcel(s).
// ======================================

require("./farmer-routes")(app, pool, { computeInitialStatus, STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL });

app.listen(PORT,()=>{

    console.log(`🚀 Server running on http://localhost:${PORT}`);

});
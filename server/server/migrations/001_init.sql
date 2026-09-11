-- Migration 001: base schema
--
-- growers and parcels never had a CREATE statement anywhere in the
-- original codebase (they were created by hand in the original local
-- database). This reconstructs their shape from how the app actually
-- reads/writes them. users and ndvi_readings match what the app
-- already created at boot before migrations existed.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

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

-- Migration 002: farmer PWA additions

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Land_Surveyed" BOOLEAN DEFAULT FALSE;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Survey_Date" DATE;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Survey_Notes" TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Boundary_Source" TEXT;

CREATE TABLE IF NOT EXISTS farmer_users (
    id SERIAL PRIMARY KEY,
    grower_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    push_subscription JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS harvest_confirmations (
    id SERIAL PRIMARY KEY,
    parcel_id TEXT NOT NULL,
    confirmed_by TEXT,
    confirmed_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS "Parcel_Name" TEXT;
UPDATE parcels SET "Parcel_Name" = "Parcel_ID" WHERE "Parcel_Name" IS NULL;

// ======================================
// Status/Crop_Age/Harvest_Status are derived live from
// Planting_Date and Harvest_Due every time parcels are read,
// rather than relying on a manually-set value that goes stale.
// Thresholds:
//   - "Planned"   : planting date is in the future
//   - "Fallow"    : no planting date set
//   - "Growing"   : planted, more than 45 days from harvest
//   - "Mature"    : within 45 days of the harvest due date
//                   (or, with no harvest date, within 45 days of
//                   the 12-month default maturity)
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

// Mirrors the SQL rules above, used only to seed a sane initial
// value on INSERT — the GET endpoints always recompute live and
// are the source of truth.
function computeInitialStatus(plantingDate, harvestDue, today = new Date()) {
  const DAY = 24 * 60 * 60 * 1000;
  if (!plantingDate) return "Fallow";
  const plant = new Date(plantingDate);
  if (isNaN(plant)) return "Fallow";
  if (plant > today) return "Planned";

  if (harvestDue) {
    const harvest = new Date(harvestDue);
    if (!isNaN(harvest)) {
      if (today >= harvest) return "Harvested";
      if (today >= new Date(harvest.getTime() - 45 * DAY)) return "Mature";
      return "Growing";
    }
  }

  const fallbackMatureFrom = new Date(plant.getTime() + (365 - 45) * DAY);
  return today >= fallbackMatureFrom ? "Mature" : "Growing";
}

module.exports = { STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL, computeInitialStatus };

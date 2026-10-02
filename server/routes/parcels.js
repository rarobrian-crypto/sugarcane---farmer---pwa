const PARCEL_SELECT_FIELDS = (statusSql, cropAgeSql, harvestStatusSql) => `
"Parcel_ID",
"Parcel_Name",
"Grower_ID",
"Area_Ha",
"Variety",
"Planting_Date",
"Harvest_Due",
${statusSql},
${cropAgeSql},
${harvestStatusSql},
"Ratoon_Cycle",
"Yield_t_ha",
"Estimated_Tonnage",
ST_AsGeoJSON(ST_Transform(geometry,4326))::json AS geometry
`;

function toProperties(row) {
  return {
    Parcel_ID: row.Parcel_ID,
    Parcel_Name: row.Parcel_Name || row.Parcel_ID,
    Grower_ID: row.Grower_ID,
    Area_Ha: row.Area_Ha,
    Variety: row.Variety,
    Planting_Date: row.Planting_Date,
    Harvest_Due: row.Harvest_Due,
    Status: row.Status,
    Crop_Age: row.Crop_Age,
    Harvest_Status: row.Harvest_Status,
    Ratoon_Cycle: row.Ratoon_Cycle,
    Yield_t_ha: row.Yield_t_ha,
    Estimated_Tonnage: row.Estimated_Tonnage
  };
}

module.exports = function attachParcelsRoutes(app, pool, shared) {
  const { STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL, computeInitialStatus, requirePermission } = shared;
  const fields = PARCEL_SELECT_FIELDS(STATUS_SQL, CROP_AGE_SQL, HARVEST_STATUS_SQL);

  app.get("/parcels", requirePermission("view_parcels"), async (req, res) => {
    try {
      const result = await pool.query(`SELECT ${fields} FROM parcels ORDER BY "Parcel_ID";`);
      res.json({
        type: "FeatureCollection",
        features: result.rows.map((row) => ({
          type: "Feature",
          geometry: row.geometry,
          properties: toProperties(row)
        }))
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database Error" });
    }
  });

  app.get("/parcel/:id", requirePermission("view_parcels"), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT ${fields} FROM parcels WHERE "Parcel_ID"=$1;`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "Parcel not found" });
      }
      const row = result.rows[0];
      res.json({ type: "Feature", geometry: row.geometry, properties: toProperties(row) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database Error" });
    }
  });

  app.post("/addParcel", requirePermission("manage_parcels"), async (req, res) => {
    try {
      const p = req.body;
      const ring = [...p.geometry, p.geometry[0]];
      const geojson = { type: "Polygon", coordinates: [ring] };

      if (!p.parcel_id || !p.grower_id || !Array.isArray(p.geometry) || p.geometry.length < 3) {
        return res.status(400).json({
          success: false,
          error: "Parcel ID, Grower and a drawn boundary (3+ points) are required."
        });
      }

      const initialStatus = computeInitialStatus(p.planting_date, p.harvest_due);

      await pool.query(
        `INSERT INTO parcels
          ("Parcel_ID","Parcel_Name","Grower_ID","Variety","Status","Area_Ha","Planting_Date","Harvest_Due","Ratoon_Cycle","Yield_t_ha","Estimated_Tonnage",geometry)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, ST_SetSRID(ST_GeomFromGeoJSON($12),4326))`,
        [
          p.parcel_id, p.parcel_name || p.parcel_id, p.grower_id, p.variety, initialStatus, p.area,
          p.planting_date || null, p.harvest_due || null, p.ratoon_cycle || null,
          p.yield_t_ha || null, p.estimated_tonnage || null, JSON.stringify(geojson)
        ]
      );

      const lons = ring.map((c) => c[0]);
      const lats = ring.map((c) => c[1]);
      res.json({
        success: true,
        parcel_id: p.parcel_id,
        bounds: [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]]
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put("/parcel/:id", requirePermission("manage_parcels"), async (req, res) => {
    try {
      const p = req.body;
      const result = await pool.query(
        `UPDATE parcels SET
          "Grower_ID"=$1,"Variety"=$2,"Planting_Date"=$3,"Harvest_Due"=$4,
          "Ratoon_Cycle"=$5,"Yield_t_ha"=$6,"Estimated_Tonnage"=$7
         WHERE "Parcel_ID"=$8 RETURNING "Parcel_ID";`,
        [
          p.grower_id, p.variety, p.planting_date || null, p.harvest_due || null,
          p.ratoon_cycle || null, p.yield_t_ha || null, p.estimated_tonnage || null,
          req.params.id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Parcel not found." });
      }
      res.json({ success: true, parcel_id: result.rows[0].Parcel_ID });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete("/parcel/:id", requirePermission("manage_parcels"), async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM parcels WHERE "Parcel_ID"=$1 RETURNING "Parcel_ID";`,
        [req.params.id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: "Parcel not found." });
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
};

const fs = require("fs");
const path = require("path");

module.exports = function attachNdviRoutes(app, pool, { requirePermission }) {
  app.get("/ndvi", requirePermission("view_ndvi"), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT ON (parcel_id) *
        FROM ndvi_readings
        ORDER BY parcel_id, reading_date DESC, created_at DESC;
      `);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  app.get("/ndvi/:parcelId", requirePermission("view_ndvi"), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM ndvi_readings WHERE parcel_id = $1 ORDER BY reading_date ASC`,
        [req.params.parcelId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database error" });
    }
  });

  // Record a new reading. Stats (avg/min/max NDVI) are computed by
  // the browser from real pixel data (or typed in manually) — this
  // endpoint just persists what it's given, plus optionally saves
  // an uploaded image. "source" tells you how the numbers were
  // produced: drone_multispectral (real NDVI math from NIR+Red),
  // drone_rgb_approx (VARI approximation from a normal RGB photo,
  // since a standard camera has no NIR band), satellite (manually
  // logged from an external tool — no live satellite feed here),
  // or manual (entered directly, e.g. from QGIS/Pix4D).
  app.post("/ndvi", requirePermission("manage_ndvi"), async (req, res) => {
    try {
      const p = req.body;
      if (!p.parcel_id || p.avg_ndvi === undefined || p.avg_ndvi === null) {
        return res.status(400).json({ success: false, error: "Parcel and average NDVI are required." });
      }
      const validSources = ["drone_multispectral", "drone_rgb_approx", "satellite", "manual"];
      if (!validSources.includes(p.source)) {
        return res.status(400).json({ success: false, error: "Invalid source type." });
      }

      let imageFilename = null;
      if (p.image_base64) {
        const matches = p.image_base64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          imageFilename = `ndvi_${p.parcel_id}_${Date.now()}.${ext}`;
          fs.writeFileSync(path.join(__dirname, "..", "public/images/ndvi_uploads", imageFilename), buffer);
        }
      }

      const result = await pool.query(
        `INSERT INTO ndvi_readings
          (parcel_id, reading_date, avg_ndvi, min_ndvi, max_ndvi, source, image_filename, notes, created_by)
         VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          p.parcel_id, p.reading_date || null, p.avg_ndvi, p.min_ndvi || null,
          p.max_ndvi || null, p.source, imageFilename, p.notes || null,
          req.user?.username || null
        ]
      );
      res.json({ success: true, reading: result.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Unable to save NDVI reading." });
    }
  });
};

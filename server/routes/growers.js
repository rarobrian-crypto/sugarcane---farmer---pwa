module.exports = function attachGrowersRoutes(app, pool, { requirePermission }) {
  app.get("/growers", requirePermission("view_growers"), async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM growers ORDER BY grower_id;`);
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Database Error" });
    }
  });

  app.post("/growers", requirePermission("manage_growers"), async (req, res) => {
    try {
      const { grower_name, phone, village } = req.body;
      const result = await pool.query(
        `INSERT INTO growers (grower_name, phone, village) VALUES ($1,$2,$3) RETURNING *;`,
        [grower_name, phone, village]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Unable to save grower" });
    }
  });
};

// The frontend used to call OSRM directly from the browser, which
// anyone could still do via devtools regardless of whether the
// button was hidden. Routing it through our own server means the
// permission check actually blocks the action, not just the UI.
module.exports = function attachRouteAnalysisRoutes(app, pool, { requirePermission }) {
  app.get("/api/route", requirePermission("route_analysis"), async (req, res) => {
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
};

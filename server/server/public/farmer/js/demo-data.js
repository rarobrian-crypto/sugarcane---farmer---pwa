// Demo fallback data — only used when a fetch to the real backend
// fails (offline, or previewing the UI with no server running).
// Shapes mirror what /farmer/api/* returns for real.

const DEMO = {
  farmer: {
    name: "John Mwangi",
    phone: "0712 345678",
    email: "johnmwangi@example.com",
    grower_id: "GWR-00123"
  },
  parcel: {
    Parcel_ID: "001",
    Grower_ID: "GWR-00123",
    Area_Ha: 12.5,
    Variety: "CO421",
    Planting_Date: "2025-03-12",
    Harvest_Due: "2025-08-18",
    Status: "Growing",
    Ratoon_Cycle: 1,
    Estimated_Tonnage: 75.2,
    center: { lat: -0.123456, lng: 37.456789 },
    boundary: [
      [-0.122900, 37.456200],
      [-0.122950, 37.457400],
      [-0.123700, 37.457900],
      [-0.124400, 37.457500],
      [-0.124600, 37.456600],
      [-0.123900, 37.455900],
      [-0.123100, 37.455950]
    ],
    land_surveyed: true,
    survey_date: "2025-06-10",
    survey_notes: "Good soil condition, no major issues.",
    coordinates_table: [
      [-0.123456, 37.456789],
      [-0.124321, 37.458210],
      [-0.126543, 37.457890],
      [-0.125432, 37.455678]
    ]
  },
  ndvi: {
    current: 0.74,
    status: "Healthy",
    trend: [
      { month: "Apr", value: 0.42 },
      { month: "May", value: 0.55 },
      { month: "Jun", value: 0.63 },
      { month: "Jul", value: 0.74 }
    ]
  },
  harvest: {
    status: "Ready for Harvest",
    days_to_harvest: 12,
    estimated_yield: 75.2,
    harvest_date: "2025-08-18",
    ratoon_cycle: 1,
    history: [
      { label: "Planting", date: "12 Mar 2025", state: "done" },
      { label: "Growth Monitoring", date: "Apr – Jul 2025", state: "done" },
      { label: "Harvest", date: "18 Aug 2025", state: "upcoming" }
    ]
  },
  alerts: [
    {
      id: 1,
      type: "harvest",
      title: "Harvest Due Soon",
      body: "Parcel 001 will be ready for harvest in 12 days.",
      time: "2h ago"
    },
    {
      id: 2,
      type: "crop_health",
      title: "Crop Health Good",
      body: "NDVI 0.74 (Healthy)",
      time: "5h ago"
    },
    {
      id: 3,
      type: "system",
      title: "Field Visit Scheduled",
      body: "Next visit on 15 Aug 2025",
      time: "1d ago"
    },
    {
      id: 4,
      type: "system",
      title: "Maintenance Alert",
      body: "Check irrigation system",
      time: "2d ago"
    }
  ]
};

// Straight-line distance fallback for the route screen, used only
// if the OSRM-backed /farmer/api/route proxy can't be reached.
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

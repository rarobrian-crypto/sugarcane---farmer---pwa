/* =========================================================
   Sugarcane GIS — My Farm (farmer PWA)
   Single-page app: hash router + fetch calls to the real
   backend. Farmer boundary data is always loaded from the authenticated account.
========================================================= */

const state = {
  farmer: null,
  parcel: null,
  parcels: [], // summary list, for the switcher
  ndvi: null,
  harvest: null,
  alerts: [],
  boundaryCapture: [], // points captured this session, before save (edit existing boundary)
  newParcel: { points: [], method: "gps_walk", variety: "", planting_date: "", parcel_id: "", coordinate_crs: "EPSG:4326" }, // Add Parcel draft
  usingDemo: false,
  apiError: null
};

// ---------- API wrapper ----------
async function api(path, opts = {}) {
  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opts
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    state.usingDemo = false;
    state.apiError = null;
    return await res.json();
  } catch (err) {
    state.usingDemo = true;
    state.apiError = err.message;
    return null;
  }
}

async function loadFarmerData() {
  const me = await api("/farmer/api/me");
  state.farmer = me?.farmer || null;
  state.parcel = me?.parcel || null;
  state.alerts = [];
  state.parcels = [];
  if (!state.farmer) return;

  const parcels = await api("/farmer/api/parcels");
  state.parcels = Array.isArray(parcels) ? parcels : [];
  if (!state.parcel && state.parcels.length) {
    state.parcel = await api("/farmer/api/parcel/" + encodeURIComponent(state.parcels[0].Parcel_ID));
  }
  if (!state.parcel) {
    state.ndvi = null;
    state.harvest = null;
    return;
  }

  const id = encodeURIComponent(state.parcel.Parcel_ID);
  const values = await Promise.all([
    api("/farmer/api/parcel/" + id + "/ndvi"),
    api("/farmer/api/parcel/" + id + "/harvest"),
    api("/farmer/api/alerts")
  ]);
  state.ndvi = values[0];
  state.harvest = values[1];
  state.alerts = Array.isArray(values[2]) ? values[2] : [];
}

async function switchParcel(id) {
  const encoded = encodeURIComponent(id);
  const p = await api("/farmer/api/parcel/" + encoded);
  if (p) state.parcel = p;
  const ndvi = await api("/farmer/api/parcel/" + encoded + "/ndvi");
  if (ndvi) state.ndvi = ndvi;
  const harvest = await api("/farmer/api/parcel/" + encoded + "/harvest");
  if (harvest) state.harvest = harvest;
  go("/farm");
}

// ---------- Router ----------
const routes = {
  "/home": viewHome,
  "/farm": viewFarm,
  "/map": viewMap,
  "/route": viewRoute,
  "/harvest": viewHarvest,
  "/ndvi": viewNdvi,
  "/alerts": viewAlerts,
  "/parcel": viewParcelDetails,
  "/parcels": viewParcelsList,
  "/add-parcel": viewAddParcel,
  "/update-info": viewUpdateInfo,
  "/profile": viewProfile
};

function currentPath() {
  return location.hash.replace("#", "") || "/home";
}

async function render() {
  const appRoot = document.getElementById("app");
  if (!state.farmer) {
    appRoot.innerHTML = '<main class="content" style="padding-top:18vh;"><section class="card center-text"><div style="font-size:36px;">🌱</div><h2>Sign in to view your farm</h2><p class="muted">Farm records are available only to the account they belong to.</p><a class="btn btn-primary" href="/farmer/login.html">Farmer sign in</a>' + (state.apiError ? '<p class="small muted mt-14">We could not load your account. Check your connection and sign in again.</p>' : "") + '</section></main>';
    return;
  }
  if (!state.parcel) {
    appRoot.innerHTML = await viewNoParcels();
    highlightNav("/home");
    return;
  }
  const path = currentPath();
  const fn = routes[path] || viewHome;
  appRoot.innerHTML = await fn();
  highlightNav(path);
  afterRender(path);
}

function highlightNav(path) {
  document.querySelectorAll(".bottom-nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.path === path);
  });
}

window.addEventListener("hashchange", render);

// ---------- Shared chrome ----------
function bottomNav(active) {
  const tabs = [
    { path: "/home", icon: "🏠", label: "Home" },
    { path: "/map", icon: "🗺️", label: "Map" },
    { path: "/harvest", icon: "🌾", label: "Harvest" },
    { path: "__more", icon: "☰", label: "More" }
  ];
  return `
  <div class="bottom-nav">
    ${tabs
      .map(
        (t) => `
      <button data-path="${t.path}" class="${active === t.path ? "active" : ""}"
        onclick="${t.path === "__more" ? "openMoreSheet()" : `go('${t.path}')`}">
        <span class="nav-icon">${t.icon}</span>${t.label}
      </button>`
      )
      .join("")}
  </div>`;
}

function go(path) {
  location.hash = "#" + path;
}

function openMoreSheet() {
  const sheet = document.createElement("div");
  sheet.className = "sheet-backdrop";
  sheet.onclick = (e) => { if (e.target === sheet) sheet.remove(); };
  sheet.innerHTML = `
    <div class="sheet">
      <div class="grip"></div>
      <div class="sheet-item" onclick="go('/ndvi');this.closest('.sheet-backdrop').remove();">
        <span class="ic">🌿</span> Crop Health (NDVI)
      </div>
      <div class="sheet-item" onclick="go('/alerts');this.closest('.sheet-backdrop').remove();">
        <span class="ic">🔔</span> Alerts & Notifications
      </div>
      <div class="sheet-item" onclick="go('/update-info');this.closest('.sheet-backdrop').remove();">
        <span class="ic">📝</span> Update Farm Information
      </div>
      <div class="sheet-item" onclick="go('/add-parcel');this.closest('.sheet-backdrop').remove();">
        <span class="ic">➕</span> Add a Parcel
      </div>
      <div class="sheet-item" onclick="go('/parcels');this.closest('.sheet-backdrop').remove();">
        <span class="ic">📋</span> My Parcels
      </div>
      <div class="sheet-item" onclick="go('/route');this.closest('.sheet-backdrop').remove();">
        <span class="ic">🚗</span> Route to Parcel
      </div>
      <div class="sheet-item" onclick="go('/profile');this.closest('.sheet-backdrop').remove();">
        <span class="ic">👤</span> Profile
      </div>
      <div class="sheet-item" onclick="logout();">
        <span class="ic">🚪</span> Logout
      </div>
    </div>`;
  document.body.appendChild(sheet);
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function demoNote() {
  return state.apiError
    ? `<p class="small muted center-text mt-8">Some farm information could not be refreshed. Check your connection and try again.</p>`
    : "";
}

// ---------- Gauge / sparkline helpers ----------
function ndviGauge(value) {
  if (value == null || !Number.isFinite(Number(value))) return `<div class="gauge"><div class="center"><strong>—</strong><span>Not supplied</span></div></div>`;
  value = Number(value);
  const pct = Math.max(0, Math.min(1, value));
  const r = 40, c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color = pct >= 0.6 ? "#2E7D32" : pct >= 0.4 ? "#FB8C00" : "#E53935";
  return `
  <div class="gauge">
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="${r}" stroke="#E5E7EB" stroke-width="9" fill="none"/>
      <circle cx="48" cy="48" r="${r}" stroke="${color}" stroke-width="9" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
    </svg>
    <div class="center">
      <strong>${value.toFixed(2)}</strong>
      <span>${pct >= 0.6 ? "Healthy" : pct >= 0.4 ? "Fair" : "Stressed"}</span>
    </div>
  </div>`;
}

function sparkline(points, height = 60) {
  const vals = points.map((p) => p.value);
  const min = 0, max = 1;
  const w = 220;
  const step = w / (points.length - 1 || 1);
  const coords = points
    .map((p, i) => {
      const x = i * step;
      const y = height - ((p.value - min) / (max - min)) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return `
  <svg viewBox="0 0 ${w} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    <polyline points="${coords}" fill="none" stroke="#2E7D32" stroke-width="2.5"/>
    ${points
      .map((p, i) => {
        const x = i * step, y = height - ((p.value - min) / (max - min)) * height;
        return `<circle cx="${x}" cy="${y}" r="3" fill="#2E7D32"/>`;
      })
      .join("")}
  </svg>`;
}

// ---------- Views ----------

function viewNoParcels() {
  const name = state.farmer?.name || "there";
  return topBar("My Farms") + '<div class="content"><div class="card center-text" style="padding:28px 20px;"><div style="font-size:42px;">🌾</div><h2>Your farm portfolio is ready</h2><p>Hello ' + name + '. No parcel boundaries are linked to this account yet.</p><p class="small muted">Once staff assigns your surveyed parcels, only those parcels will appear here.</p>' + (state.apiError ? '<p class="small muted">We could not refresh farm records. Check your connection and retry.</p>' : "") + '</div>' + bottomNav("/home") + '</div>';
}

function viewHome() {
  const f = state.farmer || { name: "Farmer" };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  const totalArea = state.parcels.reduce((sum, parcel) => sum + Number(parcel.Area_Ha || 0), 0);
  const urgentAlerts = state.alerts.filter((a) => a.type === "harvest" || a.severity === "urgent").length;
  const initialsText = String(f.name || "F").trim().split(/\\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return `
  <div class="home-header">
    <div class="avatar-photo">${initialsText}</div>
    <div class="who">
      <small>Good ${greeting},</small>
      <h2>${f.name}</h2>
      <div class="farmer-id">LANDSCAN · ${state.parcels.length} mapped parcels</div>
    </div>
    <button class="bell-btn" onclick="go('/alerts')" aria-label="Alerts">
      🔔${urgentAlerts ? `<span class="badge-dot">${urgentAlerts}</span>` : ""}
    </button>
  </div>
  <div class="content no-pad-top bleed">
    <div class="stat-grid">
      <div class="stat-tile"><div class="sicon">🌱</div><strong>${state.parcels.length}</strong><span>Farms mapped</span></div>
      <div class="stat-tile"><div class="sicon">📏</div><strong>${totalArea.toFixed(1)} ha</strong><span>Mapped area (est.)</span></div>
      <div class="stat-tile"><div class="sicon">🌾</div><strong>—</strong><span>Crop data pending</span></div>
    </div>
    <div class="card intelligence-card">
      <div class="intelligence-kicker">YOUR FARM PORTFOLIO</div>
      <h3>A clear view of your mapped land</h3>
      <p>Explore parcel boundaries and build your farm record in one place.</p>
      <div class="intelligence-status"><span class="status-dot"></span>${state.parcels.length} mapped parcel boundaries available</div>
      <div class="intelligence-footnote">Crop performance and harvest details appear when verified records are added to your account.</div>
      <button class="btn btn-primary mt-14" onclick="go('/map')">Explore farm map</button>
    </div>
    <div class="section-row"><h3>My Farms</h3><a onclick="go('/parcels')">View All ›</a></div>
    ${state.parcels.slice(0, 3).map((parcel) => `
      <div class="farm-card" onclick="switchParcel('${parcel.Parcel_ID}')">
        <div class="farm-thumb" style="background:linear-gradient(135deg,#236b46,#123b29);">
          <div class="rows" style="background-image:repeating-linear-gradient(115deg,rgba(255,255,255,.22) 0 3px,transparent 3px 9px);"></div><span aria-hidden="true" style="position:absolute;inset:0;display:grid;place-items:center;font-size:21px;">🌱</span>
        </div>
        <div class="farm-body">
          <strong>${parcelLabel(parcel)}</strong>
          <div class="sub">${Number(parcel.Area_Ha || 0).toFixed(2)} ha</div>
          <div class="chips"><span class="badge growing">● Boundary mapped</span><span class="ndvi-chip">Crop data needed</span></div>
        </div>
        <span class="farm-arrow">›</span>
      </div>`).join("")}
    <div class="section-row" style="margin-top:6px;"><h3>Quick Actions</h3></div>
    <div class="quick-grid" style="margin:0 16px 4px;">
      <a onclick="go('/farm')"><span class="qicon" style="background:#6D4C41;">🌾</span>Farm details</a>
      <a onclick="go('/map')"><span class="qicon" style="background:#1E88E5;">🗺️</span>Farm map</a>
      <a onclick="go('/update-info')"><span class="qicon" style="background:#8E24AA;">📝</span>Update info</a>
      <a onclick="go('/add-parcel')"><span class="qicon" style="background:#D84315;">➕</span>Add farm</a>
      <a onclick="go('/route')"><span class="qicon" style="background:#00897B;">📍</span>Route</a>
      <a onclick="go('/profile')"><span class="qicon" style="background:#455A64;">👤</span>Profile</a>
    </div>
    ${demoNote()}
  </div>
  ${bottomNav("/home")}`;
}
function parcelLabel(parcel) {
  return parcel?.Parcel_Name || ("Parcel " + (parcel?.Parcel_ID || ""));
}

function statusBadgeClass(status) {
  if (status === "Growing") return "growing";
  if (status === "Mature" || status === "Harvested") return "ready";
  return "growing";
}

function viewFarm() {
  const p = state.parcel, n = state.ndvi;
  return `
  ${topBar("My Farm")}
  <div class="content">
    <div class="card" onclick="go('/parcels')">
      <div class="card-row" style="align-items:flex-start;">
        <div style="display:flex;gap:12px;">
          <div style="width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#A5D6A7,#2E7D32);"></div>
          <div>
            <h3 style="color:var(--text);font-size:15px;margin-bottom:2px;">${parcelLabel(p)}</h3>
            <div class="small muted">${p.Area_Ha ?? "—"} Ha</div>
            <span class="badge growing" style="margin-top:6px;display:inline-block;">● ${p.Status}</span>
          </div>
        </div>
        <span style="color:#9CA3AF;">⌄</span>
      </div>
    </div>

    <div class="card">
      <div class="card-row" style="margin-bottom:10px;"><span class="muted small">Variety</span><strong class="small">${p.Variety}</strong></div>
      <div class="card-row" style="margin-bottom:10px;"><span class="muted small">Planting Date</span><strong class="small">${fmtDate(p.Planting_Date)}</strong></div>
      <div class="card-row"><span class="muted small">Estimated Harvest</span><strong class="small">${fmtDate(p.Harvest_Due)}</strong></div>
    </div>

    <div class="card">
      <h3>Crop Health (NDVI)</h3>
      <div class="gauge-wrap">
        ${ndviGauge(n.current)}
        <div class="spark-wrap">
          ${sparkline(n.trend)}
          <div class="spark-labels">${n.trend.map((t) => `<span>${t.month}</span>`).join("")}</div>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" onclick="go('/map')">View on Map</button>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function viewMap() {
  const selected = state.parcel;
  return `
  ${topBar("Farm Map")}
  <style>.farm-map-picker{position:relative;z-index:3;display:flex;flex-direction:column;gap:6px;padding:12px 14px;margin:0 0 10px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);box-shadow:var(--shadow)}.farm-map-picker label{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}.farm-map-picker select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text);font:inherit;font-weight:700}.farm-map-picker span{font-size:11px;color:var(--muted)}.leaflet-control-layers{border:0!important;border-radius:10px!important;box-shadow:0 2px 12px rgba(20,40,30,.2)!important;font-size:12px}</style>
  <div class="content" style="position:relative;">
    <div class="farm-map-picker">
      <label for="map-parcel-select">Client farm boundary</label>
      <select id="map-parcel-select" onchange="switchParcel(this.value).then(() => go('/map'))">
        ${state.parcels.map((farm) => `<option value="${farm.Parcel_ID}" ${farm.Parcel_ID === selected.Parcel_ID ? "selected" : ""}>${parcelLabel(farm)}</option>`).join("")}
      </select>
      <span>${selected.boundary.length} surveyed points · WGS 84</span>
    </div>
    <div id="leaflet-map"></div>
    <div class="map-fab-col">
      <button class="map-fab" onclick="mapObj && mapObj.zoomIn()">+</button>
      <button class="map-fab" onclick="mapObj && mapObj.zoomOut()">−</button>
      <button class="map-fab" onclick="locateMe()">🧭</button>
    </div>
    <div class="card map-info-card">
      <h3 style="color:var(--text);font-size:15px;">${parcelLabel(state.parcel)}</h3>
      <div class="small muted mt-8">${Number(state.parcel.Area_Ha).toFixed(2)} ha · ${state.parcel.boundary.length} survey points</div>
      <div class="small muted">Lat: ${state.parcel.center.lat} &nbsp; Lon: ${state.parcel.center.lng}</div>
      <button class="btn btn-primary mt-14" onclick="go('/route')">📍 Get Directions</button>
    </div>
    ${demoNote()}
  </div>
  ${bottomNav("/map")}`;
}

function viewRoute() {
  const p = state.parcel;
  return `
  ${topBar("Route to Parcel")}
  <div class="content" style="position:relative;">
    <div id="leaflet-map" style="height:300px;"></div>
    <div class="card mt-14">
      <div class="card-row">
        <div>
          <div class="small muted">Your Location → ${parcelLabel(p)}</div>
          <strong id="route-dist">Calculating…</strong>
        </div>
        <span>🚗</span>
      </div>
      <button class="btn btn-primary mt-14" onclick="startNavigation()">Start Navigation</button>
    </div>
    ${demoNote()}
  </div>
  ${bottomNav("/map")}`;
}

function viewHarvest() {
  const h = state.harvest, p = state.parcel;
  return `
  ${topBar("Harvest Updates")}
  <div class="content">
    <div class="card">
      <div class="card-row">
        <div class="card-row" style="gap:8px;">
          <span style="color:var(--primary);font-size:18px;">🌿</span>
          <div>
            <div class="small muted">Current Status</div>
            <strong>${h.status}</strong>
          </div>
        </div>
        <span class="badge ready">In ${h.days_to_harvest} days</span>
      </div>
    </div>

    <div class="card">
      <div class="card-row" style="margin-bottom:12px;">
        <div><div class="small muted">Estimated Yield</div><strong>${h.estimated_yield} Tons</strong></div>
        <div><div class="small muted">Harvest Date</div><strong>${fmtDate(h.harvest_date)}</strong></div>
      </div>
      <div class="small muted">Ratoon Cycle</div>
      <strong>${h.ratoon_cycle}</strong>
    </div>

    <div class="card">
      <h3>Harvest History</h3>
      <div class="timeline">
        ${h.history
          .map(
            (item) => `
          <div class="t-item">
            <div class="t-dot ${item.state}">${item.state === "done" ? "✓" : "•"}</div>
            <div class="t-body" style="flex:1;">
              <strong>${item.label}</strong>
              <p>${item.date}</p>
            </div>
            <span class="t-status ${item.state}">${item.state === "done" ? "Completed" : "Upcoming"}</span>
          </div>`
          )
          .join("")}
      </div>
    </div>

    <button class="btn btn-primary" onclick="updateHarvestStatus()">Update Harvest Status</button>
    ${demoNote()}
  </div>
  ${bottomNav("/harvest")}`;
}

function viewNdvi() {
  const n = state.ndvi;
  return `
  ${topBar("NDVI & Crop Health")}
  <div class="content">
    <div class="tabbar">
      <button class="active">Current</button>
      <button onclick="toast('History view coming soon — will read from /farmer/api/parcel/:id/ndvi/history')">History</button>
    </div>
    <div class="card">
      <div style="aspect-ratio:1/1;border-radius:10px;background:
        repeating-linear-gradient(45deg,#66BB6A,#66BB6A 10px,#2E7D32 10px,#2E7D32 20px);
        margin-bottom:10px;"></div>
      <div class="card-row">
        <div>
          <div class="small muted">Current NDVI</div>
          <strong style="font-size:20px;">${n.current.toFixed(2)}</strong>
        </div>
        <span class="badge healthy">${n.current >= 0.6 ? "Healthy" : n.current >= 0.4 ? "Fair" : "Stressed"}</span>
      </div>
    </div>
    <div class="card">
      <h3>NDVI Trend</h3>
      ${sparkline(n.trend, 90)}
      <div class="spark-labels">${n.trend.map((t) => `<span>${t.month}</span>`).join("")}</div>
    </div>
    <div class="card small muted">
      <strong style="color:var(--text);display:block;margin-bottom:6px;">Reading scale</strong>
      🟢 0.6 – 1.0 Healthy &nbsp; 🟠 0.4 – 0.6 Fair &nbsp; 🔴 0.0 – 0.4 Stressed
    </div>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function viewAlerts() {
  const icons = {
    harvest: { bg: "var(--warning)", ic: "🔔" },
    crop_health: { bg: "var(--primary)", ic: "🌿" },
    system: { bg: "var(--secondary)", ic: "ℹ️" }
  };
  return `
  ${topBar("Notifications & Alerts")}
  <div class="content">
    <div class="tabbar">
      <button class="active">All</button>
      <button>Harvest</button>
      <button>Crop Health</button>
      <button>System</button>
    </div>
    <div class="card">
      ${state.alerts
        .map((a) => {
          const conf = icons[a.type] || icons.system;
          return `
          <div class="list-item">
            <div class="dot-icon" style="background:${conf.bg};">${conf.ic}</div>
            <div class="body">
              <strong>${a.title}</strong>
              <p>${a.body}</p>
            </div>
            <time>${a.time}</time>
          </div>`;
        })
        .join("")}
    </div>
    <button class="btn btn-secondary" onclick="enableNotifications()">🔔 Enable Push Notifications</button>
    ${demoNote()}
  </div>
  ${bottomNav("/harvest")}`;
}

function viewParcelDetails() {
  const p = state.parcel;
  return `
  ${topBar("Parcel Details")}
  <div class="content">
    <div class="card" style="padding:0;overflow:hidden;">
      <div style="height:130px;background:repeating-linear-gradient(45deg,#81C784,#81C784 12px,#2E7D32 12px,#2E7D32 24px);"></div>
    </div>
    <div class="card">
      ${row("Parcel ID", p.Parcel_ID)}
      ${row("Area", p.Area_Ha + " Ha")}
      ${row("Variety", p.Variety)}
      ${row("Planting Date", fmtDate(p.Planting_Date))}
      ${row("Estimated Harvest", fmtDate(p.Harvest_Due))}
      ${row("Ratoon Cycle", p.Ratoon_Cycle)}
    </div>
    <div class="card">
      <h3>Coordinates (WGS 84)</h3>
      <table class="coord-table">
        <tr><th>Latitude</th><th>Longitude</th></tr>
        ${p.coordinates_table.map((c) => `<tr><td>${c[0]}</td><td>${c[1]}</td></tr>`).join("")}
      </table>
    </div>
    <button class="btn btn-primary" onclick="go('/update-info')">Edit Parcel</button>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function viewParcelsList() {
  return `
  ${topBar("My Parcels")}
  <div class="content">
    <div class="card" style="padding:0;">
      ${state.parcels
        .map(
          (p, i) => `
        <div class="list-item" style="padding:14px 16px;${i === 0 ? "" : ""}" onclick="switchParcel('${p.Parcel_ID}')">
          <div class="dot-icon" style="background:var(--primary);">🌱</div>
          <div class="body">
            <strong>${parcelLabel(p)}</strong>
            <p>${p.Variety || "—"} · ${p.Area_Ha ?? "—"} Ha · ${p.Status || ""}</p>
          </div>
          <span style="color:#9CA3AF;align-self:center;">›</span>
        </div>`
        )
        .join("")}
    </div>
    <button class="btn btn-primary" onclick="go('/add-parcel')">➕ Add a Parcel</button>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function viewAddParcel() {
  const np = state.newParcel;
  return `
  ${topBar("Add a Parcel")}
  <div class="content">
    <div class="card">
      <div class="field">
        <label>Parcel name</label>
        <input id="np-parcel-name" type="text" placeholder="e.g. Ngelechom" value="${np.parcel_id || ""}"/>
      </div>
      <div class="field">
        <label>Variety (optional)</label>
        <input id="np-variety" type="text" placeholder="e.g. CO421" value="${np.variety}"/>
      </div>
      <div class="field">
        <label>Planting Date (optional)</label>
        <input id="np-planting" type="date" value="${np.planting_date}"/>
      </div>
    </div>

    <div class="card">
      <h3>How was this boundary measured?</h3>
      <div class="tabbar" style="margin-top:0;">
        <button class="${np.method === "gps_walk" ? "active" : ""}" onclick="setNewParcelMethod('gps_walk')">Walk (GPS)</button>
        <button class="${np.method === "manual_draw" ? "active" : ""}" onclick="setNewParcelMethod('manual_draw')">Draw on Map</button>
        <button class="${np.method === "imported_survey" ? "active" : ""}" onclick="setNewParcelMethod('imported_survey')">Import File</button>
      </div>

      ${
        np.method === "gps_walk"
          ? `<p class="small muted mt-8">Walk to each corner of the parcel and tap "Capture point." Consumer phone GPS is accurate to roughly 3–8 m — good for most smallholder plots, not survey-grade.</p>
             <button class="btn btn-outline mt-14" onclick="captureNewParcelPoint()">📍 Capture point</button>`
          : ""
      }
      ${
        np.method === "manual_draw"
          ? `<p class="small muted mt-8">Tap the map to place each corner in order. Use this when you can clearly see the field edges on the satellite image.</p>
             <div id="draw-map" style="height:240px;border-radius:12px;overflow:hidden;margin-top:10px;"></div>
             <button class="btn btn-outline mt-14" onclick="undoLastDrawPoint()">↩ Undo last point</button>`
          : ""
      }
      ${
        np.method === "imported_survey"
          ? `<p class="small muted mt-8">Upload a boundary as CSV, GeoJSON, or KML. CSV files with Eastings/Northings in UTM Zone 36N / WGS84 are converted on the server; other CSVs may use latitude/longitude.</p>
             <input type="file" id="np-file" accept=".csv,.geojson,.json,.kml" onchange="handleSurveyFile(event)" class="mt-8"/>`
          : ""
      }

      <div class="small muted mt-14" id="np-point-count">${np.points.length} boundary point(s) captured${np.points.length >= 3 ? " · " + estimateAreaHa(np.points).toFixed(2) + " Ha (estimate)" : ""}</div>
    </div>

    <button class="btn btn-primary" onclick="saveNewParcel()">Save Parcel</button>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function row(label, value) {
  return `<div class="card-row" style="padding:6px 0;border-bottom:1px solid var(--border);">
    <span class="small muted">${label}</span><strong class="small">${value}</strong></div>`;
}

function viewUpdateInfo() {
  const p = state.parcel;
  const captured = state.boundaryCapture.length;
  return `
  ${topBar("Update Farm Information")}
  <div class="content">
    <div class="card">
      <div class="field">
        <label>Land Surveyed</label>
        <div class="toggle-row">
          <button id="surveyed-yes" class="${p.land_surveyed ? "active" : ""}" onclick="setSurveyed(true)">Yes</button>
          <button id="surveyed-no" class="${!p.land_surveyed ? "active" : ""}" onclick="setSurveyed(false)">No</button>
        </div>
      </div>
      <div class="field">
        <label>Survey Date</label>
        <input type="date" id="survey-date" value="${p.survey_date || ""}"/>
      </div>
      <div class="field">
        <label>Coordinates</label>
        <button class="btn btn-outline" onclick="captureBoundaryPoint()">📍 Capture from Map</button>
        <div class="small muted mt-8">${captured || p.coordinates_table.length} boundary points captured</div>
      </div>
      <div class="field">
        <label>Notes</label>
        <textarea id="survey-notes" placeholder="Any observations about soil, boundary markers, access...">${p.survey_notes || ""}</textarea>
      </div>
      <button class="btn btn-primary" onclick="saveFarmInfo()">Save Changes</button>
    </div>
    ${demoNote()}
  </div>
  ${bottomNav("/harvest")}`;
}

function viewProfile() {
  const f = state.farmer, p = state.parcel;
  return `
  ${topBar("Profile")}
  <div class="content">
    <div class="card center-text">
      <div class="avatar" style="width:64px;height:64px;font-size:20px;margin:0 auto 10px;background:var(--primary-light);color:#fff;">
        ${f.name.split(" ").map((s) => s[0]).join("")}
      </div>
      <strong style="font-size:16px;">${f.name}</strong>
      <p class="small muted">Farmer</p>
    </div>
    <div class="card">
      ${row("📞 Phone", f.phone)}
      ${row("✉️ Email", f.email)}
      ${row("🆔 Grower ID", f.grower_id)}
    </div>
    <div class="card">
      ${row("🌱 My Farms", state.parcels.length + " Parcel" + (state.parcels.length === 1 ? "" : "s"))}
      ${row("🔔 Notifications", '<span id="notif-state">' + (Notification && Notification.permission === "granted" ? "On" : "Off") + "</span>")}
      <div class="card-row" style="padding:6px 0;" onclick="toast('Opening help & support...')"><span class="small muted">💬 Help & Support</span><span>›</span></div>
    </div>
    <button class="btn btn-danger" onclick="logout()">Logout</button>
    ${demoNote()}
  </div>
  ${bottomNav("/farm")}`;
}

function topBar(title) {
  return `
  <div class="appbar plain">
    <button class="icon-btn" onclick="history.length>1?history.back():go('/home')">←</button>
    <h1>${title}</h1>
    <button class="icon-btn" onclick="openMoreSheet()">☰</button>
  </div>`;
}

function fmtDate(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date)) return d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------- Actions ----------
function setSurveyed(val) {
  state.parcel.land_surveyed = val;
  document.getElementById("surveyed-yes").classList.toggle("active", val);
  document.getElementById("surveyed-no").classList.toggle("active", !val);
}

function captureBoundaryPoint() {
  if (!navigator.geolocation) {
    toast("GPS not available on this device.");
    return;
  }
  toast("Getting GPS location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.boundaryCapture.push([pos.coords.latitude, pos.coords.longitude]);
      toast(`Point captured (${state.boundaryCapture.length} total). Walk to the next corner.`);
      go("/update-info");
      render();
    },
    () => toast("Couldn't get GPS location — check location permissions."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// ---------- Add Parcel ----------
let drawMapObj = null;

function setNewParcelMethod(method) {
  state.newParcel.method = method;
  state.newParcel.points = [];
  state.newParcel.coordinate_crs = "EPSG:4326";
  render();
}

function captureNewParcelPoint() {
  if (!navigator.geolocation) {
    toast("GPS not available on this device.");
    return;
  }
  toast("Getting GPS location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.newParcel.points.push([pos.coords.latitude, pos.coords.longitude]);
      toast(`Point ${state.newParcel.points.length} captured. Walk to the next corner.`);
      render();
    },
    () => toast("Couldn't get GPS location — check location permissions."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function undoLastDrawPoint() {
  state.newParcel.points.pop();
  if (drawMapObj) {
    redrawDraftPolygon();
    updatePointCountLabel();
  } else {
    render();
  }
}

function initDrawMap() {
  const el = document.getElementById("draw-map");
  if (!el || typeof L === "undefined") return;
  const center = state.parcel?.center || { lat: -0.1, lng: 37.45 };
  drawMapObj = L.map(el).setView([center.lat, center.lng], 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(drawMapObj);
  redrawDraftPolygon();
  drawMapObj.on("click", (e) => {
    state.newParcel.points.push([e.latlng.lat, e.latlng.lng]);
    redrawDraftPolygon();
    updatePointCountLabel();
  });
}

function redrawDraftPolygon() {
  if (!drawMapObj) return;
  drawMapObj.eachLayer((layer) => {
    if (layer instanceof L.Polygon || layer instanceof L.CircleMarker) drawMapObj.removeLayer(layer);
  });
  state.newParcel.points.forEach((pt) =>
    L.circleMarker(pt, { radius: 5, color: "#1B5E20", fillColor: "#fff", fillOpacity: 1 }).addTo(drawMapObj)
  );
  if (state.newParcel.points.length >= 3) {
    L.polygon(state.newParcel.points, { color: "#2E7D32", fillColor: "#66BB6A", fillOpacity: 0.35 }).addTo(drawMapObj);
  }
}

function updatePointCountLabel() {
  const el = document.getElementById("np-point-count");
  if (!el) return;
  const n = state.newParcel.points.length;
  el.textContent = `${n} boundary point(s) captured${n >= 3 ? " · " + estimateAreaHa(state.newParcel.points).toFixed(2) + " Ha (estimate)" : ""}`;
}

// Rough planar area estimate for on-screen feedback only — the real,
// authoritative area is computed server-side from the PostGIS geometry
// (ST_Area on a geography cast), which accounts for the earth's curvature.
function estimateAreaHa(points) {
  if (points.length < 3) return 0;
  const latRad = (points[0][0] * Math.PI) / 180;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);
  const xy = points.map((p) => [p[1] * mPerDegLng, p[0] * mPerDegLat]);
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2) / 10000; // m² -> ha
}

function handleSurveyFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      let points = [];
      let coordinateCrs = "EPSG:4326";
      if (file.name.toLowerCase().endsWith(".csv")) {
        const parsed = parseCsvPoints(text);
        points = parsed.points;
        coordinateCrs = parsed.coordinate_crs;
      } else if (file.name.toLowerCase().endsWith(".geojson") || file.name.toLowerCase().endsWith(".json")) {
        points = parseGeoJsonPoints(JSON.parse(text));
      } else if (file.name.toLowerCase().endsWith(".kml")) {
        points = parseKmlPoints(text);
      } else {
        toast("Unsupported file type.");
        return;
      }
      if (points.length < 3) {
        toast("At least 3 boundary points were not found in that file.");
        return;
      }
      state.newParcel.points = points;
      state.newParcel.coordinate_crs = coordinateCrs;
      state.newParcel.parcel_id = parcelNameFromFilename(file.name);
      toast("Imported " + points.length + " points in " + coordinateCrs + ".");
      render();
    } catch (e) {
      toast("Could not read that file. Check the format and try again.");
    }
  };
  reader.readAsText(file);
}

function parcelNameFromFilename(filename) {
  let name = filename.replace(/\.[^.]+$/, "").replace(/\s+(?:coods|coords?|coordinates?)\b.*$/i, "").trim();
  if (/^southteso$/i.test(name)) name = "South Teso";
  return name.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseCsvPoints(text) {
  const rows = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).map((line) => line.split(",").map((value) => value.trim()));
  if (rows.length < 2) return { points: [], coordinate_crs: "EPSG:4326" };
  const headers = rows[0].map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const eastIndex = headers.findIndex((value) => ["easting", "eastings", "x"].includes(value));
  const northIndex = headers.findIndex((value) => ["northing", "northings", "y"].includes(value));
  if (eastIndex >= 0 && northIndex >= 0) {
    const points = rows.slice(1)
      .filter((columns) => columns[eastIndex]?.trim() !== "" && columns[northIndex]?.trim() !== "" && Number.isFinite(Number(columns[eastIndex])) && Number.isFinite(Number(columns[northIndex])))
      .map((columns) => [Number(columns[eastIndex]), Number(columns[northIndex])]);
    return { points, coordinate_crs: "EPSG:32636" };
  }
  const latIndex = headers.findIndex((value) => ["lat", "latitude"].includes(value));
  const lngIndex = headers.findIndex((value) => ["lng", "lon", "long", "longitude"].includes(value));
  const dataRows = latIndex >= 0 && lngIndex >= 0 ? rows.slice(1).map((columns) => [columns[latIndex], columns[lngIndex]]) : rows;
  const points = dataRows
    .filter((columns) => columns.length >= 2 && columns[0]?.trim() !== "" && columns[1]?.trim() !== "" && Number.isFinite(Number(columns[0])) && Number.isFinite(Number(columns[1])))
    .map((columns) => [Number(columns[0]), Number(columns[1])]);
  return { points, coordinate_crs: "EPSG:4326" };
}

function parseGeoJsonPoints(gj) {
  const coords =
    gj.type === "Feature" ? gj.geometry.coordinates[0] :
    gj.type === "Polygon" ? gj.coordinates[0] :
    gj.type === "FeatureCollection" ? gj.features[0].geometry.coordinates[0] : [];
  return coords.slice(0, -1).map((c) => [c[1], c[0]]); // geojson is [lng,lat]
}

function parseKmlPoints(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  const coordText = doc.querySelector("coordinates")?.textContent || "";
  return coordText
    .trim()
    .split(/\s+/)
    .map((triplet) => triplet.split(",").map(Number))
    .filter((c) => c.length >= 2)
    .map((c) => [c[1], c[0]]); // kml is lng,lat[,alt]
}

async function saveNewParcel() {
  const np = state.newParcel;
  if (np.points.length < 3) {
    toast("Capture or import at least 3 boundary points first.");
    return;
  }
  const payload = {
    variety: document.getElementById("np-variety").value || null,
    planting_date: document.getElementById("np-planting").value || null,
    boundary: np.points,
    parcel_name: document.getElementById("np-parcel-name")?.value.trim() || null,
    coordinate_crs: np.coordinate_crs || "EPSG:4326",
    boundary_source: np.method
  };
  const res = await api("/farmer/api/parcel", { method: "POST", body: JSON.stringify(payload) });
  if (res && res.success) {
    toast(parcelLabel(res.parcel) + " saved — " + res.area_ha + " Ha.");
    state.newParcel = { points: [], method: "gps_walk", variety: "", planting_date: "", parcel_id: "", coordinate_crs: "EPSG:4326" };
    state.parcel = res.parcel;
    const parcels = await api("/farmer/api/parcels");
    if (parcels) state.parcels = parcels;
    go("/farm");
  } else {
    toast(res?.error || "Could not save this parcel. Check your connection and retry.");
  }
}

async function saveFarmInfo() {
  const payload = {
    land_surveyed: state.parcel.land_surveyed,
    survey_date: document.getElementById("survey-date").value,
    survey_notes: document.getElementById("survey-notes").value,
    boundary: state.boundaryCapture.length ? state.boundaryCapture : undefined
  };
  const res = await api(`/farmer/api/parcel/${state.parcel.Parcel_ID}/info`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  Object.assign(state.parcel, payload);
  toast(res ? "Saved changes." : "Saved locally — will sync once you're back online.");
}

async function updateHarvestStatus() {
  const res = await api(`/farmer/api/parcel/${state.parcel.Parcel_ID}/harvest/confirm`, {
    method: "POST"
  });
  toast(res ? "Harvest status updated." : "Noted — will sync once you're back online.");
}

function logout() {
  api("/farmer/logout", { method: "POST" });
  location.hash = "#/home";
  document.querySelectorAll(".sheet-backdrop").forEach((s) => s.remove());
  toast("Logged out.");
  setTimeout(() => location.reload(), 600);
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    toast("Notifications aren't supported on this browser.");
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    toast("Notifications enabled.");
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification("Sugarcane GIS", {
        body: "You'll now get harvest and crop health alerts here.",
        icon: "/icons/icon-192.png"
      });
    }
  } else {
    toast("Notifications blocked — enable them in your browser settings.");
  }
}

// ---------- Map (Leaflet) ----------
let mapObj = null;
function afterRender(path) {
  if (path === "/map" || path === "/route") {
    setTimeout(() => initMap(path), 30);
  }
  if (path === "/add-parcel" && state.newParcel.method === "manual_draw") {
    setTimeout(() => initDrawMap(), 30);
  }
}

function initMap(path) {
  const el = document.getElementById("leaflet-map");
  if (!el || typeof L === "undefined") return;
  if (mapObj) { mapObj.remove(); mapObj = null; }
  const p = state.parcel;
  mapObj = L.map(el, { zoomControl: false });
  const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  });
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics", maxZoom: 19 }
  );
  streets.addTo(mapObj);
  L.control.layers({ "OpenStreetMap": streets, "Satellite imagery": satellite }, null, { position: "topright", collapsed: false }).addTo(mapObj);
  const boundary = p.boundary.map((c) => [c[0], c[1]]);
  const polygon = L.polygon(boundary, { color: "#0B6E3B", fillColor: "#39A76A", fillOpacity: 0.25, weight: 3 }).addTo(mapObj);
  boundary.forEach((c) => L.circleMarker(c, { radius: 3, color: "#075E36", fillColor: "#fff", fillOpacity: 1 }).addTo(mapObj));
  mapObj.fitBounds(polygon.getBounds(), { padding: [20, 20], maxZoom: 17 });
  if (path === "/route") drawRoute(p);
}

function locateMe() {
  if (!navigator.geolocation || !mapObj) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const me = [pos.coords.latitude, pos.coords.longitude];
    L.marker(me).addTo(mapObj).bindPopup("You are here").openPopup();
    mapObj.setView(me, 15);
  });
}

async function drawRoute(p) {
  if (!navigator.geolocation) {
    document.getElementById("route-dist").textContent = "Enable location to calculate route";
    return;
  }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const dest = p.center;
    L.marker([start.lat, start.lng]).addTo(mapObj).bindPopup("Your location");
    const data = await api(
      `/farmer/api/route?startLat=${start.lat}&startLng=${start.lng}&destLat=${dest.lat}&destLng=${dest.lng}`
    );
    if (data && data.routes && data.routes[0]) {
      const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
      L.polyline(coords, { color: "#1976D2", weight: 5 }).addTo(mapObj);
      const km = (data.routes[0].distance / 1000).toFixed(1);
      const min = Math.round(data.routes[0].duration / 60);
      document.getElementById("route-dist").textContent = `${km} km · ${min} min`;
      mapObj.fitBounds(L.latLngBounds(coords));
    } else {
      L.polyline([[start.lat, start.lng], [dest.lat, dest.lng]], { color: "#1976D2", weight: 4, dashArray: "6 8" }).addTo(mapObj);
      const km = haversineKm(start, dest).toFixed(1);
      document.getElementById("route-dist").textContent = `~${km} km (straight line — live routing unavailable)`;
      mapObj.fitBounds(L.latLngBounds([[start.lat, start.lng], [dest.lat, dest.lng]]));
    }
  });
}

function startNavigation() {
  const p = state.parcel;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.center.lat},${p.center.lng}`, "_blank");
}

// ---------- Install to Home Screen ----------
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById("install-banner") || localStorage.getItem("installDismissed")) return;
  const b = document.createElement("div");
  b.id = "install-banner";
  b.className = "install-banner";
  b.innerHTML = `
    <img src="/icons/icon-192.png"/>
    <div class="txt">
      <strong>Add to Home Screen</strong>
      <p>Install Sugarcane GIS for a faster, app-like experience.</p>
      <div class="actions">
        <button class="btn btn-primary btn-sm" onclick="installApp()">Add</button>
        <button class="btn btn-secondary btn-sm" onclick="dismissInstall()">Not Now</button>
      </div>
    </div>`;
  document.body.appendChild(b);
}

async function installApp() {
  if (!deferredPrompt) {
    toast("On iPhone: tap Share → Add to Home Screen.");
    dismissInstall();
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  dismissInstall();
}

function dismissInstall() {
  localStorage.setItem("installDismissed", "1");
  document.getElementById("install-banner")?.remove();
}

// ---------- Boot ----------
async function boot() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!window.__farmerAppReloadedForUpdate) {
        window.__farmerAppReloadedForUpdate = true;
        location.reload();
      }
    });
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
  await loadFarmerData();
  await render();
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
    setTimeout(showInstallBanner, 1500);
  }
}

boot();

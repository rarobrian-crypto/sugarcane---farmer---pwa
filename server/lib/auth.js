const crypto = require("crypto");

// ======================================
// Staff dashboard authentication + role-based permissions.
// Separate from the farmer PWA's own login (farmer-routes.js) —
// two different systems sharing one database.
// ======================================

const SESSIONS = new Map(); // token -> { username, department, expires }
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createUser(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(password, salt);
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hashPassword(password, salt), "hex"),
      Buffer.from(hash, "hex")
    );
  } catch (e) {
    return false;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

function getSession(req) {
  const token = parseCookies(req).session_token;
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    SESSIONS.delete(token);
    return null;
  }
  return session;
}

// Protects the staff app (HTML + API) while leaving the login
// page, its assets, and the entirely-separate farmer PWA
// (/farmer/*) reachable without a staff session.
function requireAuth(req, res, next) {
  const openPaths = ["/login.html", "/login", "/logout", "/session", "/client-farm-demo.html"];
  if (openPaths.includes(req.path)) return next();

  if (
    req.path.startsWith("/css/") ||
    req.path.startsWith("/js/") ||
    req.path.startsWith("/images/")
  ) {
    return next();
  }

  // The farmer PWA has its own separate login + session cookie
  // (farmer-routes.js). It must never be gated by this staff
  // session check, so every /farmer/* request — pages, assets,
  // and its own API — skips straight past this middleware.
  // Individual staff-only actions that happen to live under
  // /farmer/* (like creating a farmer login) enforce their own
  // staff-session check independently — see requireStaffPermission
  // in farmer-routes.js.
  if (
    req.path.startsWith("/farmer/") ||
    req.path === "/manifest.json" ||
    req.path === "/service-worker.js" ||
    req.path.startsWith("/icons/")
  ) {
    return next();
  }

  const session = getSession(req);
  if (!session) {
    if (req.path === "/" || req.path.endsWith(".html")) {
      return res.redirect("/login.html");
    }
    return res.status(401).json({ error: "Not authenticated" });
  }

  req.user = session;
  next();
}

// ======================================
// ROLE-BASED ACCESS CONTROL
// Real server-side enforcement, not just hidden buttons — each
// write/sensitive action checks the caller's actual session
// department against this matrix.
// ======================================

const PERMISSIONS = {
  "Growers Department": ["view_dashboard", "view_map", "view_parcels", "view_growers", "manage_growers"],
  "Survey Department": ["view_dashboard", "view_map", "view_parcels", "manage_parcels", "download_data"],
  "Harvesting Department": ["view_dashboard", "view_map", "view_parcels", "view_harvest", "view_production", "view_ndvi"],
  "Transport Department": ["view_dashboard", "view_map", "view_parcels", "route_analysis"],
  "Crop Monitoring Department": ["view_dashboard", "view_map", "view_parcels", "view_ndvi", "manage_ndvi"],
  Management: [
    "view_dashboard", "view_map", "view_parcels", "view_growers", "view_production",
    "view_harvest", "view_analytics", "generate_reports", "download_data", "view_ndvi"
  ],
  "System Administrator": [
    "view_dashboard", "view_map", "view_parcels", "manage_parcels", "view_growers", "manage_growers",
    "view_production", "view_harvest", "view_analytics", "generate_reports", "download_data",
    "route_analysis", "manage_settings", "manage_users", "view_ndvi", "manage_ndvi"
  ]
};

function permissionsFor(department) {
  return PERMISSIONS[department] || [];
}

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = permissionsFor(req.user?.department);
    if (!perms.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: `Your department (${req.user?.department}) doesn't have access to this action. Requires: ${permission}.`
      });
    }
    next();
  };
}

// ======================================
// DEMO ACCOUNT SEEDING
// Not schema, so it's not a migration — this is app-level
// idempotent seed data, safe to re-run every boot.
// ======================================

const DEMO_ACCOUNTS = [
  { department: "Growers Department", username: "grower.admin", password: "password123" },
  { department: "Survey Department", username: "survey.admin", password: "password123" },
  { department: "Harvesting Department", username: "harvest.admin", password: "password123" },
  { department: "Transport Department", username: "transport.admin", password: "password123" },
  { department: "Crop Monitoring Department", username: "monitoring.admin", password: "password123" },
  { department: "Management", username: "mgmt.admin", password: "password123" },
  { department: "System Administrator", username: "sysadmin", password: "password123" }
];

async function seedDemoAccounts(pool) {
  try {
    let seededCount = 0;
    for (const acct of DEMO_ACCOUNTS) {
      const existing = await pool.query("SELECT 1 FROM users WHERE username = $1", [acct.username]);
      if (existing.rowCount > 0) continue;
      const { salt, hash } = createUser(acct.password);
      await pool.query(
        `INSERT INTO users (username, department, password_hash, password_salt) VALUES ($1, $2, $3, $4)`,
        [acct.username, acct.department, hash, salt]
      );
      seededCount++;
    }
    if (seededCount > 0) {
      console.log(`✅ Seeded ${seededCount} new demo account(s) (see DEMO_ACCOUNTS in lib/auth.js)`);
    }
  } catch (err) {
    console.error("Demo account seeding failed:", err.message);
  }
}

module.exports = {
  SESSIONS,
  SESSION_TTL_MS,
  hashPassword,
  createUser,
  verifyPassword,
  parseCookies,
  getSession,
  requireAuth,
  PERMISSIONS,
  permissionsFor,
  requirePermission,
  DEMO_ACCOUNTS,
  seedDemoAccounts
};

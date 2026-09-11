const crypto = require("crypto");

module.exports = function attachStaffAuthRoutes(app, pool, shared) {
  const { SESSIONS, SESSION_TTL_MS, verifyPassword, parseCookies, getSession, permissionsFor } = shared;

  app.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ success: false, error: "Username and password are required." });
      }

      const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
      const user = result.rows[0];
      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        return res.status(401).json({ success: false, error: "Invalid username or password." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      SESSIONS.set(token, {
        username: user.username,
        department: user.department,
        expires: Date.now() + SESSION_TTL_MS
      });

      res.cookie("session_token", token, {
        httpOnly: true,
        maxAge: SESSION_TTL_MS,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });

      res.json({ success: true, username: user.username, department: user.department });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, error: "Login failed." });
    }
  });

  app.post("/logout", (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.session_token) SESSIONS.delete(cookies.session_token);
    res.clearCookie("session_token");
    res.json({ success: true });
  });

  app.get("/session", (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ authenticated: false });
    res.json({
      authenticated: true,
      username: session.username,
      department: session.department,
      permissions: permissionsFor(session.department)
    });
  });
};

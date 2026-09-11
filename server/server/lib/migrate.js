const fs = require("fs");
const path = require("path");

// ======================================
// Runs every .sql file in ../migrations, in filename order,
// exactly once each (tracked in a schema_migrations table).
//
// Why this exists: the old approach had several independent
// "setupXTable()" functions all firing at boot without awaiting
// each other. That caused a real bug — farmer-routes.js tried to
// ALTER a table that another, slower setup function hadn't
// created yet. Running every statement sequentially through one
// function removes that entire class of bug: migration 002 can
// never run before 001 finishes, because this awaits each file
// in turn.
//
// To add a schema change in future: drop a new numbered file in
// migrations/ (e.g. 003_something.sql) — don't edit old ones.
// ======================================

async function runMigrations(pool, migrationsDir = path.join(__dirname, "..", "migrations")) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // filenames are zero-padded (001_, 002_...) so lexical sort == run order

  for (const file of files) {
    const already = await pool.query(
      `SELECT 1 FROM schema_migrations WHERE name = $1`,
      [file]
    );
    if (already.rowCount > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`⏳ Applying migration: ${file}`);
    await pool.query(sql);
    await pool.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    console.log(`✅ Applied migration: ${file}`);
  }
}

module.exports = { runMigrations };

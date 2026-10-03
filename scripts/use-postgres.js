/**
 * Switches prisma/schema.prisma from SQLite to PostgreSQL in place.
 * Runs inside the Vercel build (see vercel.json) — serverless hosts can't keep a
 * SQLite file, so production uses Postgres (e.g. the database in your Supabase project).
 *
 *   DATABASE_URL  pooled connection for the app   (Supabase: port 6543, ?pgbouncer=true&connection_limit=1)
 *   DIRECT_URL    direct connection for schema pushes (Supabase: port 5432)
 *
 * Locally nothing changes unless you run this yourself. Switch back with:
 *   node scripts/use-postgres.js --sqlite
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "prisma", "schema.prisma");
const backup = path.join(__dirname, "..", "prisma", "schema.sqlite.prisma");

if (process.argv.includes("--sqlite")) {
  if (!fs.existsSync(backup)) {
    console.log("[use-postgres] Already on SQLite (no backup found).");
  } else {
    fs.copyFileSync(backup, file);
    fs.unlinkSync(backup);
    console.log("[use-postgres] Restored the SQLite schema. Run: npx prisma generate");
  }
  process.exit(0);
}

try {
  require("@next/env").loadEnvConfig(process.cwd());
} catch (_) {}

let url = (process.env.DATABASE_URL || "").replace(/:\[([^\]]+)\]@/, ":$1@");
process.env.DATABASE_URL = url;
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DIRECT_URL.replace(/:\[([^\]]+)\]@/, ":$1@");
}

if (!/^postgres(ql)?:\/\//.test(url)) {
  console.log("[use-postgres] DATABASE_URL is not a Postgres URL — keeping SQLite schema.");
  process.exit(0);
}

let schema = fs.readFileSync(file, "utf8");
if (schema.includes('provider  = "postgresql"')) {
  console.log("[use-postgres] Schema already targets PostgreSQL.");
  process.exit(0);
}
if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

schema = schema.replace(
  /datasource db \{[\s\S]*?\}/,
  `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`
);

fs.writeFileSync(file, schema);
console.log("[use-postgres] prisma/schema.prisma now targets PostgreSQL.");
if (!process.env.DIRECT_URL) {
  console.warn("[use-postgres] DIRECT_URL is not set — falling back to DATABASE_URL for schema pushes.");
  process.env.DIRECT_URL = url;
}

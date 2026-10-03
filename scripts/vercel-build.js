/**
 * Vercel build: switch Prisma to Postgres, generate the client, sync the schema,
 * then build Next.js. Fails loudly if anything is misconfigured.
 */
const { execSync } = require("child_process");

// Auto-clean accidental placeholder brackets if copied from Supabase ([YOUR-PASSWORD] -> YOUR-PASSWORD)
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/:\[([^\]]+)\]@/, ":$1@");
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DIRECT_URL.replace(/:\[([^\]]+)\]@/, ":$1@");
}

// Fallback directUrl so Prisma schema validation never fails if DIRECT_URL is omitted
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("node scripts/use-postgres.js");
run("npx prisma generate");
run("npx prisma db push --skip-generate");
run("npx next build");


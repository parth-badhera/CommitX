/**
 * Vercel build: switch Prisma to Postgres, generate the client, sync the schema,
 * then build Next.js. Fails loudly if anything is misconfigured.
 */
const { execSync } = require("child_process");

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });

run("node scripts/use-postgres.js");
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
run("npx prisma generate");
run("npx prisma db push --skip-generate", { DIRECT_URL: directUrl });
run("npx next build");

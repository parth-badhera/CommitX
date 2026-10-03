/**
 * Moves all CommitX data between databases (e.g. local SQLite → Supabase Postgres).
 *
 *   1. With your local SQLite setup:   npm run db:export        → prisma/export.json
 *   2. Point at Postgres:              set DATABASE_URL/DIRECT_URL to Postgres,
 *                                      node scripts/use-postgres.js && npx prisma generate && npx prisma db push
 *   3. Load the data:                  npm run db:import
 *   (switch back to SQLite afterwards: node scripts/use-postgres.js --sqlite && npx prisma generate)
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const FILE = path.join(__dirname, "..", "prisma", "export.json");
// Parents before children so foreign keys are satisfied on import
const MODELS = [
  "user",
  "challenge",
  "period",
  "participant",
  "invitation",
  "proof",
  "verification",
  "settlementArtifact",
  "transaction",
  "notification",
  "complaint",
  "reputationEvent",
];

async function main() {
  const mode = process.argv[2];
  const prisma = new PrismaClient();
  try {
    if (mode === "export") {
      const data = {};
      for (const m of MODELS) data[m] = await prisma[m].findMany();
      fs.writeFileSync(FILE, JSON.stringify(data, null, 1));
      console.log(`Exported ${MODELS.map((m) => `${data[m].length} ${m}`).join(", ")} → ${path.relative(process.cwd(), FILE)}`);
    } else if (mode === "import") {
      const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
      for (const m of MODELS) {
        const rows = data[m] || [];
        if (rows.length) await prisma[m].createMany({ data: rows, skipDuplicates: true });
        console.log(`  ${m}: ${rows.length}`);
      }
      console.log("Import complete.");
    } else {
      console.log("Usage: node scripts/db-transfer.js export|import");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

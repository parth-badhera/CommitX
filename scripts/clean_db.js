/**
 * Clears CommitX data from the database.
 *   npm run db:clean          → challenges and everything attached to them
 *   npm run db:reset          → the above + all user accounts (fresh website)
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const wipeUsers = process.argv.includes("--all");

async function clean() {
  const counts = await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.proof.deleteMany(),
    prisma.period.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.participant.deleteMany(),
    prisma.settlementArtifact.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.challenge.deleteMany(),
    ...(wipeUsers ? [prisma.user.deleteMany()] : []),
  ]);
  const names = ["notifications", "verifications", "proofs", "periods", "invitations", "participants", "settlements", "transactions", "challenges", "users"];
  counts.forEach((c, i) => console.log(`  removed ${String(c.count).padStart(3)} ${names[i]}`));
  console.log(wipeUsers ? "\nDatabase reset — no challenges, no accounts." : "\nAll challenges removed. Accounts kept.");
}

clean()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

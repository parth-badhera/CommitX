const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Initializing CommitX Clean Database Environment...");

  // Purge any pre-fed challenges or mock data
  await prisma.notification.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.proof.deleteMany();
  await prisma.period.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.settlementArtifact.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.challenge.deleteMany();

  // Ensure standard demo sandbox account exists for seamless local testing
  const demoEmail = "alex.rivera@gmail.com";
  let demoUser = await prisma.user.findFirst({
    where: { email: demoEmail },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        walletAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        username: "Alex Rivera",
        name: "Alex Rivera",
        email: demoEmail,
        avatar: "https://api.dicebear.com/7.x/identicon/svg?seed=alex",
        image: "https://api.dicebear.com/7.x/identicon/svg?seed=alex",
        supabaseId: "demo-user-alex",
      },
    });
    console.log("👤 Created demo sandbox account for Alex Rivera.");
  } else {
    console.log("👤 Demo sandbox account already configured.");
  }

  console.log("✅ Database initialized! Zero pre-fed challenges. All platform activity will be 100% user-generated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

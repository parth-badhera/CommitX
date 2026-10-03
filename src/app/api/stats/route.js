const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const { syncChallengesWithChain } = require("@/lib/chainSync");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await syncChallengesWithChain(await prisma.challenge.findMany()).catch(() => {});

    const totalChallenges = await prisma.challenge.count();
    const totalParticipants = await prisma.participant.count();
    const activeChallenges = await prisma.challenge.count({
      where: { status: "ACTIVE" },
    });
    const finalizedChallenges = await prisma.challenge.count({
      where: { status: "FINALIZED" },
    });

    const challenges = await prisma.challenge.findMany({
      include: {
        _count: {
          select: { participants: true },
        },
      },
    });

    let totalVolumeWei = 0n;
    for (const c of challenges) {
      const stake = BigInt(c.stakeAmountWei || "0");
      const count = BigInt(c._count.participants || 0);
      totalVolumeWei += stake * count;
    }

    const artifacts = await prisma.settlementArtifact.findMany();
    let totalTreasuryWei = 0n;
    for (const a of artifacts) {
      totalTreasuryWei += BigInt(a.treasuryAmountWei || "0");
    }

    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { challenge: true },
    });

    return NextResponse.json({
      totalChallenges,
      totalParticipants,
      activeChallenges,
      finalizedChallenges,
      totalVolumeWei: totalVolumeWei.toString(),
      totalTreasuryWei: totalTreasuryWei.toString(),
      recentTransactions,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


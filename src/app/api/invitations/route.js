const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress parameter is required" },
        { status: 400 }
      );
    }

    const normalizedWallet = walletAddress.trim().toLowerCase();

    const invitations = await prisma.invitation.findMany({
      where: {
        walletAddress: normalizedWallet,
      },
      include: {
        challenge: {
          include: {
            participants: true,
            periods: {
              orderBy: { periodNumber: "asc" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    const enriched = invitations.map((inv) => {
      const isEnrolled = inv.challenge.participants.some(
        (p) => p.walletAddress.toLowerCase() === normalizedWallet
      );
      const isExpired =
        inv.status === "EXPIRED" ||
        (inv.status === "PENDING" && new Date(inv.expiresAt) < now) ||
        inv.challenge.status === "CANCELLED";

      return {
        id: inv.id,
        challengeId: inv.challengeId,
        walletAddress: inv.walletAddress,
        inviteToken: inv.inviteToken,
        status: isEnrolled ? "ACCEPTED" : isExpired ? "EXPIRED" : inv.status,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        isEnrolled,
        isExpired,
        challenge: {
          id: inv.challenge.id,
          contractChallengeId: inv.challenge.contractChallengeId,
          name: inv.challenge.name,
          description: inv.challenge.description,
          category: inv.challenge.category,
          stakeAmountWei: inv.challenge.stakeAmountWei,
          submissionFrequency: inv.challenge.submissionFrequency,
          totalPeriods: inv.challenge.totalPeriods,
          startTime: inv.challenge.startTime,
          endTime: inv.challenge.endTime,
          maxParticipants: inv.challenge.maxParticipants,
          participantsCount: inv.challenge.participants.length,
          status: inv.challenge.status,
          isPrivate: inv.challenge.isPrivate,
          creatorAddress: inv.challenge.creatorAddress,
        },
      };
    });

    const pendingCount = enriched.filter(
      (inv) => inv.status === "PENDING" && !inv.isEnrolled && !inv.isExpired
    ).length;

    return NextResponse.json({
      invitations: enriched,
      pendingCount,
    });
  } catch (error) {
    console.error("Error fetching user invitations:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getReputations, SUSPEND_BELOW } from "@/lib/reputation";
import { reinstate } from "@/lib/moderation";
import { displayName } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** Admin: people removed from challenges, and suspended accounts. */
export async function GET(request) {
  const auth = await requireAdmin(request, NextResponse);
  if (auth.response) return auth.response;

  const [removed, lowUsers] = await Promise.all([
    prisma.participant.findMany({
      where: { disqualifiedAt: { not: null } },
      include: {
        user: { select: { username: true, avatar: true } },
        challenge: { select: { contractChallengeId: true, name: true, status: true } },
      },
      orderBy: { disqualifiedAt: "desc" },
    }),
    prisma.user.findMany({
      where: { reputation: { lt: SUSPEND_BELOW } },
      select: { walletAddress: true, username: true, avatar: true },
    }),
  ]);
  const reps = await getReputations(lowUsers.map((u) => u.walletAddress));

  return NextResponse.json({
    removed: removed.map((p) => ({
      wallet: p.walletAddress,
      name: displayName(p.user, p.walletAddress),
      avatar: p.user?.avatar || null,
      reason: p.disqualifyReason,
      at: p.disqualifiedAt,
      challenge: p.challenge,
    })),
    suspended: lowUsers
      .map((u) => ({ wallet: u.walletAddress, name: displayName(u, u.walletAddress), avatar: u.avatar, reputation: reps[u.walletAddress] }))
      .filter((u) => u.reputation?.suspended),
  });
}

/** Admin: reinstate someone removed by mistake (before settlement). */
export async function POST(request) {
  const auth = await requireAdmin(request, NextResponse);
  if (auth.response) return auth.response;
  try {
    const { wallet, contractChallengeId } = await request.json();
    const count = await reinstate(contractChallengeId, String(wallet || ""));
    return NextResponse.json({ success: true, reinstated: count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

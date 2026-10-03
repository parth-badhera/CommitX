import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { getReputations } from "@/lib/reputation";
import { displayName } from "@/lib/identity";

export const dynamic = "force-dynamic";

/** Admin: complaints with everything needed to judge them. */
export async function GET(request) {
  const auth = await requireAdmin(request, NextResponse);
  if (auth.response) return auth.response;

  const status = new URL(request.url).searchParams.get("status") || "OPEN";
  const complaints = await prisma.complaint.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const wallets = complaints.flatMap((c) => [c.reporterAddress, c.accusedAddress]);
  const [users, reps, votes, challenges] = await Promise.all([
    prisma.user.findMany({
      where: { walletAddress: { in: wallets } },
      select: { walletAddress: true, username: true, avatar: true },
    }),
    getReputations(wallets),
    prisma.verification.findMany({
      where: { id: { in: complaints.map((c) => c.verificationId).filter(Boolean) } },
      include: { proof: { include: { period: { select: { periodNumber: true } } } } },
    }),
    prisma.challenge.findMany({
      where: { contractChallengeId: { in: complaints.map((c) => c.contractChallengeId).filter(Boolean) } },
      select: {
        contractChallengeId: true,
        name: true,
        status: true,
        participants: { select: { walletAddress: true, disqualifiedAt: true } },
      },
    }),
  ]);

  const person = (w) => {
    const u = users.find((x) => x.walletAddress === w);
    return { wallet: w, name: displayName(u, w), avatar: u?.avatar || null, reputation: reps[w] || null };
  };

  return NextResponse.json({
    complaints: complaints.map((c) => {
      const v = votes.find((x) => x.id === c.verificationId);
      const ch = challenges.find((x) => x.contractChallengeId === c.contractChallengeId);
      const removed = (w) => Boolean(ch?.participants.find((p) => p.walletAddress === w)?.disqualifiedAt);
      return {
        ...c,
        settled: ch ? ch.status === "FINALIZED" || ch.status === "CANCELLED" : true,
        accusedRemoved: removed(c.accusedAddress),
        reporterRemoved: removed(c.reporterAddress),
        reporter: person(c.reporterAddress),
        accused: person(c.accusedAddress),
        challengeName: ch?.name || null,
        vote: v
          ? {
              decision: v.decision,
              voided: v.voided,
              proofLink: v.proof.contentUri,
              proofNote: v.proof.note,
              proofOwner: v.proof.participantAddress,
              period: v.proof.period.periodNumber,
            }
          : null,
      };
    }),
  });
}

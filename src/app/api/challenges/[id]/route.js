import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncChallengesWithChain, invalidateChainCache } from "@/lib/chainSync";
import { ensureChallengeRecord, redactInvitations } from "@/lib/challengeRecord";
import { getSessionWallet } from "@/lib/session";

export const dynamic = "force-dynamic";

// Never expose emails, nonces or ids of other users
const PUBLIC_USER = { select: { username: true, avatar: true } };

const INCLUDE = {
  participants: { include: { user: PUBLIC_USER } },
  periods: {
    orderBy: { periodNumber: "asc" },
    include: {
      proofs: {
        orderBy: { submittedAt: "asc" },
        include: { user: PUBLIC_USER, verifications: { include: { user: PUBLIC_USER } } },
      },
    },
  },
  settlement: true,
  invitations: true,
  transactions: { orderBy: { createdAt: "desc" } },
};

async function findChallenge(id) {
  const isNum = /^\d+$/.test(id);
  return prisma.challenge.findFirst({
    where: isNum ? { OR: [{ id }, { contractChallengeId: Number(id) }] } : { id },
    include: INCLUDE,
  });
}

export async function GET(request, { params }) {
  try {
    const id = params.id;
    let challenge = await findChallenge(id);

    // Exists on-chain but never reached the DB (e.g. the browser closed mid-create): self-heal
    if (!challenge && /^\d+$/.test(id)) {
      try {
        await ensureChallengeRecord(Number(id));
        challenge = await findChallenge(id);
      } catch (err) {
        if (err.status !== 404) console.warn("[challenge] self-heal failed:", err.message);
      }
    }

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // ?fresh=1 is sent right after a transaction so the new on-chain state is read immediately
    if (new URL(request.url).searchParams.get("fresh")) {
      invalidateChainCache(challenge.contractChallengeId);
    }
    await syncChallengesWithChain([challenge]);

    return NextResponse.json({ challenge: redactInvitations(challenge, getSessionWallet(request)) });
  } catch (error) {
    console.error("Get challenge error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

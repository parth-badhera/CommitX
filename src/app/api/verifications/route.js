import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeProof } from "@/lib/proofStatus";
import { assertNotSuspended, adjustReputation, REVIEW_CREDIT } from "@/lib/reputation";
import { requireWallet } from "@/lib/session";
import { defaultName } from "@/lib/identity";

export const dynamic = "force-dynamic";

const DECISIONS = new Set(["APPROVE", "REJECT"]);

export async function POST(request) {
  try {
    const { proofId, verifierAddress, decision, reason } = await request.json();
    const vote = String(decision || "").toUpperCase();

    if (!proofId || !verifierAddress || !DECISIONS.has(vote)) {
      return NextResponse.json({ error: "proofId, verifierAddress and an APPROVE/REJECT decision are required" }, { status: 400 });
    }

    const auth = requireWallet(request, verifierAddress, NextResponse);
    if (auth.response) return auth.response;
    const verifier = auth.wallet;

    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        period: { include: { challenge: { include: { participants: true } } } },
        verifications: true,
      },
    });
    if (!proof) {
      return NextResponse.json({ error: "Proof not found" }, { status: 404 });
    }

    const { challenge } = proof.period;
    if (challenge.status === "FINALIZED" || challenge.status === "CANCELLED") {
      return NextResponse.json({ error: "This challenge is settled — voting is closed." }, { status: 400 });
    }
    if (proof.participantAddress.toLowerCase() === verifier) {
      return NextResponse.json({ error: "You can't vote on your own proof." }, { status: 403 });
    }
    if (!challenge.participants.some((p) => p.walletAddress.toLowerCase() === verifier)) {
      return NextResponse.json({ error: "Only participants of this challenge can review its proofs." }, { status: 403 });
    }
    const mine = challenge.participants.find((p) => p.walletAddress.toLowerCase() === verifier);
    if (mine?.disqualifiedAt) {
      return NextResponse.json({ error: "You were removed from this challenge by the admin, so you can't review its proofs." }, { status: 403 });
    }
    try {
      await assertNotSuspended(verifier);
    } catch (err) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status || 403 });
    }
    if (proof.verifications.some((v) => v.verifierAddress.toLowerCase() === verifier)) {
      return NextResponse.json({ error: "You've already voted on this proof." }, { status: 409 });
    }

    await prisma.user.upsert({
      where: { walletAddress: verifier },
      update: {},
      create: { walletAddress: verifier, username: defaultName(verifier) },
    });

    let verification;
    try {
      verification = await prisma.verification.create({
        data: { proofId, verifierAddress: verifier, decision: vote, reason: String(reason || "").slice(0, 500) },
      });
    } catch (err) {
      if (err.code === "P2002") {
        return NextResponse.json({ error: "You've already voted on this proof." }, { status: 409 });
      }
      throw err;
    }

    const result = await recomputeProof(proofId);
    await adjustReputation(verifier, REVIEW_CREDIT, "REVIEW", verification.id);

    return NextResponse.json({
      success: true,
      verification,
      updatedProofStatus: result.status,
      totalApprovals: result.approvals,
      totalRejections: result.rejections,
      requiredApprovals: result.requiredApprovals,
    });
  } catch (error) {
    console.error("Submit verification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

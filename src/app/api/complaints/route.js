import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWallet } from "@/lib/session";
import { assertNotSuspended } from "@/lib/reputation";

export const dynamic = "force-dynamic";

const MAX_OPEN_PER_REPORTER = 10;

/**
 * File a complaint about a vote ("approved an invalid proof" / "rejected a valid proof")
 * or, without a verificationId, about a participant in general. Only participants of
 * the same challenge can complain. An admin decides the outcome.
 */
export async function POST(request) {
  try {
    const { reporterAddress, verificationId, accusedAddress, contractChallengeId, details } = await request.json();
    const auth = requireWallet(request, reporterAddress, NextResponse);
    if (auth.response) return auth.response;
    const reporter = auth.wallet;

    try {
      await assertNotSuspended(reporter);
    } catch (err) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status || 403 });
    }

    const text = String(details || "").trim();
    if (text.length < 10 || text.length > 1000) {
      return NextResponse.json({ error: "Explain what happened in 10–1000 characters." }, { status: 400 });
    }

    let accused;
    let challenge;
    let proofId = null;
    let reason = "OTHER";

    if (verificationId) {
      const vote = await prisma.verification.findUnique({
        where: { id: verificationId },
        include: { proof: { include: { period: { include: { challenge: { include: { participants: true } } } } } } },
      });
      if (!vote || vote.voided) return NextResponse.json({ error: "That vote no longer exists." }, { status: 404 });
      accused = vote.verifierAddress.toLowerCase();
      challenge = vote.proof.period.challenge;
      proofId = vote.proofId;
      reason = vote.decision === "APPROVE" ? "WRONG_APPROVAL" : "WRONG_REJECTION";
    } else {
      accused = String(accusedAddress || "").toLowerCase();
      challenge = await prisma.challenge.findUnique({
        where: { contractChallengeId: Number(contractChallengeId) },
        include: { participants: true },
      });
      if (!challenge) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
      if (!challenge.participants.some((p) => p.walletAddress.toLowerCase() === accused)) {
        return NextResponse.json({ error: "That person isn't in this challenge." }, { status: 400 });
      }
    }

    if (accused === reporter) return NextResponse.json({ error: "You can't report yourself." }, { status: 400 });
    const reporterSeat = challenge.participants.find((p) => p.walletAddress.toLowerCase() === reporter);
    if (!reporterSeat) {
      return NextResponse.json({ error: "Only people in this challenge can report its votes." }, { status: 403 });
    }
    if (reporterSeat.disqualifiedAt) {
      return NextResponse.json({ error: "You were removed from this challenge, so you can't file reports in it." }, { status: 403 });
    }
    if (challenge.status === "FINALIZED" || challenge.status === "CANCELLED") {
      return NextResponse.json({ error: "This challenge is already settled — reports are closed." }, { status: 400 });
    }

    const duplicate = await prisma.complaint.findFirst({
      where: {
        reporterAddress: reporter,
        status: "OPEN",
        ...(verificationId
          ? { verificationId }
          : { accusedAddress: accused, contractChallengeId: challenge.contractChallengeId, verificationId: null }),
      },
    });
    if (duplicate) {
      return NextResponse.json({ error: "You've already reported this — the admin will review it." }, { status: 409 });
    }

    const openCount = await prisma.complaint.count({ where: { reporterAddress: reporter, status: "OPEN" } });
    if (openCount >= MAX_OPEN_PER_REPORTER) {
      return NextResponse.json(
        { error: "You have too many open reports. Wait for the admin to review them." },
        { status: 429 }
      );
    }

    const complaint = await prisma.complaint.create({
      data: {
        reporterAddress: reporter,
        accusedAddress: accused,
        contractChallengeId: challenge.contractChallengeId,
        proofId,
        verificationId: verificationId || null,
        reason,
        details: text,
      },
    });
    return NextResponse.json({ success: true, complaint }, { status: 201 });
  } catch (error) {
    console.error("Complaint error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

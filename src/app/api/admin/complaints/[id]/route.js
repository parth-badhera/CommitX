import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { recomputeProof } from "@/lib/proofStatus";
import { adjustReputation, PENALTY } from "@/lib/reputation";
import { disqualify } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/**
 * Admin resolves a complaint.
 *   uphold        → the reported vote is cancelled, proof re-scored, voter −10 reputation
 *   uphold+remove → same, and the voter is removed from the challenge (stake forfeited)
 *   false         → the complaint was false: reporter −10 reputation
 *   false+remove  → same, and the reporter is removed from the challenge (stake forfeited)
 *   dismiss       → closed, no penalty for anyone
 */
export async function POST(request, { params }) {
  const auth = await requireAdmin(request, NextResponse);
  if (auth.response) return auth.response;

  try {
    const { action, remove = false, note } = await request.json();
    if (!["uphold", "false", "dismiss"].includes(action)) {
      return NextResponse.json({ error: "action must be uphold, false or dismiss" }, { status: 400 });
    }
    const complaint = await prisma.complaint.findUnique({ where: { id: params.id } });
    if (!complaint) return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    if (complaint.status !== "OPEN") {
      return NextResponse.json({ error: "This complaint is already resolved." }, { status: 409 });
    }
    const reason = String(note || "").slice(0, 300) || null;
    const outcome = [];

    // Removal first: if the challenge is already settled this fails before anything else changes
    if (remove && action !== "dismiss" && complaint.contractChallengeId) {
      const target = action === "uphold" ? complaint.accusedAddress : complaint.reporterAddress;
      await disqualify(
        complaint.contractChallengeId,
        target,
        reason || (action === "uphold" ? "Wrong review upheld by admin" : "False complaint"),
        auth.wallet
      );
      outcome.push(action === "uphold" ? "ACCUSED_REMOVED" : "REPORTER_REMOVED");
    }

    let proofResult = null;
    if (action === "uphold") {
      if (complaint.verificationId) {
        const vote = await prisma.verification.update({ where: { id: complaint.verificationId }, data: { voided: true } });
        proofResult = await recomputeProof(vote.proofId);
        outcome.push("VOTE_CANCELLED");
        // Other open reports about the same vote are settled by this decision
        await prisma.complaint.updateMany({
          where: { verificationId: complaint.verificationId, status: "OPEN", id: { not: complaint.id } },
          data: {
            status: "UPHELD",
            outcome: "DUPLICATE",
            resolution: "Resolved together with an earlier report about the same vote.",
            resolvedBy: auth.wallet,
            resolvedAt: new Date(),
          },
        });
      }
      await adjustReputation(complaint.accusedAddress, -PENALTY, "PENALTY_WRONG_VOTE", complaint.id);
      outcome.push("ACCUSED_PENALIZED");
    } else if (action === "false") {
      await adjustReputation(complaint.reporterAddress, -PENALTY, "PENALTY_FALSE_REPORT", complaint.id);
      outcome.push("REPORTER_PENALIZED");
    }

    const updated = await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        status: action === "uphold" ? "UPHELD" : action === "false" ? "FALSE_REPORT" : "DISMISSED",
        outcome: outcome.join(",") || null,
        resolution: reason,
        resolvedBy: auth.wallet,
        resolvedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, complaint: updated, proof: proofResult });
  } catch (error) {
    console.error("Resolve complaint error:", error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

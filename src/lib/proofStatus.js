const { prisma } = require("./prisma");
const { getRequiredApprovals } = require("./formatters");

/**
 * Recomputes a proof's status from its non-voided votes (≥33% of the cohort must
 * approve, more approvals than rejections), then refreshes the submitter's verified
 * period count. Returns { status, approvals, rejections, requiredApprovals }.
 */
async function recomputeProof(proofId) {
  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: {
      verifications: { where: { voided: false } },
      period: { include: { challenge: { include: { participants: { select: { walletAddress: true } } } } } },
    },
  });
  if (!proof) return null;

  const challenge = proof.period.challenge;
  const requiredApprovals = getRequiredApprovals(challenge.participants.length);
  const approvals = proof.verifications.filter((v) => v.decision === "APPROVE").length;
  const rejections = proof.verifications.filter((v) => v.decision === "REJECT").length;

  let status = "PENDING";
  if (approvals >= requiredApprovals && approvals > rejections) status = "APPROVED";
  else if (rejections >= requiredApprovals && rejections > approvals) status = "REJECTED";

  if (status !== proof.status) {
    await prisma.proof.update({ where: { id: proofId }, data: { status } });
  }

  // Verified periods = distinct periods with an approved proof
  const approved = await prisma.proof.findMany({
    where: { participantAddress: proof.participantAddress, status: "APPROVED", period: { challengeId: challenge.id } },
    select: { periodId: true },
    distinct: ["periodId"],
  });
  await prisma.participant.updateMany({
    where: { challengeId: challenge.id, walletAddress: proof.participantAddress },
    data: { completedPeriods: Math.min(approved.length, challenge.totalPeriods) },
  });

  return { status, approvals, rejections, requiredApprovals };
}

module.exports = { recomputeProof };

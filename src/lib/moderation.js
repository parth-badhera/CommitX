const { prisma } = require("./prisma");

/**
 * Removes a participant from a challenge (admin penalty). They can no longer submit
 * proof, review or report in it, and settlement gives them 0 periods — so they get no
 * payout and their stake feeds the pool. Not possible once the challenge is settled.
 */
async function disqualify(contractChallengeId, wallet, reason, adminWallet) {
  const challenge = await prisma.challenge.findUnique({
    where: { contractChallengeId: Number(contractChallengeId) },
    include: { participants: true },
  });
  if (!challenge) throw Object.assign(new Error("Challenge not found"), { status: 404 });
  if (challenge.status === "FINALIZED" || challenge.status === "CANCELLED") {
    throw Object.assign(new Error("This challenge is already settled — its payouts can't change any more."), { status: 409 });
  }
  const seat = challenge.participants.find((p) => p.walletAddress.toLowerCase() === wallet.toLowerCase());
  if (!seat) throw Object.assign(new Error("That wallet isn't in this challenge."), { status: 400 });
  if (seat.disqualifiedAt) return seat;
  return prisma.participant.update({
    where: { id: seat.id },
    data: { disqualifiedAt: new Date(), disqualifyReason: String(reason || "").slice(0, 300) || null, disqualifiedBy: adminWallet },
  });
}

/** Undoes a removal (admin mistake), as long as the challenge isn't settled yet. */
async function reinstate(contractChallengeId, wallet) {
  const challenge = await prisma.challenge.findUnique({ where: { contractChallengeId: Number(contractChallengeId) } });
  if (!challenge) throw Object.assign(new Error("Challenge not found"), { status: 404 });
  if (challenge.status === "FINALIZED" || challenge.status === "CANCELLED") {
    throw Object.assign(new Error("This challenge is already settled."), { status: 409 });
  }
  const res = await prisma.participant.updateMany({
    where: { challengeId: challenge.id, walletAddress: wallet.toLowerCase() },
    data: { disqualifiedAt: null, disqualifyReason: null, disqualifiedBy: null },
  });
  return res.count;
}

module.exports = { disqualify, reinstate };

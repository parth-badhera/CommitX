const { ethers } = require("ethers");
const { prisma } = require("./prisma");
const { getRequiredApprovals } = require("./formatters");
const { syncChallengesWithChain, invalidateChainCache, readParticipants } = require("./chainSync");
const { getAttestorWallet, eip712Domain } = require("./attestor");
const { netStakeFor } = require("./network");
const { defaultName } = require("./identity");

// EIP-712 Types matching CommitXProtocol.sol
const EIP712_TYPES = {
  Settlement: [
    { name: "challengeId", type: "uint256" },
    { name: "settlementNonce", type: "uint256" },
    { name: "participants", type: "address[]" },
    { name: "completedPeriods", type: "uint256[]" },
  ],
};

/**
 * Aggregates peer verification votes, audits rules, sorts participants canonically,
 * and signs the EIP-712 settlement attestation.
 */
async function generateSettlementAttestation(contractChallengeId) {
  const challenge = await prisma.challenge.findUnique({
    where: { contractChallengeId: Number(contractChallengeId) },
    include: {
      participants: true,
      periods: { include: { proofs: { include: { verifications: true } } } },
    },
  });

  if (!challenge) {
    throw new Error(`Challenge ${contractChallengeId} not found`);
  }

  // Settlement nonce and status must match the contract, not a stale DB copy
  invalidateChainCache(challenge.contractChallengeId);
  await syncChallengesWithChain([challenge]);

  if (challenge.status === "FINALIZED") {
    throw new Error("This challenge is already settled on-chain. Participants can withdraw their payouts now.");
  }
  if (challenge.status === "CANCELLED") {
    throw new Error("This challenge is closed — fewer than 2 people joined, so it never ran.");
  }
  if (Date.now() < new Date(challenge.endTime).getTime()) {
    throw new Error("Settlement opens once the challenge end time has passed.");
  }

  // 1. The contract's participant list is canonical — the DB may have drifted
  //    (failed sync, manual edits). Using it guarantees finalizeChallenge accepts the set.
  const enrolled = await readParticipants(challenge.contractChallengeId);
  if (enrolled.length < 2) {
    throw new Error("Fewer than 2 people joined, so this challenge can't be settled — the participant can take their stake back instead.");
  }
  const enrolledSet = new Set(enrolled);

  // Backfill anyone enrolled on-chain but missing from the DB
  const inDb = new Set(challenge.participants.map((p) => p.walletAddress.toLowerCase()));
  for (const wallet of enrolled.filter((w) => !inDb.has(w))) {
    await prisma.user
      .upsert({ where: { walletAddress: wallet }, update: {}, create: { walletAddress: wallet, username: defaultName(wallet) } })
      .then(() =>
        prisma.participant.create({
          data: { challengeId: challenge.id, walletAddress: wallet, joinedTxHash: "on-chain-backfill" },
        })
      )
      .catch((err) => console.warn("[attestation] backfill failed:", err.message));
  }

  // 2. Count verified periods per participant — each period counts at most once
  const requiredApprovals = getRequiredApprovals(enrolled.length);
  const verifiedPeriods = new Map(enrolled.map((w) => [w, new Set()]));

  for (const period of challenge.periods) {
    for (const proof of period.proofs) {
      const submitter = proof.participantAddress.toLowerCase();
      if (!enrolledSet.has(submitter)) continue;

      let approvals = 0;
      let rejections = 0;
      const seen = new Set();
      for (const v of proof.verifications) {
        if (v.voided) continue; // overturned by an admin after a complaint
        const verifier = v.verifierAddress.toLowerCase();
        if (verifier === submitter || !enrolledSet.has(verifier) || seen.has(verifier)) continue;
        seen.add(verifier);
        if (v.decision === "APPROVE") approvals++;
        if (v.decision === "REJECT") rejections++;
      }

      if (approvals >= requiredApprovals && approvals > rejections) {
        verifiedPeriods.get(submitter).add(period.id);
      }
    }
  }

  // 3. Canonical ordering: strictly ascending addresses (bytewise on lowercase hex)
  const sorted = [...enrolled].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const canonicalAddresses = sorted.map((w) => ethers.getAddress(w));
  // Participants removed by an admin forfeit: 0 periods → no payout, stake goes to the pool
  const removed = new Set(challenge.participants.filter((p) => p.disqualifiedAt).map((p) => p.walletAddress.toLowerCase()));
  const completedPeriods = sorted.map((w) => (removed.has(w) ? 0 : Math.min(verifiedPeriods.get(w).size, challenge.totalPeriods)));

  // Keep DB progress in line with what is being attested
  await Promise.all(
    sorted.map((w, i) =>
      prisma.participant
        .updateMany({ where: { challengeId: challenge.id, walletAddress: w }, data: { completedPeriods: completedPeriods[i] } })
        .catch(() => {})
    )
  );

  // 4. Exact integer wei accounting preview (mirrors the contract, which settles the post-fee stake)
  const stakeWei = netStakeFor(challenge.stakeAmountWei, challenge.contractChallengeId);
  const totalPeriods = BigInt(challenge.totalPeriods);
  const threshold = BigInt(challenge.qualificationThreshold);
  const n = BigInt(canonicalAddresses.length);

  let totalPenaltyPool = 0n;
  let qualifyingWeightSum = 0n;
  let qualifiersCount = 0;
  const retainedAmounts = [];
  const qualifies = [];

  for (let i = 0; i < canonicalAddresses.length; i++) {
    const cPeriods = BigInt(completedPeriods[i]);
    const retained = (stakeWei * cPeriods) / totalPeriods;
    retainedAmounts.push(retained);
    totalPenaltyPool += stakeWei - retained;
    const q = cPeriods * 100n >= threshold * totalPeriods;
    qualifies.push(q);
    if (q) {
      qualifyingWeightSum += cPeriods;
      qualifiersCount++;
    }
  }

  let totalRewardsDistributed = 0n;
  const finalPayouts = [];
  if (qualifiersCount === 0 || qualifyingWeightSum === 0n) {
    finalPayouts.push(...retainedAmounts);
  } else {
    for (let i = 0; i < canonicalAddresses.length; i++) {
      const reward = qualifies[i] ? (totalPenaltyPool * BigInt(completedPeriods[i])) / qualifyingWeightSum : 0n;
      totalRewardsDistributed += reward;
      finalPayouts.push(retainedAmounts[i] + reward);
    }
  }
  const treasuryCut = totalPenaltyPool - totalRewardsDistributed;

  // 5. Sign
  const domain = eip712Domain(challenge.contractChallengeId);
  const settlementMessage = {
    challengeId: BigInt(challenge.contractChallengeId),
    settlementNonce: BigInt(challenge.settlementNonce),
    participants: canonicalAddresses,
    completedPeriods: completedPeriods.map(BigInt),
  };
  const attestorWallet = getAttestorWallet();
  const signature = await attestorWallet.signTypedData(domain, EIP712_TYPES, settlementMessage);
  const digest = ethers.TypedDataEncoder.hash(domain, EIP712_TYPES, settlementMessage);

  // 6. Persist the artifact for auditing
  const artifactData = {
    settlementNonce: challenge.settlementNonce,
    canonicalAddresses: JSON.stringify(canonicalAddresses),
    completedPeriods: JSON.stringify(completedPeriods),
    digest,
    signature,
    attestorAddress: attestorWallet.address,
    totalDepositedWei: (stakeWei * n).toString(),
    totalPenaltyWei: totalPenaltyPool.toString(),
    treasuryAmountWei: treasuryCut.toString(),
    qualifiersCount,
  };
  await prisma.settlementArtifact.upsert({
    where: { challengeId: challenge.id },
    update: artifactData,
    create: { challengeId: challenge.id, ...artifactData },
  });

  return {
    challengeId: challenge.contractChallengeId,
    settlementNonce: challenge.settlementNonce,
    canonicalAddresses,
    completedPeriods,
    signature,
    digest,
    attestorAddress: attestorWallet.address,
    accounting: {
      totalDepositedWei: (stakeWei * n).toString(),
      totalPenaltyWei: totalPenaltyPool.toString(),
      treasuryCutWei: treasuryCut.toString(),
      qualifiersCount,
      payouts: canonicalAddresses.map((addr, idx) => ({
        address: addr,
        completed: completedPeriods[idx],
        qualifies: qualifies[idx],
        retainedWei: retainedAmounts[idx].toString(),
        finalPayoutWei: finalPayouts[idx].toString(),
      })),
    },
  };
}

module.exports = { generateSettlementAttestation, EIP712_TYPES };

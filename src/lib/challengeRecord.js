const crypto = require("crypto");
const { prisma } = require("./prisma");
const { readChallengeStruct, readParticipants } = require("./chainSync");
const { defaultName } = require("./identity");

const DAY_MS = 24 * 60 * 60 * 1000;
const isTxHash = (h) => typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h);

/**
 * Creates the DB record for an on-chain challenge. Every economic field
 * (creator, stake, schedule, periods, capacity, visibility) comes from the
 * contract, never from the request — only display metadata is taken from `meta`.
 * Returns { challenge, created } or throws if the challenge isn't on-chain.
 */
async function ensureChallengeRecord(contractChallengeId, meta = {}) {
  const id = Number(contractChallengeId);
  const existing = await prisma.challenge.findUnique({ where: { contractChallengeId: id } });
  if (existing) {
    // A self-healed placeholder gets the creator's display metadata once it arrives
    if (meta.name && existing.name === `Challenge #${id}` && !existing.description) {
      const updated = await prisma.challenge.update({
        where: { id: existing.id },
        data: {
          name: String(meta.name).trim().slice(0, 120),
          description: String(meta.description || "").slice(0, 2000),
          category: meta.category || existing.category,
        },
      });
      return { challenge: updated, created: false };
    }
    return { challenge: existing, created: false };
  }

  const onChain = await readChallengeStruct(id);
  if (!onChain) {
    const err = new Error("This challenge doesn't exist on-chain yet. Wait for the transaction to confirm and retry.");
    err.status = 404;
    throw err;
  }

  const startMs = onChain.startTime * 1000;
  const endMs = onChain.endTime * 1000;
  const total = Math.max(1, onChain.totalPeriods);

  // Period length: the creator's chosen cadence when it reproduces the on-chain
  // period count, otherwise an even split of the challenge window.
  const freqDays = Math.max(1, Math.round(Number(meta.submissionFrequency) || 0));
  const periodMs =
    freqDays && Math.floor((endMs - startMs) / (freqDays * DAY_MS)) === total
      ? freqDays * DAY_MS
      : Math.floor((endMs - startMs) / total);

  await prisma.user.upsert({
    where: { walletAddress: onChain.creator },
    update: {},
    create: { walletAddress: onChain.creator, username: defaultName(onChain.creator) },
  });

  let challenge;
  try {
    challenge = await prisma.challenge.create({
      data: {
        contractChallengeId: id,
        creatorAddress: onChain.creator,
        name: String(meta.name || `Challenge #${id}`).trim().slice(0, 120),
        description: String(meta.description || "").slice(0, 2000),
        category: meta.category || "Custom",
        stakeAmountWei: onChain.stakeAmountWei,
        totalPeriods: total,
        submissionFrequency: Math.max(1, Math.round(periodMs / DAY_MS)),
        qualificationThreshold: onChain.qualificationThreshold,
        startTime: new Date(startMs),
        endTime: new Date(endMs),
        verificationDeadline: new Date(endMs + onChain.verificationDuration * 1000),
        maxParticipants: onChain.maxParticipants,
        status: Date.now() < startMs ? "OPEN" : Date.now() < endMs ? "ACTIVE" : "VERIFICATION",
        isPrivate: onChain.isPrivate,
        settlementNonce: 1,
        periods: {
          create: Array.from({ length: total }, (_, i) => ({
            periodNumber: i + 1,
            startTime: new Date(startMs + i * periodMs),
            endTime: new Date(i === total - 1 ? endMs : Math.min(startMs + (i + 1) * periodMs, endMs)),
          })),
        },
      },
    });
  } catch (err) {
    // Another request created it first
    if (err.code === "P2002") {
      return { challenge: await prisma.challenge.findUnique({ where: { contractChallengeId: id } }), created: false };
    }
    throw err;
  }

  if (onChain.isPrivate) {
    await prisma.invitation.create({
      data: {
        challengeId: challenge.id,
        inviteToken: `invite-${id}-${crypto.randomBytes(12).toString("hex")}`,
        status: "PENDING",
        invitedBy: onChain.creator,
        expiresAt: new Date(startMs),
      },
    });
    for (const raw of Array.isArray(meta.initialInvitedWallets) ? meta.initialInvitedWallets : []) {
      const w = String(raw).trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(w) || w === onChain.creator) continue;
      await prisma.invitation
        .create({
          data: {
            challengeId: challenge.id,
            walletAddress: w,
            inviteToken: `invite-${crypto.randomBytes(12).toString("hex")}`,
            status: "PENDING",
            invitedBy: onChain.creator,
            expiresAt: new Date(startMs),
          },
        })
        .catch(() => {});
    }
  }

  // Mirror on-chain enrolment (e.g. the creator's auto-stake)
  try {
    for (const wallet of await readParticipants(id)) {
      await prisma.user.upsert({
        where: { walletAddress: wallet },
        update: {},
        create: { walletAddress: wallet, username: defaultName(wallet) },
      });
      await prisma.participant.upsert({
        where: { challengeId_walletAddress: { challengeId: challenge.id, walletAddress: wallet } },
        update: {},
        create: { challengeId: challenge.id, walletAddress: wallet, joinedTxHash: "on-chain-sync" },
      });
    }
  } catch (err) {
    console.warn("[challengeRecord] participant mirror failed:", err.message);
  }

  if (isTxHash(meta.txHash)) {
    await prisma.transaction
      .create({
        data: {
          challengeId: challenge.id,
          walletAddress: onChain.creator,
          txHash: meta.txHash,
          type: "CREATE",
          status: "CONFIRMED",
          amountWei: onChain.stakeAmountWei,
        },
      })
      .catch(() => {});
  }

  return { challenge, created: true };
}

/** Removes secret invite tokens unless the viewer is the challenge creator. */
function redactInvitations(challenge, viewerWallet) {
  if (!challenge?.invitations) return challenge;
  const isCreator = viewerWallet && viewerWallet === challenge.creatorAddress?.toLowerCase();
  if (isCreator) return challenge;
  return {
    ...challenge,
    invitations: challenge.invitations
      .filter((inv) => inv.walletAddress)
      .map(({ inviteToken, ...rest }) => rest),
  };
}

module.exports = { ensureChallengeRecord, redactInvitations, isTxHash };

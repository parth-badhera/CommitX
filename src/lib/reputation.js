const { prisma } = require("./prisma");
const { defaultName } = require("./identity");

// ── Rules ────────────────────────────────────────────────────────────────
// Everyone starts at 100 (range 0–100).
//   +2  each proof review you cast
//   −10 when an admin upholds a complaint about your vote, or rules your complaint false
// Below 25 you are SUSPENDED: you can't join, create, submit proof, review or report.
// Every full 4 days spent below 25 automatically adds +2 (recovery) until you reach 25.
const START = 100;
const REVIEW_CREDIT = 2;
const PENALTY = 10;
const SUSPEND_BELOW = 25;
const RECOVERY_DAYS = 4;
const RECOVERY_MS = RECOVERY_DAYS * 24 * 60 * 60 * 1000;
const RECOVERY_CREDIT = 2;

const clamp = (n) => Math.max(0, Math.min(100, n));

function level(score) {
  if (score < SUSPEND_BELOW) return "Suspended";
  if (score >= 80) return "Trusted";
  if (score >= 50) return "Fair";
  return "At risk";
}

async function ensureUser(wallet) {
  return prisma.user.upsert({
    where: { walletAddress: wallet },
    update: {},
    create: { walletAddress: wallet, username: defaultName(wallet), reputation: START },
  });
}

/** Applies any +2 recovery ticks owed for time spent below 25. Returns the fresh user. */
async function settleRecovery(user) {
  if (!user.lowSince || user.reputation >= SUSPEND_BELOW) return user;
  let score = user.reputation;
  let since = new Date(user.lowSince).getTime();
  const events = [];
  while (score < SUSPEND_BELOW && Date.now() - since >= RECOVERY_MS) {
    since += RECOVERY_MS;
    score = clamp(score + RECOVERY_CREDIT);
    events.push({ walletAddress: user.walletAddress, delta: RECOVERY_CREDIT, reason: "RECOVERY", scoreAfter: score, createdAt: new Date(since) });
  }
  if (!events.length) return user;
  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { walletAddress: user.walletAddress },
      data: { reputation: score, lowSince: score >= SUSPEND_BELOW ? null : new Date(since) },
    }),
    prisma.reputationEvent.createMany({ data: events }),
  ]);
  return updated;
}

/** Changes a wallet's reputation by `delta`, logging the event and (un)suspending as needed. */
async function adjustReputation(wallet, delta, reason, refId = null) {
  const w = wallet.toLowerCase();
  const user = await settleRecovery(await ensureUser(w));
  const score = clamp(user.reputation + delta);
  const lowSince = score >= SUSPEND_BELOW ? null : user.lowSince || new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { walletAddress: w }, data: { reputation: score, lowSince } }),
    prisma.reputationEvent.create({ data: { walletAddress: w, delta, reason, refId, scoreAfter: score } }),
  ]);
  return score;
}

function standingOf(user) {
  const score = user?.reputation ?? START;
  const suspended = score < SUSPEND_BELOW;
  const nextRecovery = suspended && user?.lowSince ? new Date(new Date(user.lowSince).getTime() + RECOVERY_MS) : null;
  return { score, level: level(score), suspended, nextRecovery };
}

/** Reputation for many wallets at once → { [wallet]: {...} } */
async function getReputations(wallets) {
  const list = [...new Set(wallets.map((w) => String(w).toLowerCase()))].filter((w) => /^0x[0-9a-f]{40}$/.test(w));
  if (!list.length) return {};

  let users = await prisma.user.findMany({ where: { walletAddress: { in: list } } });
  users = await Promise.all(users.map(settleRecovery));
  const [complaints, votes] = await Promise.all([
    prisma.complaint.groupBy({ by: ["accusedAddress", "status"], where: { accusedAddress: { in: list } }, _count: true }),
    prisma.verification.groupBy({ by: ["verifierAddress", "voided"], where: { verifierAddress: { in: list } }, _count: true }),
  ]);

  const out = {};
  for (const w of list) {
    const u = users.find((x) => x.walletAddress === w);
    const count = (status) => complaints.find((c) => c.accusedAddress === w && c.status === status)?._count || 0;
    out[w] = {
      ...standingOf(u),
      upheld: count("UPHELD"),
      open: count("OPEN"),
      votes: votes.find((v) => v.verifierAddress === w && !v.voided)?._count || 0,
      voidedVotes: votes.find((v) => v.verifierAddress === w && v.voided)?._count || 0,
    };
  }
  return out;
}

/**
 * Throws a 403-style error if the wallet is suspended (reputation below 25).
 * Used by every "do something" endpoint: proofs, reviews, reports, private joins.
 */
async function assertNotSuspended(wallet) {
  const u = await prisma.user.findUnique({ where: { walletAddress: wallet.toLowerCase() } });
  if (!u) return;
  const fresh = await settleRecovery(u);
  const s = standingOf(fresh);
  if (s.suspended) {
    const err = new Error(
      `Your reputation is ${s.score}/100 — below 25, so your account is suspended. ` +
        `It recovers +2 every ${RECOVERY_DAYS} days${s.nextRecovery ? ` (next on ${s.nextRecovery.toDateString()})` : ""}. ` +
        `Until then you can't join, create, submit or review.`
    );
    err.status = 403;
    err.code = "SUSPENDED";
    throw err;
  }
}

module.exports = {
  getReputations,
  adjustReputation,
  assertNotSuspended,
  REVIEW_CREDIT,
  PENALTY,
  SUSPEND_BELOW,
  RECOVERY_DAYS,
};

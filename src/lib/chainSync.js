const { ethers } = require("ethers");
const { prisma } = require("./prisma");
const { deploymentFor, CHAIN_ID } = require("./network");
const { abiFor } = require("./abis");

// Mirrors CommitXProtocol.ChallengeStatus
const ONCHAIN_STATUS = ["OPEN", "ACTIVE", "VERIFICATION", "FINALIZED", "CANCELLED"];
const TERMINAL = new Set(["FINALIZED", "CANCELLED"]);
const CACHE_TTL_MS = 15_000;
const RPC_TIMEOUT_MS = 4_000;

let provider = null;
const contractsByAddress = new Map();
const cache = new Map(); // contractChallengeId -> { at, data }

function getProvider() {
  if (!provider) {
    const rpcUrl =
      process.env.SEPOLIA_RPC_URL ||
      process.env.NEXT_PUBLIC_RPC_URL ||
      (CHAIN_ID === 31337 ? "http://127.0.0.1:8545" : "https://ethereum-sepolia-rpc.publicnode.com");
    provider = new ethers.JsonRpcProvider(rpcUrl, CHAIN_ID, { staticNetwork: true });
  }
  return provider;
}

/** Read-only contract for an address, or for the deployment that owns challenge `id`. */
function getReadContract(idOrAddress) {
  const address =
    typeof idOrAddress === "string" && idOrAddress.startsWith("0x") ? idOrAddress : deploymentFor(idOrAddress ?? Infinity).address;
  if (!contractsByAddress.has(address)) {
    contractsByAddress.set(address, new ethers.Contract(address, abiFor(address), getProvider()));
  }
  return contractsByAddress.get(address);
}

/** Rejects if `promise` takes longer than `ms` — a slow RPC must never hang a page. */
function withTimeout(promise, ms = RPC_TIMEOUT_MS) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`RPC timeout after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(t));
}

/**
 * Time-based lifecycle status used when the chain cannot be reached.
 */
function deriveTimeStatus(challenge) {
  const now = Date.now();
  if (now < new Date(challenge.startTime).getTime()) return "OPEN";
  if (now < new Date(challenge.endTime).getTime()) return "ACTIVE";
  return "VERIFICATION";
}

async function readOnChain(contractChallengeId) {
  const hit = cache.get(contractChallengeId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const protocol = getReadContract(contractChallengeId);
  const [raw, statusIdx] = await withTimeout(
    Promise.all([protocol.getChallenge(contractChallengeId), protocol.getCurrentStatus(contractChallengeId)])
  );

  const data =
    Number(raw.id) === 0
      ? null
      : {
          status: ONCHAIN_STATUS[Number(statusIdx)] || "OPEN",
          settlementNonce: Number(raw.settlementNonce),
        };
  cache.set(contractChallengeId, { at: Date.now(), data });
  return data;
}

/** Full on-chain challenge struct, or null if it doesn't exist. */
async function readChallengeStruct(contractChallengeId) {
  const raw = await withTimeout(getReadContract(contractChallengeId).getChallenge(contractChallengeId));
  if (Number(raw.id) === 0) return null;
  return {
    creator: raw.creator.toLowerCase(),
    stakeAmountWei: raw.stakeAmount.toString(),
    totalPeriods: Number(raw.totalPeriods),
    qualificationThreshold: Number(raw.qualificationThreshold),
    startTime: Number(raw.startTime),
    endTime: Number(raw.endTime),
    verificationDuration: Number(raw.verificationDuration),
    maxParticipants: Number(raw.maxParticipants),
    isPrivate: Boolean(raw.isPrivate),
  };
}

/** Enrolled wallets according to the contract (lowercase). */
async function readParticipants(contractChallengeId) {
  const list = await withTimeout(getReadContract(contractChallengeId).getChallengeParticipants(contractChallengeId));
  return list.map((a) => a.toLowerCase());
}

async function isParticipantOnChain(contractChallengeId, wallet) {
  return Boolean(await withTimeout(getReadContract(contractChallengeId).isParticipant(contractChallengeId, wallet)));
}

/**
 * Reconciles DB challenge status + settlement nonce with the contract.
 * The contract is the source of truth: once it is FINALIZED/CANCELLED the
 * DB must follow, otherwise the UI keeps offering settlement instead of
 * withdrawal. Settled/cancelled challenges never change, so they skip RPC.
 * Mutates and returns the passed challenge objects.
 */
async function syncChallengesWithChain(challenges) {
  await Promise.all(
    challenges.map(async (challenge) => {
      if (TERMINAL.has(challenge.status)) return;

      let next = { status: challenge.status, settlementNonce: challenge.settlementNonce };
      try {
        const onChain = await readOnChain(challenge.contractChallengeId);
        if (onChain) {
          next = { status: onChain.status, settlementNonce: onChain.settlementNonce };
        } else {
          next.status = deriveTimeStatus(challenge);
        }
      } catch (err) {
        console.warn(`[chainSync] #${challenge.contractChallengeId}: ${err.shortMessage || err.message}`);
        next.status = deriveTimeStatus(challenge);
      }

      if (next.status !== challenge.status || next.settlementNonce !== challenge.settlementNonce) {
        await prisma.challenge
          .update({ where: { id: challenge.id }, data: next })
          .catch((err) => console.warn("[chainSync] DB update failed:", err.message));

        if (next.status === "FINALIZED") {
          await prisma.participant
            .updateMany({
              where: { challengeId: challenge.id, settlementStatus: "PENDING" },
              data: { settlementStatus: "SETTLED" },
            })
            .catch(() => {});
        }
      }

      challenge.status = next.status;
      challenge.settlementNonce = next.settlementNonce;
    })
  );
  return challenges;
}

function invalidateChainCache(contractChallengeId) {
  if (contractChallengeId === undefined) cache.clear();
  else cache.delete(Number(contractChallengeId));
}

module.exports = {
  getReadContract,
  withTimeout,
  readChallengeStruct,
  readParticipants,
  isParticipantOnChain,
  syncChallengesWithChain,
  invalidateChainCache,
  deriveTimeStatus,
};

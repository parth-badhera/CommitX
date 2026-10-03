// Network constants and contract routing with no heavy dependencies (no ABI, no ethers) —
// safe to import anywhere, including the global layout and server code.
const deployments = require("../config/deployments");

const { CURRENT, LEGACY_DEPLOYMENTS = [] } = deployments;

// The address book (written by scripts/deploy.js) is the single source of truth for addresses.
const CONTRACT_ADDRESS = CURRENT.address;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || CURRENT.chainId);
const EXPLORER = CHAIN_ID === 11155111 ? "https://sepolia.etherscan.io" : null;
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (CHAIN_ID === 31337 ? "http://127.0.0.1:8545" : "https://ethereum-sepolia-rpc.publicnode.com");

// 0.125% joining fee, taken out of the stake (current contract only)
const FEE_NUMERATOR = 125n;
const FEE_DENOMINATOR = 100000n;
const FEE_PERCENT_LABEL = "0.125%";

const ALL_DEPLOYMENTS = [
  { ...CURRENT, current: true },
  ...LEGACY_DEPLOYMENTS.filter((d) => d.address.toLowerCase() !== CURRENT.address.toLowerCase()).map((d) => ({
    ...d,
    current: false,
  })),
];

/** The contract that owns challenge `id`: the newest deployment whose ID range starts at or below it. */
function deploymentFor(id) {
  const n = Number(id);
  return (
    [...ALL_DEPLOYMENTS].sort((a, b) => b.firstChallengeId - a.firstChallengeId).find((d) => n >= d.firstChallengeId) ||
    ALL_DEPLOYMENTS[0]
  );
}

const isLegacyChallenge = (id) => !deploymentFor(id).current;

/** Joining fee in wei for a stake on challenge `id` (0 on fee-less legacy contracts). */
function feeFor(stakeWei, id) {
  if (!deploymentFor(id).hasFee) return 0n;
  return (BigInt(stakeWei) * FEE_NUMERATOR) / FEE_DENOMINATOR;
}

const netStakeFor = (stakeWei, id) => BigInt(stakeWei) - feeFor(stakeWei, id);

module.exports = {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  EXPLORER,
  RPC_URL,
  FEE_NUMERATOR,
  FEE_DENOMINATOR,
  FEE_PERCENT_LABEL,
  ALL_DEPLOYMENTS,
  deploymentFor,
  isLegacyChallenge,
  feeFor,
  netStakeFor,
};

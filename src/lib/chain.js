"use client";

import { ethers } from "ethers";
import { abiFor } from "@/lib/abis";
import { CONTRACT_ADDRESS, CHAIN_ID, EXPLORER, RPC_URL, deploymentFor } from "@/lib/network";

export { CONTRACT_ADDRESS, CHAIN_ID, EXPLORER };

let provider = null;
const readContracts = new Map();

/** Address for an explicit address, a challenge id (its owning contract), or the current contract. */
const resolveAddress = (idOrAddress) =>
  typeof idOrAddress === "string" && idOrAddress.startsWith("0x")
    ? idOrAddress
    : idOrAddress === undefined
    ? CONTRACT_ADDRESS
    : deploymentFor(idOrAddress).address;

/**
 * Read-only contract bound to a public RPC for the protocol's chain.
 * Independent of whatever network the user's wallet is on, so balances
 * never silently read as zero when MetaMask points elsewhere.
 * Pass a challenge id to reach the contract that owns it (old challenges live on older contracts).
 */
export function getReadContract(idOrAddress) {
  const address = resolveAddress(idOrAddress);
  if (!readContracts.has(address)) {
    provider = provider || new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
    readContracts.set(address, new ethers.Contract(address, abiFor(address), provider));
  }
  return readContracts.get(address);
}

/**
 * Signer-bound contract. Switches the wallet to the protocol chain first
 * (adding Sepolia if needed) so a single click completes the action.
 */
export async function getWriteContract(idOrAddress) {
  if (typeof window === "undefined" || !window.ethereum) {
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
    throw new Error(
      isMobile
        ? "Please open CommitX inside the MetaMask Mobile app to perform contract transactions."
        : "MetaMask is not installed. Please install the MetaMask extension to continue."
    );
  }
  const hexChain = "0x" + CHAIN_ID.toString(16);
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (parseInt(current, 16) !== CHAIN_ID) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChain }],
      });
    } catch (err) {
      if (err.code === 4902 && CHAIN_ID === 11155111) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChain,
              chainName: "Sepolia Testnet",
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: [RPC_URL],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        throw new Error("Please switch MetaMask to the Sepolia network.");
      }
    }
  }
  // Fresh provider after a possible network switch (ethers v6 rejects stale networks)
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = resolveAddress(idOrAddress);
  return new ethers.Contract(address, abiFor(address), signer);
}

/**
 * Reads the caller's position in a challenge straight from the contract.
 */
export async function readPosition(contractChallengeId, wallet) {
  const protocol = getReadContract(contractChallengeId);
  const [claimable, withdrawn, participant] = await Promise.all([
    protocol.claimable(contractChallengeId, wallet),
    protocol.hasWithdrawn(contractChallengeId, wallet),
    protocol.isParticipant(contractChallengeId, wallet),
  ]);
  return {
    claimable: claimable.toString(),
    hasWithdrawn: Boolean(withdrawn),
    isParticipant: Boolean(participant),
  };
}

/**
 * Turns ethers / MetaMask errors into a sentence a person can act on.
 */
export function friendlyTxError(err) {
  const raw =
    err?.reason || err?.shortMessage || err?.info?.error?.message || err?.message || "Transaction failed";
  const msg = String(raw);
  const lower = msg.toLowerCase();

  if (err?.code === 4001 || err?.code === "ACTION_REJECTED" || lower.includes("user rejected") || lower.includes("user denied"))
    return "You rejected the request in your wallet.";
  if (lower.includes("insufficient funds")) return "Not enough Sepolia ETH to cover the stake and gas.";
  if (msg.includes("No funds claimable")) return "There is nothing left to withdraw for this wallet on this challenge.";
  if (msg.includes("Challenge already finalized")) return "This challenge is already settled — you can withdraw your payout now.";
  if (msg.includes("Challenge still ongoing")) return "Settlement opens after the challenge end time.";
  if (msg.includes("Participant count mismatch"))
    return "Participant list is out of sync with the contract. Refresh the page and try again.";
  if (msg.includes("Invalid protocol attestor signature"))
    return "The settlement signature was rejected by the contract (attestor key mismatch).";
  if (msg.includes("Already joined")) return "You have already joined this challenge.";
  if (msg.includes("Incorrect stake amount")) return "Stake amount does not match the challenge requirement.";
  if (msg.includes("Already refunded")) return "You've already taken your refund for this challenge.";
  if (msg.includes("Not enough participants to settle"))
    return "Fewer than 2 people joined, so this challenge can't be settled — use the refund instead.";
  if (msg.includes("Challenge has enough participants")) return "This challenge has enough people, so it runs normally.";
  return msg.replace(/^execution reverted:?\s*/i, "");
}

const { ethers } = require("ethers");
const { CHAIN_ID, deploymentFor } = require("./network");

const HARDHAT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const chainId = () => CHAIN_ID;

/**
 * Wallet that signs EIP-712 settlements and invitations.
 * Only a local Hardhat chain may fall back to the well-known dev key —
 * anywhere else a missing key is a configuration error, never a silent default.
 */
function getAttestorWallet() {
  let key = process.env.PROTOCOL_ATTESTOR_PRIVATE_KEY;
  if (!key) {
    if (chainId() !== 31337) {
      throw new Error("PROTOCOL_ATTESTOR_PRIVATE_KEY is not configured on the server.");
    }
    key = HARDHAT_KEY;
  }
  return new ethers.Wallet(key.startsWith("0x") ? key : `0x${key}`);
}

/** EIP-712 domain of the contract that owns challenge `challengeId`. */
function eip712Domain(challengeId) {
  return {
    name: "CommitX",
    version: "1",
    chainId: chainId(),
    verifyingContract: deploymentFor(challengeId).address,
  };
}

module.exports = { getAttestorWallet, eip712Domain };

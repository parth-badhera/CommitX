const { ethers } = require("ethers");
const crypto = require("crypto");
const { prisma } = require("./prisma");
const { defaultName } = require("./identity");

const NONCE_TTL_MS = 10 * 60 * 1000;

function buildMessage(wallet, nonce, issuedAt) {
  return [
    "Sign in to CommitX",
    "",
    "This free signature proves you own this wallet.",
    "It does not send a transaction or cost any gas.",
    "",
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

/**
 * Issues a fresh sign-in message for a wallet and stores it as the user's nonce.
 */
async function getOrCreateNonce(walletAddress) {
  if (!ethers.isAddress(walletAddress)) throw new Error("Invalid wallet address");
  const normalized = walletAddress.toLowerCase();
  const message = buildMessage(normalized, crypto.randomBytes(16).toString("hex"), new Date().toISOString());

  await prisma.user.upsert({
    where: { walletAddress: normalized },
    update: { nonce: message },
    create: {
      walletAddress: normalized,
      nonce: message,
      username: defaultName(normalized),
    },
  });

  return message;
}

/**
 * Verifies an EIP-191 personal_sign signature against the stored message.
 * The message is single-use and expires after 10 minutes.
 */
async function verifyWalletSignature(walletAddress, signature) {
  const normalized = walletAddress.toLowerCase();
  const user = await prisma.user.findUnique({ where: { walletAddress: normalized } });

  if (!user || !user.nonce || !user.nonce.startsWith("Sign in to CommitX")) {
    throw new Error("No sign-in request found for this wallet. Please try again.");
  }

  const issued = Date.parse(user.nonce.split("Issued: ")[1]);
  if (!issued || Date.now() - issued > NONCE_TTL_MS) {
    throw new Error("This sign-in request expired. Please try again.");
  }

  let recovered;
  try {
    recovered = ethers.verifyMessage(user.nonce, signature);
  } catch {
    throw new Error("Invalid signature");
  }
  if (recovered.toLowerCase() !== normalized) {
    throw new Error("Signature does not match wallet address");
  }

  // Single use
  await prisma.user.update({ where: { walletAddress: normalized }, data: { nonce: null } });

  return { walletAddress: normalized, username: user.username };
}

module.exports = { getOrCreateNonce, verifyWalletSignature };

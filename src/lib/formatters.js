const WEI = 10n ** 18n;

/** Exact wei → decimal ETH string (dependency-free, so pages don't ship ethers). */
function formatEther(weiValue) {
  const v = BigInt(weiValue.toString());
  const abs = v < 0n ? -v : v;
  const frac = (abs % WEI).toString().padStart(18, "0").replace(/0+$/, "");
  return `${v < 0n ? "-" : ""}${abs / WEI}${frac ? "." + frac : ""}`;
}

/**
 * Format a wei string or BigInt to ETH with up to 4 decimal places
 */
function formatEth(weiValue) {
  if (!weiValue || weiValue === "0") return "0 ETH";
  try {
    const formatted = formatEther(weiValue);
    const num = parseFloat(formatted);
    // Tiny amounts (e.g. joining fees) keep enough decimals to stay visible
    const digits = num !== 0 && Math.abs(num) < 0.0001 ? 8 : 4;
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    }) + " ETH";
  } catch {
    return "0 ETH";
  }
}

/**
 * Shorten an Ethereum address (e.g. 0x1234...5678)
 */
function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format a Date to a human readable string
 */
function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Calculate human countdown
 */
function formatTimeLeft(targetDate) {
  if (!targetDate) return "";
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m left`;
}

/**
 * Calculate required peer approvals (at least 33% of cohort participants, minimum 1)
 * Examples:
 * - 2 participants   -> 1 approval
 * - 10 participants  -> 3 approvals
 * - 100 participants -> 33 approvals
 */
function getRequiredApprovals(participantCount) {
  const count = Math.max(1, Number(participantCount) || 1);
  return Math.max(1, Math.floor(count * 0.33));
}

module.exports = {
  formatEther,
  formatEth,
  shortenAddress,
  formatDate,
  formatTimeLeft,
  getRequiredApprovals,
};

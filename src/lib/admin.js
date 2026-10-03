const { getReadContract } = require("./chainSync");
const { getSessionWallet } = require("./session");

let cached = { owner: null, at: 0 };

/** The contract owner is the admin — read from chain, cached for 5 minutes. */
async function getAdminWallet() {
  if (cached.owner && Date.now() - cached.at < 5 * 60 * 1000) return cached.owner;
  const owner = (await getReadContract().owner()).toLowerCase();
  cached = { owner, at: Date.now() };
  return owner;
}

/** { wallet } when the request has a wallet session for the admin, else { response }. */
async function requireAdmin(request, NextResponse) {
  const wallet = getSessionWallet(request);
  if (!wallet) {
    return {
      response: NextResponse.json(
        { error: "Please confirm it's you by signing a free message with your wallet.", code: "WALLET_AUTH" },
        { status: 401 }
      ),
    };
  }
  if (wallet !== (await getAdminWallet())) {
    return { response: NextResponse.json({ error: "Only the CommitX admin can do this." }, { status: 403 }) };
  }
  return { wallet };
}

module.exports = { getAdminWallet, requireAdmin };

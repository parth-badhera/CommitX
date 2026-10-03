const crypto = require("crypto");

// Wallet session: proves the caller controls a wallet (via a one-time EIP-191
// signature) so API routes never trust an address sent in the request body.

const COOKIE = "cx_wallet";
const MAX_AGE_S = 7 * 24 * 60 * 60;

function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.PROTOCOL_ATTESTOR_PRIVATE_KEY) {
    return crypto.createHash("sha256").update("commitx-session:" + process.env.PROTOCOL_ATTESTOR_PRIVATE_KEY).digest("hex");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not configured");
  }
  return "commitx-dev-session-secret";
}

const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

function createSessionCookie(wallet) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `${wallet.toLowerCase()}.${exp}`;
  return {
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_S,
    },
  };
}

/** Returns the verified wallet (lowercase) for this request, or null. */
function getSessionWallet(request) {
  const raw = request.cookies?.get?.(COOKIE)?.value;
  if (!raw) return null;
  const [wallet, exp, sig] = raw.split(".");
  if (!wallet || !exp || !sig) return null;
  const expected = sign(`${wallet}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(exp) * 1000 < Date.now()) return null;
  return wallet;
}

/**
 * Ensures the request carries a session for `claimedWallet` (when given).
 * Returns { wallet } on success or { response } with a 401 the client
 * understands (code WALLET_AUTH → sign in with the wallet and retry).
 */
function requireWallet(request, claimedWallet, NextResponse) {
  const wallet = getSessionWallet(request);
  if (!wallet || (claimedWallet && wallet !== String(claimedWallet).toLowerCase())) {
    return {
      response: NextResponse.json(
        { error: "Please confirm it's you by signing a free message with your wallet.", code: "WALLET_AUTH" },
        { status: 401 }
      ),
    };
  }
  return { wallet };
}

module.exports = { COOKIE, createSessionCookie, getSessionWallet, requireWallet };

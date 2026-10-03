"use client";

// Fetch wrapper for CommitX API routes. Write endpoints require a wallet
// session; when the server answers WALLET_AUTH we ask the wallet for one free
// signature (no gas) and retry once.

const toHex = (str) =>
  "0x" +
  Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** EIP-191 personal_sign via the injected wallet — no ethers needed. */
export async function personalSign(message, address) {
  if (typeof window === "undefined" || !window.ethereum) {
    const isMobile =
      typeof navigator !== "undefined" &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");
    throw new Error(
      isMobile
        ? "Please open CommitX inside the MetaMask Mobile app to sign messages."
        : "MetaMask is not installed."
    );
  }
  try {
    return await window.ethereum.request({ method: "personal_sign", params: [toHex(message), address] });
  } catch (err) {
    if (err?.code === 4001) throw new Error("You need to sign the message in MetaMask to continue. It's free.");
    if (/not been authorized|unknown account/i.test(err?.message || "")) {
      throw new Error(`Switch MetaMask to ${address.slice(0, 6)}…${address.slice(-4)} and try again.`);
    }
    throw err;
  }
}

let inFlight = null;

/** Signs the server's one-time message and starts a 7-day wallet session. */
export async function signInWithWallet(address) {
  if (!address) throw new Error("Connect your wallet first.");
  const wallet = address.toLowerCase();
  if (inFlight?.wallet === wallet) return inFlight.promise;

  const promise = (async () => {
    const nonceRes = await fetch(`/api/auth/nonce?wallet=${wallet}`, { cache: "no-store" });
    const { nonce, error } = await nonceRes.json();
    if (!nonceRes.ok) throw new Error(error || "Couldn't start wallet sign-in.");
    const signature = await personalSign(nonce, wallet);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: wallet, signature }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Wallet sign-in failed.");
    return data.session;
  })();

  inFlight = { wallet, promise };
  try {
    return await promise;
  } finally {
    inFlight = null;
  }
}

/**
 * apiFetch(url, { method, json, wallet }) → parsed JSON, or throws Error(message).
 * `wallet` is the address acting in this request; it signs in if needed.
 */
export async function apiFetch(url, { json, wallet, ...opts } = {}) {
  const send = () =>
    fetch(url, {
      cache: "no-store",
      ...opts,
      headers: { ...(json ? { "Content-Type": "application/json" } : {}), ...opts.headers },
      body: json ? JSON.stringify(json) : opts.body,
    });

  let res = await send();
  let data = await res.json().catch(() => ({}));

  if (res.status === 401 && data.code === "WALLET_AUTH" && wallet) {
    await signInWithWallet(wallet);
    res = await send();
    data = await res.json().catch(() => ({}));
  }

  if (!res.ok || data.error) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Retries fn on failure — public RPCs can lag a few seconds behind the wallet's node. */
export async function retry(fn, { attempts = 5, delayMs = 2000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.status && err.status < 500 && err.status !== 404 && err.status !== 409) throw err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

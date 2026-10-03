// Friendly, deterministic identities for wallets — shared by server and client.

const ADJECTIVES = [
  "Swift", "Brave", "Calm", "Bold", "Bright", "Clever", "Steady", "Lucky", "Sunny", "Quiet",
  "Witty", "Keen", "Noble", "Mighty", "Gentle", "Rapid", "Cosmic", "Golden", "Silver", "Daring",
];
const ANIMALS = [
  "Otter", "Falcon", "Panda", "Fox", "Lynx", "Koala", "Heron", "Tiger", "Owl", "Dolphin",
  "Wolf", "Raven", "Bison", "Gecko", "Puffin", "Badger", "Orca", "Hawk", "Moose", "Lemur",
];

/** 32-bit FNV-1a hash. */
function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32) → returns () => [0,1). */
function rng(seed) {
  let a = hash(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "Swift Otter" for a wallet address. */
function defaultName(wallet) {
  const r = rng(String(wallet || "").toLowerCase());
  return `${ADJECTIVES[Math.floor(r() * ADJECTIVES.length)]} ${ANIMALS[Math.floor(r() * ANIMALS.length)]}`;
}

const PLACEHOLDER = /^(Participant|Member|Verifier|Creator|User)_[0-9a-f]{4}$/i;

/** Best name to show for a user record / wallet. */
function displayName(user, wallet) {
  const name = user?.username || user?.name;
  if (name && !PLACEHOLDER.test(name)) return name;
  return defaultName(wallet || user?.walletAddress);
}

const isValidAvatar = (v) => typeof v === "string" && (/^gen:[a-z0-9-]{1,40}$/i.test(v) || /^https:\/\//.test(v));

module.exports = { hash, rng, defaultName, displayName, isValidAvatar };

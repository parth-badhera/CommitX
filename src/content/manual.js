// Single source of truth for the beginner guide.
// Used by the /learn page and by scripts/manual/build-manual.js (PDF).
// Text supports **bold** only.

const MANUAL_VERSION = "1.0";

const LINKS = {
  metamask: "https://metamask.io/download/",
  faucets: [
    { label: "Google Cloud Web3 faucet", href: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
    { label: "Alchemy Sepolia faucet", href: "https://www.alchemy.com/faucets/ethereum-sepolia" },
    { label: "Infura Sepolia faucet", href: "https://www.infura.io/faucet/sepolia" },
  ],
  etherscan: "https://sepolia.etherscan.io",
};

const CHAPTERS = [
  {
    id: "before",
    part: "Get set up",
    title: "Before you start",
    time: "1 min",
    summary:
      "CommitX lets you put a small amount of ETH behind a goal. To take part you need a crypto wallet (MetaMask) and some free test ETH. Everything happens on **Sepolia**, a practice network — the ETH there has no real-world value, so you can learn without risk.",
    steps: [
      "A computer with **Chrome, Brave, Edge or Firefox**.",
      "About **10 minutes** for the one-time setup.",
      "A pen and paper to write down your wallet's recovery phrase.",
    ],
    tip: "You never send money to CommitX itself. Your stake goes into a public smart contract, and only you can withdraw your payout.",
  },
  {
    id: "install",
    part: "Get set up",
    title: "Install MetaMask",
    time: "2 min",
    summary: "MetaMask is a free browser extension that holds your wallet and asks your permission before anything is signed or sent.",
    steps: [
      "Go to **metamask.io/download** — type it yourself rather than clicking ads or search results.",
      "Choose your browser and click **Install MetaMask** (or **Add to Chrome**).",
      "Click **Add extension** in the browser prompt.",
      "Pin it: click the puzzle-piece icon in your toolbar and pin the **fox** so it's always one click away.",
    ],
    warning: "Fake MetaMask sites and extensions exist. Only install from metamask.io, and check the publisher is MetaMask.",
    links: [{ label: "metamask.io/download", href: LINKS.metamask }],
  },
  {
    id: "wallet",
    part: "Get set up",
    title: "Create your wallet",
    time: "3 min",
    summary:
      "Your wallet is protected by a **Secret Recovery Phrase** — 12 words that can restore it on any device. Whoever has these words owns the wallet.",
    steps: [
      "Open MetaMask and choose **Create a new wallet**. Accept the terms.",
      "Set a **password**. This only unlocks MetaMask on this computer.",
      "Choose **Secure my wallet** and reveal your 12-word **Secret Recovery Phrase**.",
      "Write the words on paper, **in order**. Keep it somewhere safe and offline.",
      "Confirm by filling in the missing words. Your wallet is ready.",
    ],
    warning:
      "Never type your recovery phrase into a website, never screenshot it, and never share it — not with CommitX, not with MetaMask “support”. No real service will ever ask for it.",
  },
  {
    id: "sepolia",
    part: "Get set up",
    title: "Switch to the Sepolia test network",
    time: "1 min",
    summary: "CommitX runs on Sepolia. The quickest way: let CommitX switch for you.",
    steps: [
      "**Easiest:** open CommitX. If your wallet is on the wrong network you'll see a yellow banner — click **Switch network** and approve in MetaMask.",
      "**Manually:** open MetaMask, click the **network menu** at the top-left, turn on **Show test networks**, then pick **Sepolia**.",
    ],
    tip: "MetaMask's layout changes between versions, so labels may differ slightly. Look for the network selector near the top of the window.",
  },
  {
    id: "faucet",
    part: "Get set up",
    title: "Get free test ETH",
    time: "2 min",
    summary:
      "A **faucet** is a website that gives out free Sepolia ETH. You need enough for your stake plus a little for **gas** (network fees, usually well under 0.005 ETH per action).",
    steps: [
      "In MetaMask, click your account address at the top to **copy** it (it starts with 0x).",
      "Open one of the faucets below and paste your address.",
      "Complete the faucet's check and request ETH. It usually arrives within a minute.",
      "Check MetaMask — your Sepolia balance should go up.",
    ],
    tip: "Some faucets ask you to sign in or have a small balance on the main Ethereum network. If one doesn't work, try another.",
    links: LINKS.faucets,
  },
  {
    id: "connect",
    part: "Use CommitX",
    title: "Connect to CommitX",
    time: "1 min",
    summary: "Sign in so your progress is saved, then link your wallet so you can stake and get paid.",
    steps: [
      "Click **Sign in** (top-right) and continue with Google — or use the demo account to look around.",
      "Click **Connect wallet**. In the MetaMask popup, pick your account and click **Connect**.",
      "Click **Sign to link MetaMask**. This signature is free and doesn't send a transaction.",
    ],
    tip: "The Learn page has a live checklist that tells you exactly which step you're missing.",
  },
  {
    id: "join",
    part: "Use CommitX",
    title: "Join or create a challenge",
    time: "2 min",
    summary: "Every challenge has a stake, a start and end time, a proof frequency and a qualification threshold.",
    steps: [
      "Open **Explore** and pick a challenge. Read what counts as proof before you join.",
      "Click **Stake & join**. MetaMask shows the stake plus the gas fee — click **Confirm**. A **0.125% joining fee** comes out of your stake and isn't refunded.",
      "Or click **New challenge** and follow the five steps: basics, schedule, stakes, people and launch.",
      "Joining closes when the challenge starts, and challenges can't be cancelled. If fewer than **2 people** join, the challenge can't run — you take your stake back minus the 0.125% fee.",
    ],
  },
  {
    id: "prove",
    part: "Use CommitX",
    title: "Prove your progress",
    time: "Each period",
    summary:
      "The challenge is split into **periods** (for example one per day). Submit proof once per period, then help review your cohort.",
    steps: [
      "Open the challenge and go to **Submit proof**. Paste a link — a GitHub commit, a Strava run, a photo or doc — and add a short note.",
      "Go to **Verify** → **Needs my vote** and review other people's proof. Approve it if it meets the rules; reject it if it doesn't.",
      "A proof counts once about **a third of the cohort** approves it. You can't vote on your own proof.",
    ],
    tip: "Every verified period keeps a slice of your stake. Missing a period sends that slice to the shared penalty pool.",
  },
  {
    id: "withdraw",
    part: "Use CommitX",
    title: "Settle & withdraw your payout",
    time: "1 min",
    summary: "When the end date passes, the challenge is settled on-chain and each person pulls their own payout.",
    steps: [
      "Open the challenge after it ends. If it isn't settled yet, click **Settle & unlock payouts** — anyone in the challenge can do this.",
      "Once settled, a **Payout ready** card appears. Click **Withdraw to wallet** and confirm in MetaMask.",
      "You can also withdraw everything from **Dashboard → Ready to withdraw**.",
    ],
    tip: "Your payout = the share of your stake you kept (stake after the 0.125% fee × verified periods ÷ total periods) + a share of the penalty pool if you reached the qualification threshold.",
  },
];

const FAQ = [
  {
    q: "I see a “wrong network” banner.",
    a: "Click **Switch network** in the banner and approve it in MetaMask. CommitX only works on Sepolia.",
  },
  {
    q: "MetaMask says “insufficient funds”.",
    a: "You need the stake **plus** a bit extra for gas. Get more Sepolia ETH from a faucet and try again.",
  },
  {
    q: "The MetaMask popup didn't appear.",
    a: "Click the fox icon in your toolbar — the request may be waiting there. Also check your browser isn't blocking popups.",
  },
  {
    q: "My transaction has been pending for ages.",
    a: "Sepolia is sometimes slow. Give it a few minutes. In MetaMask's Activity tab you can choose **Speed up**.",
  },
  {
    q: "I can't see a Withdraw button.",
    a: "The challenge must be settled first — click **Settle & unlock payouts**. Also make sure MetaMask is on the same account you joined with, then press the refresh icon on **Your position**.",
  },
  {
    q: "I clicked Reject in MetaMask by accident.",
    a: "Nothing happened and nothing was spent. Just click the button in CommitX again.",
  },
  {
    q: "I lost my recovery phrase.",
    a: "If you're still logged in to MetaMask, reveal and write it down now (Settings → Security & privacy). If you've lost both, nobody can recover the wallet — which is why it must be written down.",
  },
  {
    q: "Is this real money?",
    a: "No. Sepolia ETH is test currency with no value. It's the safe way to try CommitX.",
  },
];

const GLOSSARY = [
  ["Wallet", "An app (like MetaMask) that holds your keys and approves transactions."],
  ["Address", "Your public account number, starting with 0x. Safe to share."],
  ["Recovery phrase", "12 secret words that restore your wallet. Never share it."],
  ["Sepolia", "An Ethereum test network. Its ETH is free and worthless."],
  ["Gas", "A small network fee paid for every transaction."],
  ["Stake", "The ETH you lock into a challenge. A 0.125% joining fee comes out of it."],
  ["Period", "One proof window, e.g. a day. The challenge has a fixed number of them."],
  ["Threshold", "The % of periods you must complete to share the penalty pool."],
  ["Penalty pool", "Stake forfeited by missed periods, shared among qualifiers."],
  ["Settlement", "The on-chain step that fixes everyone's payout after the end date."],
  ["Withdraw", "Pulling your payout from the contract to your wallet."],
];

module.exports = { MANUAL_VERSION, LINKS, CHAPTERS, FAQ, GLOSSARY };

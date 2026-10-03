// Content of the CommitX technical documentation (rendered by build-techdoc.js).
// Plain HTML strings; keep facts in sync with the code.

const deployments = require("../../src/config/deployments");

const CURRENT = deployments.CURRENT;
const LEGACY = deployments.LEGACY_DEPLOYMENTS || [];

// ───────────────────────────── Diagrams (inline SVG) ─────────────────────────────

const box = (x, y, w, h, title, sub, fill = "#F5F5F0", stroke = "#D9D8D1") => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}"/>
  <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 4 : h / 2 + 4)}" text-anchor="middle" font-size="12" font-weight="700" fill="#111">${title}</text>
  ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" text-anchor="middle" font-size="9.5" fill="#5E5D58">${sub}</text>` : ""}`;
const arrow = (x1, y1, x2, y2, label = "", dash = false) => `
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#6B5BE0" stroke-width="1.6" ${dash ? 'stroke-dasharray="5 4"' : ""} marker-end="url(#ah)"/>
  ${label ? `<text x="${(x1 + x2) / 2 + 4}" y="${(y1 + y2) / 2 - 5}" font-size="9" fill="#6B5BE0" text-anchor="middle">${label}</text>` : ""}`;
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6B5BE0"/></marker></defs>`;

const ARCH = `<svg viewBox="0 0 700 360" class="diagram">${defs}
  ${box(20, 20, 170, 60, "Browser (Next.js UI)", "React 18 · contexts · MetaMask")}
  ${box(20, 150, 170, 60, "MetaMask", "EIP-1193 · signs txs & messages", "#FFF4E8", "#F5C9A0")}
  ${box(265, 20, 190, 60, "Next.js API routes", "Node runtime · Prisma · sessions")}
  ${box(265, 150, 190, 60, "Attestor key (server)", "EIP-712 settlement & invites", "#F1EEFF", "#C9C0F5")}
  ${box(265, 280, 190, 60, "Database", "SQLite (local) · Postgres (Vercel)")}
  ${box(520, 20, 160, 60, "Sepolia RPC", "public / Alchemy / Infura")}
  ${box(520, 150, 160, 60, "CommitXProtocol", "Solidity 0.8.24 · OZ v5", "#F6FFD6", "#C6E07A")}
  ${box(520, 280, 160, 60, "Supabase Auth", "Google OAuth (optional)")}
  ${arrow(190, 50, 265, 50, "fetch /api")}
  ${arrow(105, 80, 105, 150, "sign")}
  <polyline points="105,210 105,245 600,245 600,214" fill="none" stroke="#6B5BE0" stroke-width="1.6" marker-end="url(#ah)"/>
  <text x="400" y="240" font-size="9" fill="#6B5BE0" text-anchor="middle">transactions (stake, settle, withdraw, refund)</text>
  ${arrow(455, 50, 520, 50, "reads")}
  ${arrow(360, 80, 360, 150, "")}
  ${arrow(360, 80, 360, 280, "", true)}
  ${arrow(600, 80, 600, 150, "")}
  ${arrow(455, 310, 520, 310, "session", true)}
</svg>`;

const LIFECYCLE = `<svg viewBox="0 0 700 210" class="diagram">${defs}
  ${box(10, 80, 110, 50, "OPEN", "joining allowed", "#F6FFD6", "#C6E07A")}
  ${box(170, 80, 110, 50, "ACTIVE", "prove & review")}
  ${box(330, 80, 120, 50, "VERIFICATION", "ended, unsettled", "#F1EEFF", "#C9C0F5")}
  ${box(510, 20, 170, 50, "FINALIZED", "payouts claimable", "#E8FFF2", "#9FE0BD")}
  ${box(510, 140, 170, 50, "CANCELLED", "under-filled → refund", "#FFF1EE", "#F5C6BD")}
  ${arrow(120, 105, 170, 105, "startTime")}
  ${arrow(280, 105, 330, 105, "endTime")}
  ${arrow(450, 95, 510, 50, "finalizeChallenge")}
  ${arrow(120, 120, 510, 165, "start with < 2 people → claimUnderfilledRefund", true)}
</svg>`;

const SETTLE_SEQ = `<svg viewBox="0 0 700 330" class="diagram">${defs}
  ${["Participant", "Browser", "API /attestation", "Attestor key", "Contract"].map((t, i) => `
    <text x="${70 + i * 140}" y="18" text-anchor="middle" font-size="11" font-weight="700">${t}</text>
    <line x1="${70 + i * 140}" y1="26" x2="${70 + i * 140}" y2="320" stroke="#D9D8D1" stroke-dasharray="3 3"/>`).join("")}
  ${arrow(70, 50, 210, 50, "Settle & unlock payouts")}
  ${arrow(210, 80, 350, 80, "POST /api/attestation/:id")}
  <text x="355" y="108" font-size="9" fill="#5E5D58">sync status · read on-chain participants</text>
  <text x="355" y="121" font-size="9" fill="#5E5D58">count verified periods (non-voided votes)</text>
  <text x="355" y="134" font-size="9" fill="#5E5D58">removed participants → 0 periods · sort</text>
  ${arrow(350, 150, 490, 150, "signTypedData(Settlement)")}
  ${arrow(490, 175, 350, 175, "signature")}
  ${arrow(350, 200, 210, 200, "{addresses, periods, nonce, sig}")}
  ${arrow(210, 230, 630, 230, "finalizeChallenge(...)  — wallet signs tx")}
  <text x="520" y="252" font-size="9" fill="#5E5D58" text-anchor="middle">verify order · ECDSA.recover == attestor · math</text>
  ${arrow(70, 285, 630, 285, "withdraw(id)  → ETH to wallet")}
</svg>`;

const ERD = `<svg viewBox="0 0 700 330" class="diagram">${defs}
  ${box(20, 20, 150, 56, "User", "wallet · name · avatar · reputation")}
  ${box(275, 20, 150, 56, "Challenge", "contractChallengeId · schedule · status")}
  ${box(530, 20, 150, 56, "Invitation", "wallet | token · status")}
  ${box(20, 135, 150, 56, "Participant", "completedPeriods · disqualifiedAt")}
  ${box(275, 135, 150, 56, "Period", "periodNumber · start/end")}
  ${box(530, 135, 150, 56, "SettlementArtifact", "digest · signature · totals")}
  ${box(275, 250, 150, 56, "Proof", "contentUri · note · status")}
  ${box(20, 250, 150, 56, "Verification", "decision · voided")}
  ${box(530, 250, 150, 56, "Complaint", "reporter → accused · outcome")}
  ${arrow(350, 76, 350, 135, "1:n")}
  ${arrow(275, 60, 170, 150, "1:n")}
  ${arrow(425, 48, 530, 48, "1:n")}
  ${arrow(425, 60, 530, 150, "1:1")}
  ${arrow(350, 191, 350, 250, "1:n")}
  ${arrow(275, 278, 170, 278, "1:n")}
  ${arrow(95, 76, 95, 135, "1:n")}
  ${arrow(530, 278, 425, 278, "refers", true)}
</svg>`;

// ───────────────────────────── Sections ─────────────────────────────

const sections = [
  {
    id: "summary",
    title: "Executive summary",
    html: `
<p><b>CommitX</b> is a non-custodial accountability platform on Ethereum (Sepolia testnet). People commit to a goal, stake ETH in a smart contract,
prove progress every period, get verified by the other participants, and are paid out by a deterministic on-chain settlement: you keep the share of your
stake you earned, and people who finish enough of the challenge split what the others forfeited.</p>
<div class="grid2">
  <div class="card"><h4>What makes it interesting</h4><ul>
    <li>Hybrid design: verification is off-chain (cheap, flexible), money is on-chain (trust-minimised).</li>
    <li>EIP-712 signed settlement — the backend proposes results, the contract verifies the signature and does all money math.</li>
    <li>Exact integer-wei accounting with a provable conservation invariant.</li>
    <li>Peer review with moderation: complaints, reputation, suspension and removal.</li>
  </ul></div>
  <div class="card"><h4>Stack</h4><table class="kv">
    <tr><td>Contract</td><td>Solidity 0.8.24 (viaIR, cancun), OpenZeppelin v5, Hardhat</td></tr>
    <tr><td>App</td><td>Next.js 14 App Router, React 18, Tailwind CSS 3</td></tr>
    <tr><td>Web3</td><td>ethers v6 (only where transactions happen), raw EIP-1193 elsewhere</td></tr>
    <tr><td>Data</td><td>Prisma 5 · SQLite locally · PostgreSQL in production</td></tr>
    <tr><td>Auth</td><td>Wallet signature sessions (EIP-191 + HMAC cookie); optional Google via Supabase</td></tr>
    <tr><td>Deploy</td><td>Vercel (serverless) or Docker (standalone server)</td></tr>
  </table></div>
</div>
<h3>Live deployment (Sepolia, chain 11155111)</h3>
<table><tr><th>Contract</th><th>Address</th><th>Challenge IDs</th><th>Features</th></tr>
<tr><td>Current (v3)</td><td class="mono">${CURRENT.address}</td><td>${CURRENT.firstChallengeId}+</td><td>0.125% fee, under-filled refund, admin account lock</td></tr>
${LEGACY.map((d) => `<tr><td>Previous</td><td class="mono">${d.address}</td><td>${d.firstChallengeId}–${CURRENT.firstChallengeId - 1}</td><td>${d.hasFee ? "0.125% fee" : "no fee"}${d.hasLock ? ", lock" : ""}</td></tr>`).join("")}
</table>`,
  },
  {
    id: "theory",
    title: "Problem & theory",
    html: `
<h3>The problem</h3>
<p>People routinely fail at goals they genuinely want (exercise, study, shipping code). Behavioural economics explains why:</p>
<ul>
  <li><b>Present bias / hyperbolic discounting</b> — the cost of effort is now, the benefit is later, so "tomorrow" always wins.</li>
  <li><b>Loss aversion</b> — losses weigh roughly twice as much as equal gains (Kahneman & Tversky). Losing a stake motivates more than an equal reward.</li>
  <li><b>Commitment devices</b> — voluntarily restricting your future options (StickK, Beeminder) measurably improves follow-through.</li>
  <li><b>Social accountability</b> — being observed by peers increases compliance.</li>
</ul>
<p>CommitX combines all four: a <b>stake</b> (loss aversion + commitment), a fixed <b>schedule of periods</b> (small, frequent wins), and <b>peer verification</b> (social accountability).</p>
<h3>Why a blockchain?</h3>
<p>A commitment device only works if the money is credibly at risk and the payout rules can't be changed afterwards. A smart contract gives:
custody nobody can run away with, rules published in code, and payouts anyone can audit. Traditional platforms require trusting the company with
both your money and the judging.</p>
<h3>Mechanism design</h3>
<ul>
  <li><b>Proportional retention:</b> each verified period keeps <span class="mono">1/T</span> of your stake — progress is always rewarded, so dropping out early never becomes "rational".</li>
  <li><b>Penalty pool:</b> missed periods fund a pool split among <b>qualifiers</b> (≥ threshold %), weighted by periods completed — finishing is strictly better than partially finishing.</li>
  <li><b>Zero-qualifier rule:</b> if nobody qualifies, the pool goes to the treasury. This prevents collusion like "everyone skips and we share the pool".</li>
  <li><b>Peer review incentives:</b> reviews earn reputation (+2); wrong reviews and false complaints cost reputation (−10) and can cost the stake (removal).</li>
  <li><b>Minimum two people:</b> a lone participant can't be verified, so an under-filled challenge returns the stake (minus the fee) instead of running.</li>
</ul>`,
  },
  {
    id: "architecture",
    title: "System architecture",
    html: `
${ARCH}
<p class="caption">Solid arrows: runtime calls. Dashed: data/auth relationships.</p>
<h3>Hybrid on-chain / off-chain split</h3>
<table><tr><th>On-chain (contract)</th><th>Off-chain (Next.js + DB)</th></tr>
<tr><td>Custody of every wei, joins, fees, settlement math, withdrawals, refunds, attestor signature check, replay protection</td>
<td>Challenge metadata, period schedule, proofs, votes, complaints, reputation, profiles, invitations, notifications</td></tr></table>
<p><b>Why:</b> storing proofs and votes on-chain would cost gas for every action and expose personal links publicly. The expensive, trust-critical part (money)
stays on-chain; the cheap, flexible part (judgement) stays off-chain and is <b>summarised</b> into one signed message at settlement.</p>
<h3>Trust model</h3>
<table><tr><th>Component</th><th>Can</th><th>Cannot</th></tr>
<tr><td>Backend / attestor</td><td>Sign which participants completed how many periods</td><td>Move funds, change stakes or rules, settle twice, sign for a different contract/chain</td></tr>
<tr><td>Admin (contract owner)</td><td>Rotate attestor/treasury, lock accounts, claim treasury balance, moderate complaints</td><td>Withdraw participants' stakes or payouts</td></tr>
<tr><td>Participants</td><td>Stake, prove, review, report, trigger settlement, withdraw their own funds</td><td>Vote on their own proof, vote twice, act as another wallet</td></tr></table>
<p>The residual trust is the attestor: a compromised key could sign wrong period counts (though never move funds directly). Mitigations and alternatives are discussed in <i>Security</i>.</p>`,
  },
  {
    id: "contract",
    title: "Smart contract: CommitXProtocol",
    html: `
<h3>State</h3>
<pre>struct Challenge {
  uint256 id; address creator; uint256 stakeAmount;   // stake per participant (wei)
  uint16 totalPeriods; uint8 qualificationThreshold;   // e.g. 30 periods, 50%
  uint32 startTime; uint32 endTime; uint32 verificationDuration;
  uint16 maxParticipants; uint16 participantCount;
  uint256 settlementNonce;                             // EIP-712 replay protection
  ChallengeStatus status; bool finalized; bool isPrivate; string metadataURI;
}
mapping(uint256 =&gt; Challenge) challenges;
mapping(uint256 =&gt; mapping(address =&gt; bool)) isParticipant, hasWithdrawn, isWhitelisted;
mapping(uint256 =&gt; mapping(address =&gt; uint256)) claimable;   // pull-payment ledger
mapping(address =&gt; bool) isLocked;                              // admin lock (v3)
uint256 treasuryBalance, totalFeesCollected, totalDeposited, totalSettledAmount, totalWithdrawnAmount;</pre>
<p>Struct fields are packed (<span class="mono">uint16/uint32/uint8</span>) so several share one storage slot — fewer SSTOREs on creation.</p>
<h3>Lifecycle</h3>
${LIFECYCLE}
<p><span class="mono">getCurrentStatus()</span> derives OPEN/ACTIVE/VERIFICATION from timestamps, so no transaction is needed to "start" a challenge.</p>
<h3>External functions</h3>
<table><tr><th>Function</th><th>Who</th><th>Purpose / key checks</th></tr>
<tr><td class="mono">createChallenge(...)</td><td>anyone</td><td>start in future, end &gt; start, threshold 1–100, max ≥ 2; optional auto-join if <span class="mono">msg.value == stake</span></td></tr>
<tr><td class="mono">joinChallenge(id)</td><td>anyone</td><td>OPEN, before start, not full, not joined, exact stake, whitelist if private</td></tr>
<tr><td class="mono">joinChallengeWithAuthorization(id, sig)</td><td>invitee</td><td>private join with an EIP-712 <span class="mono">Invitation(challengeId, participant)</span> signed by creator or attestor</td></tr>
<tr><td class="mono">finalizeChallenge(id, nonce, addrs[], periods[], sig)</td><td>anyone</td><td>after end, ≥ 2 participants, strictly ascending enrolled addresses, periods ≤ T, valid attestor signature, matching nonce</td></tr>
<tr><td class="mono">withdraw(id)</td><td>participant</td><td>pull payment; not locked; zero-before-transfer (CEI) + nonReentrant</td></tr>
<tr><td class="mono">claimUnderfilledRefund(id)</td><td>participant</td><td>after start with &lt; 2 participants: returns stake − fee; marks CANCELLED</td></tr>
<tr><td class="mono">withdrawTreasury(amount)</td><td>treasury</td><td>fees + zero-qualifier pools + rounding dust</td></tr>
<tr><td class="mono">setAccountLock / setProtocolAttestor / setTreasury</td><td>owner</td><td>administration</td></tr>
<tr><td class="mono">whitelistParticipants / revokeWhitelist</td><td>creator</td><td>private access before start</td></tr></table>
<h3>Settlement math (exact integer wei)</h3>
<pre>fee        = stake × 125 / 100000                 (0.125%, taken at join → treasury)
S          = stake − fee                          (net stake used for settlement)
retained_i = S × c_i / T                          (c_i = verified periods of i)
pool       = Σ (S − retained_i)
qualifier  ⇔ c_i × 100 ≥ threshold × T            (integer comparison, no division)
reward_i   = pool × c_i / Σ c_q   (qualifiers only)
claimable_i = retained_i + reward_i
treasury  += pool − Σ reward_i                    (zero-qualifier pool, or rounding dust)</pre>
<div class="callout"><b>Worked example.</b> Stake 0.1 ETH → fee 0.000125, S = 0.099875. T = 10, threshold 50%. Completed: A 10, B 9, C 7, D 2.
Retained: 0.099875, 0.0898875, 0.0699125, 0.019975. Pool = 0.1198500. Qualifiers A, B, C (weights 26).
Rewards: A 0.0460962, B 0.0414865, C 0.0322673; D 0. Sum of claimables + dust = 4·S exactly; plus 4 fees = 4 stakes deposited.</div>
<h3>Conservation invariant</h3>
<p>For every finalized challenge: <span class="mono">Σ claimable + treasuryCut + Σ fees = n × stake</span>. Floor division always rounds <i>down</i>, and the
remainder is assigned to the treasury, so the contract can never owe more than it holds. The test suite asserts this to the wei.</p>
<h3>EIP-712 typed data</h3>
<pre>Domain:     { name: "CommitX", version: "1", chainId: 11155111, verifyingContract: &lt;contract&gt; }
Settlement: (uint256 challengeId, uint256 settlementNonce, address[] participants, uint256[] completedPeriods)
Invitation: (uint256 challengeId, address participant)</pre>
<p>Arrays are hashed as <span class="mono">keccak256(abi.encodePacked(elements as 32-byte words))</span>, matching the EIP-712 spec for dynamic arrays.
Binding <span class="mono">chainId</span> and <span class="mono">verifyingContract</span> prevents cross-chain and cross-contract replay; the per-challenge
<span class="mono">settlementNonce</span> (incremented on finalize) plus <span class="mono">finalized</span> prevents re-use.</p>
<h3>Canonical ordering</h3>
<p>The contract requires participant addresses in strictly ascending order. One check (<span class="mono">p &gt; last</span>) proves there are no duplicates,
and the signer and verifier agree on a single canonical array, so the signature is deterministic.</p>
<h3>Security patterns</h3>
<ul>
  <li><b>Pull payments:</b> settlement only writes balances; each user withdraws. One failing recipient can't block others; no loops send ETH.</li>
  <li><b>Checks-Effects-Interactions + ReentrancyGuard</b> on every function that sends ETH.</li>
  <li><b>Custom roles:</b> Ownable (admin), attestor, treasury, creator — least privilege.</li>
  <li><b>Exact-value joins</b> (<span class="mono">msg.value == stake</span>) — no change to refund, no accounting drift.</li>
</ul>
<h3>Versions</h3>
<p>v1 (no fee) → v2 (0.125% fee, under-filled refund, IDs from 1001) → v3 (admin account lock, IDs from 2001). Deployed contracts are immutable,
so new versions are deployed alongside; <span class="mono">src/config/deployments.js</span> maps ID ranges to contracts and the app routes each challenge to its
own contract. The deploy script picks a non-colliding first ID automatically and keeps older contracts routable.</p>`,
  },
  {
    id: "backend",
    title: "Backend",
    html: `
<p>The backend is the set of Next.js App Router route handlers under <span class="mono">src/app/api</span>, running on Node with Prisma. It never holds funds.</p>
<h3>API surface</h3>
<table><tr><th>Route</th><th>Method</th><th>Auth</th><th>Purpose</th></tr>
<tr><td class="mono">/api/auth/nonce · /verify · /session</td><td>GET/POST/DELETE</td><td>—</td><td>Wallet sign-in (one-time message → HMAC session cookie)</td></tr>
<tr><td class="mono">/api/challenges</td><td>GET/POST</td><td>— (POST verified on-chain)</td><td>List (with chain sync) · register metadata for an on-chain challenge</td></tr>
<tr><td class="mono">/api/challenges/:id</td><td>GET</td><td>—</td><td>Detail; self-heals from chain if missing; redacts invite tokens</td></tr>
<tr><td class="mono">/api/challenges/:id/join</td><td>POST</td><td>verified on-chain</td><td>Mirror an enrolment that exists on-chain</td></tr>
<tr><td class="mono">/api/challenges/:id/authorize-join</td><td>POST</td><td>invite + reputation</td><td>EIP-712 invitation signature for private joins</td></tr>
<tr><td class="mono">/api/challenges/:id/invitations[/:inviteId]</td><td>GET/POST/DELETE</td><td>creator session</td><td>Manage invites (before start only)</td></tr>
<tr><td class="mono">/api/proofs</td><td>GET/POST</td><td>wallet session</td><td>Submit proof (open period, one per period) · list</td></tr>
<tr><td class="mono">/api/verifications</td><td>POST</td><td>wallet session</td><td>Approve/reject a peer's proof</td></tr>
<tr><td class="mono">/api/attestation/:id</td><td>POST</td><td>—</td><td>Build & sign the settlement</td></tr>
<tr><td class="mono">/api/complaints · /api/reputation</td><td>POST · GET</td><td>session · —</td><td>Report a vote/person · reputation lookup</td></tr>
<tr><td class="mono">/api/admin/complaints[/:id] · /participants</td><td>GET/POST</td><td>admin session</td><td>Moderation</td></tr>
<tr><td class="mono">/api/profile · /api/stats · /api/health</td><td>GET/POST</td><td>session for POST</td><td>Profile · protocol stats · liveness</td></tr></table>
<h3>Data model</h3>
${ERD}
<p>Wallet addresses are stored lowercase and used as natural keys between tables. Indexes cover the hot lookups (proofs by period+participant,
participants by wallet, complaints by accused/status, reputation events by wallet+time).</p>
<h3>Authentication: wallet sessions</h3>
<ol>
  <li><span class="mono">GET /api/auth/nonce</span> stores a human-readable message with a random nonce and timestamp on the user row.</li>
  <li>The browser calls <span class="mono">personal_sign</span> (EIP-191) through MetaMask — free, no transaction.</li>
  <li><span class="mono">POST /api/auth/verify</span> recovers the signer with <span class="mono">ethers.verifyMessage</span>, checks it matches, enforces a 10-minute TTL,
  clears the nonce (single use) and sets <span class="mono">cx_wallet = wallet.exp.HMAC_SHA256(secret)</span> — httpOnly, SameSite=Lax, Secure in production, 7 days.</li>
  <li>Write endpoints call <span class="mono">requireWallet(request, claimedWallet)</span>; a mismatch returns 401 <span class="mono">WALLET_AUTH</span>,
  which the client's <span class="mono">apiFetch</span> answers by signing in and retrying once.</li>
</ol>
<p>Timing-safe comparison is used for the HMAC. The server never trusts an address from the request body.</p>
<h3>Chain sync (the contract is the source of truth)</h3>
<ul>
  <li>Reads <span class="mono">getChallenge</span> + <span class="mono">getCurrentStatus</span> through a JSON-RPC provider, routed to the challenge's own contract.</li>
  <li>15-second in-memory cache, 4-second timeout per RPC call (a slow node can't hang a page), settled/cancelled challenges skip RPC entirely.</li>
  <li>If a challenge exists on-chain but not in the DB (tab closed mid-create), it is rebuilt from on-chain data on first view (<i>self-heal</i>).</li>
  <li>Economic fields (creator, stake, schedule, capacity, privacy) are always taken from the contract, never from the request.</li>
</ul>
<h3>Attestation pipeline</h3>
${SETTLE_SEQ}
<ol>
  <li>Re-sync status and nonce from chain; refuse if settled, cancelled or before end.</li>
  <li>Read the participant list <b>from the contract</b> (the DB may have drifted) and backfill missing rows.</li>
  <li>For every proof, count non-voided votes from enrolled, non-self, de-duplicated verifiers; approved if ≥ ⌊0.33n⌋ (min 1) and approvals &gt; rejections.</li>
  <li>Count <b>distinct periods</b> per participant (multiple proofs in one period count once); removed participants get 0.</li>
  <li>Sort canonically, compute the accounting preview, sign <span class="mono">Settlement</span>, persist a <span class="mono">SettlementArtifact</span> (digest, signature, totals) for audit.</li>
</ol>
<h3>Proof & review rules</h3>
<ul>
  <li>Proof: wallet session, participant, not removed, not suspended, challenge not settled, period currently open (+5 min grace), one per period, https link required.</li>
  <li>Review: wallet session, participant of the same challenge, not the proof owner, not removed, not suspended, one vote per proof (DB unique constraint).</li>
  <li>Each vote re-scores the proof and updates the owner's <span class="mono">completedPeriods</span>.</li>
</ul>`,
  },
  {
    id: "moderation",
    title: "Moderation & reputation",
    html: `
<h3>Complaints</h3>
<p>Any participant can report a specific vote (approved invalid proof / rejected valid proof) or a participant. Reports need a 10–1000 character explanation;
duplicates and more than 10 open reports per person are refused. Only the <b>admin</b> (the contract <span class="mono">owner()</span>, read from chain) can resolve them.</p>
<table><tr><th>Admin action</th><th>Effect</th></tr>
<tr><td>Uphold</td><td>Vote voided → proof re-scored → voter −10 reputation</td></tr>
<tr><td>Uphold & remove</td><td>Same + voter removed from the challenge</td></tr>
<tr><td>False report</td><td>Reporter −10 reputation</td></tr>
<tr><td>False & remove</td><td>Same + reporter removed from the challenge</td></tr>
<tr><td>Dismiss</td><td>No penalty</td></tr></table>
<h3>Removal (forfeit without refund)</h3>
<p>A removed participant can no longer submit proof, review or report in that challenge. At settlement the attestor assigns them <b>0 completed periods</b>,
so the contract computes <span class="mono">retained = 0</span> and no reward: their whole net stake flows into the penalty pool for honest qualifiers
(or the treasury). No contract change was needed — the penalty is expressed through the signed settlement the contract already trusts. Removal is
refused once a challenge is settled (payouts are final), and can be undone (reinstate) before settlement.</p>
<h3>Reputation</h3>
<pre>start      100   (range 0–100, stored on User, every change logged in ReputationEvent)
+2         each review cast
−10        upheld complaint against your vote, or your complaint ruled false
&lt; 25       SUSPENDED: no joining, creating, submitting, reviewing or reporting
recovery   every full 4 days below 25 → +2 automatically, until back at 25
levels     ≥80 Trusted · ≥50 Fair · ≥25 At risk · &lt;25 Suspended</pre>
<p>Recovery is computed lazily: on any read, the server applies the +2 ticks owed since <span class="mono">lowSince</span> and logs them — no cron job needed
(important on serverless). Enforcement is server-side on every write endpoint and in the UI; joining/creating are on-chain actions, so the app blocks them in
the UI and refuses private-join signatures, while a suspended user who bypasses the UI still can't submit or review (stake would be lost).</p>`,
  },
  {
    id: "frontend",
    title: "Frontend",
    html: `
<h3>Structure</h3>
<table><tr><th>Area</th><th>Files</th></tr>
<tr><td>Pages (App Router)</td><td class="mono">/, /explore, /create, /challenges/[id], /dashboard, /verify, /profile, /learn, /protocol, /admin</td></tr>
<tr><td>Contexts</td><td class="mono">ToastContext, Web3Context, AuthContext, InvitationsContext, ProfileContext</td></tr>
<tr><td>UI kit</td><td class="mono">primitives (Stat, Segmented, CountUp, ProgressRing, InfoTip…), Avatar, DateTimePicker, Badge, Reveal</td></tr>
<tr><td>Libraries</td><td class="mono">lib/chain (ethers, writes), lib/network (addresses, fee math), lib/api (apiFetch + wallet sign-in), lib/formatters, lib/identity</td></tr></table>
<h3>Web3 integration</h3>
<ul>
  <li><b>Reads</b> go through a public RPC (<span class="mono">getReadContract(id)</span>), independent of the wallet's network — balances never read as zero because MetaMask is on the wrong chain.</li>
  <li><b>Writes</b> (<span class="mono">getWriteContract(id)</span>) switch MetaMask to Sepolia first (adding it if missing), so one click completes an action.</li>
  <li>Withdrawals dry-run with <span class="mono">staticCall</span> first so a revert shows a human reason instead of a gas-estimation error.</li>
  <li><span class="mono">friendlyTxError</span> maps revert strings and wallet codes (4001, -32002…) to plain sentences.</li>
</ul>
<h3>Performance</h3>
<table><tr><th>Technique</th><th>Result</th></tr>
<tr><td>Removed ethers from the global bundle (EIP-1193 calls + BigInt formatter); contract ABI moved out of shared code</td><td>Explore/Verify/Profile/Learn first-load JS ≈ 440 KB → ≈ 112 KB</td></tr>
<tr><td>Supabase SDK loaded lazily after first paint</td><td>Faster interactivity on every page</td></tr>
<tr><td>Middleware refreshes Supabase sessions only when an <span class="mono">sb-</span> cookie exists, and skips data APIs</td><td>No network round-trip per request</td></tr>
<tr><td>Chain cache + timeouts, skip terminal challenges, DB indexes</td><td>Warm API responses ≈ 5–10 ms</td></tr>
<tr><td>Static pages prerendered, fonts self-hosted by next/font</td><td>≈ 30 ms page responses in production</td></tr></table>
<h3>UX & design system</h3>
<ul>
  <li>Design tokens in Tailwind; the accent colour is a CSS variable (<span class="mono">--accent</span>) chosen per user and applied by an inline script before first paint.</li>
  <li>Dashboard "What to do next" derives tasks (submit, review, settle, withdraw, refund) from challenges + on-chain positions.</li>
  <li>Generated avatars: a seeded PRNG (FNV-1a + mulberry32) draws a deterministic "blob buddy" SVG per wallet; friendly default names ("Swift Otter").</li>
  <li>Custom date-time picker, journey stepper, tooltips, toasts, confetti — all respecting <span class="mono">prefers-reduced-motion</span>.</li>
  <li>Mobile bottom tab bar; no horizontal overflow at 375 px; error, 404 and loading boundaries.</li>
</ul>`,
  },
  {
    id: "flows",
    title: "Key flows",
    html: `
<h3>Create</h3>
<ol><li>Wizard (basics → schedule → stakes → people → review) computes <span class="mono">T = ⌊(end − start) / frequency⌋</span>.</li>
<li><span class="mono">createChallenge</span> tx (auto-stake optional) → ID parsed from the <span class="mono">ChallengeCreated</span> event.</li>
<li>POST metadata (retried while the public RPC catches up); the server reads all economic fields from the contract.</li></ol>
<h3>Join</h3>
<ol><li>Public: <span class="mono">joinChallenge</span> with exact stake. Private: server checks invite + reputation, returns an EIP-712 invitation, wallet calls <span class="mono">joinChallengeWithAuthorization</span>.</li>
<li>App mirrors the enrolment only after confirming <span class="mono">isParticipant</span> on-chain.</li></ol>
<h3>Prove & review</h3>
<ol><li>During each period: submit a link + note. Peers approve/reject (one vote each, never on your own proof).</li>
<li>≥ ⌊0.33n⌋ approvals (min 1) and more approvals than rejections → period verified.</li></ol>
<h3>Settle & withdraw</h3>
<ol><li>After the end anyone clicks "Settle": attestation is generated and <span class="mono">finalizeChallenge</span> is sent.</li>
<li>Each participant withdraws their claimable balance (pull payment).</li></ol>
<h3>Under-filled</h3>
<p>If fewer than two people joined by the start, the lone participant calls <span class="mono">claimUnderfilledRefund</span> and receives the stake minus the fee.</p>`,
  },
  {
    id: "security",
    title: "Security & threat model",
    html: `
<table><tr><th>Threat</th><th>Mitigation</th></tr>
<tr><td>Reentrancy on withdraw/refund</td><td>CEI ordering + OpenZeppelin ReentrancyGuard</td></tr>
<tr><td>Settlement replay (same/different contract or chain)</td><td>EIP-712 domain (chainId, verifyingContract), per-challenge nonce, finalized flag</td></tr>
<tr><td>Forged/duplicated participant list</td><td>Strictly ascending addresses, enrolment check, count must equal participantCount</td></tr>
<tr><td>Impersonation in API calls</td><td>Signed wallet sessions; addresses from the body are only accepted if they match the session</td></tr>
<tr><td>Fake joins / fake challenges in the DB</td><td>Server verifies on-chain before recording; economic fields read from chain</td></tr>
<tr><td>Signature replay for sign-in</td><td>Single-use nonce with 10-minute TTL</td></tr>
<tr><td>Leaking private invite links / emails</td><td>Tokens redacted unless the viewer is the creator; public endpoints select only name + avatar</td></tr>
<tr><td>Inflated payouts via many proofs</td><td>One proof per period; distinct-period counting at settlement</td></tr>
<tr><td>Self-voting, double voting</td><td>Server checks + DB unique (proofId, verifierAddress); attestation re-audits</td></tr>
<tr><td>Bad validators / false reporters</td><td>Complaints, admin rulings, −10 reputation, suspension, removal with forfeiture</td></tr>
<tr><td>Missing secret falls back to a public key</td><td>Attestor key required off local chains; SESSION_SECRET required in production</td></tr>
<tr><td>Open redirect after OAuth</td><td>Only same-site relative <span class="mono">next</span> paths</td></tr></table>
<h3>Known limitations (honest answers)</h3>
<ul>
  <li><b>Attestor trust:</b> a compromised attestor key could sign wrong period counts. Improvements: multisig/threshold attestors, a challenge window where participants can dispute an attestation on-chain, or on-chain voting for small cohorts.</li>
  <li><b>Collusion / Sybil:</b> one person with several wallets could approve their own proofs. Mitigations: reputation, private cohorts, proof-of-personhood, stake-weighted or randomised reviewers.</li>
  <li><b>Proof authenticity:</b> links are judged by people; integrations (GitHub/Strava APIs, oracles) could automate verification.</li>
  <li><b>Reputation is off-chain</b>, so joining/creating can only be blocked in the app, not by the contract.</li>
</ul>`,
  },
  {
    id: "testing",
    title: "Testing & quality",
    html: `
<table><tr><th>Suite</th><th>Coverage</th></tr>
<tr><td>Hardhat contract tests (41)</td><td>Roles; creation validation; joins (stake, duplicate, full, after start); under-filled refunds; EIP-712 ordering, duplicates, wrong signer, replay, before-end;
wei conservation with qualifiers and zero-qualifier; treasury; private challenges & invitation signatures; fixed start; 15-period settlement; fee math & admin claims; ID offsets; account locks</td></tr>
<tr><td>API security suite (16)</td><td>Impersonation, fake joins, fake challenges, unsigned wallet linking, settle-twice, replayed sign-in, tampered cookies, invite-token leaks, self-heal</td></tr>
<tr><td>Complaint suite (19)</td><td>Who may report, duplicates, admin-only resolution, vote voiding & re-scoring, reputation updates, no email leaks</td></tr>
<tr><td>Penalty suite (21)</td><td>Removal blocks proof/review, false-report penalty, suspension below 25 on every write path, 4-day recovery, review credit, revoke after start, no removal after settlement</td></tr></table>
<p>API suites run against the <b>production build</b> on a throwaway copy of the database, so real data is never touched. <span class="mono">npm run check:env</span> verifies
configuration (contract reachable, attestor key matches <span class="mono">protocolAttestor</span>) before every deploy.</p>`,
  },
  {
    id: "deploy",
    title: "Deployment",
    html: `
<table><tr><th>Target</th><th>How</th></tr>
<tr><td>Vercel</td><td><span class="mono">vercel.json</span> runs <span class="mono">scripts/vercel-build.js</span>: switch Prisma to PostgreSQL → generate → <span class="mono">db push</span> → <span class="mono">next build</span>.
Uses Supabase Postgres (pooled <span class="mono">DATABASE_URL</span> + <span class="mono">DIRECT_URL</span>).</td></tr>
<tr><td>Docker</td><td>Multi-stage image with Next.js <span class="mono">standalone</span> output; SQLite on a volume; schema applied on start; health check on <span class="mono">/api/health</span>.</td></tr>
<tr><td>Contracts</td><td><span class="mono">npm run deploy:sepolia</span> writes ABI + address book; older contracts stay routable.</td></tr></table>
<p>Serverless-friendly choices: no background jobs (reputation recovery and chain sync are lazy), stateless HMAC sessions, per-instance caches that are safe to lose,
short RPC timeouts, and all secrets in environment variables.</p>`,
  },
  {
    id: "tradeoffs",
    title: "Design decisions & trade-offs",
    html: `
<table><tr><th>Decision</th><th>Why</th><th>Trade-off</th></tr>
<tr><td>Off-chain verification + signed settlement</td><td>Cheap, private, flexible rules</td><td>Trust in the attestor key</td></tr>
<tr><td>Pull payments</td><td>Safe against griefing and reentrancy</td><td>One extra transaction per user</td></tr>
<tr><td>Integer math, round down, dust to treasury</td><td>Never insolvent, deterministic</td><td>Tiny amounts go to treasury</td></tr>
<tr><td>Fee taken from the stake</td><td>Joiners pay exactly the advertised amount</td><td>Net stake slightly below the headline</td></tr>
<tr><td>Contract as source of truth, DB as cache</td><td>No drift can block settlement</td><td>RPC reads (mitigated by cache)</td></tr>
<tr><td>Redeploy instead of upgradeable proxy</td><td>Simpler, no admin upgrade power over funds</td><td>Routing across versions</td></tr>
<tr><td>Penalties via attestation (0 periods)</td><td>No contract change, works on all versions</td><td>Relies on the attestor</td></tr>
<tr><td>Wallet sessions instead of signing every action</td><td>One free signature per week</td><td>Cookie must be protected (httpOnly, HMAC)</td></tr></table>
<h3>Future work</h3>
<ul><li>On-chain dispute window for attestations; threshold-signature attestors.</li>
<li>Automatic proof checks (GitHub commits, Strava activities).</li>
<li>Stake-weighted or randomly assigned reviewers to resist collusion.</li>
<li>Gasless joins via ERC-4337 / meta-transactions; L2 deployment for lower fees.</li>
<li>Notifications (email / push) for deadlines and reviews.</li></ul>`,
  },
  {
    id: "qa",
    title: "Interview questions & answers",
    html: [
      ["Why not put proofs and votes on-chain?", "Gas for every action, public exposure of personal links, and inflexible rules. Only the outcome (periods per wallet) needs to be trust-minimised, so it is summarised into one signed message and verified on-chain."],
      ["What stops the backend from stealing funds?", "It never holds funds or keys to the contract's balance. The contract only accepts a settlement signed by the attestor, and even then it computes every payout itself and only lets each wallet withdraw its own balance."],
      ["How is replay prevented?", "EIP-712 domain separation (chainId + contract address), a per-challenge settlement nonce incremented on finalize, and the finalized flag. Sign-in messages are single-use with a 10-minute TTL."],
      ["Why sort addresses?", "A canonical order makes the signed message deterministic and lets the contract detect duplicates with one comparison (p > last) instead of a nested loop."],
      ["Explain the payout formula.", "Net stake S = stake − 0.125%. Retained = S·c/T. Missed parts form a pool split among qualifiers (c·100 ≥ threshold·T) in proportion to c. If nobody qualifies the pool goes to the treasury."],
      ["How do you guarantee solvency?", "All divisions floor; the difference between the pool and distributed rewards (dust) goes to the treasury; tests assert Σclaimable + treasuryCut + fees = n·stake exactly."],
      ["Why pull instead of push payments?", "Pushing in a loop lets one reverting recipient block everyone and adds reentrancy surface; pulling isolates each withdrawal."],
      ["What is the zero-qualifier rule for?", "Without it, everyone could agree to skip and still split the pool. Sending the pool to the treasury removes that incentive."],
      ["How does authentication work without passwords?", "The wallet signs a one-time message (EIP-191); the server verifies the signature, then issues an HMAC-signed httpOnly cookie for 7 days. Every write checks the session wallet."],
      ["How do you keep the database and chain consistent?", "The contract is the source of truth: status and nonce are synced on read, joins and challenges are verified on-chain before being recorded, settlement reads the participant list from the contract, and missing challenges self-heal."],
      ["What happens if the RPC is slow?", "Calls time out after 4 seconds; status falls back to a time-derived value; results are cached for 15 seconds; settled challenges never call RPC."],
      ["How do penalties take someone's money without a contract change?", "Removed participants are attested with 0 completed periods, so the contract pays them nothing and their net stake goes to the pool. Removal is blocked after settlement."],
      ["How does reputation recovery work without a cron job?", "Lazily: whenever a reputation is read, the server applies the +2 ticks owed for each full 4 days since lowSince and logs them."],
      ["How did you make the frontend fast?", "Kept ethers out of the shared bundle (raw EIP-1193 + BigInt formatting), moved the ABI out of shared code, lazy-loaded Supabase, avoided per-request auth round-trips, cached chain reads and added indexes. Shared pages went from ~440 KB to ~112 KB."],
      ["How do you handle contract upgrades?", "Deploy a new immutable version, start its IDs after the previous one's, and route each challenge ID to the contract that owns it via an address book."],
      ["What are the biggest risks?", "Attestor key compromise and reviewer collusion/Sybils. Mitigations: key management and multisig, dispute windows, reputation, private cohorts, proof-of-personhood."],
      ["Why Sepolia?", "It is the recommended Ethereum testnet: free test ETH, real EVM semantics, Etherscan support — safe for real users to try without risk."],
      ["What would you change for mainnet?", "Audit, multisig owner and attestor, dispute window, L2 deployment, rate limiting, monitoring/alerts, and a formal privacy policy."],
    ]
      .map(([q, a]) => `<div class="qa"><p class="q">${q}</p><p>${a}</p></div>`)
      .join(""),
  },
  {
    id: "appendix",
    title: "Appendix: repository map",
    html: `
<pre>contracts/CommitXProtocol.sol        the protocol (v3)
test/CommitXProtocol.test.js         41 Hardhat tests
scripts/deploy.js                    deploy + write ABI and address book (auto ID offset)
scripts/check-env.js                 pre-deploy configuration check
scripts/vercel-build.js · use-postgres.js · db-transfer.js   Vercel / Postgres tooling
prisma/schema.prisma                 data model
src/config/contracts.js · deployments.js    ABI · address book
src/lib/  chain · chainSync · attestation · attestor · session · auth · api
          reputation · moderation · proofStatus · challengeRecord · network · identity
src/app/api/…                        route handlers (see Backend)
src/app/…                            pages · src/components/… UI · src/context/… state
docs/DEPLOYMENT.md                   operations guide</pre>`,
  },
];

module.exports = { sections };

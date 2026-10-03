# CommitX — Web3 Accountability & Staking Platform

> **"Commit to it. Put something on the line."**  
> *Turn personal commitments into economically accountable commitments.*

CommitX is a non-custodial social accountability protocol on Ethereum Sepolia. Users stake Sepolia ETH into transparent smart contracts, submit periodic activity proofs, peer-verify each other's submissions, and receive deterministic payouts based on verified completion rates and qualification thresholds.

---

## 🌟 Core Protocol Principles

1. **Non-Custodial Source of Truth**: The Solidity smart contract is the sole authority for participant deposits and settlements. The backend never controls user funds.
2. **Sepolia Ethereum Network**: All financial operations execute on the Sepolia Ethereum testnet.
3. **EIP-712 Settlement Attestation**: Settlements use domain-bound EIP-712 cryptographic signatures binding canonical ascending participant address arrays (`participants[i] < participants[i+1]`).
4. **Exact Integer Wei Arithmetic**: Strict wei-precision integer math in Solidity. Any division remainder dust is assigned to the protocol treasury.
5. **Zero-Qualifier Protocol Rule**: If no participant achieves the minimum qualification threshold (e.g. 50%), participants receive only their completion-retained stake, and 100% of the penalty pool is transferred to the Protocol Treasury.
6. **Pull-Based Withdrawals**: Payouts are claimed individually through `withdraw(challengeId)` protected by OpenZeppelin's `ReentrancyGuard`.
7. **Transparent UX**: Every financial amount is clearly categorized as `Confirmed` (on-chain), `Pending` (in flight), `Estimated` / `Potential reward` (pre-settlement), or `Final` (post-settlement).

---

## 🏗️ Architecture

```
CommitX/
├── contracts/
│   ├── CommitXProtocol.sol       # Solidity 0.8.24, EIP-712, ReentrancyGuard, Ownable
│   └── test/
│       └── CommitXProtocol.test.js # 20 Comprehensive Hardhat invariant & rule tests
├── scripts/
│   ├── deploy.js                 # Automated Hardhat & Sepolia deployment
│   └── seed.js                   # Realistic database seeder
├── prisma/
│   ├── schema.prisma             # Relational schema for challenges, proofs, votes
│   └── dev.db                    # Local SQLite database
├── src/
│   ├── app/
│   │   ├── page.jsx              # Premium landing page with interactive engine
│   │   ├── dashboard/page.jsx    # Active challenges, streaks, financial overview
│   │   ├── explore/page.jsx      # Challenge discovery with categories & filters
│   │   ├── create/page.jsx       # 5-step wizard with on-chain deployment
│   │   ├── challenges/[id]/page.jsx # 7-tab Challenge Hub
│   │   ├── verify/page.jsx       # Peer Verification Queue (anti-self vote)
│   │   ├── profile/page.jsx      # Participant profile & accountability history
│   │   ├── protocol/page.jsx     # Public protocol solvency & transparency page
│   │   └── api/                  # Auth, Challenges, Proofs, Verifications, Attestation
│   ├── components/
│   │   ├── layout/               # Navbar, Footer, Network Indicator
│   │   ├── ui/                   # Badges, Status Badges
│   │   └── web3/                 # 5-Stage TransactionModal with Etherscan link
│   ├── context/
│   │   └── Web3Context.jsx       # MetaMask connection, Sepolia switch, balance
│   ├── config/
│   │   └── contracts.js          # Contract address, chain ID, and ABI
│   └── lib/
│       ├── prisma.js             # Prisma singleton
│       ├── auth.js               # EIP-191 wallet signature authentication
│       ├── attestation.js        # EIP-712 settlement generator & canonical sorter
│       └── formatters.js         # Wei / ETH formatting & countdowns
├── docs/
│   ├── ARCHITECTURE.md           # System design & trust model
│   ├── SMART_CONTRACT.md         # Functions, events, and validation checks
│   ├── ECONOMIC_MODEL.md         # Formal wei math & zero-qualifier proof
│   └── SECURITY.md               # Threat model & invariants
├── .env.example
└── package.json
```

---

## 🚀 Quickstart & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Initialize Database
```bash
npx prisma db push
node scripts/seed.js
```

### 4. Compile & Test Smart Contracts
Run the comprehensive 20-test suite verifying exact wei accounting, zero-qualifier rule, replay protection, and canonical sorting:
```bash
npx hardhat test
```

### 5. Deploy Locally
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 6. Run Next.js Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to interact with CommitX.

---

## 🌐 Deploying to Ethereum Sepolia Testnet

1. Fund your deployer wallet with Sepolia ETH (from a public Sepolia faucet).
2. Set your environment variables in `.env`:
   ```bash
   DEPLOYER_PRIVATE_KEY=your_private_key_here
   SEPOLIA_RPC_URL=https://rpc.sepolia.org
   PROTOCOL_ATTESTOR_PRIVATE_KEY=your_attestor_private_key
   NEXT_PUBLIC_CHAIN_ID=11155111
   ```
3. Deploy the contract:
   ```bash
   npm run deploy:sepolia
   ```
4. The deployment script will automatically write the deployed Sepolia address and ABI to `src/config/contracts.js`.

---

## 🚢 Deploying the Web App

Run `npm run check:env`, then `docker compose up -d --build`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Node, Docker, and Vercel/Postgres options.

## 🔒 Security & Trust Assumptions

- **Non-Custodial**: User funds are locked inside the Solidity smart contract. Neither creators nor backend administrators can move funds arbitrarily.
- **Protocol Attestor Trust Model**: For the MVP, peer review consensus is aggregated by the backend and signed via EIP-712 by an authorized Protocol Attestor. Future versions may transition to an optimistic oracle or decentralized attestation protocol.
- **Reentrancy Protection**: All claim and withdrawal methods use OpenZeppelin's `ReentrancyGuard` with strict Checks-Effects-Interactions pattern.

---

## 📜 License
MIT License.

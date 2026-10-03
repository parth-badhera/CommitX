/**
 * Verifies the environment before deploying. Never prints secret values.
 *   npm run check:env
 */
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
const { ethers } = require("ethers");
const contracts = require("../src/config/contracts");
const deployments = require("../src/config/deployments");

const env = process.env;
const errors = [];
const warnings = [];
const ok = (m) => console.log(`  ✓ ${m}`);

const chainId = Number(env.NEXT_PUBLIC_CHAIN_ID || deployments.CURRENT.chainId);
const address = deployments.CURRENT.address;
const rpc = env.SEPOLIA_RPC_URL || env.NEXT_PUBLIC_RPC_URL;

(async () => {
  console.log("\nCommitX environment check\n");

  if (!ethers.isAddress(address || "")) errors.push("src/config/deployments.js has no valid CURRENT.address — run the deploy script");
  else ok(`Contract ${address} on chain ${chainId}`);

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is not set");
  } else if (/:\[.*\]@/.test(env.DATABASE_URL)) {
    errors.push("DATABASE_URL contains square brackets around the password (: [PASSWORD] @). Remove the square brackets '[ ' and ' ]' from your Supabase connection string!");
  } else {
    ok("DATABASE_URL set");
  }

  if (!env.SESSION_SECRET) warnings.push("SESSION_SECRET not set — sessions fall back to a key derived from the attestor key");
  else if (env.SESSION_SECRET.length < 32) warnings.push("SESSION_SECRET should be at least 32 characters");
  else ok("SESSION_SECRET set");

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    warnings.push("Supabase not configured — Google sign-in disabled (demo login still works)");
  else ok("Supabase configured");

  let attestor = null;
  if (!env.PROTOCOL_ATTESTOR_PRIVATE_KEY) {
    (chainId === 31337 ? warnings : errors).push("PROTOCOL_ATTESTOR_PRIVATE_KEY is not set — settlements can't be signed");
  } else {
    try {
      const k = env.PROTOCOL_ATTESTOR_PRIVATE_KEY;
      attestor = new ethers.Wallet(k.startsWith("0x") ? k : `0x${k}`).address;
      ok(`Attestor key loaded (${attestor})`);
    } catch {
      errors.push("PROTOCOL_ATTESTOR_PRIVATE_KEY is not a valid private key");
    }
  }

  if (rpc && ethers.isAddress(address || "")) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc, chainId, { staticNetwork: true });
      const code = await provider.getCode(address);
      if (code === "0x") errors.push(`No contract deployed at ${address} on chain ${chainId}`);
      else ok("Contract reachable over RPC");
      if (attestor && code !== "0x") {
        const c = new ethers.Contract(address, contracts.COMMITX_ABI, provider);
        const onChain = await c.protocolAttestor();
        if (onChain.toLowerCase() !== attestor.toLowerCase())
          errors.push(`Attestor key (${attestor}) ≠ contract protocolAttestor (${onChain}) — settlements would revert`);
        else ok("Attestor matches the contract");
      }
    } catch (e) {
      warnings.push(`RPC check failed: ${e.shortMessage || e.message}`);
    }
  } else if (!rpc) {
    warnings.push("No RPC URL set — using the public Sepolia default");
  }

  warnings.forEach((w) => console.log(`  ! ${w}`));
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  console.log(errors.length ? `\n${errors.length} problem(s) must be fixed before deploying.\n` : "\nReady to deploy.\n");
  process.exit(errors.length ? 1 : 0);
})();

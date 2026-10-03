"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { EXPLORER, getReadContract, getWriteContract, friendlyTxError } from "@/lib/chain";
import { ALL_DEPLOYMENTS, FEE_PERCENT_LABEL } from "@/lib/network";
import { formatEth, shortenAddress } from "@/lib/formatters";
import { PageHeader, Stat, Spinner } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/Badge";
import { Moderation } from "@/components/admin/Moderation";
import { Coins, ExternalLink, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

async function readDeployment(d) {
  const c = getReadContract(d.address);
  const [treasury, balance, stats] = await Promise.all([c.treasury(), c.treasuryBalance(), c.getProtocolStats()]);
  let fees = null;
  if (d.hasFee) fees = await c.totalFeesCollected();
  return {
    ...d,
    treasury: treasury.toLowerCase(),
    claimable: balance,
    feesCollected: fees,
    contractBalance: stats._contractBalance,
    totalChallenges: stats._totalChallenges,
  };
}

export default function AdminPage() {
  const { account, connectWallet, setTxState, updateAccountAndBalance } = useWeb3();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await Promise.all(ALL_DEPLOYMENTS.map(readDeployment)));
    } catch (err) {
      setError(err.shortMessage || err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const me = account?.toLowerCase();
  const isAdmin = Boolean(me && rows?.some((r) => r.treasury === me));
  const claimableTotal = rows?.filter((r) => r.treasury === me).reduce((s, r) => s + r.claimable, 0n) ?? 0n;
  const feesTotal = rows?.reduce((s, r) => s + (r.feesCollected || 0n), 0n) ?? 0n;

  const claim = async (row) => {
    setClaiming(row.address);
    try {
      setTxState({ status: "preparing", title: "Claiming admin balance", txHash: null, error: null });
      const c = await getWriteContract(row.address);
      const amount = await c.treasuryBalance(); // claim exactly what's there right now
      if (amount === 0n) throw new Error("Nothing to claim on this contract yet.");
      setTxState({ status: "waiting_wallet", title: "Confirm in MetaMask", txHash: null, error: null });
      const tx = await c.withdrawTreasury(amount);
      setTxState({ status: "submitted", title: "Claiming…", txHash: tx.hash, error: null });
      await tx.wait();
      setTxState({ status: "confirmed", title: `${formatEth(amount)} sent to your wallet`, txHash: tx.hash, error: null });
      updateAccountAndBalance(account);
    } catch (err) {
      setTxState({ status: "failed", title: "Claim failed", txHash: null, error: friendlyTxError(err) });
    } finally {
      setClaiming(null);
      load();
    }
  };

  return (
    <div className="shell py-12 space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Fees, treasury & complaints"
        subtitle={`Every join pays a ${FEE_PERCENT_LABEL} fee out of the stake. Fees, unclaimed penalty pools and rounding dust collect in each contract until the admin wallet claims them — any time.`}
        actions={
          <button onClick={load} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {!account ? (
        <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-5 h-5 text-dim" />
            <p className="text-sm text-dim">Connect the admin wallet to claim.</p>
          </div>
          <button onClick={connectWallet} className="btn-primary">
            Connect wallet
          </button>
        </div>
      ) : rows && !isAdmin ? (
        <div className="card p-6 text-sm text-dim">
          Connected as <span className="num text-fg">{shortenAddress(account)}</span>, which isn&apos;t the admin wallet. Figures below
          are read-only.
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          label="Claimable now"
          value={rows ? formatEth(isAdmin ? claimableTotal : rows.reduce((s, r) => s + r.claimable, 0n)) : "…"}
          tone="lime"
          icon={Coins}
          hint="Across all contracts"
        />
        <Stat label="Joining fees (all-time)" value={rows ? formatEth(feesTotal) : "…"} hint={`${FEE_PERCENT_LABEL} of every stake`} />
        <Stat
          label="Admin wallet"
          value={rows ? shortenAddress(rows[0]?.treasury || "") : "…"}
          hint="Only this wallet can claim"
          icon={ShieldCheck}
        />
      </div>

      {error && <p className="text-sm text-bad">Couldn&apos;t read the contracts: {error}</p>}

      <div className="space-y-3">
        {!rows && !error ? (
          <div className="card p-10 flex justify-center text-dim">
            <Spinner className="w-5 h-5" />
          </div>
        ) : (
          rows?.map((r) => {
            const mine = r.treasury === me;
            return (
              <div key={r.address} className={`card p-6 space-y-5 ${r.current ? "border-lime/30" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-semibold text-fg">{r.current ? "CommitX contract" : "Previous contract"}</p>
                    {r.current ? <Badge variant="lime">Live</Badge> : <Badge>Legacy</Badge>}
                    {!r.hasFee && <Badge>No fee</Badge>}
                  </div>
                  {EXPLORER ? (
                    <a
                      href={`${EXPLORER}/address/${r.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="num text-xs text-dim hover:text-lime inline-flex items-center gap-1"
                    >
                      {r.address} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="num text-xs text-dim">{r.address}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden bg-line border border-line text-xs">
                  {[
                    ["Claimable", formatEth(r.claimable), "text-lime font-semibold"],
                    ["Fees collected", r.feesCollected === null ? "—" : formatEth(r.feesCollected), "text-fg"],
                    ["Contract holds", formatEth(r.contractBalance), "text-fg"],
                    ["Challenges", r.totalChallenges.toString(), "text-fg"],
                  ].map(([k, v, tone]) => (
                    <div key={k} className="bg-panel px-4 py-3">
                      <span className="block text-faint mb-1">{k}</span>
                      <span className={`num text-sm ${tone}`}>{v}</span>
                    </div>
                  ))}
                </div>
                {mine && (
                  <button
                    onClick={() => claim(r)}
                    disabled={r.claimable === 0n || claiming === r.address}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {claiming === r.address ? <Spinner /> : <Coins className="w-4 h-4" />}
                    {r.claimable === 0n ? "Nothing to claim" : `Claim ${formatEth(r.claimable)}`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {isAdmin && <Moderation admin={me} />}

      <p className="text-xs text-faint">
        Participants&apos; stakes are never touched by a claim: the contract only lets the admin withdraw the treasury balance,
        and it always keeps enough to pay every stake and payout.
      </p>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/context/Web3Context";
import Link from "next/link";
import { CONTRACT_ADDRESS, EXPLORER, getReadContract } from "@/lib/chain";
import { formatEth, shortenAddress, formatDate } from "@/lib/formatters";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, Stat } from "@/components/ui/primitives";
import { ExternalLink, Coins } from "lucide-react";

export default function ProtocolPage() {
  const { account } = useWeb3();
  const [stats, setStats] = useState(null);
  const [chain, setChain] = useState(null);
  const [roles, setRoles] = useState({ attestor: null, treasury: null });

  const load = useCallback(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch((err) => console.error("Error fetching stats:", err));

    const protocol = getReadContract();
    protocol
      .getProtocolStats()
      .then((s) =>
        setChain({
          totalChallenges: s._totalChallenges.toString(),
          totalDeposited: s._totalDeposited.toString(),
          totalSettled: s._totalSettledAmount.toString(),
          totalWithdrawn: s._totalWithdrawnAmount.toString(),
          treasuryBalance: s._treasuryBalance.toString(),
          contractBalance: s._contractBalance.toString(),
          feesCollected: s._totalFeesCollected !== undefined ? s._totalFeesCollected.toString() : null,
        })
      )
      .catch(() => {});
    Promise.all([protocol.protocolAttestor(), protocol.treasury()])
      .then(([attestor, treasury]) => setRoles({ attestor, treasury }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isTreasury = account && roles.treasury && account.toLowerCase() === roles.treasury.toLowerCase();

  const txs = stats?.recentTransactions || [];

  return (
    <div className="shell py-12 space-y-10">
      <PageHeader
        eyebrow="Protocol"
        title="Everything, on the record"
        subtitle="Live numbers read straight from the contract on Sepolia. The contract balance always covers what's staked and claimable."
        actions={
          EXPLORER && (
            <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer" className="btn-secondary">
              Etherscan <ExternalLink className="w-4 h-4" />
            </a>
          )
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Contract balance" value={formatEth(chain?.contractBalance || "0")} tone="lime" hint="ETH held by the contract right now" />
        <Stat label="Total deposited" value={formatEth(chain?.totalDeposited || stats?.totalVolumeWei || "0")} hint="All-time stakes" />
        <Stat label="Total settled" value={formatEth(chain?.totalSettled || "0")} hint="Stakes run through settlement" />
        <Stat label="Total withdrawn" value={formatEth(chain?.totalWithdrawn || "0")} hint="Payouts, refunds and treasury" />
        <Stat label="Treasury" value={formatEth(chain?.treasuryBalance || "0")} tone="violet" hint="Joining fees, zero-qualifier pools & dust" />
        <Stat label="Joining fees" value={chain?.feesCollected ? formatEth(chain.feesCollected) : "—"} hint="0.125% of every stake, all-time" />
        <Stat
          label="Challenges"
          value={`${stats?.activeChallenges ?? 0} / ${chain?.totalChallenges ?? stats?.totalChallenges ?? 0}`}
          hint="Active / all-time"
        />
      </div>

      <div className="card divide-y divide-line">
        {[
          ["Protocol contract", CONTRACT_ADDRESS, "Holds stakes, verifies settlements"],
          ["Settlement attestor", roles.attestor, "Signs EIP-712 settlement digests"],
          ["Treasury", roles.treasury, "Receives unclaimed penalty pools"],
        ].map(([label, addr, hint]) => (
          <div key={label} className="p-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <div className="sm:w-56 shrink-0">
              <p className="text-sm font-medium text-fg">{label}</p>
              <p className="text-xs text-faint">{hint}</p>
            </div>
            {addr ? (
              EXPLORER ? (
                <a href={`${EXPLORER}/address/${addr}`} target="_blank" rel="noreferrer" className="num text-sm text-dim hover:text-lime break-all">
                  {addr}
                </a>
              ) : (
                <span className="num text-sm text-dim break-all">{addr}</span>
              )
            ) : (
              <span className="text-sm text-faint">Loading…</span>
            )}
          </div>
        ))}
      </div>

      {isTreasury && (
        <Link href="/admin" className="card-hover p-6 flex items-center justify-between gap-4 border-violet/30">
          <div className="flex items-start gap-3">
            <Coins className="w-5 h-5 text-violet mt-0.5" />
            <div>
              <p className="text-base font-medium text-fg">You&apos;re connected as the admin</p>
              <p className="text-sm text-dim">Claim joining fees and treasury balances on the Admin page.</p>
            </div>
          </div>
          <span className="btn-secondary btn-sm">Open admin</span>
        </Link>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-fg">Recent transactions</h2>
        {txs.length === 0 ? (
          <div className="card p-8 text-sm text-dim text-center">No transactions recorded yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint border-b border-line">
                  <th className="font-normal px-5 py-3">Tx</th>
                  <th className="font-normal px-5 py-3">Type</th>
                  <th className="font-normal px-5 py-3">Wallet</th>
                  <th className="font-normal px-5 py-3 text-right">Amount</th>
                  <th className="font-normal px-5 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {txs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-raised/40">
                    <td className="px-5 py-3.5">
                      {EXPLORER && /^0x[0-9a-f]{64}$/i.test(tx.txHash) ? (
                        <a href={`${EXPLORER}/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="num link">
                          {tx.txHash.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="num text-faint">{tx.txHash.slice(0, 12)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={tx.type === "CREATE" ? "lime" : tx.type === "WITHDRAW" ? "ok" : "default"}>
                        {tx.type.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 num text-dim">{shortenAddress(tx.walletAddress)}</td>
                    <td className="px-5 py-3.5 num text-fg text-right">{formatEth(tx.amountWei)}</td>
                    <td className="px-5 py-3.5 text-dim text-right whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

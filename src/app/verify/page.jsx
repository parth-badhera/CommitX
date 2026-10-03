"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";
import { displayName } from "@/lib/identity";
import { shortenAddress, getRequiredApprovals } from "@/lib/formatters";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, Segmented, EmptyState, Spinner } from "@/components/ui/primitives";
import { ShieldCheck, ExternalLink } from "lucide-react";

export default function VerifyHubPage() {
  const { account, connectWallet } = useWeb3();
  const { user } = useAuth();
  const toast = useToast();
  const wallet = (account || user?.walletAddress || "").toLowerCase() || null;

  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [votingId, setVotingId] = useState(null);
  const [filter, setFilter] = useState("todo");

  const load = useCallback(() => {
    fetch("/api/proofs", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setProofs(d.proofs || []))
      .catch((err) => console.error("Error loading proofs:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vote = async (proofId, decision) => {
    if (!wallet) return connectWallet();
    setVotingId(proofId);
    try {
      await apiFetch("/api/verifications", {
        method: "POST",
        wallet,
        json: { proofId, verifierAddress: wallet, decision, reason: `Peer verification: ${decision}` },
      });
      toast.success(decision === "APPROVE" ? "Approved" : "Rejected", "Your vote is recorded.");
      load();
    } catch (err) {
      toast.error("Couldn't record vote", err.message);
    } finally {
      setVotingId(null);
    }
  };

  const inMyCohort = (p) =>
    wallet && p.period?.challenge?.participants?.some((part) => part.walletAddress?.toLowerCase() === wallet);
  const isMine = (p) => wallet && p.participantAddress.toLowerCase() === wallet;
  const votedOn = (p) => wallet && p.verifications?.some((v) => v.verifierAddress.toLowerCase() === wallet);

  const visible = proofs.filter((p) => {
    if (filter === "todo") return inMyCohort(p) && !isMine(p) && !votedOn(p);
    if (filter === "cohorts") return inMyCohort(p);
    return true;
  });

  const todoCount = proofs.filter((p) => inMyCohort(p) && !isMine(p) && !votedOn(p)).length;

  return (
    <div className="shell py-12 space-y-8">
      <PageHeader
        eyebrow="Verify"
        title="Review your cohort"
        subtitle="Approve proof that meets the challenge rules, reject what doesn't. A proof counts once a third of its cohort approves it."
      />

      <Segmented
        items={[
          { id: "todo", label: `Needs my vote${todoCount ? ` · ${todoCount}` : ""}` },
          { id: "cohorts", label: "My cohorts" },
          { id: "all", label: "All proofs" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="card p-12 flex justify-center text-dim">
          <Spinner className="w-5 h-5" />
        </div>
      ) : !wallet && filter !== "all" ? (
        <EmptyState
          icon={ShieldCheck}
          title="Connect to review"
          body="Only participants of a challenge can vote on its proofs."
          action={
            <button onClick={connectWallet} className="btn-primary">
              Connect wallet
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={filter === "todo" ? "You're all caught up" : "No proofs here"}
          body={filter === "todo" ? "Nothing in your cohorts is waiting on your vote." : "Proof submissions will show up here."}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => {
            const liveVotes = (p.verifications || []).filter((v) => !v.voided);
            const approvals = liveVotes.filter((v) => v.decision === "APPROVE").length;
            const rejections = liveVotes.filter((v) => v.decision === "REJECT").length;
            const required = getRequiredApprovals(p.period?.challenge?.participants?.length || 2);
            const mine = isMine(p);
            const voted = votedOn(p);
            const canVote = inMyCohort(p) && !mine;
            const met = approvals >= required && approvals > rejections;
            const ch = p.period?.challenge;

            return (
              <div key={p.id} className="card p-5 flex flex-col md:flex-row md:items-center gap-5">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar src={p.user?.avatar} seed={p.participantAddress} size={28} />
                    <span className="text-sm font-medium text-fg">{displayName(p.user, p.participantAddress)}</span>
                    <span className="chip num">P{p.period?.periodNumber || 1}</span>
                    {ch && (
                      <Link href={`/challenges/${ch.contractChallengeId}`} className="text-xs text-dim hover:text-fg truncate max-w-[16rem]">
                        {ch.name}
                      </Link>
                    )}
                    {mine && <Badge variant="warn">Yours</Badge>}
                    {voted && <Badge variant="violet">Voted</Badge>}
                    {met && <Badge variant="ok">Verified</Badge>}
                  </div>
                  {p.note && <p className="text-sm text-dim leading-relaxed">{p.note}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <a href={p.contentUri} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                      Open proof <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="num text-dim">
                      <span className="text-ok">{approvals}</span>/{required} approvals
                      {rejections > 0 && <span className="text-bad"> · {rejections} reject</span>}
                    </span>
                  </div>
                </div>
                {canVote ? (
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => vote(p.id, "REJECT")} disabled={votingId === p.id || voted} className="btn-danger btn-sm">
                      Reject
                    </button>
                    <button onClick={() => vote(p.id, "APPROVE")} disabled={votingId === p.id || voted} className="btn-primary btn-sm">
                      Approve
                    </button>
                  </div>
                ) : mine ? (
                  <span className="text-xs text-faint shrink-0">You can't vote on your own proof</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

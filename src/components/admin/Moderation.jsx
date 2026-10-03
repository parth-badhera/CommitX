"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/context/ToastContext";
import { apiFetch } from "@/lib/api";
import { shortenAddress } from "@/lib/formatters";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented, Spinner, EmptyState } from "@/components/ui/primitives";
import { ReputationBadge } from "@/components/reputation/Reputation";
import { Flag, ExternalLink, ArrowRight, Gavel, ShieldCheck, UserX, Ban, Undo2 } from "lucide-react";

const REASON = {
  WRONG_APPROVAL: "Approved proof that breaks the rules",
  WRONG_REJECTION: "Rejected proof that meets the rules",
  OTHER: "Other rule-breaking",
};

const STATUS_LABEL = { UPHELD: "Upheld", FALSE_REPORT: "Ruled a false report", DISMISSED: "Dismissed" };

/**
 * Admin-only moderation: judge complaints, penalise the right person (−10 reputation),
 * and remove them from the challenge (no payout or refund) when it's serious.
 */
export function Moderation({ admin }) {
  const toast = useToast();
  const [status, setStatus] = useState("OPEN");
  const [complaints, setComplaints] = useState(null);
  const [people, setPeople] = useState({ removed: [], suspended: [] });
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(
    async (signIn = false) => {
      try {
        const opts = signIn ? { wallet: admin } : {};
        const [c, p] = await Promise.all([
          apiFetch(`/api/admin/complaints?status=${status}`, opts),
          apiFetch("/api/admin/participants", opts),
        ]);
        setComplaints(c.complaints);
        setPeople(p);
        setNeedsSignIn(false);
      } catch (err) {
        if (err.status === 401) setNeedsSignIn(true);
        else toast.error("Couldn't load complaints", err.message);
      }
    },
    [status, admin, toast]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const resolve = async (c, action, remove = false) => {
    const key = `${c.id}:${action}:${remove}`;
    setBusy(key);
    try {
      await apiFetch(`/api/admin/complaints/${c.id}`, {
        method: "POST",
        wallet: admin,
        json: { action, remove, note: notes[c.id] || "" },
      });
      const who = action === "uphold" ? c.accused.name : c.reporter.name;
      toast.success(
        action === "dismiss" ? "Complaint dismissed" : `${who} penalised`,
        action === "dismiss" ? "No one was penalised." : `−10 reputation${remove ? " and removed from the challenge (no refund)." : "."}`
      );
    } catch (err) {
      toast.error("Action failed", err.message);
    } finally {
      setBusy(null);
      load(false);
    }
  };

  const reinstate = async (r) => {
    setBusy(`re:${r.wallet}:${r.challenge.contractChallengeId}`);
    try {
      await apiFetch("/api/admin/participants", {
        method: "POST",
        wallet: admin,
        json: { wallet: r.wallet, contractChallengeId: r.challenge.contractChallengeId },
      });
      toast.success("Reinstated", `${r.name} is back in the challenge.`);
    } catch (err) {
      toast.error("Couldn't reinstate", err.message);
    } finally {
      setBusy(null);
      load(false);
    }
  };

  if (needsSignIn) {
    return (
      <section className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Gavel className="w-5 h-5 text-violet" />
          <p className="text-sm text-dim">Confirm it&apos;s you (a free signature) to review complaints.</p>
        </div>
        <button onClick={() => load(true)} className="btn-primary btn-sm">
          Open complaints
        </button>
      </section>
    );
  }

  const Btn = ({ c, action, remove, className, children }) => (
    <button
      onClick={() => resolve(c, action, remove)}
      disabled={!!busy || (remove && c.settled)}
      className={`${className} btn-sm`}
      title={remove && c.settled ? "The challenge is settled — removal is no longer possible" : undefined}
    >
      {busy === `${c.id}:${action}:${remove}` && <Spinner className="w-3.5 h-3.5" />}
      {children}
    </button>
  );

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-bad" />
            <h2 className="text-2xl font-semibold text-fg">Complaints</h2>
          </div>
          <Segmented
            items={[
              { id: "OPEN", label: "Open" },
              { id: "UPHELD", label: "Upheld" },
              { id: "FALSE_REPORT", label: "False" },
              { id: "DISMISSED", label: "Dismissed" },
            ]}
            value={status}
            onChange={setStatus}
          />
        </div>

        {complaints === null ? (
          <div className="card p-10 flex justify-center text-dim">
            <Spinner className="w-5 h-5" />
          </div>
        ) : complaints.length === 0 ? (
          <EmptyState icon={ShieldCheck} title={status === "OPEN" ? "No open complaints" : "Nothing here"} body="Reports from participants show up here." />
        ) : (
          <ul className="space-y-3">
            {complaints.map((c) => (
              <li key={c.id} className="card p-5 space-y-4 animate-fade-up">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Person p={c.reporter} removed={c.reporterRemoved} />
                  <span className="text-faint flex items-center gap-1">
                    reported <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                  <Person p={c.accused} removed={c.accusedRemoved} />
                  <span className="ml-auto text-xs text-faint">{new Date(c.createdAt).toLocaleString()}</span>
                </div>

                <div className="well p-4 space-y-2 text-sm">
                  <p className="font-medium text-fg">{REASON[c.reason]}</p>
                  <p className="text-dim whitespace-pre-wrap">“{c.details}”</p>
                  {c.vote && (
                    <div className="pt-2 border-t border-line text-xs text-dim space-y-1">
                      <p>
                        They{" "}
                        <span className={c.vote.decision === "APPROVE" ? "text-ok" : "text-bad"}>
                          {c.vote.decision === "APPROVE" ? "approved" : "rejected"}
                        </span>{" "}
                        period {c.vote.period} proof from <span className="num">{shortenAddress(c.vote.proofOwner)}</span>
                        {c.vote.voided && <span className="text-faint"> · vote already cancelled</span>}
                      </p>
                      {c.vote.proofNote && <p>Note: “{c.vote.proofNote}”</p>}
                      <a href={c.vote.proofLink} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
                        Open the proof <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {c.contractChallengeId && (
                    <Link href={`/challenges/${c.contractChallengeId}`} className="text-xs link">
                      {c.challengeName || `Challenge #${c.contractChallengeId}`}
                      {c.settled && " · settled"}
                    </Link>
                  )}
                </div>

                {c.status === "OPEN" ? (
                  <div className="space-y-3">
                    <input
                      value={notes[c.id] || ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                      placeholder="Decision note (optional, shown to the penalised person)"
                      className="input"
                      maxLength={300}
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="well p-3 space-y-2">
                        <p className="text-xs text-dim">
                          The report is <span className="text-fg font-medium">true</span> — penalise{" "}
                          <span className="text-fg">{c.accused.name}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Btn c={c} action="uphold" remove={false} className="btn-secondary">
                            Uphold · −10
                          </Btn>
                          <Btn c={c} action="uphold" remove className="btn-danger">
                            <UserX className="w-3.5 h-3.5" /> Uphold & remove
                          </Btn>
                        </div>
                      </div>
                      <div className="well p-3 space-y-2">
                        <p className="text-xs text-dim">
                          The report is <span className="text-fg font-medium">false</span> — penalise{" "}
                          <span className="text-fg">{c.reporter.name}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Btn c={c} action="false" remove={false} className="btn-secondary">
                            False report · −10
                          </Btn>
                          <Btn c={c} action="false" remove className="btn-danger">
                            <UserX className="w-3.5 h-3.5" /> False & remove
                          </Btn>
                        </div>
                      </div>
                    </div>
                    <Btn c={c} action="dismiss" remove={false} className="btn-ghost border border-line">
                      Dismiss — no penalty
                    </Btn>
                    <p className="text-xs text-faint">
                      “Remove” takes the person out of this challenge: they can&apos;t submit or review any more and settle with zero
                      periods, so they get no payout or refund — their stake goes to the honest finishers.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-dim">
                    {STATUS_LABEL[c.status] || c.status}
                    {c.outcome && ` · ${c.outcome.toLowerCase().replaceAll("_", " ").replaceAll(",", ", ")}`}
                    {c.resolvedAt && ` · ${new Date(c.resolvedAt).toLocaleDateString()}`}
                    {c.resolution && ` — “${c.resolution}”`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-bad" />
            <h2 className="text-xl font-semibold text-fg">Removed from challenges</h2>
          </div>
          {people.removed.length === 0 ? (
            <p className="text-sm text-dim">No one has been removed.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {people.removed.map((r) => {
                const settled = r.challenge.status === "FINALIZED" || r.challenge.status === "CANCELLED";
                return (
                  <li key={`${r.wallet}:${r.challenge.contractChallengeId}`} className="p-4 flex items-center gap-3">
                    <Avatar src={r.avatar} seed={r.wallet} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-fg truncate">{r.name}</p>
                      <p className="text-xs text-faint truncate">
                        {r.challenge.name}
                        {r.reason && ` · ${r.reason}`}
                      </p>
                    </div>
                    {!settled && (
                      <button
                        onClick={() => reinstate(r)}
                        disabled={!!busy}
                        className="btn-ghost btn-sm border border-line"
                        title="Undo the removal"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Reinstate
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-bad" />
            <h2 className="text-xl font-semibold text-fg">Suspended (below 25)</h2>
          </div>
          {people.suspended.length === 0 ? (
            <p className="text-sm text-dim">No one is suspended.</p>
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {people.suspended.map((u) => (
                <li key={u.wallet} className="p-4 flex items-center gap-3">
                  <Avatar src={u.avatar} seed={u.wallet} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg truncate">{u.name}</p>
                    <p className="text-xs text-faint">
                      {u.reputation?.score}/100
                      {u.reputation?.nextRecovery && ` · +2 on ${new Date(u.reputation.nextRecovery).toDateString()}`}
                    </p>
                  </div>
                  <ReputationBadge rep={u.reputation} compact />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Person({ p, removed }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Avatar src={p.avatar} seed={p.wallet} size={26} />
      <span className="text-fg font-medium">{p.name}</span>
      <ReputationBadge rep={p.reputation} compact />
      {removed && <span className="chip text-bad border-bad/25 bg-bad/10">removed</span>}
    </span>
  );
}

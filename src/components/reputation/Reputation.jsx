"use client";

import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Ban, Flag, X, UserX } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Spinner } from "@/components/ui/primitives";

const LEVELS = {
  Trusted: { cls: "text-ok bg-ok/10 border-ok/25", icon: ShieldCheck },
  Fair: { cls: "text-warn bg-warn/10 border-warn/25", icon: ShieldCheck },
  "At risk": { cls: "text-bad bg-bad/10 border-bad/25", icon: ShieldAlert },
  Suspended: { cls: "text-bad bg-bad/15 border-bad/40", icon: Ban },
};

/** Small reputation pill: "Trusted · 100". */
export function ReputationBadge({ rep, compact = false }) {
  if (!rep) return null;
  const { cls, icon: Icon } = LEVELS[rep.level] || LEVELS.Fair;
  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-semibold whitespace-nowrap ${cls}`}
      title={`Reputation ${rep.score}/100 · ${rep.upheld} upheld complaint${rep.upheld === 1 ? "" : "s"}`}
    >
      <Icon className="w-3 h-3" />
      {rep.level}
      {!compact && <span className="num opacity-80">· {rep.score}</span>}
    </span>
  );
}

/** Loads reputations for a list of wallets → { [wallet]: rep } */
export function useReputations(wallets) {
  const key = [...new Set((wallets || []).map((w) => String(w).toLowerCase()))].sort().join(",");
  const [reps, setReps] = useState({});
  useEffect(() => {
    if (!key) return setReps({});
    let cancelled = false;
    fetch(`/api/reputation?wallets=${key}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setReps(d.reputations || {}))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);
  return reps;
}

/**
 * Dialog for reporting a vote (or a person). The admin reviews every report;
 * nothing happens to the accused until then.
 */
export function ReportDialog({ target, reporter, onClose, onDone }) {
  const toast = useToast();
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  if (!target) return null;

  const what =
    target.decision === "APPROVE"
      ? "approved proof that doesn't meet the rules"
      : target.decision === "REJECT"
      ? "rejected proof that meets the rules"
      : "broke the challenge rules";

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch("/api/complaints", {
        method: "POST",
        wallet: reporter,
        json: {
          reporterAddress: reporter,
          verificationId: target.verificationId || undefined,
          accusedAddress: target.wallet,
          contractChallengeId: target.contractChallengeId,
          details,
        },
      });
      toast.success("Report sent", "The admin will review it. Thanks for keeping things fair.");
      onDone?.();
      onClose();
    } catch (err) {
      toast.error("Couldn't send report", err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <form onSubmit={send} className="card bg-panel w-full max-w-md p-6 space-y-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-bad/15 text-bad grid place-items-center">
              <Flag className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-fg">Report {target.name}</h3>
              <p className="text-xs text-dim">They {what}.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center rounded-full hover:bg-raised text-dim" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="label" htmlFor="report-details">
            What happened?
          </label>
          <textarea
            id="report-details"
            rows={4}
            required
            minLength={10}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="e.g. The link shows a commit from last week, not this period."
            className="input"
          />
          <p className="text-xs text-faint mt-2">
            The admin reviews every report. If it&apos;s upheld, the vote is cancelled, their reputation drops by 10 and they can be
            removed from the challenge without a refund. Reports the admin rules false cost <strong>you</strong> 10 reputation and
            can get you removed instead.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={sending || details.trim().length < 10} className="btn-danger">
            {sending ? <Spinner /> : <Flag className="w-4 h-4" />} Send report
          </button>
        </div>
      </form>
    </div>
  );
}

/** Banner for someone whose reputation fell below 25. */
export function SuspendedBanner({ rep }) {
  if (!rep?.suspended) return null;
  return (
    <div className="flex gap-3 p-4 rounded-2xl border border-bad/40 bg-bad/[0.07] text-sm animate-fade-up">
      <Ban className="w-5 h-5 text-bad shrink-0" />
      <div>
        <p className="font-medium text-fg">Your account is suspended</p>
        <p className="text-dim mt-0.5">
          Your reputation is <span className="num text-fg">{rep.score}/100</span> — below 25. You can&apos;t join, create, submit
          proof, review or report until it&apos;s back to 25. It recovers +2 every 4 days
          {rep.nextRecovery ? ` (next on ${new Date(rep.nextRecovery).toDateString()})` : ""}.
        </p>
      </div>
    </div>
  );
}

/** Banner for someone the admin removed from a challenge. */
export function RemovedBanner({ reason }) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl border border-bad/40 bg-bad/[0.07] text-sm animate-fade-up">
      <UserX className="w-5 h-5 text-bad shrink-0" />
      <div>
        <p className="font-medium text-fg">You were removed from this challenge</p>
        <p className="text-dim mt-0.5">
          The admin upheld a complaint against you{reason ? ` (“${reason}”)` : ""}. You can&apos;t submit or review here any more,
          and you won&apos;t get a payout or refund — your stake goes to the honest finishers.
        </p>
      </div>
    </div>
  );
}

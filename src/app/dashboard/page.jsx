"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useInvitations } from "@/context/InvitationsContext";
import { useProfile } from "@/context/ProfileContext";
import { SuspendedBanner } from "@/components/reputation/Reputation";
import { getWriteContract, readPosition, friendlyTxError } from "@/lib/chain";
import { formatEth, formatTimeLeft } from "@/lib/formatters";
import { Avatar, AvatarStack, peopleFromParticipants } from "@/components/ui/Avatar";
import { Spinner, ProgressRing, EthCountUp, CategoryTile, Skeleton } from "@/components/ui/primitives";
import {
  Wallet,
  ArrowRight,
  Coins,
  Upload,
  ShieldCheck,
  Gavel,
  Undo2,
  CalendarClock,
  Mail,
  Compass,
  Plus,
  Check,
  PartyPopper,
  Droplets,
  Pencil,
} from "lucide-react";

const DAY = 86400000;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const left = (t) => formatTimeLeft(t).replace(" left", "");

/** Turns challenges + on-chain positions into a prioritised to-do list. */
function buildTasks(challenges, positions, wallet) {
  const now = Date.now();
  const tasks = [];
  for (const c of challenges) {
    const start = new Date(c.startTime).getTime();
    const end = new Date(c.endTime).getTime();
    const closed = c.status === "FINALIZED" || c.status === "CANCELLED";
    const pos = positions[c.contractChallengeId];
    const count = c.participants?.length || 0;
    const base = { challenge: c };

    if (pos && BigInt(pos.claimable || "0") > 0n) {
      tasks.push({ ...base, key: `w${c.id}`, type: "withdraw", rank: 0, amount: pos.claimable });
      continue;
    }
    if (!closed && now >= start && count < 2) {
      if (!pos?.hasWithdrawn) tasks.push({ ...base, key: `r${c.id}`, type: "refund", rank: 2 });
      continue;
    }
    if (!closed && now >= start && now < end) {
      const current = c.periods?.find((p) => now >= new Date(p.startTime) && now < new Date(p.endTime));
      if (current && !current.proofs.some((pr) => pr.participantAddress.toLowerCase() === wallet)) {
        tasks.push({ ...base, key: `p${c.id}`, type: "proof", rank: 1, due: current.endTime, period: current.periodNumber });
      }
    }
    if (!closed && now >= end && count >= 2) tasks.push({ ...base, key: `s${c.id}`, type: "settle", rank: 3 });
    if (!closed) {
      const toReview = (c.periods || [])
        .flatMap((p) => p.proofs)
        .filter(
          (pr) =>
            pr.participantAddress.toLowerCase() !== wallet &&
            !pr.verifications.some((v) => v.verifierAddress.toLowerCase() === wallet)
        );
      if (toReview.length) tasks.push({ ...base, key: `v${c.id}`, type: "review", rank: 4, count: toReview.length });
    }
    if (now < start && start - now < 3 * DAY) tasks.push({ ...base, key: `u${c.id}`, type: "upcoming", rank: 5, due: c.startTime });
  }
  return tasks.sort((a, b) => a.rank - b.rank || new Date(a.due || 0) - new Date(b.due || 0));
}

const TASK_UI = {
  withdraw: { icon: Coins, tone: "bg-lime text-ink", cta: "Withdraw" },
  proof: { icon: Upload, tone: "bg-lime/15 text-lime", cta: "Submit proof" },
  refund: { icon: Undo2, tone: "bg-warn/15 text-warn", cta: "Get stake back" },
  settle: { icon: Gavel, tone: "bg-violet/15 text-violet", cta: "Settle" },
  review: { icon: ShieldCheck, tone: "bg-violet/15 text-violet", cta: "Review" },
  upcoming: { icon: CalendarClock, tone: "bg-raised text-dim", cta: "Invite friends" },
};

export default function DashboardPage() {
  const { account, connectWallet, setTxState, updateAccountAndBalance, balance, isConnecting } = useWeb3();
  const { invitations, setIsModalOpen } = useInvitations();
  const { profile, wallet, reputation } = useProfile();

  const [challenges, setChallenges] = useState(null);
  const [positions, setPositions] = useState({});
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    if (!wallet) return setChallenges([]);
    try {
      const res = await fetch(`/api/challenges?visibility=All&withProgress=1&userAddress=${wallet}`, { cache: "no-store" });
      const data = await res.json();
      setChallenges(
        (data.challenges || []).filter((c) => c.participants?.some((p) => p.walletAddress.toLowerCase() === wallet))
      );
    } catch {
      setChallenges([]);
    }
  }, [wallet]);

  useEffect(() => {
    setChallenges(null);
    load();
  }, [load]);

  const idsKey = (challenges || []).map((c) => c.contractChallengeId).join(",");
  const loadPositions = useCallback(async () => {
    if (!wallet || !idsKey) return setPositions({});
    const entries = await Promise.all(
      idsKey.split(",").map((id) =>
        readPosition(Number(id), wallet)
          .then((p) => [id, p])
          .catch(() => [id, null])
      )
    );
    setPositions(Object.fromEntries(entries));
  }, [wallet, idsKey]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const tasks = useMemo(() => buildTasks(challenges || [], positions, wallet), [challenges, positions, wallet]);
  const withdrawable = Object.values(positions).reduce((s, p) => s + BigInt(p?.claimable || "0"), 0n);
  const live = (challenges || []).filter((c) => c.status !== "FINALIZED" && c.status !== "CANCELLED");
  const past = (challenges || []).filter((c) => c.status === "FINALIZED" || c.status === "CANCELLED");
  const pendingInvites = invitations.filter((i) => i.status === "PENDING" && !i.isEnrolled && !i.isExpired);

  const withdraw = async (task) => {
    if (!account) return connectWallet();
    setBusy(task.key);
    try {
      setTxState({ status: "preparing", title: "Withdrawing payout", txHash: null, error: null });
      const protocol = await getWriteContract(task.challenge.contractChallengeId);
      await protocol.withdraw.staticCall(task.challenge.contractChallengeId);
      setTxState({ status: "waiting_wallet", title: "Confirm withdrawal", txHash: null, error: null });
      const tx = await protocol.withdraw(task.challenge.contractChallengeId);
      setTxState({ status: "submitted", title: "Withdrawing…", txHash: tx.hash, error: null });
      await tx.wait();
      setTxState({ status: "confirmed", title: `${formatEth(task.amount)} sent to your wallet`, txHash: tx.hash, error: null });
      updateAccountAndBalance(account);
    } catch (err) {
      setTxState({ status: "failed", title: "Withdrawal failed", txHash: null, error: friendlyTxError(err) });
    } finally {
      setBusy(null);
      loadPositions();
    }
  };

  // ---------- Not connected ----------
  if (!wallet) {
    return (
      <div className="shell py-12">
        <div className="card-glow relative overflow-hidden p-8 sm:p-12 text-center max-w-2xl mx-auto animate-fade-up">
          <div aria-hidden className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-lime/10 blur-3xl" />
          <div className="relative flex justify-center -space-x-3 mb-6">
            {["a1", "b2", "c3", "d4"].map((s, i) => (
              <span key={s} className="rounded-full ring-4 ring-panel animate-float" style={{ animationDelay: `${i * 0.4}s` }}>
                <Avatar seed={s} size={52} />
              </span>
            ))}
          </div>
          <h1 className="relative text-3xl sm:text-4xl font-bold text-fg">Your challenges live here</h1>
          <p className="relative text-dim mt-3 max-w-md mx-auto">
            Connect your wallet to see what&apos;s due today, review your group&apos;s proof and collect your payouts.
          </p>
          <div className="relative mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={connectWallet} disabled={isConnecting} className="btn-primary btn-lg">
              <Wallet className="w-4 h-4" /> {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
            <Link href="/learn" className="btn-secondary btn-lg">
              I&apos;m new — show me how
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const name = profile?.name?.split(" ")[0] || "there";
  const loading = challenges === null;

  return (
    <div className="shell py-10 space-y-10">
      {/* ---------- Greeting ---------- */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 animate-fade-up">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="group relative" aria-label="My account">
            <span className="block rounded-full ring-4 ring-lime/20 group-hover:animate-wiggle">
              <Avatar src={profile?.avatar} seed={wallet} size={64} />
            </span>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-fg text-ink grid place-items-center opacity-0 group-hover:opacity-100 transition">
              <Pencil className="w-3 h-3" />
            </span>
          </Link>
          <div>
            <p className="text-sm text-dim">{greeting()},</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-fg leading-tight">{name} 👋</h1>
            <p className="text-sm text-dim mt-1">
              {loading
                ? "Checking your challenges…"
                : tasks.length
                ? `You have ${tasks.length} thing${tasks.length === 1 ? "" : "s"} to do.`
                : live.length
                ? "You're all caught up. Nice."
                : "Ready for your first challenge?"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/explore" className="btn-secondary">
            <Compass className="w-4 h-4" /> Explore
          </Link>
          <Link href="/create" className="btn-primary">
            <Plus className="w-4 h-4" /> New
          </Link>
        </div>
      </section>

      <SuspendedBanner rep={reputation} />

      {/* ---------- Quick stats ---------- */}
      <section className="grid grid-cols-3 gap-3">
        {[
          ["Live", loading ? null : live.length, false],
          ["Finished", loading ? null : past.length, false],
          ["To withdraw", withdrawable, true],
        ].map(([label, v, isEth]) => (
          <div key={label} className={`card p-4 sm:p-5 ${isEth && withdrawable > 0n ? "border-lime/40" : ""}`}>
            <p className="eyebrow">{label}</p>
            <div className={`num text-xl sm:text-3xl font-semibold mt-2 ${isEth && withdrawable > 0n ? "text-lime" : "text-fg"}`}>
              {v === null ? <Skeleton className="h-8 w-12" /> : isEth ? <EthCountUp wei={v} /> : v}
            </div>
          </div>
        ))}
      </section>

      {/* ---------- Up next ---------- */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-fg">What to do next</h2>
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          live.length ? (
            <div className="card p-6 flex items-center gap-4 animate-pop">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-ok/15 text-ok grid place-items-center">
                <PartyPopper className="w-6 h-6" />
              </span>
              <div>
                <p className="font-medium text-fg">All caught up</p>
                <p className="text-sm text-dim">Nothing is due right now. Your next proof shows up here when its period opens.</p>
              </div>
            </div>
          ) : (
            <GettingStarted balance={balance} />
          )
        ) : (
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <TaskRow key={t.key} task={t} index={i} busy={busy === t.key} onWithdraw={() => withdraw(t)} />
            ))}
          </ul>
        )}
      </section>

      {/* ---------- Invitations ---------- */}
      {pendingInvites.length > 0 && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="card-hover w-full p-5 flex items-center gap-4 text-left border-violet/30"
        >
          <span className="w-11 h-11 rounded-2xl bg-violet/15 text-violet grid place-items-center">
            <Mail className="w-5 h-5" />
          </span>
          <span className="flex-1">
            <span className="block font-medium text-fg">
              {pendingInvites.length} private invitation{pendingInvites.length === 1 ? "" : "s"}
            </span>
            <span className="block text-sm text-dim">Someone wants you in their challenge.</span>
          </span>
          <ArrowRight className="w-4 h-4 text-faint" />
        </button>
      )}

      {/* ---------- Challenges ---------- */}
      {live.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-fg">Your challenges</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {live.map((c) => (
              <ChallengeTile key={c.id} c={c} wallet={wallet} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-fg">Finished</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {past.map((c) => (
              <ChallengeTile key={c.id} c={c} wallet={wallet} position={positions[c.contractChallengeId]} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskRow({ task: t, index, busy, onWithdraw }) {
  const ui = TASK_UI[t.type];
  const c = t.challenge;
  const href =
    t.type === "proof"
      ? `/challenges/${c.contractChallengeId}?tab=submit`
      : t.type === "review"
      ? `/challenges/${c.contractChallengeId}?tab=review`
      : `/challenges/${c.contractChallengeId}`;

  const title = {
    withdraw: `Withdraw ${formatEth(t.amount)}`,
    proof: `Submit proof for period ${t.period}`,
    refund: "Not enough people joined — take your stake back",
    settle: "Challenge ended — settle to unlock payouts",
    review: `Review ${t.count} proof${t.count === 1 ? "" : "s"} from your group`,
    upcoming: `Starts in ${left(t.due)}`,
  }[t.type];

  return (
    <li className="card p-4 flex items-center gap-4 animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
      <span className={`w-11 h-11 shrink-0 rounded-2xl grid place-items-center ${ui.tone}`}>
        <ui.icon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg truncate">{title}</p>
        <p className="text-sm text-dim truncate">
          {c.name}
          {t.type === "proof" && <span className="text-warn"> · due in {left(t.due)}</span>}
        </p>
      </div>
      {t.type === "withdraw" ? (
        <button onClick={onWithdraw} disabled={busy} className="btn-primary btn-sm shrink-0">
          {busy ? <Spinner className="w-3.5 h-3.5" /> : <Coins className="w-3.5 h-3.5" />}
          {ui.cta}
        </button>
      ) : (
        <Link href={href} className={`${t.type === "proof" ? "btn-primary" : "btn-secondary"} btn-sm shrink-0`}>
          <span className="hidden sm:inline">{ui.cta}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </li>
  );
}

function GettingStarted({ balance }) {
  const funded = parseFloat(balance || "0") > 0;
  const steps = [
    { done: true, title: "Connect your wallet", body: "Done — you're in." },
    { done: funded, title: "Get free test ETH", body: "You need a little Sepolia ETH to stake.", href: "/learn#faucet", cta: "Get ETH" },
    { done: false, title: "Join your first challenge", body: "Pick a goal and stake on it.", href: "/explore", cta: "Explore" },
  ];
  return (
    <div className="card p-6 space-y-5 animate-fade-up">
      <div className="flex items-center gap-3">
        <Droplets className="w-5 h-5 text-lime" />
        <div>
          <p className="font-semibold text-fg">Let&apos;s get you started</p>
          <p className="text-sm text-dim">Three quick steps and you&apos;re committed.</p>
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-4">
            <span
              className={`w-8 h-8 shrink-0 rounded-full grid place-items-center text-sm font-semibold ${
                s.done ? "bg-lime text-ink" : "border border-line-strong text-faint"
              }`}
            >
              {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${s.done ? "text-dim line-through decoration-faint" : "text-fg"}`}>{s.title}</p>
              <p className="text-xs text-faint">{s.body}</p>
            </div>
            {!s.done && s.href && (
              <Link href={s.href} className="btn-secondary btn-sm shrink-0">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ChallengeTile({ c, wallet, position }) {
  const me = c.participants.find((p) => p.walletAddress.toLowerCase() === wallet);
  const done = me?.completedPeriods || 0;
  const total = c.totalPeriods || 1;
  const pct = Math.round((done / total) * 100);
  const now = Date.now();

  let sub;
  if (c.status === "FINALIZED") sub = position?.hasWithdrawn ? "Payout withdrawn" : "Settled";
  else if (c.status === "CANCELLED") sub = position?.hasWithdrawn ? "Stake returned" : "Closed";
  else if (now < new Date(c.startTime)) sub = `Starts in ${left(c.startTime)}`;
  else if (now < new Date(c.endTime)) sub = `Ends in ${left(c.endTime)}`;
  else sub = "Ended — ready to settle";

  return (
    <Link href={`/challenges/${c.contractChallengeId}`} className="card-hover group p-5 flex items-center gap-4">
      <ProgressRing value={pct} size={56} tone={pct >= c.qualificationThreshold ? "ok" : "lime"}>
        <span className="num text-xs text-fg">{pct}%</span>
      </ProgressRing>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <CategoryTile category={c.category} size="sm" />
          <p className="font-medium text-fg truncate group-hover:text-lime transition">{c.name}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-dim truncate">
            <span className="num text-fg">
              {done}/{total}
            </span>{" "}
            verified · {sub}
          </span>
          <AvatarStack people={peopleFromParticipants(c.participants)} max={3} size={20} />
        </div>
      </div>
    </Link>
  );
}

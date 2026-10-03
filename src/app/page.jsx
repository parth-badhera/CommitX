"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Target,
  Lock,
  Upload,
  Users,
  Coins,
  ShieldCheck,
  Scale,
  HandCoins,
  Check,
  BookOpen,
  Download,
} from "lucide-react";
import { formatEth } from "@/lib/formatters";
import { ChallengeCard, CategoryTile, Skeleton } from "@/components/ui/primitives";
import { CATEGORIES } from "@/components/ui/categories";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  { icon: Target, title: "Commit", body: "Pick a goal and a rhythm you'll actually keep — daily gym, a commit every two days." },
  { icon: Lock, title: "Stake", body: "Lock test ETH in the contract. No one else holds it, including us." },
  { icon: Upload, title: "Prove", body: "Post a link each period: a GitHub commit, a Strava run, a study log." },
  { icon: Users, title: "Verify", body: "Your cohort reviews each other. A third must approve. No self-votes." },
  { icon: Coins, title: "Withdraw", body: "Settlement is signed and checked on-chain. You pull your payout." },
];

export default function LandingPage() {
  const [featured, setFeatured] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("/api/challenges?visibility=Public")
      .then((r) => r.json())
      .then((d) => setFeatured((d.challenges || []).filter((c) => c.status === "OPEN" || c.status === "ACTIVE").slice(0, 3)))
      .catch(() => setFeatured([]));
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="overflow-x-clip">
      {/* HERO */}
      <section className="shell pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-center">
        <div className="space-y-8">
          <span className="chip animate-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" /> Live on Sepolia · free to try
          </span>
          <h1
            className="text-[3.4rem] leading-[0.92] sm:text-7xl lg:text-[5.6rem] font-extrabold text-fg animate-fade-up"
            style={{ animationDelay: "60ms" }}
          >
            Put money
            <br />
            on <span className="text-gradient">your word.</span>
          </h1>
          <p className="text-lg sm:text-xl text-dim max-w-xl leading-relaxed animate-fade-up" style={{ animationDelay: "120ms" }}>
            Stake ETH on a goal, prove your progress to a small cohort, and earn your stake back — plus a share of what
            the quitters leave behind.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "180ms" }}>
            <Link href="/create" className="btn-primary btn-lg">
              Start a challenge <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/explore" className="btn-secondary btn-lg">
              Browse challenges
            </Link>
          </div>
          <Link
            href="/learn"
            className="inline-flex items-center gap-2 text-sm text-dim hover:text-fg transition animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <BookOpen className="w-4 h-4 text-violet" />
            Never used a crypto wallet? <span className="text-fg underline underline-offset-4 decoration-line-strong">Start with the 10-minute guide</span>
          </Link>
        </div>
        <HeroVisual />
      </section>

      {/* CATEGORY MARQUEE */}
      <section className="border-y border-line bg-panel/40 py-5 mask-fade-x">
        <div className="flex w-max animate-marquee gap-3">
          {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <span key={i} className="flex items-center gap-2.5 pr-6 text-dim">
              <CategoryTile category={c} size="sm" />
              <span className="text-sm whitespace-nowrap">{c}</span>
            </span>
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="shell py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["Total staked", stats ? formatEth(stats.totalVolumeWei || "0") : null],
            ["Challenges", stats?.totalChallenges],
            ["Participants", stats?.totalParticipants],
            ["Settled", stats?.finalizedChallenges],
          ].map(([label, value], i) => (
            <Reveal key={label} delay={i * 60}>
              <div className="card p-6">
                <p className="eyebrow">{label}</p>
                {value === undefined || value === null ? (
                  <Skeleton className="h-9 w-24 mt-3" />
                ) : (
                  <p className="num text-3xl sm:text-4xl font-semibold text-fg mt-3 tracking-tight">{value}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="shell py-16 space-y-12">
        <Reveal className="max-w-2xl space-y-4">
          <p className="eyebrow">How it works</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-fg leading-[1.02]">Five steps. No trust required.</h2>
          <p className="text-dim leading-relaxed">
            The server coordinates proofs and votes, but it can't move your money. Only a signed, on-chain-verified
            settlement can — and only you can withdraw.
          </p>
        </Reveal>
        <div className="relative grid md:grid-cols-5 gap-4">
          <div aria-hidden className="hidden md:block absolute top-7 left-[10%] right-[10%] h-px bg-gradient-to-r from-lime/0 via-lime/40 to-violet/0" />
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 80}>
              <div className="relative space-y-4">
                <span className="relative z-10 w-14 h-14 rounded-2xl bg-panel border border-line grid place-items-center shadow-lift">
                  <s.icon className="w-6 h-6 text-lime" />
                  <span className="num absolute -top-2 -right-2 w-6 h-6 rounded-full bg-lime text-ink text-[11px] font-bold grid place-items-center">
                    {i + 1}
                  </span>
                </span>
                <h3 className="text-xl font-semibold text-fg">{s.title}</h3>
                <p className="text-sm text-dim leading-relaxed">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SIMULATOR */}
      <section className="shell py-16">
        <Reveal>
          <PayoutSimulator />
        </Reveal>
      </section>

      {/* TRUST */}
      <section className="shell py-16 grid md:grid-cols-3 gap-4">
        {[
          [ShieldCheck, "Non-custodial", "Stakes live in a public contract. The backend can coordinate, but never move funds."],
          [Scale, "Exact math", "Every payout is integer-wei arithmetic in the contract. Rounding dust goes to the treasury."],
          [HandCoins, "You pull, we don't push", "Payouts wait in the contract until you withdraw — on your schedule."],
        ].map(([Icon, title, body], i) => (
          <Reveal key={title} delay={i * 80}>
            <div className="card p-6 h-full space-y-4">
              <Icon className="w-6 h-6 text-violet" />
              <h3 className="text-lg font-semibold text-fg">{title}</h3>
              <p className="text-sm text-dim leading-relaxed">{body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* FEATURED */}
      <section className="shell py-16 space-y-8">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Open now</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-fg mt-2">Join a cohort</h2>
          </div>
          <Link href="/explore" className="btn-ghost">
            View all <ArrowUpRight className="w-4 h-4" />
          </Link>
        </Reveal>
        {featured === null ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((c, i) => (
              <Reveal key={c.id} delay={i * 80}>
                <ChallengeCard challenge={c} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="card dotgrid p-12 text-center space-y-4">
            <p className="text-dim">No open challenges right now. Be the first.</p>
            <Link href="/create" className="btn-primary">
              Start a challenge
            </Link>
          </div>
        )}
      </section>

      {/* LEARN BANNER */}
      <section className="shell py-16">
        <Reveal>
          <div className="card-glow relative overflow-hidden p-8 sm:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
            <div aria-hidden className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-violet/20 blur-3xl" />
            <div className="relative space-y-3 max-w-xl">
              <p className="eyebrow">Beginner's guide</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-fg">First time with crypto? We'll walk you through it.</h2>
              <p className="text-dim leading-relaxed">
                Install MetaMask, get free test ETH, connect, and join your first challenge — step by step, with a
                printable PDF manual.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row md:flex-col gap-2">
              <Link href="/learn" className="btn-primary btn-lg">
                Open the guide <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="/commitx-manual.pdf" download="CommitX-Beginner-Manual.pdf" className="btn-secondary btn-lg">
                <Download className="w-4 h-4" /> Download PDF
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/* ---------------- Hero visual ---------------- */

function HeroVisual() {
  const cells = 21;
  return (
    <div className="relative animate-fade-up" style={{ animationDelay: "200ms" }}>
      <div aria-hidden className="absolute -inset-10 bg-[radial-gradient(closest-side,rgba(215,255,62,0.18),transparent)] blur-2xl" />
      <div className="relative card-glow p-6 space-y-6 rotate-[1.5deg] hover:rotate-0 transition duration-500">
        <div className="flex items-center gap-3">
          <CategoryTile category="Coding" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-faint">Coding · 8 people</p>
            <p className="text-base font-semibold text-fg truncate">Ship code every day</p>
          </div>
          <span className="chip text-lime border-lime/25 bg-lime/10">
            <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" /> Day 14
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: cells }).map((_, i) => (
            <span
              key={i}
              className={`h-7 rounded-md origin-left animate-fill ${
                i < 13 ? (i === 5 ? "bg-bad/50" : "bg-lime/85") : i === 13 ? "bg-warn animate-pulse" : "bg-raised border border-line"
              }`}
              style={{ animationDelay: `${300 + i * 40}ms` }}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden bg-line border border-line text-xs">
          {[
            ["Staked", "0.05 ETH", "text-fg"],
            ["Kept so far", "0.029 ETH", "text-fg"],
            ["Est. payout", "0.061 ETH", "text-lime font-semibold"],
          ].map(([k, v, tone]) => (
            <div key={k} className="bg-panel px-3 py-2.5">
              <span className="block text-faint mb-1">{k}</span>
              <span className={`num ${tone}`}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute -left-4 sm:-left-10 bottom-10 card bg-panel px-4 py-3 flex items-center gap-3 animate-float shadow-2xl">
        <span className="w-8 h-8 rounded-lg bg-ok/15 text-ok grid place-items-center">
          <Check className="w-4 h-4" strokeWidth={3} />
        </span>
        <span>
          <span className="block text-xs text-fg font-medium">Proof approved</span>
          <span className="block text-[11px] text-faint num">3 / 3 peers</span>
        </span>
      </div>
      <div
        className="absolute -right-2 sm:-right-6 -top-6 card bg-panel px-4 py-3 animate-float shadow-2xl"
        style={{ animationDelay: "1.5s" }}
      >
        <span className="block text-[11px] text-faint">Bonus from pool</span>
        <span className="block num text-sm text-lime font-semibold">+0.012 ETH</span>
      </div>
    </div>
  );
}

/* ---------------- Payout simulator ---------------- */

function Slider({ label, value, set, min, max, step = 1, fmt }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-dim">{label}</span>
        <span className="num text-fg">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="range" />
    </div>
  );
}

function PayoutSimulator() {
  const [stake, setStake] = useState(0.05);
  const [periods, setPeriods] = useState(30);
  const [mine, setMine] = useState(27);
  const [people, setPeople] = useState(8);
  const [others, setOthers] = useState(60);
  const threshold = 50;

  // Mirrors CommitXProtocol.finalizeChallenge, assuming everyone else completes `others`% of periods.
  // Settlement runs on the stake after the 0.125% joining fee.
  const r = useMemo(() => {
    const paid = stake;
    const fee = paid * 0.00125;
    const S = paid - fee;
    const T = periods;
    const c = Math.min(mine, T);
    const co = Math.round((others / 100) * T);
    const n = people;
    const keptMine = (S * c) / T;
    const keptOther = (S * co) / T;
    const pool = S - keptMine + (n - 1) * (S - keptOther);
    const iQualify = c * 100 >= threshold * T;
    const othersQualify = co * 100 >= threshold * T;
    const weight = (iQualify ? c : 0) + (othersQualify ? (n - 1) * co : 0);
    const bonus = iQualify && weight > 0 ? (pool * c) / weight : 0;
    const total = keptMine + bonus;
    return { fee, keptMine, bonus, total, pool, iQualify, delta: ((total - paid) / paid) * 100 };
  }, [stake, periods, mine, people, others]);

  useEffect(() => {
    if (mine > periods) setMine(periods);
  }, [periods, mine]);

  return (
    <div className="card overflow-hidden grid lg:grid-cols-[1.1fr_1fr]">
      <div className="p-6 sm:p-10 space-y-7">
        <div className="space-y-3">
          <p className="eyebrow">Payout calculator</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-fg leading-tight">See what showing up is worth.</h2>
          <p className="text-sm text-dim">Uses the contract&apos;s exact formula, including the 0.125% joining fee. Threshold fixed at {threshold}% for this demo.</p>
        </div>
        <Slider label="Your stake" value={stake} set={setStake} min={0.01} max={0.5} step={0.01} fmt={(v) => `${v.toFixed(2)} ETH`} />
        <Slider label="Periods in the challenge" value={periods} set={setPeriods} min={5} max={60} />
        <Slider label="Periods you complete" value={mine} set={setMine} min={0} max={periods} fmt={(v) => `${v} / ${periods}`} />
        <Slider label="People in the cohort" value={people} set={setPeople} min={2} max={30} />
        <Slider label="How well everyone else does" value={others} set={setOthers} min={0} max={100} step={5} fmt={(v) => `${v}%`} />
      </div>
      <div className="relative p-6 sm:p-10 bg-raised/60 border-t lg:border-t-0 lg:border-l border-line flex flex-col justify-center gap-6">
        <div aria-hidden className="absolute inset-0 dotgrid opacity-60" />
        <div className="relative">
          <p className="eyebrow">You'd withdraw</p>
          <p className="num text-5xl sm:text-6xl font-semibold text-lime mt-3 tracking-tight">{r.total.toFixed(4)}</p>
          <p className="text-sm text-dim mt-1">ETH</p>
        </div>
        <div className="relative divide-y divide-line text-sm">
          <div className="flex justify-between py-2.5">
            <span className="text-dim">Joining fee (0.125%)</span>
            <span className="num text-faint">−{r.fee.toFixed(6)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-dim">Stake kept</span>
            <span className="num text-fg">{r.keptMine.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-dim">Bonus from pool</span>
            <span className={`num ${r.bonus > 0 ? "text-ok" : "text-faint"}`}>+{r.bonus.toFixed(4)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-dim">vs. your stake</span>
            <span className={`num ${r.delta >= 0 ? "text-ok" : "text-bad"}`}>
              {r.delta >= 0 ? "+" : ""}
              {r.delta.toFixed(1)}%
            </span>
          </div>
        </div>
        <p className={`relative text-sm ${r.iQualify ? "text-ok" : "text-warn"}`}>
          {r.iQualify
            ? "You qualify for a share of the penalty pool."
            : `Complete ${Math.ceil((threshold * periods) / 100)} periods to qualify for the bonus.`}
        </p>
      </div>
    </div>
  );
}

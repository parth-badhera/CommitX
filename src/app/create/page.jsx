"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { useWeb3 } from "@/context/Web3Context";
import { useToast } from "@/context/ToastContext";
import { CONTRACT_ADDRESS, EXPLORER, getReadContract, getWriteContract, friendlyTxError } from "@/lib/chain";
import { shortenAddress } from "@/lib/formatters";
import { Row, CategoryTile } from "@/components/ui/primitives";
import { apiFetch, retry } from "@/lib/api";
import { FEE_PERCENT_LABEL, FEE_NUMERATOR, FEE_DENOMINATOR } from "@/lib/network";
import { useProfile } from "@/context/ProfileContext";
import { SuspendedBanner } from "@/components/reputation/Reputation";
import { CATEGORIES } from "@/components/ui/categories";
import { DateTimePicker, formatFriendly, formatClock } from "@/components/ui/DateTimePicker";
import { ArrowLeft, ArrowRight, Check, Globe, Lock, X, AlertTriangle, ExternalLink, Users, Target } from "lucide-react";

const STEPS = [
  { label: "Basics", title: "What are you committing to?" },
  { label: "Schedule", title: "When does it happen?" },
  { label: "Stakes", title: "What's on the line?" },
  { label: "People", title: "Who's in?" },
  { label: "Launch", title: "Review & launch" },
];

const FREQUENCIES = [
  { id: "1", label: "Daily", desc: "Proof every day" },
  { id: "2", label: "Every 2 days", desc: "48h per period" },
  { id: "3", label: "Every 3 days", desc: "72h per period" },
  { id: "7", label: "Weekly", desc: "Once a week" },
];

const DURATIONS = [7, 14, 21, 30, 60];
const DAY = 86400000;

const roundUpToQuarter = (ms) => {
  const d = new Date(ms);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  d.setMinutes(m % 15 === 0 ? m : m + (15 - (m % 15)));
  return d;
};
const at = (daysAhead, hour) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const nextWeekday = (weekday, hour) => {
  const d = new Date();
  const add = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(hour, 0, 0, 0);
  return d;
};

export default function CreateChallengePage() {
  const router = useRouter();
  const { account, connectWallet, setTxState } = useWeb3();
  const toast = useToast();
  const { reputation } = useProfile();
  const suspended = Boolean(reputation?.suspended);

  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(1);
  const [error, setError] = useState(null);
  const [confirmedRules, setConfirmedRules] = useState(false);
  const [autoStake, setAutoStake] = useState(true);
  const [walletInput, setWalletInput] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Coding",
    isPrivate: false,
    // Filled in on mount — server and browser clocks/locales differ
    start: null,
    end: null,
    frequency: "1",
    customDays: "4",
    stakeEth: "0.05",
    qualificationThreshold: 50,
    maxParticipants: 50,
    invited: [],
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    const start = roundUpToQuarter(Date.now() + 60 * 60 * 1000);
    setForm((f) => (f.start ? f : { ...f, start, end: new Date(start.getTime() + 14 * DAY) }));
  }, []);

  const frequencyDays = useMemo(() => {
    if (form.frequency === "custom") {
      const n = parseInt(form.customDays, 10);
      return isNaN(n) || n < 1 ? 1 : Math.min(n, 30);
    }
    return parseInt(form.frequency, 10) || 1;
  }, [form.frequency, form.customDays]);

  const schedule = useMemo(() => {
    const startMs = form.start?.getTime();
    const endMs = form.end?.getTime();
    if (!startMs || !endMs || endMs <= startMs) return { isValid: false, totalPeriods: 0, durationDays: 0 };
    const durationMs = endMs - startMs;
    return {
      isValid: true,
      startMs,
      endMs,
      durationDays: Math.round((durationMs / DAY) * 10) / 10,
      totalPeriods: Math.max(1, Math.floor(durationMs / (frequencyDays * DAY))),
    };
  }, [form.start, form.end, frequencyDays]);

  const minToQualify = Math.ceil((schedule.totalPeriods * form.qualificationThreshold) / 100);

  const stakeWeiPreview = useMemo(() => {
    try {
      return form.stakeEth && parseFloat(form.stakeEth) > 0 ? ethers.parseEther(form.stakeEth) : 0n;
    } catch {
      return 0n;
    }
  }, [form.stakeEth]);
  const feeWeiPreview = (stakeWeiPreview * FEE_NUMERATOR) / FEE_DENOMINATOR;
  const netWeiPreview = stakeWeiPreview - feeWeiPreview;
  const fmt = (wei) => {
    const n = parseFloat(ethers.formatEther(wei));
    return n.toLocaleString(undefined, { maximumFractionDigits: 7 });
  };
  const minStart = new Date(Date.now() + 5 * 60 * 1000);

  // Moving the start keeps the chosen duration
  const setStart = (d) => {
    const duration = form.end && form.start ? form.end - form.start : 14 * DAY;
    if (!d) return;
    set({ start: d, end: new Date(d.getTime() + Math.max(duration, frequencyDays * DAY)) });
  };

  const validate = (s) => {
    if (s === 1 && !form.name.trim()) return "Give your challenge a name.";
    if (s === 2) {
      if (!schedule.isValid) return "The end has to be after the start.";
      if (schedule.startMs <= Date.now() + 60 * 1000) return "The start has to be in the future.";
      if (schedule.endMs - schedule.startMs < frequencyDays * DAY)
        return "The challenge must be at least one period long.";
    }
    if (s === 3) {
      if (!(parseFloat(form.stakeEth) > 0)) return "Stake must be more than 0.";
      if (Number(form.maxParticipants) < 2) return "At least 2 participants are needed.";
    }
    return null;
  };

  const goTo = (target) => {
    for (let s = 1; s < target; s++) {
      const msg = validate(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }
    setError(null);
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  };

  const addWallet = (e) => {
    e.preventDefault();
    const w = walletInput.trim().toLowerCase();
    if (!ethers.isAddress(w)) return setError("That doesn't look like a valid wallet address.");
    if (form.invited.includes(w)) return setError("That wallet is already on the list.");
    setError(null);
    set({ invited: [...form.invited, w] });
    setWalletInput("");
  };

  const submit = async () => {
    if (!account) return connectWallet();
    if (suspended) return toast.error("Account suspended", "Your reputation is below 25, so you can't create challenges yet.");
    const msg = validate(1) || validate(2) || validate(3);
    if (msg) return toast.error("Check your details", msg);
    if (!confirmedRules) return;

    try {
      setTxState({ status: "preparing", title: "Creating your challenge", txHash: null, error: null });

      const code = await getReadContract().runner.getCode(CONTRACT_ADDRESS);
      if (!code || code === "0x") {
        throw new Error(`No CommitX contract found at ${CONTRACT_ADDRESS}. Re-run the deploy script.`);
      }

      const protocol = await getWriteContract();
      const stakeWei = ethers.parseEther(form.stakeEth);
      const threshold = Number(form.qualificationThreshold);
      const startTime = Math.floor(schedule.startMs / 1000);
      const endTime = Math.floor(schedule.endMs / 1000);
      const verificationDuration = 86400;
      const maxParticipants = Number(form.maxParticipants);
      const isPrivate = Boolean(form.isPrivate);

      setTxState({ status: "waiting_wallet", title: "Confirm in MetaMask", txHash: null, error: null });
      const tx = await protocol.createChallenge(
        stakeWei,
        schedule.totalPeriods,
        threshold,
        startTime,
        endTime,
        verificationDuration,
        maxParticipants,
        isPrivate,
        `ipfs://commitx-${Date.now()}`,
        { value: autoStake ? stakeWei : 0n }
      );
      setTxState({ status: "submitted", title: "Creating on-chain…", txHash: tx.hash, error: null });
      const receipt = await tx.wait();

      let createdId = null;
      for (const log of receipt?.logs || []) {
        try {
          const parsed = protocol.interface.parseLog(log);
          if (parsed?.name === "ChallengeCreated") {
            createdId = Number(parsed.args.challengeId ?? parsed.args[0]);
            break;
          }
        } catch (_) {}
      }
      if (createdId === null || isNaN(createdId)) {
        createdId = Number(await getReadContract().nextChallengeId()) - 1;
      }

      if (isPrivate && form.invited.length > 0) {
        try {
          const wl = await protocol.whitelistParticipants(createdId, form.invited);
          await wl.wait();
        } catch (wlErr) {
          console.warn("On-chain whitelist notice:", wlErr);
        }
      }

      // Register display metadata; economic fields are read from the contract server-side.
      // Retries cover the public RPC lagging a few seconds behind the wallet's node.
      await retry(() =>
        apiFetch("/api/challenges", {
          method: "POST",
          json: {
            contractChallengeId: createdId,
            name: form.name,
            description: form.description,
            category: form.category,
            submissionFrequency: frequencyDays,
            initialInvitedWallets: form.invited,
            txHash: tx.hash,
          },
        })
      ).catch((err) => console.warn("Challenge metadata will sync on first view:", err.message));

      setTxState({ status: "confirmed", title: "Challenge created", txHash: tx.hash, error: null });
      setTimeout(() => router.push(`/challenges/${createdId}`), 1200);
    } catch (err) {
      console.error("Challenge creation error:", err);
      setTxState({ status: "failed", title: "Couldn't create challenge", txHash: null, error: friendlyTxError(err) });
    }
  };

  const startPresets = [
    { label: "In 1 hour", get: () => roundUpToQuarter(Date.now() + 60 * 60 * 1000) },
    { label: "Tonight 8 PM", get: () => (at(0, 20) > Date.now() + 5 * 60000 ? at(0, 20) : at(1, 20)) },
    { label: "Tomorrow 9 AM", get: () => at(1, 9) },
    { label: "Next Monday 9 AM", get: () => nextWeekday(1, 9) },
  ];
  const endPresets = form.start
    ? DURATIONS.map((d) => ({ label: `${d} days`, get: () => new Date(form.start.getTime() + d * DAY) }))
    : [];
  const activeDuration = DURATIONS.find(
    (d) => form.start && form.end && Math.abs(form.end - form.start - d * DAY) < 60000
  );

  return (
    <div className="shell py-12">
      <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-start">
        <div className="space-y-8 min-w-0">
          <SuspendedBanner rep={reputation} />
          <div className="space-y-3 animate-fade-up">
            <p className="eyebrow">
              New challenge · step {step} of {STEPS.length}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-fg">{STEPS[step - 1].title}</h1>
          </div>

          {/* Stepper — completed steps are clickable */}
          <ol className="grid grid-cols-5 gap-2">
            {STEPS.map(({ label }, i) => {
              const n = i + 1;
              const reachable = n <= maxStep;
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(n)}
                    className="w-full text-left space-y-2 group disabled:cursor-default"
                  >
                    <span
                      className={`block h-1 rounded-full transition-colors ${
                        n < step ? "bg-lime" : n === step ? "bg-lime/60" : reachable ? "bg-line-strong" : "bg-raised"
                      }`}
                    />
                    <span
                      className={`flex items-center gap-1 text-xs transition ${
                        n === step ? "text-fg font-medium" : reachable ? "text-dim group-hover:text-fg" : "text-faint"
                      }`}
                    >
                      {n < step && <Check className="w-3 h-3 text-lime" />}
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="card p-6 sm:p-8 space-y-8 animate-fade-up" key={step}>
            {step === 1 && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    {
                      v: false,
                      icon: Globe,
                      title: "Public",
                      body: "Listed on Explore. Anyone can join before the start.",
                    },
                    { v: true, icon: Lock, title: "Private", body: "Invite-only. Hidden from Explore." },
                  ].map((o) => {
                    const on = form.isPrivate === o.v;
                    return (
                      <button
                        key={o.title}
                        type="button"
                        onClick={() => set({ isPrivate: o.v })}
                        className={`text-left p-5 rounded-2xl border transition ${
                          on ? "border-lime/60 bg-lime/[0.05] shadow-glow" : "border-line hover:border-line-strong"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <o.icon className={`w-5 h-5 ${on ? "text-lime" : "text-dim"}`} />
                          <span
                            className={`w-5 h-5 rounded-full border-2 grid place-items-center ${
                              on ? "border-lime bg-lime" : "border-line-strong"
                            }`}
                          >
                            {on && <Check className="w-3 h-3 text-ink" strokeWidth={3} />}
                          </span>
                        </div>
                        <p className="text-base font-semibold text-fg mt-4">{o.title}</p>
                        <p className="text-sm text-dim mt-1">{o.body}</p>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <label className="label">Name</label>
                  <input
                    autoFocus
                    maxLength={80}
                    placeholder="e.g. Ship something every day for 30 days"
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    className="input h-12 text-base"
                  />
                </div>

                <div>
                  <label className="label">Category</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map((c) => {
                      const on = form.category === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => set({ category: c })}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm transition ${
                            on
                              ? "border-lime/60 bg-lime/[0.05] text-fg"
                              : "border-line text-dim hover:text-fg hover:border-line-strong"
                          }`}
                        >
                          <CategoryTile category={c} size="sm" />
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label">What counts as proof?</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. A link to a GitHub commit made during the period. Docs-only commits don't count."
                    value={form.description}
                    onChange={(e) => set({ description: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-faint mt-2">
                    Clear rules make peer review fair. Your cohort votes using this.
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid md:grid-cols-2 gap-5">
                  <DateTimePicker
                    label="Starts — joining closes"
                    value={form.start}
                    onChange={setStart}
                    min={minStart}
                    presets={startPresets}
                  />
                  <DateTimePicker
                    label="Ends — settlement opens"
                    value={form.end}
                    onChange={(d) => set({ end: d })}
                    min={form.start ? new Date(form.start.getTime() + frequencyDays * DAY) : minStart}
                    presets={endPresets}
                    tone="violet"
                    align="right"
                  />
                </div>

                <div>
                  <p className="label">Length</p>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => form.start && set({ end: new Date(form.start.getTime() + d * DAY) })}
                        className={`h-9 px-4 rounded-full text-sm border transition ${
                          activeDuration === d
                            ? "bg-fg text-ink border-fg font-medium"
                            : "border-line text-dim hover:text-fg hover:border-line-strong"
                        }`}
                      >
                        {d === 7 ? "1 week" : d === 14 ? "2 weeks" : d === 21 ? "3 weeks" : `${d} days`}
                      </button>
                    ))}
                    {!activeDuration && schedule.isValid && (
                      <span className="h-9 px-4 rounded-full text-sm border border-violet/40 text-violet grid place-items-center num">
                        {schedule.durationDays} days
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="label">How often do people submit proof?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[...FREQUENCIES, { id: "custom", label: "Custom", desc: "Pick days" }].map((f) => {
                      const on = form.frequency === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => set({ frequency: f.id })}
                          className={`p-3.5 rounded-xl border text-left transition ${
                            on ? "border-lime/60 bg-lime/[0.05]" : "border-line hover:border-line-strong"
                          }`}
                        >
                          <span className={`block text-sm font-medium ${on ? "text-fg" : "text-dim"}`}>{f.label}</span>
                          <span className="block text-xs text-faint mt-0.5">{f.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                  {form.frequency === "custom" && (
                    <div className="mt-3 inline-flex items-center gap-3 text-sm text-dim">
                      Every
                      <div className="flex items-center rounded-xl border border-line bg-raised">
                        <button
                          type="button"
                          onClick={() => set({ customDays: String(Math.max(1, frequencyDays - 1)) })}
                          className="w-9 h-10 text-dim hover:text-fg"
                        >
                          −
                        </button>
                        <span className="num w-8 text-center text-fg">{frequencyDays}</span>
                        <button
                          type="button"
                          onClick={() => set({ customDays: String(Math.min(30, frequencyDays + 1)) })}
                          className="w-9 h-10 text-dim hover:text-fg"
                        >
                          +
                        </button>
                      </div>
                      days
                    </div>
                  )}
                </div>

                {schedule.isValid && <ScheduleTimeline schedule={schedule} frequencyDays={frequencyDays} />}
              </>
            )}

            {step === 3 && (
              <>
                <div>
                  <label className="label">Stake per person</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={form.stakeEth}
                      onChange={(e) => set({ stakeEth: e.target.value })}
                      className="input num h-14 text-2xl font-semibold pr-16"
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-faint num">ETH</span>
                  </div>
                  {stakeWeiPreview > 0n && (
                    <p className="text-xs text-faint mt-2">
                      Each person pays <span className="num text-fg">{fmt(stakeWeiPreview)} ETH</span>. A {FEE_PERCENT_LABEL}{" "}
                      joining fee (<span className="num">{fmt(feeWeiPreview)} ETH</span>) comes out of it, so{" "}
                      <span className="num text-fg">{fmt(netWeiPreview)} ETH</span> is on the line in the challenge.
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {["0.005", "0.01", "0.05", "0.1"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set({ stakeEth: v })}
                        className={`num h-8 px-3 rounded-full text-xs border transition ${
                          form.stakeEth === v ? "bg-fg text-ink border-fg" : "border-line text-dim hover:text-fg"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-end justify-between gap-4 mb-3">
                    <label className="label mb-0">Qualify for the bonus pool at</label>
                    <span className="num text-3xl font-semibold text-lime">{form.qualificationThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={form.qualificationThreshold}
                    onChange={(e) => set({ qualificationThreshold: Number(e.target.value) })}
                    className="range"
                  />
                  <p className="text-sm text-dim mt-3">
                    Participants need <span className="num text-fg">{minToQualify}</span> of{" "}
                    <span className="num">{schedule.totalPeriods}</span> periods verified to share the pool.
                  </p>
                </div>

                <div>
                  <label className="label">Max participants</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="2"
                      max="200"
                      value={form.maxParticipants}
                      onChange={(e) => set({ maxParticipants: Number(e.target.value) })}
                      className="range flex-1"
                    />
                    <input
                      type="number"
                      min="2"
                      max="200"
                      value={form.maxParticipants}
                      onChange={(e) => set({ maxParticipants: e.target.value })}
                      className="input num w-24 text-center"
                    />
                  </div>
                </div>

                <label className="well p-4 flex items-center justify-between gap-4 cursor-pointer">
                  <span>
                    <span className="block text-sm font-medium text-fg">Join as the first participant</span>
                    <span className="block text-xs text-dim mt-0.5">
                      Stake {form.stakeEth} ETH in the same transaction.
                    </span>
                  </span>
                  <Toggle on={autoStake} onChange={setAutoStake} />
                </label>

                <div className="flex gap-3 p-4 rounded-xl border border-warn/25 bg-warn/5 text-sm">
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                  <p className="text-dim leading-relaxed">
                    The challenge starts on time whether or not it&apos;s full, and it can&apos;t be cancelled. If fewer than 2
                    people have joined by then, it can&apos;t run — whoever joined takes their stake back minus the{" "}
                    {FEE_PERCENT_LABEL} joining fee.
                  </p>
                </div>
              </>
            )}

            {step === 4 &&
              (form.isPrivate ? (
                <>
                  <form onSubmit={addWallet} className="space-y-2">
                    <label className="label">Invite by wallet address</label>
                    <div className="flex gap-2">
                      <input
                        placeholder="0x…"
                        value={walletInput}
                        onChange={(e) => setWalletInput(e.target.value)}
                        className="input num"
                      />
                      <button type="submit" className="btn-secondary shrink-0">
                        Add
                      </button>
                    </div>
                  </form>
                  {form.invited.length === 0 ? (
                    <p className="text-sm text-dim">
                      No wallets yet. You'll also get a shareable invite link after launch.
                    </p>
                  ) : (
                    <ul className="well divide-y divide-line">
                      {form.invited.map((w) => (
                        <li key={w} className="px-4 py-3 flex items-center justify-between gap-3">
                          <span className="num text-sm text-fg truncate">{w}</span>
                          <button
                            onClick={() => set({ invited: form.invited.filter((x) => x !== w) })}
                            className="text-faint hover:text-bad"
                            aria-label="Remove"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-lime/10 text-lime grid place-items-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-lg font-semibold text-fg">Open to everyone</p>
                  <p className="text-sm text-dim max-w-sm mx-auto">
                    It'll be listed on Explore and anyone can join before the start. Share the link to fill it faster.
                  </p>
                </div>
              ))}

            {step === 5 && (
              <>
                <div className="divide-y divide-line">
                  <Row label="Name">{form.name}</Row>
                  <Row label="Visibility">{form.isPrivate ? `Private · ${form.invited.length} invited` : "Public"}</Row>
                  <Row label="Starts">
                    {formatFriendly(form.start)} · <span className="num">{formatClock(form.start)}</span>
                  </Row>
                  <Row label="Ends">
                    {formatFriendly(form.end)} · <span className="num">{formatClock(form.end)}</span>
                  </Row>
                  <Row label="Proof">
                    every {frequencyDays} day{frequencyDays === 1 ? "" : "s"} ·{" "}
                    <span className="num">{schedule.totalPeriods}</span> periods
                  </Row>
                  <Row label="Stake">
                    <span className="num text-lime">{form.stakeEth} ETH</span>
                  </Row>
                  <Row label={`Joining fee (${FEE_PERCENT_LABEL})`}>
                    <span className="num text-dim">
                      {fmt(feeWeiPreview)} ETH per person · non-refundable
                    </span>
                  </Row>
                  <Row label="Qualify at">
                    <span className="num">
                      {form.qualificationThreshold}% ({minToQualify}/{schedule.totalPeriods})
                    </span>
                  </Row>
                  <Row label="Participants">
                    <span className="num">2 – {form.maxParticipants}</span>
                  </Row>
                </div>

                <div className="well p-5 space-y-2 text-sm text-dim leading-relaxed">
                  <p className="text-fg font-medium">Where your ETH goes</p>
                  <p>
                    Stakes go straight from your wallet to the CommitX contract, which keeps a {FEE_PERCENT_LABEL} joining
                    fee from each one. Each verified period keeps 1/
                    {schedule.totalPeriods} of your stake; missed periods fund a pool shared by everyone who reaches{" "}
                    {form.qualificationThreshold}%. After the end date, settlement is signed and verified on-chain and
                    each person withdraws their own payout.
                  </p>
                  {EXPLORER && (
                    <a
                      href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link inline-flex items-center gap-1"
                    >
                      Contract <span className="num">{shortenAddress(CONTRACT_ADDRESS)}</span>{" "}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmedRules}
                    onChange={(e) => setConfirmedRules(e.target.checked)}
                    className="w-5 h-5 mt-0.5 accent-lime shrink-0"
                  />
                  <span className="text-sm text-dim leading-relaxed">
                    I understand stakes are locked in the contract, the {FEE_PERCENT_LABEL} joining fee is non-refundable,
                    the challenge starts at the fixed time and can&apos;t be cancelled, and missed periods go to the
                    penalty pool.
                  </span>
                </label>
              </>
            )}

            {error && (
              <p className="text-sm text-bad flex items-center gap-2 animate-fade-in">
                <AlertTriangle className="w-4 h-4" /> {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-line">
              {step > 1 ? (
                <button onClick={() => goTo(step - 1)} className="btn-ghost">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                <button onClick={() => goTo(step + 1)} className="btn-primary">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={submit} disabled={!confirmedRules || suspended} className="btn-primary btn-lg">
                  {autoStake ? `Launch & stake ${form.stakeEth} ETH` : "Launch challenge"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-24 space-y-3">
          <p className="eyebrow">Live preview</p>
          <div className="card-glow p-5 space-y-5">
            <div className="flex items-center gap-3">
              <CategoryTile category={form.category} />
              <div className="min-w-0">
                <p className="text-xs text-faint">
                  {form.category} · {form.isPrivate ? "Private" : "Public"}
                </p>
                <p className={`text-base font-semibold truncate ${form.name ? "text-fg" : "text-faint"}`}>
                  {form.name || "Your challenge name"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-line border border-line text-xs">
              {[
                ["Stake", `${form.stakeEth || 0} ETH`, "text-lime font-semibold"],
                ["Periods", schedule.totalPeriods || "—", "text-fg"],
                ["Starts", form.start ? formatFriendly(form.start) : "—", "text-fg"],
                ["Ends", form.end ? formatFriendly(form.end) : "—", "text-fg"],
              ].map(([k, v, tone]) => (
                <div key={k} className="bg-panel px-3 py-2.5">
                  <span className="block text-faint mb-1">{k}</span>
                  <span className={`num ${tone}`}>{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2.5 text-sm text-dim">
              <Target className="w-4 h-4 mt-0.5 text-lime shrink-0" />
              <span>
                Hit <span className="num text-fg">{minToQualify}</span>/
                <span className="num">{schedule.totalPeriods}</span> periods to share the pool. Every period you prove
                keeps{" "}
                <span className="num text-fg">
                  {schedule.totalPeriods ? (parseFloat(ethers.formatEther(netWeiPreview)) / schedule.totalPeriods).toFixed(5) : "0"}{" "}
                  ETH
                </span>
                .
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.preventDefault();
        onChange(!on);
      }}
      className={`relative w-11 h-6 rounded-full transition shrink-0 ${on ? "bg-lime" : "bg-line-strong"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-ink transition-all ${on ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

/** Visual strip of every proof period between start and end. */
function ScheduleTimeline({ schedule, frequencyDays }) {
  const { totalPeriods, startMs, endMs } = schedule;
  const periodMs = frequencyDays * DAY;
  const covered = totalPeriods * periodMs;
  const tailPct = Math.max(0, ((endMs - startMs - covered) / (endMs - startMs)) * 100);
  const segments = Math.min(totalPeriods, 60);

  return (
    <div className="well p-5 space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="num text-4xl font-semibold text-lime">{totalPeriods}</span>
        <span className="text-sm text-dim">
          proof periods of <span className="num text-fg">{frequencyDays * 24}h</span> over{" "}
          <span className="num text-fg">{schedule.durationDays}</span> days
        </span>
      </div>
      <div className="flex h-8 gap-[3px]">
        <div className="flex flex-1 gap-[3px]" style={{ flexBasis: `${100 - tailPct}%` }}>
          {Array.from({ length: segments }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-md bg-lime/80 origin-left animate-fill"
              style={{ animationDelay: `${Math.min(i * 25, 600)}ms`, opacity: 0.45 + 0.55 * ((i + 1) / segments) }}
            />
          ))}
        </div>
        {tailPct > 0.5 && (
          <span
            className="rounded-md border border-dashed border-line-strong"
            style={{ flexBasis: `${tailPct}%` }}
            title="Leftover time shorter than a full period"
          />
        )}
      </div>
      <div className="flex justify-between text-xs">
        <span>
          <span className="block text-faint">Joining closes</span>
          <span className="text-fg">
            {formatFriendly(new Date(startMs))} · <span className="num">{formatClock(new Date(startMs))}</span>
          </span>
        </span>
        <span className="text-right">
          <span className="block text-faint">Settlement opens</span>
          <span className="text-fg">
            {formatFriendly(new Date(endMs))} · <span className="num">{formatClock(new Date(endMs))}</span>
          </span>
        </span>
      </div>
      {totalPeriods > segments && <p className="text-xs text-faint">Showing the first {segments} periods.</p>}
    </div>
  );
}

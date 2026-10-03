"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Users, Lock } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { AvatarStack, peopleFromParticipants } from "@/components/ui/Avatar";
import { categoryMeta } from "@/components/ui/categories";
import { formatEth, formatTimeLeft } from "@/lib/formatters";

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 animate-fade-up">
      <div className="space-y-3 max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="text-4xl sm:text-5xl font-bold text-fg leading-[1.02]">{title}</h1>
        {subtitle && <p className="text-dim text-[15px] leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "fg", icon: Icon, className = "" }) {
  const tones = { fg: "text-fg", lime: "text-lime", ok: "text-ok", warn: "text-warn", violet: "text-violet" };
  return (
    <div className={`card p-5 flex flex-col gap-3 ${className}`}>
      <span className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-faint" />}
      </span>
      <span className={`num text-2xl sm:text-3xl font-semibold tracking-tight ${tones[tone] || tones.fg}`}>{value}</span>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="card dotgrid px-6 py-16 text-center animate-fade-up">
      {Icon && (
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-raised border border-line grid place-items-center">
          <Icon className="w-6 h-6 text-dim" />
        </div>
      )}
      <h3 className="text-xl font-semibold text-fg">{title}</h3>
      {body && <p className="mt-2 text-sm text-dim max-w-md mx-auto leading-relaxed">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

// useLayoutEffect warns during server rendering; fall back to useEffect there
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Pill tabs with an indicator that slides to the active tab. */
export function Segmented({ items, value, onChange }) {
  const wrap = useRef(null);
  const [pill, setPill] = useState(null);

  useIsoLayoutEffect(() => {
    const el = wrap.current?.querySelector(`[data-id="${CSS.escape(String(value))}"]`);
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, items]);

  return (
    <div ref={wrap} className="seg no-scrollbar relative" role="tablist">
      {pill && (
        <span
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-fg transition-all duration-300 ease-out"
          style={{ left: pill.left, width: pill.width }}
        />
      )}
      {items.map((it) => (
        <button
          key={it.id}
          data-id={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={`seg-item relative z-10 ${value === it.id ? "!text-ink" : ""}`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/** Number that eases from its previous value to `value`. */
export function CountUp({ value, format = (n) => n.toLocaleString(), duration = 900 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(origin + (target - origin) * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(shown)}</>;
}

/** Counts up an ETH amount given in wei. */
export function EthCountUp({ wei }) {
  const eth = Number(BigInt(wei || 0)) / 1e18;
  return (
    <CountUp
      value={eth}
      format={(n) => `${n.toLocaleString(undefined, { maximumFractionDigits: n > 0 && n < 0.01 ? 6 : 4 })} ETH`}
    />
  );
}

/** Small "?" that explains a term in plain words (hover or tap). */
export function InfoTip({ children, label = "What does this mean?" }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-line-strong text-[10px] leading-none text-faint hover:text-fg hover:border-fg grid place-items-center transition"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl bg-fg text-ink text-xs leading-relaxed p-3 shadow-2xl animate-pop normal-case tracking-normal font-sans font-normal"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export function Progress({ value, tone = "lime", className = "" }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const tones = { lime: "bg-lime", ok: "bg-ok", violet: "bg-violet", warn: "bg-warn" };
  return (
    <div className={`h-1.5 w-full rounded-full bg-raised overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${tones[tone]} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Row({ label, children, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 text-sm ${className}`}>
      <span className="text-dim">{label}</span>
      <span className="text-fg text-right">{children}</span>
    </div>
  );
}

export function Spinner({ className = "w-4 h-4" }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
      aria-hidden
    />
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`rounded-xl bg-raised/70 animate-pulse ${className}`} />;
}

export function CategoryTile({ category, size = "md" }) {
  const { icon: Icon, hue } = categoryMeta(category);
  const s = size === "lg" ? "w-12 h-12 rounded-2xl" : size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl";
  const i = size === "lg" ? "w-6 h-6" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
  return (
    <span
      className={`${s} grid place-items-center shrink-0 border`}
      style={{ color: hue, background: `${hue}14`, borderColor: `${hue}33` }}
    >
      <Icon className={i} />
    </span>
  );
}

/** Re-renders every `ms` so countdowns stay live. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Live d/h/m/s countdown split into boxes. */
export function Countdown({ to, label }) {
  const now = useNow(1000);
  const diff = Math.max(0, new Date(to).getTime() - now);
  const parts = [
    ["d", Math.floor(diff / 86400000)],
    ["h", Math.floor((diff % 86400000) / 3600000)],
    ["m", Math.floor((diff % 3600000) / 60000)],
    ["s", Math.floor((diff % 60000) / 1000)],
  ];
  return (
    <div className="space-y-2">
      {label && <p className="eyebrow">{label}</p>}
      <div className="flex gap-1.5">
        {parts.map(([u, v]) => (
          <span key={u} className="well px-2.5 py-1.5 text-center min-w-[3rem]">
            <span className="num block text-lg font-semibold text-fg leading-none">{String(v).padStart(2, "0")}</span>
            <span className="block text-[10px] text-faint mt-1">{u}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function timingLabel(c) {
  const now = Date.now();
  if (c.status === "FINALIZED") return "Settled";
  if (c.status === "CANCELLED") return "Cancelled";
  if (now < new Date(c.startTime).getTime()) return `Starts in ${formatTimeLeft(c.startTime).replace(" left", "")}`;
  if (now < new Date(c.endTime).getTime()) return `Ends in ${formatTimeLeft(c.endTime).replace(" left", "")}`;
  return "Ended · awaiting settlement";
}

export function ChallengeCard({ challenge: c, href, badge, cta = "View" }) {
  const count = c.participants?.length || 0;
  const fill = Math.round((count / (c.maxParticipants || 1)) * 100);
  const pool = BigInt(c.stakeAmountWei || "0") * BigInt(count);
  return (
    <Link
      href={href || `/challenges/${c.contractChallengeId}`}
      className="card-hover group relative overflow-hidden p-5 flex flex-col gap-5"
    >
      <span
        aria-hidden
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition duration-500"
        style={{ background: `${categoryMeta(c.category).hue}22` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <CategoryTile category={c.category} />
          <div className="min-w-0">
            <p className="text-xs text-faint">{c.category}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {c.isPrivate && (
                <span className="chip h-5 text-warn border-warn/25 bg-warn/10">
                  <Lock className="w-3 h-3" /> Private
                </span>
              )}
              {badge}
            </div>
          </div>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="relative space-y-1.5 min-h-[4.5rem]">
        <h3 className="text-lg font-semibold text-fg leading-snug line-clamp-1 group-hover:text-lime transition">
          {c.name}
        </h3>
        <p className="text-sm text-dim line-clamp-2 leading-relaxed">{c.description || "No description provided."}</p>
      </div>

      <div className="relative grid grid-cols-3 gap-px rounded-xl overflow-hidden bg-line border border-line text-xs">
        {[
          ["Stake", formatEth(c.stakeAmountWei), "text-lime font-semibold"],
          ["Pool", formatEth(pool), "text-fg"],
          ["Cadence", `${c.submissionFrequency || 1}d × ${c.totalPeriods}`, "text-fg"],
        ].map(([k, v, tone]) => (
          <div key={k} className="bg-panel px-3 py-2.5">
            <span className="block text-faint mb-1">{k}</span>
            <span className={`num ${tone}`}>{v}</span>
          </div>
        ))}
      </div>

      <div className="relative space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-dim">
            {count > 0 ? (
              <AvatarStack people={peopleFromParticipants(c.participants)} max={3} size={22} />
            ) : (
              <Users className="w-3.5 h-3.5" />
            )}
            <span className="num">
              {count}/{c.maxParticipants}
            </span>
            <span className="text-faint">·</span>
            <span>{timingLabel(c)}</span>
          </span>
          <span className="flex items-center gap-1 text-fg font-medium group-hover:text-lime transition">
            {cta} <ArrowUpRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </div>
        <Progress value={fill} tone="violet" />
      </div>
    </Link>
  );
}

/** Circular progress (0–100) that animates to its value. */
export function ProgressRing({ value = 0, size = 44, stroke = 5, children, tone = "lime" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = tone === "ok" ? "#4ADE9A" : tone === "violet" ? "#A393FF" : "rgb(var(--accent))";
  return (
    <span className="relative inline-grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#25252B" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ stroke: color, transition: "stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      {children && <span className="absolute inset-0 grid place-items-center">{children}</span>}
    </span>
  );
}

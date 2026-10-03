"use client";

import React from "react";

const VARIANTS = {
  default: "bg-raised text-dim border-line",
  lime: "bg-lime/10 text-lime border-lime/25",
  ok: "bg-ok/10 text-ok border-ok/25",
  warn: "bg-warn/10 text-warn border-warn/25",
  bad: "bg-bad/10 text-bad border-bad/25",
  violet: "bg-violet/10 text-violet border-violet/25",
  // legacy aliases
  mint: "bg-lime/10 text-lime border-lime/25",
  emerald: "bg-ok/10 text-ok border-ok/25",
  amber: "bg-warn/10 text-warn border-warn/25",
  red: "bg-bad/10 text-bad border-bad/25",
  cyan: "bg-lime/10 text-lime border-lime/25",
  purple: "bg-violet/10 text-violet border-violet/25",
};

export function Badge({ children, variant = "default", className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium border whitespace-nowrap ${
        VARIANTS[variant] || VARIANTS.default
      } ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS = {
  OPEN: { variant: "lime", label: "Open to join", pulse: true },
  ACTIVE: { variant: "lime", label: "In progress", pulse: true },
  VERIFICATION: { variant: "violet", label: "Awaiting settlement" },
  FINALIZED: { variant: "ok", label: "Settled" },
  CANCELLED: { variant: "bad", label: "Closed · not enough people" },
  APPROVED: { variant: "ok", label: "Approved" },
  REJECTED: { variant: "bad", label: "Rejected" },
  PENDING: { variant: "warn", label: "Pending review", pulse: true },
};

export function StatusBadge({ status }) {
  const s = STATUS[status];
  if (!s) return <Badge>{status}</Badge>;
  return (
    <Badge variant={s.variant}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${s.pulse ? "animate-pulse" : ""}`} />
      {s.label}
    </Badge>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MINUTES = [0, 15, 30, 45];

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function formatFriendly(date) {
  if (!date) return "";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function formatClock(date) {
  if (!date) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatRelative(date, now = Date.now()) {
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const text = mins < 60 ? `${mins} min` : hours < 36 ? `${hours} hour${hours === 1 ? "" : "s"}` : `${days} days`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/**
 * Calendar + time picker.
 * value: Date | null · onChange(Date) · min: Date (earliest selectable moment)
 * presets: [{ label, get: () => Date }]
 */
export function DateTimePicker({ label, value, onChange, min, presets = [], hint, tone = "lime", align = "left" }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = value || min || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && value) setView(new Date(value.getFullYear(), value.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Monday-first grid
    const cells = [];
    for (let i = 0; i < 42; i++) cells.push(new Date(view.getFullYear(), view.getMonth(), 1 - offset + i));
    return cells;
  }, [view]);

  const minDay = min ? startOfDay(min) : null;
  const current = value || min || new Date();
  const hour24 = current.getHours();
  const isPM = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  // Snap forward to `min` if the chosen moment is earlier
  const commit = (d) => onChange(min && d < min ? new Date(min) : d);

  const pickDay = (day) => {
    const d = new Date(day);
    d.setHours(current.getHours(), current.getMinutes(), 0, 0);
    commit(d);
  };

  const setHour = (h12, pm = isPM) => {
    const d = new Date(current);
    d.setHours((h12 % 12) + (pm ? 12 : 0), d.getMinutes(), 0, 0);
    commit(d);
  };

  const setMinute = (m) => {
    const d = new Date(current);
    d.setMinutes(m, 0, 0);
    commit(d);
  };

  const hourDisabled = (h12, pm) => {
    if (!min) return false;
    const d = new Date(current);
    d.setHours((h12 % 12) + (pm ? 12 : 0), 59, 59, 999);
    return d < min;
  };

  const accent = tone === "violet" ? "bg-violet text-ink" : "bg-lime text-ink";
  const ring = tone === "violet" ? "border-violet/60" : "border-lime/60";

  return (
    <div className="relative" ref={rootRef}>
      {label && <p className="label">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left rounded-2xl border bg-raised px-4 py-3.5 flex items-center gap-4 transition hover:border-line-strong ${
          open ? `${ring} ring-4 ring-lime/10` : "border-line"
        }`}
      >
        <span className={`w-11 h-11 shrink-0 rounded-xl grid place-items-center ${tone === "violet" ? "bg-violet/10 text-violet" : "bg-lime/10 text-lime"}`}>
          <CalendarDays className="w-5 h-5" />
        </span>
        {value ? (
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-fg truncate">{formatFriendly(value)}</span>
            <span className="flex items-center gap-2 text-sm text-dim">
              <span className="num">{formatClock(value)}</span>
              <span className="text-faint">·</span>
              <span>{formatRelative(value)}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-faint">Pick a date and time</span>
        )}
      </button>
      {hint && <p className="text-xs text-faint mt-2">{hint}</p>}

      {open && (
        <>
          {/* Mobile scrim */}
          <div className="sm:hidden fixed inset-0 z-40 bg-black/60 animate-fade-in" onClick={() => setOpen(false)} />
          <div
            className={`z-50 card bg-panel p-4 sm:p-5 animate-slide-in
              fixed inset-x-0 bottom-0 rounded-b-none max-h-[88vh] overflow-y-auto
              sm:absolute sm:inset-x-auto sm:bottom-auto ${align === "right" ? "sm:right-0" : "sm:left-0"} sm:top-full sm:mt-2 sm:rounded-2xl sm:w-[34rem] sm:max-h-none`}
          >
            <div className="flex items-center justify-between mb-3 sm:hidden">
              <p className="text-base font-semibold text-fg">{label || "Pick a time"}</p>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 grid place-items-center rounded-full hover:bg-raised text-dim">
                <X className="w-4 h-4" />
              </button>
            </div>

            {presets.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 mb-4 border-b border-line">
                {presets.map((p) => {
                  const d = p.get();
                  const active = value && Math.abs(d - value) < 60000;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => commit(d)}
                      className={`h-8 px-3 rounded-full text-xs whitespace-nowrap border transition ${
                        active ? `${accent} border-transparent font-semibold` : "border-line text-dim hover:text-fg hover:border-line-strong"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid sm:grid-cols-[1fr_12rem] gap-5">
              {/* Calendar */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
                    disabled={minDay && new Date(view.getFullYear(), view.getMonth(), 0) < minDay}
                    className="w-8 h-8 grid place-items-center rounded-full text-dim hover:text-fg hover:bg-raised disabled:opacity-30"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-sm font-semibold text-fg">
                    {view.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
                    className="w-8 h-8 grid place-items-center rounded-full text-dim hover:text-fg hover:bg-raised"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="text-[10px] uppercase tracking-wider text-faint py-1">
                      {w}
                    </span>
                  ))}
                  {days.map((d) => {
                    const outside = d.getMonth() !== view.getMonth();
                    const disabled = minDay && d < minDay;
                    const selected = sameDay(d, value);
                    const today = sameDay(d, new Date());
                    return (
                      <button
                        key={d.toISOString()}
                        type="button"
                        disabled={disabled}
                        onClick={() => pickDay(d)}
                        className={`num relative h-9 rounded-lg text-sm transition ${
                          selected
                            ? `${accent} font-semibold`
                            : disabled
                            ? "text-faint/40 cursor-not-allowed"
                            : outside
                            ? "text-faint hover:bg-raised"
                            : "text-fg hover:bg-raised"
                        }`}
                      >
                        {d.getDate()}
                        {today && !selected && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-lime" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time */}
              <div className="sm:border-l sm:border-line sm:pl-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs text-dim">
                    <Clock className="w-3.5 h-3.5" /> Time
                  </p>
                  <div className="flex p-0.5 rounded-full bg-raised border border-line">
                    {["AM", "PM"].map((p) => {
                      const pm = p === "PM";
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setHour(hour12, pm)}
                          disabled={hourDisabled(12, pm) && hourDisabled(11, pm)}
                          className={`h-6 px-2.5 rounded-full text-[11px] font-semibold transition disabled:opacity-30 ${
                            isPM === pm ? "bg-fg text-ink" : "text-dim hover:text-fg"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={hourDisabled(h, isPM)}
                      onClick={() => setHour(h)}
                      className={`num h-9 rounded-lg text-sm transition disabled:opacity-25 disabled:cursor-not-allowed ${
                        h === hour12 ? `${accent} font-semibold` : "text-fg hover:bg-raised"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMinute(m)}
                      className={`num h-9 rounded-lg text-sm transition ${
                        current.getMinutes() === m ? "bg-fg text-ink font-semibold" : "text-dim hover:bg-raised hover:text-fg"
                      }`}
                    >
                      :{String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-line">
              <p className="text-sm text-dim truncate">
                {value ? (
                  <>
                    <span className="text-fg">{formatFriendly(value)}</span> at <span className="num text-fg">{formatClock(value)}</span>
                  </>
                ) : (
                  "Nothing selected"
                )}
              </p>
              <button type="button" onClick={() => setOpen(false)} className="btn-primary btn-sm shrink-0">
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

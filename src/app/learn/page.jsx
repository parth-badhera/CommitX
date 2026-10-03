"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { CHAPTERS, FAQ, GLOSSARY, LINKS, MANUAL_VERSION } from "@/content/manual";
import { Reveal } from "@/components/ui/Reveal";
import {
  Download,
  Check,
  ExternalLink,
  Lightbulb,
  ShieldAlert,
  ChevronDown,
  Wallet,
  Puzzle,
  Network,
  Droplets,
  ArrowRight,
  Clock,
  CircleDashed,
  BookOpen,
} from "lucide-react";

const STORAGE_KEY = "commitx_learn_done";

function Rich({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="text-fg font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export default function LearnPage() {
  const [done, setDone] = useState([]);
  const [active, setActive] = useState(CHAPTERS[0].id);

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch {}
  }, []);

  const toggleDone = (id) => {
    setDone((d) => {
      const next = d.includes(id) ? d.filter((x) => x !== id) : [...d, id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Scroll-spy for the contents rail
  useEffect(() => {
    const els = CHAPTERS.map((c) => document.getElementById(c.id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const pct = Math.round((done.length / CHAPTERS.length) * 100);

  return (
    <div>
      {/* HERO */}
      <section className="shell pt-16 pb-12">
        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-center">
          <div className="space-y-6 animate-fade-up">
            <span className="chip">
              <BookOpen className="w-3 h-3 text-lime" /> Learn center
            </span>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-fg leading-[0.98]">
              New to crypto?
              <br />
              <span className="text-gradient">Start here.</span>
            </h1>
            <p className="text-lg text-dim max-w-xl leading-relaxed">
              From installing MetaMask to withdrawing your first payout. Ten minutes, no jargon, and nothing real at risk —
              everything runs on a free test network.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/commitx-manual.pdf" download="CommitX-Beginner-Manual.pdf" className="btn-primary btn-lg">
                <Download className="w-4 h-4" /> Download the PDF manual
              </a>
              <a href="#before" className="btn-secondary btn-lg">
                Read it here <ArrowRight className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-faint">
              Manual v{MANUAL_VERSION} · {CHAPTERS.length} chapters · printable A4
            </p>
          </div>
          <SetupChecker />
        </div>
      </section>

      {/* GUIDE */}
      <section className="shell pb-10 grid lg:grid-cols-[220px_1fr] gap-10 items-start">
        <nav className="hidden lg:block sticky top-24 space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-dim">Your progress</span>
              <span className="num text-fg">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-raised overflow-hidden">
              <div className="h-full bg-lime rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {["Get set up", "Use CommitX"].map((part) => (
            <div key={part} className="space-y-1">
              <p className="eyebrow mb-2">{part}</p>
              {CHAPTERS.filter((c) => c.part === part).map((c) => {
                const n = CHAPTERS.indexOf(c) + 1;
                return (
                  <a
                    key={c.id}
                    href={`#${c.id}`}
                    className={`flex items-center gap-2.5 py-1.5 text-sm transition ${
                      active === c.id ? "text-fg" : "text-dim hover:text-fg"
                    }`}
                  >
                    <span
                      className={`num w-5 h-5 rounded-full grid place-items-center text-[10px] shrink-0 border ${
                        done.includes(c.id)
                          ? "bg-lime border-lime text-ink"
                          : active === c.id
                          ? "border-lime text-lime"
                          : "border-line-strong text-faint"
                      }`}
                    >
                      {done.includes(c.id) ? <Check className="w-3 h-3" strokeWidth={3} /> : n}
                    </span>
                    <span className="truncate">{c.title}</span>
                  </a>
                );
              })}
            </div>
          ))}
          <div className="space-y-1 pt-2 border-t border-line">
            <a href="#help" className="block py-1.5 text-sm text-dim hover:text-fg">
              Troubleshooting
            </a>
            <a href="#glossary" className="block py-1.5 text-sm text-dim hover:text-fg">
              Glossary
            </a>
          </div>
        </nav>

        <div className="space-y-6 min-w-0">
          {CHAPTERS.map((c, i) => {
            const isDone = done.includes(c.id);
            const partStart = i === 0 || CHAPTERS[i - 1].part !== c.part;
            return (
              <React.Fragment key={c.id}>
                {partStart && (
                  <Reveal>
                    <p className="eyebrow pt-6">
                      Part {c.part === "Get set up" ? "1" : "2"} — {c.part}
                    </p>
                  </Reveal>
                )}
                <Reveal>
                  <article id={c.id} className={`card p-6 sm:p-8 scroll-mt-24 transition ${isDone ? "border-lime/30" : ""}`}>
                    <div className="grid md:grid-cols-[1fr_240px] gap-8">
                      <div className="space-y-5 min-w-0">
                        <div className="flex items-center gap-3 text-xs text-faint">
                          <span className="num text-lime">{String(i + 1).padStart(2, "0")}</span>
                          <span className="h-px w-6 bg-line-strong" />
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {c.time}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-fg">{c.title}</h2>
                        <p className="text-dim leading-relaxed">
                          <Rich text={c.summary} />
                        </p>

                        <ol className="space-y-3">
                          {c.steps.map((s, k) => (
                            <li key={k} className="flex gap-3 text-sm text-dim leading-relaxed">
                              <span className="num w-6 h-6 shrink-0 rounded-full bg-raised border border-line grid place-items-center text-[11px] text-fg">
                                {k + 1}
                              </span>
                              <span className="pt-0.5">
                                <Rich text={s} />
                              </span>
                            </li>
                          ))}
                        </ol>

                        {c.links && (
                          <div className="flex flex-wrap gap-2">
                            {c.links.map((l) => (
                              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                                {l.label} <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        )}

                        {c.tip && (
                          <div className="flex gap-3 p-4 rounded-xl bg-lime/[0.05] border border-lime/20 text-sm text-dim leading-relaxed">
                            <Lightbulb className="w-4 h-4 text-lime shrink-0 mt-0.5" />
                            <span>
                              <Rich text={c.tip} />
                            </span>
                          </div>
                        )}
                        {c.warning && (
                          <div className="flex gap-3 p-4 rounded-xl bg-bad/[0.06] border border-bad/25 text-sm text-dim leading-relaxed">
                            <ShieldAlert className="w-4 h-4 text-bad shrink-0 mt-0.5" />
                            <span>
                              <Rich text={c.warning} />
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => toggleDone(c.id)}
                          className={`btn-sm ${isDone ? "btn-secondary text-lime" : "btn-ghost border border-line"}`}
                        >
                          {isDone ? <Check className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />}
                          {isDone ? "Done" : "Mark as done"}
                        </button>
                      </div>
                      <div className="hidden md:block">
                        <Illustration id={c.id} />
                      </div>
                    </div>
                  </article>
                </Reveal>
              </React.Fragment>
            );
          })}

          {/* Troubleshooting */}
          <Reveal>
            <section id="help" className="scroll-mt-24 pt-10 space-y-4">
              <p className="eyebrow">Troubleshooting</p>
              <h2 className="text-3xl font-bold text-fg">Something not working?</h2>
              <div className="card divide-y divide-line">
                {FAQ.map((f) => (
                  <FaqItem key={f.q} q={f.q} a={f.a} />
                ))}
              </div>
            </section>
          </Reveal>

          {/* Glossary */}
          <Reveal>
            <section id="glossary" className="scroll-mt-24 pt-10 space-y-4">
              <p className="eyebrow">Glossary</p>
              <h2 className="text-3xl font-bold text-fg">Words you'll see</h2>
              <dl className="grid sm:grid-cols-2 gap-3">
                {GLOSSARY.map(([term, def]) => (
                  <div key={term} className="card p-4">
                    <dt className="text-sm font-semibold text-fg">{term}</dt>
                    <dd className="text-sm text-dim mt-1 leading-relaxed">{def}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </Reveal>

          <Reveal>
            <div className="card-glow p-8 sm:p-10 mt-10 grid sm:grid-cols-[1fr_auto] gap-6 items-center">
              <div>
                <h3 className="text-2xl font-bold text-fg">Ready for your first challenge?</h3>
                <p className="text-dim mt-1">Keep the manual handy — it's the same guide, ready to print.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/commitx-manual.pdf" download="CommitX-Beginner-Manual.pdf" className="btn-secondary">
                  <Download className="w-4 h-4" /> PDF
                </a>
                <Link href="/explore" className="btn-primary">
                  Explore challenges <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left">
        <span className="text-sm font-medium text-fg">{q}</span>
        <ChevronDown className={`w-4 h-4 text-faint shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-4 text-sm text-dim leading-relaxed">
            <Rich text={a} />
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Live setup checker ---------------- */

function SetupChecker() {
  const { hasMetaMask, isMobile, openWalletModal, account, isSepolia, balance, connectWallet, switchToSepolia, isConnecting } = useWeb3();
  const { user, openAuthModal } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const funded = parseFloat(balance || "0") > 0;
  const checks = [
    {
      label: isMobile ? "MetaMask App ready" : "MetaMask installed",
      ok: hasMetaMask,
      icon: Puzzle,
      action: isMobile ? (
        <button onClick={openWalletModal} className="btn-primary btn-sm">
          Open / Install
        </button>
      ) : (
        <a href={LINKS.metamask} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
          Install
        </a>
      ),
    },
    {
      label: "Wallet connected",
      ok: Boolean(account),
      icon: Wallet,
      action: (
        <button onClick={connectWallet} disabled={isConnecting} className="btn-primary btn-sm">
          Connect
        </button>
      ),
    },
    {
      label: "On Sepolia network",
      ok: Boolean(account) && isSepolia,
      icon: Network,
      action: (
        <button onClick={switchToSepolia} disabled={!account} className="btn-primary btn-sm">
          Switch
        </button>
      ),
    },
    {
      label: "Has test ETH",
      ok: Boolean(account) && isSepolia && funded,
      icon: Droplets,
      action: (
        <a href="#faucet" className="btn-primary btn-sm">
          Get ETH
        </a>
      ),
    },
    {
      label: "Signed in to CommitX",
      ok: Boolean(user),
      icon: Check,
      action: (
        <button onClick={() => openAuthModal(1)} className="btn-primary btn-sm">
          Sign in
        </button>
      ),
    },
  ];
  const passed = mounted ? checks.filter((c) => c.ok).length : 0;
  const firstTodo = checks.findIndex((c) => !c.ok);
  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div className="card-glow p-6 space-y-5 animate-fade-up" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90 shrink-0">
          <circle cx="32" cy="32" r={R} fill="none" stroke="#25252B" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={R}
            fill="none"
            style={{ stroke: "rgb(var(--accent))", transition: "stroke-dashoffset 0.8s cubic-bezier(0.16,1,0.3,1)" }}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (C * passed) / checks.length}
          />
        </svg>
        <div>
          <p className="text-lg font-semibold text-fg">
            {passed === checks.length ? "You're ready to go" : "Check your setup"}
          </p>
          <p className="text-sm text-dim">
            <span className="num text-fg">{passed}</span> of {checks.length} done · updates live
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {checks.map((c, i) => {
          const Icon = c.icon;
          const ok = mounted && c.ok;
          return (
            <li
              key={c.label}
              className={`flex items-center gap-3 p-2.5 rounded-xl transition ${i === firstTodo && mounted ? "bg-raised" : ""}`}
            >
              <span
                className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                  ok ? "bg-lime text-ink" : "bg-raised text-faint border border-line"
                }`}
              >
                {ok ? <Check className="w-4 h-4" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
              </span>
              <span className={`text-sm flex-1 ${ok ? "text-dim line-through decoration-faint" : "text-fg"}`}>{c.label}</span>
              {mounted && !ok && i === firstTodo && c.action}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- Chapter illustrations ---------------- */

function Frame({ children, title }) {
  return (
    <div className="well overflow-hidden shadow-lift">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line bg-panel">
        <span className="w-2 h-2 rounded-full bg-bad/70" />
        <span className="w-2 h-2 rounded-full bg-warn/70" />
        <span className="w-2 h-2 rounded-full bg-ok/70" />
        {title && <span className="ml-2 text-[10px] text-faint truncate">{title}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Fox({ className = "w-6 h-6" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path d="M6 4l11 9h6l11-9-3 17-11 15L9 21z" fill="#F6851B" />
      <path d="M6 4l11 9-8 8z" fill="#E2761B" />
      <path d="M34 4L23 13l8 8z" fill="#E2761B" />
      <path d="M14 22l4 2-2 3zM26 22l-4 2 2 3z" fill="#233447" />
      <path d="M17 30h6l-3 4z" fill="#C0AD9E" />
    </svg>
  );
}

function Illustration({ id }) {
  if (id === "before")
    return (
      <div className="space-y-2">
        {[
          ["Wallet", "MetaMask", Wallet],
          ["Network", "Sepolia (test)", Network],
          ["Funds", "Free test ETH", Droplets],
        ].map(([k, v, Icon]) => (
          <div key={k} className="well p-3 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-lime/10 text-lime grid place-items-center">
              <Icon className="w-4 h-4" />
            </span>
            <span>
              <span className="block text-[11px] text-faint">{k}</span>
              <span className="block text-sm text-fg">{v}</span>
            </span>
          </div>
        ))}
      </div>
    );
  if (id === "install")
    return (
      <Frame title="metamask.io/download">
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <Fox className="w-14 h-14 animate-float" />
          <p className="text-sm font-semibold text-fg">MetaMask</p>
          <span className="h-8 px-4 rounded-full bg-[#F6851B] text-white text-xs font-semibold grid place-items-center">
            Install MetaMask
          </span>
          <span className="text-[10px] text-faint">Check it's the official site</span>
        </div>
      </Frame>
    );
  if (id === "wallet")
    return (
      <Frame title="Secret Recovery Phrase">
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="rounded-md bg-panel border border-line px-1.5 py-1 text-[10px] text-faint flex gap-1">
              <span className="num">{i + 1}.</span>
              <span className="flex-1 h-2 mt-0.5 rounded bg-line-strong blur-[1px]" />
            </span>
          ))}
        </div>
        <p className="text-[10px] text-bad mt-3 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Write on paper. Never share.
        </p>
      </Frame>
    );
  if (id === "sepolia")
    return (
      <Frame title="MetaMask · networks">
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-line">
            <span className="text-dim">Show test networks</span>
            <span className="w-7 h-4 rounded-full bg-lime relative">
              <span className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-ink" />
            </span>
          </div>
          {["Ethereum Mainnet", "Linea", "Sepolia"].map((n) => (
            <div
              key={n}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${n === "Sepolia" ? "bg-lime/10 text-lime" : "text-dim"}`}
            >
              <span className={`w-2 h-2 rounded-full ${n === "Sepolia" ? "bg-lime" : "bg-line-strong"}`} />
              {n}
              {n === "Sepolia" && <Check className="w-3 h-3 ml-auto" />}
            </div>
          ))}
        </div>
      </Frame>
    );
  if (id === "faucet")
    return (
      <Frame title="Sepolia faucet">
        <div className="space-y-2">
          <span className="block text-[10px] text-faint">Your address</span>
          <span className="block num text-[11px] text-fg rounded-md bg-panel border border-line px-2 py-1.5 truncate">0x3855…55f9</span>
          <span className="h-7 rounded-full bg-violet text-ink text-[11px] font-semibold grid place-items-center">Send me ETH</span>
          <span className="block text-center text-[11px] text-ok">+0.05 SepoliaETH</span>
        </div>
      </Frame>
    );
  if (id === "connect")
    return (
      <Frame title="MetaMask">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-lime text-ink grid place-items-center font-display font-extrabold text-sm">X</span>
            <span className="text-faint">⇄</span>
            <Fox className="w-8 h-8" />
          </div>
          <p className="text-xs text-fg">Connect to CommitX?</p>
          <div className="flex gap-2 w-full">
            <span className="flex-1 h-7 rounded-full border border-line text-[11px] text-dim grid place-items-center">Cancel</span>
            <span className="flex-1 h-7 rounded-full bg-[#0376C9] text-white text-[11px] font-semibold grid place-items-center">Connect</span>
          </div>
        </div>
      </Frame>
    );
  if (id === "join")
    return (
      <Frame title="Challenge">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-fg">30 days of code</p>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span className="rounded bg-panel p-1.5 text-faint">
              Stake <span className="block num text-lime">0.05 ETH</span>
            </span>
            <span className="rounded bg-panel p-1.5 text-faint">
              Periods <span className="block num text-fg">30</span>
            </span>
          </div>
          <span className="h-7 rounded-full bg-lime text-ink text-[11px] font-semibold grid place-items-center">Stake & join</span>
        </div>
      </Frame>
    );
  if (id === "prove")
    return (
      <Frame title="Periods">
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className={`h-5 rounded ${i < 11 ? "bg-lime/80" : i === 11 ? "bg-warn animate-pulse" : i === 5 ? "bg-bad/60" : "bg-panel border border-line"}`}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-3 text-[10px] text-faint">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-lime" />
            verified
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-warn" />
            now
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-bad/60" />
            missed
          </span>
        </div>
      </Frame>
    );
  if (id === "withdraw")
    return (
      <div className="rounded-xl bg-lime text-ink p-4 space-y-3 shadow-glow">
        <p className="text-[11px] font-medium opacity-70">Payout ready to withdraw</p>
        <p className="num text-2xl font-bold">0.0625 ETH</p>
        <span className="h-8 rounded-full bg-ink text-lime text-xs font-semibold grid place-items-center">Withdraw to wallet</span>
      </div>
    );
  return null;
}

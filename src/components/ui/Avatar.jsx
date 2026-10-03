"use client";

import React, { useMemo, useState } from "react";
import { rng, displayName } from "@/lib/identity";

const PALETTES = [
  ["#D7FF3E", "#4ADE9A", "#0F2A1C"],
  ["#A393FF", "#F9A8D4", "#1E1636"],
  ["#7DD3FC", "#A393FF", "#0C1E2E"],
  ["#FDBA74", "#FF6B5B", "#2B130C"],
  ["#6EE7B7", "#7DD3FC", "#0B241C"],
  ["#F9A8D4", "#FDBA74", "#2A1020"],
  ["#FFB547", "#D7FF3E", "#26200A"],
  ["#C4B5FD", "#6EE7B7", "#171A2E"],
];

/** Deterministic "blob buddy" avatar drawn from a seed. */
export function GeneratedAvatar({ seed, size = 32, className = "" }) {
  const art = useMemo(() => {
    const r = rng(seed);
    const [a, b, ink] = PALETTES[Math.floor(r() * PALETTES.length)];
    const angle = Math.floor(r() * 360);
    const bodyX = 50 + (r() - 0.5) * 14;
    const bodyY = 64 + r() * 8;
    const bodyR = 30 + r() * 8;
    const eyeGap = 9 + r() * 6;
    const eyeY = bodyY - 8 + r() * 4;
    const eyeR = 3.2 + r() * 1.6;
    const mouth = Math.floor(r() * 4); // smile, grin, o, flat
    const blush = r() > 0.5;
    const tilt = (r() - 0.5) * 16;
    return { a, b, ink, angle, bodyX, bodyY, bodyR, eyeGap, eyeY, eyeR, mouth, blush, tilt };
  }, [seed]);
  const id = `g${Math.abs(String(seed).split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))}`;
  const { a, b, ink, angle, bodyX, bodyY, bodyR, eyeGap, eyeY, eyeR, mouth, blush, tilt } = art;
  const mx = bodyX;
  const my = eyeY + 11;

  const look = (r) => (r - 0.5) * 2.4; // where the pupils look

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} gradientTransform={`rotate(${angle} .5 .5)`}>
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={ink} />
      <circle cx="18" cy="16" r="26" fill={a} opacity="0.18" />
      <g transform={`rotate(${tilt} ${bodyX} ${bodyY})`}>
        <circle cx={bodyX} cy={bodyY} r={bodyR} fill={`url(#${id})`} />
        <circle cx={bodyX - eyeGap} cy={eyeY} r={eyeR + 2.6} fill="#fff" />
        <circle cx={bodyX + eyeGap} cy={eyeY} r={eyeR + 2.6} fill="#fff" />
        <circle cx={bodyX - eyeGap + look(eyeR / 5)} cy={eyeY + 0.6} r={eyeR * 0.62} fill={ink} />
        <circle cx={bodyX + eyeGap + look(eyeR / 5)} cy={eyeY + 0.6} r={eyeR * 0.62} fill={ink} />
        {blush && (
          <>
            <ellipse cx={bodyX - eyeGap - 4} cy={eyeY + 10} rx="4.5" ry="3" fill="#FF6B8B" opacity="0.45" />
            <ellipse cx={bodyX + eyeGap + 4} cy={eyeY + 10} rx="4.5" ry="3" fill="#FF6B8B" opacity="0.45" />
          </>
        )}
        {mouth === 0 && <path d={`M${mx - 7} ${my} Q${mx} ${my + 7} ${mx + 7} ${my}`} stroke={ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />}
        {mouth === 1 && <path d={`M${mx - 8} ${my - 1} Q${mx} ${my + 10} ${mx + 8} ${my - 1} Z`} fill={ink} />}
        {mouth === 2 && <ellipse cx={mx} cy={my + 2} rx="3.6" ry="4.2" fill={ink} />}
        {mouth === 3 && <path d={`M${mx - 6} ${my + 1} Q${mx} ${my + 4} ${mx + 6} ${my + 1}`} stroke={ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />}
      </g>
    </svg>
  );
}

/**
 * Avatar for a person. `src` may be "gen:<seed>" (a chosen generated avatar),
 * an https image URL (e.g. Google photo), or empty (generated from `seed`).
 */
export function Avatar({ src, seed, size = 32, className = "", ring = false, title }) {
  const [broken, setBroken] = useState(false);
  const isGen = typeof src === "string" && src.startsWith("gen:");
  const isImg = typeof src === "string" && /^https:\/\//.test(src) && !broken;
  // "gen:<hex>" and a raw "0x<hex>" wallet seed produce the same face
  const genSeed = (isGen ? src.slice(4) : String(seed || "commitx")).toLowerCase().replace(/^0x/, "");

  return (
    <span
      title={title}
      className={`relative inline-block shrink-0 rounded-full overflow-hidden bg-raised ${
        ring ? "ring-2 ring-ink outline outline-2 outline-lime/60" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} className="w-full h-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <GeneratedAvatar seed={genSeed} size={size} className="block w-full h-full" />
      )}
    </span>
  );
}

/** Overlapping row of avatars with a "+N" overflow chip. */
export function AvatarStack({ people = [], max = 4, size = 26 }) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  if (!people.length) return null;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.key || p.seed || i}
          className="-ml-2 first:ml-0 rounded-full ring-2 ring-panel transition-transform hover:-translate-y-0.5 hover:z-10"
          style={{ zIndex: shown.length - i }}
        >
          <Avatar src={p.src} seed={p.seed} size={size} title={p.name} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 rounded-full ring-2 ring-panel bg-raised text-[10px] text-dim grid place-items-center num"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Builds AvatarStack items from participant records (with optional `user`). */
export function peopleFromParticipants(participants = []) {
  return participants.map((p) => ({
    key: p.walletAddress,
    seed: p.walletAddress,
    src: p.user?.avatar,
    name: displayName(p.user, p.walletAddress),
  }));
}

"use client";

// Tiny dependency-free confetti burst in the user's accent colour.
export function confetti({ x = 0.5, y = 0.35, count = 90 } = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "215 255 62";
  const colors = [`rgb(${accent})`, "#A393FF", "#4ADE9A", "#F4F3EE", "#FFB547"];

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const parts = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 7;
    return {
      x: innerWidth * x,
      y: innerHeight * y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      round: Math.random() > 0.6,
    };
  });

  const start = performance.now();
  const frame = (t) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }
    if (elapsed < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

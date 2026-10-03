/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/app/**/*.{js,jsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#09090B",
        panel: "#111113",
        raised: "#19191D",
        line: {
          DEFAULT: "#25252B",
          strong: "#393941",
        },
        fg: "#F4F3EE",
        dim: "#A6A59F",
        faint: "#6E6D68",
        // Accent is user-selectable (see globals.css [data-accent]) — always light enough for dark text
        lime: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          soft: "rgb(var(--accent) / 0.10)",
        },
        violet: "#A393FF",
        ok: "#4ADE9A",
        warn: "#FFB547",
        bad: "#FF6B5B",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        lift: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.25), 0 12px 40px -12px rgb(var(--accent) / 0.3)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fill: {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        page: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        pop: {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "60%": { transform: "scale(1.06)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-8deg)" },
          "75%": { transform: "rotate(8deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 0.2s ease-out both",
        "slide-in": "slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 40s linear infinite",
        float: "float 6s ease-in-out infinite",
        fill: "fill 1.2s cubic-bezier(0.16, 1, 0.3, 1) both",
        page: "page 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
        pop: "pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        wiggle: "wiggle 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};

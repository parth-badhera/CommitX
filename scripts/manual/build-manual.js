/**
 * Builds the beginner manual PDF from src/content/manual.js.
 *
 *   npm run manual:pdf
 *
 * Writes scripts/manual/manual.html, then prints it with a local headless
 * Chromium browser (Edge or Chrome) to public/commitx-manual.pdf.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { MANUAL_VERSION, CHAPTERS, FAQ, GLOSSARY, LINKS } = require("../../src/content/manual");

const ROOT = path.join(__dirname, "..", "..");
const HTML_OUT = path.join(__dirname, "manual.html");
const PDF_OUT = path.join(ROOT, "public", "commitx-manual.pdf");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
const pad = (n) => String(n).padStart(2, "0");

const FOX = `<svg viewBox="0 0 40 40" width="44" height="44"><path d="M6 4l11 9h6l11-9-3 17-11 15L9 21z" fill="#F6851B"/><path d="M6 4l11 9-8 8z" fill="#E2761B"/><path d="M34 4L23 13l8 8z" fill="#E2761B"/><path d="M14 22l4 2-2 3zM26 22l-4 2 2 3z" fill="#233447"/><path d="M17 30h6l-3 4z" fill="#C0AD9E"/></svg>`;

const ILLUSTRATIONS = {
  install: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>metamask.io/download</span></div>
    <div class="mock-body center">${FOX}<b>MetaMask</b><span class="pill" style="background:#F6851B;color:#fff">Install MetaMask</span><small>Only from the official site</small></div></div>`,
  wallet: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>Secret Recovery Phrase</span></div>
    <div class="mock-body"><div class="phrase">${Array.from({ length: 12 }, (_, i) => `<span><em>${i + 1}.</em>●●●●●</span>`).join("")}</div>
    <small class="danger">Write on paper. Never share.</small></div></div>`,
  sepolia: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>MetaMask · networks</span></div>
    <div class="mock-body"><div class="row"><span>Show test networks</span><span class="toggle"></span></div>
    <div class="net">Ethereum Mainnet</div><div class="net">Linea</div><div class="net on">Sepolia ✓</div></div></div>`,
  faucet: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>Sepolia faucet</span></div>
    <div class="mock-body"><small>Your address</small><div class="field">0x3855…55f9</div>
    <span class="pill" style="background:#A393FF">Send me ETH</span><small class="ok">+0.05 SepoliaETH</small></div></div>`,
  connect: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>MetaMask</span></div>
    <div class="mock-body center"><div class="pair"><span class="logo">X</span>⇄${FOX.replace(/44/g, "30")}</div>
    <b>Connect to CommitX?</b><div class="btns"><span class="pill ghost">Cancel</span><span class="pill" style="background:#0376C9;color:#fff">Connect</span></div></div></div>`,
  prove: `<div class="mock"><div class="bar"><i></i><i></i><i></i><span>Periods</span></div>
    <div class="mock-body"><div class="cells">${Array.from({ length: 18 }, (_, i) =>
      `<span class="${i === 5 ? "miss" : i < 11 ? "done" : i === 11 ? "now" : ""}"></span>`
    ).join("")}</div><small>■ verified &nbsp; ■ now &nbsp; ■ missed</small></div></div>`,
  withdraw: `<div class="payout"><small>Payout ready to withdraw</small><b>0.0625 ETH</b><span>Withdraw to wallet</span></div>`,
};

const chapterHtml = (c, i) => `
<section class="chapter" id="${c.id}">
  <div class="chapter-head">
    <span class="chapter-num">${pad(i + 1)}</span>
    <div>
      <p class="kicker">${esc(c.part)} · ${esc(c.time)}</p>
      <h2>${esc(c.title)}</h2>
    </div>
  </div>
  <div class="chapter-grid ${ILLUSTRATIONS[c.id] ? "" : "full"}">
    <div>
      <p class="lead">${rich(c.summary)}</p>
      <ol class="steps">${c.steps.map((s) => `<li>${rich(s)}</li>`).join("")}</ol>
      ${c.links ? `<div class="links">${c.links.map((l) => `<div><a href="${esc(l.href)}">${esc(l.label)}</a><span class="url">${esc(l.href)}</span></div>`).join("")}</div>` : ""}
      ${c.tip ? `<div class="callout tip"><b>Tip</b>${rich(c.tip)}</div>` : ""}
      ${c.warning ? `<div class="callout warn"><b>Important</b>${rich(c.warning)}</div>` : ""}
    </div>
    ${ILLUSTRATIONS[c.id] ? `<div class="illo">${ILLUSTRATIONS[c.id]}</div>` : ""}
  </div>
</section>`;

const today = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>CommitX — Beginner Manual</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 18mm 17mm 18mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root { --ink:#09090B; --paper:#FFFFFF; --soft:#F5F5F0; --line:#E4E3DC; --text:#1B1B1F; --dim:#5E5D58; --lime:#D7FF3E; --limeDeep:#6E8A00; --violet:#6B5BE0; --bad:#D8412F; --ok:#1E9E62; }
  html, body { margin:0; background:var(--paper); color:var(--text); font: 10pt/1.55 Inter, "Segoe UI", Arial, sans-serif; }
  h1, h2, h3 { font-family: "Bricolage Grotesque", "Segoe UI", Arial, sans-serif; letter-spacing:-0.02em; margin:0; color:var(--ink); }
  .mono { font-family: "JetBrains Mono", Consolas, monospace; }
  strong { color:var(--ink); font-weight:600; }
  a { color:var(--violet); text-decoration:none; font-weight:500; }

  /* Cover */
  .cover { width:210mm; height:297mm; background:var(--ink); color:#F4F3EE; padding:22mm 20mm; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
  .cover .glow1 { position:absolute; width:150mm; height:150mm; right:-50mm; top:-40mm; border-radius:50%; background:radial-gradient(closest-side, rgba(215,255,62,.35), transparent); }
  .cover .glow2 { position:absolute; width:150mm; height:150mm; left:-60mm; bottom:-40mm; border-radius:50%; background:radial-gradient(closest-side, rgba(163,147,255,.35), transparent); }
  .cover .brand { display:flex; align-items:center; gap:10px; font:700 16pt "Bricolage Grotesque", sans-serif; position:relative; }
  .cover .brand .logo, .logo { width:28px; height:28px; border-radius:8px; background:var(--lime); color:var(--ink); display:inline-grid; place-items:center; font:800 13pt "Bricolage Grotesque", sans-serif; }
  .cover .brand em { color:var(--lime); font-style:normal; }
  .cover .mid { margin-top:auto; position:relative; }
  .cover .tag { display:inline-block; font:500 8pt "JetBrains Mono", monospace; letter-spacing:.16em; text-transform:uppercase; color:#A6A59F; border:1px solid #393941; padding:5px 10px; border-radius:99px; }
  .cover h1 { color:#F4F3EE; font-size:52pt; line-height:.95; margin:18px 0 16px; font-weight:800; }
  .cover h1 span { color:var(--lime); }
  .cover p { color:#A6A59F; font-size:13pt; max-width:130mm; line-height:1.5; margin:0; }
  .cover .meta { margin-top:22mm; display:flex; gap:12mm; position:relative; font-size:9pt; color:#A6A59F; }
  .cover .meta b { display:block; color:#F4F3EE; font:600 11pt Inter, sans-serif; }
  .cover .grid { position:absolute; inset:0; background-image:radial-gradient(rgba(244,243,238,.08) 1px, transparent 1px); background-size:7mm 7mm; }

  /* Contents */
  .intro { page-break-after:always; }
  .kicker { font:500 8pt "JetBrains Mono", monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 6px; }
  .intro h2 { font-size:28pt; margin-bottom:3mm; }
  .flow { display:grid; grid-template-columns:repeat(5,1fr); gap:3mm; margin:5mm 0 7mm; }
  .flow div { background:var(--soft); border:1px solid var(--line); border-radius:10px; padding:4mm 3.5mm; }
  .flow b { display:block; font:700 12pt "Bricolage Grotesque", sans-serif; color:var(--ink); }
  .flow .n { font:500 8pt "JetBrains Mono", monospace; color:var(--limeDeep); }
  .flow p { margin:1.5mm 0 0; font-size:8.5pt; line-height:1.45; color:var(--dim); }
  .toc { border-top:1px solid var(--line); }
  .toc a { display:flex; align-items:baseline; gap:4mm; padding:1.7mm 0; border-bottom:1px solid var(--line); color:var(--text); font-weight:400; }
  .toc .n { font:500 9pt "JetBrains Mono", monospace; color:var(--limeDeep); width:8mm; }
  .toc .t { flex:1; font-weight:500; }
  .toc .p { color:var(--dim); font-size:9pt; }
  .toc .part { padding:3.5mm 0 1.2mm; font:500 8pt "JetBrains Mono", monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); border-bottom:1px solid var(--line); }
  .note { break-inside:avoid; margin-top:5mm; background:var(--ink); color:#F4F3EE; border-radius:12px; padding:5mm 6mm; font-size:9.5pt; }
  .note b { color:var(--lime); }

  /* Chapters */
  .chapter { break-inside:avoid; page-break-inside:avoid; padding:5mm 0 5.5mm; border-bottom:1px solid var(--line); }
  .chapter:first-of-type { padding-top:0; }
  .chapter-head { display:flex; gap:5mm; align-items:flex-start; margin-bottom:3mm; }
  .chapter-num { flex:none; width:13mm; height:13mm; border-radius:10px; background:var(--lime); color:var(--ink); display:grid; place-items:center; font:700 13pt "JetBrains Mono", monospace; }
  .chapter h2 { font-size:19pt; line-height:1.1; }
  .chapter-grid { display:grid; grid-template-columns: 1fr 52mm; gap:8mm; }
  .chapter-grid.full { grid-template-columns: 1fr; }
  .lead { margin:0 0 3mm; color:var(--dim); font-size:10pt; }
  .steps { counter-reset:s; list-style:none; padding:0; margin:0 0 4mm; }
  .steps li { counter-increment:s; position:relative; padding:0 0 1.8mm 9mm; }
  .steps li::before { content:counter(s); position:absolute; left:0; top:.5mm; width:5.5mm; height:5.5mm; border-radius:50%; border:1px solid var(--line); background:var(--soft); font:600 7.5pt "JetBrains Mono", monospace; display:grid; place-items:center; color:var(--ink); }
  .links { margin:0 0 4mm; display:flex; flex-direction:column; gap:1.6mm; }
  .links div { font-size:9.5pt; line-height:1.35; }
  .links .url { display:block; color:var(--dim); font:500 7.5pt "JetBrains Mono", monospace; }
  .callout { border-radius:10px; padding:3mm 4mm; margin-top:2.5mm; font-size:9.5pt; line-height:1.5; }
  .callout b { display:block; font:500 7.5pt "JetBrains Mono", monospace; letter-spacing:.14em; text-transform:uppercase; margin-bottom:1mm; }
  .callout.tip { background:#F6FFD6; border:1px solid #DCEB9B; }
  .callout.tip b { color:var(--limeDeep); }
  .callout.warn { background:#FFF1EE; border:1px solid #F5C6BD; }
  .callout.warn b { color:var(--bad); }

  /* Mock illustrations */
  .mock { border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#fff; font-size:8.5pt; }
  .mock .bar { display:flex; align-items:center; gap:4px; padding:2mm 3mm; background:var(--soft); border-bottom:1px solid var(--line); }
  .mock .bar i { width:6px; height:6px; border-radius:50%; background:#D9D8D1; }
  .mock .bar span { margin-left:4px; font:500 7pt "JetBrains Mono", monospace; color:var(--dim); white-space:nowrap; overflow:hidden; }
  .mock-body { padding:3.5mm; display:flex; flex-direction:column; gap:2mm; }
  .mock-body.center { align-items:center; text-align:center; }
  .mock small { color:var(--dim); font-size:7.5pt; }
  .mock small.danger { color:var(--bad); } .mock small.ok { color:var(--ok); text-align:center; }
  .pill { display:inline-block; border-radius:99px; padding:1.6mm 4mm; font-weight:600; font-size:8pt; text-align:center; color:var(--ink); }
  .pill.ghost { border:1px solid var(--line); color:var(--dim); }
  .btns { display:flex; gap:2mm; }
  .pair { display:flex; align-items:center; gap:2mm; color:var(--dim); }
  .phrase { display:grid; grid-template-columns:repeat(3,1fr); gap:1.4mm; }
  .phrase span { border:1px solid var(--line); border-radius:5px; padding:1mm 1.4mm; font-size:7pt; color:#B9B8B1; letter-spacing:-1px; }
  .phrase em { font-style:normal; color:var(--dim); letter-spacing:0; margin-right:2px; }
  .row { display:flex; justify-content:space-between; align-items:center; padding-bottom:2mm; border-bottom:1px solid var(--line); color:var(--dim); }
  .toggle { width:18px; height:10px; border-radius:99px; background:var(--limeDeep); position:relative; }
  .toggle::after { content:""; position:absolute; right:1.5px; top:1.5px; width:7px; height:7px; border-radius:50%; background:#fff; }
  .net { padding:1.5mm 2mm; border-radius:5px; color:var(--dim); }
  .net.on { background:#F1FFC2; color:var(--ink); font-weight:600; }
  .field { border:1px solid var(--line); border-radius:5px; padding:1.5mm 2mm; font:500 8pt "JetBrains Mono", monospace; }
  .cells { display:grid; grid-template-columns:repeat(6,1fr); gap:1.2mm; }
  .cells span { height:4mm; border-radius:3px; background:var(--soft); border:1px solid var(--line); }
  .cells .done { background:#C6EE2C; border-color:#C6EE2C; } .cells .now { background:#FFB547; border-color:#FFB547; } .cells .miss { background:#F7B3A8; border-color:#F7B3A8; }
  .payout { background:var(--lime); border-radius:12px; padding:4mm; display:flex; flex-direction:column; gap:2mm; }
  .payout small { font-size:7.5pt; color:#3D4A00; }
  .payout b { font:700 17pt "JetBrains Mono", monospace; color:var(--ink); }
  .payout span { background:var(--ink); color:var(--lime); border-radius:99px; text-align:center; padding:1.8mm; font-size:8pt; font-weight:600; }

  /* Formula */
  .formula { break-inside:avoid; margin:8mm 0 0; background:var(--soft); border:1px solid var(--line); border-radius:12px; padding:5mm 6mm; }
  .formula h3 { font-size:14pt; margin-bottom:3mm; }
  .formula .eq { font:500 10pt "JetBrains Mono", monospace; display:flex; justify-content:space-between; padding:1.6mm 0; border-bottom:1px dashed var(--line); }
  .formula .eq:last-of-type { border:0; font-weight:700; color:var(--ink); }
  .formula p { font-size:9pt; color:var(--dim); margin:3mm 0 0; }

  /* Back matter */
  .section-title { margin:12mm 0 4mm; break-after:avoid; }
  .section-title h2 { font-size:26pt; }
  .faq { break-inside:avoid; padding:3.5mm 0; border-bottom:1px solid var(--line); }
  .faq b { display:block; color:var(--ink); margin-bottom:1mm; }
  .faq p { margin:0; color:var(--dim); font-size:10pt; }
  .gloss { display:grid; grid-template-columns:1fr 1fr; gap:3mm; }
  .gloss div { break-inside:avoid; border:1px solid var(--line); border-radius:10px; padding:3mm 4mm; }
  .gloss b { display:block; color:var(--ink); }
  .gloss span { color:var(--dim); font-size:9pt; }
  .end { margin-top:10mm; background:var(--ink); color:#A6A59F; border-radius:14px; padding:7mm; break-inside:avoid; }
  .end h3 { color:#F4F3EE; font-size:17pt; margin-bottom:2mm; }
  .end b { color:var(--lime); }
</style></head>
<body>

<section class="cover">
  <div class="grid"></div><div class="glow1"></div><div class="glow2"></div>
  <div class="brand"><span class="logo">X</span>Commit<em>X</em></div>
  <div class="mid">
    <span class="tag">Beginner manual · v${MANUAL_VERSION}</span>
    <h1>From zero to<br/>your first <span>payout.</span></h1>
    <p>How to install MetaMask, get free test ETH, connect to CommitX, stake on a goal, prove your progress and withdraw what you've earned.</p>
  </div>
  <div class="meta">
    <div><b>${CHAPTERS.length} chapters</b>Step by step</div>
    <div><b>~10 minutes</b>One-time setup</div>
    <div><b>Sepolia testnet</b>Nothing real at risk</div>
    <div><b>${esc(today)}</b>Edition</div>
  </div>
</section>

<section class="intro">
  <p class="kicker">Overview</p>
  <h2>How CommitX works</h2>
  <p class="lead">You put a small stake behind a goal. Each period you prove you did the work, and your cohort checks it. At the end, the smart contract pays everyone back based on how consistently they showed up — people who hit the target also split what the others forfeited.</p>
  <div class="flow">
    ${[
      ["Commit", "Pick a goal and how often you'll prove it."],
      ["Stake", "Lock test ETH in the contract."],
      ["Prove", "Post a link every period."],
      ["Verify", "Peers approve each proof."],
      ["Withdraw", "Pull your payout to your wallet."],
    ]
      .map(([t, d], i) => `<div><span class="n">${pad(i + 1)}</span><b>${t}</b><p>${d}</p></div>`)
      .join("")}
  </div>
  <p class="kicker">Contents</p>
  <nav class="toc">
    ${["Get set up", "Use CommitX"]
      .map(
        (part, pi) =>
          `<div class="part">Part ${pi + 1} — ${part}</div>` +
          CHAPTERS.map((c, i) => [c, i])
            .filter(([c]) => c.part === part)
            .map(([c, i]) => `<a href="#${c.id}"><span class="n">${pad(i + 1)}</span><span class="t">${esc(c.title)}</span><span class="p">${esc(c.time)}</span></a>`)
            .join("")
      )
      .join("")}
    <div class="part">Reference</div>
    <a href="#help"><span class="n">—</span><span class="t">Troubleshooting</span></a>
    <a href="#glossary"><span class="n">—</span><span class="t">Glossary</span></a>
  </nav>
  <div class="note"><b>Safety first.</b> CommitX will never ask for your recovery phrase or private key. Only approve wallet requests that you started yourself.</div>
</section>

<main>
  ${CHAPTERS.map(chapterHtml).join("")}
  <div class="formula">
    <h3>How your payout is calculated</h3>
    <div class="eq"><span>joining fee</span><span>0.125% of stake (non-refundable)</span></div>
    <div class="eq"><span>kept</span><span>(stake − fee) × verified periods ÷ total periods</span></div>
    <div class="eq"><span>bonus</span><span>penalty pool × your periods ÷ all qualifiers' periods</span></div>
    <div class="eq"><span>payout</span><span>kept + bonus</span></div>
    <p>You only get the bonus if you reach the qualification threshold. If nobody qualifies, everyone still keeps what they earned and the pool goes to the treasury.</p>
  </div>
</main>

<section class="section-title" id="help"><p class="kicker">Reference</p><h2>Troubleshooting</h2></section>
${FAQ.map((f) => `<div class="faq"><b>${rich(f.q)}</b><p>${rich(f.a)}</p></div>`).join("")}

<section class="section-title" id="glossary"><p class="kicker">Reference</p><h2>Glossary</h2></section>
<div class="gloss">
  ${GLOSSARY.map(([t, d]) => `<div><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join("")}
</div>

<div class="end">
  <h3>You're ready.</h3>
  Open CommitX, head to <b>Explore</b>, and join your first challenge. The same guide lives on the <b>Learn</b> page, with a live checklist that shows what's left to set up.<br/><br/>
  Useful links: <span class="mono">${esc(LINKS.metamask)}</span> · <span class="mono">${esc(LINKS.etherscan)}</span>
</div>

</body></html>`;

fs.writeFileSync(HTML_OUT, html);
console.log(`HTML written: ${path.relative(ROOT, HTML_OUT)}`);

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) {
  console.error("No Chrome/Edge found. Set CHROME_PATH, or open manual.html and print to PDF manually.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(PDF_OUT), { recursive: true });
execFileSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-pdf-header-footer",
    "--virtual-time-budget=8000",
    `--print-to-pdf=${PDF_OUT}`,
    pathToFileURL(HTML_OUT).href,
  ],
  { stdio: "inherit" }
);
console.log(`PDF written: ${path.relative(ROOT, PDF_OUT)} (${Math.round(fs.statSync(PDF_OUT).size / 1024)} KB)`);

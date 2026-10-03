/**
 * Builds the technical documentation PDF from scripts/techdoc/content.js.
 *
 *   npm run docs:pdf
 *
 * Writes scripts/techdoc/techdoc.html, then prints it with a local headless
 * Chromium browser (Edge or Chrome) to docs/CommitX-Technical-Documentation.pdf.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { sections } = require("./content");

const ROOT = path.join(__dirname, "..", "..");
const HTML_OUT = path.join(__dirname, "techdoc.html");
const PDF_OUT = path.join(ROOT, "docs", "CommitX-Technical-Documentation.pdf");
const pad = (n) => String(n).padStart(2, "0");
const today = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>CommitX — Technical Documentation</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 16mm 16mm 16mm; }
  @page :first { margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root { --ink:#09090B; --soft:#F5F5F0; --line:#E4E3DC; --text:#1B1B1F; --dim:#5E5D58; --lime:#D7FF3E; --limeDeep:#6E8A00; --violet:#6B5BE0; }
  html, body { margin:0; background:#fff; color:var(--text); font: 9.6pt/1.55 Inter, "Segoe UI", Arial, sans-serif; }
  h1, h2, h3, h4 { font-family: "Bricolage Grotesque", "Segoe UI", Arial, sans-serif; letter-spacing:-0.02em; color:var(--ink); margin:0; }
  h3 { font-size:12.5pt; margin:5mm 0 2mm; break-after:avoid; }
  h4 { font-size:10.5pt; margin-bottom:2mm; }
  p { margin:0 0 2.5mm; }
  ul, ol { margin:0 0 3mm; padding-left:5.5mm; } li { margin-bottom:1mm; }
  b { color:var(--ink); font-weight:600; }
  .mono, pre { font-family: "JetBrains Mono", Consolas, monospace; }
  .mono { font-size:8.4pt; }
  pre { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:3mm 4mm; font-size:7.9pt; line-height:1.5; white-space:pre-wrap; break-inside:avoid; margin:0 0 3mm; }
  table { width:100%; border-collapse:collapse; margin:0 0 3.5mm; font-size:8.6pt; break-inside:auto; }
  tr { break-inside:avoid; }
  th { text-align:left; font:500 7.4pt "JetBrains Mono", monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--dim); border-bottom:1.5px solid var(--ink); padding:1.6mm 2mm; }
  td { border-bottom:1px solid var(--line); padding:1.6mm 2mm; vertical-align:top; }
  table.kv td:first-child { color:var(--dim); width:22mm; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:4mm; margin-bottom:3mm; }
  .card { border:1px solid var(--line); border-radius:10px; padding:4mm; break-inside:avoid; }
  .callout { background:#F6FFD6; border:1px solid #DCEB9B; border-radius:10px; padding:3mm 4mm; margin:0 0 3mm; break-inside:avoid; }
  .diagram { width:100%; height:auto; margin:2mm 0 2mm; font-family: Inter, "Segoe UI", sans-serif; break-inside:avoid; }
  .caption { font-size:8pt; color:var(--dim); text-align:center; }
  .qa { break-inside:avoid; padding:2.5mm 0; border-bottom:1px solid var(--line); }
  .qa .q { font-weight:600; color:var(--ink); margin-bottom:1mm; }
  .qa .q::before { content:"Q  "; color:var(--violet); font-family:"JetBrains Mono", monospace; }
  .qa p:last-child { margin:0; color:#33332F; }

  .cover { width:210mm; height:297mm; background:var(--ink); color:#F4F3EE; padding:22mm 20mm; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
  .cover .grid { position:absolute; inset:0; background-image:radial-gradient(rgba(244,243,238,.08) 1px, transparent 1px); background-size:7mm 7mm; }
  .cover .glow { position:absolute; width:160mm; height:160mm; right:-60mm; top:-50mm; border-radius:50%; background:radial-gradient(closest-side, rgba(163,147,255,.4), transparent); }
  .cover .glow2 { position:absolute; width:150mm; height:150mm; left:-60mm; bottom:-50mm; border-radius:50%; background:radial-gradient(closest-side, rgba(215,255,62,.3), transparent); }
  .brand { display:flex; align-items:center; gap:10px; font:700 16pt "Bricolage Grotesque", sans-serif; position:relative; }
  .brand .logo { width:28px; height:28px; border-radius:8px; background:var(--lime); color:var(--ink); display:inline-grid; place-items:center; font-weight:800; }
  .brand em { color:var(--lime); font-style:normal; }
  .cover .mid { margin-top:auto; position:relative; }
  .tag { display:inline-block; font:500 8pt "JetBrains Mono", monospace; letter-spacing:.16em; text-transform:uppercase; color:#A6A59F; border:1px solid #393941; padding:5px 10px; border-radius:99px; }
  .cover h1 { color:#F4F3EE; font-size:46pt; line-height:.98; margin:18px 0 16px; font-weight:800; }
  .cover h1 span { color:var(--lime); }
  .cover p { color:#A6A59F; font-size:12pt; max-width:140mm; margin:0; }
  .cover .meta { margin-top:20mm; display:flex; gap:11mm; position:relative; font-size:9pt; color:#A6A59F; }
  .cover .meta b { display:block; color:#F4F3EE; font:600 11pt Inter, sans-serif; }

  .toc-page { page-break-after:always; }
  .kicker { font:500 8pt "JetBrains Mono", monospace; letter-spacing:.14em; text-transform:uppercase; color:var(--dim); margin:0 0 6px; }
  .toc-page h2 { font-size:28pt; margin-bottom:6mm; }
  .toc a { display:flex; gap:5mm; padding:2.6mm 0; border-bottom:1px solid var(--line); color:var(--text); text-decoration:none; font-size:11pt; }
  .toc .n { font:500 10pt "JetBrains Mono", monospace; color:var(--limeDeep); width:9mm; }

  section.doc { page-break-before:always; }
  section.doc:first-of-type { page-break-before:auto; }
  .sec-head { display:flex; align-items:center; gap:4mm; margin-bottom:4mm; padding-bottom:3mm; border-bottom:2px solid var(--ink); }
  .sec-num { width:12mm; height:12mm; border-radius:9px; background:var(--lime); display:grid; place-items:center; font:700 12pt "JetBrains Mono", monospace; color:var(--ink); }
  .sec-head h2 { font-size:21pt; }
</style></head>
<body>
<section class="cover">
  <div class="grid"></div><div class="glow"></div><div class="glow2"></div>
  <div class="brand"><span class="logo">X</span>Commit<em>X</em></div>
  <div class="mid">
    <span class="tag">Technical documentation</span>
    <h1>Theory, design &amp;<br/>architecture of <span>CommitX.</span></h1>
    <p>A complete reference to the protocol, smart contract, backend, frontend, security model, testing and deployment — with answers to the questions asked in technical interviews.</p>
  </div>
  <div class="meta">
    <div><b>${sections.length} sections</b>End to end</div>
    <div><b>Solidity + Next.js</b>Full stack</div>
    <div><b>Sepolia</b>Chain 11155111</div>
    <div><b>${today}</b>Edition</div>
  </div>
</section>

<section class="toc-page">
  <p class="kicker">Contents</p>
  <h2>What's inside</h2>
  <nav class="toc">${sections.map((s, i) => `<a href="#${s.id}"><span class="n">${pad(i + 1)}</span>${s.title}</a>`).join("")}</nav>
</section>

${sections
  .map(
    (s, i) => `<section class="doc" id="${s.id}">
  <div class="sec-head"><span class="sec-num">${pad(i + 1)}</span><h2>${s.title}</h2></div>
  ${s.html}
</section>`
  )
  .join("\n")}
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
  console.error("No Chrome/Edge found. Set CHROME_PATH, or open techdoc.html and print to PDF manually.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(PDF_OUT), { recursive: true });
execFileSync(
  browser,
  ["--headless=new", "--disable-gpu", `--user-data-dir=${path.join(require("os").tmpdir(), "commitx-techdoc-profile")}`, "--no-first-run", "--no-pdf-header-footer", "--virtual-time-budget=8000", `--print-to-pdf=${PDF_OUT}`, pathToFileURL(HTML_OUT).href],
  { stdio: "inherit" }
);
console.log(`PDF written: ${path.relative(ROOT, PDF_OUT)} (${Math.round(fs.statSync(PDF_OUT).size / 1024)} KB)`);

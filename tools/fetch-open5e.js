// Pull the EN Publishing sources from Open5e into raw JSON files.
const fs = require("fs");
const path = require("path");
const OUT = process.env.ACG_RAW_DIR ? path.join(process.env.ACG_RAW_DIR, "o5e") : path.join(__dirname, "raw", "o5e");
fs.mkdirSync(OUT, { recursive: true });

const get = url => new Promise((res, rej) => {
  require("https").get(url, { headers: { "User-Agent": "auto-character-generator" } }, r => {
    if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return get(r.headers.location).then(res, rej);
    let s = "";
    r.on("data", d => s += d);
    r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(new Error(url + " -> " + s.slice(0, 200))); } });
  }).on("error", rej);
});

// Walk every page of a list endpoint
async function all(endpoint, query) {
  let url = `https://api.open5e.com/v2/${endpoint}/?${query}&limit=100`;
  const out = [];
  while (url) {
    const page = await get(url);
    out.push(...(page.results || []));
    url = page.next;
    process.stdout.write(`\r  ${endpoint} ${query.slice(0, 30)}: ${out.length}   `);
  }
  process.stdout.write("\n");
  return out;
}

const JOBS = [
  ["spells",      "document__key=a5e-ag",  "ag-spells"],
  ["feats",       "document__key=a5e-ag",  "ag-feats"],
  ["backgrounds", "document__key=a5e-ag",  "ag-backgrounds"],
  ["backgrounds", "document__key=a5e-ddg", "ddg-backgrounds"],
  ["backgrounds", "document__key=a5e-gpg", "gpg-backgrounds"],
  ["conditions",  "document__key=a5e-ag",  "ag-conditions"],
  ["classes",     "document__key=a5e-ag",  "ag-classes"],
  ["creatures",   "document__key=a5e-mm",  "mm-creatures"],
];

(async () => {
  for (const [ep, q, name] of JOBS) {
    const file = path.join(OUT, name + ".json");
    if (fs.existsSync(file)) { console.log(`  ${name}: cached`); continue; }
    const data = await all(ep, q);
    fs.writeFileSync(file, JSON.stringify(data));
    console.log(`  ${name}: ${data.length} saved (${(fs.statSync(file).size/1024).toFixed(0)} KB)`);
  }
  console.log("done");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });

// Turn the raw Open5e pulls into the two data files the app ships.
//   js/open5e.js   - A5E spells, feats, backgrounds, conditions, the Marshal class
//   js/bestiary.js - Monstrous Menagerie creatures, loaded on demand
const fs = require("fs");
const path = require("path");
const SP = process.env.ACG_RAW_DIR || path.join(__dirname, "raw");
const OUT = process.env.ACG_JS_DIR || path.join(__dirname, "..", "js");
const R = n => JSON.parse(fs.readFileSync(path.join(SP, "o5e", n + ".json"), "utf8"));

// Markdown-ish source text into something the app can drop into HTML safely.
// Bold and italics survive; everything else becomes plain text with breaks.
const isTableRow = l => /^\s*\|.*\|\s*$/.test(l);
const isTableRule = l => /^\s*\|[\s:|-]*\|\s*$/.test(l) && l.includes("-");
const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());

function md(s) {
  const inline = t => t
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s.,;:)]|$)/g, "$1<i>$2</i>")
    .replace(/\*+/g, "");

  const lines = String(s || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Roll tables come through as markdown pipe tables
    if (isTableRow(l) && isTableRow(lines[i + 1] || "") && isTableRule(lines[i + 1])) {
      const head = cells(l);
      let body = "";
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        body += "<tr>" + cells(lines[i]).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
        i++;
      }
      i--;
      out.push(`<table class="md-t"><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }
    // Headings become bold run-in labels
    const h = /^\s*#{1,6}\s*(.+?)\s*$/.exec(l);
    if (h) { out.push(`<b>${inline(h[1])}</b>`); continue; }
    // Bullets, including source lines that forget the space after the asterisk
    const b = /^\s*[*-][ \t]*(\S.*)$/.exec(l);
    if (b) { out.push("• " + inline(b[1])); continue; }
    out.push(inline(l));
  }
  return out.join("\n")
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>")
    // A table brings its own block spacing
    .replace(/(<br>)+(<table)/g, "$2").replace(/(<\/table>)(<br>)+/g, "$1")
    .trim();
}
const clean = s => String(s || "").replace(/\s+/g, " ").trim();

// ---------- SPELLS ----------
const SCHOOL = {};
const spells = R("ag-spells").map(s => {
  const comp = [s.verbal && "V", s.somatic && "S", s.material && "M"].filter(Boolean).join(", ");
  const o = {
    n: s.name,
    l: s.level,
    s: (s.school && s.school.name) || "",
    t: clean(s.casting_time || "").replace(/_/g, " "),
    r: clean(s.range_text || (s.range != null ? s.range + " feet" : "")) || "Self",
    c: comp + (s.material_specified ? ` (${clean(s.material_specified)})` : ""),
    u: clean(s.duration || "Instantaneous"),
    d: md(s.desc)
  };
  if (s.concentration) o.conc = 1;
  if (s.ritual) o.rit = 1;
  if (s.higher_level) o.hl = md(s.higher_level);
  if (s.damage_roll) o.dmg = clean(s.damage_roll);
  if (s.saving_throw_ability) o.sav = clean(s.saving_throw_ability);
  if (s.attack_roll) o.atk = 1;
  SCHOOL[o.s] = 1;
  return o;
});

// ---------- FEATS ----------
const feats = R("ag-feats").map(f => {
  const bens = (f.benefits || []).map(b => md(b.desc)).filter(Boolean);
  return {
    n: f.name,
    pre: clean(f.prerequisite || ""),
    d: md(f.desc) || "",
    b: bens
  };
});

// ---------- BACKGROUNDS ----------
const SRC_OF = { "ag-backgrounds": "a5e-ag", "ddg-backgrounds": "a5e-ddg", "gpg-backgrounds": "a5e-gpg" };
const backgrounds = [];
Object.entries(SRC_OF).forEach(([file, src]) => {
  R(file).forEach(b => backgrounds.push({
    n: b.name, src,
    d: md(b.desc),
    b: (b.benefits || []).map(x => ({ n: x.name || "", d: md(x.desc) })).filter(x => x.d)
  }));
});

// ---------- CONDITIONS ----------
const conditions = R("ag-conditions").map(c => ({
  n: c.name,
  d: md((c.descriptions || []).map(x => x.desc).join("\n\n"))
}));

// ---------- CLASSES (the Marshal, plus its three subclasses) ----------
const rawClasses = R("ag-classes");
const marshal = rawClasses.find(c => !c.subclass_of);
const marshalSubs = rawClasses.filter(c => c.subclass_of);
const levelsOf = f => [...new Set((f.gained_at || []).map(g => g.level))].filter(n => n != null).sort((a, b) => a - b);

function classFeatures(c) {
  const out = [];
  (c.features || []).forEach(f => {
    if (["PROFICIENCY_BONUS", "CLASS_TABLE_DATA"].includes(f.feature_type)) return;
    const lv = levelsOf(f);
    out.push({ n: f.name, lv: lv.length ? lv : null, t: f.feature_type, d: md(f.desc) });
  });
  return out;
}
// The Marshal maps onto the same shape the app's own classes use, so it can be
// played rather than only read about. Proficiencies come from the rendered
// prose, which is authoritative where the structured field disagrees.
const AB3 = { strength:"STR", dexterity:"DEX", constitution:"CON", intelligence:"INT", wisdom:"WIS", charisma:"CHA" };
function marshalPlayable() {
  const prof = marshal.features.find(f => f.feature_type === "PROFICIENCIES");
  const equip = marshal.features.find(f => f.feature_type === "STARTING_EQUIPMENT");
  const txt = String(prof && prof.desc || "");
  const grab = label => {
    const m = new RegExp("\\*\\*" + label + ":?\\*\\*\\s*([^\\n]+)").exec(txt);
    return m ? m[1].trim().replace(/\.$/, "") : "";
  };
  const saves = (grab("Saving Throws").match(/[A-Z][a-z]+/g) || [])
    .map(w => AB3[w.toLowerCase()]).filter(Boolean);
  const skillTxt = grab("Skills");
  const NUM = { one:1, two:2, three:3, four:4 };
  const count = NUM[(/(one|two|three|four)/i.exec(skillTxt) || [])[1]?.toLowerCase()] || 2;
  const skillList = (skillTxt.split(/from/i)[1] || "").split(/,|\band\b/)
    .map(s => s.trim().replace(/\.$/, "")).filter(Boolean);
  // First listed equipment package, plus the starting gold
  const pack = (String(equip && equip.desc || "").match(/^[ \t]*[-*]\s*\*\*(.+?)\s*\(Cost[^)]*\):?\*\*\s*(.+)$/m) || [])[2] || "";
  const gold = (/begin the game with\s*([\d,]+)\s*gp/i.exec(String(equip && equip.desc || "")) || [])[1] || "";
  const title = s => s.replace(/\s+/g, " ").trim().replace(/(^|\s)([a-z])/g, (m, a, c) => a + c.toUpperCase());
  // A5E armour has no entry in Open5e, so the two pieces without one are
  // carried as their nearest SRD equivalents. That keeps the sheet's armour
  // class, attacks, and reference lookups working on known gear.
  const GEAR_ALIAS = { "Hauberk": "Chain Shirt", "Light Shield": "Shield", "Padded Leather": "Leather Armor" };
  const equipment = pack.split(",").map(s => { const t = title(s); return GEAR_ALIAS[t] || t; }).filter(Boolean);
  if (gold) equipment.push(gold.replace(/,/g, "") + " GP");

  const byLevel = {};
  const level1 = [];
  marshal.features.forEach(f => {
    if (["PROFICIENCY_BONUS", "CLASS_TABLE_DATA", "PROFICIENCIES", "STARTING_EQUIPMENT"].includes(f.feature_type)) return;
    if (/^Ability Score Improvement$/i.test(f.name)) return;   // ASI_LEVELS handles this
    const lvls = levelsOf(f);
    if (!lvls.length) return;
    lvls.forEach(lv => {
      const label = /Archetype$/i.test(f.name) ? "Subclass: Marshal Archetype" : f.name;
      if (lv === 1) { if (!level1.includes(label)) level1.push(label); }
      else { (byLevel[lv] = byLevel[lv] || []).push(label); }
    });
  });
  const subs = {};
  marshalSubs.forEach(s => {
    const f = {};
    (s.features || []).forEach(x => {
      levelsOf(x).forEach(lv => { (f[lv] = f[lv] || []).push(x.name); });
    });
    subs[s.name] = { d: clean(String(s.desc || "").split("\n")[0]).slice(0, 220), f };
  });
  return {
    Marshal: {
      hitDie: parseInt(String(marshal.hit_dice).replace(/\D/g, ""), 10) || 10,
      saves, primary: ["STR", "CHA", "CON"],
      skillCount: count, skillList,
      armor: grab("Armor"), weapons: grab("Weapons"),
      features: level1, equipment,
      levels: byLevel, subs
    }
  };
}
const a5ePlayable = marshalPlayable();

const a5eClasses = [{
  n: marshal.name,
  hd: parseInt(String(marshal.hit_dice).replace(/\D/g, ""), 10) || 10,
  saves: (marshal.saving_throws || []).map(s => s.name.slice(0, 3).toUpperCase()),
  caster: (marshal.caster_type || "NONE") !== "NONE",
  d: md(marshal.desc),
  f: classFeatures(marshal),
  subs: marshalSubs.map(s => ({ n: s.name, d: md(s.desc), f: classFeatures(s) }))
}];

// ---------- CREATURES ----------
const creatures = R("mm-creatures").map(c => {
  const sp = c.speed || {};
  const speed = Object.entries(sp).filter(([k, v]) => k !== "unit" && v).map(([k, v]) => k === "walk" ? `${v} ft.` : `${k} ${v} ft.`).join(", ");
  const senses = [];
  if (c.blindsight_range) senses.push(`blindsight ${c.blindsight_range} ft.`);
  if (c.darkvision_range) senses.push(`darkvision ${c.darkvision_range} ft.`);
  if (c.tremorsense_range) senses.push(`tremorsense ${c.tremorsense_range} ft.`);
  if (c.truesight_range) senses.push(`truesight ${c.truesight_range} ft.`);
  if (c.passive_perception) senses.push(`passive Perception ${c.passive_perception}`);
  const ri = (c.resistances_and_immunities || {});
  const risum = [];
  const listOf = v => Array.isArray(v) ? v.map(x => (x && (x.name || x.key)) || x).join(", ") : "";
  if (listOf(ri.damage_vulnerabilities)) risum.push("Vulnerable: " + listOf(ri.damage_vulnerabilities));
  if (listOf(ri.damage_resistances)) risum.push("Resistant: " + listOf(ri.damage_resistances));
  if (listOf(ri.damage_immunities)) risum.push("Immune: " + listOf(ri.damage_immunities));
  if (listOf(ri.condition_immunities)) risum.push("Condition immunities: " + listOf(ri.condition_immunities));
  const a = c.ability_scores || {};
  const saves = Object.entries(c.saving_throws || {}).map(([k, v]) => `${k.slice(0, 3).toUpperCase()} ${v >= 0 ? "+" : ""}${v}`).join(", ");
  const skills = Object.entries(c.skill_bonuses || {}).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)} ${v >= 0 ? "+" : ""}${v}`).join(", ");
  const acts = (c.actions || []).map(x => ({ n: x.name, d: md(x.desc || "") }));
  const trts = (c.traits || []).map(x => ({ n: x.name, d: md(x.desc || "") }));
  const o = {
    n: c.name,
    sz: (c.size && c.size.name) || "",
    ty: (c.type && c.type.name) || "",
    cr: c.challenge_rating,
    xp: c.experience_points || 0,
    ac: c.armor_class,
    acd: clean(c.armor_detail || ""),
    hp: c.hit_points,
    hd: clean(c.hit_dice || ""),
    spd: speed,
    ab: [a.strength, a.dexterity, a.constitution, a.intelligence, a.wisdom, a.charisma]
  };
  // The source carries no environment or creature-set data for this book, and
  // its alignment field reads "chaotic evil" for all 586 creatures (cats and
  // commoners included), so none of those are stored rather than shown wrong.
  if (saves) o.sv = saves;
  if (skills) o.sk = skills;
  if (senses.length) o.se = senses.join(", ");
  if (c.languages && c.languages.as_string) o.lg = clean(c.languages.as_string);
  if (risum.length) o.ri = risum.join(". ");
  if (trts.length) o.tr = trts;
  if (acts.length) o.ac2 = acts;
  return o;
});

// ---------- WRITE ----------
const hdr = `// GENERATED FILE - do not edit by hand.
// Built from the Open5e API (https://open5e.com) from EN Publishing's
// Level Up: Advanced 5th Edition sources. See README.md and the Settings tab
// for the full attribution and licence terms.
`;

const open5e = hdr + `
// Where each block of content came from, for labelling and attribution
const A5E_SOURCES = {
  "a5e-ag":  { n:"Adventurer's Guide",     pub:"EN Publishing", lic:"CC-BY-4.0 / OGL-1.0a", url:"https://a5esrd.com/a5esrd" },
  "a5e-ddg": { n:"Dungeon Delver's Guide", pub:"EN Publishing", lic:"CC-BY-4.0 / OGL-1.0a", url:"https://a5esrd.com/a5esrd" },
  "a5e-gpg": { n:"Gate Pass Gazette",      pub:"EN Publishing", lic:"CC-BY-4.0 / OGL-1.0a", url:"https://a5esrd.com/a5esrd" },
  "a5e-mm":  { n:"Monstrous Menagerie",    pub:"EN Publishing", lic:"OGL-1.0a",             url:"https://a5esrd.com/a5esrd" }
};
const A5E_SPELLS = ${JSON.stringify(spells)};
const A5E_FEATS = ${JSON.stringify(feats)};
const A5E_BACKGROUNDS = ${JSON.stringify(backgrounds)};
const A5E_CONDITIONS = ${JSON.stringify(conditions)};
const A5E_CLASSES = ${JSON.stringify(a5eClasses)};
// Shaped to drop straight into the app's own CLASSES / CLASS_LEVELS / SUBCLASSES
const A5E_PLAYABLE = ${JSON.stringify(a5ePlayable)};
`;

const bestiary = hdr + `
// Monstrous Menagerie creatures, loaded only when the Bestiary is opened.
const A5E_CREATURES = ${JSON.stringify(creatures)};
if (typeof onBestiaryLoaded === "function") onBestiaryLoaded();
`;

fs.writeFileSync(path.join(OUT, "open5e.js"), open5e);
fs.writeFileSync(path.join(OUT, "bestiary.js"), bestiary);
const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + " KB";
console.log(`open5e.js   ${kb("open5e.js")}  (spells ${spells.length}, feats ${feats.length}, backgrounds ${backgrounds.length}, conditions ${conditions.length}, classes ${a5eClasses.length} + ${marshalSubs.length} subclasses)`);
console.log(`bestiary.js ${kb("bestiary.js")}  (creatures ${creatures.length})`);
console.log("schools:", Object.keys(SCHOOL).join(", "));

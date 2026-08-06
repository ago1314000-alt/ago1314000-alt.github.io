// App logic for the D&D Character Generator (data lives in data.js)
// ---------- STATE ----------
const state = {
  name:"", cls:"", species:"", background:"", alignment:"", playerName:"", xp:"",
  scores:{STR:null,DEX:null,CON:null,INT:null,WIS:null,CHA:null},
  skills:[], spells:[], level:1, dieRolls:[], loadedId:null,
  traits:"", ideals:"", bonds:"", flaws:"", notes:"",
  tempHp:0, inspiration:false, deathS:0, deathF:0,
  slotsUsed:{}, hdUsed:0, stable:false, retired:false
};
let sheetTargetId = "sheet";

// Inline die icon with the die name inside the shape, like the Dice of Fate
function dieIcon(sides) {
  const cfg = {
    4:{shape:'<polygon points="32,8 58,54 6,54"/>', y:48, f:19},
    6:{shape:'<rect x="13" y="13" width="38" height="38"/>', y:38, f:19},
    8:{shape:'<polygon points="32,5 59,32 32,59 5,32"/>', y:38, f:17},
    10:{shape:'<polygon points="32,5 57,25 49,57 15,57 7,25"/>', y:41, f:16},
    12:{shape:'<polygon points="32,7 58,26 48,58 16,58 6,26"/>', y:41, f:16},
    20:{shape:'<polygon points="32,8 53,20 53,44 32,56 11,44 11,20"/>', y:38, f:16}
  }[sides] || {shape:'<polygon points="32,8 53,20 53,44 32,56 11,44 11,20"/>', y:38, f:15};
  return `<svg class="die-ico" viewBox="0 0 64 64" role="img" aria-label="d${sides}">${cfg.shape}<text x="32" y="${cfg.y}" font-size="${cfg.f}">d${sides}</text></svg>`;
}
// Replace every dice mention in a string with the labeled shape: "2d6" -> 2x [d6 icon]
function allDice(str) {
  return String(str).replace(/(\d+)?d(4|6|8|10|12|20)\b/g, (m,n,s)=>`${n && +n>1 ? n+"×" : ""}${dieIcon(+s)}`);
}
// Kept for existing call sites
function diceHtml(dice) { return allDice(dice); }

// Reduce a sheet line to a term the reference lookup can resolve
function refTermFrom(s) {
  return String(s).replace(/<[^>]*>/g,"").split(" (")[0].replace(/^Origin Feat: /,"").replace(/^Subclass: /,"").trim();
}
// Equipment lines: drop counts, parentheticals, and trailing lists ("4 Handaxes", "Longbow, 20 Arrows, Quiver")
function eqTermFrom(s) {
  return String(s).split(",")[0].split(" or ")[0].split(" (")[0].replace(/^\d+\s+/,"").trim();
}

// Rewrite level-1 feature text with level-appropriate numbers
function scaleFeature(cls, f, lvl) {
  const cant = CANTRIPS_KNOWN[cls] ? CANTRIPS_KNOWN[cls][lvl-1] : null;
  const prep = PREPARED_SPELLS[cls] ? PREPARED_SPELLS[cls][lvl-1] : null;
  if (f.startsWith("Rage (")) return `Rage (${SCALING.rageUses(lvl)}/Long Rest, +${SCALING.rageDmg(lvl)} damage)`;
  if (f.startsWith("Sneak Attack (")) return `Sneak Attack (${SCALING.sneakDice(lvl)}d6)`;
  if (f.startsWith("Martial Arts (")) return `Martial Arts (d${SCALING.martialDie(lvl)})`;
  if (f.startsWith("Bardic Inspiration (")) return `Bardic Inspiration (d${SCALING.bardDie(lvl)})`;
  if (f.startsWith("Second Wind (")) return `Second Wind (${SCALING.secondWind(lvl)}/Long Rest, 1d10+level HP)`;
  if (f.startsWith("Lay On Hands (")) return `Lay On Hands (${5*lvl} HP pool)`;
  if (f.startsWith("Eldritch Invocations (")) return `Eldritch Invocations (${SCALING.invocations(lvl)})`;
  if (f.startsWith("Pact Magic (")) {
    const p = pactSlots(lvl);
    return `Pact Magic (Charisma): ${cant} cantrips, ${prep} spells prepared, ${p.n} level-${p.l} slot${p.n>1?"s":""}`;
  }
  if (f.includes("spells prepared") && prep!=null) {
    let out = f.replace(/\d+ spells prepared/, `${prep} spells prepared`);
    if (cant!=null) out = out.replace(/\d+ cantrips/, `${cant} cantrips`);
    return out;
  }
  return f;
}

// ---------- HELPERS ----------
const rand = arr => arr[Math.floor(Math.random()*arr.length)];
const mod = s => Math.floor((s-10)/2);
const fmtMod = m => (m>=0?"+":"")+m;
function roll4d6() {
  const r = [0,0,0,0].map(()=>1+Math.floor(Math.random()*6)).sort((a,b)=>b-a);
  return r[0]+r[1]+r[2];
}

// ---------- UI SETUP ----------
function fillSelect(id, options) {
  const el = document.getElementById(id);
  el.innerHTML = '<option value="">-- choose --</option>' + options.map(o=>`<option>${o}</option>`).join("");
}
fillSelect("selClass", Object.keys(CLASSES));
fillSelect("selSpecies", Object.keys(SPECIES));
fillSelect("selBackground", Object.keys(BACKGROUNDS));
fillSelect("selAlignment", ALIGNMENTS);

const abDiv = document.getElementById("abilityInputs");
abDiv.innerHTML = ABILITIES.map(a=>`
  <div class="ab"><label>${a}</label>
  <input type="number" min="3" max="20" id="ab_${a}" placeholder="--"></div>`).join("");

// ---------- SKILL CHOICES ----------
function renderSkillChoices() {
  const box = document.getElementById("skillChoices");
  if (!state.cls) { box.innerHTML = '<span style="color:var(--muted)">Pick a class first.</span>'; return; }
  const c = CLASSES[state.cls];
  const bgSkills = state.background ? BACKGROUNDS[state.background].skills : [];
  box.innerHTML = `<div style="margin-bottom:.3rem;color:var(--muted)">Choose ${c.skillCount}:</div>` +
    c.skillList.map(s=>{
      const fromBg = bgSkills.includes(s);
      const checked = fromBg || state.skills.includes(s);
      return `<label style="display:inline-block;width:49%;font-weight:normal;${fromBg?'color:var(--muted)':''}">
        <input type="checkbox" value="${s}" ${checked?"checked":""} ${fromBg?"disabled title='Already granted by your background'":""}> ${s}${fromBg?" ✓bg":""}</label>`;
    }).join("");
  box.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      const c2 = CLASSES[state.cls];
      if (cb.checked) {
        state.skills.push(cb.value);
        if (state.skills.length > c2.skillCount) {
          const removed = state.skills.shift();
          const other = box.querySelector(`input[value="${removed}"]`);
          if (other) other.checked = false;
        }
      } else {
        state.skills = state.skills.filter(s=>s!==cb.value);
      }
      renderSheet();
    });
  });
}

function randomizeSkills() {
  if (!state.cls) return;
  const c = CLASSES[state.cls];
  const bgSkills = state.background ? BACKGROUNDS[state.background].skills : [];
  const pool = c.skillList.filter(s=>!bgSkills.includes(s));
  state.skills = [];
  while (state.skills.length < c.skillCount && pool.length) {
    const pick = rand(pool);
    pool.splice(pool.indexOf(pick),1);
    state.skills.push(pick);
  }
  renderSkillChoices();
}

// ---------- SPELL CHOICES ----------
// Spell counts and highest castable spell level (capped at 3, this tool's data range);
// pass a level to preview a different level
function spellCounts(atLevel) {
  const lvl = atLevel || state.level;
  const cant = CANTRIPS_KNOWN[state.cls] ? CANTRIPS_KNOWN[state.cls][lvl-1] : 0;
  const prep = PREPARED_SPELLS[state.cls] ? PREPARED_SPELLS[state.cls][lvl-1] : 0;
  const lvs = getSlotRows(lvl).map(r=>r.lv);
  const maxCast = Math.min(3, lvs.length ? Math.max(...lvs) : 1);
  return { cant, prep, maxCast };
}
// ---------- SHARED SPELL PICKER (level up and long rest) ----------
// Selections are staged on the pending object so Cancel discards them.
function pickerList(ctx) { return ctx === "lvl" ? pendingLvl.spells : pendingLR.spells; }

function spellPickerHtml(ctx, counts) {
  const list = pickerList(ctx);
  const lvlOf = n => SPELLS.find(s=>s.n===n)?.l ?? 1;
  const have0 = list.filter(n=>lvlOf(n)===0).length;
  const have1 = list.length - have0;
  const left0 = counts.cant - have0, left1 = counts.prep - have1;
  const pool = SPELLS.filter(s=>s.c.includes(state.cls) && s.l <= counts.maxCast && (s.l>0 || counts.cant>0));
  const todo = [left0>0?`${left0} cantrip${left0>1?"s":""}`:"", left1>0?`${left1} spell${left1>1?"s":""}`:""].filter(Boolean).join(" and ");
  let html = `<div style="font-size:.85rem;margin:.2rem 0 .35rem">
    ${counts.cant?`Cantrips <b>${have0}/${counts.cant}</b> · `:""}Spells <b>${have1}/${counts.prep}</b>
    ${todo?`<span style="color:var(--accent)">· choose ${todo}</span>`
          :`<span style="color:#4ade80">· ready</span>`}
    ${(left0<0||left1<0)?`<span style="color:var(--accent2)">· over the limit, uncheck some</span>`:""}
  </div><div class="picker-box">`;
  [0,1,2,3].forEach(lv=>{
    const g = pool.filter(s=>s.l===lv);
    if (!g.length) return;
    html += `<div class="spell-lvl-h">${lv===0?"Cantrips":"Level "+lv}</div>` + g.map(s=>{
      const on = list.includes(s.n);
      const full = lv===0 ? left0<=0 : left1<=0;
      return `<label class="spell-row${!on&&full?" dimmed":""}"><input type="checkbox" ${on?"checked":""} ${!on&&full?"disabled":""} onchange="pickerToggle('${ctx}','${escQ(s.n)}')"> ${s.n} <small style="color:var(--muted)">${allDice(s.d)}</small></label>`;
    }).join("");
  });
  return html + `</div>`;
}

function pickerToggle(ctx, name) {
  const arr = pickerList(ctx);
  const i = arr.indexOf(name);
  if (i >= 0) arr.splice(i,1); else arr.push(name);
  if (ctx === "lvl") renderLvlModal(); else longRest();
}

// Randomly add class spells until the given counts are met; returns the names added
function fillSpellsRandomly(cant, prep, maxCast) {
  const learned = [];
  const isCantrip = n => SPELLS.find(s=>s.n===n)?.l === 0;
  const pickInto = (pool, need) => {
    const p = pool.filter(s=>!state.spells.includes(s.n));
    while (need-- > 0 && p.length) {
      const s = p.splice(Math.floor(Math.random()*p.length), 1)[0];
      state.spells.push(s.n); learned.push(s.n);
    }
  };
  const have0 = state.spells.filter(isCantrip).length;
  pickInto(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l===0), cant - have0);
  pickInto(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l>=1&&s.l<=maxCast), prep - (state.spells.length - state.spells.filter(isCantrip).length));
  return learned;
}

function renderSpellChoices() {
  const sec = document.getElementById("spellSection");
  const box = document.getElementById("spellChoices");
  const caster = state.cls && CLASSES[state.cls].spellcaster;
  sec.style.display = caster ? "" : "none";
  if (!caster) return;
  const { cant, prep, maxCast } = spellCounts();
  const q = (document.getElementById("spellSearch").value||"").toLowerCase();
  const mine = SPELLS.filter(s=>s.c.includes(state.cls) && (!q || s.n.toLowerCase().includes(q) || s.d.toLowerCase().includes(q)));
  let html = `<div style="color:var(--muted);margin-bottom:.2rem">At level ${state.level}: ${cant?cant+" cantrips known, ":""}${prep} spells prepared, spell levels up to ${maxCast}. (Spells through level 3 are included here.)</div>`;
  [0,1,2,3].forEach(lv=>{
    const group = mine.filter(s=>s.l===lv);
    if (!group.length) return;
    html += `<div class="spell-lvl-h">${lv===0?"Cantrips":"Level "+lv}</div>` + group.map(s=>
      `<label class="spell-row" title="${s.d.replace(/"/g,'&quot;')}"><input type="checkbox" value="${s.n}" ${state.spells.includes(s.n)?"checked":""}> ${s.n} <small style="color:var(--muted)">${allDice(s.d)}</small></label>`).join("");
  });
  box.innerHTML = html;
  box.querySelectorAll("input[type=checkbox]").forEach(cb=>{
    cb.addEventListener("change", ()=>{
      if (cb.checked) state.spells.push(cb.value);
      else state.spells = state.spells.filter(s=>s!==cb.value);
      renderSheet();
    });
  });
}

function randomizeSpells() {
  state.spells = [];
  const caster = state.cls && CLASSES[state.cls].spellcaster;
  if (!caster) return;
  const { cant, prep, maxCast } = spellCounts();
  const pick = (pool,n)=>{ const p=[...pool]; const out=[]; while(out.length<n && p.length){ out.push(p.splice(Math.floor(Math.random()*p.length),1)[0].n); } return out; };
  state.spells = [
    ...pick(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l===0), cant),
    ...pick(SPELLS.filter(s=>s.c.includes(state.cls)&&s.l>=1&&s.l<=maxCast), prep)
  ];
  renderSpellChoices();
}
document.getElementById("btnRandSpells").addEventListener("click", ()=>{ randomizeSpells(); renderSheet(); });
document.getElementById("spellSearch").addEventListener("input", renderSpellChoices);

// ---------- PERSONALITY & NOTES ----------
const RP_FIELDS = { rpTraits:"traits", rpIdeals:"ideals", rpBonds:"bonds", rpFlaws:"flaws", rpNotes:"notes", playerName:"playerName", xpField:"xp" };
Object.entries(RP_FIELDS).forEach(([id,key])=>{
  document.getElementById(id).addEventListener("input", e=>{ state[key]=e.target.value; renderSheet(); });
});
document.querySelectorAll("button[data-rp]").forEach(b=>{
  b.addEventListener("click", ()=>{
    const key = b.dataset.rp;
    state[key] = rand(RP_TABLES[key]);
    document.getElementById("rp"+key[0].toUpperCase()+key.slice(1)).value = state[key];
    renderSheet();
  });
});

// ---------- RANDOMIZERS ----------
const randomizers = {
  name: () => { state.name = rand(NAMES.first)+" "+rand(NAMES.last); document.getElementById("charName").value = state.name; },
  class: () => { state.cls = rand(Object.keys(CLASSES)); document.getElementById("selClass").value = state.cls; randomizeSkills(); randomizeSpells(); },
  species: () => { state.species = rand(Object.keys(SPECIES)); document.getElementById("selSpecies").value = state.species; },
  background: () => { state.background = rand(Object.keys(BACKGROUNDS)); document.getElementById("selBackground").value = state.background; randomizeSkills(); },
  alignment: () => { state.alignment = rand(ALIGNMENTS); document.getElementById("selAlignment").value = state.alignment; }
};

document.querySelectorAll("button.dice").forEach(b=>{
  b.addEventListener("click", ()=>{ randomizers[b.dataset.rand](); renderSheet(); });
});

function setScores(vals) {
  ABILITIES.forEach((a,i)=>{
    state.scores[a] = vals[i];
    document.getElementById("ab_"+a).value = vals[i];
  });
}

document.getElementById("btnRoll4d6").addEventListener("click", ()=>{
  setScores(ABILITIES.map(()=>roll4d6()));
  renderSheet();
});
document.getElementById("btnStandard").addEventListener("click", ()=>{
  setScores([15,14,13,12,10,8]);
  renderSheet();
});
document.getElementById("btnOptimize").addEventListener("click", ()=>{
  const vals = ABILITIES.map(a=>state.scores[a]).filter(v=>v!=null);
  if (vals.length<6) { setScores([15,14,13,12,10,8]); }
  optimizeForClass();
  renderSheet();
});

function optimizeForClass() {
  if (!state.cls) return;
  const c = CLASSES[state.cls];
  const sorted = ABILITIES.map(a=>state.scores[a]).sort((x,y)=>y-x);
  const order = [...c.primary, ...ABILITIES.filter(a=>!c.primary.includes(a))];
  const newScores = {};
  order.forEach((a,i)=>newScores[a]=sorted[i]);
  setScores(ABILITIES.map(a=>newScores[a]));
}

ABILITIES.forEach(a=>{
  document.getElementById("ab_"+a).addEventListener("input", e=>{
    state.scores[a] = parseInt(e.target.value)||null;
    renderSheet();
  });
});

document.getElementById("charName").addEventListener("input", e=>{ state.name=e.target.value; renderSheet(); });
["selClass","selSpecies","selBackground","selAlignment"].forEach(id=>{
  document.getElementById(id).addEventListener("change", e=>{
    const key = {selClass:"cls",selSpecies:"species",selBackground:"background",selAlignment:"alignment"}[id];
    state[key] = e.target.value;
    if (id==="selClass") { state.skills=[]; state.spells=[]; state.level=1; state.dieRolls=[]; state.slotsUsed={}; state.hdUsed=0; renderSkillChoices(); renderSpellChoices(); }
    if (id==="selBackground") renderSkillChoices();
    renderSheet();
  });
});

document.getElementById("btnRandomAll").addEventListener("click", ()=>{
  state.level=1; state.dieRolls=[]; state.loadedId=null;
  state.tempHp=0; state.inspiration=false; state.deathS=0; state.deathF=0;
  state.slotsUsed={}; state.hdUsed=0; state.stable=false; state.retired=false;
  // Fresh heroes arrive fully rested: force HP to recompute from scratch
  state.maxHp=null; state.curHp=null;
  Object.values(randomizers).forEach(f=>f());
  setScores(ABILITIES.map(()=>roll4d6()));
  optimizeForClass();
  randomizeSkills();
  ["traits","ideals","bonds","flaws"].forEach(k=>{
    state[k] = rand(RP_TABLES[k]);
    document.getElementById("rp"+k[0].toUpperCase()+k.slice(1)).value = state[k];
  });
  renderSheet();
});

document.getElementById("btnClear").addEventListener("click", clearCreator);
function clearCreator() {
  state.name=""; state.cls=""; state.species=""; state.background=""; state.alignment="";
  state.level=1; state.dieRolls=[]; state.loadedId=null; state.maxHp=null; state.curHp=null;
  state.skills=[]; state.spells=[]; state.playerName=""; state.xp="";
  state.traits=""; state.ideals=""; state.bonds=""; state.flaws=""; state.notes="";
  state.tempHp=0; state.inspiration=false; state.deathS=0; state.deathF=0;
  state.slotsUsed={}; state.hdUsed=0; state.stable=false; state.retired=false;
  ABILITIES.forEach(a=>{ state.scores[a]=null; document.getElementById("ab_"+a).value=""; });
  document.getElementById("charName").value="";
  ["selClass","selSpecies","selBackground","selAlignment"].forEach(id=>document.getElementById(id).value="");
  ["rpTraits","rpIdeals","rpBonds","rpFlaws","rpNotes","playerName","xpField"].forEach(id=>document.getElementById(id).value="");
  renderSkillChoices(); renderSpellChoices(); renderSheet();
}

// ---------- SHEET RENDER ----------
function renderSheet() {
  const saveLabel = state.loadedId ? "💾 Update Character" : "💾 Save Character";
  ["btnSave","btnSaveTop"].forEach(id=>{ const b = document.getElementById(id); if (b) b.textContent = saveLabel; });
  try { localStorage.setItem("dnd-srd-current", JSON.stringify(state)); } catch(e) {}
  const el = document.getElementById(sheetTargetId);
  if (!el) return;
  const haveScores = ABILITIES.every(a=>state.scores[a]!=null);
  if (!state.cls && !state.species && !haveScores) {
    el.innerHTML = '<div class="empty">Choose options on the left (or hit <b>Randomize All</b>) to generate a character sheet.</div>';
    renderDownOverlay();
    return;
  }
  const c = state.cls ? CLASSES[state.cls] : null;
  const sp = state.species ? SPECIES[state.species] : null;
  const bg = state.background ? BACKGROUNDS[state.background] : null;
  const profBonus = 2 + Math.floor((state.level-1)/4);
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const dexMod = state.scores.DEX!=null ? mod(state.scores.DEX) : 0;
  const wisMod = state.scores.WIS!=null ? mod(state.scores.WIS) : 0;

  // Max HP: hit die at level 1 + rolled/average gains + CON per level (+1/level for Dwarf)
  let hp = c ? c.hitDie + state.dieRolls.reduce((a,b)=>a+b,0) + conMod*state.level : null;
  if (state.species==="Dwarf" && hp!=null) hp += state.level;
  if (hp!=null) hp = Math.max(1, hp);
  if (state.maxHp !== hp) {
    const delta = hp - (state.maxHp||0);
    state.curHp = state.maxHp==null || state.curHp==null ? hp : Math.max(0, Math.min(hp, state.curHp + Math.max(0,delta)));
    state.maxHp = hp;
  }

  let ac = 10 + dexMod;
  let acNote = "10 + Dex (unarmored)";
  if (c) {
    if (state.cls==="Barbarian") { ac = 10+dexMod+conMod; acNote="Unarmored Defense"; }
    else if (state.cls==="Monk") { ac = 10+dexMod+wisMod; acNote="Unarmored Defense"; }
    else if (["Fighter","Paladin"].includes(state.cls)) { ac = 16; acNote="Chain Mail"; if (state.cls==="Paladin"){ac=18;acNote="Chain Mail + Shield";} }
    else if (state.cls==="Cleric") { ac = 13+Math.min(dexMod,2)+2; acNote="Chain Shirt + Shield"; }
    else if (state.cls==="Druid") { ac = 11+dexMod+2; acNote="Leather + Shield"; }
    else if (state.cls==="Ranger") { ac = 12+dexMod; acNote="Studded Leather"; }
    else if (["Bard","Rogue","Warlock"].includes(state.cls)) { ac = 11+dexMod; acNote="Leather Armor"; }
  }

  const allSkillProfs = new Set(state.skills);
  if (bg) bg.skills.forEach(s=>allSkillProfs.add(s));

  const passivePerception = 10 + wisMod + (allSkillProfs.has("Perception")?profBonus:0);

  const saveRows = ABILITIES.map(a=>{
    const isProf = c && c.saves.includes(a);
    const m = state.scores[a]!=null ? mod(state.scores[a]) + (isProf?profBonus:0) : null;
    const roll = m!=null ? `class="rollable" onclick="rollD20('${ABILITY_NAMES[a]} Save',${m})" title="Click to roll"` : "";
    return `<li ${roll}>${isProf?'<span class="prof">●</span>':'○'} ${ABILITY_NAMES[a]} ${m!=null?fmtMod(m):"--"}</li>`;
  }).join("");

  const skillRows = ALL_SKILLS.map(s=>{
    const ab = SKILLS[s];
    const isProf = allSkillProfs.has(s);
    const m = state.scores[ab]!=null ? mod(state.scores[ab]) + (isProf?profBonus:0) : null;
    const roll = m!=null ? `class="rollable" onclick="rollD20('${s}',${m})" title="Click to roll"` : "";
    return `<li ${roll}>${isProf?'<span class="prof">●</span>':'○'} ${s} <small style="color:var(--muted)">(${ab})</small> ${m!=null?fmtMod(m):"--"}</li>`;
  }).join("");

  const equipment = [...(c?c.equipment:[]), ...(bg?bg.equipment:[])];
  const features = [...(c?c.features.map(f=>allDice(scaleFeature(state.cls,f,state.level))):[]), ...(bg?["Origin Feat: "+bg.feat]:[])];
  if (c && CLASS_LEVELS[state.cls]) {
    for (let lv=2; lv<=state.level; lv++) {
      (CLASS_LEVELS[state.cls][lv]||[]).forEach(f=>features.push(`<small style="color:var(--muted)">L${lv}</small> ${allDice(f)}`));
      if ((ASI_LEVELS[state.cls]||ASI_LEVELS.default).includes(lv)) features.push(`<small style="color:var(--muted)">L${lv}</small> Ability Score Improvement or Feat`);
    }
  }
  const traits = sp ? sp.traits.map(t=>allDice(t)) : [];
  const canLevel = c && haveScores && state.level < 20 && !state.retired;
  const canAct = c && haveScores && !state.retired;

  // Attacks from carried weapons
  const strMod = state.scores.STR!=null ? mod(state.scores.STR) : 0;
  const attacks = [];
  if (c) {
    const seen = new Set();
    [...c.equipment, ...(bg?bg.equipment:[])].forEach(item=>{
      Object.keys(WEAPONS).forEach(w=>{
        if (item.includes(w) && !seen.has(w)) {
          seen.add(w);
          const wd = WEAPONS[w];
          const abMod = wd.rng ? dexMod : wd.fin ? Math.max(strMod,dexMod) : strMod;
          const [die, type] = wd.dmg.split(" ");
          attacks.push({name:w, bonus:abMod+profBonus, dice:die, type, dmgMod:abMod,
            dmg:`${wd.dmg}${abMod?` ${abMod>0?"+":""}${abMod}`:""}`});
        }
      });
    });
    if (state.cls==="Monk") {
      const maMod = Math.max(strMod, dexMod);
      const maDie = SCALING.martialDie(state.level);
      attacks.push({name:"Unarmed Strike", bonus:maMod+profBonus, dice:`1d${maDie}`, type:"bludgeoning", dmgMod:maMod,
        dmg:`1d${maDie} bludgeoning${maMod?` ${maMod>0?"+":""}${maMod}`:""}`});
    } else {
      attacks.push({name:"Unarmed Strike", bonus:strMod+profBonus, dice:null, type:"bludgeoning", dmgMod:Math.max(1,1+strMod), dmg:`${Math.max(1,1+strMod)} bludgeoning`});
    }
  }

  // Spellcasting numbers
  const castAb = c && c.spellcaster;
  const castMod = castAb && state.scores[castAb]!=null ? mod(state.scores[castAb]) : 0;
  const chosenSpells = SPELLS.filter(s=>state.spells.includes(s.n));

  const attackRows = attacks.map(a=>
    `<li class="rollable" onclick="attackRoll('${escQ(a.name)}',${a.bonus},${a.dice?`'${a.dice}'`:"null"},'${a.type}',${a.dmgMod})" title="Click to attack">${a.name} <b>${fmtMod(a.bonus)}</b> <small style="color:var(--muted)">${allDice(a.dmg)}</small></li>`).join("");

  const slotRows = getSlotRows().filter(r=>r.total>0).map(r=>{
    const used = state.slotsUsed[r.lv]||0;
    const pips = Array.from({length:r.total},(_,i)=>{
      const filled = i < r.total-used;
      return `<span class="slot-pip${filled?" filled":""}" onclick="${filled?`spendSlot(${r.lv})`:`restoreSlot(${r.lv})`}" title="${filled?"Click to expend":"Click to restore"}"></span>`;
    }).join(" ");
    return `<li><b>${r.pact?`Pact Slots (Level ${r.lv})`:`Level ${r.lv} Slots`}:</b> ${pips}</li>`;
  }).join("");

  const spellBlock = castAb ? `
    <h3 class="section">Spellcasting (${ABILITY_NAMES[castAb]})</h3>
    <ul class="clean">
      <li>Spell Save DC <b>${8+profBonus+castMod}</b> · <span class="rollable" onclick="attackRoll('Spell Attack',${profBonus+castMod},null,'spell',0)" title="Click to roll" style="color:var(--accent)">Spell Attack ${fmtMod(profBonus+castMod)} 🎲</span></li>
      ${slotRows}
      ${[0,1,2,3].map(lv=>{
        const g = chosenSpells.filter(s=>s.l===lv);
        return g.length ? `<li><b>${lv===0?"Cantrips":"Level "+lv}:</b> ${g.map(s=>`<span onclick="spellDetail('${escQ(s.n)}')" title="${s.d.replace(/"/g,'&quot;')}" style="border-bottom:1px dotted var(--muted);cursor:pointer">${s.n}</span>`).join(", ")}</li>` : "";
      }).join("")}
      ${!chosenSpells.length ? '<li style="color:var(--muted)">No spells chosen yet: pick them in the Spells list on the left.</li>' : ""}
    </ul>` : "";

  const rp = [["Personality Traits",state.traits],["Ideals",state.ideals],["Bonds",state.bonds],["Flaws",state.flaws],["Backstory & Notes",state.notes]].filter(x=>x[1]);
  const rpBlock = rp.length ? `
    <h3 class="section">Personality</h3>
    <ul class="clean">${rp.map(([k,v])=>`<li><b>${k}:</b> ${v.replace(/</g,"&lt;")}</li>`).join("")}</ul>` : "";

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
      <h2>${state.name || "Unnamed Hero"}</h2>
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
        ${state.retired?`<button onclick="resurrectCurrent()" title="Powerful magic calls them back with 1 HP">✨ Resurrect</button>
        <span style="border:1px solid var(--accent2);color:var(--accent2);border-radius:6px;padding:.3rem .6rem;font-weight:bold" title="This hero has been laid to rest">🪦 Retired · Dead</span>`:""}
        ${canAct?`<button onclick="shortRest()" title="1+ hour: spend Hit Dice to heal">⛺ Short Rest</button>
        <button onclick="longRest()" title="8 hours: restore HP, spell slots, and half your Hit Dice">🌙 Long Rest</button>`:""}
        ${canLevel?`<button onclick="levelUp()" style="font-weight:bold" title="Advance to level ${state.level+1}">⬆ Level Up</button>`:""}
      </div>
    </div>
    <div class="tagline">Level ${state.level} ${state.species||"?"} ${state.cls||"?"} · ${state.background||"no background"} · ${state.alignment||"unaligned"}${state.playerName?` · played by ${state.playerName.replace(/</g,"&lt;")}`:""}${state.xp?` · ${state.xp.toString().replace(/</g,"&lt;")} XP`:""}</div>

    <div class="vitals">
      <div class="vital"><div class="v">${ac}</div><div class="k">ARMOR CLASS</div><div style="font-size:.65rem;color:var(--muted)">${acNote}</div></div>
      <div class="vital"><div class="v">${hp!=null?`${state.curHp} / ${hp}`:"--"}${state.tempHp?` <small style="color:#7bc98b">+${state.tempHp}</small>`:""}</div><div class="k">HIT POINTS${state.tempHp?" + TEMP":""}</div>
        ${hp!=null?`<div class="hp-tracker"><button class="hp-dmg" onclick="changeHp(-1)" title="Take damage">-1</button><button class="hp-dmg" onclick="changeHp(-5)">-5</button><button class="hp-heal" onclick="changeHp(1)" title="Heal">+1</button><button class="hp-heal" onclick="changeHp(5)">+5</button><button onclick="changeTempHp(1)" title="Add Temporary HP">+Temp</button>${state.tempHp?`<button onclick="changeTempHp(-1)" title="Remove Temporary HP">-Temp</button>`:""}</div>`:""}
        ${hp!=null && state.curHp===0 ? `<div class="death-saves">DEATH SAVES
          <span>✔ ${[1,2,3].map(i=>`<span class="pip" onclick="deathPip('S',${i})">${state.deathS>=i?"●":"○"}</span>`).join("")}</span>
          <span>✘ ${[1,2,3].map(i=>`<span class="pip" onclick="deathPip('F',${i})">${state.deathF>=i?"●":"○"}</span>`).join("")}</span>
          ${state.deathS>=3?"<b style='color:#7bc98b'>STABLE</b>":state.deathF>=3?"<b style='color:var(--accent2)'>DEAD</b>":""}
        </div>`:""}
      </div>
      <div class="vital rollable" onclick="rollD20('Initiative',${dexMod})" title="Click to roll initiative"><div class="v">${fmtMod(dexMod)}</div><div class="k">INITIATIVE 🎲</div></div>
      <div class="vital"><div class="v">${sp?sp.speed:30} ft</div><div class="k">SPEED</div></div>
      <div class="vital"><div class="v">+${profBonus}</div><div class="k">PROF. BONUS</div></div>
      <div class="vital"><div class="v">${c?`${state.level}× ${dieIcon(c.hitDie)}`:"--"}</div><div class="k">HIT DICE</div></div>
      <div class="vital"><div class="v">${passivePerception}</div><div class="k">PASSIVE PERC.</div></div>
      <div class="vital rollable" onclick="toggleInspiration()" title="Toggle Heroic Inspiration"><div class="v">${state.inspiration?"★":"☆"}</div><div class="k">INSPIRATION</div></div>
    </div>

    <div class="statgrid">
      ${ABILITIES.map(a=>{
        const s = state.scores[a];
        const roll = s!=null ? `class="stat rollable" onclick="rollD20('${ABILITY_NAMES[a]} Check',${mod(s)})" title="Click to roll"` : 'class="stat"';
        return `<div ${roll}><div class="nm">${a}</div><div class="mod">${s!=null?fmtMod(mod(s)):"--"}</div><div class="scr">${s!=null?s:"--"}</div></div>`;
      }).join("")}
    </div>

    <div class="twocol">
      <div>
        <h3 class="section">Saving Throws</h3>
        <ul class="clean">${saveRows}</ul>
        ${attacks.length?`<h3 class="section">Attacks</h3><ul class="clean">${attackRows}</ul>`:""}
        ${spellBlock}
        <h3 class="section">Skills</h3>
        <ul class="clean">${skillRows}</ul>
      </div>
      <div>
        <h3 class="section">Features &amp; Traits</h3>
        <ul class="clean">${features.map(f=>`<li class="rollable" onclick="refLookup('${escQ(refTermFrom(f))}')" title="Click for details">${f}</li>`).join("") || "<li>--</li>"}</ul>
        <h3 class="section">Species Traits${sp?` (${sp.size}, ${state.species})`:""}</h3>
        <ul class="clean">${traits.map(t=>`<li class="rollable" onclick="refLookup('${escQ(refTermFrom(t))}')" title="Click for details">${t}</li>`).join("") || "<li>--</li>"}</ul>
        <h3 class="section">Proficiencies</h3>
        <ul class="clean">
          <li><b>Armor:</b> ${c?c.armor:"--"}</li>
          <li><b>Weapons:</b> ${c?c.weapons:"--"}</li>
          <li><b>Tools:</b> ${bg?bg.tool:"--"}</li>
        </ul>
        <h3 class="section">Equipment</h3>
        <ul class="clean">${equipment.map(e=>`<li class="rollable" onclick="refLookup('${escQ(eqTermFrom(e))}')" title="Click for details">${e}</li>`).join("") || "<li>--</li>"}</ul>
      </div>
    </div>
    ${rpBlock}
    <h3 class="section" style="cursor:pointer;user-select:none" onclick="toggleRollLog()" title="Rolls, level-ups, edits, rests, and status changes">📜 History ${showRollLog?"▾":"▸"} <small style="color:var(--muted)">(${histLog.length})</small></h3>
    ${showRollLog ? `
      <ul class="clean">${histLog.length ? histLog.map(r=>
        `<li>${HIST_ICONS[r.type]||"·"} ${r.text}${r.who?` <small style="color:var(--muted)">· ${r.who}</small>`:""} <small style="color:var(--muted)">${r.at}</small></li>`).join("")
        : '<li style="color:var(--muted)">Nothing yet: rolls, level-ups, rests, edits, and dramatic events will be recorded here.</li>'}</ul>
      ${histLog.length?`<button onclick="clearRollLog()" style="margin-top:.4rem;font-size:.8rem">Clear history</button>`:""}` : ""}`;
  renderDownOverlay();
}

// ---------- TABS ----------
document.querySelectorAll(".tabs button").forEach(b=>{
  b.addEventListener("click", ()=>{
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".tabpage").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.getElementById("tab-"+b.dataset.tab).classList.add("active");
    if (b.dataset.tab==="saved") renderSavedList();
    if (b.dataset.tab==="create") {
      // Leaving a saved-character view: give the creator a fresh start
      const wasViewing = sheetTargetId === "savedSheet";
      sheetTargetId = "sheet";
      if (wasViewing) clearCreator(); else renderSheet();
    }
  });
});

// ---------- SAVE / LOAD (localStorage) ----------
const STORE_KEY = "dnd-srd-characters";
const loadStore = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch(e) { return []; } };
const saveStore = list => localStorage.setItem(STORE_KEY, JSON.stringify(list));

function updateSavedCount() {
  const n = loadStore().length;
  document.getElementById("savedCount").textContent = n ? `(${n})` : "";
}

// Human-readable field-by-field diff for the history log
function charDiff(o, n) {
  const d = [];
  const flat = {name:"Name", cls:"Class", species:"Species", background:"Background", alignment:"Alignment", level:"Level", playerName:"Player", xp:"XP"};
  Object.entries(flat).forEach(([k,label])=>{
    if ((o[k]??"") !== (n[k]??"")) d.push(`${label}: ${o[k]||"(blank)"} → ${n[k]||"(blank)"}`);
  });
  ABILITIES.forEach(a=>{
    if ((o.scores?.[a]??null) !== (n.scores?.[a]??null)) d.push(`${a}: ${o.scores?.[a]??"--"} → ${n.scores?.[a]??"--"}`);
  });
  const listDiff = (label, oa, na) => {
    const added = (na||[]).filter(x=>!(oa||[]).includes(x));
    const removed = (oa||[]).filter(x=>!(na||[]).includes(x));
    if (added.length) d.push(`${label} added: ${added.join(", ")}`);
    if (removed.length) d.push(`${label} removed: ${removed.join(", ")}`);
  };
  listDiff("Skills", o.skills, n.skills);
  listDiff("Spells", o.spells, n.spells);
  ["traits","ideals","bonds","flaws","notes"].forEach(k=>{
    if ((o[k]||"") !== (n[k]||"")) d.push(`${k[0].toUpperCase()+k.slice(1)} edited`);
  });
  return d;
}

function saveCharacter() {
  if (!state.cls || !state.species) { alert("Pick at least a class and species before saving."); return; }
  const list = loadStore();
  const snapshot = JSON.parse(JSON.stringify(state));
  snapshot.savedAt = new Date().toLocaleString();
  const existingIdx = state.loadedId ? list.findIndex(ch => ch.id === state.loadedId) : -1;
  if (existingIdx >= 0) {
    snapshot.id = state.loadedId;
    const diffs = charDiff(list[existingIdx], snapshot);
    if (diffs.length) logEvent("edit", `<b>Edited</b>: ${diffs.join("; ")}`);
    list[existingIdx] = snapshot;
  } else {
    snapshot.id = Date.now();
    list.push(snapshot);
  }
  saveStore(list);
  updateSavedCount();
  // Show the saved character on the Saved tab, leaving a fresh creator form
  const id = snapshot.id;
  clearCreator();
  document.querySelector('.tabs button[data-tab="saved"]').click();
  viewCharacter(id);
}
document.getElementById("btnSave").addEventListener("click", saveCharacter);
document.getElementById("btnSaveTop").addEventListener("click", saveCharacter);

function applyCharacter(ch) {
  state.name = ch.name; state.cls = ch.cls; state.species = ch.species;
  state.background = ch.background; state.alignment = ch.alignment;
  state.scores = {...ch.scores}; state.skills = [...(ch.skills||[])];
  state.spells = [...(ch.spells||[])];
  state.level = ch.level || 1; state.dieRolls = [...(ch.dieRolls||[])];
  state.maxHp = ch.maxHp ?? null; state.curHp = ch.curHp ?? ch.maxHp ?? null;
  state.loadedId = ch.id ?? null;
  state.playerName = ch.playerName||""; state.xp = ch.xp||"";
  state.traits = ch.traits||""; state.ideals = ch.ideals||""; state.bonds = ch.bonds||""; state.flaws = ch.flaws||""; state.notes = ch.notes||"";
  state.tempHp = ch.tempHp||0; state.inspiration = !!ch.inspiration;
  state.deathS = ch.deathS||0; state.deathF = ch.deathF||0;
  state.slotsUsed = {...(ch.slotsUsed||{})}; state.hdUsed = ch.hdUsed||0; state.stable = !!ch.stable;
  state.retired = !!ch.retired;
  document.getElementById("rpTraits").value = state.traits;
  document.getElementById("rpIdeals").value = state.ideals;
  document.getElementById("rpBonds").value = state.bonds;
  document.getElementById("rpFlaws").value = state.flaws;
  document.getElementById("rpNotes").value = state.notes;
  document.getElementById("playerName").value = state.playerName;
  document.getElementById("xpField").value = state.xp;
  renderSpellChoices();
  document.getElementById("charName").value = state.name || "";
  document.getElementById("selClass").value = state.cls || "";
  document.getElementById("selSpecies").value = state.species || "";
  document.getElementById("selBackground").value = state.background || "";
  document.getElementById("selAlignment").value = state.alignment || "";
  ABILITIES.forEach(a=>document.getElementById("ab_"+a).value = state.scores[a] ?? "");
  renderSkillChoices();
}

function loadCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch) return;
  sheetTargetId = "sheet";
  applyCharacter(ch);
  document.querySelector('.tabs button[data-tab="create"]').click();
}

function viewCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch) return;
  applyCharacter(ch);
  sheetTargetId = "savedSheet";
  document.getElementById("savedSheet").style.display = "block";
  renderSheet();
  document.getElementById("savedSheet").scrollIntoView({behavior:"smooth", block:"start"});
}

// One-click random hero from the Saved tab: randomize the creator, save, and show the result
function addRandomCharacter() {
  document.getElementById("btnRandomAll").click();
  saveCharacter();
}

// Resurrect the character currently shown on a sheet
function resurrectCurrent() {
  if (!state.retired) return;
  state.retired = false; state.curHp = 1; state.deathS = 0; state.deathF = 0; state.stable = false;
  logEvent("heal", `<b>${state.name || "Unnamed Hero"} resurrected</b>: called back from beyond the veil with 1 HP`);
  renderSheet(); persistLoaded(); renderSavedList();
}

function resurrectCharacter(id) {
  const list = loadStore();
  const ch = list.find(c=>c.id===id);
  if (!ch || !ch.retired) return;
  ch.retired = false; ch.curHp = 1; ch.deathS = 0; ch.deathF = 0; ch.stable = false;
  saveStore(list);
  logEvent("heal", `<b>${ch.name || "Unnamed Hero"} resurrected</b>: called back from beyond the veil with 1 HP`);
  if (state.loadedId === id) {
    state.retired = false; state.curHp = 1; state.deathS = 0; state.deathF = 0; state.stable = false;
    renderSheet();
  }
  renderSavedList();
}

function deleteCharacter(id) {
  const ch = loadStore().find(c=>c.id===id);
  if (!ch || !confirm(`Delete "${ch.name || "Unnamed Hero"}"? This cannot be undone.`)) return;
  saveStore(loadStore().filter(c=>c.id!==id));
  if (state.loadedId === id) state.loadedId = null;
  renderSavedList(); updateSavedCount();
  document.getElementById("savedSheet").innerHTML = "";
}

function renderSavedList() {
  const list = loadStore();
  const el = document.getElementById("savedList");
  if (!list.length) { el.innerHTML = '<div class="empty">No saved characters yet. Build one and hit Save.</div>'; return; }
  el.innerHTML = list.map(ch=>`
    <div class="saved-card">
      <div class="who"><b>${ch.name || "Unnamed Hero"}</b>${ch.retired?' <span title="Laid to rest">🪦</span>':""}<br>
        <small>Level ${ch.level||1} ${ch.species} ${ch.cls} · ${ch.background || "no background"}${ch.retired?" · <b>dead</b>":""} · saved ${ch.savedAt}</small></div>
      <div class="btns">
        <button onclick="viewCharacter(${ch.id})">View</button>
        <button onclick="loadCharacter(${ch.id})">Edit</button>
        <button class="btn-danger" onclick="deleteCharacter(${ch.id})">Delete</button>
      </div>
    </div>`).join("");
}

// Export / import for moving characters between browsers or machines
function exportCharacters() {
  const data = JSON.stringify(loadStore(), null, 2);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([data], {type:"application/json"}));
  a.download = "dnd-characters.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importCharacters(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error("not a list");
      const list = loadStore();
      const ids = new Set(list.map(c=>c.id));
      let added = 0;
      incoming.forEach(ch => {
        if (!ch || !ch.cls) return;
        if (ids.has(ch.id)) ch.id = Date.now() + Math.floor(Math.random()*1e6);
        ids.add(ch.id); list.push(ch); added++;
      });
      saveStore(list);
      renderSavedList(); updateSavedCount();
      alert(`Imported ${added} character(s).`);
    } catch(e) { alert("Could not read that file: it should be a dnd-characters.json export."); }
    input.value = "";
  };
  reader.readAsText(file);
}

const rulesInput = document.getElementById("rulesSearch");
function renderRules(q) {
  q = (q||"").trim().toLowerCase();
  const hits = !q ? RULES : RULES.filter(r =>
    r.t.toLowerCase().includes(q) || r.d.toLowerCase().includes(q) || r.c.toLowerCase().includes(q));
  const hi = txt => q ? txt.replace(new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi"), "<mark>$1</mark>") : txt;
  document.getElementById("rulesResults").innerHTML = hits.length
    ? hits.map(r=>`<div class="rule-card"><div class="cat">${r.c}</div><h4>${allDice(hi(r.t))}</h4><p>${allDice(hi(r.d))}</p></div>`).join("")
    : '<div class="empty">No rules matched. Try another term.</div>';
}
rulesInput.addEventListener("input", ()=>renderRules(rulesInput.value));
renderRules("");

// ---------- DICE ROLLING & HP ----------
let toastTimer = null;

// History: rolls, level-ups, edits, rests, and status events (most recent first)
let histLog = [];
try { histLog = JSON.parse(localStorage.getItem("dnd-srd-history")) || []; } catch(e) {}
let showRollLog = false;
const HIST_ICONS = { roll:"🎲", level:"⬆️", edit:"✏️", rest:"⛺", longrest:"🌙", status:"💀", heal:"❤️", cast:"✨" };
function logEvent(type, text) {
  histLog.unshift({type, text, who: state.name || "", at: new Date().toLocaleString()});
  if (histLog.length > 200) histLog.length = 200;
  try { localStorage.setItem("dnd-srd-history", JSON.stringify(histLog)); } catch(e) {}
  if (showRollLog) renderSheet();
}
function logRoll(what, dice, result) {
  logEvent("roll", `<b>${what}</b> · ${diceHtml(dice)} = <b style="color:var(--accent)">${result}</b>`);
}
function toggleRollLog() { showRollLog = !showRollLog; renderSheet(); }
function clearRollLog() {
  histLog = [];
  try { localStorage.setItem("dnd-srd-history", "[]"); } catch(e) {}
  renderSheet();
}

function rollD20(what, modifier) {
  const d = 1 + Math.floor(Math.random()*20);
  const total = d + modifier;
  logRoll(what, `d20 (${d}) ${modifier>=0?"+":"-"} ${Math.abs(modifier)}`, total);
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").textContent = what;
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = total;
  totalEl.className = "total" + (d===20?" crit":d===1?" fumble":"");
  toast.querySelector(".detail").innerHTML =
    allDice(`d20 (${d}) ${modifier>=0?"+":"-"} ${Math.abs(modifier)}`) + (d===20?" · NAT 20!":d===1?" · Nat 1":"");
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 3500);
}

function rollDie(sides) {
  const d = 1 + Math.floor(Math.random()*sides);
  logRoll("d"+sides, `d${sides} (${d})`, d);
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").innerHTML = dieIcon(sides);
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = d;
  totalEl.className = "total" + (sides===20 && d===20 ? " crit" : sides===20 && d===1 ? " fumble" : "");
  toast.querySelector(".detail").textContent = sides===20 && d===20 ? "NAT 20!" : sides===20 && d===1 ? "Nat 1" : "";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 3500);
}

function changeHp(delta) {
  if (state.maxHp==null) return;
  if (delta < 0 && state.tempHp > 0) {
    const absorbed = Math.min(state.tempHp, -delta);
    state.tempHp -= absorbed;
    delta += absorbed;
  }
  const before = state.curHp;
  state.curHp = Math.max(0, Math.min(state.maxHp, state.curHp + delta));
  if (before > 0 && state.curHp === 0) {
    state.stable = false;
    logEvent("status", `<b>Down!</b> Dropped to 0 HP`);
  }
  if (state.curHp > 0 && before === 0) {
    state.deathS = 0; state.deathF = 0; state.stable = false;
    logEvent("heal", `<b>Back on their feet</b> with ${state.curHp} HP`);
  }
  renderSheet();
  persistLoaded();
}

function changeTempHp(delta) {
  state.tempHp = Math.max(0, (state.tempHp||0) + delta);
  renderSheet();
  persistLoaded();
}

function toggleInspiration() {
  state.inspiration = !state.inspiration;
  renderSheet();
  persistLoaded();
}

function deathPip(kind, n) {
  const key = kind === "S" ? "deathS" : "deathF";
  state[key] = state[key] >= n ? n - 1 : n;
  renderSheet();
  persistLoaded();
}

// Silently write play-time changes (HP, level) back to the saved copy
function persistLoaded() {
  if (!state.loadedId) return;
  const list = loadStore();
  const i = list.findIndex(c=>c.id===state.loadedId);
  if (i < 0) return;
  const snap = JSON.parse(JSON.stringify(state));
  snap.id = state.loadedId;
  snap.savedAt = list[i].savedAt;
  list[i] = snap;
  saveStore(list);
}

// ---------- LEVEL UP (in-page, nothing applies until Confirm) ----------
let pendingLvl = null;

function levelUp() {
  if (!state.cls || state.level >= 20) return;
  const newLevel = state.level + 1;
  pendingLvl = {
    newLevel,
    rolledValue: null, hpMode: null,
    asi: {},
    hasAsi: (ASI_LEVELS[state.cls] || ASI_LEVELS.default).includes(newLevel),
    spellMode: CLASSES[state.cls].spellcaster ? "random" : null,
    spells: [...state.spells]
  };
  renderLvlModal();
  document.getElementById("lvlOverlay").classList.add("open");
}

function lvlHpGain() {
  if (!pendingLvl || !pendingLvl.hpMode) return null;
  return pendingLvl.hpMode==="roll" ? pendingLvl.rolledValue : CLASSES[state.cls].hitDie/2 + 1;
}

function renderLvlModal() {
  if (!pendingLvl) return;
  const c = CLASSES[state.cls];
  const avg = c.hitDie/2 + 1;
  const feats = CLASS_LEVELS[state.cls][pendingLvl.newLevel] || [];
  const asiTotal = Object.values(pendingLvl.asi).reduce((a,b)=>a+b,0);
  const gain = lvlHpGain();
  const ref = refLink;

  document.getElementById("lvlModal").innerHTML = `
    <h3>Level ${pendingLvl.newLevel}!</h3>
    <div style="color:var(--muted);font-style:italic">${state.name || "Your hero"} the ${ref(state.species)} ${ref(state.cls)} grows stronger. Nothing is applied until you confirm.</div>

    ${feats.length?`<div class="lvl-step"><div class="k">New Features</div>${feats.map(f=>`<div>· ${ref(f.split(" (")[0].replace(/^Subclass: /,""))}${f.includes(" (")?" ("+f.split(" (").slice(1).join(" ("):""}</div>`).join("")}</div>`:""}

    <div class="lvl-step">
      <div class="k">${ref("Hit Points")} · ${dieIcon(c.hitDie)} + CON</div>
      <span class="asi-chip ${pendingLvl.hpMode==="roll"?"picked":""}" onclick="lvlHp('roll')">${pendingLvl.rolledValue!=null?`${dieIcon(c.hitDie)} Rolled: ${pendingLvl.rolledValue}`:`Roll the ${dieIcon(c.hitDie)}`}</span>
      <span class="asi-chip ${pendingLvl.hpMode==="avg"?"picked":""}" onclick="lvlHp('avg')">Take average (${avg})</span>
      ${gain!=null?`<div style="margin-top:.4rem">Will gain <b>+${gain}</b> on the die, + CON modifier, when you confirm.</div>`:""}
    </div>

    ${pendingLvl.spellMode?(()=>{
      const now = spellCounts(state.level), nxt = spellCounts(pendingLvl.newLevel);
      const gains = [];
      if (nxt.cant > now.cant) gains.push(`${nxt.cant-now.cant} new cantrip${nxt.cant-now.cant>1?"s":""}`);
      if (nxt.prep > now.prep) gains.push(`${nxt.prep-now.prep} more prepared spell${nxt.prep-now.prep>1?"s":""}`);
      if (nxt.maxCast > now.maxCast) gains.push(`<b>level ${nxt.maxCast} spells unlocked!</b>`);
      return `<div class="lvl-step">
      <div class="k">${ref("Spell Slots","Spells")} · ${nxt.cant?nxt.cant+" cantrips, ":""}${nxt.prep} prepared at level ${pendingLvl.newLevel}</div>
      ${gains.length?`<div style="margin-bottom:.35rem">You gain ${gains.join(", ")}.</div>`:`<div style="margin-bottom:.35rem;color:var(--muted)">No new spell picks at this level.</div>`}
      <span class="asi-chip ${pendingLvl.spellMode==="random"?"picked":""}" onclick="lvlSpellMode('random')">🎲 Choose new spells for me</span>
      <span class="asi-chip ${pendingLvl.spellMode==="manual"?"picked":""}" onclick="lvlSpellMode('manual')">✍️ I'll pick them myself</span>
      ${pendingLvl.spellMode==="manual" ? spellPickerHtml("lvl", nxt) : ""}
      </div>`;
    })():""}

    ${pendingLvl.hasAsi?`<div class="lvl-step">
      <div class="k">${ref("Ability Score Improvement")} · ${2-asiTotal} point${2-asiTotal===1?"":"s"} left</div>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:.3rem">Tap an ability to add +1 (twice for +2). Tap again to remove. Leave unspent to take a feat instead and adjust manually later.</div>
      ${ABILITIES.map(a=>{
        const n = pendingLvl.asi[a]||0;
        const capped = (state.scores[a]||10) + n >= 20;
        return `<span class="asi-chip ${n?"picked":""}" onclick="lvlAsi('${a}')" title="${capped?"At the 20 cap":""}">${a} ${state.scores[a]||"--"}${n?` → ${state.scores[a]+n}`:""}</span>`;
      }).join("")}
    </div>`:""}

    <div class="lvl-actions">
      <button onclick="lvlCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="lvlConfirm()" ${gain==null?"disabled":""}>Confirm Level ${pendingLvl.newLevel}</button>
    </div>`;
}

function lvlHp(mode) {
  const c = CLASSES[state.cls];
  if (mode==="roll" && pendingLvl.rolledValue==null) {
    pendingLvl.rolledValue = 1 + Math.floor(Math.random()*c.hitDie);
    logRoll(`Level ${pendingLvl.newLevel} HP`, `d${c.hitDie} (${pendingLvl.rolledValue})`, pendingLvl.rolledValue);
  }
  pendingLvl.hpMode = mode;
  renderLvlModal();
}

function lvlSpellMode(m) { pendingLvl.spellMode = m; renderLvlModal(); }

function lvlAsi(ab) {
  const cur = pendingLvl.asi[ab]||0;
  const total = Object.values(pendingLvl.asi).reduce((a,b)=>a+b,0);
  // Each tap adds +1 while points and the 20 cap allow; one more tap clears it
  if (total < 2 && (state.scores[ab]||10) + cur < 20) pendingLvl.asi[ab] = cur + 1;
  else delete pendingLvl.asi[ab];
  renderLvlModal();
}

function lvlCancel() {
  pendingLvl = null;
  document.getElementById("lvlOverlay").classList.remove("open");
}

function lvlConfirm() {
  const gain = lvlHpGain();
  if (!pendingLvl || gain==null) return;
  state.level = pendingLvl.newLevel;
  state.dieRolls.push(gain);
  const asiText = Object.entries(pendingLvl.asi).map(([ab,n])=>`${ab} +${n}`).join(", ");
  Object.entries(pendingLvl.asi).forEach(([ab,n])=>{
    state.scores[ab] = Math.min(20, (state.scores[ab]||10) + n);
    document.getElementById("ab_"+ab).value = state.scores[ab];
  });
  const mode = pendingLvl.hpMode;
  const newFeats = (CLASS_LEVELS[state.cls][state.level]||[]).join(", ");
  // New spells at the new level: auto-pick or leave to the player
  let learned = [], manualSpells = false;
  if (pendingLvl.spellMode === "random") {
    const { cant, prep, maxCast } = spellCounts(state.level);
    learned = fillSpellsRandomly(cant, prep, maxCast);
    if (learned.length) renderSpellChoices();
  } else if (pendingLvl.spellMode === "manual") {
    learned = pendingLvl.spells.filter(n=>!state.spells.includes(n));
    const dropped = state.spells.filter(n=>!pendingLvl.spells.includes(n));
    state.spells = [...pendingLvl.spells];
    manualSpells = !learned.length && !dropped.length;
    if (dropped.length) learned.push(...dropped.map(n=>`(swapped out ${n})`));
    renderSpellChoices();
  }
  logEvent("level", `<b>Level ${state.level}</b> ${state.cls}: +${gain} HP die (${mode==="roll"?"rolled":"average"})${asiText?` · ASI: ${asiText}`:""}${newFeats?` · gained: ${newFeats}`:""}${learned.length?` · learned: ${learned.join(", ")}`:""}`);
  lvlCancel();
  renderSheet();
  persistLoaded();
  const toast = document.getElementById("rollToast");
  toast.querySelector(".what").textContent = `${state.name || "Hero"} reached...`;
  const totalEl = toast.querySelector(".total");
  totalEl.textContent = "Level " + state.level;
  totalEl.className = "total crit";
  toast.querySelector(".detail").textContent = `+${gain} HP${mode==="roll"?" (rolled)":""}${learned.length?` · learned ${learned.join(", ")}`:""}${manualSpells?" · pick your new spells in the Spells list":""}${newFeats?" · "+newFeats:""}`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>toast.classList.remove("show"), 6000);
}

// Close the modal from the backdrop or Escape (same as Cancel: nothing applied)
document.getElementById("lvlOverlay").addEventListener("click", e=>{ if (e.target.id==="lvlOverlay") lvlCancel(); });
document.addEventListener("keydown", e=>{ if (e.key==="Escape" && pendingLvl) lvlCancel(); });

// ---------- SPELL SLOTS ----------
function spendSlot(lv) {
  const row = getSlotRows().find(r=>r.lv===lv);
  if (!row) return;
  state.slotsUsed[lv] = Math.min(row.total, (state.slotsUsed[lv]||0) + 1);
  renderSheet(); persistLoaded();
}
function restoreSlot(lv) {
  state.slotsUsed[lv] = Math.max(0, (state.slotsUsed[lv]||0) - 1);
  renderSheet(); persistLoaded();
}

// ---------- RESTS ----------
let pendingRest = null;

function shortRest() {
  if (!state.cls || state.maxHp==null) return;
  pendingRest = { rolls: [] };
  renderRestModal();
  document.getElementById("restOverlay").classList.add("open");
}

function renderRestModal() {
  if (!pendingRest) return;
  const c = CLASSES[state.cls];
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const hdLeft = state.level - state.hdUsed - pendingRest.rolls.length;
  const healed = pendingRest.rolls.reduce((a,r)=>a+r.gain,0);
  const cap = state.maxHp - state.curHp;
  document.getElementById("restModal").innerHTML = `
    <h3>⛺ ${refLink("Short Rest")}</h3>
    <div style="color:var(--muted);font-style:italic">At least 1 hour of light activity. Spend ${refLink("Hit Point Dice")} to recover HP.</div>
    <div class="lvl-step">
      <div class="k">${refLink("Hit Point Dice")} · ${hdLeft} of ${state.level} d${c.hitDie} remaining</div>
      ${pendingRest.rolls.length ? pendingRest.rolls.map(r=>`<div>· ${dieIcon(c.hitDie)} (${r.roll}) ${conMod>=0?"+":"-"} ${Math.abs(conMod)} = <b>${r.gain}</b> HP</div>`).join("") : `<div style="color:var(--muted)">No dice spent yet.</div>`}
      ${hdLeft>0 ? `<button onclick="restRollHd()" style="margin-top:.4rem">🎲 Spend a Hit Die (${dieIcon(c.hitDie)} ${conMod>=0?"+":"-"} ${Math.abs(conMod)})</button>` : `<div style="color:var(--muted);margin-top:.3rem">No Hit Dice left.</div>`}
    </div>
    <div class="lvl-step"><div class="k">${refLink("Healing")}</div>
      Recover <b>${Math.min(healed,cap)}</b> HP (${state.curHp} → ${Math.min(state.maxHp, state.curHp+healed)} of ${state.maxHp})${state.cls==="Warlock"?` · ${refLink("Pact Magic","Pact spell slots")} refresh on a Short Rest.`:""}
    </div>
    <div style="font-size:.8rem;color:var(--muted);margin-top:.4rem">Combat or strenuous activity causes a ${refLink("Rest Interruption")}: no benefits.</div>
    <div class="lvl-actions">
      <button onclick="restInterrupted('Short Rest')" title="The rest was broken: no benefits">✋ Interrupted</button>
      <button onclick="restCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="restFinish()">Finish Rest</button>
    </div>`;
}

function restRollHd() {
  const c = CLASSES[state.cls];
  const conMod = state.scores.CON!=null ? mod(state.scores.CON) : 0;
  const roll = 1 + Math.floor(Math.random()*c.hitDie);
  const gain = Math.max(0, roll + conMod);
  logRoll("Hit Die", `d${c.hitDie} (${roll}) ${conMod>=0?"+":"-"} ${Math.abs(conMod)}`, gain);
  pendingRest.rolls.push({roll, gain});
  renderRestModal();
}

function restCancel() {
  pendingRest = null;
  pendingLR = null;
  document.getElementById("restOverlay").classList.remove("open");
}

function restInterrupted(kind) {
  logEvent("rest", `<b>${kind} interrupted</b>: no benefits gained`);
  restCancel();
}

function restFinish() {
  const spent = pendingRest.rolls.length;
  const healed = Math.min(pendingRest.rolls.reduce((a,r)=>a+r.gain,0), state.maxHp - state.curHp);
  state.curHp += healed;
  state.hdUsed += spent;
  let extra = "";
  if (state.cls==="Warlock") { state.slotsUsed = {}; extra = ", Pact slots restored"; }
  logEvent("rest", `<b>Short Rest</b>: spent ${spent} Hit ${spent===1?"Die":"Dice"}, healed ${healed} HP${extra}`);
  restCancel();
  renderSheet(); persistLoaded();
}

let pendingLR = null;

function longRest() {
  if (!state.cls || state.maxHp==null) return;
  if (!pendingLR) pendingLR = { spellMode: "keep", spells: [...state.spells] };
  const healed = state.maxHp - state.curHp;
  const regain = Math.max(1, Math.floor(state.level/2));
  const hdBack = Math.min(state.hdUsed, regain);
  const isCaster = getSlotRows().length > 0;
  document.getElementById("restModal").innerHTML = `
    <h3>🌙 ${refLink("Long Rest")}</h3>
    <div style="color:var(--muted);font-style:italic">At least 8 hours: sleep for at least 6 and only light activity for the rest. A night of true rest mends body and magic alike. Nothing is applied until the rest completes.</div>
    <div class="lvl-step">
      <div class="k">On completion</div>
      <div>· ${refLink("Hit Points")} restored to maximum${healed?` (<b>+${healed}</b>, back to ${state.maxHp})`:" (already full)"}${state.tempHp?`, Temporary HP fades`:""}</div>
      ${isCaster?`<div>· All ${refLink("Spell Slots")} refreshed</div>`:""}
      <div>· ${refLink("Hit Point Dice")}: regain half your total (min 1)${state.hdUsed?` · recovers <b>${hdBack}</b> of your ${state.hdUsed} spent`:" · none spent"}</div>
      ${(state.deathS||state.deathF)?`<div>· ${refLink("Death Saving Throws")} reset</div>`:""}
      <div style="font-size:.8rem;color:var(--muted);margin-top:.3rem">Only one Long Rest per 24 hours. An hour of combat or strenuous activity causes a ${refLink("Rest Interruption")}.</div>
    </div>
    ${PREPARED_CASTERS.includes(state.cls)?`<div class="lvl-step">
      <div class="k">Change Prepared ${refLink("Spell Slots","Spells")}</div>
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:.35rem">A ${state.cls} rebuilds their prepared list after a Long Rest.</div>
      <span class="asi-chip ${pendingLR.spellMode==="keep"?"picked":""}" onclick="lrSpellMode('keep')">Keep current spells</span>
      <span class="asi-chip ${pendingLR.spellMode==="random"?"picked":""}" onclick="lrSpellMode('random')">🎲 Prepare a random new set</span>
      <span class="asi-chip ${pendingLR.spellMode==="manual"?"picked":""}" onclick="lrSpellMode('manual')">✍️ Let me choose</span>
      ${pendingLR.spellMode==="manual" ? spellPickerHtml("lr", spellCounts()) : ""}
    </div>`:(CLASSES[state.cls].spellcaster?`<div class="lvl-step">
      <div class="k">Spells</div>
      <div style="font-size:.85rem;color:var(--muted)">A ${state.cls} knows their spells rather than preparing them: you can swap one only when you gain a level.</div>
    </div>`:"")}
    <div class="lvl-actions">
      <button onclick="restInterrupted('Long Rest')" title="The rest was broken: no benefits">✋ Interrupted</button>
      <button onclick="restCancel()">Cancel</button>
      <button class="lvl-confirm" onclick="longRestConfirm()">Long Rest Completed</button>
    </div>`;
  document.getElementById("restOverlay").classList.add("open");
}

function lrSpellMode(m) { pendingLR.spellMode = m; longRest(); }

function longRestConfirm() {
  const healed = state.maxHp - state.curHp;
  const regain = Math.max(1, Math.floor(state.level/2));
  const hdBack = Math.min(state.hdUsed, regain);
  state.curHp = state.maxHp; state.tempHp = 0;
  state.slotsUsed = {}; state.hdUsed = Math.max(0, state.hdUsed - regain);
  state.deathS = 0; state.deathF = 0; state.stable = false;
  let spellNote = "";
  if (pendingLR && pendingLR.spellMode === "random") {
    randomizeSpells();
    spellNote = `, prepared a new set of spells (${state.spells.join(", ")})`;
  } else if (pendingLR && pendingLR.spellMode === "manual") {
    const added = pendingLR.spells.filter(n=>!state.spells.includes(n));
    const removed = state.spells.filter(n=>!pendingLR.spells.includes(n));
    state.spells = [...pendingLR.spells];
    renderSpellChoices();
    spellNote = (added.length||removed.length)
      ? `, prepared ${added.join(", ")||"no new spells"}${removed.length?` (dropped ${removed.join(", ")})`:""}`
      : "";
  }
  logEvent("longrest", `<b>Long Rest</b>: HP fully restored${healed?` (+${healed})`:""}, spell slots refreshed${hdBack?`, recovered ${hdBack} Hit ${hdBack===1?"Die":"Dice"}`:""}${spellNote}`);
  pendingLR = null;
  restCancel();
  renderSheet(); persistLoaded();
}

// ---------- DYING / DEAD OVERLAY ----------
function retireCharacter() {
  state.retired = true;
  logEvent("status", `<b>Retired</b>: laid to rest at level ${state.level}. May their story be retold.`);
  if (state.loadedId) {
    persistLoaded();
  } else {
    // Never saved: save now so the fallen hero is kept
    const list = loadStore();
    const snapshot = JSON.parse(JSON.stringify(state));
    snapshot.id = Date.now();
    snapshot.savedAt = new Date().toLocaleString();
    state.loadedId = snapshot.id;
    list.push(snapshot);
    saveStore(list);
    updateSavedCount();
  }
  renderSheet();
}

function renderDownOverlay() {
  const el = document.getElementById("downOverlay");
  const show = state.cls && state.maxHp!=null && state.curHp===0 && !state.retired;
  el.classList.toggle("open", !!show);
  if (!show) return;
  const who = state.name || "Your hero";
  const dead = state.deathF >= 3;
  const stable = state.stable || state.deathS >= 3;
  const pips = k => [1,2,3].map(i=>state[k]>=i?"●":"○").join(" ");
  document.getElementById("downModal").innerHTML = dead ? `
    <div class="death-big">💀</div>
    <h3 style="text-align:center">${who} has died</h3>
    <p style="text-align:center;color:var(--muted)">Three ${refLink("Death Saving Throws")} failed. But in a world of magic, death is not always the end: spells like ${refLink("Revivify")} and ${refLink("Resurrection")} can call a soul back.</p>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="revive(1,'Revivify')">✨ Revivify (1 HP)</button>
      <button onclick="revive(state.maxHp,'Resurrection')">🌟 Resurrection (full HP)</button>
      <button onclick="retireCharacter()" title="Lay this hero to rest; the sheet is kept in a dead state">🪦 Retire Character</button>
    </div>`
  : stable ? `
    <div class="death-big">😮‍💨</div>
    <h3 style="text-align:center">${who} is ${refLink("Dying and Stabilization","Stable")}</h3>
    <p style="text-align:center;color:var(--muted)">Unconscious at 0 HP but no longer dying. They wake with 1 HP after 1d4 hours, or sooner with ${refLink("Healing")}.</p>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="revive(1,'Waking up')">⏰ Wake with 1 HP</button>
      <button onclick="changeHp(5)">❤️ Healed (+5 HP)</button>
    </div>`
  : `
    <div class="death-big">🩸</div>
    <h3 style="text-align:center">${who} is dying!</h3>
    <div class="down-pips">Successes ${pips("deathS")} · Failures ${pips("deathF")}</div>
    <p style="text-align:center;color:var(--muted);font-size:.9rem">At the start of each of your turns, make a ${refLink("Death Saving Throws","Death Saving Throw")}: 10+ succeeds. Three successes ${refLink("Dying and Stabilization","stabilize")} you; three failures and you die. A 20 brings you back with 1 HP; a 1 counts as two failures. ${refLink("Healing")} of any kind brings you back up.</p>
    <div class="lvl-actions">
      <button class="lvl-confirm" onclick="rollDeathSave()">🎲 Death Saving Throw</button>
    </div>
    <div class="lvl-actions" style="flex-wrap:wrap">
      <button onclick="changeHp(1)">❤️ Healed (+1)</button>
      <button onclick="changeHp(5)">❤️ (+5)</button>
      <button onclick="downStabilize()">🩹 Stabilized</button>
      <button onclick="downDamage(1)">💥 Hit (+1 ✘)</button>
      <button onclick="downDamage(2)">💥 Crit (+2 ✘)</button>
    </div>`;
}

function rollDeathSave() {
  const d = 1 + Math.floor(Math.random()*20);
  logRoll("Death Save", `d20 (${d})`, d);
  if (d === 20) { revive(1, "a natural 20 on the Death Save"); return; }
  if (d === 1) state.deathF = Math.min(3, state.deathF + 2);
  else if (d >= 10) state.deathS = Math.min(3, state.deathS + 1);
  else state.deathF = Math.min(3, state.deathF + 1);
  if (state.deathS >= 3) { state.stable = true; logEvent("status", `<b>Stabilized</b>: three Death Save successes`); }
  if (state.deathF >= 3) logEvent("status", `<b>Died</b>: three Death Save failures`);
  renderSheet(); persistLoaded();
}

function downStabilize() {
  state.stable = true;
  logEvent("status", `<b>Stabilized</b> (Medicine check or Spare the Dying)`);
  renderSheet(); persistLoaded();
}

function downDamage(n) {
  const wasDying = state.deathF < 3;
  state.deathF = Math.min(3, state.deathF + n);
  state.stable = false;
  if (wasDying && state.deathF >= 3) logEvent("status", `<b>Died</b>: struck down while dying`);
  renderSheet(); persistLoaded();
}

function revive(hp, how) {
  state.curHp = Math.min(state.maxHp, Math.max(1, hp));
  state.deathS = 0; state.deathF = 0; state.stable = false;
  logEvent("heal", `<b>Back from the brink</b>: ${how}, up with ${state.curHp} HP`);
  renderSheet(); persistLoaded();
}

// ---------- REFERENCE LOOKUP ----------
const escQ = s => s.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
// Clickable term that opens the reference overlay; optional label shows different text
function refLink(term, label) {
  return `<span class="ref-link" onclick="refLookup('${escQ(term)}')" title="What is this?">${label||term}</span>`;
}
function refLookup(term) {
  const q = term.toLowerCase();
  let hits = RULES.filter(r=>r.t.toLowerCase()===q);
  if (!hits.length) hits = RULES.filter(r=>r.t.toLowerCase().includes(q));
  // Plurals: "Handaxes" → "Handaxe", "Pouches" → "Pouch"
  if (!hits.length && /s$/i.test(q)) {
    const singular = q.replace(/e?s$/i,"");
    hits = RULES.filter(r=>r.t.toLowerCase()===singular || r.t.toLowerCase().startsWith(singular));
  }
  // Trim trailing words ("Sneak Attack 2d6" → "Sneak Attack") until a title matches
  if (!hits.length) {
    const words = term.split(" ");
    while (!hits.length && words.length > 1) {
      words.pop();
      const part = words.join(" ").replace(/[,;]$/,"").toLowerCase();
      hits = RULES.filter(r=>r.t.toLowerCase()===part || r.t.toLowerCase().startsWith(part));
    }
  }
  if (!hits.length) hits = RULES.filter(r=>r.d.toLowerCase().includes(q)).slice(0,3);
  document.getElementById("refModal").innerHTML = `
    <h3>${term}</h3>
    ${hits.length ? hits.map(r=>`<div class="rule-card"><div class="cat">${r.c}</div><h4>${allDice(r.t)}</h4><p>${allDice(r.d)}</p></div>`).join("")
      : `<div class="rule-card"><p>No reference entry found. Try the Reference tab's search.</p></div>`}
    <div class="lvl-actions"><button onclick="refClose()">Close</button></div>`;
  document.getElementById("refOverlay").classList.add("open");
}
function refClose() { document.getElementById("refOverlay").classList.remove("open"); }
document.addEventListener("click", e=>{ if (e.target.id==="refOverlay") refClose(); });

// ---------- ATTACK OVERLAY (attack roll + secondary damage roll) ----------
let atkState = null;

function attackRoll(name, bonus, dice, type, dmgMod) {
  const d = 1 + Math.floor(Math.random()*20);
  logRoll(`${name}`, `d20 (${d}) ${bonus>=0?"+":"-"} ${Math.abs(bonus)}`, d + bonus);
  atkState = { name, bonus, d20: d, total: d + bonus, dice, type, dmgMod, dmgResult: null, extra: [] };
  renderAtkModal();
  document.getElementById("atkOverlay").classList.add("open");
}

function renderAtkModal() {
  if (!atkState) return;
  const a = atkState;
  const crit = a.d20 === 20, fumble = a.d20 === 1;
  const extraSum = a.extra.reduce((s,r)=>s+r.v,0);
  const grand = (a.dmgResult!=null ? a.dmgResult : 0) + extraSum;
  document.getElementById("atkModal").innerHTML = `
    <h3>${a.name}</h3>
    <div class="lvl-step">
      <div class="k">Attack Roll · vs target's AC</div>
      <div style="font-size:1.6rem"><b style="${crit?"color:#7bc98b":fumble?"color:var(--accent2)":""}">${a.total}</b>
        <small style="color:var(--muted)">${allDice(`d20 (${a.d20}) ${a.bonus>=0?"+":"-"} ${Math.abs(a.bonus)}`)}</small></div>
      ${crit?'<b style="color:#7bc98b">NATURAL 20 · Critical Hit! Roll the damage dice twice.</b>':fumble?'<b style="color:var(--accent2)">Natural 1 · automatic miss.</b>':""}
    </div>
    <div class="lvl-step">
      <div class="k">Damage${a.type && a.type!=="spell"?` · ${a.type}`:""}</div>
      ${a.dice
        ? (a.dmgResult==null
          ? `<button onclick="atkDamage()">🎲 Roll damage (${crit?"2×":""}${allDice(a.dice)}${a.dmgMod?` ${a.dmgMod>0?"+":""}${a.dmgMod}`:""})</button>`
          : `<div style="font-size:1.4rem"><b>${a.dmgResult}</b> <small style="color:var(--muted)">${diceHtml(a.dmgDetail)}</small></div>`)
        : (a.type==="spell"
          ? `<div style="color:var(--muted);font-size:.85rem;margin-bottom:.3rem">Roll your spell's damage dice${crit?" twice (crit!)":""}:</div>`
          : `<div style="font-size:1.4rem"><b>${a.dmgMod}</b> <small style="color:var(--muted)">flat</small></div>`)}
      <div style="margin-top:.4rem">
        <span style="color:var(--muted);font-size:.8rem">Extra dice:</span>
        ${[4,6,8,10,12].map(s=>`<button class="minor" style="padding:.25rem .5rem;font-size:.8rem" onclick="atkExtra(${s})">+d${s}</button>`).join(" ")}
        ${a.extra.length?`<div style="margin-top:.3rem">${a.extra.map(r=>`${dieIcon(r.s)} (${r.v})`).join(" + ")} = <b>${extraSum}</b></div>`:""}
      </div>
      ${grand && (a.dmgResult!=null || a.extra.length) ? `<div style="margin-top:.4rem;border-top:1px solid var(--line);padding-top:.3rem">Total damage: <b style="font-size:1.2rem">${grand}</b></div>` : ""}
    </div>
    <div class="lvl-actions"><button onclick="atkClose()">Done</button></div>`;
}

function atkDamage() {
  const a = atkState;
  const [n, sides] = a.dice.split("d").map(Number);
  const count = a.d20===20 ? n*2 : n;
  const rolls = Array.from({length:count}, ()=>1+Math.floor(Math.random()*sides));
  a.dmgResult = Math.max(0, rolls.reduce((s,v)=>s+v,0) + a.dmgMod);
  a.dmgDetail = `${count}d${sides} (${rolls.join(", ")})${a.dmgMod?` ${a.dmgMod>0?"+":""}${a.dmgMod}`:""}${a.type?` ${a.type}`:""}`;
  logRoll(`${a.name} Damage`, a.dmgDetail, a.dmgResult);
  renderAtkModal();
}

function atkExtra(sides) {
  const v = 1 + Math.floor(Math.random()*sides);
  atkState.extra.push({s:sides, v});
  logRoll(`${atkState.name} extra d${sides}`, `d${sides} (${v})`, v);
  renderAtkModal();
}

function atkClose() {
  atkState = null;
  document.getElementById("atkOverlay").classList.remove("open");
}
document.addEventListener("click", e=>{ if (e.target.id==="atkOverlay") atkClose(); });

// ---------- SPELL DETAIL / CASTING OVERLAY ----------
function spellDetail(name) {
  const s = SPELLS.find(x=>x.n===name);
  if (!s) return;
  const rows = getSlotRows().filter(r=>r.total>0 && r.lv >= s.l).map(r=>{
    const left = r.total - (state.slotsUsed[r.lv]||0);
    return `<button onclick="castSpell('${escQ(s.n)}',${r.lv})" ${left<=0?"disabled style='opacity:.45'":""}>✨ Cast with Level ${r.lv} slot (${left} left)</button>`;
  }).join(" ");
  document.getElementById("spellModal").innerHTML = `
    <h3>${s.n}</h3>
    <div style="color:var(--muted);font-style:italic;margin-bottom:.5rem">${s.l===0?"Cantrip":"Level "+s.l} · ${s.c.join(", ")}</div>
    <div class="lvl-step">${allDice(s.d)}</div>
    <div class="lvl-step"><div class="k">Cast</div>
      ${s.l===0 ? `<button onclick="castSpell('${escQ(s.n)}',0)">✨ Cast cantrip (no slot)</button>` : (rows || '<span style="color:var(--muted)">No spell slots of this level.</span>')}
    </div>
    <div class="lvl-actions"><button onclick="spellClose()">Close</button></div>`;
  document.getElementById("spellOverlay").classList.add("open");
}

function castSpell(name, lv) {
  if (lv > 0) {
    const row = getSlotRows().find(r=>r.lv===lv);
    const left = row ? row.total - (state.slotsUsed[lv]||0) : 0;
    if (left <= 0) return;
    state.slotsUsed[lv] = (state.slotsUsed[lv]||0) + 1;
  }
  logEvent("cast", `Cast <b>${name}</b>${lv?` using a Level ${lv} slot`:" (cantrip)"}`);
  spellClose();
  renderSheet(); persistLoaded();
}

function spellClose() { document.getElementById("spellOverlay").classList.remove("open"); }
document.addEventListener("click", e=>{ if (e.target.id==="spellOverlay") spellClose(); });

// ---------- THEME ----------
const THEME_KEY = "dnd-srd-theme";
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
  const on = 'background:var(--accent);color:#fff;border-color:var(--accent);font-weight:bold';
  document.getElementById("btnThemeDark").style.cssText = "flex:1;" + (theme==="dark" ? on : "");
  document.getElementById("btnThemeLight").style.cssText = "flex:1;" + (theme==="light" ? on : "");
}
document.getElementById("btnThemeDark").addEventListener("click", ()=>applyTheme("dark"));
document.getElementById("btnThemeLight").addEventListener("click", ()=>applyTheme("light"));
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

// Restore the in-progress character from the last visit
try {
  const cur = JSON.parse(localStorage.getItem("dnd-srd-current"));
  if (cur && (cur.cls || cur.species || cur.name)) applyCharacter(cur);
} catch(e) {}

updateSavedCount();
renderSkillChoices();
renderSpellChoices();
renderSheet();

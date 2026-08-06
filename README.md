# 🎲 Auto Character Generator

**▶️ Play it now: [auto-character-generator.github.io](https://auto-character-generator.github.io/)**

A complete D&D character builder, live character sheet, and rules companion for **levels 1–20**, built on the System Reference Document 5.2 (D&D 2024 rules). Plain HTML, CSS, and vanilla JavaScript: no server, no account, no build step. Your characters live in your browser.

---

## ⚔️ Build a Hero

- 🎲 **Randomize everything** with one click (always fully rested), roll individual choices with per-field dice buttons, or pick it all by hand — or use **Add Random Character** on the Characters tab for an instant saved hero
- 🛡️ All **12 classes**, **9 species**, and **4 backgrounds** from the SRD
- 💪 Ability scores via 4d6-drop-lowest, standard array, or one-click **optimize for class**
- ✨ Full **spell picker** for casters: 227 SRD spells from cantrips through level 9, with class-filtered lists, level-scaled known/prepared counts, and random selection
- 📜 Personality traits, ideals, bonds, and flaws, hand-written or rolled from tables, plus freeform backstory notes

## 🗡️ Play at the Table

The sheet is a live play surface, not a printout:

- **Click anything to roll it**: abilities, saves, skills, initiative, weapon attacks, spell attacks — results show the matching die icon in the toast and history
- ⬆⬇ **Advantage and disadvantage** toggle that applies to every d20 test, showing both dice with the discarded one struck through
- 🔆 **Class resources** tracked as spendable pips — Rage, Channel Divinity, Second Wind, Action Surge, Bardic Inspiration, Focus and Sorcery Points, Lay On Hands — refilled by the right rest
- 🌀 **Concentration**: casting a concentration spell flags it, and taking damage prompts the CON save at the correct DC, breaking it on a failure
- ⚔️ Attack overlay rolls to-hit and damage (crits double your dice automatically), with extra-dice buttons for Sneak Attack and friends
- ✨ **Cast spells** from the sheet: click a spell for details, cast options, and roll buttons — spell attacks, save-based damage, and healing all roll for you; slots are tracked as clickable pips (full, half, and pact casters all supported)
- 🎒 **Add equipment** as you loot it, from the SRD list or typed in freehand; weapons flow straight into your Attacks
- 📝 A **Notes** box on the sheet that saves as you type
- ❤️ Hit point, temp HP, and Heroic Inspiration tracking
- ⛺🌙 **Short and Long Rest overlays** that spend hit dice, restore HP and spell slots, and handle interruptions — nothing applies until you confirm, and casters can swap their prepared spells overnight (random or hand-picked)
- ⬆️ **Level up to 20** through an in-page flow: per-class features that scale correctly (Rage, Sneak Attack, Martial Arts, spell counts...), rolled or average HP, tap-to-assign ability score improvements, new spells rolled for you or picked yourself, cancel anytime
- 💀 At 0 HP the sheet locks into a **dying overlay**: automated death saves, stabilization, resurrection, or an honorable 🪦 retirement — and dead heroes can be ✨ resurrected later from their sheet
- 📖 **History log** of every roll, rest, cast, level-up, edit, and near-death experience

## 📚 Look Anything Up

- 🔍 A **Reference** tab with 400+ searchable entries: every spell, weapon, and piece of gear, all class features and species traits, plus conditions, combat actions, spellcasting, and rests
- ℹ️ Nearly everything is clickable: sheet features, species traits, equipment, the level-up and rest overlays, and the Basics page all open in-place reference definitions
- 🧭 A beginner-friendly **Basics** tab (the whole game on one page, with clickable dice-shaped icons)

## 💾 Your Characters, Kept

- Characters save to browser localStorage and survive restarts and reboots
- View, edit, and update saved characters; play-time changes (HP, slots, levels) persist automatically
- ⬇️⬆️ **Export / Import** as JSON to move your party between browsers or machines
- 🌙 Modern dark mode by default, ☀️ parchment light mode in settings
- 📱 Sidebar navigation on desktop and tablet, app-style bottom bar on phones

## 🚀 Run It

Visit **[auto-character-generator.github.io](https://auto-character-generator.github.io/)**, or clone and open `index.html` in any browser. Structure: `index.html` (markup), `css/style.css` (both themes), `js/data.js` (all SRD content), `js/app.js` (app logic). No dependencies; works offline once loaded.

## 📄 License

Uses content from the SRD 5.2 by Wizards of the Coast LLC, licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode). Not affiliated with or endorsed by Wizards of the Coast.

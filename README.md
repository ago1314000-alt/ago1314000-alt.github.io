# 🎲 Auto Character Generator

**▶️ Play it now: [auto-character-generator.github.io](https://auto-character-generator.github.io/)**

A complete D&D character builder, live character sheet, and rules companion for **levels 1-20**, built on the System Reference Document 5.2 (D&D 2024 rules). Plain HTML, CSS, and vanilla JavaScript: no server, no account, no build step. Your characters live in your browser.

---

## ⚔️ Build a Hero

- 🎲 **Randomize everything** with one click (always fully rested), roll individual choices with per-field dice buttons, or pick it all by hand. There is also **Add Random Character** on the Characters tab for an instant saved hero
- 🛡️ All **12 classes**, **9 species**, **12 subclasses**, and **4 backgrounds** from the SRD, plus an **Other** subclass option for anything your table plays that the SRD cannot publish
- 💪 Ability scores via 4d6-drop-lowest, standard array, or one-click **optimize for class**
- ✨ Full **spell picker** for casters: 227 SRD spells from cantrips through level 9, with class-filtered lists, level-scaled known/prepared counts, and random selection
- 📜 Personality traits, ideals, bonds, and flaws, hand-written or rolled from tables, plus freeform backstory notes

## 🗡️ Play at the Table

The sheet is a live play surface, not a printout:

- **Click anything to roll it**: abilities, saves, skills, initiative, weapon attacks, spell attacks. Results show the matching die icon in the toast and history
- ⬆⬇ **Advantage and disadvantage** toggle that applies to every d20 test, showing both dice with the discarded one struck through
- 🤢 **Conditions that actually do something**: tap a condition and the sheet applies it: Poisoned rolls your attacks and checks at disadvantage, Restrained drops your Speed to 0, Paralyzed flags the saves that auto-fail, and anything incapacitating breaks your concentration. Manual advantage and a condition's disadvantage cancel, exactly as the rules say
- ↶ **Undo** for any misclick, 25 steps deep: HP, spell slots, class resources, death saves, conditions, coins, attunement, gear, XP, rests, and whole level-ups (subclass, feat, ability points, and new spells all roll back together)
- 💥 **Type any amount** to take or heal, instead of clicking −5 four times
- ❤️‍🩹 **Bloodied** highlighting at half hit points, and buttons that grey out when there's nothing to spend, so no hit dice at full HP, no casting without a slot, no spending a resource you're out of
- 🔆 **Class resources** tracked as spendable pips (Rage, Channel Divinity, Second Wind, Action Surge, Bardic Inspiration, Focus and Sorcery Points, Lay On Hands), refilled by the right rest
- 🌀 **Concentration**: casting a concentration spell flags it, and taking damage prompts the CON save at the correct DC, breaking it on a failure
- ⚔️ Attack overlay rolls to-hit and damage (crits double your dice automatically), with extra-dice buttons for Sneak Attack and friends
- ✨ **Cast spells** from the sheet: click a spell for its casting time, range, components and duration, a link to the full SRD text, cast options, and roll buttons. Spell attacks, save-based damage, and healing all roll for you; slots are tracked as clickable pips (full, half, and pact casters all supported)
- 🎒 **Add equipment** as you loot it, from the SRD list, the **44 magic items**, or typed in freehand; weapons flow straight into your Attacks, duplicates stack with a count, and items requiring **Attunement** get a toggle that enforces the limit of three
- 💰 A **purse** seeded from your starting gear, in all five coin types, with a running gold total
- ✳️ **XP against the level table**: a progress bar, the amount still owed, and a nudge when you've earned the next level. Ignore it entirely if your table runs on milestones
- 📝 A **Notes** box on the sheet that saves as you type
- ❤️ Hit point, temp HP, and Heroic Inspiration tracking
- ⛺🌙 **Short and Long Rest overlays** that spend hit dice, restore HP and spell slots, and handle interruptions. Nothing applies until you confirm, and casters can swap their prepared spells overnight (random or hand-picked)
- ⬆️ **Level up to 20** through an in-page flow: per-class features that scale correctly (Rage, Sneak Attack, Martial Arts, spell counts...), rolled or average HP, your **subclass** chosen at level 3 (an SRD one, or your own named subclass with features you enter by level) with its features arriving on schedule, ability score improvements **or one of 73 feats**, new spells rolled for you or picked yourself, cancel anytime
- 💀 At 0 HP the sheet locks into a **dying overlay**: automated death saves, stabilization, resurrection, or an honorable 🪦 retirement. Dead heroes can be ✨ resurrected later from their sheet
- 📖 **History log** of every roll, rest, cast, level-up, edit, and near-death experience

## 📚 Look Anything Up

- 🔍 A **Reference** tab with 740+ searchable entries: every spell, weapon, and piece of gear, all class features, subclasses, feats, magic items, and species traits, plus conditions, combat actions, spellcasting, and rests
- 🏷️ **Category chips** with live counts filter the list, and combine with the search box
- ℹ️ Nearly everything is clickable: sheet features, species traits, equipment, the level-up and rest overlays, and the Basics page all open in-place reference definitions
- 🧭 A beginner-friendly **Basics** tab (the whole game on one page, with clickable dice-shaped icons)

## 💾 Your Characters, Kept

- Characters save to browser localStorage and survive restarts and reboots
- View, edit, and update saved characters; play-time changes (HP, slots, levels) persist automatically
- ⧉ **Duplicate** a hero before a risky level-up, and 🔗 **share** one as a link that carries the whole character in the URL itself, so nothing is uploaded anywhere
- ⬇️⬆️ **Export / Import** as JSON to move your party between browsers or machines
- 🌙 Modern dark mode by default, ☀️ parchment light mode in settings
- 📱 Sidebar navigation on desktop and tablet, app-style bottom bar on phones, and a pinned HP/AC/advantage strip that follows you down the sheet

## 🚀 Run It

Visit **[auto-character-generator.github.io](https://auto-character-generator.github.io/)**, or clone and open `index.html` in any browser. Structure: `index.html` (markup), `css/style.css` (both themes), `js/data.js` (all SRD content), `js/app.js` (app logic). No dependencies; works offline once loaded.

## 📄 License

Uses content from the SRD 5.2 by Wizards of the Coast LLC, licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode). Not affiliated with or endorsed by Wizards of the Coast.

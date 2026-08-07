# D&D Character Generator - project instructions

## Keep README.md current
Whenever features are added, changed, or removed, update README.md in the
same commit so it accurately describes the tool. Check especially the
feature bullets, the file-structure note in "Run It", and any counts
(reference entries, spell coverage, level range).

## Deploys
- The site is GitHub Pages from this repo (auto-character-generator.github.io).
- Publishing = commit and push to main. Nothing else to do.
- Bump the `?v=N` query on the css/js links in index.html on every deploy
  that changes those files (cache busting). Use safe UTF-8 file handling
  when editing index.html from scripts (emoji corruption risk with
  PowerShell Get-Content/Set-Content; use [IO.File] with UTF8 no-BOM).

## Conventions
- Plain HTML/CSS/vanilla JS only; no frameworks, no build step for the app
  itself (the data generators under tools/ are run by hand, not at deploy).
- SRD 5.2 (D&D 2024 rules) is the primary content source. EN Publishing's
  Level Up: Advanced 5th Edition content comes from the Open5e API.
- Hand-written SRD data lives in js/data.js; logic in js/app.js; styles for
  both themes in css/style.css.
- New interactive elements should work in both themes and both layouts
  (desktop sidebar and mobile bottom bar), and important terms should be
  clickable via refLookup()/refLink() with entries in RULES.

## Generated data files (do not hand-edit)
- `js/open5e.js` (A5E spells, feats, backgrounds, conditions, and the playable
  Marshal) and `js/bestiary.js` (Monstrous Menagerie creatures) are generated.
- To refresh: `node tools/fetch-open5e.js` then `node tools/build-open5e.js`.
  The fetch caches raw JSON under `tools/raw/o5e/`; delete a file to re-pull it.
- `js/open5e.js` loads with data.js before app.js. `js/bestiary.js` is ~1 MB and
  is injected in the background the first time the Reference tab is opened; it
  calls `onBestiaryLoaded()`, which appends the creatures to RULES as a
  "Creature" type and re-renders.
- Known bad upstream fields for a5e-mm, deliberately not shown: `alignment`
  (reads "chaotic evil" for all 586 creatures) and `environments` (always
  empty). Re-check these if the data is refreshed.

## Licensing (important)
- Keep every attribution in the Settings tab, README.md, and the page footer
  intact and accurate. Sources are not all under the same licence.
- SRD 5.2 and the A5E Adventurer's Guide / Dungeon Delver's Guide / Gate Pass
  Gazette are CC-BY-4.0.
- Monstrous Menagerie (the creatures) is **OGL 1.0a only**. `OGL.txt` carries the
  full licence and its Section 15 notice, and must stay in the repo and stay
  linked from Settings. If creature content is ever removed, that notice can
  go with it; if content from another OGL source is added, add it to Section 15.

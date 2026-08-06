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
- Plain HTML/CSS/vanilla JS only; no frameworks, no build step.
- SRD 5.2 (D&D 2024 rules) is the content source; keep the CC-BY-4.0
  attribution intact in README.md and the page footer.
- All game data lives in js/data.js; logic in js/app.js; styles for both
  themes in css/style.css.
- New interactive elements should work in both themes and both layouts
  (desktop sidebar and mobile bottom bar), and important terms should be
  clickable via refLookup()/refLink() with entries in RULES.

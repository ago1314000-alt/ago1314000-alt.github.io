# Data generators

These are run by hand, not during a deploy. The app itself has no build step.

```bash
node tools/fetch-open5e.js    # pull raw JSON from the Open5e API into tools/raw/o5e/
node tools/build-open5e.js    # compact it into js/open5e.js and js/bestiary.js
```

The fetch caches: delete a file under `tools/raw/o5e/` to re-pull just that one.

Sources pulled, all from EN Publishing via <https://open5e.com>:

| Source | Key | What we take | Licence |
| --- | --- | --- | --- |
| Adventurer's Guide | `a5e-ag` | 371 spells, 59 feats, 21 backgrounds, 6 conditions, the Marshal class and its 3 archetypes | CC BY 4.0 / OGL 1.0a |
| Dungeon Delver's Guide | `a5e-ddg` | 4 backgrounds | CC BY 4.0 / OGL 1.0a |
| Gate Pass Gazette | `a5e-gpg` | 2 backgrounds | CC BY 4.0 / OGL 1.0a |
| Monstrous Menagerie | `a5e-mm` | 586 creatures | OGL 1.0a only |

Notes on the upstream data:

- A5E spells carry no class associations (1 of 371 has any), so they are a
  reference library rather than picks for the spell sheet.
- `alignment` is `chaotic evil` for all 586 creatures and `environments` is
  always empty, so neither is stored. Re-check on a refresh.
- A5E armour has no Open5e entry, so the Marshal's hauberk and light shield are
  carried as their nearest SRD equivalents (chain shirt, shield) to keep armour
  class, attacks, and reference lookups working.

Because Monstrous Menagerie is OGL-only, `OGL.txt` at the repo root carries the
licence and its Section 15 notice. Keep it in step with what is shipped.

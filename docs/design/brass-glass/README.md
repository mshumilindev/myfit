# Spotter — Brass Glass redesign

Full redesign of every screen, state, drawer and role of Spotter in the **brass glass** style (from Music V2).
758 boards across 17 pages. Built with a shared Python kit, so every board uses the same components.

## Live canvases (Claude Design)

| Page | Area              | Boards | Canvas                                                        |
| ---- | ----------------- | ------ | ------------------------------------------------------------- |
| P00  | Foundations (kit) | 7      | [canvas 1](https://claude.ai/artifact/VaC5Zcs8WMPESB62XruLZh) |
| P01  | Today             | 47     | [canvas 1](https://claude.ai/artifact/VaC5Zcs8WMPESB62XruLZh) |
| P02  | Widgets           | 15     | [canvas 1](https://claude.ai/artifact/VaC5Zcs8WMPESB62XruLZh) |
| P03  | Start workout     | 56     | [canvas 1](https://claude.ai/artifact/VaC5Zcs8WMPESB62XruLZh) |
| P04  | Session           | 80     | [canvas 2](https://claude.ai/artifact/FmkZi76U1vBSeM6YvZk58o) |
| P05  | Summary           | 13     | [canvas 2](https://claude.ai/artifact/FmkZi76U1vBSeM6YvZk58o) |
| P06  | History           | 23     | [canvas 2](https://claude.ai/artifact/FmkZi76U1vBSeM6YvZk58o) |
| P07  | Progress          | 37     | [canvas 3](https://claude.ai/artifact/JzobQyBmgJwUxq5QPoTDGS) |
| P08  | Plan              | 64     | [canvas 3](https://claude.ai/artifact/JzobQyBmgJwUxq5QPoTDGS) |
| P09  | Exercises         | 58     | [canvas 4](https://claude.ai/artifact/MVKBaL1Xp4waX2U9hKh8KG) |
| P10  | Health            | 92     | [canvas 4](https://claude.ai/artifact/MVKBaL1Xp4waX2U9hKh8KG) |
| P11  | Gyms              | 33     | [canvas 5](https://claude.ai/artifact/5YM7e7Bp46rv3RJ6GHhXBm) |
| P12  | Atlas             | 40     | [canvas 5](https://claude.ai/artifact/5YM7e7Bp46rv3RJ6GHhXBm) |
| P13  | Apex              | 35     | [canvas 5](https://claude.ai/artifact/5YM7e7Bp46rv3RJ6GHhXBm) |
| P14  | Me / Settings     | 58     | [canvas 5](https://claude.ai/artifact/5YM7e7Bp46rv3RJ6GHhXBm) |
| P15  | Auth & onboarding | 31     | [canvas 6](https://claude.ai/artifact/6r3fPtTcV7SKhAFjNRrmDi) |
| P16  | Trainer / roles   | 69     | [canvas 6](https://claude.ai/artifact/6r3fPtTcV7SKhAFjNRrmDi) |

Music V2 reference: https://claude.ai/artifact/FBbRifvxyDihKjD2HcFsCf

## Folder layout

- `boards/` — each board as a standalone `.dc.html` file; images are in `boards/assets/` (relative paths, so they open offline).
- `previews/` — a `.webp` render of every board. This is the fastest way to browse.
- `INDEX.md` — every board grouped by page, with links to the board and its preview.
- `src/` — the source used to generate the boards:
  - `kit.py` — the component kit (tokens, shell, tabbar, livehero, setentry, barbell, bodymap, gauge, timerange/timein, sleephero, nightify/reskin);
  - `pNN_*.py` — one generator per page;
  - `KIT_RULES.md` — the rules: fidelity, production-ready, hierarchy, roles, night mode, skins;
  - `fidelity/PNN.md` — maps each board to its source in the app code;
  - `ASSETS.txt`, `bodymuscles.json`, `musclemap.json` — image list and muscle map data;
  - `assemble.py`, `shot.py` — canvas assembly and screenshots.
- `canvases/partN/` — the published `canvas.json`, `Main.dc.html` and the blob-id map for each canvas.

## Key rules (details in src/KIT_RULES.md)

1. **Fidelity.** Same functionality and labels as the app (`en.ts` and the code); nothing invented, nothing removed.
2. **Production-ready.** Real project images (exercise photos, equipment, Atlas, physiques, markers), the correct muscle map, and the app's colour coding.
3. **Hierarchy.** One focal block per screen and quiet secondary content. For example, the session hero is 72px and "Enter this set" is prominent.
4. **Night mode.** While a night is live, the Gym app uses the moonlit palette over the Spotter Sky with SleepHero; sub-apps change palette only.
5. **Sub-app skins.** Apex amethyst, People silver, Learn rubellite, Nutrition lazurite.
6. **Times are editable by typing.** Examples: `timein`, `timerange` (00:00 → 12:00).

## Rebuild

The scripts expected a working dir with `kit.py`, `project/` and `project/assets/` (copy `boards/assets` to `project/assets`).

```
cd src
python3 p04_session.py          # regenerate one page's boards into project/
PART=2 python3 assemble.py      # rebuild canvas 2 (canvas.json + Main.dc.html)
python3 shot.py <board>         # render a preview (Playwright)
```

## Open questions (owner call)

- P04 adds a typed rest **Target** field that is not in the code. Keep it or drop it?
- The illness pill is teal in `redesign.css`, but the boards use the amber illness family.
- Code bugs spotted along the way: "100 kg kg"; lowercase "legs sets".
- Not drawn yet: P17 Music port and a dedicated P18 Desktop page. Desktop boards exist inside each page.

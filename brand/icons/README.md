# Spotter logo & icons

Source of truth: `source/logo.png` (transparent figure). Regenerated with:

```bash
python3 scripts/generate-brand-icons.py
# or: python3 scripts/generate-brand-icons.py --src ~/Downloads/logo.png
```

| Folder                         | Use                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `source/`                      | Raw + zoomed masters; `*-plated-*` on accent-100 `#fbf3e6`                   |
| `web/`                         | PWA / install icons (accent-100 plate) → `client/public/icons/spotter-app-*` |
| `transparent/`                 | UI glyphs for CSS plate (`SpotterMark`)                                      |
| `sidebar/`                     | Narrow rail / nav glyphs (transparent; plate via CSS)                        |
| `favicon/`                     | `favicon.ico` + PNG + apple-touch on accent-100                              |
| `mobile-ui/`                   | Muscle-map UI assets (separate from logo)                                    |
| `ios/` · `macos/` · `android/` | Native app icons                                                             |

Runtime map: `client/src/brand/spotterIcons.ts` · mark: `SpotterMark` (`sidebar` \| `tight` \| `glyph`).
All logo surfaces stay transparent — no graphite plate behind the figure.

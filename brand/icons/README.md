# Spotter icon system (gold `#d9a24f`) — v2

| Folder                         | Use                                                                         |
| ------------------------------ | --------------------------------------------------------------------------- |
| `source/`                      | 1024 masters                                                                |
| `web/`                         | PWA / install icons (full background) → `client/public/icons/spotter-pwa-*` |
| `transparent/`                 | UI glyphs + `*-tight-*` (almost no padding)                                 |
| `sidebar/`                     | Narrow rail / nav slots                                                     |
| `favicon/`                     | `favicon.ico` + PNG 16–512 + apple-touch                                    |
| `mobile-ui/`                   | Transparent PNGs for interface use                                          |
| `ios/` · `macos/` · `android/` | Native app icons                                                            |

Runtime map: `client/src/brand/spotterIcons.ts` · mark: `SpotterMark` (`sidebar` \| `tight` \| `glyph`).

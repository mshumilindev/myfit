# Spotter Music — дизайн (Brass glass)

Обраний напрям: **V2 · Brass glass** (28.09.2026). Інші 4 варіанти відкинуті.

Канва Claude Design: «Spotter — Music · Brass glass» — https://claude.ai/artifact/FBbRifvxyDihKjD2HcFsCf
План фічі: Claude Doc «Spotter Music — план для iOS і macOS» — https://claude.ai/code/artifact/cd8b788c-3906-4de2-88d0-184b285e0d95

| Файл                  | Що                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `Main.dc.html`        | Сесія з mini-player (скляна пігулка над таббаром), rest-кільце, PR-трек перед топ-сетом  |
| `V2-Sheet.dc.html`    | Now Playing sheet: фон з кольорів обкладинки, «For Chest 2», PR track, черга, провайдери |
| `V2-Lock.dc.html`     | Екран блокування iOS: Live Activity (кільце відпочинку, наступний сет, «Set done»)       |
| `V2-Widgets.dc.html`  | Віджети Today XS/S/M/L/XL + iPhone (home, lock, Control Center) + Dynamic Island         |
| `V2-Insights.dc.html` | Soundtrack insights, PR-момент з піснею, summary «Music · 14 tracks»                     |
| `V2-Setup.dc.html`    | Згода, Settings → Music (мапінг, PR Mode), smart playlist, recap-слайд                   |
| `canvas.json`         | Розкладка канви                                                                          |

Стиль «латунне скло»: `linear-gradient(180deg, rgba(60,48,30,.36), rgba(20,18,14,.56))` +
`inset 0 1.2px .5px rgba(238,211,165,.45), inset 0 0 0 1px rgba(217,162,79,.26)`; фон — радіальні
підсвітки з кольорів обкладинки; основні дії — латунні скляні пігулки. Токени як у `client/src/styles.css`
(`--glass-brass-tint`, `--glass-brass-specular`).

# SPO-22 · Контракт сервера дзвінків (D1 = SPO-440)

Клієнт (D2 = SPO-444) будується проти цього файлу. Код: `functions/src/callsCore.ts` (чисте ядро), `functions/src/calls.ts` (callables), `firestore.rules` (`calls`). Тести: `tests/coach-server/callsCore.test.ts`, `tests/rules/calls.rules.logic.test.ts`.

## Правила

- Лише пара тренер ↔ клієнт з `coaching/{clientId}.status == 'active'`; дзвонити може кожен бік. Тренер = роль `trainer` або `admin`. Роль `manager` не дзвонить і їй не дзвонять. Клієнт не може вимкнути дзвінки (налаштування немає).
- Без запису; у документах лише службові id, стан, SDP, ICE.
- Шифрування не застосовано свідомо: SDP/ICE технічні, потрібні сервісу, містять IP, живуть коротко (TTL). Не заявляти «end-to-end».

## Колекції (клієнтський запис заборонений rules; читають лише `callerId` і `calleeId`, не призупинені)

`calls/{callId}` (id генерує клієнт, `^[A-Za-z0-9_-]{16,64}$`):

| поле                                   | тип                                                                         | примітка                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `callerId`, `calleeId`, `clientId`     | string                                                                      | `clientId` = клієнт пари (ключ `coaching/{clientId}`)                         |
| `kind`                                 | `'voice' \| 'video'`                                                        |                                                                               |
| `state`                                | `'ringing' \| 'answered' \| 'active' \| 'ended'`                            |                                                                               |
| `endReason?`                           | `'hangup' \| 'declined' \| 'missed' \| 'busy' \| 'unavailable' \| 'failed'` | лише при `ended`; `busy`/`unavailable` у документ не потрапляють (див. нижче) |
| `offer?`, `answer?`                    | `{type, sdp}`                                                               | `sdp` ≤ 32 KB                                                                 |
| `relayOnly?`                           | `true`                                                                      | лише якщо caller передав `relayOnly:true` у `callStart`; див. «Relay»         |
| `lastSeenAt?`                          | number (мс)                                                                 | heartbeat активного дзвінка (`callActive`)                                    |
| `createdAt`, `answeredAt?`, `endedAt?` | number (мс)                                                                 |                                                                               |
| `expiresAt`                            | Timestamp                                                                   | для TTL-політики                                                              |

`calls/{callId}/ice/{id}`: `{from: uid, candidate: {candidate, sdpMid, sdpMLineIndex, usernameFragment}, createdAt: number, expiresAt: Timestamp}`. Кандидат урізаний до цих чотирьох полів; `candidate: ''` (кінець кандидатів) дозволено; до 200 на дзвінок. ICE-документи функція видаляє одразу, коли дзвінок завершено.

## Callable (v2, us-central1; потрібен вхід, роль member/trainer/admin, не призупинено)

| функція                                                | вхід                                                 | відповідь                                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `callStart`                                            | `{callId, peerId, kind, offer, relayOnly?: boolean}` | `{state:'ringing'}` або `{state:'ended', endReason:'unavailable'\|'busy'}`; повтор того самого `callId` тим самим абонентом = no-op із поточним станом                                                                                                      |
| `callAnswer`                                           | `{callId, accept, answer?}`                          | `{state:'answered'}` або `{state:'ended', endReason:'declined'\|'missed'\|'unavailable'}`; лише callee; `answer` обов'язковий при `accept:true`                                                                                                             |
| `callActive` (**додано, не було в першому контракті**) | `{callId}`                                           | `{state:'active'}`. Перший виклик переводить `answered → active`; далі це **heartbeat**: **клієнт шле `callActive` кожні ~20 с**, поки дзвінок триває. Причина: клієнт не пише в `calls`. На застарілий `active` відповідь `failed-precondition/call-stale` |
| `callEnd`                                              | `{callId, reason}`                                   | `{state:'ended', endReason}`; `reason` ∈ `hangup`, `declined` (лише callee, поки дзвонить), `missed` (лише caller, поки дзвонить), `failed`; перший завершальний `reason` лишається (ідемпотентно)                                                          |
| `callIce`                                              | `{callId, candidate}`                                | `{ok:true}`; лише учасник, лише поки дзвінок живий                                                                                                                                                                                                          |
| `callTurn`                                             | `{callId}`                                           | `{iceServers:[{urls, username?, credential?}]}`; без токена Cloudflare: `stun:stun.cloudflare.com:3478`                                                                                                                                                     |

Помилки: `HttpsError(code, reason, {reason})`. Коди reason: `bad-input`, `bad-call-id`, `bad-peer`, `bad-kind`, `bad-sdp`, `bad-candidate`, `bad-reason`, `call-id-taken`, `no-active-coaching`, `not-allowed` (manager), `not-a-participant` (чужий і неіснуючий дзвінок не розрізняються), `only-callee`, `not-answered`, `call-ended`, `already-in-call`, `too-many-calls`, `too-many-candidates`, `too-many-turn-requests`, `call-stale`, `calls-disabled`.

## Вимикач на сервері (`calls-disabled`)

Усі callables, **крім `callEnd`**, повертають `HttpsError('failed-precondition','calls-disabled')`, доки в існуючому документі прапорів `config/flags` поле `calls` не дорівнює рівно `true`. За замовчуванням **вимкнено** (документа чи поля немає = вимкнено). `callEnd` працює завжди, щоб розпочатий дзвінок можна було завершити. Увімкнути: адмін ставить `config/flags.calls = true` (rules: читає кожен вхідний, пише лише адмін; клієнт може читати той самий прапор для UI); вимкнути: `false` або видалити поле. Поки вимкнено, нічого не пишеться.

## Relay (політика IP)

«За замовчуванням relay» (`iceTransportPolicy:'relay'`) це **клієнтська політика**: сервер її не примушує і не може (клієнт сам будує `RTCPeerConnection`). Є лише необов'язкове серверне відсікання: якщо caller передав у `callStart` `relayOnly:true`, документ дзвінка отримує `relayOnly:true`, і `callIce` **не зберігає** кандидатів, що не є `typ relay` (host, srflx, prflx, mDNS); відповідь усе одно `{ok:true}`, кінець кандидатів (`''`) проходить. SDP сервер не змінює (кандидати, вбудовані в offer/answer, лишаються на клієнті: для relay-only клієнт має збирати SDP після `iceTransportPolicy:'relay'`). Це захист від клієнта, що забув політику, а не гарантія для співрозмовника, який `relayOnly` не просив.

## Поведінка

- **Тихі години / `unavailable`.** Якщо жоден пристрій callee не продзвонився б зараз (`shouldDeliver('call', ...)`: тихі години пристрою), `callStart` повертає `ended/unavailable` **і нічого не пише**: callee не дізнається про спробу. Callee без жодного зареєстрованого пристрою вважається доступним (відкритий застосунок дзвонить зі snapshot). Причину не розкриваємо.
- **`busy`.** У callee (або в caller, тоді помилка `already-in-call`) є інший «живий» дзвінок. Живий = `ringing` молодший за 60 с (45 с вікно + 15 с запас), `answered` молодший за 2 хв від `answeredAt`, `active` з `lastSeenAt` не старшим за 45 с (heartbeat) і молодший за 4 год від створення. Застарілий документ не блокує; **`callStart` закриває застарілий власний дзвінок caller-а** (`ringing` → `missed`, інакше `failed`; ICE видаляється). Документ для `busy` не створюється. Запити «зайнятий?» мають `limit 10` і `state in [ringing, answered, active]`; потрібні складені індекси `calls (callerId, state)` і `calls (calleeId, state)` (додані в `firestore.indexes.json`; **індекси деплоїти раніше за функції**, інакше `callStart` падає з `failed-precondition` про відсутній індекс).
- **`missed`.** Зазвичай це caller клієнта по таймеру 45 с: `callEnd(reason:'missed')`. Якщо callee відповідає після 60 с, сервер сам закриває як `missed`.
- **Rate limit.** 20 `callStart` на годину на абонента (`rateLimits/call_<uid>_<година>`, `resource-exhausted/too-many-calls`). Повтор того самого `callId` ліміт не з'їдає. Спроби, що закінчились `unavailable`, слот **не** використовують; для них ліміт 3 на годину на пару (caller, callee) (`rateLimits/callna_<caller>_<callee>_<година>`): після третьої відповідь завжди `unavailable` без перевірки callee, щоб не підбирати вікно тихих годин. `callTurn`: 10 на годину на дзвінок (`too-many-turn-requests`). `callIce`: 200 на дзвінок загалом і 120 на учасника (`too-many-candidates`).
- **Пуш.** `kind:'call'` (категорія `calls`: без перемикача, тихі години тримають), мітка `coach-call`, TTL 45 с (`PushMessage.ttl`), текст «Incoming call» у 5 локалях, без імені й даних, тап відкриває `/#/`.
- **Призупинений або видалений** учасник: `no-active-coaching`.

## TURN (Cloudflare)

`callTurn` викликає `POST https://rtc.live.cloudflare.com/v1/turn/keys/<keyId>/credentials/generate-ice-servers` (`{ttl:3600}`, Bearer-токен); у Cloudflare іде лише TTL, жодних даних користувача. Будь-яка помилка або відсутність токена дає STUN-only, не помилку. **Не перевірено на живому API.** Токен — секрет `CF_TURN_TOKEN` (прив'язаний лише до `callTurn`, `defineSecret`), ключ — параметр `CF_TURN_KEY_ID` (`functions/.env.spotter-64c3b`, не секрет). Без ключа або секрета відповідь — лише STUN.

## TTL і налаштування Firestore (потрібна дія власника/адміна; код TTL не вмикає)

Аналога в репо немає (`liveSessions.expireAt` залишається цілим числом, `passkeyChallenges.expiresAt` теж; їх чистять підмітання). Для дзвінків поля `expiresAt` вже `Timestamp`, тож політики працюють:

TTL тепер у `firestore.indexes.json` (`fieldOverrides` з `ttl: true` для `calls` і `ice`), тож вмикається деплоєм індексів (`firebase deploy --only firestore:indexes`), `gcloud` не потрібен. Еквівалент вручну:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=calls --enable-ttl --project=spotter-64c3b
gcloud firestore fields ttls update expiresAt --collection-group=ice   --enable-ttl --project=spotter-64c3b
```

Строки (стеля й орієнтир, число для політики за `{{ЮРИСТ}}`): `calls` ≈ 24 год після створення/завершення (`CALL_DOC_TTL_MS`; при завершенні `expiresAt` = кінець + 24 год), `ice` 10 хв (`ICE_TTL_MS`) та видалення одразу при завершенні. Firestore видаляє зазвичай протягом доби після `expiresAt`, тож це backstop, а не точний строк. Видалення батьківського документа TTL-ом **не** видаляє підколекцію `ice`: тому ICE має власну політику (collection group `ice`).

## Видалення акаунта та реєстр

Каскад (`accountDeletionCore.ts`, крок 2) видаляє кожен `calls/*`, де акаунт `callerId` або `calleeId`, разом з `ice` (`deleteTree`). Реєстр: рядок R61 (`docs/compliance/data-registry.md`, веде D7). Розбіжність для D7: у R61 поля названі `caller`/`callee`, у контракті `callerId`/`calleeId`; `ice` має `from`, `candidate`, `createdAt`, `expiresAt`; додатково `clientId`, `answeredAt`, `endedAt`, `endReason`.

## Відкриті питання

1. Секрет і ключ Cloudflare TURN (блокер власника для релею); перевірка відповіді API.
2. Вмикання TTL-політик (команди вище) і числа строків для реєстру `{{ЮРИСТ}}`.
3. «Пропущений дзвінок» для callee, що був у тихих годинах: зараз нічого не лишається (свідомо). Журнал у чаті (D4) пише клієнт caller-а.
4. Клієнтські інтервали: heartbeat `callActive` ≈ 20 с, таймер дзвінка 45 с. Індекси деплоїти до функцій; прапор `calls` вмикає власник після ризик-рев'ю й налаштування TURN.
5. Guard: `tests/no-media-recorder.guard.test.ts` (у `client/src`, `functions/src`, `desktop/src` немає `MediaRecorder`).

# Claude Design Brief — next live-session features

Цей brief описує наступні high-ROI фічі для live-session і finish-summary
флоу. Це не бекенд-спека; це дизайн-напрям для Claude Design, який має
показати очікувані екрани, стани і взаємодії.

## 1. Duplicate set

Замість generic "one-tap set logging" потрібна дія **Duplicate set**.

### Сценарій

- Користувач щойно залогував підхід.
- Біля останнього set row або в ghost/action row є швидка дія duplicate.
- Натискання створює наступний set, який повністю копіює попередній.
- Після duplicate користувач може одразу редагувати reps/weight, але головний
  сценарій має бути one tap.

### Правила

- Дублюється весь set object, не тільки reps/weight.
- Зберігається set type: `working`, `warmup`, `drop`, `reverse-drop`.
- Якщо це dropset або reverse dropset, дублюються всі subsets/drops у тому
  самому порядку.
- Новий set отримує новий номер/position і виглядає як наступний підхід.
- Для strength це primary quick action.
- Для cardio/warmup/cooldown не створювати шумний UI, якщо немає очевидного
  повторюваного сценарію.

### UI direction

- Не називати це "AI" або "smart".
- Кнопка компактна: copy/duplicate icon + короткий label або tooltip.
- Дія має бути доступною великим пальцем у live session.
- Не створювати окрему важку панель.

## 2. Automatic rest timer

Rest timer має не просто рахувати "час від останнього кліку", а записувати
приблизний фактичний відпочинок між сетами.

### Логіка

- Коли користувач логує set N, система фіксує timestamp.
- Коли користувач логує set N+1 у тій самій вправі, rest time для N+1:
  `loggedAt(N+1) - loggedAt(N) - defaultExecutionTime`.
- Початковий `defaultExecutionTime`: 30 секунд.
- Якщо результат менший за 0, показувати 0 або не показувати rest.
- Для dropset/reverse dropset execution estimate один на весь set, не на кожен
  subset.
- У майбутньому default можна винести в Settings, але для першого дизайну
  достатньо одного дефолту.

### UI direction

- Після логування set показати live countdown/count-up "Rest".
- На наступному set row показати фактичний rest, наприклад `Rest 1:42`.
- Rest має бути тихим secondary text, не змагатися з reps/weight.
- У header live session можна показати поточний rest timer від останнього set.
- Має бути ручний reset/skip, але не як головна дія.

## 3. Share workout summary

Після `Finish` потрібна дія **Share**, яка генерує polished image для Instagram
Stories або повідомлення.

### Сценарій

- Користувач завершує тренування.
- На finish summary з'являється кнопка `Share`.
- Натискання генерує спеціальне share image, а не сирий скріншот UI.
- Далі відкривається native share sheet, якщо платформа це підтримує.
- Користувач може відправити картинку в Instagram Stories, Telegram, iMessage,
  WhatsApp або зберегти в галерею/файли.

### Формати

- Primary: Instagram Stories `1080x1920`.
- Secondary: compact/square для повідомлень, наприклад `1080x1080`.
- На mobile за замовчуванням готувати story image.
- На desktop fallback: `Download image`.

### Контент на share image

- My Fit branding.
- Назва тренування, якщо є.
- Дата й тривалість.
- Total volume.
- Кількість sets.
- Кількість exercises.
- New records, якщо були.
- Top exercise або 2-3 ключові вправи.
- Gym name, якщо workout attached to gym.
- Optional small muscle groups worked strip.

### Privacy and states

- Не показувати body weight, notes, username/email за замовчуванням.
- Якщо workout auto-finished або incomplete, це не головний highlight; максимум
  тихий secondary label.
- Share image має виглядати добре без пояснювального тексту поруч.
- Генерація картинки не блокує завершення тренування.
- PWA має працювати offline: image generation не має вимагати мережі.

### Visual direction

- Premium fitness receipt, не маркетинг-постер.
- Темний graphite background, brass accents, emerald тільки для records.
- Велика hero-метрика: volume або duration.
- Чітка типографіка, читабельно в сторіз за 1 секунду.

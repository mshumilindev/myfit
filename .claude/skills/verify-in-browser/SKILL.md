---
name: verify-in-browser
description: Use when proving a UI change or bug fix in a real browser — click through each acceptance criterion with screenshots, without writing data to the database from the user's account.
---

# Перевірка UI в браузері

1. **Мета:** кожен AC — окремий клік-сценарій зі скріном «до/після». Нічого не пиши в БД з акаунта користувача: лише read-only екрани, емулятор або синтетичний акаунт.
2. **Середовище:** локальний `npm run dev -w client` / Storybook (`build-storybook`, у foreground ≤170 с, `NODE_OPTIONS=--max-old-space-size=3000`) або жива сторінка read-only. Браузер на пристрої може бути відсутній: тоді аудити й скріни в хмарному контейнері (Chromium у `/opt/pw-browsers`), збірку переносять tar-архівом.
3. **В'юпорти:** 390×844 (мобільний) і 1280×800 (desktop); для coach ще 768/1024/1440. 5 локалей там, де є текст; великий шрифт ×1.5 для переповнень.
4. **Збір доказів:** скрін + консоль без помилок (`read_console_messages`) + за потреби геометрія (`scripts/*-audit.mjs`) / CLS. Не вважай «виглядає нормально» доказом.
5. **Результат:** по кожному AC — пройшло/не пройшло + посилання на скрін. Не пройшло — AC лишається відкритим.

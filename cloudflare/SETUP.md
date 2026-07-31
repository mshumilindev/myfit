# Доступ з телефона через Cloudflare Tunnel

Мета: `https://fit.твій-домен.com` → твій Мак → `localhost:4477`.
Телефону не потрібно нічого, крім браузера. HTTPS дає Cloudflare автоматично.

## 1. Домен

1. Купи домен (будь-де: Cloudflare Registrar, Namecheap, порядку $10/рік).
2. Заведи безкоштовний акаунт на [dash.cloudflare.com](https://dash.cloudflare.com)
   і додай туди домен (Add site → Free plan).
3. Якщо домен куплений не в Cloudflare — зміни NS-сервери у реєстратора на ті,
   що покаже Cloudflare (це єдиний "нудний" крок, застосовується до години).

## 2. cloudflared на Маку

```bash
brew install cloudflared
cloudflared tunnel login          # відкриє браузер, вибери свій домен
cloudflared tunnel create my-fit  # запиши TUNNEL_ID з виводу
```

## 3. Конфіг

```bash
mkdir -p ~/.cloudflared
cp cloudflare/config.example.yml ~/.cloudflared/config.yml
# відредагуй: встав TUNNEL_ID (2 місця) і свій hostname
```

Прив'яжи DNS-запис до тунелю:

```bash
cloudflared tunnel route dns my-fit fit.твій-домен.com
```

## 4. Запуск

```bash
cloudflared tunnel run my-fit
```

Відкрий `https://fit.твій-домен.com` з телефона — має відкритись трекер.
На iPhone: Safari → Поділитись → «На Початковий екран» — і це стане
повноцінним застосунком з іконкою (PWA, працює офлайн).

## 5. Автозапуск тунелю (щоб не тримати термінал)

```bash
sudo cloudflared service install
```

Це поставить LaunchDaemon — тунель підніматиметься сам після перезавантаження.

## Нотатки з безпеки

- Назовні відкритий лише порт через тунель; на роутері нічого відкривати не треба.
- Додаток захищений логіном/паролем + JWT. Реєстрація закривається після
  створення першого акаунта.
- За бажанням можна ще додати Cloudflare Access (безкоштовно до 50 юзерів) —
  тоді перед додатком буде ще один шар авторизації Cloudflare.

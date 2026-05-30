# ЮKassa (YooKassa) — Оплата доступа водителя

Интеграция уже подключена в код и в БД. Осталось только задать ключи ЮKassa и настроить webhook.

## Что уже сделано

- ✅ Таблица `driver_access_payments` создана в Supabase
- ✅ API routes `/api/yokassa/*` готовы
- ✅ Модалка оплаты подключена в профиль («Стать водителем») и на карту (баннер сверху)
- ✅ Фильтрация: водитель без оплаты видит пассажирские заявки бледными и некликабельными, в радаре они скрыты
- ⏳ Нужно: заполнить `YOKASSA_SHOP_ID` и `YOKASSA_SECRET_KEY` в Vercel

---

## Как это работает

1. Водитель переключается в режим «Водитель» в профиле → открывается модалка оплаты
2. Или: водитель уже выбрал роль «Водитель», но доступ не оплачен → на карте показывается баннер «Оплатите доступ» сверху
3. Нажимает «Оплатить 200 ₽» → создаётся платёж через ЮKassa API
4. Открывается страница оплаты ЮKassa в новой вкладке (карта, СБП и т.д.)
5. После оплаты ЮKassa присылает webhook → сервер ставит `status = paid`, `expires_at = +24ч`
6. Кнопка «Я оплатил — проверить» подтверждает статус и активирует доступ локально
7. Водитель видит заявки пассажиров 24 часа

---

## Структура файлов

```
lib/yokassa.ts                          — API-клиент ЮKassa (создание платежа)
lib/yokassa-access.ts                   — Логика доступа (проверка/выдача 24ч)
app/api/yokassa/create-payment/route.ts — Создание платежа (POST)
app/api/yokassa/webhook/route.ts        — Webhook от ЮKassa (POST)
app/api/yokassa/check-access/route.ts   — Проверка доступа (GET)
hooks/use-driver-access.ts              — React хук с кешем в localStorage
components/yokassa-payment-modal.tsx     — Модалка оплаты (fixed inset-0 z-[100])
components/driver-access-gate.tsx       — Гейт-компонент (если понадобится отдельно)
supabase/sql/full_schema.sql            — Таблица driver_access_payments (секция 7b)
```

Точки интеграции в существующем коде:
- `app/profile-screen.tsx` — модалка открывается при подтверждении «Да, я водитель»
- `app/map-screen.tsx` — баннер сверху для водителя без доступа + блюр пассажирских маркеров
- `app/driver-placemark.tsx` — проп `locked` делает плейсмарк полупрозрачным

---

## Что нужно сделать (только эти 3 шага)

### 1. Заполнить переменные окружения

Локально (`.env.local`) и в Vercel → Settings → Environment Variables:

```env
YOKASSA_SHOP_ID=123456
YOKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=https://poputi-ride.vercel.app
```

**Где взять ключи:**
- https://yookassa.ru → Личный кабинет → Настройки → API ключи
- **shopId** — идентификатор магазина (числовой)
- **Секретный ключ** — `live_...` (боевой) или `test_...` (тестовый)

### 2. Настроить webhook в ЮKassa

1. Личный кабинет ЮKassa → Интеграция → HTTP-уведомления
2. URL: `https://poputi-ride.vercel.app/api/yokassa/webhook`
3. Событие: `payment.succeeded`
4. Сохранить

### 3. Задеплоить

```bash
git push
# или
pnpm run deploy:prod
```

---

## Настройки

`lib/yokassa-access.ts`:

```ts
export const YOKASSA_ACCESS_PRICE = 200         // цена в рублях
export const YOKASSA_ACCESS_DURATION_HOURS = 24  // длительность доступа
```

Поменять на неделю: `YOKASSA_ACCESS_DURATION_HOURS = 168`.

---

## Тестирование

В ЮKassa можно создать **тестовый магазин**. Тестовый ключ начинается с `test_`.

Тестовая карта для успешной оплаты:
- Номер: `1111 1111 1111 1026`
- Срок: любой будущий
- CVC: `000`

Полный список: https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing

---

## FAQ

**Q: Что если webhook не дошёл?**
A: Кнопка «Я оплатил — проверить» делает GET-запрос на `/api/yokassa/check-access` и подтверждает статус через прямой запрос к Supabase. ЮKassa также повторяет webhook несколько раз (до 24 часов).

**Q: Что если пользователь закрыл страницу оплаты?**
A: При следующем заходе он снова увидит модалку. Старый pending-платёж просто останется в БД.

**Q: Как проверить доступ на сервере?**

```ts
import { hasActiveAccess } from "@/lib/yokassa-access"
const hasAccess = await hasActiveAccess("id123456")
```

**Q: Почему vkTag для localhost — `id000000`?**
A: Локально без VK Mini App `vkUser` равен null. Используется fallback для теста. В проде в VK Mini App всегда есть реальный vkUser.

**Q: Где хранится локальный кеш доступа?**
A: `localStorage` ключи `poputi_yokassa_access_v1` и `poputi_yokassa_access_expires_v1`. При истечении срока кеш чистится сам и идёт повторный запрос на сервер.

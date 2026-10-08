# Resto Table — Backend

Restoran uchun stol bron qilish, buyurtma olish, oshxona (KDS) va ombor tizimi.
**Node.js + Express + MongoDB (Mongoose)**, autentifikatsiya: JWT (access + refresh).

## Tez boshlash

```bash
npm install
cp .env.example .env        # MONGO_URI ni o'zingiznikiga moslang
npm run dev                 # http://localhost:5000
npm test                    # 188 ta avtomatik test (vaqtinchalik MongoDB bilan, ~75 soniya)
```

Birinchi ishga tushganda baza o'zi tayyorlanadi va bazada saqlanadi:

| Rol | Telefon | Parol |
|---|---|---|
| Superadmin (`superadmin`) | `.env` dagi `SUPERADMIN_PHONE` | `.env` dagi `SUPERADMIN_PASSWORD` |
| Restoran admini (`restaurant_admin`) | `+998901000001` | `INITIAL_PASSWORD` (standart `Password123`) |
| Ofitsiant (`waiter`) | `+998901000002` | shu parol |
| Oshpaz (`cook`) | `+998901000003` | shu parol |
| Omborchi (`storekeeper`) | `+998901000004` | shu parol |
| Mijoz (`customer`) | `+998901000005` | shu parol |

Admin, ofitsiant, oshpaz va omborchi bitta "Asosiy restoran" ga biriktirilgan. Bu boshlang'ich ma'lumot faqat bir marta
yaratiladi (keyin o'chirsangiz qayta paydo bo'lmaydi) va production da yaratilmaydi. Superadminni qo'lda yaratish: `npm run seed:superadmin`.

- **Hujjat va sinash sahifasi:** http://localhost:5000/docs — rollar, access/refresh oqimi (axios), ssenariylar,
  ruxsatlar jadvali, har bir endpoint va "Sinab ko'rish". Faqat `NODE_ENV` production bo'lmaganda ochiladi.
- Demo ma'lumot yo'q: hammasi haqiqiy bazada, API orqali yaratiladi.

## Production uchun

- `NODE_ENV=production`, `JWT_ACCESS_SECRET` va `JWT_REFRESH_SECRET` (kamida 16 belgi, bir-biridan farqli, standart emas):
  aks holda server ishga tushmaydi.
- `SUPERADMIN_PHONE` va `SUPERADMIN_PASSWORD` ni o'zingiz yozing (production da boshlang'ich akkauntlar va `/docs` yo'q).
- Login/register bir IP dan 15 daqiqada 30 martagacha (`AUTH_RATE_MAX`, `AUTH_RATE_WINDOW_MIN`); proxy orqasida `TRUST_PROXY=true`.
- `CORS_ORIGIN` ni frontend manziliga o'zgartiring. Server SIGINT/SIGTERM da toza to'xtaydi.

## Railway ga joylash

1. Kodni GitHub ga push qiling, Railway da **New Project → Deploy from GitHub repo** ni tanlang (`railway.json` tayyor: `npm start`, health check `/api/health`).
2. Loyihaga **MongoDB** qo'shing (Railway: *New → Database → MongoDB*) yoki MongoDB Atlas ulanishini kiriting.
3. Servis **Variables** bo'limiga yozing:

| O'zgaruvchi | Qiymat |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Railway Mongo uchun `${{MongoDB.MONGO_URL}}` (yoki Atlas havolasi). `MONGO_URL` / `MONGODB_URI` ham qabul qilinadi |
| `JWT_ACCESS_SECRET` | uzun tasodifiy qator (kamida 16 belgi), masalan `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | boshqa uzun tasodifiy qator (access dan farqli) |
| `SUPERADMIN_PHONE` | masalan `+998901234567` |
| `SUPERADMIN_PASSWORD` | kuchli parol (kamida 8 belgi) |
| `CORS_ORIGIN` | frontend manzili, masalan `https://mening-saytim.up.railway.app` |

`PORT` ni Railway o'zi beradi. Proxy orqasida haqiqiy IP uchun `TRUST_PROXY` Railway da avtomatik yoqiladi.
Birinchi ishga tushishda superadmin bazada o'zi yaratiladi. Production da `/docs` va boshlang'ich akkauntlar yo'q:
o'quvchilar uchun alohida test servis kerak bo'lsa, ikkinchi servisda `NODE_ENV=development` qo'ying
(u holda `/docs` va tayyor akkauntlar ochiq bo'ladi, shuning uchun uni jamoat uchun ochmang).

## Papka tuzilmasi

```
src/
  app.js, server.js     ilovani yig'ish va ishga tushirish
  config/               env o'zgaruvchilari, MongoDB ulanishi, boshlang'ich ma'lumot
  models/               Mongoose modellar (har biri alohida fayl)
  routes/               URL -> controller bog'lanishi, rol cheklovlari
  controllers/          so'rovni qabul qiladi, tekshiradi, javob beradi
  services/             qayta ishlatiladigan mantiq: token, ruxsat, ombor, qulf (lock), o'chirish (cascade)
  serializers/          javob shakli (API ga nima chiqishi)
  middlewares/          auth (JWT), tezlik chegarasi, xato ishlovchi
  utils/                validatsiya (fields.js), sahifalash, id yordamchilari
public/docs/            /docs sahifasi (endpoints.js — hujjat ma'lumotlari)
scripts/                superadminni qo'lda yaratish
tests/                  avtomatik testlar (node:test)
```

## Bitta so'rov qanday ishlaydi (misol: `PATCH /api/tables/5`)

1. `routes/table.routes.js` yo'lni `table.update` ga yo'naltiradi (oldin `routes/index.js` tokenni tekshiradi).
2. `controllers/table.controller.js` → `findOr404` bilan stolni topadi, `assertAccess` bilan rolni tekshiradi,
   `parseBody` bilan kirishni tekshiradi, saqlaydi.
3. `serializers/index.js` javobni shakllantiradi.
4. Xato bo'lsa `ApiError` tashlanadi, `middlewares/errorHandler.js` uni `{ detail }` yoki `{ field: [..] }` qiladi.

## Yangi endpoint qo'shish

1. Controller funksiyasini yozing.
2. `routes/*.routes.js` ga ulang.
3. `public/docs/endpoints.js` ga hujjat qatorini qo'shing (`E(...)`), shunda `/docs` da ko'rinadi.
   `npm test` hujjatdagi har bir endpoint serverda borligini va ruxsatlar jadvali (`who`) haqiqiy server bilan mos ekanini tekshiradi.

## Nomlash qoidalari

- Yo'llar: hammasi `/api` ostida; kichik harf, so'zlar `-` bilan (`stock-in`, `recipe-items`, `available-tables`), resurslar ko'plikda.
  Restoranga tegishli ro'yxat/yaratish `/api/restaurants/:id/tables`, bitta resurs ustidagi amal `/api/tables/:id`.
- Maydonlar va qiymatlar inglizcha `snake_case`: `restaurant`, `seats`, `payment_method`; statuslar:
  stol `free | occupied`, buyurtma `open | closed`, taom `new | sent | cooking | ready`,
  bron `pending | confirmed | completed | cancelled`; rollar `waiter | cook | storekeeper | restaurant_admin | customer | superadmin`.

## Muhim qoidalar

- id lar butun son (1, 2, 3...), avtomatik oshadi (`models/base.js`). Path da faqat raqamlar qabul qilinadi.
- Faqat `PATCH` (qisman yangilash); `PUT` yo'q.
- Ruxsatlar: `routes` da `restrictTo(...)` / `restrictStrict(...)` / `superadminOnly`, restoran bo'yicha esa controller ichida `assertAccess`.
- Taom `cooking` ga o'tganda retsept bo'yicha ombor avtomatik kamayadi (`services/stock.service.js`): bir marta, atomik, yetmasa 400 va hech narsa o'zgarmaydi.
- Bir stolga parallel bron va parallel ombor/son o'zgarishlari poyga holatlaridan himoyalangan (`services/lock.js`, atomik `$inc`).

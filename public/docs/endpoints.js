/* Hujjat ma'lumotlari. Sahifa shu fayldan avtomatik chiziladi (docs.js).
   Yangi endpoint qo'shish: pastdagi ENDPOINTS ro'yxatiga bitta E(...) qatori qo'shing. */
(function () {
  /* ---------- Rollar: kim nima qila oladi ---------- */
  const ROLES = {
    superadmin: {
      name: 'Superadmin', short: 'SA', color: '#7c3aed',
      summary: 'Platforma egasi. Restoranlarni qo\'shadi va har bir restoranga admin tayinlaydi. Kundalik ish (buyurtma, oshxona) unga mo\'ljallanmagan.',
      screens: [
        { name: 'Restoranlar', desc: 'Ro\'yxat, yangi restoran formasi, tahrirlash, o\'chirish.', calls: ['GET /api/restaurants', 'POST /api/restaurants', 'PATCH /api/restaurants/{id}', 'DELETE /api/restaurants/{id}'] },
        { name: 'Restoran adminlari', desc: 'Restoranga admin tayinlash, parolini yangilash, o\'chirish.', calls: ['GET /api/admins', 'POST /api/admins', 'PATCH /api/admins/{id}', 'DELETE /api/admins/{id}'] },
      ],
      cannot: ['Restoran ichki ma\'lumotlariga kirish: stol, menyu, ombor, buyurtma, oshxona, xodim va bronlar (maxfiylik)', 'Mijoz sifatida bron qilish'],
    },
    restaurant_admin: {
      name: 'Restoran admini', short: 'AD', color: '#2563eb',
      summary: 'Bitta restoranni boshqaradi: stollar, menyu, retsept, xodimlar va bronlar. Faqat o\'z restoranidagi ma\'lumotni ko\'radi.',
      screens: [
        { name: 'Stollar', desc: 'Zal sxemasi: stol qo\'shish, o\'rin sonini o\'zgartirish.', calls: ['GET /api/restaurants/{id}/tables', 'POST /api/restaurants/{id}/tables', 'PATCH /api/tables/{id}', 'DELETE /api/tables/{id}'] },
        { name: 'Menyu boshqaruvi', desc: 'Kategoriya va taomlar, narx, stop-list.', calls: ['GET /api/restaurants/{id}/menu', 'POST /api/restaurants/{id}/categories', 'PATCH /api/categories/{id}', 'DELETE /api/categories/{id}', 'POST /api/categories/{id}/dishes', 'PATCH /api/dishes/{id}', 'DELETE /api/dishes/{id}', 'PATCH /api/dishes/{id}/toggle-availability'] },
        { name: 'Retseptlar', desc: 'Har bir taom uchun 1 porsiyaga ketadigan ingredientlar.', calls: ['GET /api/dishes/{id}/recipe-items', 'POST /api/dishes/{id}/recipe-items', 'PATCH /api/recipe-items/{id}', 'DELETE /api/recipe-items/{id}'] },
        { name: 'Xodimlar', desc: 'Ofitsiant, oshpaz, omborchi qo\'shish; ishdan bo\'shatish.', calls: ['GET /api/restaurants/{id}/staff', 'POST /api/restaurants/{id}/staff', 'PATCH /api/staff/{id}', 'DELETE /api/staff/{id}'] },
        { name: 'Bronlar', desc: 'Mijozlar bronini ko\'rish, tasdiqlash yoki bekor qilish.', calls: ['GET /api/reservations', 'PATCH /api/reservations/{id}/status'] },
        { name: 'Hisobotlar (faqat ko\'rish)', desc: 'Buyurtmalar tarixi, ombor qoldig\'i va harakati.', calls: ['GET /api/restaurants/{id}/orders', 'GET /api/restaurants/{id}/ingredients', 'GET /api/restaurants/{id}/stock-transactions'] },
      ],
      cannot: ['Restoran yaratish yoki o\'chirish', 'Boshqa restoran ma\'lumotiga kirish', 'Admin yaratish (buni superadmin qiladi)'],
    },
    waiter: {
      name: 'Ofitsiant', short: 'OF', color: '#059669',
      summary: 'Zalda ishlaydi: stol bo\'yicha buyurtma ochadi, taom qo\'shadi, oshxonaga yuboradi va hisobni yopadi.',
      screens: [
        { name: 'Stollar xaritasi', desc: 'Qaysi stol bo\'sh, qaysi biri band.', calls: ['GET /api/restaurants/{id}/tables'] },
        { name: 'Yangi buyurtma', desc: 'Stol tanlanadi, menyudan taomlar savatga qo\'shiladi.', calls: ['POST /api/restaurants/{id}/orders', 'GET /api/restaurants/{id}/menu', 'POST /api/orders/{id}/items'] },
        { name: 'Buyurtmani o\'zgartirish', desc: 'Sonni oshirish, taomni olib tashlash, stol yoki to\'lov turini o\'zgartirish.', calls: ['PATCH /api/order-items/{id}/quantity', 'DELETE /api/order-items/{id}', 'PATCH /api/orders/{id}'] },
        { name: 'Oshxonaga yuborish', desc: 'Yangi taomlar oshpaz ekraniga tushadi; holatini kuzatish; tayyor taomni yetkazilgan deb belgilash.', calls: ['POST /api/orders/{id}/send-to-kitchen', 'GET /api/orders/{id}', 'PATCH /api/order-items/{id}/serve'] },
        { name: 'Bugungi bronlar', desc: 'Zal bronlarini ko\'rish (faqat o\'qish).', calls: ['GET /api/reservations'] },
        { name: 'Mening buyurtmalarim', desc: 'O\'zim ochgan ochiq buyurtmalar (?status=open&mine=true).', calls: ['GET /api/restaurants/{id}/orders'] },
        { name: 'Hisobni yopish', desc: 'Mijoz to\'lagach buyurtma yopiladi, stol bo\'shaydi.', calls: ['PATCH /api/orders/{id}/status'] },
      ],
      cannot: ['Menyu, narx, stollarni tahrirlash', 'Oshxona statusini o\'zgartirish', 'Ombor va xodimlarni ko\'rish'],
    },
    cook: {
      name: 'Oshpaz', short: 'OP', color: '#ea580c',
      summary: 'Oshxona ekrani (KDS): yuborilgan taomlarni tayyorlaydi va holatini yangilaydi.',
      screens: [
        { name: 'Oshxona navbati', desc: 'Yuborilgan, hali tayyor bo\'lmagan taomlar; eng eskisi birinchi.', calls: ['GET /api/kitchen/items', 'PATCH /api/kitchen/items/{id}/status'] },
        { name: 'Stop-list', desc: 'Mahsulot tugasa taomni vaqtincha o\'chirish.', calls: ['GET /api/restaurants/{id}/menu', 'PATCH /api/dishes/{id}/toggle-availability'] },
        { name: 'Retsept va qoldiq', desc: 'Taom tarkibi va ombordagi qoldiqni ko\'rish.', calls: ['GET /api/dishes/{id}/recipe-items', 'GET /api/restaurants/{id}/ingredients'] },
      ],
      cannot: ['Buyurtma ochish yoki o\'zgartirish', 'Omborga kirim / isrof yozish', 'Menyu va narxni tahrirlash'],
    },
    storekeeper: {
      name: 'Omborchi', short: 'OM', color: '#0891b2',
      summary: 'Ingredientlar va ombor qoldig\'ini yuritadi. Taom tayyorlanganda qoldiq o\'zi kamayadi.',
      screens: [
        { name: 'Ingredientlar', desc: 'Ro\'yxat, yangi ingredient, nom/birlikni tahrirlash.', calls: ['GET /api/restaurants/{id}/ingredients', 'POST /api/restaurants/{id}/ingredients', 'PATCH /api/ingredients/{id}', 'DELETE /api/ingredients/{id}'] },
        { name: 'Kirim', desc: 'Mahsulot kelganda qoldiqni oshirish.', calls: ['PATCH /api/ingredients/{id}/stock-in'] },
        { name: 'Isrof', desc: 'Buzilgan yoki yo\'qolgan mahsulotni sabab bilan hisobdan chiqarish.', calls: ['PATCH /api/ingredients/{id}/stock-out'] },
        { name: 'Kirim-chiqim tarixi', desc: 'Barcha harakatlar, jumladan taom tayyorlashdagi avtomatik chiqimlar.', calls: ['GET /api/restaurants/{id}/stock-transactions'] },
      ],
      cannot: ['Menyu va retseptni tahrirlash', 'Buyurtma va oshxona bilan ishlash', 'Xodimlarni boshqarish'],
    },
    customer: {
      name: 'Mijoz', short: 'MJ', color: '#db2777',
      summary: 'O\'zi ro\'yxatdan o\'tadi, restoran tanlaydi, bo\'sh stolni topib bron qiladi.',
      screens: [
        { name: 'Ro\'yxatdan o\'tish va kirish', desc: 'Yangi akkaunt, keyin login.', calls: ['POST /api/auth/register', 'POST /api/auth/login'] },
        { name: 'Restoranlar', desc: 'Qidiruv va tanlash.', calls: ['GET /api/restaurants', 'GET /api/restaurants/{id}'] },
        { name: 'Menyu', desc: 'Kategoriyalar ichida taomlar va narxlar.', calls: ['GET /api/restaurants/{id}/menu'] },
        { name: 'Bron qilish', desc: 'Avval sana/vaqt/mehmon soni bo\'yicha bo\'sh stol qidiriladi, keyin bron qilinadi.', calls: ['GET /api/restaurants/{id}/available-tables', 'POST /api/restaurants/{id}/reservations'] },
        { name: 'Mening bronlarim', desc: 'Bronlar ro\'yxati va bekor qilish.', calls: ['GET /api/reservations/my', 'PATCH /api/reservations/{id}/cancel'] },
        { name: 'Profil', desc: 'Ma\'lumot va parolni o\'zgartirish.', calls: ['GET /api/users/me', 'PATCH /api/users/me', 'POST /api/users/me/change-password'] },
      ],
      cannot: ['Stol, menyu, narxni tahrirlash', 'Buyurtma ochish, oshxona va ombor', 'Boshqa mijozning bronini ko\'rish'],
    },
  };

  /* Hamma rollarga umumiy */
  const COMMON = ['POST /api/auth/login', 'POST /api/auth/refresh', 'POST /api/auth/logout', 'GET /api/users/me', 'PATCH /api/users/me', 'POST /api/users/me/change-password', 'GET /api/restaurants', 'GET /api/restaurants/{id}'];

  const ENUMS = [
    { name: 'User.role', desc: 'Foydalanuvchi roli', values: [['superadmin', 'Platforma egasi'], ['restaurant_admin', 'Restoran admini'], ['waiter', 'Ofitsiant'], ['cook', 'Oshpaz'], ['storekeeper', 'Omborchi'], ['customer', 'Mijoz']] },
    { name: 'Table.status', desc: 'Stol holati (ochiq buyurtma bo\'lsa o\'zi "occupied" bo\'ladi)', values: [['free', 'Bo\'sh'], ['occupied', 'Band']] },
    { name: 'Order.status', desc: 'Buyurtma holati', values: [['open', 'Ochiq (qabullandi)'], ['closed', 'Yopildi (to\'langan)']] },
    { name: 'Order.payment_method', desc: 'To\'lov turi', values: [['unset', 'Hali tanlanmagan (boshlang\'ich qiymat)'], ['cash', 'Naqd'], ['card', 'Karta']] },
    { name: 'OrderItem.status', desc: 'Buyurtmadagi taom holati. Ketma-ketlik: new → sent → cooking → ready → served', values: [['new', 'Yangi — ofitsiant qo\'shdi'], ['sent', 'Oshxonaga yuborildi'], ['cooking', 'Tayyorlanmoqda (ombordan ingredient yechiladi)'], ['ready', 'Tayyor — ofitsiant olib chiqadi'], ['served', 'Yetkazildi (mijozga berildi)']] },
    { name: 'Reservation.status', desc: 'Bron holati', values: [['pending', 'Yaratildi (mijoz qildi)'], ['confirmed', 'Tasdiqlandi (admin)'], ['completed', 'Yopildi / tugadi'], ['cancelled', 'Bekor qilindi']] },
    { name: 'Ingredient.unit', desc: 'Ingredient o\'lchov birligi', values: [['kg', 'Kilogramm'], ['l', 'Litr']] },
    { name: 'RecipeItem.unit', desc: 'Retseptdagi o\'lchov (ombor birligiga avtomatik o\'giriladi)', values: [['kg', 'kg'], ['gr', 'gramm'], ['mg', 'milligramm'], ['l', 'litr'], ['ml', 'millilitr'], ['none', 'Ingredient birligida']] },
    { name: 'StockTransaction.type', desc: 'Ombor harakati', values: [['in', 'Kirim'], ['out', 'Chiqim (isrof yoki taom tayyorlash)']] },
  ];

  /* ---------- Javob namunalari ---------- */
  const M = {};
  M.restaurant = { id: 1, name: 'Nukus Grill', address: 'Nukus, Amir Temur 5', phone: '+998901112233', is_active: true, start_time: '09:00:00', end_time: '23:00:00' };
  M.me = { id: 2, phone_number: '+998901000001', first_name: 'Admin', last_name: 'Adminov', email: null, role: 'restaurant_admin', restaurant: { id: 1, name: 'Nukus Grill' } };
  M.admin = { id: 1, restaurant: 1, phone_number: '+998901000001', first_name: 'Admin', last_name: 'Adminov' };
  M.staff = { id: 1, restaurant: 1, role: 'waiter', is_active: true, phone_number: '+998901000002', first_name: 'Ofitsiant', last_name: 'Adminov' };
  M.table = { id: 1, restaurant: 1, number: 1, seats: 4, status: 'free' };
  M.category = { id: 1, restaurant: 1, name: 'Ichimliklar', order_index: '1' };
  M.dish = { id: 1, category: 1, name: 'Choy', price: '5000.00', is_available: true, description: null };
  M.dishDetail = { ...M.dish, recipe_items: [1] };
  M.menu = [{ ...M.category, dishes: [M.dish] }];
  M.ingredient = { restaurant: 1, id: 1, name: 'Choy bargi', current_stock: '5.000', unit: 'kg', min_stock: '2.000' };
  M.recipe = { id: 1, dish: 1, ingredient: 1, quantity_per_serving: '5.000', unit: 'gr' };
  M.stockTx = { id: 1, type: 'in', quantity: '5.000', reason: 'Kirim', created_at: '2026-10-08T10:00:00.000Z', ingredient: 1 };
  M.orderItem = { id: 1, order: 1, dish: 'Choy', dish_price: '5000.00', quantity: 2, status: 'new', note: null, total_price: '10000.00' };
  M.order = { id: 1, restaurant: 1, waiter: 3, waiter_name: 'Bobur Aliyev', table: 1, table_number: 1, status: 'open', payment_method: 'unset', created_at: '2026-10-09T10:00:00.000Z', closed_at: null, order_items: [M.orderItem], total_order_price: '10000.00' };
  M.kds = { id: 1, order: 1, table_number: '1', dish_name: 'Choy', quantity: 2, status: 'sent', waiter_name: 'Bobur Aliyev', waiting_time_minutes: 3 };
  M.reservation = { id: 1, restaurant: { id: 1, name: 'Nukus Grill' }, table: { id: 1, restaurant: 1, number: 1 }, client: { phone_number: '+998901000005', first_name: 'Aziz', last_name: 'Karimov' }, guests_count: 2, reservation_date: '2026-12-01', reservation_time: '18:00:00', duration_hours: '2.0', status: 'pending' };
  M.myReservation = { id: 1, restaurant: { id: 1, name: 'Nukus Grill' }, table: { id: 1, restaurant: 1, number: 1 }, guests_count: 2, reservation_date: '2026-12-01', reservation_time: '18:00:00', duration_hours: '2.0', status: 'pending' };
  const page = (item) => ({ count: 1, next: null, previous: null, results: [item] });

  /* ---------- Yordamchilar ---------- */
  const f = (name, type, required, desc, example) => ({ name, type, required, desc, example });
  const q = (name, desc, example, required = false) => ({ name, in: 'query', desc, example, required });
  const idp = (name, desc, example = 1) => ({ name, in: 'path', desc, example, required: true });
  const ANY = 'any';
  const ADM = ['restaurant_admin']; // superadmin restoran ichki ma'lumotlariga kira olmaydi
  const PLATFORM = ['superadmin', 'restaurant_admin']; // restoran kartochkasini o'zgartirish

  const GROUPS = [
    { key: 'auth', title: 'Kirish va ro\'yxatdan o\'tish', note: 'Token talab qilmaydi.' },
    { key: 'profile', title: 'Profil', note: 'Istalgan rol o\'z profilini shu yerdan oladi.' },
    { key: 'restaurants', title: 'Restoranlar' },
    { key: 'admins', title: 'Restoran adminlari', note: 'Faqat superadmin.' },
    { key: 'staff', title: 'Xodimlar' },
    { key: 'tables', title: 'Stollar' },
    { key: 'menu', title: 'Menyu, taom va retsept' },
    { key: 'stock', title: 'Ombor' },
    { key: 'orders', title: 'Buyurtmalar' },
    { key: 'kitchen', title: 'Oshxona (KDS)' },
    { key: 'reservations', title: 'Bronlar' },
  ];

  const E = (group, method, path, title, who, desc, o = {}) => ({
    group, method, path, title, who, desc, auth: o.auth !== false,
    params: o.params || [], body: o.body || [], status: o.status || 200,
    res: o.res, errors: o.errors || [], tip: o.tip,
    id: `${method} ${path}`,
  });

  const ENDPOINTS = [
    /* ================= AUTH ================= */
    E('auth', 'POST', '/api/auth/register', 'Mijoz sifatida ro\'yxatdan o\'tish', ANY,
      'Faqat mijoz (customer) o\'zi ro\'yxatdan o\'tadi. Admin va xodimlarni boshqalar yaratadi. Muvaffaqiyatdan keyin login qiling.',
      {
        auth: false, status: 201,
        body: [f('phone_number', 'string', true, 'Telefon, +998901234567 ko\'rinishida. Takrorlanmaydi.', '+998905550001'), f('password', 'string', true, 'Kamida 8 belgi', 'Password123'), f('first_name', 'string', false, 'Ism', 'Aziz'), f('last_name', 'string', false, 'Familiya', 'Karimov'), f('email', 'string', false, 'Email (ixtiyoriy)')],
        res: { ...M.me, role: 'customer', restaurant: null, phone_number: '+998905550001', first_name: 'Aziz', last_name: 'Karimov' },
        errors: [[400, 'Telefon band yoki parol qisqa: { "phone_number": ["Bu telefon raqami allaqachon ro\'yxatdan o\'tgan."] }']],
      }),
    E('auth', 'POST', '/api/auth/login', 'Kirish (access + refresh olish)', ANY,
      'Telefon va parol bilan kiriladi. Javobdagi ikkala tokenni saqlang. Keyingi so\'rovlarda access ni yuborasiz, refresh esa faqat access tugaganda kerak.',
      {
        auth: false,
        body: [f('phone_number', 'string', true, 'Telefon', '+998900000000'), f('password', 'string', true, 'Parol', 'Admin12345')],
        res: { access: 'eyJhbGciOiJIUzI1NiIs...', refresh: 'eyJhbGciOiJIUzI1NiIs...' },
        errors: [[401, 'Noto\'g\'ri telefon yoki parol: { "detail": "...", "code": "invalid_credentials" }']],
        tip: 'Sahifa tepasidagi "Kirish paneli" da yaratilgan akkauntlarga bir bosishda kirish mumkin.',
      }),
    E('auth', 'POST', '/api/auth/refresh', 'Access tokenni yangilash', ANY,
      'Access muddati tugaganda (401 + code: token_expired) chaqiriladi. Refresh token o\'zgarmaydi, faqat yangi access qaytadi.',
      {
        auth: false,
        body: [f('refresh', 'string', true, '/api/auth/login dan olingan refresh token', '<refresh token>')],
        res: { access: 'eyJhbGciOiJIUzI1NiIs...' },
        errors: [[401, 'Refresh muddati tugagan, yaroqsiz yoki logout qilingan: code = token_expired | token_invalid. Foydalanuvchini login sahifasiga qaytaring.']],
      }),
    E('auth', 'POST', '/api/auth/logout', 'Chiqish', ANY,
      'Refresh tokenni bekor qiladi (blacklist). Shundan keyin u bilan yangi access olib bo\'lmaydi. Frontendda ikkala tokenni ham o\'chirib tashlang.',
      {
        auth: false,
        body: [f('refresh', 'string', true, 'Bekor qilinadigan refresh token', '<refresh token>')],
        res: { detail: 'Chiqildi.' },
        tip: 'Access token stateless: logout dan keyin ham tabiiy muddati tugaguncha ishlaydi. Shuning uchun access qisqa (15 daqiqa).',
      }),

    /* ================= PROFIL ================= */
    E('profile', 'GET', '/api/users/me', 'Men kimman?', ANY,
      'Login dan keyin birinchi bo\'lib shuni chaqiring: rol va restoran shu yerdan bilinadi. Frontend qaysi sahifalarni ko\'rsatishni role ga qarab hal qiladi.',
      { res: M.me, tip: 'Admin va xodimlarda restoran = o\'z restorani. Superadmin va mijozda null.' }),
    E('profile', 'PATCH', '/api/users/me', 'Profilni tahrirlash', ANY, 'Faqat yuborilgan maydonlar o\'zgaradi.',
      { body: [f('first_name', 'string', false, 'Ism', 'Yangi ism'), f('last_name', 'string', false, 'Familiya'), f('phone_number', 'string', false, 'Telefon'), f('email', 'string', false, 'Email')], res: M.me }),
    E('profile', 'POST', '/api/users/me/change-password', 'Parolni almashtirish', ANY, 'Eski parol tekshiriladi.',
      { body: [f('old_password', 'string', true, 'Hozirgi parol'), f('new_password', 'string', true, 'Yangi parol (kamida 8 belgi)')], res: { detail: 'Parol o\'zgartirildi.' }, errors: [[400, '{ "old_password": ["Eski parol noto\'g\'ri."] }']] }),

    /* ================= RESTORANLAR ================= */
    E('restaurants', 'GET', '/api/restaurants', 'Restoranlar ro\'yxati', ANY, 'Sahifalangan ro\'yxat. Mijoz shu yerdan restoran tanlaydi.',
      { params: [q('search', 'Nom yoki manzil bo\'yicha qidirish', ''), q('is_active', 'true | false (faqat faol restoranlar uchun true)', ''), q('page', 'Sahifa raqami (1 dan)', 1)], res: page(M.restaurant) }),
    E('restaurants', 'POST', '/api/restaurants', 'Restoran yaratish', ['superadmin'], 'Yangi restoran. Keyin shu restoranga admin tayinlang (POST /api/admins).',
      { status: 201, body: [f('name', 'string', true, 'Nomi (≤100)', 'Nukus Grill'), f('address', 'string', true, 'Manzil (≤150)', 'Nukus, Amir Temur 5'), f('phone', 'string', true, 'Telefon (≤13)', '+998901112233'), f('start_time', 'time', true, 'Ochilish vaqti HH:MM', '09:00'), f('end_time', 'time', true, 'Yopilish vaqti HH:MM', '23:00'), f('is_active', 'boolean', false, 'Faolmi (boshlang\'ich: true)', true)], res: M.restaurant }),
    E('restaurants', 'GET', '/api/restaurants/{id}', 'Bitta restoran', ANY, 'Restoran ma\'lumotlari.', { params: [idp('id', 'Restoran id')], res: M.restaurant }),
    E('restaurants', 'PATCH', '/api/restaurants/{id}', 'Restoranni tahrirlash', PLATFORM, 'Restoran admini faqat o\'z restoranini tahrirlaydi.',
      { params: [idp('id', 'Restoran id')], body: [f('name', 'string', false, 'Nomi', 'Yangi nom'), f('address', 'string', false, 'Manzil'), f('phone', 'string', false, 'Telefon'), f('start_time', 'time', false, 'Ochilish'), f('end_time', 'time', false, 'Yopilish'), f('is_active', 'boolean', false, 'Faolmi')], res: M.restaurant }),
    E('restaurants', 'DELETE', '/api/restaurants/{id}', 'Restoranni o\'chirish', ['superadmin'], 'Restoran va unga tegishli hamma narsa (stol, menyu, ombor, buyurtma, bron, admin va xodimlar) o\'chadi.', { params: [idp('id', 'Restoran id')], status: 204 }),

    /* ================= ADMINLAR ================= */
    E('admins', 'GET', '/api/admins', 'Adminlar ro\'yxati', ['superadmin'], 'Barcha restoran adminlari.', { params: [q('page', 'Sahifa', 1)], res: page(M.admin) }),
    E('admins', 'POST', '/api/admins', 'Admin yaratish', ['superadmin'], 'Restoranga admin tayinlaydi. Yaratilgan admin shu telefon va parol bilan login qiladi.',
      { status: 201, body: [f('restaurant', 'integer', true, 'Restoran id', 1), f('phone_number', 'string', true, 'Telefon', '+998911110000'), f('first_name', 'string', true, 'Ism', 'Admin'), f('last_name', 'string', true, 'Familiya', 'Adminov'), f('password', 'string', true, 'Parol (≥8)', 'Password123')], res: M.admin }),
    E('admins', 'GET', '/api/admins/{id}', 'Bitta admin', ['superadmin'], '', { params: [idp('id', 'Admin id')], res: M.admin }),
    E('admins', 'PATCH', '/api/admins/{id}', 'Adminni tahrirlash', ['superadmin'], 'Yuborilgan maydonlargina o\'zgaradi (parol ham).', { params: [idp('id', 'Admin id')], body: [f('first_name', 'string', false, 'Ism', 'Yangi'), f('restaurant', 'integer', false, 'Boshqa restoranga ko\'chirish'), f('password', 'string', false, 'Yangi parol')], res: M.admin }),
    E('admins', 'DELETE', '/api/admins/{id}', 'Adminni o\'chirish', ['superadmin'], 'Admin va uning login akkaunti o\'chadi.', { params: [idp('id', 'Admin id')], status: 204 }),
    E('admins', 'POST', '/api/users/reset-password', 'Foydalanuvchi parolini tiklash', ['superadmin'], 'Parolini unutgan istalgan foydalanuvchiga (mijoz, admin, xodim) yangi parol o\'rnatadi. Telefon bo\'yicha topiladi.',
      { body: [f('phone_number', 'string', true, 'Foydalanuvchi telefoni', '+998901000005'), f('new_password', 'string', true, 'Yangi parol (≥8 belgi)', 'Password123')], res: { detail: 'Parol tiklandi.', role: 'customer' }, errors: [[404, 'Bunday telefonli foydalanuvchi topilmadi.']], tip: 'Mavjud tokenlar muddati tugaguncha ishlayveradi; foydalanuvchi yangi parol bilan qayta kirishi kerak.' }),

    /* ================= XODIMLAR ================= */
    E('staff', 'GET', '/api/restaurants/{id}/staff', 'Xodimlar ro\'yxati', ADM, 'Restoran xodimlari: ofitsiant, oshpaz, omborchi.', { params: [idp('id', 'Restoran id'), q('page', 'Sahifa', 1)], res: page(M.staff) }),
    E('staff', 'POST', '/api/restaurants/{id}/staff', 'Xodim qo\'shish', ADM, 'Xodim roli uning User.role qiymati bilan bir xil bo\'ladi.',
      { status: 201, params: [idp('id', 'Restoran id')], body: [f('role', 'string', true, 'waiter | cook | storekeeper', 'waiter'), f('phone_number', 'string', true, 'Telefon', '+998922220001'), f('first_name', 'string', true, 'Ism', 'Bobur'), f('last_name', 'string', true, 'Familiya', 'Aliyev'), f('password', 'string', true, 'Parol (≥8)', 'Password123'), f('is_active', 'boolean', false, 'Ishlayaptimi', true)], res: M.staff }),
    E('staff', 'GET', '/api/staff/{id}', 'Bitta xodim', ADM, '', { params: [idp('id', 'Xodim id')], res: M.staff }),
    E('staff', 'PATCH', '/api/staff/{id}', 'Xodimni tahrirlash', ADM, 'Ishdan bo\'shatish uchun is_active: false yuboring: xodim endi kira olmaydi, lekin tarix saqlanadi.',
      { params: [idp('id', 'Xodim id')], body: [f('is_active', 'boolean', false, 'Faolmi', false), f('role', 'string', false, 'waiter | cook | storekeeper'), f('first_name', 'string', false, 'Ism'), f('password', 'string', false, 'Yangi parol')], res: { ...M.staff, is_active: false } }),
    E('staff', 'DELETE', '/api/staff/{id}', 'Xodimni o\'chirish', ADM, '', { params: [idp('id', 'Xodim id')], status: 204 }),

    /* ================= STOLLAR ================= */
    E('tables', 'GET', '/api/restaurants/{id}/tables', 'Stollar ro\'yxati', ANY, 'Ofitsiantning "stollar xaritasi" shu yerdan chiziladi: status free / occupied.', { params: [idp('id', 'Restoran id'), q('page', 'Sahifa', 1)], res: page(M.table) }),
    E('tables', 'POST', '/api/restaurants/{id}/tables', 'Stol qo\'shish', ADM, 'number berilmasa, keyingi bo\'sh raqam o\'zi beriladi. Bir restoranda raqam takrorlanmaydi.',
      { status: 201, params: [idp('id', 'Restoran id')], body: [f('seats', 'integer', true, 'O\'rin soni', 4), f('number', 'integer', false, 'Stol raqami (ixtiyoriy)')], res: M.table }),
    E('tables', 'GET', '/api/tables/{id}', 'Bitta stol', ANY, '', { params: [idp('id', 'Stol id')], res: M.table }),
    E('tables', 'PATCH', '/api/tables/{id}', 'Stolni tahrirlash', ADM, '', { params: [idp('id', 'Stol id')], body: [f('seats', 'integer', false, 'O\'rin soni', 6), f('number', 'integer', false, 'Raqam')], res: { ...M.table, seats: 6 } }),
    E('tables', 'DELETE', '/api/tables/{id}', 'Stolni o\'chirish', ADM, 'Stolning bronlari o\'chadi; buyurtmalari saqlanadi (stolsiz qoladi).', { params: [idp('id', 'Stol id')], status: 204 }),

    /* ================= MENYU ================= */
    E('menu', 'GET', '/api/restaurants/{id}/menu', 'To\'liq menyu (bitta so\'rovda)', ANY, 'Kategoriyalar ichida taomlar. Mijoz va ofitsiantning menyu sahifasi uchun eng qulayi.', { params: [idp('id', 'Restoran id')], res: M.menu, tip: 'is_available: false bo\'lgan taomni "tugagan" deb ko\'rsating, uni buyurtmaga qo\'shib bo\'lmaydi.' }),
    E('menu', 'GET', '/api/restaurants/{id}/categories', 'Kategoriyalar', ANY, 'order_index bo\'yicha tartiblangan.', { params: [idp('id', 'Restoran id'), q('page', 'Sahifa', 1)], res: page(M.category) }),
    E('menu', 'POST', '/api/restaurants/{id}/categories', 'Kategoriya qo\'shish', ADM, '', { status: 201, params: [idp('id', 'Restoran id')], body: [f('name', 'string', true, 'Nomi (≤50)', 'Ichimliklar'), f('order_index', 'string', true, 'Tartib raqami (≤3 belgi)', '1')], res: M.category }),
    E('menu', 'GET', '/api/categories/{id}', 'Bitta kategoriya', ANY, '', { params: [idp('id', 'Kategoriya id')], res: M.category }),
    E('menu', 'PATCH', '/api/categories/{id}', 'Kategoriyani tahrirlash', ADM, '', { params: [idp('id', 'Kategoriya id')], body: [f('name', 'string', false, 'Nomi', 'Issiq ichimliklar'), f('order_index', 'string', false, 'Tartib')], res: { ...M.category, name: 'Issiq ichimliklar' } }),
    E('menu', 'DELETE', '/api/categories/{id}', 'Kategoriyani o\'chirish', ADM, 'Ichidagi taomlar ham o\'chadi.', { params: [idp('id', 'Kategoriya id')], status: 204 }),
    E('menu', 'GET', '/api/categories/{id}/dishes', 'Kategoriya taomlari', ANY, '', { params: [idp('id', 'Kategoriya id'), q('page', 'Sahifa', 1)], res: page(M.dish) }),
    E('menu', 'POST', '/api/categories/{id}/dishes', 'Taom qo\'shish', ADM, 'price — verguldan keyin 2 tagacha raqam.',
      { status: 201, params: [idp('id', 'Kategoriya id')], body: [f('name', 'string', true, 'Nomi (≤80)', 'Choy'), f('price', 'decimal', true, 'Narxi', '5000.00'), f('description', 'string', false, 'Tarifi'), f('is_available', 'boolean', false, 'Mavjudmi (boshlang\'ich: true)', true)], res: M.dish, errors: [[400, '{ "price": ["Verguldan keyin ko\'pi bilan 2 ta raqam bo\'lishi mumkin."] }']] }),
    E('menu', 'GET', '/api/dishes/{id}', 'Taom tafsiloti', ANY, 'recipe_items — retsept qatorlari id lari.', { params: [idp('id', 'Taom id')], res: M.dishDetail }),
    E('menu', 'PATCH', '/api/dishes/{id}', 'Taomni tahrirlash', ADM, '', { params: [idp('id', 'Taom id')], body: [f('name', 'string', false, 'Nomi'), f('price', 'decimal', false, 'Narxi', '6000.00'), f('description', 'string', false, 'Tarifi')], res: { ...M.dishDetail, price: '6000.00' } }),
    E('menu', 'DELETE', '/api/dishes/{id}', 'Taomni o\'chirish', ADM, 'Eski buyurtmalarda nomi va narxi saqlanib qoladi.', { params: [idp('id', 'Taom id')], status: 204 }),
    E('menu', 'PATCH', '/api/dishes/{id}/toggle-availability', 'Stop-list (mavjud / tugagan)', ['restaurant_admin', 'cook'], 'Body yubormasangiz qiymat teskarisiga o\'zgaradi. Oshpaz mahsulot tugaganda ishlatadi.',
      { params: [idp('id', 'Taom id')], body: [f('is_available', 'boolean', false, 'Aniq qiymat (ixtiyoriy)')], res: { ...M.dishDetail, is_available: false } }),
    E('menu', 'GET', '/api/dishes/{id}/recipe-items', 'Taom retsepti', ['restaurant_admin', 'waiter', 'cook', 'storekeeper'], '1 porsiya uchun qancha ingredient ketadi.', { params: [idp('id', 'Taom id')], res: [M.recipe] }),
    E('menu', 'POST', '/api/dishes/{id}/recipe-items', 'Retseptga ingredient qo\'shish', ADM, 'Taom "tayyorlanmoqda" bo\'lganda ombordan shu miqdor × soni avtomatik yechiladi. gr/ml kabi birliklar kg/l ga o\'zi o\'giriladi.',
      { status: 201, params: [idp('id', 'Taom id')], body: [f('ingredient', 'integer', false, 'Ingredient id (shu restorandan)', 1), f('quantity_per_serving', 'decimal', true, '1 porsiyaga miqdor', '5'), f('unit', 'string', false, 'kg | gr | mg | l | ml | none', 'gr')], res: M.recipe }),
    E('menu', 'PATCH', '/api/recipe-items/{id}', 'Retsept qatorini tahrirlash', ADM, '', { params: [idp('id', 'Retsept qatori id')], body: [f('quantity_per_serving', 'decimal', false, 'Miqdor', '7'), f('unit', 'string', false, 'kg | gr | mg | l | ml | none')], res: { ...M.recipe, quantity_per_serving: '7.000' } }),
    E('menu', 'DELETE', '/api/recipe-items/{id}', 'Retsept qatorini o\'chirish', ADM, '', { params: [idp('id', 'Retsept qatori id')], status: 204 }),

    /* ================= OMBOR ================= */
    E('stock', 'GET', '/api/restaurants/{id}/ingredients', 'Ingredientlar', ['restaurant_admin', 'storekeeper', 'cook'], 'Ombordagi ingredientlar va qoldiqlari.', { params: [idp('id', 'Restoran id'), q('page', 'Sahifa', 1)], res: page(M.ingredient) }),
    E('stock', 'POST', '/api/restaurants/{id}/ingredients', 'Ingredient qo\'shish', ['restaurant_admin', 'storekeeper'], 'current_stock berilsa, u boshlang\'ich qoldiq sifatida tarixga yoziladi.',
      { status: 201, params: [idp('id', 'Restoran id')], body: [f('name', 'string', true, 'Nomi', 'Choy bargi'), f('unit', 'string', true, 'kg | l', 'kg'), f('current_stock', 'decimal', false, 'Boshlang\'ich qoldiq', '5'), f('min_stock', 'decimal', false, 'Minimal qoldiq (ogohlantirish uchun, 0 — o\'chiq)', '2')], res: M.ingredient }),
    E('stock', 'GET', '/api/ingredients/{id}', 'Bitta ingredient', ['restaurant_admin', 'storekeeper', 'cook'], '', { params: [idp('id', 'Ingredient id')], res: M.ingredient }),
    E('stock', 'PATCH', '/api/ingredients/{id}', 'Ingredientni tahrirlash', ['restaurant_admin', 'storekeeper'], 'Nom, birlik va minimal qoldiq. Qoldiq stock-in / stock-out orqali o\'zgaradi, shunda tarix to\'g\'ri saqlanadi.', { params: [idp('id', 'Ingredient id')], body: [f('name', 'string', false, 'Nomi', 'Qora choy'), f('unit', 'string', false, 'kg | l'), f('min_stock', 'decimal', false, 'Minimal qoldiq', '3')], res: { ...M.ingredient, name: 'Qora choy' } }),
    E('stock', 'DELETE', '/api/ingredients/{id}', 'Ingredientni o\'chirish', ['restaurant_admin', 'storekeeper'], 'Retseptlarda bu ingredient bo\'sh qoladi.', { params: [idp('id', 'Ingredient id')], status: 204 }),
    E('stock', 'PATCH', '/api/ingredients/{id}/stock-in', 'Omborga kirim', ['restaurant_admin', 'storekeeper'], 'Mahsulot kelganda qoldiqni oshiradi va tarixga "in" yozadi.',
      { params: [idp('id', 'Ingredient id')], body: [f('quantity', 'decimal', true, 'Miqdor (> 0)', '2'), f('reason', 'string', false, 'Izoh', 'Yangi partiya')], res: { ...M.ingredient, current_stock: '7.000' } }),
    E('stock', 'PATCH', '/api/ingredients/{id}/stock-out', 'Isrof / hisobdan chiqarish', ['restaurant_admin', 'storekeeper'], 'Buzilgan yoki yo\'qolgan mahsulotni chiqim qiladi. Sabab (reason) majburiy. Qoldiqdan ko\'p chiqarib bo\'lmaydi.',
      { params: [idp('id', 'Ingredient id')], body: [f('quantity', 'decimal', true, 'Miqdor (> 0)', '0.5'), f('reason', 'string', true, 'Sabab', 'Muddati o\'tgan')], res: { ...M.ingredient, current_stock: '4.500' }, errors: [[400, '{ "quantity": ["Omborda buncha mahsulot yo\'q."] }']] }),
    E('stock', 'GET', '/api/restaurants/{id}/stock-transactions', 'Kirim-chiqim tarixi', ['restaurant_admin', 'storekeeper'], 'Yangilari birinchi. Taom tayyorlanganda avtomatik "out" yozuvlar ham shu yerda.', { params: [idp('id', 'Restoran id'), q('page', 'Sahifa', 1)], res: page(M.stockTx) }),

    /* ================= BUYURTMALAR ================= */
    E('orders', 'GET', '/api/restaurants/{id}/orders', 'Buyurtmalar ro\'yxati', ['restaurant_admin', 'waiter', 'cook'], 'Yangilari birinchi; ichida taomlar va umumiy summa bor.',
      { params: [idp('id', 'Restoran id'), q('status', 'open | closed (open — ochiq, closed — yopilgan)', ''), q('table', 'Stol id', ''), q('mine', 'true | false (true — faqat o\'zim ochgan buyurtmalar)', ''), q('page', 'Sahifa', 1)], res: page(M.order) }),
    E('orders', 'POST', '/api/restaurants/{id}/orders', 'Buyurtma ochish', ['restaurant_admin', 'waiter'], 'Ofitsiant stolni tanlab buyurtma ochadi. Stol avtomatik "occupied" bo\'ladi. Ofitsiant (waiter) tokendan olinadi.',
      { status: 201, params: [idp('id', 'Restoran id')], body: [f('table', 'integer', false, 'Stol id', 1), f('payment_method', 'string', false, 'cash | card (keyin ham o\'zgartirish mumkin)')], res: { ...M.order, order_items: [], total_order_price: '0.00' } }),
    E('orders', 'GET', '/api/orders/{id}', 'Buyurtma tafsiloti', ['restaurant_admin', 'waiter', 'cook'], 'Taomlar, har birining statusi va jami summa.', { params: [idp('id', 'Buyurtma id')], res: M.order }),
    E('orders', 'PATCH', '/api/orders/{id}', 'Buyurtmani o\'zgartirish', ['restaurant_admin', 'waiter'], 'Stolni almashtirish yoki to\'lov turini belgilash. Eski va yangi stol holati o\'zi yangilanadi.', { params: [idp('id', 'Buyurtma id')], body: [f('table', 'integer', false, 'Yangi stol id'), f('payment_method', 'string', false, 'cash | card', 'card')], res: { ...M.order, payment_method: 'card' } }),
    E('orders', 'DELETE', '/api/orders/{id}', 'Buyurtmani o\'chirish', ['restaurant_admin', 'waiter'], 'Taomlari bilan birga o\'chadi, stol bo\'shaydi.', { params: [idp('id', 'Buyurtma id')], status: 204 }),
    E('orders', 'PATCH', '/api/orders/{id}/status', 'Buyurtmani yopish', ['restaurant_admin', 'waiter'], 'Mijoz to\'lagach status = closed. Stol boshqa ochiq buyurtmasi bo\'lmasa "free" bo\'ladi.', { params: [idp('id', 'Buyurtma id')], body: [f('status', 'string', true, 'open | closed', 'closed')], res: { status: 'closed' } }),
    E('orders', 'POST', '/api/orders/{id}/items', 'Buyurtmaga taom qo\'shish', ['restaurant_admin', 'waiter'], 'Boshlang\'ich status new (yangi). Taom nomi va narxi shu paytdagidek saqlanadi. Tugagan (is_available=false) taomni qo\'shib bo\'lmaydi.',
      { status: 201, params: [idp('id', 'Buyurtma id')], body: [f('dish', 'integer', true, 'Taom id', 1), f('quantity', 'integer', true, 'Soni (≥1)', 2), f('note', 'string', false, 'Izoh oshpazga', 'Shakarsiz')], res: { id: 1, order: 1, dish: 1, quantity: 2, status: 'new', note: 'Shakarsiz' }, errors: [[400, '{ "dish": ["Bu taom hozir mavjud emas (stop-list)."] }']] }),
    E('orders', 'POST', '/api/orders/{id}/send-to-kitchen', 'Oshxonaga yuborish', ['restaurant_admin', 'waiter'], 'Buyurtmadagi hamma yangi (new) taomlar sent ga o\'tadi va oshpaz ekranida paydo bo\'ladi. Yangi taom bo\'lmasa 400.', { params: [idp('id', 'Buyurtma id')], res: { detail: 'Oshxonaga jiberildi.', sent_items: 2 } }),
    E('orders', 'PATCH', '/api/order-items/{id}/quantity', 'Taom sonini oshirish', ['restaurant_admin', 'waiter'], 'quantity_add ga qo\'shadi (almashtirmaydi). Faqat hali oshxonaga yuborilmagan (new) taomga.', { params: [idp('id', 'Buyurtma elementi id')], body: [f('quantity_add', 'integer', true, 'Qo\'shiladigan son (≥1)', 1)], res: { id: 1, order: 1, dish: 1 } }),
    E('orders', 'PATCH', '/api/order-items/{id}/serve', 'Taom yetkazildi', ['restaurant_admin', 'waiter'], 'Oshpaz tayyor (ready) qilgan taomni mijozga olib chiqqach shu orqali served qilinadi. Boshqa holatdagi taomga 400.', { params: [idp('id', 'Buyurtma elementi id')], res: { ...M.orderItem, status: 'served' }, errors: [[400, 'Taom hali tayyor emas.']] }),
    E('orders', 'DELETE', '/api/order-items/{id}', 'Taomni buyurtmadan olib tashlash', ['restaurant_admin', 'waiter'], '', { params: [idp('id', 'Buyurtma elementi id')], status: 204 }),

    /* ================= OSHXONA ================= */
    E('kitchen', 'GET', '/api/kitchen/items', 'Oshxona navbati', ['restaurant_admin', 'cook'], 'Faqat oshxonaga yuborilgan, hali tayyor bo\'lmagan taomlar (sent, cooking). Eng eskisi birinchi. Ekranni har 5–10 soniyada yangilab turing.', { params: [q('page', 'Sahifa', 1)], res: page(M.kds), tip: 'Restoran tokendan aniqlanadi — id yuborilmaydi.' }),
    E('kitchen', 'PATCH', '/api/kitchen/items/{id}/status', 'Taom statusini o\'zgartirish', ['restaurant_admin', 'cook'], 'Faqat oldinga: sent → cooking → ready. cooking ga o\'tganda retsept bo\'yicha ombordan ingredient yechiladi; yetmasa 400.',
      { params: [idp('id', 'Buyurtma elementi id')], body: [f('status', 'string', true, 'cooking | ready', 'cooking')], res: { ...M.kds, status: 'cooking' }, errors: [[400, 'Omborda ingredient yetarli emas yoki status orqaga qaytmoqda: { "detail": "Omborda \\"Choy bargi\\" yetarli emas." }']] }),

    /* ================= BRONLAR ================= */
    E('reservations', 'GET', '/api/restaurants/{id}/available-tables', 'Bo\'sh stollarni topish', ['customer'], 'Bron formasidan oldin chaqiring: shu sana va vaqtda band bo\'lmagan, mehmonlar soniga yetarli stollar qaytadi.',
      { params: [idp('id', 'Restoran id'), q('reservation_date', 'Sana YYYY-MM-DD', '', true), q('reservation_time', 'Vaqt HH:MM', '18:00', true), q('duration_hours', 'Necha soat (boshlang\'ich 1)', '2'), q('guests', 'Mehmonlar soni', 3)], res: [M.table], errors: [[400, 'Restoran ish vaqtidan tashqari yoki o\'tgan vaqt.']] }),
    E('reservations', 'POST', '/api/restaurants/{id}/reservations', 'Bron qilish', ['customer'], 'Stol sig\'imi, restoran ish vaqti va boshqa bronlar bilan kesishuv tekshiriladi. Bron "pending" holatida boshlanadi, admin tasdiqlaydi.',
      { status: 201, params: [idp('id', 'Restoran id')], body: [f('table', 'integer', true, 'Stol id', 1), f('reservation_date', 'date', true, 'Sana YYYY-MM-DD', ''), f('reservation_time', 'time', true, 'Vaqt HH:MM', '18:00'), f('guests_count', 'integer', false, 'Mehmonlar soni', 3), f('duration_hours', 'decimal', false, 'Soat (boshlang\'ich 1, min 0.5)', '2')], res: M.reservation, errors: [[400, '{ "reservation_time": ["Bu stol ko\'rsatilgan vaqtda band."] }']] }),
    E('reservations', 'GET', '/api/reservations/my', 'Mening bronlarim', ['customer'], 'Mijozning o\'z bronlari.', { params: [q('page', 'Sahifa', 1)], res: page(M.myReservation) }),
    E('reservations', 'PATCH', '/api/reservations/{id}/cancel', 'Bronni bekor qilish', ['customer'], 'Faqat o\'z broni. Yopilgan (completed) bronni bekor qilib bo\'lmaydi.', { params: [idp('id', 'Bron id')], res: { ...M.myReservation, status: 'cancelled' } }),
    E('reservations', 'GET', '/api/reservations', 'Bronlar ro\'yxati (admin, ofitsiant)', ['restaurant_admin', 'waiter'], 'Admin va ofitsiant o\'z restoranining bronlarini ko\'radi (ofitsiant faqat o\'qiydi; statusni faqat admin o\'zgartiradi).', { params: [q('status', 'pending | confirmed | completed | cancelled', ''), q('date', 'Sana YYYY-MM-DD', ''), q('page', 'Sahifa', 1)], res: page(M.reservation) }),
    E('reservations', 'PATCH', '/api/reservations/{id}/status', 'Bron statusini o\'zgartirish', ['restaurant_admin'], 'Tasdiqlash, yopish yoki bekor qilish.', { params: [idp('id', 'Bron id')], body: [f('status', 'string', true, 'pending | confirmed | completed | cancelled', 'confirmed')], res: { ...M.reservation, status: 'confirmed' } }),
  ];

  /* ---------- Ssenariylar: "nima qilish kerak" yo'l xaritasi ---------- */
  const FLOWS = [
    {
      title: 'Sozlash va birinchi ishga tushirish', role: 'superadmin',
      intro: 'Loyiha ishga tushgach, tizim bo\'sh. Birinchi superadmin terminaldan yaratiladi, qolganini API orqali qilasiz.',
      steps: [
        ['Terminal', 'Server birinchi ishga tushganda bazada superadmin (`.env` dagi `SUPERADMIN_*`) va har bir rol uchun bittadan tayyor akkaunt bo\'ladi. Yangi restoran, admin, xodim va menyuni esa haqiqiy bazada API orqali o\'zingiz yaratasiz.'],
        ['POST /api/auth/login', 'Superadmin sifatida kiring, access va refresh ni saqlang.'],
        ['POST /api/restaurants', 'Restoran yarating.'],
        ['POST /api/admins', 'Restoranga admin tayinlang. Endi admin o\'zi davom ettiradi: "Restoranni tayyorlash" ssenariysiga o\'ting.'],
      ],
    },
    {
      title: 'Restoranni tayyorlash', role: 'restaurant_admin',
      intro: 'Admin birinchi marta kirgach restoranni ishga tayyorlaydi. Tartib muhim: oldin ingredient, keyin retsept.',
      steps: [
        ['GET /api/users/me', 'Rol va restoran id sini oling.'],
        ['POST /api/restaurants/{id}/tables', 'Stollarni qo\'shing.'],
        ['POST /api/restaurants/{id}/categories', 'Kategoriyalar: Ichimliklar, Asosiy taomlar...'],
        ['POST /api/categories/{id}/dishes', 'Har kategoriyaga taomlar.'],
        ['POST /api/restaurants/{id}/ingredients', 'Ingredientlar va boshlang\'ich qoldiq.'],
        ['POST /api/dishes/{id}/recipe-items', 'Taomga retsept: 1 porsiyaga nima va qancha ketadi.'],
        ['POST /api/restaurants/{id}/staff', 'Ofitsiant, oshpaz, omborchini qo\'shing.'],
      ],
    },
    {
      title: 'Ofitsiant: buyurtma olish', role: 'waiter',
      intro: 'Eng ko\'p ishlatiladigan oqim. Stol → buyurtma → taomlar → oshxona → hisob. Oldindan shart: admin stol va menyuni yaratgan bo\'lishi kerak ("Restoranni tayyorlash" ssenariysi).',
      steps: [
        ['GET /api/restaurants/{id}/tables', 'Stollar xaritasi: free / occupied.'],
        ['POST /api/restaurants/{id}/orders', 'Stolni tanlab buyurtma oching (stol "occupied" bo\'ladi).'],
        ['GET /api/restaurants/{id}/menu', 'Menyuni ko\'rsating.'],
        ['POST /api/orders/{id}/items', 'Mijoz tanlagan taomlarni qo\'shing (har biri status new).'],
        ['PATCH /api/order-items/{id}/quantity', 'Ixtiyoriy: sonni oshirish.'],
        ['POST /api/orders/{id}/send-to-kitchen', 'Oshxonaga yuboring (new → sent).'],
        ['GET /api/orders/{id}', 'Taomlar holatini kuzating (ready = tayyor, olib chiqish mumkin).'],
        ['PATCH /api/orders/{id}/status', 'To\'lov olingach closed qiling; stol bo\'shaydi.'],
      ],
    },
    {
      title: 'Oshpaz: oshxona ekrani', role: 'cook',
      intro: 'Ekran navbatni muntazam so\'rab turadi va oshpaz taomni bosqichma-bosqich o\'tkazadi. Navbat bo\'sh bo\'lsa, avval ofitsiant buyurtmani oshxonaga yuborishi kerak.',
      steps: [
        ['GET /api/kitchen/items', 'Navbat (har 5–10 soniyada yangilang).'],
        ['PATCH /api/kitchen/items/{id}/status', 'status: cooking — tayyorlash boshlandi (ombordan yechiladi).'],
        ['PATCH /api/kitchen/items/{id}/status', 'status: ready — tayyor, ofitsiantga ko\'rinadi.'],
        ['PATCH /api/dishes/{id}/toggle-availability', 'Mahsulot tugasa — stop-listga qo\'ying.'],
      ],
    },
    {
      title: 'Omborchi: ombor yuritish', role: 'storekeeper',
      intro: 'Qoldiq faqat kirim/isrof orqali o\'zgaradi, taom tayyorlanganda esa o\'zi kamayadi. Ingredient bo\'lmasa, avval "Restoranni tayyorlash" ssenariysida yaratiladi.',
      steps: [
        ['GET /api/restaurants/{id}/ingredients', 'Qoldiqlar.'],
        ['PATCH /api/ingredients/{id}/stock-in', 'Mahsulot kelganda kirim.'],
        ['PATCH /api/ingredients/{id}/stock-out', 'Buzilganini sabab bilan hisobdan chiqarish.'],
        ['GET /api/restaurants/{id}/stock-transactions', 'Kirim-chiqim tarixi.'],
      ],
    },
    {
      title: 'Mijoz: stol bron qilish', role: 'customer',
      intro: 'Mijoz ilovasining to\'liq yo\'li. Eng muhim qadam — bron qilishdan oldin bo\'sh stolni topish. Stol bo\'lmasa, avval admin stol yaratishi kerak.',
      steps: [
        ['POST /api/auth/register', 'Ro\'yxatdan o\'tish, keyin POST /api/auth/login.'],
        ['GET /api/restaurants', 'Restoran tanlash.'],
        ['GET /api/restaurants/{id}/menu', 'Menyuni ko\'rish (ixtiyoriy).'],
        ['GET /api/restaurants/{id}/available-tables', 'Sana, vaqt va mehmonlar soni bo\'yicha bo\'sh stollar.'],
        ['POST /api/restaurants/{id}/reservations', 'Stolni bron qilish.'],
        ['GET /api/reservations/my', 'Mening bronlarim.'],
        ['PATCH /api/reservations/{id}/cancel', 'Kerak bo\'lsa bekor qilish.'],
      ],
    },
    {
      title: 'Admin: bronlarni boshqarish', role: 'restaurant_admin',
      intro: 'Mijoz bron qilgach admin ko\'rib chiqadi.',
      steps: [
        ['GET /api/reservations', 'status=pending bilan yangi bronlarni oling.'],
        ['PATCH /api/reservations/{id}/status', 'confirmed yoki cancelled qiling; mijoz o\'z ro\'yxatida ko\'radi.'],
      ],
    },
  ];

  window.DOCS = { ROLES, COMMON, ENUMS, ENDPOINTS, FLOWS, GROUPS };
})();

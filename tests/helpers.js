// Test yordamchilari: vaqtinchalik MongoDB + haqiqiy Express ilova + so'rov funksiyasi + tayyor "dunyo".
const { MongoMemoryServer } = require('mongodb-memory-server');

const SUPER = { phone: '+998900000000', password: 'Admin12345' };

async function startServer(env = {}) {
  const mongod = await MongoMemoryServer.create();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MONGO_URI: mongod.getUri('resto_test'),
    SUPERADMIN_PHONE: SUPER.phone,
    SUPERADMIN_PASSWORD: SUPER.password,
    INITIAL_DATA: 'false',
  }, env);

  const mongoose = require('mongoose');
  await require('../src/config/db')();
  const models = require('../src/models');
  await Promise.all(Object.values(models).map((m) => m.init())); // unique indekslar tayyor bo'lsin
  await require('../src/services/bootstrap').ensureSuperadmin();

  const app = require('../src/app');
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { body, token, headers = {}, rawBody } = {}) {
    const hasBody = body !== undefined || rawBody !== undefined;
    const res = await fetch(base + url, {
      method,
      headers: { ...(hasBody ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* matn */ }
    return { status: res.status, body: data, headers: res.headers };
  }

  const stop = async () => { server.close(); await mongoose.disconnect(); await mongod.stop(); };
  return { call, base, stop, models, mongoose };
}

const login = async (call, phone, password) => {
  const r = await call('POST', '/api/auth/login', { body: { phone_number: phone, password } });
  if (r.status !== 200) throw new Error(`login ${phone} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

const must = (res, status, label = '') => {
  if (res.status !== status) throw new Error(`${label} kutilgan ${status}, kelgan ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
};

// Kelajakdagi sana (bronlar uchun): bugundan +days kun
const futureDate = (days = 5) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* Tayyor "dunyo": 2 ta restoran (R1 to'liq, R2 izolyatsiya uchun), har bir rol uchun akkaunt.
   Id lar tartibi muhim: R1 resurslari id=1 bo'ladi (ruxsatlar testi shunga tayanadi). */
async function buildWorld(srv) {
  const { call } = srv;
  const T = {}; // tokenlar
  T.superadmin = (await login(call, SUPER.phone, SUPER.password)).access;
  const su = (method, url, body) => call(method, url, { body, token: T.superadmin });

  const R1 = must(await su('POST', '/api/restaurants', { name: 'Nukus Grill', address: 'Nukus', phone: '+998901112233', start_time: '09:00', end_time: '23:00' }), 201, 'R1');
  const admin1 = must(await su('POST', '/api/admins', { restaurant: R1.id, phone_number: '+998911000001', first_name: 'Admin', last_name: 'Birinchi', password: 'Password123' }), 201, 'admin1');
  T.restaurant_admin = (await login(call, '+998911000001', 'Password123')).access;

  const mkStaff = async (role, phone) => must(await call('POST', `/api/restaurants/${R1.id}/staff`, {
    token: T.restaurant_admin, body: { role, phone_number: phone, first_name: role, last_name: 'Xodim', password: 'Password123' },
  }), 201, `staff ${role}`);
  const waiter = await mkStaff('waiter', '+998911000002');
  const cook = await mkStaff('cook', '+998911000003');
  const storekeeper = await mkStaff('storekeeper', '+998911000004');
  T.waiter = (await login(call, '+998911000002', 'Password123')).access;
  T.cook = (await login(call, '+998911000003', 'Password123')).access;
  T.storekeeper = (await login(call, '+998911000004', 'Password123')).access;

  must(await call('POST', '/api/auth/register', { body: { phone_number: '+998911000005', first_name: 'Mijoz', last_name: 'Bir', password: 'Password123' } }), 201, 'customer');
  T.customer = (await login(call, '+998911000005', 'Password123')).access;

  // R1 resurslari (id=1 lar)
  const a = (method, url, body) => call(method, url, { body, token: T.restaurant_admin });
  const table1 = must(await a('POST', `/api/restaurants/${R1.id}/tables`, { seats: 4 }), 201, 'table1');
  const table2 = must(await a('POST', `/api/restaurants/${R1.id}/tables`, { seats: 2 }), 201, 'table2');
  const category = must(await a('POST', `/api/restaurants/${R1.id}/categories`, { name: 'Ichimliklar', order_index: '1' }), 201, 'category');
  const dish = must(await a('POST', `/api/categories/${category.id}/dishes`, { name: 'Choy', price: '5000.00' }), 201, 'dish');
  const ingredient = must(await call('POST', `/api/restaurants/${R1.id}/ingredients`, { token: T.storekeeper, body: { name: 'Choy bargi', unit: 'kg', current_stock: '5' } }), 201, 'ingredient');
  const recipe = must(await a('POST', `/api/dishes/${dish.id}/recipe-items`, { ingredient: ingredient.id, quantity_per_serving: '5', unit: 'gr' }), 201, 'recipe');
  const order = must(await call('POST', `/api/restaurants/${R1.id}/orders`, { token: T.waiter, body: { table: table1.id } }), 201, 'order');
  const item = must(await call('POST', `/api/orders/${order.id}/items`, { token: T.waiter, body: { dish: dish.id, quantity: 2 } }), 201, 'item');
  const reservation = must(await call('POST', `/api/restaurants/${R1.id}/reservations`, {
    token: T.customer, body: { table: table2.id, guests_count: 2, reservation_date: futureDate(7), reservation_time: '18:00', duration_hours: '1' },
  }), 201, 'reservation');

  // R2: izolyatsiyani tekshirish uchun alohida restoran + admin
  const R2 = must(await su('POST', '/api/restaurants', { name: 'Boshqa restoran', address: 'Xiva', phone: '+998901112244', start_time: '09:00', end_time: '23:00' }), 201, 'R2');
  must(await su('POST', '/api/admins', { restaurant: R2.id, phone_number: '+998911000006', first_name: 'Admin', last_name: 'Ikkinchi', password: 'Password123' }), 201, 'admin2');
  T.admin2 = (await login(call, '+998911000006', 'Password123')).access;

  return { T, R1, R2, admin1, waiter, cook, storekeeper, table1, table2, category, dish, ingredient, recipe, order, item, reservation, su, a };
}

module.exports = { startServer, buildWorld, login, must, futureDate, SUPER };

// Server birinchi ishga tushganda baza tayyorlanishi: superadmin + restoran + har bir rol uchun bitta akkaunt.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, SUPER } = require('./helpers');

describe('Boshlang\'ich ma\'lumot (bootstrap)', () => {
  let srv; let call; let boot;
  before(async () => {
    srv = await startServer({ INITIAL_DATA: 'true', INITIAL_PASSWORD: 'Initial12345' });
    call = srv.call;
    boot = require('../src/services/bootstrap');
  });
  after(() => srv.stop());

  const ROLES = [
    ['restaurant_admin', '+998901000001'], ['waiter', '+998901000002'], ['cook', '+998901000003'],
    ['storekeeper', '+998901000004'], ['customer', '+998901000005'],
  ];

  it('superadmin bazada o\'zi yaratilgan va kira oladi', async () => {
    const t = await login(call, SUPER.phone, SUPER.password);
    const me = (await call('GET', '/api/users/me', { token: t.access })).body;
    assert.equal(me.role, 'superadmin');
  });

  it('ensureSuperadmin takror chaqirilsa yangisini yaratmaydi', async () => {
    assert.deepEqual(await boot.ensureSuperadmin(), { created: false });
    assert.equal(await srv.models.User.countDocuments({ role: 'superadmin' }), 1);
  });

  it('boshlang\'ich ma\'lumot yaratiladi: 1 restoran va har bir rol uchun bitta akkaunt', async () => {
    assert.deepEqual(await boot.ensureInitialData(), { created: true });
    assert.equal(await srv.models.Restaurant.countDocuments(), 1);
    for (const [role, phone] of ROLES) {
      const t = await login(call, phone, 'Initial12345');
      const me = (await call('GET', '/api/users/me', { token: t.access })).body;
      assert.equal(me.role, role, phone);
      if (role !== 'customer') assert.equal(me.restaurant.name, 'Asosiy restoran', role);
      else assert.equal(me.restaurant, null);
    }
  });

  it('rollar tayyor restoranda ishlay oladi (stol yaratish, buyurtma, oshxona, ombor, bron)', async () => {
    const tok = async (phone) => (await login(call, phone, 'Initial12345')).access;
    const [admin, waiter, cook, store, customer] = await Promise.all(ROLES.map(([, p]) => tok(p)));
    const R = 1;
    const table = (await call('POST', `/api/restaurants/${R}/tables`, { token: admin, body: { seats: 4 } })).body;
    const cat = (await call('POST', `/api/restaurants/${R}/categories`, { token: admin, body: { name: 'K', order_index: '1' } })).body;
    const dish = (await call('POST', `/api/categories/${cat.id}/dishes`, { token: admin, body: { name: 'T', price: '100' } })).body;
    const ing = (await call('POST', `/api/restaurants/${R}/ingredients`, { token: store, body: { name: 'I', unit: 'kg', current_stock: '1' } })).body;
    await call('POST', `/api/dishes/${dish.id}/recipe-items`, { token: admin, body: { ingredient: ing.id, quantity_per_serving: '100', unit: 'gr' } });
    const order = (await call('POST', `/api/restaurants/${R}/orders`, { token: waiter, body: { table: table.id } })).body;
    const item = (await call('POST', `/api/orders/${order.id}/items`, { token: waiter, body: { dish: dish.id, quantity: 1 } })).body;
    assert.equal((await call('POST', `/api/orders/${order.id}/send-to-kitchen`, { token: waiter })).status, 200);
    assert.equal((await call('PATCH', `/api/kitchen/items/${item.id}/status`, { token: cook, body: { status: 'cooking' } })).status, 200);
    assert.equal((await call('GET', `/api/ingredients/${ing.id}`, { token: store })).body.current_stock, '0.900');
    const date = require('./helpers').futureDate(9);
    assert.equal((await call('POST', `/api/restaurants/${R}/reservations`, { token: customer, body: { table: table.id, reservation_date: date, reservation_time: '19:00' } })).status, 201);
  });

  it('faqat bir marta yaratiladi: ikkinchi chaqiruv va o\'chirilgandan keyin qayta yaratilmaydi', async () => {
    assert.deepEqual(await boot.ensureInitialData(), { created: false });
    const waiterUser = await srv.models.User.findOne({ phone_number: '+998901000002' });
    await srv.models.Staff.deleteOne({ user: waiterUser._id });
    await srv.models.User.deleteOne({ _id: waiterUser._id });
    assert.deepEqual(await boot.ensureInitialData(), { created: false });
    assert.equal(await srv.models.User.countDocuments({ phone_number: '+998901000002' }), 0, 'o\'chirilgan akkaunt qayta paydo bo\'lmasligi kerak');
    assert.equal(await srv.models.Restaurant.countDocuments(), 1);
  });
});

// Frontend uchun qo'shilgan imkoniyatlar: buyurtma vaqtlari/ofitsiant nomi, bron tafsilotlari,
// "served" statusi, ofitsiantga bronlarni o'qish, ingredient min_stock
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, buildWorld, must } = require('./helpers');

describe('Qo\'shimcha imkoniyatlar', () => {
  let srv; let W; let call;
  before(async () => { srv = await startServer(); W = await buildWorld(srv); call = srv.call; });
  after(() => srv.stop());

  it('buyurtma: created_at, waiter_name; closed_at yopilganda to\'ldiriladi, qayta ochilsa null', async () => {
    const o = must(await call('GET', `/api/orders/${W.order.id}`, { token: T().waiter }), 200);
    assert.ok(o.created_at);
    assert.equal(o.closed_at, null);
    assert.match(o.waiter_name, /waiter/);
    must(await call('PATCH', `/api/orders/${W.order.id}/status`, { token: T().waiter, body: { status: 'closed' } }), 200);
    assert.ok((await call('GET', `/api/orders/${W.order.id}`, { token: T().waiter })).body.closed_at);
    must(await call('PATCH', `/api/orders/${W.order.id}/status`, { token: T().waiter, body: { status: 'open' } }), 200);
    assert.equal((await call('GET', `/api/orders/${W.order.id}`, { token: T().waiter })).body.closed_at, null);
  });

  it('served: faqat ready taomni, faqat ofitsiant/admin; oshxona ro\'yxatida ko\'rinmaydi', async () => {
    const id = W.item.id;
    const serve = (token) => call('PATCH', `/api/order-items/${id}/serve`, { token });
    assert.equal((await serve(T().waiter)).status, 400, 'new -> serve mumkin emas');
    must(await call('POST', `/api/orders/${W.order.id}/send-to-kitchen`, { token: T().waiter }), 200);
    assert.equal((await serve(T().waiter)).status, 400, 'sent -> serve mumkin emas');
    must(await call('PATCH', `/api/kitchen/items/${id}/status`, { token: T().cook, body: { status: 'cooking' } }), 200);
    must(await call('PATCH', `/api/kitchen/items/${id}/status`, { token: T().cook, body: { status: 'ready' } }), 200);
    assert.equal((await serve(T().cook)).status, 403);
    assert.equal((await serve(T().customer)).status, 403);
    assert.equal(must(await serve(T().waiter), 200).status, 'served');
    assert.equal((await serve(T().waiter)).status, 400, 'ikkinchi marta mumkin emas');
    const kds = must(await call('GET', '/api/kitchen/items', { token: T().cook }), 200);
    assert.ok(!kds.results.some((x) => x.id === id));
    const o = must(await call('GET', `/api/orders/${W.order.id}`, { token: T().waiter }), 200);
    assert.equal(o.order_items.find((x) => x.id === id).status, 'served');
  });

  it('bron: guests_count, mijoz ismi, restoran/stol id lari; ofitsiant o\'qiy oladi, statusni o\'zgartira olmaydi', async () => {
    const list = must(await call('GET', '/api/reservations', { token: T().waiter }), 200);
    const r = list.results.find((x) => x.id === W.reservation.id);
    assert.equal(r.guests_count, 2);
    assert.equal(r.client.first_name, 'Mijoz');
    assert.equal(r.restaurant.id, W.R1.id);
    assert.equal(r.table.id, W.table2.id);
    assert.equal((await call('PATCH', `/api/reservations/${r.id}/status`, { token: T().waiter, body: { status: 'confirmed' } })).status, 403);
    const mine = must(await call('GET', '/api/reservations/my', { token: T().customer }), 200);
    assert.equal(mine.results[0].guests_count, 2);
    assert.equal(mine.results[0].restaurant.id, W.R1.id);
    assert.equal(mine.results[0].client, undefined);
    assert.equal((await call('GET', '/api/reservations', { token: T().admin2 })).body.count, 0, 'boshqa restoran bronlari ko\'rinmaydi');
  });

  it('ingredient min_stock: yaratish, o\'zgartirish, validatsiya', async () => {
    const c = must(await call('POST', `/api/restaurants/${W.R1.id}/ingredients`, { token: T().storekeeper, body: { name: 'Un', unit: 'kg', min_stock: '3' } }), 201);
    assert.equal(c.min_stock, '3.000');
    assert.equal(W.ingredient.min_stock, '0.000');
    const u = must(await call('PATCH', `/api/ingredients/${c.id}`, { token: T().storekeeper, body: { min_stock: '4.5' } }), 200);
    assert.equal(u.min_stock, '4.500');
    assert.equal((await call('PATCH', `/api/ingredients/${c.id}`, { token: T().storekeeper, body: { min_stock: '-1' } })).status, 400);
    assert.equal((await call('PATCH', `/api/ingredients/${c.id}`, { token: T().cook, body: { min_stock: '1' } })).status, 403);
  });

  it('superadmin: restoran royxatida admin obyekti, is_active/has_admin filtrlari va stats; boshqa rollarda admin yoq', async () => {
    const su = (u) => call('GET', u, { token: T().superadmin });
    const empty = must(await call('POST', '/api/restaurants', { token: T().superadmin, body: { name: 'Adminsiz', address: 'X', phone: '+998901119998', start_time: '09:00', end_time: '22:00', is_active: false } }), 201);
    assert.equal(empty.admin, null);
    const all = must(await su('/api/restaurants'), 200).results;
    const r1 = all.find((x) => x.id === W.R1.id);
    assert.equal(r1.admin.first_name, 'Admin');
    assert.equal(r1.admin.phone_number, '+998911000001');
    assert.equal(all.find((x) => x.id === empty.id).admin, null);
    assert.deepEqual(must(await su('/api/restaurants?is_active=false'), 200).results.map((x) => x.id), [empty.id]);
    assert.ok(must(await su('/api/restaurants?is_active=true'), 200).results.every((x) => x.is_active));
    assert.deepEqual(must(await su('/api/restaurants?has_admin=false'), 200).results.map((x) => x.id), [empty.id]);
    assert.ok(!must(await su('/api/restaurants?has_admin=true'), 200).results.some((x) => x.id === empty.id));
    assert.deepEqual(must(await su('/api/restaurants/stats'), 200), { total: 3, active: 2, inactive: 1, without_admin: 1 });
    assert.equal((await call('GET', '/api/restaurants/stats', { token: T().restaurant_admin })).status, 403);
    assert.equal((await call('GET', '/api/restaurants/stats', { token: T().customer })).status, 403);
    const asCustomer = must(await call('GET', '/api/restaurants', { token: T().customer }), 200).results[0];
    assert.equal(asCustomer.admin, undefined, 'mijozga admin malumoti berilmaydi');
    assert.equal(must(await call('GET', '/api/restaurants/' + W.R1.id, { token: T().superadmin }), 200).admin.first_name, 'Admin');
  });

  it('adminlar royxatida restoran nomi bor', async () => {
    const list = must(await call('GET', '/api/admins', { token: T().superadmin }), 200).results;
    assert.equal(list.find((a) => a.restaurant === W.R1.id).restaurant_name, 'Nukus Grill');
    const one = must(await call('GET', '/api/admins/' + W.admin1.id, { token: T().superadmin }), 200);
    assert.equal(one.restaurant_name, 'Nukus Grill');
  });

  const T = () => W.T;
});

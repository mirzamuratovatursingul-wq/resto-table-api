// Hujjatdagi ruxsatlar jadvali (public/docs/endpoints.js) haqiqiy server bilan bir xilmi?
// Har bir endpoint x har bir rol: ruxsat yo'q -> 403, ruxsat bor -> 403/401 emas, hech qachon 500 emas.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, buildWorld } = require('./helpers');

global.window = {};
require('../public/docs/endpoints.js');
const { ENDPOINTS, ROLES } = window.DOCS;

const ROLE_KEYS = Object.keys(ROLES);
const allowed = (ep, role) => !ep.auth || ep.who === 'any' || ep.who.includes(role);

// Hujjatdagi namunaviy yo'lni haqiqiy so'rovga aylantirish ({id} -> 1, majburiy query lar)
const urlFor = (ep) => {
  let url = ep.path.replace(/\{id\}/g, '1');
  const qs = ep.params.filter((p) => p.in === 'query' && p.required).map((p) => `${p.name}=${p.example || ''}`);
  if (/available-tables/.test(url)) qs.length = 0, qs.push('reservation_date=2099-01-01', 'reservation_time=18:00');
  return qs.length ? `${url}?${qs.join('&')}` : url;
};

describe('Ruxsatlar jadvali: hujjat == server', () => {
  let srv; let W;
  before(async () => { srv = await startServer(); W = await buildWorld(srv); });
  after(() => srv.stop());

  const protectedEps = ENDPOINTS.filter((e) => e.auth);

  it('hujjatda 6 ta rol bor va hammasi serverdagi rollar bilan bir xil', () => {
    const serverRoles = require('../src/models/User').ROLES;
    assert.deepEqual([...ROLE_KEYS].sort(), [...serverRoles].sort());
  });

  it('tokensiz hamma himoyalangan endpoint -> 401', async () => {
    for (const ep of protectedEps) {
      const r = await srv.call(ep.method, urlFor(ep), { body: ['POST', 'PATCH'].includes(ep.method) ? {} : undefined });
      assert.equal(r.status, 401, `${ep.id} tokensiz ${r.status}`);
    }
  });

  it('ruxsati yo\'q rol hamma endpointda 403 oladi (hujjatdagi "who" bo\'yicha)', async () => {
    const wrong = [];
    for (const ep of protectedEps) {
      for (const role of ROLE_KEYS) {
        if (allowed(ep, role)) continue;
        const r = await srv.call(ep.method, urlFor(ep), { token: W.T[role], body: ['POST', 'PATCH'].includes(ep.method) ? {} : undefined });
        if (r.status !== 403) wrong.push(`${ep.id} [${role}] -> ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
      }
    }
    assert.deepEqual(wrong, [], `Hujjat "ruxsat yo'q" deydi, lekin server 403 qaytarmadi:\n${wrong.join('\n')}`);
  });

  it('ruxsati bor rol hech qachon 401/403/500 olmaydi (DELETE dan tashqari)', async () => {
    const wrong = [];
    for (const ep of protectedEps) {
      if (ep.method === 'DELETE') continue;
      for (const role of ROLE_KEYS) {
        if (!allowed(ep, role)) continue;
        const r = await srv.call(ep.method, urlFor(ep), { token: W.T[role], body: ['POST', 'PATCH'].includes(ep.method) ? {} : undefined });
        if ([401, 403].includes(r.status) || r.status >= 500) wrong.push(`${ep.id} [${role}] -> ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
      }
    }
    assert.deepEqual(wrong, [], `Hujjat "ruxsat bor" deydi, lekin server rad etdi yoki yiqildi:\n${wrong.join('\n')}`);
  });

  it('restoranlar izolyatsiyasi: boshqa restoran admini R1 resurslarida 403 oladi', async () => {
    // Yangi to'liq resurslar to'plami (oldingi DELETE lar bir qismini o'chirgan bo'lishi mumkin)
    const w2 = await buildFreshR1Resources(srv, W);
    const probes = [
      ['PATCH', `/api/restaurants/${W.R1.id}`, { name: 'Hack' }],
      ['POST', `/api/restaurants/${W.R1.id}/tables`, { seats: 4 }],
      ['PATCH', `/api/tables/${w2.table.id}`, { seats: 9 }],
      ['DELETE', `/api/tables/${w2.table.id}`],
      ['POST', `/api/restaurants/${W.R1.id}/categories`, { name: 'X', order_index: '9' }],
      ['PATCH', `/api/categories/${w2.category.id}`, { name: 'Hack' }],
      ['POST', `/api/categories/${w2.category.id}/dishes`, { name: 'X', price: '1' }],
      ['PATCH', `/api/dishes/${w2.dish.id}`, { price: '1' }],
      ['PATCH', `/api/dishes/${w2.dish.id}/toggle-availability`, {}],
      ['GET', `/api/dishes/${w2.dish.id}/recipe-items`],
      ['POST', `/api/dishes/${w2.dish.id}/recipe-items`, { quantity_per_serving: '1' }],
      ['GET', `/api/restaurants/${W.R1.id}/ingredients`],
      ['GET', `/api/ingredients/${w2.ingredient.id}`],
      ['PATCH', `/api/ingredients/${w2.ingredient.id}/stock-in`, { quantity: '1' }],
      ['PATCH', `/api/ingredients/${w2.ingredient.id}/stock-out`, { quantity: '1', reason: 'x' }],
      ['GET', `/api/restaurants/${W.R1.id}/stock-transactions`],
      ['GET', `/api/restaurants/${W.R1.id}/orders`],
      ['POST', `/api/restaurants/${W.R1.id}/orders`, {}],
      ['GET', `/api/orders/${w2.order.id}`],
      ['PATCH', `/api/orders/${w2.order.id}`, {}],
      ['PATCH', `/api/orders/${w2.order.id}/status`, { status: 'closed' }],
      ['POST', `/api/orders/${w2.order.id}/items`, { dish: w2.dish.id, quantity: 1 }],
      ['POST', `/api/orders/${w2.order.id}/send-to-kitchen`],
      ['PATCH', `/api/order-items/${w2.item.id}/quantity`, { quantity_add: 1 }],
      ['DELETE', `/api/order-items/${w2.item.id}`],
      ['PATCH', `/api/kitchen/items/${w2.item.id}/status`, { status: 'ready' }],
      ['GET', `/api/restaurants/${W.R1.id}/staff`],
      ['POST', `/api/restaurants/${W.R1.id}/staff`, { role: 'cook', phone_number: '+998977770001', first_name: 'A', last_name: 'B', password: 'Password123' }],
      ['GET', `/api/staff/${W.waiter.id}`],
      ['PATCH', `/api/staff/${W.waiter.id}`, { is_active: false }],
      ['DELETE', `/api/staff/${W.waiter.id}`],
      ['PATCH', `/api/reservations/${W.reservation.id}/status`, { status: 'confirmed' }],
    ];
    const wrong = [];
    for (const [method, url, body] of probes) {
      const r = await srv.call(method, url, { token: W.T.admin2, body });
      if (r.status !== 403) wrong.push(`${method} ${url} -> ${r.status}`);
    }
    assert.deepEqual(wrong, [], `Boshqa restoran admini kira olgan yo'llar:\n${wrong.join('\n')}`);
    // R1 ma'lumotlari buzilmagan
    const t = await srv.call('GET', `/api/tables/${w2.table.id}`, { token: W.T.superadmin });
    assert.equal(t.body.seats, 4);
  });

  it('boshqa restoran admini o\'z restoranida ishlay oladi (R2)', async () => {
    const t = await srv.call('POST', `/api/restaurants/${W.R2.id}/tables`, { token: W.T.admin2, body: { seats: 6 } });
    assert.equal(t.status, 201);
    assert.equal((await srv.call('GET', '/api/reservations', { token: W.T.admin2 })).body.count, 0, 'R1 bronlari R2 adminiga ko\'rinmasligi kerak');
  });

  it('xodim o\'z restoranidan boshqasiga kira olmaydi, hatto resurs id si ma\'lum bo\'lsa ham', async () => {
    const w2 = await buildFreshR1Resources(srv, W);
    // R2 adminining xodimi
    const st = await srv.call('POST', `/api/restaurants/${W.R2.id}/staff`, { token: W.T.admin2, body: { role: 'waiter', phone_number: '+998977770002', first_name: 'W', last_name: '2', password: 'Password123' } });
    assert.equal(st.status, 201);
    const tok = (await srv.call('POST', '/api/auth/login', { body: { phone_number: '+998977770002', password: 'Password123' } })).body.access;
    for (const [method, url, body] of [
      ['GET', `/api/restaurants/${W.R1.id}/orders`],
      ['POST', `/api/restaurants/${W.R1.id}/orders`, {}],
      ['GET', `/api/orders/${w2.order.id}`],
      ['POST', `/api/orders/${w2.order.id}/items`, { dish: w2.dish.id, quantity: 1 }],
      ['PATCH', `/api/order-items/${w2.item.id}/quantity`, { quantity_add: 1 }],
      ['DELETE', `/api/order-items/${w2.item.id}`],
    ]) {
      assert.equal((await srv.call(method, url, { token: tok, body })).status, 403, `${method} ${url}`);
    }
  });

  it('rol o\'zgarsa, eski token yangi rol huquqlari bilan ishlaydi (rol har so\'rovda bazadan o\'qiladi)', async () => {
    const x = await srv.call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: W.T.restaurant_admin, body: { role: 'waiter', phone_number: '+998977770003', first_name: 'R', last_name: 'Role', password: 'Password123' } });
    assert.equal(x.status, 201);
    const tok = (await srv.call('POST', '/api/auth/login', { body: { phone_number: '+998977770003', password: 'Password123' } })).body.access;
    assert.equal((await srv.call('GET', '/api/kitchen/items', { token: tok })).status, 403);
    await srv.call('PATCH', `/api/staff/${x.body.id}`, { token: W.T.restaurant_admin, body: { role: 'cook' } });
    assert.equal((await srv.call('GET', '/api/kitchen/items', { token: tok })).status, 200);
  });

  it('nofaol xodimning mavjud tokeni 403 oladi', async () => {
    const x = await srv.call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: W.T.restaurant_admin, body: { role: 'cook', phone_number: '+998977770004', first_name: 'I', last_name: 'Active', password: 'Password123' } });
    const tok = (await srv.call('POST', '/api/auth/login', { body: { phone_number: '+998977770004', password: 'Password123' } })).body.access;
    assert.equal((await srv.call('GET', '/api/kitchen/items', { token: tok })).status, 200);
    await srv.call('PATCH', `/api/staff/${x.body.id}`, { token: W.T.restaurant_admin, body: { is_active: false } });
    assert.equal((await srv.call('GET', '/api/kitchen/items', { token: tok })).status, 403);
  });
  // Eng oxirgi test: o'chirish endpointlari. Admin va restoran o'chirish oxirida (tokenlar yaroqsiz bo'lib qolmasligi uchun).
  it('DELETE endpointlar: ruxsatli rol muvaffaqiyatli o\'chiradi (204)', async () => {
    const weight = (ep) => (ep.path.startsWith('/api/admins') ? 2 : ep.path === '/api/restaurants/{id}' ? 3 : 0);
    const eps = protectedEps.filter((e) => e.method === 'DELETE').sort((x, y) => weight(x) - weight(y));
    const wrong = [];
    for (const ep of eps) {
      const role = ROLE_KEYS.find((r) => allowed(ep, r) && r !== 'superadmin') || 'superadmin';
      const r = await srv.call('DELETE', urlFor(ep), { token: W.T[role] });
      if (![204, 404].includes(r.status)) wrong.push(`${ep.id} [${role}] -> ${r.status} ${JSON.stringify(r.body).slice(0, 80)}`);
    }
    assert.deepEqual(wrong, []);
  });
});

// R1 uchun yangi stol/kategoriya/taom/ingredient/buyurtma/element to'plami
async function buildFreshR1Resources(srv, W) {
  const a = (m, u, b) => srv.call(m, u, { token: W.T.restaurant_admin, body: b });
  const ok = (r, s) => { assert.equal(r.status, s, JSON.stringify(r.body)); return r.body; };
  const table = ok(await a('POST', `/api/restaurants/${W.R1.id}/tables`, { seats: 4 }), 201);
  const category = ok(await a('POST', `/api/restaurants/${W.R1.id}/categories`, { name: 'Fresh', order_index: '7' }), 201);
  const dish = ok(await a('POST', `/api/categories/${category.id}/dishes`, { name: 'FreshDish', price: '1000' }), 201);
  const ingredient = ok(await srv.call('POST', `/api/restaurants/${W.R1.id}/ingredients`, { token: W.T.storekeeper, body: { name: 'FreshIng', unit: 'kg', current_stock: '10' } }), 201);
  const order = ok(await srv.call('POST', `/api/restaurants/${W.R1.id}/orders`, { token: W.T.restaurant_admin, body: { table: table.id } }), 201);
  const item = ok(await srv.call('POST', `/api/orders/${order.id}/items`, { token: W.T.restaurant_admin, body: { dish: dish.id, quantity: 1 } }), 201);
  return { table, category, dish, ingredient, order, item };
}

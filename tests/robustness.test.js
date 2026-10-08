// Chidamlilik: har xil noto'g'ri kirishlar (fuzz) hech qachon 500 bermasligi, ma'lumot sizib chiqmasligi.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, buildWorld, must } = require('./helpers');

global.window = {};
require('../public/docs/endpoints.js');
const { ENDPOINTS } = window.DOCS;

const WEIRD = [
  null, true, false, 0, -1, 1.5, 1e21, 2 ** 53, '', ' ', 'x'.repeat(5000), '9'.repeat(30), [], ['a'], {}, { $gt: '' }, { $ne: null },
  '<script>alert(1)</script>', '😀', '\u0000', 'DROP TABLE users;--', '../../etc/passwd', '%00', '١٢٣', '1e3', '0x10', 'NaN', 'Infinity',
];
const WEIRD_IDS = ['abc', '0', '-1', '1.5', '1e3', '0x10', '99999999999999999999', '%20', '1%00', '%D9%A3', '1;DROP', 'null', 'undefined', '00001x'];

describe('Chidamlilik va xavfsizlik', () => {
  let srv; let W;
  before(async () => { srv = await startServer(); W = await buildWorld(srv); });
  after(() => srv.stop());

  // Endpoint uchun mos token (ruxsatli birinchi rol)
  const tokenFor = (ep) => {
    if (!ep.auth) return undefined;
    const role = ep.who === 'any' ? 'superadmin' : (ep.who.includes('superadmin') ? 'superadmin' : ep.who[0]);
    return W.T[role];
  };
  const isJsonish = (b) => b === null || typeof b === 'object';

  it('noto\'g\'ri path id lari: hammasi 404 (400/500 emas)', async () => {
    const wrong = [];
    for (const ep of ENDPOINTS.filter((e) => e.auth && /\{id\}/.test(e.path))) {
      for (const bad of WEIRD_IDS) {
        const url = ep.path.replace(/\{id\}/g, bad);
        const r = await srv.call(ep.method, url, { token: tokenFor(ep), body: ['POST', 'PATCH'].includes(ep.method) ? {} : undefined });
        if (r.status !== 404) wrong.push(`${ep.method} ${url} -> ${r.status}`);
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('body fuzz: har bir maydonga g\'alati qiymatlar -> hech qachon 500, javob JSON', async () => {
    const bad = [];
    let sent = 0;
    for (const ep of ENDPOINTS.filter((e) => ['POST', 'PATCH'].includes(e.method) && e.body.length)) {
      if (ep.id === 'POST /api/auth/logout') continue;
      const valid = {};
      ep.body.forEach((f) => { if (f.example !== undefined && f.example !== '<refresh token>') valid[f.name] = f.example; });
      const url = ep.path.replace(/\{id\}/g, '1').replace(/\?.*$/, '');
      for (const f of ep.body) {
        for (const v of WEIRD) {
          for (const body of [{ [f.name]: v }, { ...valid, [f.name]: v }]) {
            const r = await srv.call(ep.method, url, { token: tokenFor(ep), body });
            sent += 1;
            if (r.status >= 500 || !isJsonish(r.body)) bad.push(`${ep.id} ${f.name}=${JSON.stringify(v).slice(0, 30)} -> ${r.status} ${String(JSON.stringify(r.body)).slice(0, 80)}`);
          }
        }
      }
    }
    assert.ok(sent > 1500, `kam so'rov yuborildi: ${sent}`);
    assert.deepEqual(bad, [], `${bad.length} ta so'rov 500 yoki JSON bo'lmagan javob berdi:\n${bad.slice(0, 15).join('\n')}`);
  });

  it('body butunlay noto\'g\'ri turlarda (massiv, matn, son, null) -> 400, 500 emas', async () => {
    const bad = [];
    for (const ep of ENDPOINTS.filter((e) => ['POST', 'PATCH'].includes(e.method) && e.body.length)) {
      for (const raw of ['[]', '"matn"', '123', 'null', 'true', '[1,2,3]', '{"a":{"b":{"c":[1,2,{"d":1}]}}}']) {
        const r = await srv.call(ep.method, ep.path.replace(/\{id\}/g, '1'), { token: tokenFor(ep), rawBody: raw });
        if (r.status >= 500) bad.push(`${ep.id} body=${raw} -> ${r.status}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  it('query fuzz: ro\'yxat endpointlari g\'alati query bilan 500 bermaydi', async () => {
    const bad = [];
    const keys = ['page', 'search', 'status', 'table', 'mine', 'date', 'is_active', 'guests', 'reservation_date', 'reservation_time', 'duration_hours'];
    const vals = ['', 'abc', '-1', '0', '1e3', '%00', 'x'.repeat(3000), '[]', '{}', '$ne', '😀', '1&page=2', '../..'];
    for (const ep of ENDPOINTS.filter((e) => e.auth && e.method === 'GET')) {
      for (const k of keys) {
        for (const v of vals) {
          for (const qs of [`${k}=${encodeURIComponent(v)}`, `${k}[$ne]=x`, `${k}=a&${k}=b`, `${k}[]=1`]) {
            const url = `${ep.path.replace(/\{id\}/g, '1')}?${qs}`;
            const r = await srv.call('GET', url, { token: tokenFor(ep) });
            if (r.status >= 500) bad.push(`${url.slice(0, 90)} -> ${r.status}`);
          }
        }
      }
    }
    assert.deepEqual(bad, []);
  });

  it('javoblarda parol/hash/stack/__v sizib chiqmaydi (hamma GET endpoint)', async () => {
    const leaks = [];
    for (const ep of ENDPOINTS.filter((e) => e.auth && e.method === 'GET')) {
      const url = ep.path.replace(/\{id\}/g, '1');
      for (const role of ['superadmin', 'restaurant_admin']) {
        const r = await srv.call('GET', url, { token: W.T[role] });
        const text = JSON.stringify(r.body);
        if (/"password"|"__v"|"stack"|\$2[aby]\$/.test(text)) leaks.push(`${ep.id} [${role}]`);
      }
    }
    // Admin/xodim ro'yxatlarida ham parol yo'q
    for (const url of ['/api/admins', `/api/restaurants/${W.R1.id}/staff`]) {
      assert.ok(!/password|\$2[aby]\$/.test(JSON.stringify((await srv.call('GET', url, { token: W.T.superadmin })).body)), url);
    }
    assert.deepEqual(leaks, []);
  });

  it('xato javoblarida stack trace yo\'q (500 holatida ham ichki ma\'lumot chiqmaydi)', async () => {
    const r = await srv.call('POST', '/api/auth/login', { rawBody: '{bad json' });
    assert.equal(r.status, 400);
    assert.equal(r.body.stack, undefined);
  });

  it('unicode, emoji va maxsus belgilar o\'zgarishsiz saqlanadi; bo\'sh joylar trim', async () => {
    const names = ['Ўзбек таом 🍲', 'Qoraqalpoq: Qazı-qarta', '日本語メニュー', '"quote" & <b>bold</b>', '  ortiqcha bo\'shliq  '];
    for (const name of names) {
      const r = await srv.call('POST', `/api/categories/${W.category.id}/dishes`, { token: W.T.restaurant_admin, body: { name, price: '1' } });
      assert.equal(r.status, 201, name);
      assert.equal(r.body.name, name.trim());
      const g = await srv.call('GET', `/api/dishes/${r.body.id}`, { token: W.T.customer });
      assert.equal(g.body.name, name.trim());
    }
  });

  it('juda uzun maydonlar rad etiladi (nom 81+ belgi, izoh juda katta bo\'lsa ham 500 emas)', async () => {
    const t = W.T.restaurant_admin;
    assert.equal((await srv.call('POST', `/api/categories/${W.category.id}/dishes`, { token: t, body: { name: 'x'.repeat(81), price: '1' } })).status, 400);
    const big = await srv.call('POST', `/api/categories/${W.category.id}/dishes`, { token: t, body: { name: 'Katta', price: '1', description: 'd'.repeat(200000) } });
    assert.ok(big.status < 500);
  });

  it('narx va miqdor chegaralari: 99999999.99 ruxsat, 100000000 yoki 3 xonali kasr rad', async () => {
    const t = W.T.restaurant_admin; const c = W.category.id;
    const post = (price) => srv.call('POST', `/api/categories/${c}/dishes`, { token: t, body: { name: 'Narx', price } });
    assert.equal((await post('99999999.99')).status, 201);
    for (const p of ['100000000', '1.001', '-0.01', '1e2', '0x10', 'abc', '', ' ']) assert.equal((await post(p)).status, 400, `price=${p}`);
    assert.equal((await post(0)).status, 201, 'bepul taom');
    assert.equal((await post('0.00')).status, 201);
  });

  it('mass-assignment: PATCH/POST da begona maydonlar (id, restaurant, user, role) e\'tiborsiz', async () => {
    const t = W.T.restaurant_admin;
    const tbl = must(await srv.call('POST', `/api/restaurants/${W.R1.id}/tables`, { token: t, body: { seats: 3, restaurant: W.R2.id, id: 9999, status: 'occupied' } }), 201);
    assert.equal(tbl.restaurant, W.R1.id);
    assert.notEqual(tbl.id, 9999);
    const patched = must(await srv.call('PATCH', `/api/tables/${tbl.id}`, { token: t, body: { seats: 5, restaurant: W.R2.id } }), 200);
    assert.equal(patched.restaurant, W.R1.id);
    const staff = must(await srv.call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: t, body: { role: 'cook', phone_number: '+998933000001', first_name: 'A', last_name: 'B', password: 'Password123', restaurant: W.R2.id, user: 1 } }), 201);
    assert.equal(staff.restaurant, W.R1.id);
    // admin o'z restoranini PATCH orqali boshqa restoranga ko'chira olmaydi / is_active ni o'zgartirishi mumkin, lekin id emas
    const rs = must(await srv.call('PATCH', `/api/restaurants/${W.R1.id}`, { token: t, body: { name: 'Nukus Grill', id: 55 } }), 200);
    assert.equal(rs.id, W.R1.id);
  });

  it('o\'z-o\'zini yuqorilatish yo\'q: xodim/mijoz/admin superadmin yarata olmaydi', async () => {
    const st = await srv.call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: W.T.restaurant_admin, body: { role: 'superadmin', phone_number: '+998933000002', first_name: 'A', last_name: 'B', password: 'Password123' } });
    assert.equal(st.status, 400);
    const st2 = await srv.call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: W.T.restaurant_admin, body: { role: 'restaurant_admin', phone_number: '+998933000003', first_name: 'A', last_name: 'B', password: 'Password123' } });
    assert.equal(st2.status, 400);
    assert.equal((await srv.call('POST', '/api/admins', { token: W.T.restaurant_admin, body: { restaurant: W.R1.id, phone_number: '+998933000004', first_name: 'A', last_name: 'B', password: 'Password123' } })).status, 403);
  });

  it('HTTP usullari: HEAD va noma\'lum usullar 500 bermaydi', async () => {
    for (const m of ['HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
      const r = await srv.call(m, '/api/health');
      assert.ok(r.status < 500, `${m} -> ${r.status}`);
    }
  });
});

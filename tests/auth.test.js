const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startServer, buildWorld, login, must, SUPER } = require('./helpers');

describe('Auth: register, login, tokenlar, profil', () => {
  let srv; let call; let W;
  before(async () => {
    srv = await startServer();
    call = srv.call;
    W = await buildWorld(srv);
  });
  after(() => srv.stop());

  const reg = (body) => call('POST', '/api/auth/register', { body });
  const valid = { phone_number: '+998905550001', password: 'Password123', first_name: 'Aziz', last_name: 'Karimov' };

  describe('register', () => {
    it('muvaffaqiyatli: customer rolida, parol qaytmaydi', async () => {
      const r = await reg(valid);
      assert.equal(r.status, 201);
      assert.equal(r.body.role, 'customer');
      assert.equal(r.body.restaurant, null);
      assert.equal(r.body.password, undefined);
      assert.equal(r.body.phone_number, valid.phone_number);
    });
    it('takroriy telefon -> 400 (500 emas)', async () => {
      const r = await reg(valid);
      assert.equal(r.status, 400);
      assert.ok(r.body.phone_number);
    });
    it('parallel bir xil telefon: faqat bittasi yaratiladi, qolganlari 400', async () => {
      const body = { phone_number: '+998905550002', password: 'Password123' };
      const results = await Promise.all(Array.from({ length: 6 }, () => reg(body)));
      const codes = results.map((r) => r.status).sort();
      assert.equal(codes.filter((c) => c === 201).length, 1, JSON.stringify(codes));
      assert.ok(codes.every((c) => c === 201 || c === 400), `500 chiqmasligi kerak: ${codes}`);
    });
    for (const [name, patch] of [
      ['telefon yo\'q', { phone_number: undefined }],
      ['telefon harflar', { phone_number: 'abc' }],
      ['telefon juda qisqa', { phone_number: '+9989' }],
      ['telefon juda uzun', { phone_number: '+9989055500010000' }],
      ['parol yo\'q', { password: undefined }],
      ['parol 7 belgi', { password: 'Pass123' }],
      ['parol son', { password: 12345678 }],
      ['email noto\'g\'ri', { email: 'not-an-email' }],
      ['ism obyekt', { first_name: { a: 1 } }],
      ['ism juda uzun', { first_name: 'x'.repeat(151) }],
    ]) {
      it(`validatsiya: ${name} -> 400`, async () => {
        const r = await reg({ ...valid, phone_number: '+998905559999', ...patch });
        assert.equal(r.status, 400, JSON.stringify(r.body));
      });
    }
    it('mass-assignment: role/is_active/_id e\'tiborsiz qoldiriladi', async () => {
      const r = await reg({ phone_number: '+998905550003', password: 'Password123', role: 'superadmin', is_active: false, _id: 999 });
      assert.equal(r.status, 201);
      assert.equal(r.body.role, 'customer');
      assert.notEqual(r.body.id, 999);
      const l = await call('POST', '/api/auth/login', { body: { phone_number: '+998905550003', password: 'Password123' } });
      assert.equal(l.status, 200, 'is_active:false berilgan bo\'lsa ham foydalanuvchi faol bo\'lishi kerak');
    });
    it('email katta harfda bo\'lsa kichik harfga o\'tadi, bo\'sh email null', async () => {
      const r = await reg({ phone_number: '+998905550004', password: 'Password123', email: 'AZIZ@Mail.COM' });
      assert.equal(r.body.email, 'aziz@mail.com');
      const r2 = await reg({ phone_number: '+998905550005', password: 'Password123', email: '' });
      assert.equal(r2.body.email, null);
    });
  });

  describe('login', () => {
    it('muvaffaqiyatli: access va refresh', async () => {
      const r = await call('POST', '/api/auth/login', { body: { phone_number: SUPER.phone, password: SUPER.password } });
      assert.equal(r.status, 200);
      assert.ok(r.body.access && r.body.refresh);
    });
    it('noto\'g\'ri parol va noma\'lum telefon bir xil xabar (foydalanuvchi mavjudligi sezdirilmaydi)', async () => {
      const a = await call('POST', '/api/auth/login', { body: { phone_number: SUPER.phone, password: 'xxxxxxxx' } });
      const b = await call('POST', '/api/auth/login', { body: { phone_number: '+998900009999', password: 'xxxxxxxx' } });
      assert.equal(a.status, 401); assert.equal(b.status, 401);
      assert.deepEqual(a.body, b.body);
      assert.equal(a.body.code, 'invalid_credentials');
    });
    it('maydonlar yo\'q -> 400', async () => {
      assert.equal((await call('POST', '/api/auth/login', { body: {} })).status, 400);
      assert.equal((await call('POST', '/api/auth/login')).status, 400);
    });
    it('NoSQL injection ({$ne: null}) -> 400', async () => {
      const r = await call('POST', '/api/auth/login', { body: { phone_number: { $ne: null }, password: { $ne: null } } });
      assert.equal(r.status, 400);
    });
    it('nofaol (is_active=false) foydalanuvchi kira olmaydi', async () => {
      await reg({ phone_number: '+998905550010', password: 'Password123' });
      await srv.models.User.updateOne({ phone_number: '+998905550010' }, { is_active: false });
      const r = await call('POST', '/api/auth/login', { body: { phone_number: '+998905550010', password: 'Password123' } });
      assert.equal(r.status, 401);
    });
    it('nofaol xodim (Staff.is_active=false) kira olmaydi', async () => {
      const r = await call('PATCH', `/api/staff/${W.waiter.id}`, { token: W.T.restaurant_admin, body: { is_active: false } });
      assert.equal(r.status, 200);
      const l = await call('POST', '/api/auth/login', { body: { phone_number: '+998911000002', password: 'Password123' } });
      assert.equal(l.status, 403, JSON.stringify(l.body));
      assert.equal(l.body.code, 'account_inactive');
      await call('PATCH', `/api/staff/${W.waiter.id}`, { token: W.T.restaurant_admin, body: { is_active: true } });
      assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: '+998911000002', password: 'Password123' } })).status, 200);
    });
  });

  describe('access token tekshiruvi', () => {
    const me = (token, headers) => call('GET', '/api/users/me', { token, headers });
    it('header yo\'q -> 401 not_authenticated', async () => {
      const r = await me();
      assert.equal(r.status, 401); assert.equal(r.body.code, 'not_authenticated');
    });
    it('noto\'g\'ri sxema (Basic) va bo\'sh Bearer -> 401', async () => {
      assert.equal((await me(undefined, { Authorization: 'Basic abc' })).status, 401);
      assert.equal((await me(undefined, { Authorization: 'Bearer' })).status, 401);
      assert.equal((await me(undefined, { Authorization: 'Bearer ' })).status, 401);
    });
    it('buzilgan token -> 401 token_invalid', async () => {
      const r = await me('abc.def.ghi');
      assert.equal(r.status, 401); assert.equal(r.body.code, 'token_invalid');
    });
    it('boshqa sir bilan imzolangan token -> 401', async () => {
      const t = jwt.sign({ sub: 1, type: 'access' }, 'boshqa-sir', { expiresIn: '1h' });
      assert.equal((await me(t)).status, 401);
    });
    it('alg=none token -> 401', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: 1, type: 'access', exp: 9999999999 })).toString('base64url');
      assert.equal((await me(`${header}.${payload}.`)).status, 401);
    });
    it('refresh token access o\'rnida ishlamaydi', async () => {
      const t = await login(call, SUPER.phone, SUPER.password);
      const r = await me(t.refresh);
      assert.equal(r.status, 401);
    });
    it('muddati tugagan access -> 401 token_expired', async () => {
      const { jwt: cfg } = require('../src/config/env');
      const su = await srv.models.User.findOne({ phone_number: SUPER.phone });
      const expired = jwt.sign({ sub: su._id, type: 'access' }, cfg.accessSecret, { expiresIn: -10 });
      const r = await me(expired);
      assert.equal(r.status, 401); assert.equal(r.body.code, 'token_expired');
      // yaroqli tokenning o'zi ishlaydi (sir to'g'ri ekanini tasdiqlaydi)
      const ok = jwt.sign({ sub: su._id, type: 'access' }, cfg.accessSecret, { expiresIn: 60 });
      assert.equal((await me(ok)).status, 200);
    });
    it('o\'chirilgan foydalanuvchining tokeni -> 401', async () => {
      await reg({ phone_number: '+998905550020', password: 'Password123' });
      const t = await login(call, '+998905550020', 'Password123');
      await srv.models.User.deleteOne({ phone_number: '+998905550020' });
      assert.equal((await me(t.access)).status, 401);
    });
  });

  describe('refresh va logout', () => {
    it('refresh yangi access beradi, refresh o\'zgarmaydi', async () => {
      const t = await login(call, SUPER.phone, SUPER.password);
      const r = await call('POST', '/api/auth/refresh', { body: { refresh: t.refresh } });
      assert.equal(r.status, 200);
      assert.ok(r.body.access);
      assert.equal(r.body.refresh, undefined);
      assert.equal((await call('GET', '/api/users/me', { token: r.body.access })).status, 200);
    });
    it('access token refresh sifatida -> 401; buzilgan -> 401; bo\'sh -> 400', async () => {
      const t = await login(call, SUPER.phone, SUPER.password);
      assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh: t.access } })).status, 401);
      assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh: 'garbage' } })).status, 401);
      assert.equal((await call('POST', '/api/auth/refresh', { body: {} })).status, 400);
    });
    it('logout refreshni bekor qiladi; qayta logout ham 200 (idempotent)', async () => {
      const t = await login(call, SUPER.phone, SUPER.password);
      assert.equal((await call('POST', '/api/auth/logout', { body: { refresh: t.refresh } })).status, 200);
      const r = await call('POST', '/api/auth/refresh', { body: { refresh: t.refresh } });
      assert.equal(r.status, 401); assert.equal(r.body.code, 'token_invalid');
      assert.equal((await call('POST', '/api/auth/logout', { body: { refresh: t.refresh } })).status, 200);
    });
    it('logout: yaroqsiz refresh -> 401', async () => {
      assert.equal((await call('POST', '/api/auth/logout', { body: { refresh: 'zzz' } })).status, 401);
    });
    it('bitta foydalanuvchining ikkita sessiyasi mustaqil (birinchisini logout qilish ikkinchisiga tegmaydi)', async () => {
      const a = await login(call, SUPER.phone, SUPER.password);
      const b = await login(call, SUPER.phone, SUPER.password);
      await call('POST', '/api/auth/logout', { body: { refresh: a.refresh } });
      assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh: b.refresh } })).status, 200);
    });
    it('staff o\'chirilgach refresh ham ishlamaydi', async () => {
      const x = must(await call('POST', `/api/restaurants/${W.R1.id}/staff`, { token: W.T.restaurant_admin, body: { role: 'cook', phone_number: '+998905550030', first_name: 'A', last_name: 'B', password: 'Password123' } }), 201);
      const t = await login(call, '+998905550030', 'Password123');
      assert.equal((await call('DELETE', `/api/staff/${x.id}`, { token: W.T.restaurant_admin })).status, 204);
      assert.equal((await call('POST', '/api/auth/refresh', { body: { refresh: t.refresh } })).status, 401);
      assert.equal((await call('GET', '/api/users/me', { token: t.access })).status, 401);
    });
  });

  describe('profil (/api/users/me)', () => {
    it('har bir rol uchun to\'g\'ri shakl: admin/xodimda restaurant obyekt, boshqalarda null', async () => {
      const shape = async (role) => (await call('GET', '/api/users/me', { token: W.T[role] })).body;
      for (const role of ['restaurant_admin', 'waiter', 'cook', 'storekeeper']) {
        const m = await shape(role);
        assert.equal(m.role, role);
        assert.equal(m.restaurant.id, W.R1.id);
        assert.equal(m.password, undefined);
      }
      assert.equal((await shape('superadmin')).restaurant, null);
      assert.equal((await shape('customer')).restaurant, null);
    });
    it('PATCH: ism o\'zgaradi; role/is_active/password e\'tiborsiz', async () => {
      const r = await call('PATCH', '/api/users/me', { token: W.T.customer, body: { first_name: 'Yangi', role: 'superadmin', is_active: false } });
      assert.equal(r.status, 200);
      assert.equal(r.body.first_name, 'Yangi');
      assert.equal(r.body.role, 'customer');
      assert.equal((await call('GET', '/api/users/me', { token: W.T.customer })).status, 200);
    });
    it('PATCH: band telefon -> 400; o\'z telefonini qayta yozish -> 200', async () => {
      assert.equal((await call('PATCH', '/api/users/me', { token: W.T.customer, body: { phone_number: SUPER.phone } })).status, 400);
      assert.equal((await call('PATCH', '/api/users/me', { token: W.T.customer, body: { phone_number: '+998911000005' } })).status, 200);
    });
    it('parolni almashtirish: noto\'g\'ri eski/qisqa yangi -> 400; muvaffaqiyatda yangi parol bilan kirish', async () => {
      const t = W.T.customer;
      assert.equal((await call('POST', '/api/users/me/change-password', { token: t, body: { old_password: 'xxxxxxxx', new_password: 'NewPassword1' } })).status, 400);
      assert.equal((await call('POST', '/api/users/me/change-password', { token: t, body: { old_password: 'Password123', new_password: 'short' } })).status, 400);
      assert.equal((await call('POST', '/api/users/me/change-password', { token: t, body: { old_password: 'Password123' } })).status, 400);
      assert.equal((await call('POST', '/api/users/me/change-password', { token: t, body: { old_password: 'Password123', new_password: 'NewPassword1' } })).status, 200);
      assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: '+998911000005', password: 'Password123' } })).status, 401);
      assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: '+998911000005', password: 'NewPassword1' } })).status, 200);
    });
  });

  describe('parolni tiklash (superadmin)', () => {
    const reset = (token, body) => call('POST', '/api/users/reset-password', { token, body });
    it('superadmin istalgan rol parolini tiklaydi: yangi bilan kirish, eskisi bilan yo\'q', async () => {
      for (const [phone, role] of [['+998911000005', 'customer'], ['+998911000001', 'restaurant_admin'], ['+998911000003', 'cook']]) {
        const r = await reset(W.T.superadmin, { phone_number: phone, new_password: 'TiklanganParol1' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.role, role);
        assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: phone, password: 'Password123' } })).status, 401, `${phone} eski parol`);
        assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: phone, password: 'TiklanganParol1' } })).status, 200, `${phone} yangi parol`);
      }
    });
    it('boshqa rollar tiklay olmaydi (403), tokensiz 401', async () => {
      for (const role of ['restaurant_admin', 'waiter', 'cook', 'storekeeper', 'customer']) {
        assert.equal((await reset(W.T[role], { phone_number: SUPER.phone, new_password: 'Hacked12345' })).status, 403, role);
      }
      assert.equal((await reset(undefined, { phone_number: SUPER.phone, new_password: 'Hacked12345' })).status, 401);
      assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: SUPER.phone, password: SUPER.password } })).status, 200, 'superadmin paroli o\'zgarmagan');
    });
    it('noma\'lum telefon 404; qisqa parol, telefon yoki parol yo\'q, noto\'g\'ri tur -> 400', async () => {
      assert.equal((await reset(W.T.superadmin, { phone_number: '+998999999999', new_password: 'Password123' })).status, 404);
      assert.equal((await reset(W.T.superadmin, { phone_number: '+998911000005', new_password: 'short' })).status, 400);
      assert.equal((await reset(W.T.superadmin, { phone_number: '+998911000005' })).status, 400);
      assert.equal((await reset(W.T.superadmin, { new_password: 'Password123' })).status, 400);
      assert.equal((await reset(W.T.superadmin, { phone_number: { $ne: null }, new_password: 'Password123' })).status, 400);
    });
  });

  describe('umumiy xato shakllari va xavfsizlik', () => {
    it('buzilgan JSON -> 400 {detail}', async () => {
      const r = await call('POST', '/api/auth/login', { rawBody: '{"phone_number": ' });
      assert.equal(r.status, 400); assert.ok(r.body.detail);
    });
    it('1 MB dan katta body -> 413', async () => {
      const r = await call('POST', '/api/auth/register', { rawBody: JSON.stringify({ phone_number: '+998905559000', password: 'x'.repeat(1_100_000) }) });
      assert.equal(r.status, 413);
    });
    it('noto\'g\'ri Content-Type: 500 emas', async () => {
      const r = await call('POST', '/api/auth/login', { rawBody: 'phone_number=1', headers: { 'Content-Type': 'text/plain' } });
      assert.ok(r.status >= 400 && r.status < 500, String(r.status));
    });
    it('noma\'lum yo\'l va usul -> 404 JSON', async () => {
      const a = await call('GET', '/api/yoq-yol', { token: W.T.superadmin });
      assert.equal(a.status, 404); assert.ok(a.body.detail);
      assert.equal((await call('PUT', '/api/tables/1', { token: W.T.superadmin, body: {} })).status, 404);
    });
    it('xavfsizlik sarlavhalari: helmet bor, x-powered-by yo\'q', async () => {
      const r = await call('GET', '/api/health');
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('x-powered-by'), null);
    });
    it('CORS preflight (OPTIONS) 204', async () => {
      const r = await call('OPTIONS', '/api/auth/login', { headers: { Origin: 'http://localhost:3000', 'Access-Control-Request-Method': 'POST' } });
      assert.equal(r.status, 204);
      assert.ok(r.headers.get('access-control-allow-origin'));
    });
    it('health tokensiz ochiq; qolgan /api yo\'llar tokensiz yopiq', async () => {
      assert.equal((await call('GET', '/api/health')).status, 200);
      for (const url of ['/api/restaurants', '/api/users/me', '/api/tables/1', '/api/kitchen/items', '/api/reservations/my']) {
        assert.equal((await call('GET', url)).status, 401, url);
      }
    });
    it('yo\'l oxiridagi / ixtiyoriy', async () => {
      assert.equal((await call('GET', '/api/tables/1/', { token: W.T.superadmin })).status, 200);
    });
  });
});

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, buildWorld, must, futureDate } = require('./helpers');

describe('Bronlar', () => {
  let srv; let call; let W; let R; let T; let c2; let n = 0;
  before(async () => {
    srv = await startServer();
    call = srv.call;
    W = await buildWorld(srv);
    R = W.R1.id; T = W.T;
    must(await call('POST', '/api/auth/register', { body: { phone_number: '+998922000002', password: 'Password123', first_name: 'Ikkinchi' } }), 201);
    c2 = (await call('POST', '/api/auth/login', { body: { phone_number: '+998922000002', password: 'Password123' } })).body.access;
  });
  after(() => srv.stop());

  const cust = (m, u, b) => call(m, u, { token: T.customer, body: b });
  const adm = (m, u, b) => call(m, u, { token: T.restaurant_admin, body: b });
  const day = () => futureDate(30 + (n += 1)); // har test uchun yangi kun: bir-biriga xalaqit bermaydi
  const table = async (seats = 4) => must(await adm('POST', `/api/restaurants/${R}/tables`, { seats }), 201);
  const book = (body) => cust('POST', `/api/restaurants/${R}/reservations`, body);
  const slot = (t, date, time, duration, extra = {}) => ({ table: t.id, reservation_date: date, reservation_time: time, ...(duration ? { duration_hours: duration } : {}), ...extra });

  it('muvaffaqiyatli bron: javob shakli, status pending, davomiylik 1 soat standart', async () => {
    const t = await table(); const d = day();
    const r = await book(slot(t, d, '18:00', null, { guests_count: 3 }));
    assert.equal(r.status, 201);
    assert.equal(r.body.status, 'pending');
    assert.equal(r.body.reservation_date, d);
    assert.equal(r.body.reservation_time, '18:00:00');
    assert.equal(r.body.duration_hours, '1.0');
    assert.equal(r.body.restaurant.name, 'Nukus Grill');
    assert.equal(r.body.table.number, t.number);
    assert.equal(r.body.client.phone_number, '+998911000005');
  });

  describe('vaqt kesishuvi', () => {
    it('ketma-ket bronlar (19:00 da tugaydi, 19:00 da boshlanadi) ruxsat etiladi', async () => {
      const t = await table(); const d = day();
      assert.equal((await book(slot(t, d, '18:00', '1'))).status, 201);
      assert.equal((await book(slot(t, d, '19:00', '1'))).status, 201);
      assert.equal((await book(slot(t, d, '17:00', '1'))).status, 201);
    });
    for (const [name, time, dur] of [
      ['aynan bir xil vaqt', '18:00', '1'],
      ['mavjud bron ichida boshlanadi', '18:30', '1'],
      ['oldin boshlanib ichida tugaydi', '17:30', '1'],
      ['mavjud bronni to\'liq qamrab oladi', '17:00', '3'],
      ['mavjud bron ichida to\'liq', '18:15', '0.5'],
    ]) {
      it(`kesishadi (${name}) -> 400`, async () => {
        const t = await table(); const d = day();
        must(await book(slot(t, d, '18:00', '1')), 201);
        const r = await book(slot(t, d, time, dur));
        assert.equal(r.status, 400, JSON.stringify(r.body));
        assert.ok(r.body.reservation_time);
      });
    }
    it('boshqa stol yoki boshqa kunda bir xil vaqt ruxsat', async () => {
      const t1 = await table(); const t2 = await table(); const d = day();
      must(await book(slot(t1, d, '18:00', '1')), 201);
      assert.equal((await book(slot(t2, d, '18:00', '1'))).status, 201);
      assert.equal((await book(slot(t1, futureDate(200 + n), '18:00', '1'))).status, 201);
    });
    it('bekor qilingan va yopilgan bronlar stolni band qilmaydi; tasdiqlangan band qiladi', async () => {
      const t = await table(); const d = day();
      const a = must(await book(slot(t, d, '12:00', '1')), 201);
      await cust('PATCH', `/api/reservations/${a.id}/cancel`);
      assert.equal((await book(slot(t, d, '12:00', '1'))).status, 201, 'bekor qilingandan keyin bo\'sh');
      const b = must(await book(slot(t, d, '14:00', '1')), 201);
      await adm('PATCH', `/api/reservations/${b.id}/status`, { status: 'completed' });
      assert.equal((await book(slot(t, d, '14:00', '1'))).status, 201, 'completed band qilmaydi');
      const c = must(await book(slot(t, d, '16:00', '1')), 201);
      await adm('PATCH', `/api/reservations/${c.id}/status`, { status: 'confirmed' });
      assert.equal((await book(slot(t, d, '16:00', '1'))).status, 400, 'confirmed band qiladi');
    });
    it('bekor qilingan bronni qayta faollashtirish: stol band bo\'lsa 400, bo\'sh bo\'lsa 200', async () => {
      const t = await table(); const d = day();
      const a = must(await book(slot(t, d, '12:00', '1')), 201);
      await cust('PATCH', `/api/reservations/${a.id}/cancel`);
      const b = must(await book(slot(t, d, '12:00', '1')), 201);
      assert.equal((await adm('PATCH', `/api/reservations/${a.id}/status`, { status: 'confirmed' })).status, 400, 'boshqa bron bilan kesishadi');
      await cust('PATCH', `/api/reservations/${b.id}/cancel`);
      assert.equal((await adm('PATCH', `/api/reservations/${a.id}/status`, { status: 'confirmed' })).status, 200);
    });
    it('PARALLEL: bir xil stol va vaqtga 8 ta so\'rov -> faqat bittasi 201', async () => {
      const t = await table(); const d = day();
      const rs = await Promise.all(Array.from({ length: 8 }, () => book(slot(t, d, '20:00', '1'))));
      const ok = rs.filter((r) => r.status === 201).length;
      assert.ok(rs.every((r) => [201, 400].includes(r.status)), rs.map((r) => r.status).join());
      assert.equal(ok, 1, `faqat bitta bron bo'lishi kerak, lekin ${ok} ta: ${rs.map((r) => r.status)}`);
    });
  });

  describe('validatsiya', () => {
    it('mehmonlar soni stol sig\'imidan ko\'p -> 400; aynan teng -> 201; 0 yoki manfiy -> 400', async () => {
      const t = await table(2); const d = day();
      assert.equal((await book(slot(t, d, '10:00', '1', { guests_count: 3 }))).status, 400);
      assert.equal((await book(slot(t, d, '10:00', '1', { guests_count: 0 }))).status, 400);
      assert.equal((await book(slot(t, d, '10:00', '1', { guests_count: -1 }))).status, 400);
      assert.equal((await book(slot(t, d, '10:00', '1', { guests_count: 2 }))).status, 201);
    });
    it('boshqa restoran stoli / mavjud bo\'lmagan stol -> 400', async () => {
      const other = must(await call('POST', `/api/restaurants/${W.R2.id}/tables`, { token: T.admin2, body: { seats: 4 } }), 201);
      assert.equal((await book(slot(other, day(), '10:00', '1'))).status, 400);
      assert.equal((await book({ table: 999999, reservation_date: day(), reservation_time: '10:00' })).status, 400);
    });
    it('ish vaqti: ochilishdan oldin, yopilishdan keyin tugasa -> 400; chegara (09:00 va 22:00+1s=23:00) ruxsat', async () => {
      const t = await table(); const d = day();
      assert.equal((await book(slot(t, d, '08:59', '1'))).status, 400);
      assert.equal((await book(slot(t, d, '22:30', '1'))).status, 400);
      assert.equal((await book(slot(t, d, '22:00', '1.5'))).status, 400);
      assert.equal((await book(slot(t, d, '09:00', '1'))).status, 201);
      assert.equal((await book(slot(t, d, '22:00', '1'))).status, 201);
    });
    it('o\'tgan vaqt -> 400', async () => {
      const t = await table();
      assert.equal((await book(slot(t, '2020-01-01', '18:00', '1'))).status, 400);
    });
    for (const [name, patch] of [
      ['sana formati', { reservation_date: '12/12/2030' }],
      ['mavjud bo\'lmagan sana', { reservation_date: '2030-13-45' }],
      ['sana son', { reservation_date: 20301212 }],
      ['vaqt 24:00', { reservation_time: '24:00' }],
      ['vaqt 9:00 (nol yo\'q)', { reservation_time: '9:00' }],
      ['vaqt matn', { reservation_time: 'kechqurun' }],
      ['davomiylik 0', { duration_hours: '0' }],
      ['davomiylik 0.4 (min 0.5)', { duration_hours: '0.4' }],
      ['davomiylik 1.25 (1 xona)', { duration_hours: '1.25' }],
      ['davomiylik manfiy', { duration_hours: '-1' }],
      ['davomiylik matn', { duration_hours: 'uzoq' }],
      ['stol matn', { table: 'abc' }],
      ['stol yo\'q', { table: undefined }],
    ]) {
      it(`noto'g'ri ${name} -> 400`, async () => {
        const t = await table();
        const body = { ...slot(t, day(), '10:00', '1'), ...patch };
        const r = await book(body);
        assert.equal(r.status, 400, JSON.stringify(r.body));
      });
    }
    it('nofaol restoranda bron qilib bo\'lmaydi', async () => {
      const off = must(await call('POST', '/api/restaurants', { token: T.superadmin, body: { name: 'Off', address: 'X', phone: '+998901110000', start_time: '09:00', end_time: '22:00', is_active: false } }), 201);
      const t = must(await call('POST', `/api/restaurants/${off.id}/tables`, { token: T.superadmin, body: { seats: 4 } }), 201);
      assert.equal((await cust('POST', `/api/restaurants/${off.id}/reservations`, slot(t, day(), '10:00', '1'))).status, 400);
    });
    it('mavjud bo\'lmagan restoran 404; faqat mijoz bron qila oladi', async () => {
      assert.equal((await cust('POST', '/api/restaurants/99999/reservations', {})).status, 404);
      const t = await table();
      for (const role of ['waiter', 'cook', 'storekeeper', 'restaurant_admin', 'superadmin']) {
        assert.equal((await call('POST', `/api/restaurants/${R}/reservations`, { token: T[role], body: slot(t, day(), '10:00', '1') })).status, 403, role);
      }
    });
  });

  describe('bo\'sh stollarni topish', () => {
    it('sig\'imga ko\'ra filtrlaydi, band stolni chiqarmaydi, bekordan keyin qaytaradi', async () => {
      const small = await table(2); const big = await table(8); const d = day();
      const q = (extra = '') => cust('GET', `/api/restaurants/${R}/available-tables?reservation_date=${d}&reservation_time=18:00&duration_hours=1${extra}`);
      let ids = (await q('&guests=6')).body.map((x) => x.id);
      assert.ok(ids.includes(big.id) && !ids.includes(small.id), '6 mehmonga kichik stol mos emas');
      ids = (await q('&guests=2')).body.map((x) => x.id);
      assert.ok(ids.includes(big.id) && ids.includes(small.id));
      const b = must(await book(slot(big, d, '18:30', '1')), 201);
      ids = (await q()).body.map((x) => x.id);
      assert.ok(!ids.includes(big.id), 'kesishuvchi bron stolni chiqarmasligi kerak');
      await cust('PATCH', `/api/reservations/${b.id}/cancel`);
      assert.ok((await q()).body.map((x) => x.id).includes(big.id), 'bekordan keyin yana bo\'sh');
    });
    it('noto\'g\'ri parametrlar -> 400; ish vaqtidan tashqari -> 400; faqat mijoz', async () => {
      const base = `/api/restaurants/${R}/available-tables`;
      assert.equal((await cust('GET', base)).status, 400);
      assert.equal((await cust('GET', `${base}?reservation_date=bad&reservation_time=18:00`)).status, 400);
      assert.equal((await cust('GET', `${base}?reservation_date=${day()}&reservation_time=03:00`)).status, 400);
      assert.equal((await cust('GET', `${base}?reservation_date=${day()}&reservation_time=18:00&guests=0`)).status, 400);
      assert.equal((await call('GET', `${base}?reservation_date=${day()}&reservation_time=18:00`, { token: T.waiter })).status, 403);
    });
  });

  describe('mijoz: o\'z bronlari va bekor qilish', () => {
    it('faqat o\'z bronlari ko\'rinadi; ro\'yxatda client yo\'q', async () => {
      const t = await table();
      const mine = must(await book(slot(t, day(), '11:00', '1')), 201);
      const list = (await cust('GET', '/api/reservations/my')).body;
      assert.ok(list.results.some((x) => x.id === mine.id));
      assert.ok(list.results.every((x) => x.client === undefined));
      assert.ok(!(await call('GET', '/api/reservations/my', { token: c2 })).body.results.some((x) => x.id === mine.id));
    });
    it('boshqa mijoz bronini bekor qila olmaydi (404), o\'zi qila oladi, qayta bekor 200', async () => {
      const t = await table();
      const r = must(await book(slot(t, day(), '11:00', '1')), 201);
      assert.equal((await call('PATCH', `/api/reservations/${r.id}/cancel`, { token: c2 })).status, 404);
      assert.equal((await cust('PATCH', `/api/reservations/${r.id}/cancel`)).body.status, 'cancelled');
      assert.equal((await cust('PATCH', `/api/reservations/${r.id}/cancel`)).status, 200);
    });
    it('yopilgan (completed) bronni bekor qilib bo\'lmaydi', async () => {
      const t = await table();
      const r = must(await book(slot(t, day(), '11:00', '1')), 201);
      await adm('PATCH', `/api/reservations/${r.id}/status`, { status: 'completed' });
      assert.equal((await cust('PATCH', `/api/reservations/${r.id}/cancel`)).status, 400);
    });
    it('mavjud bo\'lmagan va noto\'g\'ri id lar 404', async () => {
      for (const id of ['99999', 'abc', '0', '-5', '1.5']) {
        assert.equal((await cust('PATCH', `/api/reservations/${id}/cancel`)).status, 404, id);
      }
    });
  });

  describe('admin: bronlar boshqaruvi', () => {
    it('faqat o\'z restorani bronlari; status va sana filtri', async () => {
      const t = await table(); const d = day();
      const a = must(await book(slot(t, d, '10:00', '1')), 201);
      const b = must(await book(slot(t, d, '12:00', '1')), 201);
      await adm('PATCH', `/api/reservations/${b.id}/status`, { status: 'confirmed' });
      const all = (await adm('GET', `/api/reservations?date=${d}`)).body;
      assert.deepEqual(all.results.map((x) => x.id).sort(), [a.id, b.id].sort());
      const conf = (await adm('GET', `/api/reservations?date=${d}&status=confirmed`)).body;
      assert.deepEqual(conf.results.map((x) => x.id), [b.id]);
      const other = (await call('GET', '/api/reservations', { token: T.admin2 })).body;
      assert.ok(!other.results.some((x) => x.id === a.id), 'boshqa restoran admini ko\'rmasligi kerak');
    });
    it('status: faqat 4 ta qiymat; mavjud bo\'lmagan 404; bo\'sh body 400; mijoz o\'zgartira olmaydi', async () => {
      const t = await table();
      const r = must(await book(slot(t, day(), '10:00', '1')), 201);
      assert.equal((await adm('PATCH', `/api/reservations/${r.id}/status`, { status: 'paid' })).status, 400);
      assert.equal((await adm('PATCH', `/api/reservations/${r.id}/status`, {})).status, 400);
      assert.equal((await adm('PATCH', '/api/reservations/99999/status', { status: 'confirmed' })).status, 404);
      assert.equal((await cust('PATCH', `/api/reservations/${r.id}/status`, { status: 'confirmed' })).status, 403);
      for (const s of ['confirmed', 'completed', 'cancelled', 'pending']) {
        assert.equal((await adm('PATCH', `/api/reservations/${r.id}/status`, { status: s })).body.status, s);
      }
    });
    it('filtr qiymatlari xavfsiz: noto\'g\'ri status/sana va operator injection 500 bermaydi', async () => {
      for (const qs of ['status=hack', 'date=garbage', 'date[$ne]=x', 'date[$gt]=2000-01-01', 'status[$ne]=pending', 'date=a&date=b', 'status=pending&status=cancelled']) {
        const r = await adm('GET', `/api/reservations?${qs}`);
        assert.ok(r.status < 500, `${qs} -> ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`);
        if (r.status === 200) {
          // boshqa restoran ma'lumotiga o'tib ketmasligi kerak
          assert.ok(r.body.results.every((x) => x.restaurant.name === 'Nukus Grill'), qs);
        }
      }
    });
  });
});

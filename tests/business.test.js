const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, buildWorld, login, must, adminToken } = require('./helpers');

describe('Biznes mantiq: stol, buyurtma, oshxona, ombor', () => {
  let srv; let call; let W; let R; let T;
  before(async () => {
    srv = await startServer();
    call = srv.call;
    W = await buildWorld(srv);
    R = W.R1.id; T = W.T;
  });
  after(() => srv.stop());

  // Qisqa yordamchilar
  const adm = (m, u, b) => call(m, u, { token: T.restaurant_admin, body: b });
  const wtr = (m, u, b) => call(m, u, { token: T.waiter, body: b });
  const cook = (m, u, b) => call(m, u, { token: T.cook, body: b });
  const stk = (m, u, b) => call(m, u, { token: T.storekeeper, body: b });
  const newTable = async (seats = 4) => must(await adm('POST', `/api/restaurants/${R}/tables`, { seats }), 201);
  const newOrder = async (table) => must(await wtr('POST', `/api/restaurants/${R}/orders`, table ? { table } : {}), 201);
  const newDish = async (price = '1000', extra = {}) => must(await adm('POST', `/api/categories/${W.category.id}/dishes`, { name: `Taom ${Math.random().toString(36).slice(2, 7)}`, price, ...extra }), 201);
  const newIng = async (stock, unit = 'kg') => must(await stk('POST', `/api/restaurants/${R}/ingredients`, { name: `Ing ${Math.random().toString(36).slice(2, 7)}`, unit, current_stock: stock }), 201);
  const addItem = async (order, dish, quantity = 1) => must(await wtr('POST', `/api/orders/${order}/items`, { dish, quantity }), 201);
  const tableStatus = async (id) => (await adm('GET', `/api/tables/${id}`)).body.status;
  const stock = async (id) => Number((await stk('GET', `/api/ingredients/${id}`)).body.current_stock);

  describe('stol holati buyurtma bilan sinxron', () => {
    it('buyurtma ochilsa occupied, yopilsa free', async () => {
      const t = await newTable();
      assert.equal(await tableStatus(t.id), 'free');
      const o = await newOrder(t.id);
      assert.equal(await tableStatus(t.id), 'occupied');
      must(await wtr('PATCH', `/api/orders/${o.id}/status`, { status: 'closed' }), 200);
      assert.equal(await tableStatus(t.id), 'free');
    });
    it('bitta stolda ikkita ochiq buyurtma: ikkalasi yopilgandagina free', async () => {
      const t = await newTable();
      const a = await newOrder(t.id); const b = await newOrder(t.id);
      await wtr('PATCH', `/api/orders/${a.id}/status`, { status: 'closed' });
      assert.equal(await tableStatus(t.id), 'occupied');
      await wtr('PATCH', `/api/orders/${b.id}/status`, { status: 'closed' });
      assert.equal(await tableStatus(t.id), 'free');
    });
    it('yopilgan buyurtmani qayta ochish stolni yana occupied qiladi', async () => {
      const t = await newTable(); const o = await newOrder(t.id);
      await wtr('PATCH', `/api/orders/${o.id}/status`, { status: 'closed' });
      await wtr('PATCH', `/api/orders/${o.id}/status`, { status: 'open' });
      assert.equal(await tableStatus(t.id), 'occupied');
    });
    it('buyurtmani o\'chirish stolni bo\'shatadi', async () => {
      const t = await newTable(); const o = await newOrder(t.id);
      assert.equal((await wtr('DELETE', `/api/orders/${o.id}`)).status, 204);
      assert.equal(await tableStatus(t.id), 'free');
    });
    it('buyurtma stolini almashtirish: eski free, yangi occupied', async () => {
      const t1 = await newTable(); const t2 = await newTable(); const o = await newOrder(t1.id);
      must(await wtr('PATCH', `/api/orders/${o.id}`, { table: t2.id }), 200);
      assert.equal(await tableStatus(t1.id), 'free');
      assert.equal(await tableStatus(t2.id), 'occupied');
    });
    it('boshqa restoran stoli bilan buyurtma ochib/almashtirib bo\'lmaydi (400)', async () => {
      const other = must(await call('POST', `/api/restaurants/${W.R2.id}/tables`, { token: T.admin2, body: { seats: 4 } }), 201);
      assert.equal((await wtr('POST', `/api/restaurants/${R}/orders`, { table: other.id })).status, 400);
      const o = await newOrder();
      assert.equal((await wtr('PATCH', `/api/orders/${o.id}`, { table: other.id })).status, 400);
      assert.equal((await wtr('POST', `/api/restaurants/${R}/orders`, { table: 999999 })).status, 400);
    });
    it('stolsiz buyurtma (table yo\'q) ruxsat etiladi, table_number null', async () => {
      const o = await newOrder();
      assert.equal(o.table, null); assert.equal(o.table_number, null);
    });
  });

  describe('buyurtma va taomlar', () => {
    it('jami narx: narx x soni yig\'indisi, 2 xonali string; kasr tangalar to\'g\'ri', async () => {
      const d1 = await newDish('3333.33'); const d2 = await newDish('0.10');
      const o = await newOrder();
      await addItem(o.id, d1.id, 3); await addItem(o.id, d2.id, 3);
      const got = (await wtr('GET', `/api/orders/${o.id}`)).body;
      assert.equal(got.total_order_price, '10000.29');
      assert.equal(got.order_items.length, 2);
      assert.equal(got.order_items[0].total_price, '9999.99');
    });
    it('narx nusxalanadi: taom narxi o\'zgarsa ham buyurtma summasi o\'zgarmaydi', async () => {
      const d = await newDish('2000'); const o = await newOrder();
      await addItem(o.id, d.id, 2);
      await adm('PATCH', `/api/dishes/${d.id}`, { price: '9999' });
      assert.equal((await wtr('GET', `/api/orders/${o.id}`)).body.total_order_price, '4000.00');
    });
    it('taom o\'chirilsa, buyurtmada nomi va narxi saqlanadi', async () => {
      const d = await newDish('1500'); const o = await newOrder();
      const it1 = await addItem(o.id, d.id, 2);
      const name = (await adm('GET', `/api/dishes/${d.id}`)).body.name;
      assert.equal((await adm('DELETE', `/api/dishes/${d.id}`)).status, 204);
      const got = (await wtr('GET', `/api/orders/${o.id}`)).body;
      assert.equal(got.order_items[0].dish, name);
      assert.equal(got.total_order_price, '3000.00');
      assert.ok(it1.id);
    });
    it('stop-list: mavjud bo\'lmagan taomni qo\'shib bo\'lmaydi, qaytarilsa bo\'ladi', async () => {
      const d = await newDish(); const o = await newOrder();
      await cook('PATCH', `/api/dishes/${d.id}/toggle-availability`, {});
      assert.equal((await wtr('POST', `/api/orders/${o.id}/items`, { dish: d.id, quantity: 1 })).status, 400);
      await cook('PATCH', `/api/dishes/${d.id}/toggle-availability`, {});
      assert.equal((await wtr('POST', `/api/orders/${o.id}/items`, { dish: d.id, quantity: 1 })).status, 201);
    });
    it('toggle-availability: aniq qiymat va noto\'g\'ri qiymat', async () => {
      const d = await newDish();
      assert.equal((await cook('PATCH', `/api/dishes/${d.id}/toggle-availability`, { is_available: false })).body.is_available, false);
      assert.equal((await cook('PATCH', `/api/dishes/${d.id}/toggle-availability`, { is_available: false })).body.is_available, false);
      assert.equal((await cook('PATCH', `/api/dishes/${d.id}/toggle-availability`, { is_available: 'maybe' })).status, 400);
    });
    it('boshqa restoran taomini qo\'shib bo\'lmaydi (400); mavjud bo\'lmagan taom 400', async () => {
      const o = await newOrder();
      const cat2 = must(await call('POST', `/api/restaurants/${W.R2.id}/categories`, { token: T.admin2, body: { name: 'C', order_index: '1' } }), 201);
      const d2 = must(await call('POST', `/api/categories/${cat2.id}/dishes`, { token: T.admin2, body: { name: 'Boshqa', price: '1' } }), 201);
      assert.equal((await wtr('POST', `/api/orders/${o.id}/items`, { dish: d2.id, quantity: 1 })).status, 400);
      assert.equal((await wtr('POST', `/api/orders/${o.id}/items`, { dish: 999999, quantity: 1 })).status, 400);
    });
    for (const [name, quantity] of [['0', 0], ['manfiy', -1], ['kasr', 1.5], ['matn', 'abc'], ['null', null], ['juda katta', 99999999999]]) {
      it(`soni noto'g'ri (${name}) -> 400`, async () => {
        const d = await newDish(); const o = await newOrder();
        const r = await wtr('POST', `/api/orders/${o.id}/items`, { dish: d.id, quantity });
        assert.equal(r.status, 400, JSON.stringify(r.body));
      });
    }
    it('yopilgan buyurtmaga taom qo\'shib bo\'lmaydi; oshxonaga yuborib bo\'lmaydi', async () => {
      const d = await newDish(); const o = await newOrder();
      await addItem(o.id, d.id);
      await wtr('PATCH', `/api/orders/${o.id}/status`, { status: 'closed' });
      assert.equal((await wtr('POST', `/api/orders/${o.id}/items`, { dish: d.id, quantity: 1 })).status, 400);
      assert.equal((await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`)).status, 400);
    });
    it('send-to-kitchen: faqat new taomlar yuboriladi; yangi taom bo\'lmasa 400; keyin qo\'shilgani yana yuboriladi', async () => {
      const d = await newDish(); const o = await newOrder();
      assert.equal((await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`)).status, 400, 'bo\'sh buyurtma');
      await addItem(o.id, d.id); await addItem(o.id, d.id, 2);
      const r = must(await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`), 200);
      assert.equal(r.sent_items, 2);
      assert.equal((await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`)).status, 400);
      await addItem(o.id, d.id);
      assert.equal(must(await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`), 200).sent_items, 1);
    });
    it('quantity: faqat new taomga qo\'shiladi; yuborilgandan keyin 400; noto\'g\'ri quantity_add 400', async () => {
      const d = await newDish(); const o = await newOrder();
      const i = await addItem(o.id, d.id, 2);
      must(await wtr('PATCH', `/api/order-items/${i.id}/quantity`, { quantity_add: 3 }), 200);
      assert.equal((await wtr('GET', `/api/orders/${o.id}`)).body.order_items[0].quantity, 5);
      for (const bad of [0, -1, 'x', 1.5, null, undefined]) {
        assert.equal((await wtr('PATCH', `/api/order-items/${i.id}/quantity`, bad === undefined ? {} : { quantity_add: bad })).status, 400, String(bad));
      }
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      assert.equal((await wtr('PATCH', `/api/order-items/${i.id}/quantity`, { quantity_add: 1 })).status, 400);
    });
    it('payment_method: faqat cash/card/unset', async () => {
      const o = await newOrder();
      assert.equal(o.payment_method, 'unset');
      assert.equal((await wtr('PATCH', `/api/orders/${o.id}`, { payment_method: 'card' })).body.payment_method, 'card');
      assert.equal((await wtr('PATCH', `/api/orders/${o.id}`, { payment_method: 'bitcoin' })).status, 400);
      assert.equal((await wtr('PATCH', `/api/orders/${o.id}/status`, { status: 'paid' })).status, 400);
    });
    it('ro\'yxat filtrlari: status, table, mine', async () => {
      const t = await newTable();
      const mine = await newOrder(t.id);
      const other = must(await call('POST', `/api/restaurants/${R}/orders`, { token: T.restaurant_admin, body: { table: t.id } }), 201);
      await wtr('PATCH', `/api/orders/${other.id}/status`, { status: 'closed' }).catch(() => {});
      await adm('PATCH', `/api/orders/${other.id}/status`, { status: 'closed' });
      const byTable = (await wtr('GET', `/api/restaurants/${R}/orders?table=${t.id}`)).body;
      assert.equal(byTable.count, 2);
      assert.equal((await wtr('GET', `/api/restaurants/${R}/orders?table=${t.id}&status=open`)).body.count, 1);
      assert.equal((await wtr('GET', `/api/restaurants/${R}/orders?table=${t.id}&status=closed`)).body.count, 1);
      const m = (await wtr('GET', `/api/restaurants/${R}/orders?table=${t.id}&mine=true`)).body;
      assert.equal(m.count, 1); assert.equal(m.results[0].id, mine.id);
      assert.equal((await wtr('GET', `/api/restaurants/${R}/orders?status=hack`)).status, 200, 'noto\'g\'ri status e\'tiborsiz qoldiriladi');
    });
    it('waiter o\'zgarmas: buyurtmani ochgan ofitsiant tokendan olinadi (body dagi waiter e\'tiborsiz)', async () => {
      const o = must(await wtr('POST', `/api/restaurants/${R}/orders`, { waiter: 1 }), 201);
      const waiterUser = (await wtr('GET', '/api/users/me')).body;
      assert.equal(o.waiter, waiterUser.id);
    });
  });

  describe('oshxona (KDS)', () => {
    const sentItem = async (qty = 1, dishId) => {
      const d = dishId ? { id: dishId } : await newDish();
      const o = await newOrder(); const i = await addItem(o.id, d.id, qty);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      return { o, i, d };
    };
    it('navbatda faqat sent va cooking, eng eskisi birinchi; ready chiqib ketadi', async () => {
      const a = await sentItem(); const b = await sentItem();
      let q = (await cook('GET', '/api/kitchen/items?page=1')).body;
      const ids = q.results.map((x) => x.id);
      assert.ok(ids.indexOf(a.i.id) < ids.indexOf(b.i.id));
      must(await cook('PATCH', `/api/kitchen/items/${a.i.id}/status`, { status: 'ready' }), 200);
      q = (await cook('GET', '/api/kitchen/items')).body;
      assert.ok(!q.results.some((x) => x.id === a.i.id));
      assert.ok(q.results.every((x) => ['sent', 'cooking'].includes(x.status)));
    });
    it('yuborilmagan (new) taom navbatda ko\'rinmaydi va statusini o\'zgartirib bo\'lmaydi', async () => {
      const d = await newDish(); const o = await newOrder(); const i = await addItem(o.id, d.id);
      assert.ok(!(await cook('GET', '/api/kitchen/items')).body.results.some((x) => x.id === i.id));
      assert.equal((await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' })).status, 400);
    });
    it('statuslar faqat oldinga: sent->cooking->ready; orqaga, takror va noto\'g\'ri 400', async () => {
      const { i } = await sentItem();
      const set = (status) => cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status });
      assert.equal((await set('sent')).status, 400);
      assert.equal((await set('new')).status, 400);
      assert.equal((await set('bogus')).status, 400);
      assert.equal((await set('cooking')).status, 200);
      assert.equal((await set('cooking')).status, 400);
      assert.equal((await set('ready')).status, 200);
      assert.equal((await set('cooking')).status, 400);
      assert.equal((await set('ready')).status, 400);
    });
    it('KDS elementi shakli: table_number string, waiter_name, waiting_time_minutes', async () => {
      const t = await newTable(); const d = await newDish(); const o = await newOrder(t.id);
      const i = await addItem(o.id, d.id, 2);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      const k = (await cook('GET', '/api/kitchen/items')).body.results.find((x) => x.id === i.id);
      assert.equal(k.table_number, String(t.number));
      assert.equal(k.quantity, 2); assert.equal(k.status, 'sent');
      assert.equal(typeof k.waiter_name, 'string'); assert.ok(k.waiter_name.length > 0);
      assert.ok(Number.isInteger(k.waiting_time_minutes) && k.waiting_time_minutes >= 0);
    });
    it('boshqa restoran oshpazi/admini bu navbatni ko\'rmaydi', async () => {
      const { i } = await sentItem();
      const q = (await call('GET', '/api/kitchen/items', { token: T.admin2 })).body;
      assert.ok(!q.results.some((x) => x.id === i.id));
      assert.equal((await call('PATCH', `/api/kitchen/items/${i.id}/status`, { token: T.admin2, body: { status: 'cooking' } })).status, 403);
    });
  });

  describe('ombor: retsept bo\'yicha yechish, kirim va chiqim', () => {
    it('cooking da retsept bo\'yicha aniq miqdor yechiladi (5 gr x 3 = 0.015 kg), tarixga out yoziladi', async () => {
      const ing = await newIng('1'); const d = await newDish();
      must(await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '5', unit: 'gr' }), 201);
      const o = await newOrder(); const i = await addItem(o.id, d.id, 3);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      must(await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' }), 200);
      assert.equal(await stock(ing.id), 0.985);
      const tx = (await stk('GET', `/api/restaurants/${R}/stock-transactions`)).body.results.find((x) => x.ingredient === ing.id && x.type === 'out');
      assert.ok(tx); assert.equal(Number(tx.quantity), 0.015);
    });
    it('ready ga o\'tganda qayta yechilmaydi; sent->ready bevosita bo\'lsa ham bir marta yechiladi', async () => {
      const ing = await newIng('1'); const d = await newDish();
      await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '100', unit: 'gr' });
      const o = await newOrder(); const i = await addItem(o.id, d.id, 1);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' });
      await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'ready' });
      assert.equal(await stock(ing.id), 0.9);
      const o2 = await newOrder(); const i2 = await addItem(o2.id, d.id, 1);
      await wtr('POST', `/api/orders/${o2.id}/send-to-kitchen`);
      await cook('PATCH', `/api/kitchen/items/${i2.id}/status`, { status: 'ready' });
      assert.equal(await stock(ing.id), 0.8);
    });
    it('birlik konvertatsiyasi: mg, ml, l, kg, none', async () => {
      const kg = await newIng('10'); const l = await newIng('10', 'l');
      const d = await newDish();
      for (const [ing, qty, unit] of [[kg, '500', 'mg'], [kg, '2', 'kg'], [l, '250', 'ml'], [l, '1', 'l'], [kg, '0.5', 'none']]) {
        must(await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: qty, unit }), 201);
      }
      const o = await newOrder(); const i = await addItem(o.id, d.id, 2);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      must(await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' }), 200);
      // kg: (0.0005 + 2 + 0.5) * 2 = 5.001 ; l: (0.25 + 1) * 2 = 2.5
      assert.equal(await stock(kg.id), 4.999);
      assert.equal(await stock(l.id), 7.5);
    });
    it('birlik mos kelmasa (kg ingredientga ml) 400 va hech narsa yechilmaydi', async () => {
      const ing = await newIng('5'); const d = await newDish();
      await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '100', unit: 'ml' });
      const o = await newOrder(); const i = await addItem(o.id, d.id, 1);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      assert.equal((await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' })).status, 400);
      assert.equal(await stock(ing.id), 5);
    });
    it('ombor yetmasa 400, status o\'zgarmaydi; ikkinchi ingredient yetmasa birinchisi ham yechilmaydi', async () => {
      const rich = await newIng('10'); const poor = await newIng('0.001'); const d = await newDish();
      await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: rich.id, quantity_per_serving: '1', unit: 'kg' });
      await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: poor.id, quantity_per_serving: '1', unit: 'kg' });
      const o = await newOrder(); const i = await addItem(o.id, d.id, 1);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      const r = await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' });
      assert.equal(r.status, 400);
      assert.equal(await stock(rich.id), 10, 'qisman yechish bo\'lmasligi kerak');
      assert.equal((await wtr('GET', `/api/orders/${o.id}`)).body.order_items[0].status, 'sent', 'status oldingi holatga qaytishi kerak');
      // omborga kirim qilingach, shu taom tayyorlanadi
      await stk('PATCH', `/api/ingredients/${poor.id}/stock-in`, { quantity: '5' });
      assert.equal((await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' })).status, 200);
    });
    it('retseptsiz taom ombor bilan bog\'lanmaydi; ingredient o\'chirilgan (null) retsept qatori e\'tiborsiz', async () => {
      const d = await newDish(); const ing = await newIng('3');
      const rec = must(await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '1', unit: 'kg' }), 201);
      await stk('DELETE', `/api/ingredients/${ing.id}`);
      assert.equal((await adm('GET', `/api/dishes/${d.id}/recipe-items`)).body[0].ingredient, null);
      const o = await newOrder(); const i = await addItem(o.id, d.id);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      assert.equal((await cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' })).status, 200);
      assert.ok(rec.id);
    });
    it('retsept ingredienti boshqa restoranniki bo\'lsa 400', async () => {
      const foreign = must(await call('POST', `/api/restaurants/${W.R2.id}/ingredients`, { token: T.admin2, body: { name: 'Begona', unit: 'kg' } }), 201);
      const d = await newDish();
      assert.equal((await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: foreign.id, quantity_per_serving: '1' })).status, 400);
    });
    it('stock-in/out: kasr, manfiy, nol, ko\'p xonali kasr, sabab majburiyligi, qoldiqdan ko\'p', async () => {
      const ing = await newIng('1');
      assert.equal(Number((await stk('PATCH', `/api/ingredients/${ing.id}/stock-in`, { quantity: '0.25', reason: 'Kirim' })).body.current_stock), 1.25);
      for (const q of ['0', '-1', 'abc', '1.2345', '', null]) {
        assert.equal((await stk('PATCH', `/api/ingredients/${ing.id}/stock-in`, { quantity: q })).status, 400, `stock-in ${q}`);
      }
      assert.equal((await stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '0.1' })).status, 400, 'sabab majburiy');
      assert.equal((await stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '9', reason: 'x' })).status, 400);
      assert.equal(Number((await stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '1.25', reason: 'Buzilgan' })).body.current_stock), 0);
      assert.equal((await stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '0.001', reason: 'x' })).status, 400, 'nol qoldiqdan chiqarib bo\'lmaydi');
    });
    it('tarix: boshlang\'ich qoldiq, kirim va chiqim yozuvlari (yangilari birinchi)', async () => {
      const ing = await newIng('2');
      await stk('PATCH', `/api/ingredients/${ing.id}/stock-in`, { quantity: '1', reason: 'Partiya' });
      await stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '0.5', reason: 'Isrof' });
      const list = (await stk('GET', `/api/restaurants/${R}/stock-transactions`)).body.results.filter((x) => x.ingredient === ing.id);
      assert.deepEqual(list.map((x) => `${x.type}:${Number(x.quantity)}`), ['out:0.5', 'in:1', 'in:2']);
      assert.deepEqual(list.map((x) => x.reason), ['Isrof', 'Partiya', 'Boshlang\'ich qoldiq']);
    });
    it('ingredient nomi/birligi PATCH; qoldiq PATCH orqali o\'zgarmaydi', async () => {
      const ing = await newIng('3');
      const r = await stk('PATCH', `/api/ingredients/${ing.id}`, { name: 'Yangi nom', current_stock: '999' });
      assert.equal(r.status, 200); assert.equal(r.body.name, 'Yangi nom'); assert.equal(Number(r.body.current_stock), 3);
      assert.equal((await stk('PATCH', `/api/ingredients/${ing.id}`, { unit: 'gr' })).status, 400);
    });
  });

  describe('bir vaqtdagi so\'rovlar (race condition)', () => {
    it('bir taom ikki marta parallel "cooking" qilinsa, ombor faqat BIR marta yechiladi', async () => {
      const ing = await newIng('1'); const d = await newDish();
      await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '100', unit: 'gr' });
      const o = await newOrder(); const i = await addItem(o.id, d.id, 1);
      await wtr('POST', `/api/orders/${o.id}/send-to-kitchen`);
      const rs = await Promise.all(Array.from({ length: 6 }, () => cook('PATCH', `/api/kitchen/items/${i.id}/status`, { status: 'cooking' })));
      assert.ok(rs.every((r) => r.status < 500), rs.map((r) => r.status).join());
      assert.equal(rs.filter((r) => r.status === 200).length, 1, `faqat bitta 200: ${rs.map((r) => r.status)}`);
      assert.equal(await stock(ing.id), 0.9, 'bir marta yechilishi kerak');
      const outs = (await stk('GET', `/api/restaurants/${R}/stock-transactions`)).body.results.filter((x) => x.ingredient === ing.id && x.type === 'out');
      assert.equal(outs.length, 1);
    });
    it('parallel stock-out: qoldiqdan ko\'p chiqmaydi (manfiy bo\'lmaydi)', async () => {
      const ing = await newIng('5');
      const rs = await Promise.all(Array.from({ length: 12 }, () => stk('PATCH', `/api/ingredients/${ing.id}/stock-out`, { quantity: '1', reason: 'x' })));
      assert.equal(rs.filter((r) => r.status === 200).length, 5);
      assert.equal(rs.filter((r) => r.status === 400).length, 7);
      assert.equal(await stock(ing.id), 0);
    });
    it('parallel stock-in: yig\'indi aniq', async () => {
      const ing = await newIng('0');
      await Promise.all(Array.from({ length: 40 }, () => stk('PATCH', `/api/ingredients/${ing.id}/stock-in`, { quantity: '0.5' })));
      assert.equal(await stock(ing.id), 20);
    });
    it('raqamsiz stollar parallel yaratilsa: hammasi 201 va raqamlar noyob', async () => {
      const rs = await Promise.all(Array.from({ length: 12 }, () => adm('POST', `/api/restaurants/${R}/tables`, { seats: 2 })));
      assert.ok(rs.every((r) => r.status === 201), rs.map((r) => r.status).join());
      const nums = rs.map((r) => r.body.number);
      assert.equal(new Set(nums).size, nums.length);
    });
    it('bir xil raqamli stol parallel: faqat bittasi 201, qolganlari 400', async () => {
      const rs = await Promise.all(Array.from({ length: 6 }, () => adm('POST', `/api/restaurants/${R}/tables`, { seats: 2, number: 777 })));
      assert.equal(rs.filter((r) => r.status === 201).length, 1);
      assert.ok(rs.every((r) => [201, 400].includes(r.status)), rs.map((r) => r.status).join());
    });
    it('parallel 30 ta taom qo\'shish: hammasi saqlanadi, summa to\'g\'ri', async () => {
      const d = await newDish('100'); const o = await newOrder();
      const rs = await Promise.all(Array.from({ length: 30 }, () => wtr('POST', `/api/orders/${o.id}/items`, { dish: d.id, quantity: 2 })));
      assert.ok(rs.every((r) => r.status === 201));
      const got = (await wtr('GET', `/api/orders/${o.id}`)).body;
      assert.equal(got.order_items.length, 30);
      assert.equal(got.total_order_price, '6000.00');
      assert.equal(new Set(rs.map((r) => r.body.id)).size, 30, 'id lar noyob');
    });
    it('parallel quantity qo\'shish: yo\'qotish bo\'lmaydi', async () => {
      const d = await newDish(); const o = await newOrder(); const i = await addItem(o.id, d.id, 1);
      await Promise.all(Array.from({ length: 20 }, () => wtr('PATCH', `/api/order-items/${i.id}/quantity`, { quantity_add: 1 })));
      assert.equal((await wtr('GET', `/api/orders/${o.id}`)).body.order_items[0].quantity, 21);
    });
  });

  describe('o\'chirish zanjirlari (cascade)', () => {
    it('kategoriya o\'chirilsa taomlari ham, taomning retsepti ham o\'chadi', async () => {
      const c = must(await adm('POST', `/api/restaurants/${R}/categories`, { name: 'Vaqtinchalik', order_index: '5' }), 201);
      const d = must(await adm('POST', `/api/categories/${c.id}/dishes`, { name: 'Vaqt', price: '1' }), 201);
      const ing = await newIng('1');
      const rec = must(await adm('POST', `/api/dishes/${d.id}/recipe-items`, { ingredient: ing.id, quantity_per_serving: '1' }), 201);
      assert.equal((await adm('DELETE', `/api/categories/${c.id}`)).status, 204);
      assert.equal((await adm('GET', `/api/dishes/${d.id}`)).status, 404);
      assert.equal((await adm('PATCH', `/api/recipe-items/${rec.id}`, { quantity_per_serving: '2' })).status, 404);
      assert.equal((await adm('GET', `/api/ingredients/${ing.id}`)).status, 200, 'ingredient qoladi');
    });
    it('stol o\'chirilsa: buyurtma qoladi (stolsiz), bronlari o\'chadi', async () => {
      const t = await newTable(); const o = await newOrder(t.id);
      const rs = must(await call('POST', `/api/restaurants/${R}/reservations`, { token: T.customer, body: { table: t.id, reservation_date: require('./helpers').futureDate(20), reservation_time: '10:00' } }), 201);
      const blocked = await adm('DELETE', `/api/tables/${t.id}`);
      assert.equal(blocked.status, 400);
      assert.equal(blocked.body.code, 'table_reserved');
      assert.equal((await adm('GET', `/api/tables/${t.id}`)).status, 200, 'stol joyida');
      must(await adm('PATCH', `/api/reservations/${rs.id}/status`, { status: 'confirmed' }), 200);
      assert.equal((await adm('DELETE', `/api/tables/${t.id}`)).status, 400, 'tasdiqlangan bron ham tosadi');
      must(await call('PATCH', `/api/reservations/${rs.id}/cancel`, { token: T.customer }), 200);
      assert.equal((await adm('DELETE', `/api/tables/${t.id}`)).status, 204);
      const got = (await wtr('GET', `/api/orders/${o.id}`)).body;
      assert.equal(got.table, null);
      assert.ok(!(await call('GET', '/api/reservations/my', { token: T.customer })).body.results.some((x) => x.id === rs.id));
    });
    it('xodim o\'chirilsa login ham o\'chadi (User bilan birga)', async () => {
      const x = must(await adm('POST', `/api/restaurants/${R}/staff`, { role: 'waiter', phone_number: '+998944440001', first_name: 'O', last_name: 'chadi', password: 'Password123' }), 201);
      await login(call, '+998944440001', 'Password123');
      await adm('DELETE', `/api/staff/${x.id}`);
      assert.equal((await call('POST', '/api/auth/login', { body: { phone_number: '+998944440001', password: 'Password123' } })).status, 401);
      assert.equal(await srv.models.User.countDocuments({ phone_number: '+998944440001' }), 0);
    });
    it('restoran o\'chirilsa: unga tegishli HAMMA narsa o\'chadi, boshqa restoran tegmaydi', async () => {
      const tmp = must(await call('POST', '/api/restaurants', { token: T.superadmin, body: { name: 'Vaqtincha', address: 'X', phone: '+998901119999', start_time: '09:00', end_time: '22:00' } }), 201);
      const a2 = await call('POST', '/api/admins', { token: T.superadmin, body: { restaurant: tmp.id, phone_number: '+998944440010', first_name: 'A', last_name: 'B', password: 'Password123' } });
      assert.equal(a2.status, 201);
      const tok = (await login(call, '+998944440010', 'Password123')).access;
      const t = must(await call('POST', `/api/restaurants/${tmp.id}/tables`, { token: tok, body: { seats: 2 } }), 201);
      const c = must(await call('POST', `/api/restaurants/${tmp.id}/categories`, { token: tok, body: { name: 'K', order_index: '1' } }), 201);
      must(await call('POST', `/api/categories/${c.id}/dishes`, { token: tok, body: { name: 'T', price: '1' } }), 201);
      must(await call('POST', `/api/restaurants/${tmp.id}/ingredients`, { token: tok, body: { name: 'I', unit: 'kg', current_stock: '1' } }), 201);
      must(await call('POST', `/api/restaurants/${tmp.id}/staff`, { token: tok, body: { role: 'cook', phone_number: '+998944440011', first_name: 'C', last_name: 'D', password: 'Password123' } }), 201);
      must(await call('POST', `/api/restaurants/${tmp.id}/orders`, { token: tok, body: { table: t.id } }), 201);
      assert.equal((await call('DELETE', `/api/restaurants/${tmp.id}`, { token: T.superadmin })).status, 204);
      const m = srv.models;
      for (const [name, Model] of Object.entries({ Table: m.Table, Category: m.Category, Dish: m.Dish, Ingredient: m.Ingredient, Order: m.Order, OrderItem: m.OrderItem, Staff: m.Staff, RestaurantAdmin: m.RestaurantAdmin, StockTransaction: m.StockTransaction })) {
        assert.equal(await Model.countDocuments({ restaurant: tmp.id }), 0, `${name} qolib ketgan`);
      }
      assert.equal(await m.User.countDocuments({ phone_number: { $in: ['+998944440010', '+998944440011'] } }), 0);
      assert.equal((await call('GET', `/api/restaurants/${W.R1.id}`, { token: T.superadmin })).status, 200);
      assert.ok((await call('GET', `/api/restaurants/${R}/tables`, { token: T.superadmin })).body.count > 0, 'boshqa restoran buzilmagan');
    });
  });

  describe('ro\'yxatlar: sahifalash, tartib, menyu', () => {
    it('sahifalash: 10 tadan, next/previous, oxirgi sahifa, hajmlar yig\'indisi', async () => {
      const R3 = must(await call('POST', '/api/restaurants', { token: T.superadmin, body: { name: 'Sahifa', address: 'S', phone: '+998901118888', start_time: '09:00', end_time: '22:00' } }), 201);
      const A3 = await adminToken(call, T.superadmin, R3.id, '+998944440031');
      for (let n = 1; n <= 25; n++) must(await call('POST', `/api/restaurants/${R3.id}/tables`, { token: A3, body: { seats: 2, number: n } }), 201);
      const p1 = (await call('GET', `/api/restaurants/${R3.id}/tables`, { token: A3 })).body;
      assert.equal(p1.count, 25); assert.equal(p1.results.length, 10); assert.equal(p1.previous, null);
      assert.match(p1.next, /page=2/);
      const p2 = (await call('GET', `/api/restaurants/${R3.id}/tables?page=2`, { token: A3 })).body;
      assert.equal(p2.results.length, 10); assert.match(p2.previous, /page=1/); assert.match(p2.next, /page=3/);
      const p3 = (await call('GET', `/api/restaurants/${R3.id}/tables?page=3`, { token: A3 })).body;
      assert.equal(p3.results.length, 5); assert.equal(p3.next, null);
      assert.deepEqual([...p1.results, ...p2.results, ...p3.results].map((x) => x.number), Array.from({ length: 25 }, (_, k) => k + 1), 'raqam bo\'yicha tartib');
    });
    for (const bad of ['0', '-1', 'abc', '1.5', '999', '', '1e2', '%20']) {
      it(`noto'g'ri page=${JSON.stringify(bad)} -> 404 (500 emas)`, async () => {
        const r = await call('GET', `/api/restaurants?page=${bad}`, { token: T.superadmin });
        assert.ok([200, 404].includes(r.status), `${r.status}`);
        if (bad !== '') assert.equal(r.status, 404);
      });
    }
    it('menyu: kategoriyalar order_index bo\'yicha, ichida taomlar', async () => {
      const R4 = must(await call('POST', '/api/restaurants', { token: T.superadmin, body: { name: 'Menyu', address: 'S', phone: '+998901117777', start_time: '09:00', end_time: '22:00' } }), 201);
      const A4 = await adminToken(call, T.superadmin, R4.id, '+998944440032');
      const mk = async (name, idx) => must(await call('POST', `/api/restaurants/${R4.id}/categories`, { token: A4, body: { name, order_index: idx } }), 201);
      const b = await mk('Ikkinchi', '2'); const a = await mk('Birinchi', '1');
      await call('POST', `/api/categories/${a.id}/dishes`, { token: A4, body: { name: 'Choy', price: '100' } });
      const menu = (await call('GET', `/api/restaurants/${R4.id}/menu`, { token: T.customer })).body;
      assert.deepEqual(menu.map((c) => c.name), ['Birinchi', 'Ikkinchi']);
      assert.equal(menu[0].dishes.length, 1); assert.equal(menu[1].dishes.length, 0);
      assert.ok(b.id);
    });
    it('restoran qidiruvi: regex maxsus belgilari xavfsiz, katta-kichik harf farqsiz', async () => {
      for (const s of ['.*', '(', '[', '\\', 'nukus', 'NUKUS']) {
        const r = await call('GET', `/api/restaurants?search=${encodeURIComponent(s)}`, { token: T.customer });
        assert.equal(r.status, 200, `search=${s}`);
      }
      assert.ok((await call('GET', '/api/restaurants?search=NUKUS', { token: T.customer })).body.count >= 1);
      assert.equal((await call('GET', '/api/restaurants?search=.*', { token: T.customer })).body.count, 0, 'regex sifatida talqin qilinmasligi kerak');
    });
    it('is_active filtri', async () => {
      const off = must(await call('POST', '/api/restaurants', { token: T.superadmin, body: { name: 'Yopiq', address: 'Y', phone: '+998901116666', start_time: '09:00', end_time: '22:00', is_active: false } }), 201);
      const r = (await call('GET', '/api/restaurants?is_active=false', { token: T.customer })).body;
      assert.ok(r.results.some((x) => x.id === off.id));
      assert.ok(r.results.every((x) => x.is_active === false));
      assert.ok((await call('GET', '/api/restaurants?is_active=true', { token: T.customer })).body.results.every((x) => x.is_active));
    });
  });
});

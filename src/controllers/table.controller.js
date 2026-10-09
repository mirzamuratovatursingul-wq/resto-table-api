const { Restaurant, Table, Reservation, Order } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, int, choice } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { removeTable } = require('../services/cascade');
const S = require('../serializers');

const ADMIN = ['restaurant_admin'];

const rules = {
  number: int({ min: 1 }),
  seats: int({ required: true, min: 1 }),
  status: choice(['free', 'occupied']),
};

const assertNumberFree = async (restaurant, number, exceptId) => {
  const dup = await Table.exists({ restaurant, number, ...(exceptId && { _id: { $ne: exceptId } }) });
  if (dup) throw new ApiError(400, 'Duplicate', { number: ['Bu raqamli stol allaqachon mavjud.'] });
};

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Berilgan sana/vaqtda faol (kutilayotgan yoki tasdiqlangan, hali tugamagan) broni bor stollar id'lari
const reservedTableIds = async (restaurant, query) => {
  const now = new Date();
  const date = query.date === undefined ? `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` : String(query.date);
  const time = query.time === undefined ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : String(query.time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'Invalid', { date: ["Sana formati noto'g'ri. YYYY-MM-DD ishlating."] });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ApiError(400, 'Invalid', { time: ["Vaqt formati noto'g'ri. HH:MM ishlating."] });
  const list = await Reservation.find({ restaurant, reservation_date: date, status: { $in: ['pending', 'confirmed'] } });
  const cur = toMin(time);
  return [...new Set(list.filter((r) => toMin(r.reservation_time) + r.duration_hours * 60 > cur).map((r) => r.table))];
};

// GET /api/restaurants/{id}/tables/?status=free|occupied|reserved&waiter=me|{id}&date=&time=&page_size=
// free — bo'sh va hozir broni yo'q; occupied — band; reserved — faol broni bor (band bo'lsa ham)
// waiter — shu ofitsiantning ochiq buyurtmasi bor stollar
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  const filter = { restaurant };
  const and = [];
  const { status, waiter } = req.query;
  if (status !== undefined) {
    if (!['free', 'occupied', 'reserved'].includes(status)) throw new ApiError(400, 'Invalid', { status: ["free, occupied yoki reserved bo'lishi kerak."] });
    if (status === 'occupied') filter.status = 'occupied';
    else {
      const ids = await reservedTableIds(restaurant, req.query);
      if (status === 'reserved') and.push({ _id: { $in: ids } });
      else { filter.status = 'free'; and.push({ _id: { $nin: ids } }); }
    }
  }
  if (waiter !== undefined) {
    const uid = waiter === 'me' ? req.user._id : Number(waiter);
    if (!Number.isInteger(Number(uid))) throw new ApiError(400, 'Invalid', { waiter: ["me yoki ofitsiant id bo'lishi kerak."] });
    and.push({ _id: { $in: await Order.find({ restaurant, waiter: uid, status: 'open' }).distinct('table') } });
  }
  if (and.length) filter.$and = and;
  res.json(await paginate(req, Table, filter, {
    sort: { number: 1 },
    serialize: async (d) => d.map(S.table),
  }));
};

// POST /api/restaurants/{id}/tables/  (number berilmasa keyingi raqam beriladi)
exports.create = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, ADMIN);
  const data = parseBody(req.body, rules);
  const explicit = data.number !== undefined;
  if (explicit) await assertNumberFree(restaurant, data.number);

  // Raqam berilmasa keyingisi olinadi; parallel so'rovlarda to'qnashuv bo'lsa qayta uriniladi
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (attempt > 0) await new Promise((r) => { setTimeout(r, Math.random() * 15); }); // to'qnashuvda tasodifiy kechikish
    if (!explicit) {
      const last = await Table.findOne({ restaurant }).sort({ number: -1 });
      data.number = last ? last.number + 1 : 1;
    }
    try {
      return res.status(201).json(S.table(await Table.create({ ...data, restaurant })));
    } catch (err) {
      if (err.code !== 11000) throw err;
      if (explicit) throw new ApiError(400, 'Duplicate', { number: ['Bu raqamli stol allaqachon mavjud.'] });
    }
  }
  throw new ApiError(409, 'Stol raqamini belgilab bo\'lmadi, qayta urinib ko\'ring.');
};

exports.retrieve = async (req, res) => {
  res.json(S.table(await findOr404(Table, req.params.id)));
};

exports.update = async (req, res) => {
  const table = await findOr404(Table, req.params.id);
  assertAccess(req, table.restaurant, ADMIN);
  const data = parseBody(req.body, rules, { partial: true });
  if (data.number !== undefined) await assertNumberFree(table.restaurant, data.number, table._id);
  table.set(data);
  await table.save();
  res.json(S.table(table));
};

exports.destroy = async (req, res) => {
  const table = await findOr404(Table, req.params.id);
  assertAccess(req, table.restaurant, ADMIN);
  // Faol (kutilayotgan yoki tasdiqlangan) broni bor stolni o'chirib bo'lmaydi: avval bron bekor qilinadi yoki yopiladi
  if (await Reservation.exists({ table: table._id, status: { $in: ['pending', 'confirmed'] } })) {
    throw new ApiError(400, 'Invalid', { detail: "Bu stol bron qilingan. Avval bronni bekor qiling yoki yoping, keyin stolni o'chiring.", code: 'table_reserved' });
  }
  await removeTable(table);
  res.status(204).end();
};

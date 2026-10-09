const { Restaurant, Table, Reservation } = require('../models');
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

// GET /api/restaurants/{id}/tables/
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  res.json(await paginate(req, Table, { restaurant }, {
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

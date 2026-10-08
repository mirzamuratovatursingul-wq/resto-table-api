const { Restaurant, Table, Reservation } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, int, date, time, decimal, choice } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const { timeToMinutes } = require('../utils/format');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { withLock } = require('../services/lock');
const S = require('../serializers');

const STATUSES = ['pending', 'completed', 'confirmed', 'cancelled'];
// Bekor qilingan yoki tugagan bronlar stolni band qilmaydi
const FREE_STATUSES = ['cancelled', 'completed'];

const invalid = (field, msg) => new ApiError(400, 'Invalid', { [field]: [msg] });

const slotRules = {
  reservation_date: date({ required: true }),
  reservation_time: time({ required: true }),
  duration_hours: decimal({ digits: 3, places: 1, min: 0.5 }),
};

// Sana/vaqt restaurant ish vaqtiga tushishi va o'tmishda bo'lmasligi kerak. Daqiqalarda [start, end) qaytaradi.
function validateSlot(restaurant, { reservation_date: day, reservation_time: at, duration_hours: hours = 1 }) {
  const start = timeToMinutes(at);
  const end = start + hours * 60;
  if (start < timeToMinutes(restaurant.start_time) || end > timeToMinutes(restaurant.end_time)) {
    throw invalid('reservation_time', `Restoran ${restaurant.start_time} - ${restaurant.end_time} oralig'ida ishlaydi.`);
  }
  if (new Date(`${day}T${at}`) < new Date()) throw invalid('reservation_date', 'O\'tgan vaqtga bron qilib bo\'lmaydi.');
  return { start, end };
}

// Berilgan bronlar orasida [start, end) bilan kesishadiganlari bormi?
const overlaps = (list, start, end) => list.some((r) => {
  const s = timeToMinutes(r.reservation_time);
  return start < s + r.duration_hours * 60 && s < end;
});

// GET /api/restaurants/{id}/available-tables?reservation_date=&reservation_time=&duration_hours=&guests=
// Mijoz bron qilishdan oldin shu vaqtda bo'sh va yetarli sig'imli stollarni ko'radi.
exports.availableTables = async (req, res) => {
  const restaurantId = parseId(req.params.id);
  const restaurant = await findOr404(Restaurant, restaurantId);
  const q = parseBody(req.query, { ...slotRules, guests: int({ min: 1 }) });
  const { start, end } = validateSlot(restaurant, q);

  const tables = await Table.find({ restaurant: restaurantId, seats: { $gte: q.guests || 1 } }).sort({ number: 1 });
  const booked = await Reservation.find({
    restaurant: restaurantId,
    reservation_date: q.reservation_date,
    status: { $nin: FREE_STATUSES },
  });
  const free = tables.filter((t) => !overlaps(booked.filter((r) => r.table === t._id), start, end));
  res.json(free.map(S.table));
};

// POST /api/restaurants/{id}/reservations/   (mijoz)
exports.create = async (req, res) => {
  const restaurantId = parseId(req.params.id);
  const restaurant = await findOr404(Restaurant, restaurantId);
  const data = parseBody(req.body, {
    table: int({ required: true, min: 1 }),
    guests_count: int({ min: 1 }),
    ...slotRules,
  });
  if (!restaurant.is_active) throw new ApiError(400, 'Restoran hozir faol emas.');

  const table = await Table.findOne({ _id: data.table, restaurant: restaurantId });
  if (!table) throw invalid('table', 'Bu restoranda bunday stol yo\'q.');
  if (data.guests_count && data.guests_count > table.seats) {
    throw invalid('guests_count', `Bu stolga ko'pi bilan ${table.seats} kishi sig'adi.`);
  }

  const { start, end } = validateSlot(restaurant, data);

  // Parallel so'rovlarda bir stol ikki marta band qilinmasligi uchun: stol va sana bo'yicha ketma-ket tekshirish
  const reservation = await withLock(`reservation:${table._id}:${data.reservation_date}`, async () => {
    const booked = await Reservation.find({
      table: table._id,
      reservation_date: data.reservation_date,
      status: { $nin: FREE_STATUSES },
    });
    if (overlaps(booked, start, end)) throw invalid('reservation_time', "Bu stol ko'rsatilgan vaqtda band.");
    return Reservation.create({
      ...data,
      restaurant: restaurantId,
      client: req.user._id,
      duration_hours: data.duration_hours ?? 1,
    });
  });
  res.status(201).json((await S.reservations([reservation]))[0]);
};

// GET /api/reservations?status=&date=   (admin o'z restorani bronlarini ko'radi)
exports.adminList = async (req, res) => {
  const filter = req.user.role === 'superadmin' ? {} : { restaurant: req.restaurantId };
  if (STATUSES.includes(req.query.status)) filter.status = req.query.status;
  // Sana faqat YYYY-MM-DD matn bo'lsa qo'llanadi (massiv/obyekt orqali filtrni buzishga yo'l qo'yilmaydi)
  if (typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) filter.reservation_date = req.query.date;
  res.json(await paginate(req, Reservation, filter, { sort: { _id: -1 }, serialize: S.reservations }));
};

// PATCH /api/reservations/{id}/status   { status }
exports.changeStatus = async (req, res) => {
  const reservation = await findOr404(Reservation, req.params.id);
  assertAccess(req, reservation.restaurant, ['restaurant_admin']);
  const { status } = parseBody(req.body, { status: choice(STATUSES, { required: true }) });
  const reactivating = FREE_STATUSES.includes(reservation.status) && !FREE_STATUSES.includes(status);
  const apply = async () => {
    if (reactivating) {
      // Bekor qilingan/yopilgan bron qayta faollashsa, stol shu vaqtda boshqa bron bilan band bo'lmasligi kerak
      const others = await Reservation.find({
        _id: { $ne: reservation._id },
        table: reservation.table,
        reservation_date: reservation.reservation_date,
        status: { $nin: FREE_STATUSES },
      });
      const start = timeToMinutes(reservation.reservation_time);
      if (overlaps(others, start, start + reservation.duration_hours * 60)) {
        throw invalid('status', 'Bu stol shu vaqtda boshqa bron bilan band, bronni qayta faollashtirib bo\'lmaydi.');
      }
    }
    reservation.status = status;
    await reservation.save();
  };
  await withLock(`reservation:${reservation.table}:${reservation.reservation_date}`, apply);
  res.json((await S.reservations([reservation]))[0]);
};

// GET /api/reservations/my   (mijozning o'z bronlari)
exports.myList = async (req, res) => {
  res.json(await paginate(req, Reservation, { client: req.user._id }, { sort: { _id: -1 }, serialize: S.myReservations }));
};

// PATCH /api/reservations/{id}/cancel
exports.cancel = async (req, res) => {
  const reservation = await findOr404(Reservation, req.params.id, { client: req.user._id });
  if (reservation.status === 'completed') throw new ApiError(400, 'Yopilgan bronni bekor qilib bo\'lmaydi.');
  reservation.status = 'cancelled';
  await reservation.save();
  res.json((await S.myReservations([reservation]))[0]);
};

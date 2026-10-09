const {
  Restaurant, Table, Order, OrderItem, Reservation, Ingredient, Dish,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { findOr404, parseId } = require('../utils/ids');
const { assertAccess } = require('../services/access');
const { dec } = require('../utils/format');

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const NAMES_LIMIT = 4;

// Buyurtmalar bo'yicha summa: { orderId -> sum } (dish_price * quantity)
async function totalsFor(orderIds) {
  if (!orderIds.length) return new Map();
  const rows = await OrderItem.aggregate([
    { $match: { order: { $in: orderIds } } },
    { $group: { _id: '$order', total: { $sum: { $multiply: ['$dish_price', '$quantity'] } } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.total]));
}

const sumOf = (orders, totals) => orders.reduce((s, o) => s + (totals.get(o._id) || 0), 0);

// GET /api/restaurants/{id}/stats?since=<ISO>&date=<YYYY-MM-DD>
// Restoran admini dashboard'i uchun hamma kartochkalar bitta so'rovda.
//  since — "bugun" boshlanishi (mijoz vaqt mintaqasida, ISO). Berilmasa server kuni boshi.
//  date  — bugungi bronlar sanasi. Berilmasa server sanasi.
exports.restaurantStats = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, ['restaurant_admin']);

  let since = new Date();
  since.setHours(0, 0, 0, 0);
  if (req.query.since !== undefined) {
    since = new Date(String(req.query.since));
    if (Number.isNaN(since.getTime())) throw new ApiError(400, 'Invalid', { since: ['Sana-vaqt formati noto\'g\'ri (ISO).'] });
  }
  let date = isoDate(new Date());
  if (req.query.date !== undefined) {
    date = String(req.query.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'Invalid', { date: ['Sana formati noto\'g\'ri. YYYY-MM-DD ishlating.'] });
  }

  const [tableCount, occupied, openOrders, closedToday, pending, todayRes, ingredients, stopDishes] = await Promise.all([
    Table.countDocuments({ restaurant }),
    Table.countDocuments({ restaurant, status: 'occupied' }),
    Order.find({ restaurant, status: 'open' }).select('_id'),
    Order.find({ restaurant, status: 'closed', closed_at: { $gte: since } }).select('_id payment_method'),
    Reservation.countDocuments({ restaurant, status: 'pending' }),
    Reservation.countDocuments({ restaurant, reservation_date: date, status: { $in: ['pending', 'confirmed'] } }),
    Ingredient.find({ restaurant }).select('name current_stock min_stock').sort({ name: 1 }),
    Dish.find({ restaurant, is_available: false }).select('name').sort({ name: 1 }),
  ]);

  const [openTotals, closedTotals] = await Promise.all([
    totalsFor(openOrders.map((o) => o._id)),
    totalsFor(closedToday.map((o) => o._id)),
  ]);

  const byMethod = (m) => sumOf(closedToday.filter((o) => o.payment_method === m), closedTotals);
  const out = ingredients.filter((i) => i.current_stock <= 0);
  const low = ingredients.filter((i) => i.current_stock > 0 && i.min_stock > 0 && i.current_stock < i.min_stock);

  res.json({
    tables: { total: tableCount, occupied, free: tableCount - occupied },
    orders: {
      open_count: openOrders.length,
      open_total: dec(sumOf(openOrders, openTotals)),
      closed_today_count: closedToday.length,
      revenue_today: dec(sumOf(closedToday, closedTotals)),
      revenue_cash: dec(byMethod('cash')),
      revenue_card: dec(byMethod('card')),
    },
    reservations: { pending, today: todayRes },
    stock: {
      out_count: out.length,
      low_count: low.length,
      out_names: out.slice(0, NAMES_LIMIT).map((i) => i.name),
      low_names: low.slice(0, NAMES_LIMIT).map((i) => i.name),
    },
    menu: {
      stop_count: stopDishes.length,
      stop_names: stopDishes.slice(0, NAMES_LIMIT).map((d) => d.name),
    },
  });
};

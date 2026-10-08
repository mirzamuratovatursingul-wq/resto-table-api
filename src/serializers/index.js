// Javob shakllari YAML schema'lariga mos (readOnly maydonlar; writeOnly lar qaytmaydi).
const {
  User, Restaurant, Table, OrderItem, RecipeItem, Order,
} = require('../models');
const { dec } = require('../utils/format');

const uniq = (arr) => [...new Set(arr.filter((x) => x != null))];

const byId = (docs) => new Map(docs.map((d) => [d._id, d]));

// ---------- oddiy ----------
exports.restaurant = (r) => ({
  id: r._id,
  name: r.name,
  address: r.address,
  phone: r.phone,
  is_active: r.is_active,
  start_time: r.start_time,
  end_time: r.end_time,
});

exports.table = (t) => ({
  id: t._id,
  restaurant: t.restaurant,
  number: t.number,
  seats: t.seats,
  status: t.status,
});

exports.category = (c) => ({
  id: c._id,
  restaurant: c.restaurant,
  name: c.name,
  order_index: c.order_index,
});

exports.dish = (d) => ({
  id: d._id,
  category: d.category,
  name: d.name,
  price: dec(d.price),
  is_available: d.is_available,
  description: d.description,
});

exports.dishDetail = async (d) => {
  const recepts = await RecipeItem.find({ dish: d._id }).select('_id').sort({ _id: 1 });
  return { ...exports.dish(d), recipe_items: recepts.map((r) => r._id) };
};

exports.ingredient = (i) => ({
  restaurant: i.restaurant,
  id: i._id,
  name: i.name,
  current_stock: dec(i.current_stock, 3),
  unit: i.unit,
});

exports.recipeItem = (r) => ({
  id: r._id,
  dish: r.dish,
  ingredient: r.ingredient,
  quantity_per_serving: dec(r.quantity_per_serving, 3),
  unit: r.unit,
});

exports.stockTransaction = (s) => ({
  id: s._id,
  type: s.type,
  quantity: dec(s.quantity, 3),
  reason: s.reason,
  created_at: s.created_at,
  ingredient: s.ingredient,
});

// ---------- foydalanuvchilar ----------
const userFields = (u) => ({
  phone_number: u.phone_number,
  first_name: u.first_name,
  last_name: u.last_name,
});

// GET /users/me/ - istalgan rol uchun (frontend login'dan keyin rolni shu yerdan biladi)
exports.me = async (user, restaurantId) => {
  const resto = restaurantId ? await Restaurant.findById(restaurantId).select('name') : null;
  return {
    id: user._id,
    ...userFields(user),
    email: user.email || null,
    role: user.role,
    restaurant: resto ? { id: resto._id, name: resto.name } : null,
  };
};

exports.restaurantAdmin = (profile, user) => ({
  id: profile._id,
  restaurant: profile.restaurant,
  ...userFields(user),
});

exports.staff = (profile, user) => ({
  id: profile._id,
  restaurant: profile.restaurant,
  role: profile.role,
  is_active: profile.is_active,
  ...userFields(user),
});

// profiles: [{ ..., user: userId }] -> serialize(profile, userDoc)
exports.withUsers = async (profiles, fn) => {
  const users = byId(await User.find({ _id: { $in: uniq(profiles.map((p) => p.user)) } }));
  // user'i o'chirilgan (yetim) profillar o'tkazib yuboriladi
  return profiles
    .filter((p) => users.has(p.user))
    .map((p) => fn(p, users.get(p.user)));
};

// ---------- buyurtmalar ----------
exports.orderItem = (i) => ({
  id: i._id,
  order: i.order,
  dish: i.dish_name,
  dish_price: dec(i.dish_price),
  quantity: i.quantity,
  status: i.status,
  note: i.note,
  total_price: dec(i.dish_price * i.quantity),
});

exports.orderItemWrite = (i) => ({
  id: i._id,
  order: i.order,
  dish: i.dish,
  quantity: i.quantity,
  status: i.status,
  note: i.note,
});

exports.orders = async (orders) => {
  const tables = byId(await Table.find({ _id: { $in: uniq(orders.map((o) => o.table)) } }));
  const items = await OrderItem.find({ order: { $in: orders.map((o) => o._id) } }).sort({ _id: 1 });
  const grouped = new Map();
  items.forEach((i) => grouped.set(i.order, [...(grouped.get(i.order) || []), i]));

  return orders.map((o) => {
    const list = grouped.get(o._id) || [];
    const total = list.reduce((sum, i) => sum + i.dish_price * i.quantity, 0);
    return {
      id: o._id,
      restaurant: o.restaurant,
      waiter: o.waiter,
      table: o.table,
      table_number: o.table && tables.get(o.table) ? tables.get(o.table).number : null,
      status: o.status,
      payment_method: o.payment_method,
      order_items: list.map(exports.orderItem),
      total_order_price: dec(total),
    };
  });
};

exports.order = async (o) => (await exports.orders([o]))[0];

// ---------- oshxona (KDS) ----------
exports.kdsItems = async (items) => {
  const orders = byId(await Order.find({ _id: { $in: uniq(items.map((i) => i.order)) } }));
  const tables = byId(await Table.find({ _id: { $in: uniq([...orders.values()].map((o) => o.table)) } }));
  const waiters = byId(await User.find({ _id: { $in: uniq([...orders.values()].map((o) => o.waiter)) } }));

  return items.map((i) => {
    const order = orders.get(i.order);
    const table = order && order.table ? tables.get(order.table) : null;
    const since = i.sent_at || i.created_at;
    return {
      id: i._id,
      order: i.order,
      table_number: table ? String(table.number) : '',
      dish_name: i.dish_name,
      quantity: i.quantity,
      status: i.status,
      waiter_name: order && waiters.get(order.waiter)
        ? `${waiters.get(order.waiter).first_name} ${waiters.get(order.waiter).last_name}`.trim()
        : '',
      waiting_time_minutes: Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000)),
    };
  });
};

// ---------- bronlar ----------
exports.reservations = async (list) => {
  const restos = byId(await Restaurant.find({ _id: { $in: uniq(list.map((r) => r.restaurant)) } }));
  const tables = byId(await Table.find({ _id: { $in: uniq(list.map((r) => r.table)) } }));
  const users = byId(await User.find({ _id: { $in: uniq(list.map((r) => r.client)) } }));

  return list.map((r) => ({
    id: r._id,
    restaurant: { name: restos.get(r.restaurant)?.name },
    table: { restaurant: r.restaurant, number: tables.get(r.table)?.number },
    client: { phone_number: users.get(r.client)?.phone_number },
    reservation_date: r.reservation_date,
    reservation_time: r.reservation_time,
    duration_hours: dec(r.duration_hours, 1),
    status: r.status,
  }));
};

// ReservationMe: client yo'q
exports.myReservations = async (list) => {
  const full = await exports.reservations(list);
  return full.map(({ client, ...rest }) => rest);
};

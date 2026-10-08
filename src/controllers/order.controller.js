const {
  Restaurant, Table, Order, OrderItem, Dish,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, int, choice, str } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { removeOrders } = require('../services/cascade');
const { syncTable } = require('../services/table.service');
const S = require('../serializers');

const WRITE = ['restaurant_admin', 'waiter'];
const READ = ['restaurant_admin', 'waiter', 'cook'];
const PAYMENT = ['cash', 'card', 'unset'];

const assertTable = async (tableId, restaurant) => {
  if (tableId == null) return;
  if (!(await Table.exists({ _id: tableId, restaurant }))) {
    throw new ApiError(400, 'Invalid', { table: ['Table does not exist in this restaurant.'] });
  }
};

// GET /api/restaurants/{id}/orders/
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, READ);
  // Filtrlar: ?status=Q|CL  ?table=<stol id>  ?mine=true (faqat o'zim ochgan buyurtmalar)
  const filter = { restaurant };
  if (['open', 'closed'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.table) filter.table = parseId(req.query.table);
  if (req.query.mine === 'true') filter.waiter = req.user._id;
  res.json(await paginate(req, Order, filter, { sort: { _id: -1 }, serialize: S.orders }));
};

// POST /api/restaurants/{id}/orders/
exports.create = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, WRITE);
  const data = parseBody(req.body, {
    table: int({ nullable: true, min: 1 }),
    payment_method: choice(PAYMENT),
  });
  await assertTable(data.table, restaurant);
  const order = await Order.create({ ...data, restaurant, waiter: req.user._id });
  await syncTable(order.table);
  res.status(201).json(await S.order(order));
};

exports.retrieve = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, READ);
  res.json(await S.order(order));
};

// PATCH /api/orders/{id}/  { table, payment_method }
exports.update = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, WRITE);
  const data = parseBody(req.body, {
    table: int({ nullable: true, min: 1 }),
    payment_method: choice(PAYMENT),
  }, { partial: true });
  if ('table' in data) await assertTable(data.table, order.restaurant);
  const oldTable = order.table;
  order.set(data);
  await order.save();
  if (oldTable !== order.table) await syncTable(oldTable);
  await syncTable(order.table);
  res.json(await S.order(order));
};

exports.destroy = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, WRITE);
  await removeOrders({ _id: order._id });
  await syncTable(order.table);
  res.status(204).end();
};

// PATCH /api/orders/{id}/status  { status: Q | CL }
exports.changeStatus = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, WRITE);
  const data = parseBody(req.body, { status: choice(['open', 'closed']) }, { partial: true });
  if (data.status) {
    order.status = data.status;
    await order.save();
    await syncTable(order.table);
  }
  res.json({ status: order.status });
};

// POST /api/orders/{id}/items
exports.addItem = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, WRITE);
  if (order.status !== 'open') throw new ApiError(400, 'Yopilgan buyurtmaga taom qoshib bolmaydi.');

  const data = parseBody(req.body, {
    dish: int({ required: true, min: 1 }),
    quantity: int({ required: true, min: 1 }),
    note: str({ nullable: true, allowBlank: true }),
  });
  const dish = await Dish.findOne({ _id: data.dish, restaurant: order.restaurant });
  if (!dish) throw new ApiError(400, 'Invalid', { dish: ['Dish does not exist in this restaurant.'] });
  if (!dish.is_available) throw new ApiError(400, 'Invalid', { dish: ['Bu taom hozir mavjud emas (stop-list).'] });

  const item = await OrderItem.create({
    order: order._id,
    restaurant: order.restaurant,
    dish: dish._id,
    dish_name: dish.name,
    dish_price: dish.price,
    quantity: data.quantity,
    note: data.note,
  });
  res.status(201).json(S.orderItemWrite(item));
};

// POST /api/orders/{id}/send-to-kitchen  yangi (J) taomlar -> AJ
exports.sendToKitchen = async (req, res) => {
  const order = await findOr404(Order, req.params.id);
  assertAccess(req, order.restaurant, WRITE);
  if (order.status !== 'open') throw new ApiError(400, 'Buyurtma yopilgan.');
  const result = await OrderItem.updateMany({ order: order._id, status: 'new' }, { status: 'sent', sent_at: new Date() });
  if (!result.modifiedCount) throw new ApiError(400, 'Oshxonaga jiberiletugin yangi taom joq.');
  res.json({ detail: 'Oshxonaga jiberildi.', sent_items: result.modifiedCount });
};

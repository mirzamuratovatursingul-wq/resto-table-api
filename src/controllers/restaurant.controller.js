const { Restaurant, RestaurantAdmin } = require('../models');
const { parseBody, str, bool, time } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { removeRestaurant } = require('../services/cascade');
const S = require('../serializers');

const rules = {
  name: str({ required: true, max: 100 }),
  address: str({ required: true, max: 150 }),
  phone: str({ required: true, max: 13 }),
  is_active: bool(),
  start_time: time({ required: true }),
  end_time: time({ required: true }),
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Superadmin restoranni admini bilan birga oladi; boshqa rollar uchun oddiy shakl
const present = async (req, docs) => (req.user.role === 'superadmin' ? S.restaurantsWithAdmin(docs) : docs.map(S.restaurant));

// GET /api/restaurants/?is_active=&search=&has_admin=&page=   (has_admin faqat superadmin uchun)
exports.list = async (req, res) => {
  const filter = {};
  if (req.user.role === 'superadmin' && ['true', 'false'].includes(req.query.has_admin)) {
    const ids = await RestaurantAdmin.distinct('restaurant');
    filter._id = req.query.has_admin === 'true' ? { $in: ids } : { $nin: ids };
  }
  if (req.query.is_active !== undefined) filter.is_active = ['true', 'True', '1'].includes(req.query.is_active);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search)), 'i');
    filter.$or = [{ name: rx }, { address: rx }];
  }
  res.json(await paginate(req, Restaurant, filter, { serialize: (d) => present(req, d) }));
};

// GET /api/restaurants/stats   (faqat superadmin) — kartochkalar uchun sonlar
exports.stats = async (req, res) => {
  const [total, active, withAdmin] = await Promise.all([
    Restaurant.countDocuments({}),
    Restaurant.countDocuments({ is_active: true }),
    RestaurantAdmin.distinct('restaurant'),
  ]);
  const withAdminCount = await Restaurant.countDocuments({ _id: { $in: withAdmin } });
  res.json({
    total, active, inactive: total - active, without_admin: total - withAdminCount,
  });
};

// POST /api/restaurants/  (faqat superadmin)
exports.create = async (req, res) => {
  const restaurant = await Restaurant.create(parseBody(req.body, rules));
  res.status(201).json((await present(req, [restaurant]))[0]);
};

exports.retrieve = async (req, res) => {
  res.json((await present(req, [await findOr404(Restaurant, req.params.id)]))[0]);
};

exports.update = async (req, res) => {
  const restaurant = await findOr404(Restaurant, req.params.id);
  // Restoran ma'lumotlarini o'z admini yoki platforma egasi (superadmin) o'zgartiradi
  if (req.user.role !== 'superadmin') assertAccess(req, restaurant._id, ['restaurant_admin']);
  restaurant.set(parseBody(req.body, rules, { partial: true }));
  await restaurant.save();
  res.json((await present(req, [restaurant]))[0]);
};

exports.destroy = async (req, res) => {
  const restaurant = await findOr404(Restaurant, parseId(req.params.id));
  await removeRestaurant(restaurant);
  res.status(204).end();
};

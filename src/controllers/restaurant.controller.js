const { Restaurant } = require('../models');
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

// GET /api/restaurants/?is_active=&search=&page=
exports.list = async (req, res) => {
  const filter = {};
  if (req.query.is_active !== undefined) filter.is_active = ['true', 'True', '1'].includes(req.query.is_active);
  if (req.query.search) {
    const rx = new RegExp(escapeRegex(String(req.query.search)), 'i');
    filter.$or = [{ name: rx }, { address: rx }];
  }
  res.json(await paginate(req, Restaurant, filter, { serialize: async (d) => d.map(S.restaurant) }));
};

// POST /api/restaurants/  (faqat superadmin)
exports.create = async (req, res) => {
  const restaurant = await Restaurant.create(parseBody(req.body, rules));
  res.status(201).json(S.restaurant(restaurant));
};

exports.retrieve = async (req, res) => {
  res.json(S.restaurant(await findOr404(Restaurant, req.params.id)));
};

exports.update = async (req, res) => {
  const restaurant = await findOr404(Restaurant, req.params.id);
  // Restoran ma'lumotlarini o'z admini yoki platforma egasi (superadmin) o'zgartiradi
  if (req.user.role !== 'superadmin') assertAccess(req, restaurant._id, ['restaurant_admin']);
  restaurant.set(parseBody(req.body, rules, { partial: true }));
  await restaurant.save();
  res.json(S.restaurant(restaurant));
};

exports.destroy = async (req, res) => {
  const restaurant = await findOr404(Restaurant, parseId(req.params.id));
  await removeRestaurant(restaurant);
  res.status(204).end();
};

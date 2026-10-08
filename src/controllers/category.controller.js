const { Restaurant, Category, Dish } = require('../models');
const { parseBody, str } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { removeCategory } = require('../services/cascade');
const S = require('../serializers');

const ADMIN = ['restaurant_admin'];

const rules = {
  name: str({ required: true, max: 50 }),
  order_index: str({ required: true, max: 3 }),
};

// GET /api/restaurants/{id}/categories/
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  res.json(await paginate(req, Category, { restaurant }, {
    sort: { order_index: 1, _id: 1 },
    serialize: async (d) => d.map(S.category),
  }));
};

// POST /api/restaurants/{id}/categories/
exports.create = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, ADMIN);
  const category = await Category.create({ ...parseBody(req.body, rules), restaurant });
  res.status(201).json(S.category(category));
};

exports.retrieve = async (req, res) => {
  res.json(S.category(await findOr404(Category, req.params.id)));
};

exports.update = async (req, res) => {
  const category = await findOr404(Category, req.params.id);
  assertAccess(req, category.restaurant, ADMIN);
  category.set(parseBody(req.body, rules, { partial: true }));
  await category.save();
  res.json(S.category(category));
};

exports.destroy = async (req, res) => {
  const category = await findOr404(Category, req.params.id);
  assertAccess(req, category.restaurant, ADMIN);
  await removeCategory(category);
  res.status(204).end();
};

// GET /api/restaurants/{id}/menu/  - mijoz va ofitsiant uchun: kategoriyalar ichida taomlar
exports.menu = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  const categories = await Category.find({ restaurant }).sort({ order_index: 1, _id: 1 });
  const dishes = await Dish.find({ restaurant }).sort({ _id: 1 });
  res.json(categories.map((c) => ({
    ...S.category(c),
    dishes: dishes.filter((d) => d.category === c._id).map(S.dish),
  })));
};

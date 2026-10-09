const {
  Restaurant, Ingredient, StockTransaction, RecipeItem,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, str, decimal, choice } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const S = require('../serializers');

const VIEW = ['restaurant_admin', 'storekeeper', 'cook'];
const STOCK = ['restaurant_admin', 'storekeeper'];

const rules = {
  name: str({ required: true, max: 100 }),
  current_stock: decimal({ digits: 10, places: 3, min: 0 }),
  unit: choice(['kg', 'l'], { required: true }),
  min_stock: decimal({ digits: 10, places: 3, min: 0 }),
};
const quantityRule = decimal({ required: true, digits: 10, places: 3, min: 0.001 });

const log = (ingredient, type, quantity, reason) => StockTransaction.create({
  restaurant: ingredient.restaurant, ingredient: ingredient._id, type, quantity, reason,
});

// GET /api/restaurants/{id}/ingredients/
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, VIEW);
  res.json(await paginate(req, Ingredient, { restaurant }, { serialize: async (d) => d.map(S.ingredient) }));
};

// POST /api/restaurants/{id}/ingredients/   (current_stock berilsa boshlang'ich qoldiq)
exports.create = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, STOCK);
  const ingredient = await Ingredient.create({ ...parseBody(req.body, rules), restaurant });
  if (ingredient.current_stock > 0) await log(ingredient, 'in', ingredient.current_stock, 'Boshlang\'ich qoldiq');
  res.status(201).json(S.ingredient(ingredient));
};

// GET /api/ingredients/{id}/
exports.retrieve = async (req, res) => {
  const ingredient = await findOr404(Ingredient, req.params.id);
  assertAccess(req, ingredient.restaurant, VIEW);
  res.json(S.ingredient(ingredient));
};

// PATCH /api/ingredients/{id}/   (name, unit va min_stock; qoldiq stock_in / stock_out orqali o'zgaradi)
exports.update = async (req, res) => {
  const ingredient = await findOr404(Ingredient, req.params.id);
  assertAccess(req, ingredient.restaurant, STOCK);
  ingredient.set(parseBody(req.body, { name: rules.name, unit: rules.unit, min_stock: rules.min_stock }, { partial: true }));
  await ingredient.save();
  res.json(S.ingredient(ingredient));
};

// DELETE /api/ingredients/{id}/
exports.destroy = async (req, res) => {
  const ingredient = await findOr404(Ingredient, req.params.id);
  assertAccess(req, ingredient.restaurant, STOCK);
  await RecipeItem.updateMany({ ingredient: ingredient._id }, { ingredient: null });
  await StockTransaction.deleteMany({ ingredient: ingredient._id });
  await ingredient.deleteOne();
  res.status(204).end();
};

// PATCH /api/ingredients/{id}/stock-in   { quantity, reason? }  - omborga kirim
exports.stockIn = async (req, res) => {
  const ingredient = await findOr404(Ingredient, req.params.id);
  assertAccess(req, ingredient.restaurant, STOCK);
  const { quantity, reason } = parseBody(req.body, { quantity: quantityRule, reason: str({ max: 200 }) });
  const updated = await Ingredient.findByIdAndUpdate(ingredient._id, { $inc: { current_stock: quantity } }, { returnDocument: 'after' });
  await log(ingredient, 'in', quantity, reason || 'Kirim');
  res.json(S.ingredient(updated));
};

// PATCH /api/ingredients/{id}/stock-out  { quantity, reason }  - isrof, yaroqsiz bo'lib qolgan mahsulotni hisobdan chiqarish
exports.stockOut = async (req, res) => {
  const ingredient = await findOr404(Ingredient, req.params.id);
  assertAccess(req, ingredient.restaurant, STOCK);
  const { quantity, reason } = parseBody(req.body, { quantity: quantityRule, reason: str({ required: true, max: 200 }) });
  const updated = await Ingredient.findOneAndUpdate(
    { _id: ingredient._id, current_stock: { $gte: quantity } },
    { $inc: { current_stock: -quantity } },
    { returnDocument: 'after' },
  );
  if (!updated) throw new ApiError(400, 'Invalid', { quantity: ['Omborda buncha mahsulot yo\'q.'] });
  await log(ingredient, 'out', quantity, reason);
  res.json(S.ingredient(updated));
};

// GET /api/restaurants/{id}/stock-transactions   (kirim-chiqim tarixi, yangilari birinchi)
exports.listTransactions = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, STOCK);
  res.json(await paginate(req, StockTransaction, { restaurant }, {
    sort: { _id: -1 },
    serialize: async (d) => d.map(S.stockTransaction),
  }));
};

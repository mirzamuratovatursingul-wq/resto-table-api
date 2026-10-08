const {
  Category, Dish, Ingredient, RecipeItem,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, str, bool, decimal, int, choice } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { removeDishes } = require('../services/cascade');
const S = require('../serializers');

const ADMIN = ['restaurant_admin'];
const KITCHEN = ['restaurant_admin', 'cook', 'storekeeper', 'waiter'];

const rules = {
  name: str({ required: true, max: 80 }),
  price: decimal({ required: true, digits: 10, places: 2, min: 0 }),
  is_available: bool(),
  description: str({ nullable: true, allowBlank: true }),
};

const recipeRules = {
  ingredient: int({ nullable: true, min: 1 }),
  quantity_per_serving: decimal({ required: true, digits: 8, places: 3, min: 0 }),
  unit: choice(['kg', 'gr', 'mg', 'l', 'ml', 'none']),
};

// GET /api/categories/{id}/dishes/
exports.listByCategory = async (req, res) => {
  const category = await findOr404(Category, req.params.id);
  res.json(await paginate(req, Dish, { category: category._id }, { serialize: async (d) => d.map(S.dish) }));
};

// POST /api/categories/{id}/dishes/
exports.create = async (req, res) => {
  const category = await findOr404(Category, req.params.id);
  assertAccess(req, category.restaurant, ADMIN);
  const dish = await Dish.create({ ...parseBody(req.body, rules), category: category._id, restaurant: category.restaurant });
  res.status(201).json(S.dish(dish));
};

exports.retrieve = async (req, res) => {
  res.json(await S.dishDetail(await findOr404(Dish, req.params.id)));
};

// PATCH /api/dishes/{id}/   (recipe_items bu yerda o'qiladi, boshqarilmaydi: /recipe-items endpointlari bor)
exports.update = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, ADMIN);
  dish.set(parseBody(req.body, rules, { partial: true }));
  await dish.save();
  res.json(await S.dishDetail(dish));
};

exports.destroy = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, ADMIN);
  await removeDishes({ _id: dish._id });
  res.status(204).end();
};

// PATCH /api/dishes/{id}/toggle-availability/  (body berilmasa qiymat teskarisiga o'zgaradi)
exports.toggleAvailability = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, ['restaurant_admin', 'cook']);
  const data = parseBody(req.body, { is_available: bool() }, { partial: true });
  dish.is_available = data.is_available === undefined ? !dish.is_available : data.is_available;
  await dish.save();
  res.json(await S.dishDetail(dish));
};

// GET /api/dishes/{id}/recipe-items
exports.listRecipe = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, KITCHEN);
  const items = await RecipeItem.find({ dish: dish._id }).sort({ _id: 1 });
  res.json(items.map(S.recipeItem));
};

// POST /api/dishes/{id}/recipe-items
exports.createRecipe = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, ADMIN);
  const data = parseBody(req.body, recipeRules);
  await checkIngredient(data.ingredient, dish.restaurant);
  res.status(201).json(S.recipeItem(await RecipeItem.create({ ...data, dish: dish._id })));
};

const checkIngredient = async (ingredientId, restaurant) => {
  if (!ingredientId) return;
  if (!(await Ingredient.exists({ _id: parseId(ingredientId), restaurant }))) {
    throw new ApiError(400, 'Invalid', { ingredient: ["Bu restoranda bunday ingredient yo'q."] });
  }
};

// PATCH /api/recipe-items/{id}
exports.updateRecipe = async (req, res) => {
  const item = await findOr404(RecipeItem, req.params.id);
  const dish = await findOr404(Dish, item.dish);
  assertAccess(req, dish.restaurant, ADMIN);
  const data = parseBody(req.body, recipeRules, { partial: true });
  await checkIngredient(data.ingredient, dish.restaurant);
  item.set(data);
  await item.save();
  res.json(S.recipeItem(item));
};

// DELETE /api/recipe-items/{id}
exports.destroyRecipe = async (req, res) => {
  const item = await findOr404(RecipeItem, req.params.id);
  const dish = await findOr404(Dish, item.dish);
  assertAccess(req, dish.restaurant, ADMIN);
  await item.deleteOne();
  res.status(204).end();
};

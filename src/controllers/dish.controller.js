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

// Retsept birligi qaysi bazaviy birlikka tegishli (stock.service dagi UNITS bilan bir xil)
const UNIT_BASE = { kg: 'kg', gr: 'kg', mg: 'kg', l: 'l', ml: 'l' };

// Saqlash paytida tekshiriladi: aks holda xato faqat tayyorlash boshlanganda, oshxonada chiqadi
const checkUnit = async (ingredientId, unit) => {
  if (!ingredientId || !UNIT_BASE[unit]) return;
  const ingredient = await Ingredient.findById(ingredientId);
  if (ingredient && UNIT_BASE[unit] !== ingredient.unit) {
    throw new ApiError(400, 'Invalid', { unit: [`"${unit}" birligi "${ingredient.name}" ingredientiga (${ingredient.unit}) mos emas.`] });
  }
};

const messages = (e) => Object.values(e.details || {}).flat().join(' ');

// Taom bilan birga keladigan retsept: "recipe_items": [{ ingredient, quantity_per_serving, unit }].
// Hammasi saqlashdan OLDIN tekshiriladi, shuning uchun yarim saqlangan taom qolmaydi.
const parseRecipeItems = async (raw, restaurant) => {
  if (!Array.isArray(raw)) throw new ApiError(400, 'Invalid', { recipe_items: ["Ro'yxat bo'lishi kerak."] });
  if (raw.length > 100) throw new ApiError(400, 'Invalid', { recipe_items: ["Ko'pi bilan 100 ta ingredient."] });
  const items = [];
  const seen = new Set();
  for (const [i, row] of raw.entries()) {
    const at = (msg) => new ApiError(400, 'Invalid', { recipe_items: [`${i + 1}-qator: ${msg}`] });
    let data;
    try {
      data = parseBody(row, { ...recipeRules, ingredient: int({ required: true, min: 1 }) });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      throw at(messages(e) || "noto'g'ri qiymat.");
    }
    if (seen.has(data.ingredient)) throw at('bu ingredient ikki marta kiritilgan.');
    seen.add(data.ingredient);
    try {
      await checkIngredient(data.ingredient, restaurant);
      await checkUnit(data.ingredient, data.unit || 'none');
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      throw at(messages(e));
    }
    items.push(data);
  }
  return items;
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
  const data = parseBody(req.body, rules);
  const items = req.body?.recipe_items === undefined ? [] : await parseRecipeItems(req.body?.recipe_items, category.restaurant);
  const dish = await Dish.create({ ...data, category: category._id, restaurant: category.restaurant });
  try {
    if (items.length) await RecipeItem.insertMany(items.map((it) => ({ ...it, dish: dish._id })));
  } catch (e) {
    await dish.deleteOne();
    throw e;
  }
  res.status(201).json(await S.dishDetail(dish));
};

exports.retrieve = async (req, res) => {
  res.json(await S.dishDetail(await findOr404(Dish, req.params.id)));
};

// PATCH /api/dishes/{id}/   (recipe_items yuborilsa retsept to'liq almashtiriladi, yuborilmasa o'zgarmaydi;
// alohida qatorlar uchun /recipe-items endpointlari ham bor)
exports.update = async (req, res) => {
  const dish = await findOr404(Dish, req.params.id);
  assertAccess(req, dish.restaurant, ADMIN);
  dish.set(parseBody(req.body, rules, { partial: true }));
  const items = req.body?.recipe_items === undefined ? null : await parseRecipeItems(req.body?.recipe_items, dish.restaurant);
  await dish.save();
  if (items) {
    await RecipeItem.deleteMany({ dish: dish._id });
    if (items.length) await RecipeItem.insertMany(items.map((it) => ({ ...it, dish: dish._id })));
  }
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
  await checkUnit(data.ingredient, data.unit);
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
  await checkUnit(data.ingredient === undefined ? item.ingredient : data.ingredient, data.unit === undefined ? item.unit : data.unit);
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

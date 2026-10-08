const {
  OrderItem, RecipeItem, Ingredient, StockTransaction,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { round } = require('../utils/format');

// Retsept birligi -> ingredient bazaviy birligi (kg yoki l)
const UNITS = {
  kg: { base: 'kg', f: 1 },
  gr: { base: 'kg', f: 0.001 },
  mg: { base: 'kg', f: 0.000001 },
  l: { base: 'l', f: 1 },
  ml: { base: 'l', f: 0.001 },
  none: null,
};

// Taom tayyorlanishi boshlanganda retsept bo'yicha ingredientlarni ombordan yechadi.
// - Faqat BIR marta yechadi (stock_consumed bayrog'i atomik band qilinadi).
// - Hammasi yetarli bo'lmasa hech narsa yechilmaydi; o'rtada xato bo'lsa, yechilganlari qaytariladi.
exports.consumeForItem = async (item, reason) => {
  if (item.stock_consumed || !item.dish) return;

  const claim = await OrderItem.updateOne({ _id: item._id, stock_consumed: false }, { stock_consumed: true });
  if (!claim.modifiedCount) return; // boshqa so'rov allaqachon yechgan

  const applied = [];
  try {
    const recipes = await RecipeItem.find({ dish: item.dish, ingredient: { $ne: null } });
    const plan = [];
    for (const r of recipes) {
      const ingredient = await Ingredient.findById(r.ingredient);
      if (!ingredient) continue;
      const conv = UNITS[r.unit];
      if (conv && conv.base !== ingredient.unit) {
        throw new ApiError(400, `Retsept birligi "${r.unit}" ingredient birligi "${ingredient.unit}" ga mos emas: ${ingredient.name}`);
      }
      const amount = round(r.quantity_per_serving * (conv ? conv.f : 1) * item.quantity);
      if (ingredient.current_stock < amount) throw new ApiError(400, `Omborda "${ingredient.name}" yetarli emas.`);
      plan.push({ ingredient, amount });
    }

    for (const { ingredient, amount } of plan) {
      const res = await Ingredient.updateOne(
        { _id: ingredient._id, current_stock: { $gte: amount } },
        { $inc: { current_stock: -amount } },
      );
      if (!res.modifiedCount) throw new ApiError(400, `Omborda "${ingredient.name}" yetarli emas.`);
      const tx = await StockTransaction.create({
        restaurant: ingredient.restaurant, ingredient: ingredient._id, type: 'out', quantity: amount, reason,
      });
      applied.push({ ingredient: ingredient._id, amount, tx: tx._id });
    }
  } catch (err) {
    for (const a of applied.reverse()) {
      await Ingredient.updateOne({ _id: a.ingredient }, { $inc: { current_stock: a.amount } });
      await StockTransaction.deleteOne({ _id: a.tx });
    }
    await OrderItem.updateOne({ _id: item._id }, { stock_consumed: false });
    throw err;
  }
};

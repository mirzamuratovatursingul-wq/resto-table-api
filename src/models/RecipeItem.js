const { createModel, ref } = require('./base');

module.exports = createModel('RecipeItem', {
  dish: ref('Dish', { required: true, index: true }),
  ingredient: ref('Ingredient', { default: null }),
  quantity_per_serving: { type: Number, required: true, min: 0 },
  unit: { type: String, enum: ['kg', 'gr', 'mg', 'l', 'ml', 'none'], default: 'none' },
});

const { createModel, ref } = require('./base');

module.exports = createModel('StockTransaction', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  ingredient: ref('Ingredient', { required: true }),
  type: { type: String, enum: ['in', 'out'], required: true },
  quantity: { type: Number, required: true },
  reason: { type: String, default: '' },
});

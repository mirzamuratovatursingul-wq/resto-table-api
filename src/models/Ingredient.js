const { createModel, ref } = require('./base');

module.exports = createModel('Ingredient', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  name: { type: String, required: true, trim: true },
  current_stock: { type: Number, default: 0 },
  unit: { type: String, enum: ['kg', 'l'], required: true },
});

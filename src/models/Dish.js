const { createModel, ref } = require('./base');

module.exports = createModel('Dish', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  category: ref('Category', { required: true, index: true }),
  name: { type: String, required: true, maxlength: 80, trim: true },
  price: { type: Number, required: true, min: 0 },
  is_available: { type: Boolean, default: true },
  description: { type: String, default: null },
});

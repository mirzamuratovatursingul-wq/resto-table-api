const { createModel, ref } = require('./base');

module.exports = createModel('Category', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  name: { type: String, required: true, maxlength: 50, trim: true },
  order_index: { type: String, required: true, maxlength: 3, trim: true },
});

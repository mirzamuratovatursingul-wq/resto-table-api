const { createModel, ref } = require('./base');

module.exports = createModel('Order', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  waiter: ref('User', { default: null }),
  table: ref('Table', { default: null }),
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  payment_method: { type: String, enum: ['cash', 'card', 'unset'], default: 'unset' },
});

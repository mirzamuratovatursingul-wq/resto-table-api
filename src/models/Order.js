const { createModel, ref } = require('./base');

module.exports = createModel('Order', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  waiter: ref('User', { default: null }),
  table: ref('Table', { default: null }),
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  payment_method: { type: String, enum: ['cash', 'card', 'unset'], default: 'unset' },
  // Yopilgan vaqt: hisobot va stol band bo'lgan vaqtni hisoblash uchun (qayta ochilsa null)
  closed_at: { type: Date, default: null },
});

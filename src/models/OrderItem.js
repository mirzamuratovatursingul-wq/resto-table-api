const { createModel, ref } = require('./base');

module.exports = createModel('OrderItem', {
  order: ref('Order', { required: true, index: true }),
  restaurant: ref('Restaurant', { required: true, index: true }),
  dish: ref('Dish', { default: null }),
  // Taom o'chirilsa ham tarix saqlanishi uchun nom va narx nusxasi
  dish_name: { type: String, default: '' },
  dish_price: { type: Number, default: 0 },
  quantity: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['new', 'sent', 'cooking', 'ready'], default: 'new' },
  note: { type: String, default: null },
  sent_at: { type: Date, default: null },
  stock_consumed: { type: Boolean, default: false },
});

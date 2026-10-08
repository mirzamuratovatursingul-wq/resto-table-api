const { createModel, ref } = require('./base');

// Restoran xodimi: ofitsiant, oshpaz yoki omborchi. Login ma'lumotlari User da turadi.
module.exports = createModel('Staff', {
  user: ref('User', { required: true, unique: true }),
  restaurant: ref('Restaurant', { required: true, index: true }),
  role: { type: String, enum: ['waiter', 'cook', 'storekeeper'], required: true },
  is_active: { type: Boolean, default: true },
});

const { createModel, ref } = require('./base');

// Restoran admini: qaysi restoranni boshqarishini bildiradi. Login ma'lumotlari User da.
module.exports = createModel('RestaurantAdmin', {
  user: ref('User', { required: true, unique: true }),
  restaurant: ref('Restaurant', { required: true, index: true }),
});

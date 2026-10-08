const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Ochiq endpointlar (token shart emas): /api/auth/*
router.use('/auth', require('./auth.routes'));

// Shundan pastdagi hamma /api/* yo'llar Bearer token talab qiladi
router.use(authenticate);
router.use('/users', require('./user.routes'));
router.use('/admins', require('./admin.routes'));
router.use('/staff', require('./staff.routes'));
router.use('/restaurants', require('./restaurant.routes'));
router.use('/tables', require('./table.routes'));
router.use('/categories', require('./category.routes'));
router.use('/dishes', require('./dish.routes'));
router.use('/recipe-items', require('./recipe.routes'));
router.use('/ingredients', require('./ingredient.routes'));
router.use('/orders', require('./order.routes'));
router.use('/order-items', require('./orderItem.routes'));
router.use('/kitchen', require('./kitchen.routes'));
router.use('/reservations', require('./reservation.routes'));

module.exports = router;

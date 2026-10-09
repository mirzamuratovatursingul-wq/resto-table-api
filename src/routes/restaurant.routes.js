const router = require('express').Router();
const { restrictStrict, superadminOnly } = require('../middlewares/auth');
const restaurant = require('../controllers/restaurant.controller');
const table = require('../controllers/table.controller');
const category = require('../controllers/category.controller');
const ingredient = require('../controllers/ingredient.controller');
const order = require('../controllers/order.controller');
const reservation = require('../controllers/reservation.controller');
const staff = require('../controllers/staff.controller');

router.route('/')
  .get(restaurant.list)
  .post(superadminOnly, restaurant.create);

router.get('/stats', superadminOnly, restaurant.stats);

router.route('/:id')
  .get(restaurant.retrieve)
  .patch(restaurant.update)
  .delete(superadminOnly, restaurant.destroy);

// Restoranga tegishli resurslar
router.route('/:id/tables').get(table.listByRestaurant).post(table.create);
router.route('/:id/categories').get(category.listByRestaurant).post(category.create);
router.get('/:id/menu', category.menu);
router.route('/:id/ingredients').get(ingredient.listByRestaurant).post(ingredient.create);
router.get('/:id/stock-transactions', ingredient.listTransactions);
router.route('/:id/orders').get(order.listByRestaurant).post(order.create);
router.route('/:id/staff').get(staff.listByRestaurant).post(staff.create);

// Bron (mijoz)
router.get('/:id/available-tables', restrictStrict('customer'), reservation.availableTables);
router.post('/:id/reservations', restrictStrict('customer'), reservation.create);

module.exports = router;

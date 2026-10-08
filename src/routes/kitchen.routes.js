const router = require('express').Router();
const { restrictTo } = require('../middlewares/auth');
const kitchen = require('../controllers/kitchen.controller');

router.use(restrictTo('restaurant_admin', 'cook'));

router.get('/items', kitchen.list);
router.patch('/items/:id/status', kitchen.changeStatus);

module.exports = router;

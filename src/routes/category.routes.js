const router = require('express').Router();
const category = require('../controllers/category.controller');
const dish = require('../controllers/dish.controller');

router.route('/:id')
  .get(category.retrieve)
  .patch(category.update)
  .delete(category.destroy);

router.route('/:id/dishes').get(dish.listByCategory).post(dish.create);

module.exports = router;

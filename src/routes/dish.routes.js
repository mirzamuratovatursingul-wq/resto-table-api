const router = require('express').Router();
const dish = require('../controllers/dish.controller');

router.route('/:id')
  .get(dish.retrieve)
  .patch(dish.update)
  .delete(dish.destroy);

router.route('/:id/recipe-items').get(dish.listRecipe).post(dish.createRecipe);
router.patch('/:id/toggle-availability', dish.toggleAvailability);

module.exports = router;

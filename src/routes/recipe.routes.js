const router = require('express').Router();
const dish = require('../controllers/dish.controller');

// Retsept qatori (taomga ingredient). Qo'shish: POST /api/dishes/:id/recipe-items
router.route('/:id')
  .patch(dish.updateRecipe)
  .delete(dish.destroyRecipe);

module.exports = router;

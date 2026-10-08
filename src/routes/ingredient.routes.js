const router = require('express').Router();
const ingredient = require('../controllers/ingredient.controller');

router.route('/:id')
  .get(ingredient.retrieve)
  .patch(ingredient.update)
  .delete(ingredient.destroy);

router.patch('/:id/stock-in', ingredient.stockIn);
router.patch('/:id/stock-out', ingredient.stockOut);

module.exports = router;

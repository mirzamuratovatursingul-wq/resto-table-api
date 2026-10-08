const router = require('express').Router();
const item = require('../controllers/orderItem.controller');

// Buyurtmadagi taom. Qo'shish: POST /api/orders/:id/items
router.delete('/:id', item.destroy);
router.patch('/:id/quantity', item.addQuantity);

module.exports = router;

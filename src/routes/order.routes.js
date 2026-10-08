const router = require('express').Router();
const order = require('../controllers/order.controller');

router.route('/:id')
  .get(order.retrieve)
  .patch(order.update)
  .delete(order.destroy);

router.patch('/:id/status', order.changeStatus);
router.post('/:id/items', order.addItem);
router.post('/:id/send-to-kitchen', order.sendToKitchen);

module.exports = router;

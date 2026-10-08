const router = require('express').Router();
const table = require('../controllers/table.controller');

router.route('/:id')
  .get(table.retrieve)
  .patch(table.update)
  .delete(table.destroy);

module.exports = router;

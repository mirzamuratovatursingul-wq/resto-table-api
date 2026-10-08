const router = require('express').Router();
const staff = require('../controllers/staff.controller');

// Xodim ustidagi amallar. Ro'yxat va yaratish: /api/restaurants/:id/staff.
// Ruxsat controller ichida restaurant bo'yicha tekshiriladi.
router.route('/:id')
  .get(staff.retrieve)
  .patch(staff.update)
  .delete(staff.destroy);

module.exports = router;

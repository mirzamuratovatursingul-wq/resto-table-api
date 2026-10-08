const router = require('express').Router();
const { superadminOnly } = require('../middlewares/auth');
const admin = require('../controllers/admin.controller');

// Restoran adminlari - faqat superadmin
router.use(superadminOnly);

router.route('/').get(admin.list).post(admin.create);
router.route('/:id')
  .get(admin.retrieve)
  .patch(admin.update)
  .delete(admin.destroy);

module.exports = router;

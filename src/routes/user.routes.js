const router = require('express').Router();
const { superadminOnly } = require('../middlewares/auth');
const user = require('../controllers/user.controller');

// Istalgan rol: o'z profili
router.route('/me').get(user.me).patch(user.updateMe);
router.post('/me/change-password', user.changePassword);

// Faqat superadmin: boshqa foydalanuvchining parolini tiklash
router.post('/reset-password', superadminOnly, user.resetPassword);

module.exports = router;

const router = require('express').Router();
const { restrictTo, restrictStrict } = require('../middlewares/auth');
const reservation = require('../controllers/reservation.controller');

// Mijoz: o'z bronlari va bekor qilish. Yaratish: POST /api/restaurants/:id/reservations
router.get('/my', restrictStrict('customer'), reservation.myList);
router.patch('/:id/cancel', restrictStrict('customer'), reservation.cancel);

// Restoran admini va ofitsiant (faqat o'qish): bronlar ro'yxati. Statusni faqat admin o'zgartiradi
router.get('/', restrictTo('restaurant_admin', 'waiter'), reservation.adminList);
router.patch('/:id/status', restrictTo('restaurant_admin'), reservation.changeStatus);

module.exports = router;

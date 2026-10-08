const router = require('express').Router();
const { restrictTo, restrictStrict } = require('../middlewares/auth');
const reservation = require('../controllers/reservation.controller');

// Mijoz: o'z bronlari va bekor qilish. Yaratish: POST /api/restaurants/:id/reservations
router.get('/my', restrictStrict('customer'), reservation.myList);
router.patch('/:id/cancel', restrictStrict('customer'), reservation.cancel);

// Restoran admini: bronlar ro'yxati va statusni o'zgartirish
router.get('/', restrictTo('restaurant_admin'), reservation.adminList);
router.patch('/:id/status', restrictTo('restaurant_admin'), reservation.changeStatus);

module.exports = router;

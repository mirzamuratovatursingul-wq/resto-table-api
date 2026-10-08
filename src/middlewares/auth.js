const { User, RestaurantAdmin, Staff } = require('../models');
const ApiError = require('../utils/ApiError');
const { verify } = require('../services/token.service');

// Authorization: Bearer <access>
// Natija: req.user (User hujjati), req.restaurantId (admin/xodim uchun o'z restauranti, aks holda null)
exports.authenticate = async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Unauthorized', { detail: 'Token yuborilmagan.', code: 'not_authenticated' });
  }

  const payload = verify(token, 'access');
  const user = await User.findById(payload.sub);
  if (!user || !user.is_active) {
    throw new ApiError(401, 'Unauthorized', { detail: 'Foydalanuvchi topilmadi yoki o\'chirilgan.', code: 'token_invalid' });
  }

  req.user = user;
  req.restaurantId = null;

  if (user.role === 'restaurant_admin') {
    const profile = await RestaurantAdmin.findOne({ user: user._id });
    req.restaurantId = profile ? profile.restaurant : null;
  } else if (['waiter', 'cook', 'storekeeper'].includes(user.role)) {
    const profile = await Staff.findOne({ user: user._id });
    if (!profile || !profile.is_active) throw new ApiError(403, 'Xodim akkaunti faol emas.');
    req.restaurantId = profile.restaurant;
  }
  next();
};

// Route darajasida rol tekshiruvi. superadmin har doim o'tadi.
const restrictTo = (...roles) => (req, res, next) => {
  if (req.user.role !== 'superadmin' && !roles.includes(req.user.role)) {
    throw new ApiError(403, 'Bu amalni bajarishga ruxsatingiz yo\'q.');
  }
  next();
};

// Qat'iy variant: superadmin ham o'tmaydi (faqat mijozga tegishli amallar, masalan bron qilish)
exports.restrictStrict = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) throw new ApiError(403, 'Bu amalni bajarishga ruxsatingiz yo\'q.');
  next();
};

exports.restrictTo = restrictTo;
exports.superadminOnly = restrictTo(); // rol berilmasa faqat superadmin

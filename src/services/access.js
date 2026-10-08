const ApiError = require('../utils/ApiError');

// Resurs qaysi restaurantga tegishli bo'lsa, foydalanuvchi shu restoranda ishlashi va roli ruxsat etilgan
// bo'lishi kerak. superadmin hammasiga ega.
exports.assertAccess = (req, restaurantId, roles = []) => {
  const { role } = req.user;
  if (role === 'superadmin') return;
  if (!roles.includes(role) || req.restaurantId !== restaurantId) {
    throw new ApiError(403, 'Bu amalni bajarishga ruxsatingiz yo\'q.');
  }
};

const ApiError = require('../utils/ApiError');

// Resurs qaysi restaurantga tegishli bo'lsa, foydalanuvchi shu restoranda ishlashi va roli ruxsat etilgan
// bo'lishi kerak. superadmin restoran ichki ma'lumotlariga (stol, buyurtma, ombor, xodim, bron) kira olmaydi:
// u faqat platforma darajasida ishlaydi (restoranlar va ularning adminlari).
exports.assertAccess = (req, restaurantId, roles = []) => {
  const { role } = req.user;
  if (!roles.includes(role) || req.restaurantId !== restaurantId) {
    throw new ApiError(403, 'Bu amalni bajarishga ruxsatingiz yo\'q.');
  }
};

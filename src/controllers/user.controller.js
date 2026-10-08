const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, str } = require('../utils/fields');
const users = require('../services/user.service');
const S = require('../serializers');

// GET /api/users/me
exports.me = async (req, res) => {
  res.json(await S.me(req.user, req.restaurantId));
};

// PATCH /api/users/me
exports.updateMe = async (req, res) => {
  const { phone_number, first_name, last_name, email } = users.userRules;
  const data = parseBody(req.body, { phone_number, first_name, last_name, email }, { partial: true });
  const user = await users.updateUser(req.user, data);
  res.json(await S.me(user, req.restaurantId));
};

// POST /api/users/reset-password  { phone_number, new_password }  (faqat superadmin)
// Parolini unutgan foydalanuvchi (mijoz, admin, xodim) uchun yangi parol o'rnatadi.
exports.resetPassword = async (req, res) => {
  const { phone_number } = users.userRules;
  const data = parseBody(req.body, {
    phone_number,
    new_password: str({ required: true, min: 8, max: 128 }),
  });
  const user = await User.findOne({ phone_number: data.phone_number });
  if (!user) throw new ApiError(404, 'Bunday telefonli foydalanuvchi topilmadi.');
  await users.changePassword(user, data.new_password);
  res.json({ detail: 'Parol tiklandi.', role: user.role });
};

// POST /api/users/me/change-password
exports.changePassword = async (req, res) => {
  const data = parseBody(req.body, {
    old_password: str({ required: true, max: 128 }),
    new_password: str({ required: true, min: 8, max: 128 }),
  });
  if (!(await users.checkPassword(req.user, data.old_password))) {
    throw new ApiError(400, 'Invalid', { old_password: ['Eski parol noto\'g\'ri.'] });
  }
  await users.changePassword(req.user, data.new_password);
  res.json({ detail: 'Parol o\'zgartirildi.' });
};

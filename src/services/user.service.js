const bcrypt = require('bcryptjs');
const { User, RestaurantAdmin, Staff } = require('../models');
const ApiError = require('../utils/ApiError');
const { str, email } = require('../utils/fields');

// Foydalanuvchi maydonlari uchun umumiy qoidalar (telefon: +998901234567)
exports.userRules = {
  phone_number: str({ required: true, pattern: /^\+?\d{9,12}$/, patternMsg: 'Telefon raqami noto\'g\'ri, masalan: +998901234567.' }),
  first_name: str({ max: 150 }),
  last_name: str({ max: 150 }),
  password: str({ min: 8, max: 128 }),
  email: email({ nullable: true }),
};

exports.checkPassword = (user, password) => bcrypt.compare(password, user.password);

async function assertPhoneFree(phone, exceptId) {
  const found = await User.findOne({ phone_number: phone, ...(exceptId && { _id: { $ne: exceptId } }) });
  if (found) throw new ApiError(400, 'Duplicate', { phone_number: ['Bu telefon raqami allaqachon ro\'yxatdan o\'tgan.'] });
}

exports.createUser = async ({ phone_number, first_name, last_name, email: mail, password, role }) => {
  await assertPhoneFree(phone_number);
  return User.create({
    phone_number,
    first_name,
    last_name,
    email: mail || null,
    password: await bcrypt.hash(password, 10),
    role,
  });
};

exports.updateUser = async (user, data) => {
  if (data.phone_number && data.phone_number !== user.phone_number) await assertPhoneFree(data.phone_number, user._id);
  const { password, ...rest } = data;
  user.set(rest);
  if (rest.email === '') user.email = null;
  if (password) user.password = await bcrypt.hash(password, 10);
  return user.save();
};

exports.changePassword = (user, newPassword) => exports.updateUser(user, { password: newPassword });

// Profil (admin/xodim) va unga tegishli User ni birga o'chirish
exports.deleteProfile = async (Model, profile) => {
  await User.deleteOne({ _id: profile.user });
  await Model.deleteOne({ _id: profile._id });
};

exports.deleteRestaurantUsers = async (restaurantId) => {
  for (const Model of [RestaurantAdmin, Staff]) {
    const profiles = await Model.find({ restaurant: restaurantId });
    await User.deleteMany({ _id: { $in: profiles.map((p) => p.user) } });
    await Model.deleteMany({ restaurant: restaurantId });
  }
};

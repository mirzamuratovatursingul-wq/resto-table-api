const {
  User, Restaurant, RestaurantAdmin, Staff,
} = require('../models');
const { Counter } = require('../models/base');
const { createUser } = require('./user.service');
const { nodeEnv, superadmin } = require('../config/env');
const initial = require('../config/initialData');

// Bazada superadmin bo'lmasa, .env dagi SUPERADMIN_PHONE / SUPERADMIN_PASSWORD bilan yaratadi.
// Superadmin bazada saqlanadi, shuning uchun alohida seed buyrug'i shart emas.
exports.ensureSuperadmin = async () => {
  if (await User.exists({ role: 'superadmin' })) return { created: false };

  const explicit = process.env.SUPERADMIN_PHONE && process.env.SUPERADMIN_PASSWORD;
  if (nodeEnv === 'production' && !explicit) {
    console.warn('Superadmin yo\'q: production da SUPERADMIN_PHONE va SUPERADMIN_PASSWORD ni .env ga yozing.');
    return { created: false };
  }

  try {
    await createUser({
      phone_number: superadmin.phone,
      first_name: process.env.SUPERADMIN_FIRST_NAME || 'Super',
      last_name: process.env.SUPERADMIN_LAST_NAME || 'Admin',
      password: superadmin.password,
      role: 'superadmin',
    });
    console.log(`Superadmin yaratildi: ${superadmin.phone}`);
    return { created: true };
  } catch (err) {
    console.warn(`Superadmin yaratilmadi: ${superadmin.phone} raqami band bo'lishi mumkin (${err.message}).`);
    return { created: false };
  }
};

// Boshlang'ich ma'lumot: bitta restoran + admin, ofitsiant, oshpaz, omborchi, mijoz.
// Faqat BIR MARTA (bazaning birinchi ishga tushishida) yaratiladi: keyin o'chirib tashlasangiz, qayta paydo bo'lmaydi.
exports.ensureInitialData = async () => {
  if (!initial.enabled) return { created: false };

  const marker = await Counter.updateOne({ _id: 'initial-data' }, { $setOnInsert: { seq: 1 } }, { upsert: true });
  if (!marker.upsertedCount) return { created: false };

  const restaurant = await Restaurant.create(initial.restaurant);
  for (const { role, ...data } of initial.accounts) {
    if (await User.exists({ phone_number: data.phone_number })) continue;
    const user = await createUser({ ...data, role });
    if (role === 'restaurant_admin') await RestaurantAdmin.create({ user: user._id, restaurant: restaurant._id });
    else if (role !== 'customer') await Staff.create({ user: user._id, restaurant: restaurant._id, role });
  }
  console.log(`Boshlang'ich ma'lumot yaratildi: restoran #${restaurant._id} va ${initial.accounts.length} ta akkaunt`);
  return { created: true };
};

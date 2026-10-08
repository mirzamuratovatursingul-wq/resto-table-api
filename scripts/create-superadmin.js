// Superadminni qo'lda yaratish: npm run seed:superadmin
// (Server ishga tushganda ham bu avtomatik bajariladi, shuning uchun odatda shart emas.)
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { ensureSuperadmin } = require('../src/services/bootstrap');
const { superadmin } = require('../src/config/env');

(async () => {
  await connectDB();
  const { created } = await ensureSuperadmin();
  console.log(created ? `Superadmin yaratildi: ${superadmin.phone}` : 'Superadmin allaqachon mavjud (yoki yaratib bo\'lmadi).');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

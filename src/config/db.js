const mongoose = require('mongoose');
const { mongoUri } = require('./env');

module.exports = async function connectDB() {
  mongoose.set('strictQuery', true);
  // Baza yo'q bo'lsa 30 soniya emas, 8 soniyada aniq xato bilan to'xtaydi
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
};

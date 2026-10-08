const Lock = require('../models/Lock');
const ApiError = require('../utils/ApiError');

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Bir xil `key` bo'yicha kodni ketma-ket bajaradi (bir vaqtda faqat bitta so'rov).
// Server qulab qolsa ham qulf `ttlMs` dan keyin yaroqsiz hisoblanadi.
exports.withLock = async (key, fn, { ttlMs = 10000, waitMs = 5000 } = {}) => {
  const started = Date.now();
  for (;;) {
    try {
      await Lock.create({ _id: key, expires_at: new Date(Date.now() + ttlMs) });
      break;
    } catch (err) {
      if (err.code !== 11000) throw err;
      await Lock.deleteOne({ _id: key, expires_at: { $lt: new Date() } }); // eskirgan qulfni olib tashlash
      if (Date.now() - started > waitMs) throw new ApiError(503, 'Server band, birozdan keyin qayta urinib ko\'ring.');
      await sleep(10 + Math.random() * 25);
    }
  }
  try {
    return await fn();
  } finally {
    await Lock.deleteOne({ _id: key });
  }
};

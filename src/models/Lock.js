const mongoose = require('mongoose');

// Qisqa muddatli qulflar (poyga holatlarini oldini olish uchun, masalan bir stolga parallel bron).
// _id unikal bo'lgani uchun faqat bitta so'rov qulfni ola oladi; muddati tugagan qulfni TTL indeks o'chiradi.
const schema = new mongoose.Schema({
  _id: String,
  expires_at: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { versionKey: false });

module.exports = mongoose.model('Lock', schema);

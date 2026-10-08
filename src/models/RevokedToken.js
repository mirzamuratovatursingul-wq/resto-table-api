const mongoose = require('mongoose');

// Logout qilingan refresh tokenlar (blacklist). TTL index muddati o'tganini o'zi o'chiradi.
const schema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expires_at: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { versionKey: false });

module.exports = mongoose.model('RevokedToken', schema);

const { createModel, ref } = require('./base');

module.exports = createModel('Table', {
  restaurant: ref('Restaurant', { required: true }),
  number: { type: Number, required: true },
  seats: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['free', 'occupied'], default: 'free' },
}, { indexes: [[{ restaurant: 1, number: 1 }, { unique: true }]] });

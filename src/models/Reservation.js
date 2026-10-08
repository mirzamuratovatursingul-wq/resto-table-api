const { createModel, ref } = require('./base');

module.exports = createModel('Reservation', {
  restaurant: ref('Restaurant', { required: true, index: true }),
  table: ref('Table', { required: true }),
  client: ref('User', { required: true, index: true }),
  guests_count: { type: Number, default: 1, min: 0 },
  status: { type: String, enum: ['pending', 'completed', 'confirmed', 'cancelled'], default: 'pending' },
  reservation_date: { type: String, required: true },
  reservation_time: { type: String, required: true },
  duration_hours: { type: Number, default: 1 },
});

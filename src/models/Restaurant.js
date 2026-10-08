const { createModel } = require('./base');

module.exports = createModel('Restaurant', {
  name: { type: String, required: true, maxlength: 100, trim: true },
  address: { type: String, required: true, maxlength: 150, trim: true },
  phone: { type: String, required: true, maxlength: 13, trim: true },
  is_active: { type: Boolean, default: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
});

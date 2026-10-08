const { createModel } = require('./base');

const ROLES = ['superadmin', 'restaurant_admin', 'waiter', 'cook', 'storekeeper', 'customer'];

const User = createModel('User', {
  phone_number: { type: String, required: true, unique: true, trim: true },
  first_name: { type: String, default: '', trim: true },
  last_name: { type: String, default: '', trim: true },
  email: { type: String, default: null, trim: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ROLES, required: true },
  is_active: { type: Boolean, default: true },
});

User.ROLES = ROLES;
module.exports = User;

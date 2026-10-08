const { Restaurant, Staff, User } = require('../models');
const { parseBody, bool, choice } = require('../utils/fields');
const { findOr404, parseId } = require('../utils/ids');
const paginate = require('../utils/paginate');
const users = require('../services/user.service');
const { assertAccess } = require('../services/access');
const S = require('../serializers');

// Xodimlarni restaurant admini (yoki superadmin) boshqaradi.
// Xodim roli = User.role (waiter | cook | storekeeper), shuning uchun ikkalasi doim sinxron.
const ADMIN = ['restaurant_admin'];
const serializeMany = (profiles) => S.withUsers(profiles, S.staff);

const rules = (creating) => {
  const { phone_number, first_name, last_name, password } = users.userRules;
  return {
    phone_number: { ...phone_number, required: creating },
    first_name: { ...first_name, required: creating },
    last_name: { ...last_name, required: creating },
    password: { ...password, required: creating },
    role: choice(['waiter', 'cook', 'storekeeper'], { required: creating }),
    is_active: bool(),
  };
};

// GET /api/restaurants/{id}/staff/
exports.listByRestaurant = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, ADMIN);
  res.json(await paginate(req, Staff, { restaurant }, { serialize: serializeMany }));
};

// POST /api/restaurants/{id}/staff/
exports.create = async (req, res) => {
  const restaurant = parseId(req.params.id);
  await findOr404(Restaurant, restaurant);
  assertAccess(req, restaurant, ADMIN);
  const { role, is_active, ...userData } = parseBody(req.body, rules(true));
  const user = await users.createUser({ ...userData, role });
  const profile = await Staff.create({ user: user._id, restaurant, role, is_active });
  res.status(201).json(S.staff(profile, user));
};

// GET /api/staff/{id}
exports.retrieve = async (req, res) => {
  const profile = await findOr404(Staff, req.params.id);
  assertAccess(req, profile.restaurant, ADMIN);
  res.json((await serializeMany([profile]))[0]);
};

// PATCH /api/staff/{id}
exports.update = async (req, res) => {
  const profile = await findOr404(Staff, req.params.id);
  assertAccess(req, profile.restaurant, ADMIN);
  const { role, is_active, ...userData } = parseBody(req.body, rules(false), { partial: true });
  const user = await User.findById(profile.user);
  if (role) {
    profile.role = role;
    user.role = role;
  }
  if (is_active !== undefined) profile.is_active = is_active;
  await profile.save();
  await users.updateUser(user, userData);
  res.json(S.staff(profile, user));
};

// DELETE /api/staff/{id}
exports.destroy = async (req, res) => {
  const profile = await findOr404(Staff, req.params.id);
  assertAccess(req, profile.restaurant, ADMIN);
  await users.deleteProfile(Staff, profile);
  res.status(204).end();
};

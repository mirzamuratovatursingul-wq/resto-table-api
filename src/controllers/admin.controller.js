const { RestaurantAdmin, Restaurant, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, int } = require('../utils/fields');
const { findOr404 } = require('../utils/ids');
const paginate = require('../utils/paginate');
const users = require('../services/user.service');
const S = require('../serializers');

// Faqat superadmin uchun: restaurant adminlarini boshqarish
const serializeMany = (profiles) => S.restaurantAdmins(profiles);

const rules = (creating) => {
  const { phone_number, first_name, last_name, password } = users.userRules;
  return {
    restaurant: int({ required: creating, min: 1 }),
    phone_number: { ...phone_number, required: creating },
    first_name: { ...first_name, required: creating },
    last_name: { ...last_name, required: creating },
    password: { ...password, required: creating },
  };
};

const assertRestaurant = async (id) => {
  if (!(await Restaurant.exists({ _id: id }))) throw new ApiError(400, 'Invalid', { restaurant: ['Bunday restaurant yo\'q.'] });
};

// GET /api/admins
exports.list = async (req, res) => {
  res.json(await paginate(req, RestaurantAdmin, {}, { serialize: serializeMany }));
};

// POST /api/admins
exports.create = async (req, res) => {
  const { restaurant, ...userData } = parseBody(req.body, rules(true));
  await assertRestaurant(restaurant);
  const user = await users.createUser({ ...userData, role: 'restaurant_admin' });
  const profile = await RestaurantAdmin.create({ user: user._id, restaurant });
  res.status(201).json((await serializeMany([profile]))[0]);
};

// GET /api/admins/{id}
exports.retrieve = async (req, res) => {
  const profile = await findOr404(RestaurantAdmin, req.params.id);
  res.json((await serializeMany([profile]))[0]);
};

// PATCH /api/admins/{id}
exports.update = async (req, res) => {
  const profile = await findOr404(RestaurantAdmin, req.params.id);
  const { restaurant, ...userData } = parseBody(req.body, rules(false), { partial: true });
  if (restaurant) {
    await assertRestaurant(restaurant);
    profile.restaurant = restaurant;
    await profile.save();
  }
  await users.updateUser(await User.findById(profile.user), userData);
  res.json((await serializeMany([profile]))[0]);
};

// DELETE /api/admins/{id}
exports.destroy = async (req, res) => {
  const profile = await findOr404(RestaurantAdmin, req.params.id);
  await users.deleteProfile(RestaurantAdmin, profile);
  res.status(204).end();
};

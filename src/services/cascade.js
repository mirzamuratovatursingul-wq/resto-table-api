// Django on_delete (CASCADE / SET_NULL) xatti-harakatini qo'lda takrorlaydi
const {
  Table, Category, Dish, Ingredient, RecipeItem, StockTransaction, Order, OrderItem, Reservation, Restaurant,
} = require('../models');
const { deleteRestaurantUsers } = require('./user.service');

const ids = (docs) => docs.map((d) => d._id);

exports.removeDishes = async (filter) => {
  const dishIds = ids(await Dish.find(filter).select('_id'));
  await RecipeItem.deleteMany({ dish: { $in: dishIds } });
  await OrderItem.updateMany({ dish: { $in: dishIds } }, { dish: null });
  await Dish.deleteMany({ _id: { $in: dishIds } });
};

exports.removeCategory = async (category) => {
  await exports.removeDishes({ category: category._id });
  await category.deleteOne();
};

exports.removeOrders = async (filter) => {
  const orderIds = ids(await Order.find(filter).select('_id'));
  await OrderItem.deleteMany({ order: { $in: orderIds } });
  await Order.deleteMany({ _id: { $in: orderIds } });
};

exports.removeTable = async (table) => {
  await Order.updateMany({ table: table._id }, { table: null });
  await Reservation.deleteMany({ table: table._id });
  await table.deleteOne();
};

exports.removeRestaurant = async (restaurant) => {
  const restaurantId = restaurant._id;
  await exports.removeOrders({ restaurant: restaurantId });
  await exports.removeDishes({ restaurant: restaurantId });
  await Category.deleteMany({ restaurant: restaurantId });
  await StockTransaction.deleteMany({ restaurant: restaurantId });
  await Ingredient.deleteMany({ restaurant: restaurantId });
  await Reservation.deleteMany({ restaurant: restaurantId });
  await Table.deleteMany({ restaurant: restaurantId });
  await deleteRestaurantUsers(restaurantId);
  await Restaurant.deleteOne({ _id: restaurantId });
};

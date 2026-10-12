// Demo ma'lumot: har xil holatdagi stollar, buyurtmalar va bronlar.
// Ishga tushirish: npm run seed:demo [restaurantId]   (standart: 2)
// Faqat qo'shadi, mavjud ma'lumotni o'chirmaydi; 2-marta ishga tushsa o'tkazib yuboradi.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { Restaurant, Table, Staff, Category, Dish, Order, OrderItem, Reservation, User } = require('../src/models');

const pad = (n) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const minutesAgo = (m) => new Date(Date.now() - m * 60000);

const DISHES = {
  Taomlar: [['Osh (palov)', 45000], ['Lagman', 38000], ['Shashlik', 18000], ['Manti', 32000], ['Sho\'rva', 30000], ['Qozon kabob', 55000]],
  Ichimliklar: [['Choy', 5000], ['Kompot', 8000], ['Coca-Cola 0.5', 10000]],
  Salatlar: [['Achichuk', 12000], ['Sezar', 35000]],
};

// [stol raqami, o'rinlar, holat]: occupied stollarga ochiq buyurtma yaratiladi
const TABLES = [
  [2, 2, 'free'], [3, 4, 'free'], [4, 4, 'occupied'], [5, 6, 'occupied'], [6, 2, 'occupied'],
  [7, 4, 'occupied'], [8, 8, 'free'], [9, 4, 'free'], [10, 10, 'occupied'],
];

// Ochiq buyurtmalar: [stol, ofitsiant indeksi, necha daqiqa oldin, [[taom, miqdor, holat]]]
const OPEN_ORDERS = [
  [4, 0, 12, [['Osh (palov)', 2, 'new'], ['Choy', 2, 'new']]],
  [5, 1, 35, [['Shashlik', 6, 'cooking'], ['Achichuk', 2, 'ready'], ['Kompot', 3, 'served']]],
  [6, 0, 50, [['Lagman', 2, 'served'], ['Choy', 2, 'served']]],
  [7, 1, 8, [['Manti', 3, 'sent'], ['Sezar', 1, 'sent'], ['Coca-Cola 0.5', 2, 'new']]],
  [10, 0, 75, [['Qozon kabob', 3, 'ready'], ['Sho\'rva', 4, 'cooking'], ['Choy', 4, 'served'], ['Achichuk', 3, 'served']]],
];

// Bugun yopilgan buyurtmalar (tushum uchun): [stol, ofitsiant, to'lov, boshlanish (daq. oldin), [[taom, miqdor]]]
const CLOSED_ORDERS = [
  [2, 0, 'cash', 240, [['Lagman', 2], ['Choy', 2]]],
  [3, 1, 'card', 200, [['Osh (palov)', 4], ['Kompot', 4]]],
  [8, 0, 'card', 150, [['Shashlik', 8], ['Achichuk', 3], ['Coca-Cola 0.5', 4]]],
  [9, 1, 'cash', 110, [['Manti', 2], ['Sho\'rva', 2]]],
];

(async () => {
  await connectDB();
  const rid = Number(process.argv[2] || 2);
  const restaurant = await Restaurant.findById(rid);
  if (!restaurant) throw new Error(`Restoran #${rid} topilmadi.`);

  if (await Table.exists({ restaurant: rid, number: { $in: TABLES.map((t) => t[0]) } })) {
    console.log(`Restoran #${rid}: demo stollar allaqachon bor, o'tkazib yuborildi.`);
    return;
  }

  const waiters = (await Staff.find({ restaurant: rid, role: 'waiter', is_active: true }).sort({ _id: 1 })).map((s) => s.user);
  if (!waiters.length) throw new Error('Restoranda ofitsiant yo\'q.');
  const client = await User.findOne({ role: 'customer' }).sort({ _id: 1 });
  const waiterAt = (i) => waiters[i % waiters.length];

  // Kategoriya va taomlar
  const dishByName = new Map();
  let idx = (await Category.countDocuments({ restaurant: rid })) + 1;
  for (const [catName, dishes] of Object.entries(DISHES)) {
    const cat = await Category.create({ restaurant: rid, name: catName, order_index: String(idx++) });
    for (const [name, price] of dishes) dishByName.set(name, await Dish.create({ restaurant: rid, category: cat._id, name, price }));
  }

  // Stollar
  const tableByNo = new Map();
  for (const [number, seats, status] of TABLES) tableByNo.set(number, await Table.create({ restaurant: rid, number, seats, status }));

  const addItems = async (order, items, statusOf) => {
    for (const [name, quantity, status] of items) {
      const dish = dishByName.get(name);
      const st = statusOf ?? status;
      await OrderItem.create({
        order: order._id, restaurant: rid, dish: dish._id, dish_name: dish.name, dish_price: dish.price, quantity, status: st,
        sent_at: st === 'new' ? null : minutesAgo(5), stock_consumed: false,
      });
    }
  };

  for (const [no, w, ago, items] of OPEN_ORDERS) {
    const order = await Order.create({ restaurant: rid, waiter: waiterAt(w), table: tableByNo.get(no)._id, status: 'open', created_at: minutesAgo(ago) });
    await addItems(order, items);
  }

  for (const [no, w, method, ago, items] of CLOSED_ORDERS) {
    const order = await Order.create({
      restaurant: rid, waiter: waiterAt(w), table: tableByNo.get(no)._id, status: 'closed', payment_method: method,
      created_at: minutesAgo(ago), closed_at: minutesAgo(ago - 50),
    });
    await addItems(order, items, 'served');
  }

  // Bugungi bronlar: bo'sh stollarga
  if (client) {
    const date = today();
    const reservations = [[3, '19:00:00', 'pending', 3], [8, '19:30:00', 'confirmed', 6], [9, '21:00:00', 'confirmed', 4], [2, '20:00:00', 'pending', 2]];
    for (const [no, time, status, guests] of reservations) {
      await Reservation.create({ restaurant: rid, table: tableByNo.get(no)._id, client: client._id, guests_count: guests, status, reservation_date: date, reservation_time: time, duration_hours: 2 });
    }
  }

  console.log(`Restoran #${rid} (${restaurant.name}): ${TABLES.length} stol, ${OPEN_ORDERS.length} ochiq va ${CLOSED_ORDERS.length} yopilgan buyurtma, ${client ? 4 : 0} bron qo'shildi.`);
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());

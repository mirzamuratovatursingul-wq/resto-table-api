const { nodeEnv } = require('./env');

// Birinchi ishga tushishda bazada tayyor turadigan restoran va har bir rol uchun bittadan akkaunt.
// Production da o'chiq (INITIAL_DATA=false bilan test rejimida ham o'chirish mumkin).
const password = process.env.INITIAL_PASSWORD || 'Password123';
const person = (role, phone_number, first_name) => ({ role, phone_number, first_name, last_name: 'Asosiy', password });

module.exports = {
  enabled: nodeEnv !== 'production' && process.env.INITIAL_DATA !== 'false',
  restaurant: {
    name: 'Asosiy restoran', address: 'Nukus shahri', phone: '+998901234567', start_time: '09:00:00', end_time: '23:00:00',
  },
  accounts: [
    person('restaurant_admin', '+998901000001', 'Admin'),
    person('waiter', '+998901000002', 'Ofitsiant'),
    person('cook', '+998901000003', 'Oshpaz'),
    person('storekeeper', '+998901000004', 'Omborchi'),
    person('customer', '+998901000005', 'Mijoz'),
  ],
};

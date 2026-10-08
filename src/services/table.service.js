const { Table, Order } = require('../models');

// Stol holati ochiq (Q) buyurtma borligiga qarab bos/bant bo'ladi
exports.syncTable = async (tableId) => {
  if (!tableId) return;
  const open = await Order.exists({ table: tableId, status: 'open' });
  await Table.updateOne({ _id: tableId }, { status: open ? 'occupied' : 'free' });
};

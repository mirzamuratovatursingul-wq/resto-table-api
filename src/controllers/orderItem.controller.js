const { OrderItem } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, int } = require('../utils/fields');
const { findOr404 } = require('../utils/ids');
const { assertAccess } = require('../services/access');
const S = require('../serializers');

const WRITE = ['restaurant_admin', 'waiter'];

exports.destroy = async (req, res) => {
  const item = await findOr404(OrderItem, req.params.id);
  assertAccess(req, item.restaurant, WRITE);
  await item.deleteOne();
  res.status(204).end();
};

// PATCH /api/order-items/{id}/serve - tayyor taom mijozga yetkazildi (ready -> served)
exports.serve = async (req, res) => {
  const item = await findOr404(OrderItem, req.params.id);
  assertAccess(req, item.restaurant, WRITE);
  const updated = await OrderItem.findOneAndUpdate({ _id: item._id, status: 'ready' }, { status: 'served' }, { returnDocument: 'after' });
  if (!updated) throw new ApiError(400, 'Faqat tayyor (ready) taomni yetkazilgan deb belgilash mumkin.');
  res.json(S.orderItem(updated));
};

// PATCH /api/order-items/{id}/quantity  { quantity_add } - sonni oshiradi
exports.addQuantity = async (req, res) => {
  const item = await findOr404(OrderItem, req.params.id);
  assertAccess(req, item.restaurant, WRITE);
  const { quantity_add: add } = parseBody(req.body, { quantity_add: int({ required: true, min: 1 }) });
  // Atomik $inc: parallel so'rovlarda qo'shilgan sonlar yo'qolmaydi. Faqat hali yuborilmagan (new) taomga.
  const updated = await OrderItem.findOneAndUpdate({ _id: item._id, status: 'new' }, { $inc: { quantity: add } }, { returnDocument: 'after' });
  if (!updated) throw new ApiError(400, 'Taom oshxonaga yuborilgan, yangi taom sifatida qo\'shing.');
  res.json({ id: updated._id, order: updated.order, dish: updated.dish });
};

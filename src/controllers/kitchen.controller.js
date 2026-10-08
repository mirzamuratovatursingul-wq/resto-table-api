const { OrderItem } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, choice } = require('../utils/fields');
const { findOr404 } = require('../utils/ids');
const paginate = require('../utils/paginate');
const { assertAccess } = require('../services/access');
const { consumeForItem } = require('../services/stock.service');
const S = require('../serializers');

const KITCHEN = ['restaurant_admin', 'cook'];

// GET /api/kitchen/items  - faqat oshxonaga yuborilgan, hali tayyor bo'lmagan taomlar
exports.list = async (req, res) => {
  const filter = { status: { $in: ['sent', 'cooking'] }, restaurant: req.restaurantId };
  res.json(await paginate(req, OrderItem, filter, { sort: { sent_at: 1, _id: 1 }, serialize: S.kdsItems }));
};

// PATCH /api/kitchen/items/{id}/status  { status: cooking | ready }
// sent -> cooking -> ready (faqat oldinga). Tayyorlash boshlanganda retsept bo'yicha ombor yechiladi.
const NEXT = { sent: ['cooking', 'ready'], cooking: ['ready'] };

exports.changeStatus = async (req, res) => {
  const item = await findOr404(OrderItem, req.params.id);
  assertAccess(req, item.restaurant, KITCHEN);
  const { status } = parseBody(req.body, { status: choice(['cooking', 'ready'], { required: true }) });

  if (!(NEXT[item.status] || []).includes(status)) {
    throw new ApiError(400, `Statusni ${item.status} dan ${status} ga o'zgartirib bo'lmaydi.`);
  }

  // Atomik o'tish: bir vaqtda kelgan bir nechta so'rovdan faqat bittasi o'ta oladi (ombor ikki marta yechilmaydi)
  const claimed = await OrderItem.findOneAndUpdate({ _id: item._id, status: item.status }, { status }, { returnDocument: 'after' });
  if (!claimed) throw new ApiError(400, 'Taom statusi allaqachon o\'zgargan. Ro\'yxatni yangilang.');

  try {
    await consumeForItem(claimed, `Buyurtma #${claimed.order}: ${claimed.dish_name} x${claimed.quantity}`);
  } catch (err) {
    // Ombor yetmasa yoki birlik mos kelmasa, status oldingi holatiga qaytadi
    await OrderItem.updateOne({ _id: item._id, status }, { status: item.status });
    throw err;
  }
  res.json((await S.kdsItems([claimed]))[0]);
};

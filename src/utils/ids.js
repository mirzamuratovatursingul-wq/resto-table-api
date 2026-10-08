const ApiError = require('./ApiError');

// Path'dagi id -> musbat butun son. Faqat raqamlar qabul qilinadi ("0x10", "1e3", " 5", "1.5" va h.k. rad etiladi), aks holda 404.
exports.parseId = (value) => {
  if (!/^\d{1,15}$/.test(String(value))) throw new ApiError(404, 'Topilmadi.');
  const n = Number(value);
  if (n < 1) throw new ApiError(404, 'Topilmadi.');
  return n;
};

exports.findOr404 = async (Model, id, filter = {}) => {
  const doc = await Model.findOne({ _id: exports.parseId(id), ...filter });
  if (!doc) throw new ApiError(404, 'Topilmadi.');
  return doc;
};

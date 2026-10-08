const ApiError = require('./ApiError');
const { pageSize } = require('../config/env');

// DRF PageNumberPagination: { count, next, previous, results }
// serialize: async (docs[]) => object[]
module.exports = async function paginate(req, Model, filter, { sort = { _id: 1 }, serialize }) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isInteger(page) || page < 1) throw new ApiError(404, "Noto'g'ri sahifa raqami.");

  const count = await Model.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (page > pages) throw new ApiError(404, "Noto'g'ri sahifa raqami.");

  const docs = await Model.find(filter)
    .sort(sort)
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  const link = (p) => {
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`);
    Object.entries(req.query).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('page', p);
    return url.toString();
  };

  return {
    count,
    next: page < pages ? link(page + 1) : null,
    previous: page > 1 ? link(page - 1) : null,
    results: await serialize(docs),
  };
};

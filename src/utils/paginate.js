const ApiError = require('./ApiError');
const { pageSize: defaultSize } = require('../config/env');

const MAX_PAGE_SIZE = 100;

// DRF PageNumberPagination: { count, next, previous, results }
// serialize: async (docs[]) => object[]
module.exports = async function paginate(req, Model, filter, { sort = { _id: 1 }, serialize }) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isInteger(page) || page < 1) throw new ApiError(404, "Noto'g'ri sahifa raqami.");

  let pageSize = defaultSize;
  if (req.query.page_size !== undefined) {
    pageSize = Number(req.query.page_size);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new ApiError(400, 'Invalid', { page_size: [`page_size 1 dan ${MAX_PAGE_SIZE} gacha butun son bo'lishi kerak.`] });
  }

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

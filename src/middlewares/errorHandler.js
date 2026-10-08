const ApiError = require('../utils/ApiError');
const { nodeEnv } = require('../config/env');

exports.notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Javob formati YAML (DRF) bilan bir xil: { detail } yoki { field: [messages] }
// eslint-disable-next-line no-unused-vars
exports.errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let body;

  if (err.details) {
    body = err.details;
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    body = {};
    Object.values(err.errors).forEach((e) => {
      body[e.path] = [e.message];
    });
  } else if (err.name === 'CastError') {
    status = 400;
    body = { detail: `Invalid ${err.path}.` };
  } else if (err.code === 11000) {
    status = 400;
    body = { detail: `Duplicate value: ${Object.keys(err.keyValue || {}).join(', ')}` };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    body = { detail: 'Malformed JSON.' };
  } else {
    body = { detail: status >= 500 ? 'Internal Server Error' : err.message };
  }

  if (status >= 500) console.error(err);
  if (status >= 500 && nodeEnv === 'development') body.stack = err.stack;

  res.status(status).json(body);
};

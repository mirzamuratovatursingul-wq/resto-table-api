const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwt: cfg } = require('../config/env');
const ApiError = require('../utils/ApiError');

// Access token: qisqa muddatli, har so'rovda yuboriladi.
exports.signAccess = (user) => jwt.sign({ sub: user._id, type: 'access' }, cfg.accessSecret, { expiresIn: cfg.accessTtl });

// Refresh token: uzoq muddatli, faqat yangi access olish uchun. jti - logout'da blacklist uchun.
exports.signRefresh = (user) => jwt.sign(
  { sub: user._id, type: 'refresh', jti: crypto.randomUUID() },
  cfg.refreshSecret,
  { expiresIn: cfg.refreshTtl },
);

// Xato `code` frontend uchun: token_expired -> refresh qiling, token_invalid -> login sahifasiga
exports.verify = (token, kind) => {
  try {
    const payload = jwt.verify(token, kind === 'refresh' ? cfg.refreshSecret : cfg.accessSecret);
    if (payload.type !== kind) throw new Error('wrong token type');
    return payload;
  } catch (e) {
    const expired = e.name === 'TokenExpiredError';
    throw new ApiError(401, 'Unauthorized', {
      detail: expired ? 'Token muddati tugagan.' : 'Token yaroqsiz.',
      code: expired ? 'token_expired' : 'token_invalid',
    });
  }
};

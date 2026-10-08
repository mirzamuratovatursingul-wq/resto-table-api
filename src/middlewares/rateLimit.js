const { rateLimit } = require('express-rate-limit');
const { authRateLimit } = require('../config/env');

// Login va ro'yxatdan o'tishga urinishlarni cheklaydi (parolni terib topishdan himoya).
// Faqat production da (yoki RATE_LIMIT=true bilan) yoqiladi; aks holda o'tkazib yuboradi.
module.exports = authRateLimit.enabled
  ? rateLimit({
    windowMs: authRateLimit.windowMs,
    limit: authRateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ detail: 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring.', code: 'too_many_requests' }),
  })
  : (req, res, next) => next();

require('dotenv').config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  // MONGO_URI; Railway Mongo plagini MONGO_URL, Atlas odatda MONGODB_URI beradi: uchalasi qabul qilinadi
  mongoUri: process.env.MONGO_URI || process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/resto-table',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  pageSize: Number(process.env.PAGE_SIZE) || 10,
  // /docs faqat test rejimida ochiq (production da o'chiq). DOCS_ENABLED=false bilan o'chirish mumkin.
  docsEnabled: nodeEnv !== 'production' && process.env.DOCS_ENABLED !== 'false',
  // npm run seed:superadmin ishlatadigan akkaunt; /docs shu akkauntga kirishni qo'llab-quvvatlaydi
  superadmin: {
    phone: process.env.SUPERADMIN_PHONE || '+998900000000',
    password: process.env.SUPERADMIN_PASSWORD || 'Admin12345',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  // Login/register uchun tezlik chegarasi (parol tanlashdan himoya). Faqat production da yoqiladi.
  authRateLimit: {
    enabled: nodeEnv === 'production' || process.env.RATE_LIMIT === 'true',
    windowMs: (Number(process.env.AUTH_RATE_WINDOW_MIN) || 15) * 60 * 1000,
    max: Number(process.env.AUTH_RATE_MAX) || 30,
  },
  // Proxy (Railway, nginx, Heroku) orqasida haqiqiy mijoz IP si uchun. Railway da avtomatik yoqiladi.
  trustProxy: process.env.TRUST_PROXY === 'true' || (process.env.TRUST_PROXY !== 'false' && !!process.env.RAILWAY_ENVIRONMENT),
};

// Production da standart/zaif JWT sirlari bilan ishga tushmaymiz
if (nodeEnv === 'production') {
  const weak = (s) => !s || s.length < 16 || /^(dev-|change-me)/.test(s);
  if (weak(process.env.JWT_ACCESS_SECRET) || weak(process.env.JWT_REFRESH_SECRET)) {
    throw new Error('Production da JWT_ACCESS_SECRET va JWT_REFRESH_SECRET kamida 16 belgili, tasodifiy va standart bo\'lmagan qiymat bo\'lishi kerak.');
  }
  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET va JWT_REFRESH_SECRET bir xil bo\'lmasligi kerak.');
  }
}

module.exports = config;

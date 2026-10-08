require('express-async-errors');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const {
  corsOrigin, nodeEnv, docsEnabled, superadmin, trustProxy,
} = require('./config/env');
const initialData = require('./config/initialData');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
if (trustProxy) app.set('trust proxy', 1); // nginx/Heroku orqasida haqiqiy IP uchun (TRUST_PROXY=true)

// upgradeInsecureRequests o'chirilgan: lokal tarmoqda http orqali /docs ochilishi uchun
app.use(helmet({
  contentSecurityPolicy: { useDefaults: true, directives: { upgradeInsecureRequests: null } },
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (nodeEnv !== 'test') app.use(morgan('dev'));

// Hujjatlar sahifasi: /docs (faqat test rejimida; production da umuman ulanmaydi)
if (docsEnabled) {
  // Docs sahifasi superadmin tugmasini .env dagi akkaunt bilan ishlatishi uchun
  app.get('/docs/config.json', (req, res) => {
    res.json({
      testMode: true,
      superadmin,
      restaurant: initialData.enabled ? initialData.restaurant : null,
      // Bazada boshlang'ich yaratilgan akkauntlar: docs ularni rol bo'yicha inputlarga o'zi yozadi
      accounts: initialData.enabled
        ? initialData.accounts.map((a) => ({ role: a.role, phone: a.phone_number, password: a.password, name: `${a.first_name} ${a.last_name}` }))
        : [],
    });
  });
  app.use('/docs', express.static(path.join(__dirname, '..', 'public', 'docs')));
  app.get('/', (req, res) => res.redirect('/docs'));
}

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

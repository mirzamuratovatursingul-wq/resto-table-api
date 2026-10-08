const { User, Staff, RevokedToken } = require('../models');
const ApiError = require('../utils/ApiError');
const { parseBody, str } = require('../utils/fields');
const tokens = require('../services/token.service');
const users = require('../services/user.service');
const S = require('../serializers');

// POST /api/auth/login  -> { access, refresh }
exports.login = async (req, res) => {
  const data = parseBody(req.body, {
    phone_number: str({ required: true }),
    password: str({ required: true }),
  });
  const user = await User.findOne({ phone_number: data.phone_number });
  if (!user || !user.is_active || !(await users.checkPassword(user, data.password))) {
    throw new ApiError(401, 'Unauthorized', { detail: 'Telefon raqami yoki parol noto\'g\'ri.', code: 'invalid_credentials' });
  }
  // Ishdan bo'shatilgan (is_active=false) xodim kira olmaydi
  if (['waiter', 'cook', 'storekeeper'].includes(user.role)) {
    const profile = await Staff.findOne({ user: user._id });
    if (profile && !profile.is_active) {
      throw new ApiError(403, 'Forbidden', { detail: 'Xodim akkaunti faol emas.', code: 'account_inactive' });
    }
  }
  res.json({ access: tokens.signAccess(user), refresh: tokens.signRefresh(user) });
};

// POST /api/auth/refresh  -> { access }   (refresh token o'zgarmaydi)
exports.refresh = async (req, res) => {
  const { refresh } = parseBody(req.body, { refresh: str({ required: true }) });
  const payload = tokens.verify(refresh, 'refresh');
  if (await RevokedToken.exists({ jti: payload.jti })) {
    throw new ApiError(401, 'Unauthorized', { detail: 'Token bekor qilingan (logout).', code: 'token_invalid' });
  }
  const user = await User.findById(payload.sub);
  if (!user || !user.is_active) {
    throw new ApiError(401, 'Unauthorized', { detail: 'Foydalanuvchi topilmadi.', code: 'token_invalid' });
  }
  res.json({ access: tokens.signAccess(user) });
};

// POST /api/auth/logout  - refresh token blacklist'ga tushadi, keyin undan access olib bo'lmaydi
exports.logout = async (req, res) => {
  const { refresh } = parseBody(req.body, { refresh: str({ required: true }) });
  const payload = tokens.verify(refresh, 'refresh');
  await RevokedToken.updateOne(
    { jti: payload.jti },
    { jti: payload.jti, expires_at: new Date(payload.exp * 1000) },
    { upsert: true },
  );
  res.json({ detail: 'Chiqildi.' });
};

// POST /api/auth/register  - faqat mijoz (customer) ro'yxatdan o'tadi
exports.signUp = async (req, res) => {
  const { phone_number, first_name, last_name, email, password } = users.userRules;
  const data = parseBody(req.body, {
    phone_number,
    first_name,
    last_name,
    email,
    password: { ...password, required: true },
  });
  const user = await users.createUser({ ...data, role: 'customer' });
  res.status(201).json(await S.me(user, null));
};

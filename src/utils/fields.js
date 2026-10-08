// Yengil validator: DRF serializer'larga o'xshash qoidalar -> tozalangan obyekt yoki 400.
const ApiError = require('./ApiError');

// Butun son matn ko'rinishida ham kelishi mumkin ("5"), lekin "0x10", "1e3", "5.0", " " kabilar rad etiladi
const num = (v) => (typeof v === 'string' && /^-?\d{1,15}$/.test(v.trim()) ? Number(v.trim()) : v);

const str = (o = {}) => ({
  ...o,
  parse(v) {
    if (typeof v !== 'string') throw "Matn bo'lishi kerak.";
    const s = v.trim();
    if (!s && !o.allowBlank) throw "Bu maydon bo'sh bo'lmasligi kerak.";
    if (o.max && s.length > o.max) throw `Ko'pi bilan ${o.max} ta belgi bo'lishi mumkin.`;
    if (o.min && s.length < o.min) throw `Kamida ${o.min} ta belgi bo'lishi kerak.`;
    if (o.pattern && s && !o.pattern.test(s)) throw o.patternMsg || "Format noto'g'ri.";
    return s;
  },
});

const int = (o = {}) => ({
  ...o,
  parse(v) {
    const n = num(v);
    if (!Number.isInteger(n)) throw 'Butun son kiriting.';
    if (o.min !== undefined && n < o.min) throw `Qiymat kamida ${o.min} bo'lishi kerak.`;
    const max = o.max !== undefined ? o.max : 2147483647; // standart yuqori chegara: 32-bit
    if (n > max) throw `Qiymat ko'pi bilan ${max} bo'lishi kerak.`;
    return n;
  },
});

const bool = (o = {}) => ({
  ...o,
  parse(v) {
    if (v === true || v === 'true' || v === 'True' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 'False' || v === 0 || v === '0') return false;
    throw "true yoki false bo'lishi kerak.";
  },
});

// digits - umumiy raqamlar soni, places - verguldan keyingi raqamlar
const decimal = ({ digits, places, min, ...o }) => ({
  ...o,
  parse(v) {
    const s = String(v).trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw "To'g'ri son kiriting.";
    const [whole, frac = ''] = s.replace('-', '').split('.');
    if (frac.length > places) throw `Verguldan keyin ko'pi bilan ${places} ta raqam bo'lishi mumkin.`;
    if (whole.length > digits - places) {
      throw `Verguldan oldin ko'pi bilan ${digits - places} ta raqam bo'lishi mumkin.`;
    }
    const n = Number(s);
    if (min !== undefined && n < min) throw `Qiymat kamida ${min} bo'lishi kerak.`;
    return n;
  },
});

const choice = (values, o = {}) => ({
  ...o,
  parse(v) {
    if (!values.includes(v)) throw `"${v}" ruxsat etilgan qiymat emas.`;
    return v;
  },
});

const email = (o = {}) => ({
  ...o,
  parse(v) {
    if (typeof v !== 'string') throw "Email manzili noto'g'ri.";
    const s = v.trim();
    if (s === '') return '';
    if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw "Email manzili noto'g'ri.";
    return s.toLowerCase();
  },
});

const date = (o = {}) => ({
  ...o,
  parse(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      throw "Sana formati noto'g'ri. YYYY-MM-DD ishlating.";
    }
    return v;
  },
});

const time = (o = {}) => ({
  ...o,
  parse(v) {
    if (typeof v !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v.trim())) {
      throw "Vaqt formati noto'g'ri. HH:MM ishlating.";
    }
    const s = v.trim();
    return s.length === 5 ? `${s}:00` : s;
  },
});

// rules: { field: rule({ required, nullable }) }, partial=true -> PATCH
function parseBody(body, rules, { partial = false } = {}) {
  const src = body && typeof body === 'object' ? body : {};
  const out = {};
  const errors = {};

  for (const [key, rule] of Object.entries(rules)) {
    const v = src[key];
    if (v === undefined) {
      if (!partial && rule.required) errors[key] = ['Bu maydon majburiy.'];
      continue;
    }
    if (v === null) {
      if (rule.nullable) out[key] = null;
      else errors[key] = ["Bu maydon null bo'lishi mumkin emas."];
      continue;
    }
    try {
      out[key] = rule.parse(v);
    } catch (e) {
      if (typeof e !== 'string') throw e;
      errors[key] = [e];
    }
  }

  if (Object.keys(errors).length) throw new ApiError(400, 'Validation failed', errors);
  return out;
}

module.exports = { parseBody, str, int, bool, decimal, choice, email, date, time };

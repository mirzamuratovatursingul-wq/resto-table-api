// Decimal maydonlar API'da string ko'rinishida qaytadi (DRF DecimalField kabi)
exports.dec = (n, places = 2) => Number(n || 0).toFixed(places);

exports.round = (n, places = 3) => {
  const f = 10 ** places;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};

exports.timeToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

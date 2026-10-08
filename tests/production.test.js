// Production/development rejimlari: /docs yopiqligi, zaif sirlarni rad etish, tezlik chegarasi.
// Har bir holat alohida jarayonda tekshiriladi (sozlamalar import paytida o'qiladi). Bazaga ulanish shart emas.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.join(__dirname, '..');
const STRONG = { JWT_ACCESS_SECRET: 'a-very-long-random-access-secret-123', JWT_REFRESH_SECRET: 'another-very-long-random-refresh-secret-456' };

// Berilgan env bilan ilovani ko'taradi, `probe` kodini ishlatadi va natijani JSON qilib qaytaradi
function run(env, probe) {
  const script = `
    const app = require('./src/app');
    const server = app.listen(0, async () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      const get = async (p, o) => { const r = await fetch(base + p, { redirect: 'manual', ...o }); const t = await r.text(); return { s: r.status, t, h: Object.fromEntries(r.headers) }; };
      const out = await (async () => { ${probe} })();
      console.log('@@' + JSON.stringify(out));
      server.close(); process.exit(0);
    });`;
  const cleanEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env };
  const res = spawnSync(process.execPath, ['-e', script], { cwd: root, env: cleanEnv, encoding: 'utf8' });
  // Windows da jarayon tugash paytidagi libuv assertion chiqish kodini buzishi mumkin: natijaga qaraymiz
  if (!res.stdout.includes('@@')) {
    const err = new Error(`jarayon natija bermadi (kod ${res.status})`);
    err.stderr = res.stderr;
    throw err;
  }
  return JSON.parse(res.stdout.split('@@').pop());
}

describe('Rejimlar: development va production', () => {
  it('development: /docs va /docs/config.json ochiq, ildiz /docs ga yo\'naltiradi', () => {
    const r = run({ NODE_ENV: 'development' }, `
      const d = await get('/docs/'); const c = await get('/docs/config.json'); const root = await get('/');
      return { docs: d.s, cfg: c.s, hasSuper: !!JSON.parse(c.t).superadmin, root: root.s };`);
    assert.deepEqual(r, { docs: 200, cfg: 200, hasSuper: true, root: 302 });
  });

  it('DOCS_ENABLED=false bilan development da ham /docs yopiladi', () => {
    const r = run({ NODE_ENV: 'development', DOCS_ENABLED: 'false' }, `
      return { docs: (await get('/docs/')).s, cfg: (await get('/docs/config.json')).s };`);
    assert.deepEqual(r, { docs: 404, cfg: 404 });
  });

  it('production: /docs, config.json (parolli) va ildiz umuman yo\'q; health ishlaydi', () => {
    const r = run({ NODE_ENV: 'production', ...STRONG }, `
      const d = await get('/docs/'); const c = await get('/docs/config.json'); const root = await get('/'); const h = await get('/api/health');
      return { docs: d.s, cfg: c.s, cfgLeak: /password/i.test(c.t), root: root.s, health: h.s };`);
    assert.deepEqual(r, { docs: 404, cfg: 404, cfgLeak: false, root: 404, health: 200 });
  });

  it('production: DOCS_ENABLED=true bo\'lsa ham /docs yopiq qoladi (superadmin paroli chiqib ketmasligi uchun)', () => {
    const r = run({ NODE_ENV: 'production', DOCS_ENABLED: 'true', ...STRONG }, `
      return { docs: (await get('/docs/')).s, cfg: (await get('/docs/config.json')).s };`);
    assert.deepEqual(r, { docs: 404, cfg: 404 });
  });

  it('production: xatolarda stack trace va ichki ma\'lumot yo\'q; xavfsizlik sarlavhalari bor', () => {
    const r = run({ NODE_ENV: 'production', ...STRONG }, `
      const bad = await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
      const nf = await get('/yoq');
      return { badS: bad.s, hasStack: /stack|at .*\\(/.test(bad.t), nfS: nf.s, nosniff: nf.h['x-content-type-options'], powered: nf.h['x-powered-by'] || null };`);
    assert.deepEqual(r, { badS: 400, hasStack: false, nfS: 404, nosniff: 'nosniff', powered: null });
  });

  for (const [name, env] of [
    ['standart sirlar', { JWT_ACCESS_SECRET: 'dev-access-secret', JWT_REFRESH_SECRET: 'dev-refresh-secret' }],
    ['sirlar yo\'q', {}],
    ['qisqa sirlar', { JWT_ACCESS_SECRET: 'short', JWT_REFRESH_SECRET: 'short2' }],
    ['"change-me" qoldiqlari', { JWT_ACCESS_SECRET: 'change-me-access-aaaaaaaaaaaa', JWT_REFRESH_SECRET: 'change-me-refresh-bbbbbbbbbbbb' }],
    ['ikkala sir bir xil', { JWT_ACCESS_SECRET: 'same-secret-value-1234567890', JWT_REFRESH_SECRET: 'same-secret-value-1234567890' }],
  ]) {
    it(`production zaif JWT sirlari bilan ishga tushmaydi: ${name}`, () => {
      assert.throws(
        () => run({ NODE_ENV: 'production', ...env }, 'return {};'),
        (err) => /JWT_/.test(String(err.stderr)),
      );
    });
  }

  it('production: login tezlik chegarasi (30 urinishdan keyin 429), register ham cheklangan; boshqa endpointlar emas', () => {
    const r = run({ NODE_ENV: 'production', AUTH_RATE_MAX: '5', ...STRONG }, `
      const post = (p) => get(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const login = []; for (let i = 0; i < 8; i++) login.push((await post('/api/auth/login')).s);
      const reg = (await post('/api/auth/register')).s;
      const refresh = (await post('/api/auth/refresh')).s;
      const last = await post('/api/auth/login');
      return { login, reg, refresh, code: JSON.parse(last.t).code, retryAfter: !!(last.h['retry-after'] || last.h['ratelimit']) };`);
    assert.deepEqual(r.login, [400, 400, 400, 400, 400, 429, 429, 429]);
    assert.equal(r.reg, 429, 'register ham xuddi shu chegaradan foydalanadi');
    assert.equal(r.refresh, 400, 'refresh cheklanmagan');
    assert.equal(r.code, 'too_many_requests');
  });

  it('development: tezlik chegarasi yoqilmaydi (sinov va docs uchun qulay)', () => {
    const r = run({ NODE_ENV: 'development' }, `
      const codes = []; for (let i = 0; i < 40; i++) codes.push((await get('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).s);
      return { all400: codes.every((c) => c === 400) };`);
    assert.deepEqual(r, { all400: true });
  });
});

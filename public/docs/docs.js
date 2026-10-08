/* Hujjat sahifasini chizadi va "Sinab ko'rish" panellarini ishlatadi. Ma'lumotlar: endpoints.js */
(() => {
  const { ROLES, COMMON, ENUMS, ENDPOINTS, FLOWS, GROUPS } = window.DOCS;
  const BASE = location.origin;
  const $ = (s, el = document) => el.querySelector(s);
  const EP = new Map(ENDPOINTS.map((e) => [e.id, e]));

  /* ================= yordamchilar ================= */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const anchor = (id) => `ep-${slug(id)}`;
  const pretty = (o) => JSON.stringify(o, null, 2);
  const todayPlus = (days) => {
    const d = new Date(Date.now() + days * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function load(key, fallback) {
    try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ruxsat yo'q */ } }

  function highlight(text) {
    return esc(text).replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g, (m, str, colon, bool, num) => {
      if (str) return colon ? `<span class="j-k">${str}</span>${colon}` : `<span class="j-s">${str}</span>`;
      if (bool) return `<span class="j-b">${bool}</span>`;
      return `<span class="j-n">${num}</span>`;
    });
  }
  function copyText(text, btn) {
    const done = () => { const old = btn.textContent; btn.textContent = 'Nusxalandi ✓'; setTimeout(() => { btn.textContent = old; }, 1400); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
  }
  function codeBlock(text, { json = false } = {}) {
    const pre = h('pre');
    if (json) pre.innerHTML = highlight(text); else pre.textContent = text;
    const btn = h('button', { class: 'copy', type: 'button' }, 'Nusxa');
    btn.addEventListener('click', () => copyText(text, btn));
    return h('div', { class: 'code' }, pre, btn);
  }
  const td = (...kids) => h('td', null, ...kids);
  const table = (heads, rows, cls) => h('div', { class: 'tbl-wrap' }, h('table', { class: cls }, h('thead', null, h('tr', null, heads.map((t) => h('th', null, t)))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => (c && c.nodeType ? c : h('td', { html: inline(String(c)) }))))))));

  const roleChip = (key) => h('span', { class: 'chip', style: `background:${ROLES[key].color}` }, ROLES[key].name);
  const methodBadge = (m) => h('span', { class: `m ${m}` }, m);
  const allowed = (ep, role) => !ep.auth || ep.who === 'any' || ep.who.includes(role);
  const rolesOf = (ep) => (!ep.auth || ep.who === 'any' ? Object.keys(ROLES) : ep.who);
  function whoChips(ep) {
    if (!ep.auth) return [h('span', { class: 'chip open' }, 'Ochiq: token shart emas')];
    if (ep.who === 'any') return [h('span', { class: 'chip open' }, 'Istalgan kirgan foydalanuvchi')];
    return ep.who.map(roleChip);
  }

  /* ================= holat: auth, rol, kontekst ================= */
  const AUTH_KEY = 'resto_docs_auth';
  const auth = load(AUTH_KEY, { access: null, refresh: null, me: null });
  let currentRole = '';
  try { currentRole = localStorage.getItem('resto_docs_role') || (auth.me && auth.me.role) || ''; } catch { /* ignore */ }
  const ctx = load('resto_docs_ctx', {});

  // Hamma narsa haqiqiy bazada. Superadmin akkaunti .env dan (config.json orqali yangilanadi).
  // Admin, xodim va mijoz akkauntlari API orqali yaratilganda shu yerda eslab qolinadi (faqat shu brauzerda).
  const SUPER = { creds: ['+998900000000', 'Admin12345'] };
  const accounts = load('resto_docs_accounts', {});   // { telefon: { phone, password, role, name } }
  const PLACEHOLDER_CREDS = ['+998901234567', 'Password123'];

  // Eski nomlar bilan saqlangan brauzer ma'lumotlarini yangi inglizcha nomlarga o'tkazish (migratsiya)
  const ROLE_RENAMES = { restoran_admin: 'restaurant_admin', officiant: 'waiter', aspaz: 'cook', sklad: 'storekeeper' };
  Object.values(accounts).forEach((a) => { if (a && ROLE_RENAMES[a.role]) a.role = ROLE_RENAMES[a.role]; });
  if (ROLE_RENAMES[currentRole]) currentRole = ROLE_RENAMES[currentRole];
  if (auth.me && !('restaurant' in auth.me)) { auth.access = null; auth.refresh = null; auth.me = null; } // eski shakldagi sessiya: qayta kirish kerak
  if ('restoran' in ctx) { if (ctx.restaurant == null) ctx.restaurant = ctx.restoran; delete ctx.restoran; save('resto_docs_ctx', ctx); }
  save('resto_docs_accounts', accounts);
  save(AUTH_KEY, auth);
  // Rol bo'yicha saqlangan akkauntlar: bazadagi boshlang'ich (initial) akkauntlar birinchi turadi
  const accountsOf = (role) => Object.values(accounts)
    .filter((x) => x && x.role === role)
    .sort((a, b) => (b.initial ? 1 : 0) - (a.initial ? 1 : 0));
  const credsFor = (role) => {
    if (role === 'superadmin') return SUPER.creds;
    const a = accountsOf(role)[0];
    return a ? [a.phone, a.password] : null;
  };

  const jwtExp = (token) => {
    try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch { return 0; }
  };
  const fmtLeft = (ms) => {
    if (ms <= 0) return 'tugagan';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    if (d >= 1) return `${d} kun ${Math.floor((s % 86400) / 3600)} soat`;
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  /* Kontekst: oldingi javoblardan olingan id lar keyingi so'rovlarga avtomatik qo'yiladi */
  const CTX_LABELS = { restaurant: 'Restoran', table: 'Stol', category: 'Kategoriya', dish: 'Taom', ingredient: 'Ingredient', recipe: 'Retsept', order: 'Buyurtma', orderItem: 'Buyurtma elementi', staff: 'Xodim', admin: 'Admin', reservation: 'Bron' };
  const PARAM_CTX = { 'Restoran id': 'restaurant', 'Stol id': 'table', 'Kategoriya id': 'category', 'Taom id': 'dish', 'Ingredient id': 'ingredient', 'Retsept qatori id': 'recipe', 'Buyurtma id': 'order', 'Buyurtma elementi id': 'orderItem', 'Xodim id': 'staff', 'Admin id': 'admin', 'Bron id': 'reservation' };
  const BODY_CTX = { restaurant: 'restaurant', table: 'table', dish: 'dish', ingredient: 'ingredient' };
  const CREATE_CTX = [
    [/^POST \/api\/restaurants$/, 'restaurant'], [/^POST .*\/tables$/, 'table'], [/^POST .*\/categories$/, 'category'],
    [/^POST .*\/dishes$/, 'dish'], [/^POST .*\/ingredients$/, 'ingredient'], [/^POST .*\/recipe-items$/, 'recipe'],
    [/^POST .*\/orders$/, 'order'], [/^POST .*\/items$/, 'orderItem'], [/^POST .*\/staff$/, 'staff'],
    [/^POST \/api\/admins$/, 'admin'], [/^POST .*\/reservations$/, 'reservation'],
  ];
  const LIST_CTX = [
    [/^GET \/api\/restaurants$/, 'restaurant'], [/^GET .*\/tables$/, 'table'], [/^GET .*\/categories$/, 'category'],
    [/^GET .*\/dishes$/, 'dish'], [/^GET .*\/ingredients$/, 'ingredient'], [/^GET .*\/orders$/, 'order'],
    [/^GET .*\/staff$/, 'staff'], [/^GET \/api\/admins$/, 'admin'], [/^GET \/api\/reservations(\/my)?$/, 'reservation'],
    [/^GET \/api\/kitchen\/items$/, 'orderItem'], [/^GET .*\/available-tables$/, 'table'],
  ];

  const bindings = [];
  function renderCtx() {
    const box = $('#ctxbar');
    if (!box) return;
    box.replaceChildren();
    const keys = Object.keys(ctx).filter((k) => ctx[k] != null);
    if (!keys.length) { box.append(h('span', { class: 'muted' }, 'Hozircha bo\'sh. So\'rovlar yuborilgach, id lar shu yerda yig\'iladi va keyingi so\'rovlarga o\'zi qo\'yiladi.')); return; }
    keys.forEach((k) => box.append(h('span', { class: 'ctxchip' }, `${CTX_LABELS[k] || k} #${ctx[k]}`, h('button', { type: 'button', title: 'Olib tashlash', onclick: () => { delete ctx[k]; save('resto_docs_ctx', ctx); renderCtx(); } }, '×'))));
    box.append(h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { Object.keys(ctx).forEach((k) => delete ctx[k]); save('resto_docs_ctx', ctx); renderCtx(); } }, 'Hammasini tozalash'));
  }
  function setCtx(key, value) {
    if (value == null || value === '') return;
    ctx[key] = value; save('resto_docs_ctx', ctx); renderCtx();
    bindings.forEach((b) => {
      if (b.key !== key || b.dirty || !b.el.isConnected) return;
      b.el.value = value; b.el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  function bindCtx(el, key) {
    const b = { el, key, dirty: false };
    el.addEventListener('input', (ev) => { if (ev.isTrusted) b.dirty = true; });
    bindings.push(b);
  }
  function learn(ep, vals, r) {
    if (r.status < 200 || r.status >= 300) return;
    const d = r.data;
    // foydalanuvchi qo'lda kiritgan yoki ishlatgan id lar
    (vals.ctxUsed || []).forEach(([k, v]) => { if (v !== '' && v != null) ctx[k] = v; });
    if (ep.method === 'DELETE') (vals.ctxUsed || []).forEach(([k]) => { delete ctx[k]; });
    save('resto_docs_ctx', ctx);
    if (ep.method === 'POST' && d && d.id != null) CREATE_CTX.forEach(([re, k]) => { if (re.test(ep.id)) setCtx(k, d.id); });
    if (ep.method === 'GET') {
      const first = Array.isArray(d) ? d[0] : d && d.results ? d.results[0] : null;
      if (first && first.id != null) LIST_CTX.forEach(([re, k]) => { if (re.test(ep.id) && ctx[k] == null) setCtx(k, first.id); });
      if (/\/menu$/.test(ep.id) && Array.isArray(d) && d[0]) {
        if (ctx.category == null) setCtx('category', d[0].id);
        const dish = d.flatMap((c) => c.dishes)[0];
        if (dish && ctx.dish == null) setCtx('dish', dish.id);
      }
      if (ep.id === 'GET /api/users/me' && d && d.restaurant) setCtx('restaurant', d.restaurant.id);
    }
    renderCtx();
  }

  /* ================= API so'rovi (tokenni avtomatik yangilash bilan) ================= */
  async function raw(method, path, body, token) {
    // Sinov rejimi: so'rov faqat shu serverning o'z manziliga ketadi, boshqa hostga hech qachon chiqmaydi
    if (!path.startsWith('/api/') || new URL(path, BASE).origin !== BASE) throw new Error('Faqat shu serverga so\'rov yuborish mumkin');
    const t0 = performance.now();
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* matn */ }
    return { status: res.status, data, ms: Math.round(performance.now() - t0) };
  }
  async function request(method, path, body, useAuth, log) {
    let r = await raw(method, path, body, useAuth ? auth.access : null);
    if (useAuth && r.status === 401 && r.data && r.data.code === 'token_expired' && auth.refresh) {
      log('401 token_expired → POST /api/auth/refresh chaqirildi');
      const rf = await raw('POST', '/api/auth/refresh', { refresh: auth.refresh });
      if (rf.status === 200) {
        auth.access = rf.data.access; save(AUTH_KEY, auth); renderAuth();
        log('Yangi access olindi → so\'rov qayta yuborildi');
        r = await raw(method, path, body, auth.access);
      } else log('Refresh ham yaroqsiz → login sahifasiga qaytish kerak');
    }
    return r;
  }

  async function loginWith(phone, password) {
    const r = await raw('POST', '/api/auth/login', { phone_number: phone, password });
    if (r.status !== 200) return { ok: false, r };
    auth.access = r.data.access; auth.refresh = r.data.refresh; auth.me = null;
    const me = await raw('GET', '/api/users/me', undefined, auth.access);
    if (me.status === 200) auth.me = me.data;
    save(AUTH_KEY, auth);
    if (auth.me) { setRole(auth.me.role); if (auth.me.restaurant) setCtx('restaurant', auth.me.restaurant.id); }
    renderAuth();
    return { ok: true, r };
  }
  async function loginAs(role) {
    const c = credsFor(role);
    if (!c) return { ok: false, r: { status: 0, ms: 0, data: { detail: `${ROLES[role].name} akkaunti hali yaratilmagan. Avval "Ssenariylar" bo'limida uni yarating.` } } };
    return loginWith(c[0], c[1]);
  }

  /* Kirish formasi: rol tanlanadi, telefon va parol inputlarga o'zi yoziladi (o'zgartirish mumkin).
     Yaratilgan yoki qo'lda kiritib kirilgan akkauntlar rol bo'yicha eslab qolinadi. */
  let loginRole = (auth.access && auth.me && auth.me.role) || 'superadmin';
  let roleTabsBox; let accChips; let loginMsg; let phoneInp; let passInp;
  function fillFor(role) {
    const c = credsFor(role);
    phoneInp.value = c ? c[0] : '';
    passInp.value = c ? c[1] : '';
  }
  function renderQuick() {
    if (!roleTabsBox) return;
    roleTabsBox.replaceChildren(...Object.keys(ROLES).map((k) => h('button', {
      type: 'button', class: k === loginRole ? 'on' : '',
      onclick: () => {
        loginRole = k; fillFor(k);
        loginMsg.textContent = credsFor(k) ? '' : `${ROLES[k].name} uchun saqlangan akkaunt yo'q: telefon va parolni o'zingiz yozing yoki avval "Ssenariylar" orqali yarating.`;
        renderQuick();
      },
    }, h('span', { class: 'dot', style: `background:${ROLES[k].color}` }), ROLES[k].name)));
    const list = loginRole === 'superadmin'
      ? [{ phone: SUPER.creds[0], password: SUPER.creds[1], name: 'Superadmin (.env)' }]
      : accountsOf(loginRole);
    accChips.replaceChildren(...list.map((a) => h('button', {
      type: 'button', title: 'Inputlarga yozish',
      onclick: () => { phoneInp.value = a.phone; passInp.value = a.password; },
    }, `${a.name || 'Akkaunt'} · ${a.phone}`)));
  }
  async function submitLogin() {
    loginMsg.textContent = 'Kirilmoqda...';
    const phone = phoneInp.value.trim();
    const pw = passInp.value;
    const res = await loginWith(phone, pw);
    if (!res.ok) {
      loginMsg.textContent = `${res.r.status}: ${res.r.data && res.r.data.detail}`;
      // Saqlangan akkaunt bazada yo'q (baza tozalangan bo'lishi mumkin): ro'yxatdan olib tashlaymiz
      if (res.r.data && res.r.data.code === 'invalid_credentials' && accounts[phone] && !accounts[phone].initial) {
        delete accounts[phone]; save('resto_docs_accounts', accounts); renderQuick();
        loginMsg.textContent += ' — saqlangan akkaunt bazada topilmadi, ro\'yxatdan o\'chirildi.';
      }
      return;
    }
    const me = auth.me;
    if (me && me.role !== 'superadmin') rememberAccount(phone, pw, me.role, `${me.first_name} ${me.last_name}`.trim());
    if (me) loginRole = me.role;
    renderQuick();
    loginMsg.textContent = `${me && ROLES[me.role] ? ROLES[me.role].name : ''} sifatida kirildi (${res.r.ms} ms).`;
  }
  function rememberAccount(phone, password, role, name) {
    accounts[phone] = { phone, password, role, name, initial: false };
    save('resto_docs_accounts', accounts);
    renderQuick();
  }
  function rememberFrom(ep, v) {
    const b = v.body || {};
    const name = `${b.first_name || ''} ${b.last_name || ''}`.trim();
    if (ep.id === 'POST /api/admins' && b.phone_number && b.password) rememberAccount(b.phone_number, b.password, 'restaurant_admin', name);
    else if (ep.id === 'POST /api/restaurants/{id}/staff' && b.phone_number && b.password && b.role) rememberAccount(b.phone_number, b.password, b.role, name);
    else if (ep.id === 'POST /api/auth/register' && b.phone_number && b.password) rememberAccount(b.phone_number, b.password, 'customer', name);
    else if (ep.id === 'POST /api/users/me/change-password' && auth.me && accounts[auth.me.phone_number] && b.new_password) {
      const a = accounts[auth.me.phone_number];
      rememberAccount(a.phone, b.new_password, a.role, a.name);
    }
  }
  async function doLogout() {
    if (auth.refresh) await raw('POST', '/api/auth/logout', { refresh: auth.refresh });
    auth.access = auth.refresh = auth.me = null; save(AUTH_KEY, auth); renderAuth();
  }
  async function manualRefresh(msg) {
    if (!auth.refresh) return;
    const r = await raw('POST', '/api/auth/refresh', { refresh: auth.refresh });
    if (r.status === 200) { auth.access = r.data.access; save(AUTH_KEY, auth); renderAuth(); msg.textContent = 'Access yangilandi (refresh o\'zgarmadi).'; }
    else msg.textContent = `Refresh bajarilmadi (${r.status}): ${r.data && r.data.detail}`;
  }

  /* ================= 1. Boshlash ================= */
  function sectionStart() {
    return h('section', { id: 'start' },
      h('div', { class: 'hero' },
        h('h1', null, 'Resto API qo\'llanmasi'),
        h('p', { class: 'lead' }, 'Restoran uchun stol bron qilish, buyurtma olish, oshxona va ombor tizimi. Bu sahifa bo\'yicha qadam-baqadam yursangiz, o\'z loyihangizda nima qilish kerakligini aniq bilasiz. Hamma so\'rovni shu yerning o\'zida sinab ko\'rishingiz ham mumkin.'),
        h('p', { html: inline(`Server: \`${BASE}\` · Format: JSON · Autentifikatsiya: JWT (access + refresh) · Barcha yo'llar \`/api\` bilan boshlanadi`) })));
  }

  /* ================= 2. Kirish paneli ================= */
  /* "Asosiy rollarni qo'shish": bazada yetishmayotgan boshlang'ich akkauntlarni qadamma-qadam yaratadi.
     Mavjudlariga tegmaydi (o'chirmaydi, parolini o'zgartirmaydi). Hammasi oddiy API so'rovlari orqali. */
  let INITIAL_ACCOUNTS = []; let INITIAL_RESTAURANT = null;
  const apiMsg = (r) => (r.data && typeof r.data === 'object'
    ? Object.entries(r.data).map(([k, v]) => (k === 'detail' ? v : `${k}: ${[].concat(v).join(' ')}`)).join('; ')
    : String(r.data));

  async function restoreInitialAccounts(btn, box) {
    box.replaceChildren();
    if (!INITIAL_ACCOUNTS.length || !INITIAL_RESTAURANT) {
      box.append(h('li', { class: 'err' }, 'Boshlang\'ich akkauntlar ro\'yxati topilmadi (server INITIAL_DATA=false bilan ishga tushgan bo\'lishi mumkin).'));
      return;
    }
    btn.disabled = true;
    const step = (text) => {
      const li = h('li', { class: 'run' }, text);
      box.append(li);
      return (state, extra) => { li.className = state; li.textContent = extra ? `${text} — ${extra}` : text; };
    };
    const tally = { ok: 0, skip: 0, err: 0 };
    const mismatch = []; // telefon bazada bor, lekin paroli boshqacha
    let tok = null;
    try {
      // 1. Superadmin
      let done = step('1. Superadmin sifatida kirish');
      const sl = await raw('POST', '/api/auth/login', { phone_number: SUPER.creds[0], password: SUPER.creds[1] });
      if (sl.status !== 200) { done('err', `${sl.status}: ${apiMsg(sl)}`); tally.err += 1; return; }
      done('ok');
      tok = sl.data.access;

      // 2. Asosiy restoran: bor bo'lsa ishlatiladi, yo'q bo'lsa yaratiladi
      done = step(`2. Restoran: "${INITIAL_RESTAURANT.name}"`);
      const found = await raw('GET', `/api/restaurants?search=${encodeURIComponent(INITIAL_RESTAURANT.name)}`, undefined, tok);
      let resto = found.status === 200 ? found.data.results.find((x) => x.name === INITIAL_RESTAURANT.name) : null;
      if (resto) done('skip', `mavjud (id ${resto.id})`);
      else {
        const c = await raw('POST', '/api/restaurants', { ...INITIAL_RESTAURANT, start_time: INITIAL_RESTAURANT.start_time.slice(0, 5), end_time: INITIAL_RESTAURANT.end_time.slice(0, 5) }, tok);
        if (c.status !== 201) { done('err', `${c.status}: ${apiMsg(c)}`); tally.err += 1; return; }
        resto = c.data; done('ok', `yaratildi (id ${resto.id})`);
      }
      setCtx('restaurant', resto.id);

      // 3.. Har bir rol uchun bittadan (ketma-ket)
      for (let i = 0; i < INITIAL_ACCOUNTS.length; i += 1) {
        const a = INITIAL_ACCOUNTS[i];
        const label = `${i + 3}. ${ROLES[a.role] ? ROLES[a.role].name : a.role}: ${a.phone}`;
        done = step(label);
        const probe = await raw('POST', '/api/auth/login', { phone_number: a.phone, password: a.password });
        if (probe.status === 200 || probe.status === 403) {
          done('skip', probe.status === 200 ? 'mavjud, tegilmadi' : 'mavjud (xodim nofaol), tegilmadi');
          tally.skip += 1;
          accounts[a.phone] = { phone: a.phone, password: a.password, role: a.role, name: a.name, initial: true };
          continue;
        }
        const [first, ...rest] = a.name.split(' ');
        const person = { phone_number: a.phone, first_name: first, last_name: rest.join(' ') || '-', password: a.password };
        let r;
        if (a.role === 'restaurant_admin') r = await raw('POST', '/api/admins', { restaurant: resto.id, ...person }, tok);
        else if (a.role === 'customer') r = await raw('POST', '/api/auth/register', person);
        else r = await raw('POST', `/api/restaurants/${resto.id}/staff`, { role: a.role, ...person }, tok);
        if (r.status === 201) {
          done('ok', 'yaratildi');
          tally.ok += 1;
          accounts[a.phone] = { phone: a.phone, password: a.password, role: a.role, name: a.name, initial: true };
        } else if (r.status === 400 && r.data && r.data.phone_number) {
          // Akkaunt bazada bor, lekin paroli docs kutgan paroldan farq qiladi: o'chirmaymiz, tiklashni taklif qilamiz
          done('err', 'akkaunt bazada bor, lekin paroli boshqacha');
          tally.err += 1;
          mismatch.push(a);
        } else {
          done('err', `${r.status}: ${apiMsg(r)}`);
          tally.err += 1;
        }
      }
    } catch (e) {
      box.append(h('li', { class: 'err' }, `Tarmoq xatosi: ${e.message}`));
      tally.err += 1;
    } finally {
      save('resto_docs_accounts', accounts);
      renderQuick();
      if (!auth.access) fillFor(loginRole);
      box.append(h('li', { class: tally.err ? 'err' : 'ok sum' }, `Tayyor: ${tally.ok} ta yaratildi, ${tally.skip} ta allaqachon bor edi${tally.err ? `, ${tally.err} ta xato` : ''}.`));
      btn.disabled = false;
      if (mismatch.length && tok) {
        const fix = h('button', { class: 'btn sm', type: 'button' }, `Parollarni boshlang'ich holatga tiklash (${mismatch.length})`);
        fix.addEventListener('click', () => resetInitialPasswords(mismatch, tok, box, fix));
        box.append(h('li', { class: 'note' },
          h('div', null, `${mismatch.length} ta akkaunt bazada bor, lekin paroli boshqacha (masalan, avval boshqa parol bilan yaratilgan). Akkauntlar o'chirilmaydi: faqat parol o'rnatiladi. Superadmin parolni tiklashi mumkin:`),
          fix));
      }
    }
  }

  // Bazada bor akkauntlarning parolini docs kutgan boshlang'ich parolga o'rnatadi (faqat superadmin, faqat siz bossangiz)
  async function resetInitialPasswords(list, tok, box, btn) {
    btn.disabled = true;
    let okCount = 0;
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      const text = `Parol tiklash: ${ROLES[a.role] ? ROLES[a.role].name : a.role} ${a.phone}`;
      const li = h('li', { class: 'run' }, text);
      box.append(li);
      const r = await raw('POST', '/api/users/reset-password', { phone_number: a.phone, new_password: a.password }, tok);
      const probe = r.status === 200 ? await raw('POST', '/api/auth/login', { phone_number: a.phone, password: a.password }) : null;
      if (r.status === 200 && (probe.status === 200 || probe.status === 403)) {
        li.className = 'ok'; li.textContent = `${text} — tiklandi, login tekshirildi`;
        accounts[a.phone] = { phone: a.phone, password: a.password, role: a.role, name: a.name, initial: true };
        okCount += 1;
      } else {
        li.className = 'err'; li.textContent = `${text} — ${r.status}: ${apiMsg(r)}`;
      }
    }
    save('resto_docs_accounts', accounts);
    renderQuick();
    if (!auth.access) fillFor(loginRole);
    box.append(h('li', { class: okCount === list.length ? 'ok sum' : 'err' }, `Parollar tiklandi: ${okCount}/${list.length}.`));
    btn.disabled = okCount === list.length;
  }

  let authBox;
  function sectionLogin() {
    phoneInp = h('input', { placeholder: '+998901234567', autocomplete: 'off', inputmode: 'tel' });
    passInp = h('input', { type: 'password', placeholder: 'Parol', autocomplete: 'off' });
    // Parol yashirin: ochiq ko'z ikonasi (bosilsa ko'rsatadi). Parol ochiq: ko'zi yumilgan (chizilgan) ko'z (bosilsa yashiradi).
    const SVG = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
    const EYE_OPEN = SVG('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>');
    const EYE_CLOSED = SVG('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>');
    const eye = h('button', { type: 'button', class: 'eye', title: 'Parolni ko\'rsatish', 'aria-label': 'Parolni ko\'rsatish', html: EYE_OPEN });
    eye.addEventListener('click', () => {
      const show = passInp.type === 'password';
      passInp.type = show ? 'text' : 'password';
      eye.innerHTML = show ? EYE_CLOSED : EYE_OPEN;
      eye.title = show ? 'Parolni yashirish' : 'Parolni ko\'rsatish';
      eye.setAttribute('aria-label', eye.title);
    });
    const onEnter = (e) => { if (e.key === 'Enter') submitLogin(); };
    phoneInp.addEventListener('keydown', onEnter);
    passInp.addEventListener('keydown', onEnter);
    loginMsg = h('div', { class: 'log muted' });
    roleTabsBox = h('div', { class: 'role-tabs compact' });
    accChips = h('div', { class: 'quick' });
    fillFor(loginRole); renderQuick();
    authBox = h('div', { class: 'tokens' });
    return h('section', { id: 'login-panel' },
      h('h2', null, 'Kirish paneli'),
      h('p', { class: 'lead' }, 'Sinash uchun avval kiring. Rolni tanlang: telefon va parol inputlarga o\'zi yoziladi, xohlasangiz o\'zgartiring. Tokenlar faqat shu sahifada, brauzeringizda saqlanadi. Access muddati tugasa, panel o\'zi refresh qiladi.'),
      h('div', { class: 'card login' },
        h('div', null, h('div', { class: 'muted', style: 'font-size:.82rem' }, 'Qaysi rol sifatida kirasiz?'), roleTabsBox),
        accChips,
        h('div', { class: 'row' },
          h('label', { class: 'field' }, 'Telefon', phoneInp),
          h('label', { class: 'field' }, 'Parol', h('div', { class: 'pw' }, passInp, eye)),
          h('button', { class: 'btn', type: 'button', onclick: submitLogin }, 'Kirish')),
        (() => {
          const log = h('ol', { class: 'steplog' });
          const btn = h('button', { class: 'btn ghost sm', type: 'button' }, 'Asosiy rollarni qo\'shish');
          btn.addEventListener('click', () => restoreInitialAccounts(btn, log));
          return h('div', { class: 'restore' },
            h('div', { class: 'row' }, btn, h('span', { class: 'muted', style: 'font-size:.8rem' }, 'Bazada admin, ofitsiant, oshpaz, omborchi yoki mijoz yo\'q bo\'lsa (login/parol xato chiqsa), shu tugma yetishmayotganini qo\'shadi. Mavjudlariga tegmaydi.')),
            log);
        })(),
        authBox,
        h('div', { class: 'row' },
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => manualRefresh(loginMsg) }, 'Access ni yangilash (refresh)'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await doLogout(); loginMsg.textContent = 'Chiqildi: refresh bekor qilindi.'; } }, 'Chiqish (logout)')),
        loginMsg,
        h('div', null, h('div', { class: 'muted', style: 'font-size:.82rem;margin-bottom:6px' }, 'Kontekst: oldingi javoblardan olingan id lar'), h('div', { id: 'ctxbar', class: 'ctxbar' }))));
  }
  function renderAuth() {
    const pill = $('#who-pill');
    if (auth.access) {
      pill.classList.add('on');
      pill.textContent = auth.me ? `● ${`${auth.me.first_name} ${auth.me.last_name}`.trim() || auth.me.phone_number} (${ROLES[auth.me.role] ? ROLES[auth.me.role].name : auth.me.role})` : '● Kirilgan';
    } else { pill.classList.remove('on'); pill.textContent = '● Kirilmagan'; }
    if (!authBox) return;
    authBox.replaceChildren();
    if (!auth.access) { authBox.append(h('div', { class: 'tok' }, h('b', null, 'Holat'), 'Kirilmagan. Yuqoridan akkaunt tanlang.')); return; }
    const aLeft = jwtExp(auth.access) - Date.now();
    const rLeft = jwtExp(auth.refresh) - Date.now();
    authBox.append(
      h('div', { class: 'tok' }, h('b', null, 'Kim'), auth.me ? `${auth.me.first_name} ${auth.me.last_name} (${auth.me.role})${auth.me.restaurant ? ' · restoran #' + auth.me.restaurant.id : ''}` : '—'),
      h('div', { class: 'tok' }, h('b', null, 'Access qoldi'), h('span', { class: `time${aLeft < 60000 ? ' low' : ''}`, 'data-exp': 'access' }, fmtLeft(aLeft))),
      h('div', { class: 'tok' }, h('b', null, 'Refresh qoldi'), h('span', { class: 'time', 'data-exp': 'refresh' }, fmtLeft(rLeft))));
  }
  setInterval(() => {
    document.querySelectorAll('[data-exp]').forEach((el) => {
      const left = jwtExp(auth[el.dataset.exp]) - Date.now();
      el.textContent = fmtLeft(left);
      el.classList.toggle('low', el.dataset.exp === 'access' && left < 60000);
    });
  }, 1000);

  /* ================= 3. Rollar ================= */
  let roleTabsEl; let rolePanel; let matrixEl;
  function callRow(id) {
    const ep = EP.get(id);
    const [method, ...rest] = id.split(' ');
    return h('button', { class: 'call', type: 'button', onclick: () => openEndpoint(`#${anchor(id)}`) }, methodBadge(method), h('span', { class: 'p' }, rest.join(' ')), h('span', { class: 't' }, ep ? ep.title : ''));
  }
  function renderRolePanel(key) {
    const r = ROLES[key];
    const mine = ENDPOINTS.filter((e) => allowed(e, key));
    rolePanel.replaceChildren(
      h('div', { class: 'card' },
        h('div', null, roleChip(key), h('code', null, key)),
        h('p', null, r.summary),
        h('div', { class: 'callout', html: inline(`Kirgandan keyin \`GET /api/users/me\` javobidagi **role** qiymati \`${key}\`. Frontend shunga qarab quyidagi sahifalarni ko'rsatadi. Bu rol jami **${mine.length} ta** endpointni chaqira oladi.`) }),
        h('h3', null, 'Ilovangizdagi sahifalar va ular chaqiradigan so\'rovlar'),
        h('div', { class: 'screens' }, r.screens.map((s) => h('div', { class: 'screen' }, h('h4', null, s.name), h('p', null, s.desc), s.calls.map(callRow)))),
        h('h3', null, 'Hamma rollar uchun umumiy'),
        h('div', { class: 'screen' }, COMMON.map(callRow)),
        h('h3', null, 'Bu rol qila olmaydi'),
        h('ul', { class: 'tight cannot' }, r.cannot.map((c) => h('li', null, c))),
        h('details', null, h('summary', null, `Ruxsat etilgan barcha ${mine.length} ta endpoint (bo'limlar bo'yicha)`),
          GROUPS.map((g) => { const list = mine.filter((e) => e.group === g.key); return list.length ? h('div', null, h('h3', null, g.title), list.map((e) => callRow(e.id))) : null; }))));
  }
  function renderRoleTabs(active) {
    roleTabsEl.replaceChildren(...Object.keys(ROLES).map((k) => h('button', { type: 'button', class: k === active ? 'on' : '', onclick: () => showRoleTab(k) }, h('span', { class: 'dot', style: `background:${ROLES[k].color}` }), ROLES[k].name)));
  }
  function showRoleTab(k) { renderRoleTabs(k); renderRolePanel(k); highlightMatrix(k); }
  function buildMatrix() {
    const keys = Object.keys(ROLES);
    const body = h('tbody');
    GROUPS.forEach((g) => {
      body.append(h('tr', { class: 'grp' }, h('td', { colspan: keys.length + 1 }, g.title)));
      ENDPOINTS.filter((e) => e.group === g.key).forEach((ep) => {
        const tr = h('tr', { onclick: () => openEndpoint(`#${anchor(ep.id)}`), title: 'Tavsifni ochish' },
          h('td', null, h('div', { class: 'mrow' }, methodBadge(ep.method), h('div', { class: 'mtxt' }, h('span', { class: 'mt' }, ep.title), h('span', { class: 'mp' }, ep.path)))),
          keys.map((k) => h('td', { 'data-role': k }, allowed(ep, k)
            ? h('span', { class: 'perm ok', title: `${ROLES[k].name}: ruxsat bor` }, '✓')
            : h('span', { class: 'perm no', title: `${ROLES[k].name}: server 403 qaytaradi` }, '403'))));
        body.append(tr);
      });
    });
    const head = h('tr', null, h('th', null, 'Endpoint'), keys.map((k) => h('th', { 'data-role': k, title: ROLES[k].name }, h('span', { class: 'rh' }, h('span', { class: 'dot', style: `background:${ROLES[k].color}` }), ROLES[k].short))));
    const foot = h('tr', { class: 'total' }, h('td', null, 'Jami ruxsat etilgan'), keys.map((k) => h('td', { 'data-role': k }, ENDPOINTS.filter((e) => allowed(e, k)).length)));
    matrixEl = h('table', { class: 'matrix' }, h('thead', null, head), body, h('tfoot', null, foot));
    const legend = h('div', { class: 'mlegend' },
      h('span', null, h('span', { class: 'perm ok' }, '✓'), ' ruxsat bor'),
      h('span', null, h('span', { class: 'perm no' }, '403'), ' ruxsat yo\'q: server 403 qaytaradi'),
      ...keys.map((k) => h('span', { class: 'muted' }, `${ROLES[k].short} — ${ROLES[k].name}`)));
    return h('div', null, legend, h('div', { class: 'matrix-wrap' }, matrixEl));
  }
  function highlightMatrix(role) {
    if (!matrixEl) return;
    matrixEl.querySelectorAll('[data-role]').forEach((c) => c.classList.toggle('cur', c.dataset.role === role));
  }
  function sectionRoles() {
    roleTabsEl = h('div', { class: 'role-tabs' });
    rolePanel = h('div');
    const sec = h('section', { id: 'roles' },
      h('h2', null, 'Rollar: kim nima qila oladi'),
      h('p', { class: 'lead' }, 'Tizimda 6 ta rol bor. Ruxsati yo\'q so\'rovga server 403 qaytaradi. Quyida har bir rol uchun ilovangizda qaysi sahifalar kerakligi va ular qaysi so\'rovlarni chaqirishi ko\'rsatilgan.'),
      roleTabsEl, rolePanel,
      h('details', { style: 'margin-top:16px' }, h('summary', null, 'Ruxsatlar jadvali: hamma endpointlar × hamma rollar'), buildMatrix()));
    showRoleTab(currentRole || 'restaurant_admin');
    return sec;
  }

  /* ================= 4. Access/Refresh oqimi (axios) ================= */
  const API_JS = `// src/api.js: butun ilova shu axios instance orqali so'rov yuboradi
import axios from 'axios';

const BASE_URL = 'http://localhost:5000';
export const api = axios.create({ baseURL: BASE_URL });

// 1) Har so'rovga access tokenni qo'shamiz
api.interceptors.request.use((config) => {
  const access = localStorage.getItem('access');
  if (access) config.headers.Authorization = \`Bearer \${access}\`;
  return config;
});

// 2) Access tugaganda (401 + token_expired) refresh qilib, so'rovni bir marta takrorlaymiz
let refreshing = null; // bir vaqtda ko'p so'rov 401 olsa, refresh faqat bir marta chaqiriladi

function toLogin() {
  localStorage.removeItem('access');
  localStorage.removeItem('refresh');
  window.location.href = '/login';
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (response?.status !== 401 || config.url.startsWith('/api/auth/')) throw error;

    if (response.data?.code !== 'token_expired' || config._retried) {
      toLogin(); // token_invalid yoki not_authenticated: qayta kirish kerak
      throw error;
    }

    config._retried = true;
    try {
      refreshing ??= axios
        .post(\`\${BASE_URL}/api/auth/refresh\`, { refresh: localStorage.getItem('refresh') })
        .finally(() => { refreshing = null; });
      const { data } = await refreshing;           // { access }
      localStorage.setItem('access', data.access); // refresh o'zgarmaydi
      return api(config);                          // asl so'rovni yangi access bilan takrorlash
    } catch (e) {
      toLogin(); // refresh ham yaroqsiz
      throw e;
    }
  },
);`;

  const AUTH_JS = `// src/auth.js
import { api } from './api';

export async function login(phone_number, password) {
  const { data } = await api.post('/api/auth/login', { phone_number, password });
  localStorage.setItem('access', data.access);
  localStorage.setItem('refresh', data.refresh);

  const me = await api.get('/api/users/me'); // rol va restoran shu yerdan olinadi
  return me.data;                            // { role, restaurant, first_name, ... }
}

export async function logout() {
  try {
    await api.post('/api/auth/logout', { refresh: localStorage.getItem('refresh') });
  } finally {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
  }
}`;

  const USAGE_JS = `import { api } from './api';
import { login, logout } from './auth';

// 1. Kirish: tokenlar saqlanadi, me - rol va restoran
const me = await login('+998901234567', 'Password123');   // me.role === 'waiter'
const restaurantId = me.restaurant.id;

// 2. Himoyalangan so'rovlar: Authorization sarlavhasini interceptor o'zi qo'shadi
const { data: tables } = await api.get(\`/api/restaurants/\${restaurantId}/tables\`);

const { data: order } = await api.post(\`/api/restaurants/\${restaurantId}/orders\`, {
  table: tables.results[0].id,
});
await api.post(\`/api/orders/\${order.id}/items\`, { dish: 1, quantity: 2 });
await api.post(\`/api/orders/\${order.id}/send-to-kitchen\`);

// 3. Access muddati tugasa ham kod o'zgarmaydi: interceptor refresh qiladi va so'rovni takrorlaydi

// 4. Chiqish: refresh bekor qilinadi, tokenlar o'chiriladi
await logout();`;

  const WIRE_TXT = `POST /api/auth/login             -> 200 { access, refresh }
GET  /api/users/me               -> 200 { role: 'waiter', restaurant: { id: 1 } }
GET  /api/restaurants/1/tables   -> 200
        ... 15 daqiqa o'tadi, access tugaydi ...
POST /api/restaurants/1/orders   -> 401 { code: 'token_expired' }   <- interceptor ushladi
POST /api/auth/refresh           -> 200 { access }                  <- yangi access saqlandi
POST /api/restaurants/1/orders   -> 201                             <- so'rov avtomatik takrorlandi
POST /api/auth/logout            -> 200 { detail: 'Chiqildi.' }`;

  const ERR_JS = `try {
  await api.post(\`/api/restaurants/\${restaurantId}/tables\`, { seats: 0 });
} catch (err) {
  const { status, data } = err.response ?? {};

  if (status === 400) {
    // data = { seats: ["Qiymat kamida 1 bo'lishi kerak."] }  -> xatoni maydon yonida ko'rsating
    // yoki data = { detail: '...' }                                -> umumiy xabar
  } else if (status === 403) {
    // bu rolga ruxsat yo'q
  }
}`;

  function sectionAuth() {
    const step = (n, cls, title, body) => h('div', { class: `st ${cls || ''}` }, h('div', { class: 'n' }, n), h('div', null, h('b', null, title), h('div', { html: inline(body) })));
    return h('section', { id: 'auth-flow' },
      h('h2', null, 'Access va Refresh oqimi (axios)'),
      h('p', { class: 'lead' }, 'Ikki token bor. Access — qisqa muddatli (15 daqiqa), har so\'rovda yuboriladi. Refresh — uzoq muddatli (7 kun), faqat yangi access olish uchun. Quyida butun oqim axios bilan, ketma-ket ko\'rsatilgan: 1-2 fayl yozib qo\'ysangiz bas, qolgan kodingiz tokenlar haqida o\'ylamaydi.'),
      h('h3', null, 'Oqim qadamlari'),
      h('div', { class: 'flow' },
        step(1, '', 'Kirish', '`POST /api/auth/login` → `{ access, refresh }`. Ikkalasini saqlang, so\'ng `GET /api/users/me` bilan rolni oling.'),
        step(2, '', 'Har so\'rovda access yuboring', '`Authorization: Bearer <access>` — buni request interceptor qiladi. Faqat `/api/auth/*` tokensiz ishlaydi.'),
        step(3, 'alt', 'Access tugaydi', 'Server `401` va `{ "code": "token_expired" }` qaytaradi. Foydalanuvchiga xato ko\'rsatilmaydi.'),
        step(4, 'alt', 'Yangilash va takrorlash', 'Response interceptor `POST /api/auth/refresh` ni chaqiradi, yangi access ni saqlaydi va asl so\'rovni takrorlaydi.'),
        step(5, 'bad', 'Refresh ham yaroqsiz', 'Refresh tugagan yoki logout qilingan bo\'lsa `/api/auth/refresh` ham `401` beradi: tokenlar o\'chadi, foydalanuvchi login sahifasiga qaytadi.'),
        step(6, '', 'Chiqish', '`POST /api/auth/logout` — refresh bekor qilinadi, ikkala token ham o\'chiriladi.')),
      h('h3', null, '1-qadam: axios instance va interceptorlar'),
      codeBlock(API_JS),
      h('h3', null, '2-qadam: login va logout'),
      codeBlock(AUTH_JS),
      h('h3', null, '3-qadam: so\'rovlar ketma-ketligi'),
      h('p', null, 'Ofitsiant misolida: kirish → stollarni olish → buyurtma ochish → taom qo\'shish → oshxonaga yuborish → chiqish.'),
      codeBlock(USAGE_JS),
      h('h3', null, 'Tarmoqda nima bo\'ladi'),
      h('p', null, 'Access tugagan paytdagi so\'rovlar ketma-ketligi:'),
      codeBlock(WIRE_TXT),
      h('h3', null, 'Xatolarni ushlash'),
      codeBlock(ERR_JS),
      h('h3', null, '401 xato kodlari'),
      table(['code', 'Qachon', 'Nima qilish kerak'], [
        [td(h('code', null, 'not_authenticated')), 'Authorization sarlavhasi yo\'q', 'Login sahifasiga'],
        [td(h('code', null, 'token_expired')), 'Access (yoki refresh) muddati tugagan', 'Access bo\'lsa — refresh qiling va so\'rovni takrorlang'],
        [td(h('code', null, 'token_invalid')), 'Token buzilgan, logout qilingan yoki foydalanuvchi o\'chirilgan', 'Login sahifasiga'],
        [td(h('code', null, 'invalid_credentials')), 'Login da telefon yoki parol noto\'g\'ri', 'Xabarni ko\'rsating'],
        [td(h('code', null, 'account_inactive')), 'Login da: xodim ishdan bo\'shatilgan (status 403)', 'Xabarni ko\'rsating'],
      ]),
      h('div', { class: 'callout warn', html: inline('Logout faqat **refresh** ni bekor qiladi. Access stateless bo\'lgani uchun o\'z muddati tugaguncha ishlayveradi — shuning uchun logout da uni frontendda ham o\'chirib tashlang.') }));
  }

  /* ----- Ssenariydan axios kodi generatsiyasi ----- */
  const VAR = { restaurant: 'restaurantId', table: 'tableId', category: 'categoryId', dish: 'dishId', ingredient: 'ingredientId', recipe: 'recipeId', order: 'orderId', orderItem: 'orderItemId', staff: 'staffId', admin: 'adminId', reservation: 'reservationId' };
  const VAR_KEY = Object.fromEntries(Object.entries(VAR).map(([k, v]) => [v, k]));
  const lit = (v) => (typeof v === 'string' ? (v.startsWith('@@') ? v.slice(2) : `'${v.replace(/'/g, "\\'")}'`) : String(v));
  const objLit = (o, multi) => {
    const entries = Object.entries(o);
    const one = `{ ${entries.map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} }`;
    if (!multi || one.length <= 70) return one;
    return `{\n${entries.map(([k, v]) => `  ${k}: ${lit(v)},`).join('\n')}\n}`;
  };
  const camel = (s) => s.replace(/-(\w)/g, (m, c) => c.toUpperCase());

  function flowCode(fl) {
    const out = []; const known = new Set(); const unknown = new Set(); const names = new Set();
    const use = (v) => { if (!known.has(v)) unknown.add(v); return v; };
    const uniq = (base) => { let n = base; let i = 2; while (names.has(n)) { n = base + i; i += 1; } names.add(n); return n; };
    const cred = PLACEHOLDER_CREDS;
    const hasRestaurant = ['restaurant_admin', 'waiter', 'cook', 'storekeeper'].includes(fl.role);
    const loginLines = (phone, pw, comment) => {
      out.push(`const me = await login('${phone}', '${pw}');${comment ? `   // ${comment}` : ''}`);
      if (hasRestaurant) { out.push('const restaurantId = me.restaurant.id;'); known.add('restaurantId'); }
    };

    const firstEp = fl.steps.map(([r]) => EP.get(r)).find(Boolean);
    const hasLogin = fl.steps.some(([r]) => r === 'POST /api/auth/login');
    if (!hasLogin && firstEp && firstEp.id !== 'POST /api/auth/register') { loginLines(cred[0], cred[1], `kirish (role: ${fl.role})`); out.push(''); }

    fl.steps.forEach(([ref, text], i) => {
      const ep = EP.get(ref);
      if (!ep) return;
      out.push(`// ${i + 1}. ${text.replace(/`/g, '')}`);
      if (ref === 'POST /api/auth/login') { loginLines(cred[0], cred[1]); out.push(''); return; }
      if (ref === 'GET /api/users/me') { out.push('// login() allaqachon me ni qaytardi: me.role, me.restaurant.id'); out.push(''); return; }

      const pathParam = ep.params.find((p) => p.in === 'path');
      let usesVar = false;
      const path = ep.path.replace(/\{id\}/g, () => { usesVar = true; return `\${${use(VAR[PARAM_CTX[pathParam.desc]])}}`; });
      const pathLit = usesVar ? `\`${path}\`` : `'${path}'`;

      const body = {};
      ep.body.filter((b) => (b.required || BODY_CTX[b.name]) && b.example !== undefined && b.example !== '<refresh token>').forEach((b) => {
        let v = b.example;
        if (BODY_CTX[b.name]) v = `@@${use(VAR[BODY_CTX[b.name]])}`;
        else if (b.name === 'reservation_date') v = '2026-12-01';
        else if (b.name === 'status') { const m = text.match(/status: (\w+)/); if (m) v = m[1]; }
        body[b.name] = v;
      });
      const query = {};
      ep.params.filter((p) => p.in === 'query' && p.name !== 'page' && (p.required || (p.example !== '' && p.example != null))).forEach((p) => {
        query[p.name] = p.name === 'reservation_date' ? '2026-12-01' : p.example;
      });

      const m = ep.method.toLowerCase();
      const args = [pathLit];
      const withBody = ['post', 'patch'].includes(m);
      if (withBody && Object.keys(body).length) args.push(objLit(body, true));
      if (Object.keys(query).length) { if (withBody && args.length === 1) args.push('undefined'); args.push(`{ params: ${objLit(query)} }`); }
      const call = `api.${m}(${args.join(', ')})`;

      const create = ep.method === 'POST' && CREATE_CTX.find(([re]) => re.test(ep.id));
      const list = ep.method === 'GET' && LIST_CTX.find(([re]) => re.test(ep.id));
      if (create) {
        const v = VAR[create[1]];
        out.push(`const ${v} = (await ${call}).data.id;`); known.add(v); unknown.delete(v);
      } else if (ep.method === 'GET') {
        const segs = ep.path.split('/').filter((s) => s && s !== 'api' && !s.startsWith('{'));
        let nm = camel(segs[segs.length - 1]);
        if (/\{id\}$/.test(ep.path) && nm.endsWith('s')) nm = nm.slice(0, -1);
        nm = uniq(nm);
        out.push(`const { data: ${nm} } = await ${call};`);
        if (ep.path.endsWith('/menu') &&!known.has('dishId')) { out.push(`const dishId = ${nm}[0].dishes[0].id;   // mijoz tanlagan taom id si`); known.add('dishId'); unknown.delete('dishId'); }
        if (list && !known.has(VAR[list[1]])) {
          const v = VAR[list[1]];
          const first = Array.isArray(ep.res) ? `${nm}[0].id` : `${nm}.results[0].id`;
          out.push(`const ${v} = ${first};   // foydalanuvchi tanlagan element id si`); known.add(v); unknown.delete(v);
        }
      } else if (ref === 'POST /api/auth/register') {
        out.push(`await ${call};`);
        out.push(`const me = await login('${body.phone_number}', '${body.password}');`);
      } else out.push(`await ${call};`);
      out.push('');
    });

    const head = ["import { api } from './api';", "import { login } from './auth';", '', '// Quyidagi qatorlar async funksiya ichida bajariladi'];
    unknown.forEach((v) => head.push(`const ${v} = 1;   // ${(CTX_LABELS[VAR_KEY[v]] || v).toLowerCase()} id si (oldingi so'rovdan olinadi)`));
    return [...head, '', ...out].join('\n').trimEnd();
  }

  /* ================= 5. Umumiy qoidalar ================= */
  function sectionRules() {
    const pg = { count: 25, next: `${BASE}/api/restaurants?page=2`, previous: null, results: ['...'] };
    return h('section', { id: 'rules' },
      h('h2', null, 'Umumiy qoidalar'),
      h('h3', null, 'Ro\'yxatlar sahifalanadi (10 tadan)'),
      h('p', { html: inline('Ro\'yxat endpointlari quyidagi shaklda qaytadi. Keyingi sahifa: `?page=2`. Sahifa tugagach 404.') }),
      codeBlock(pretty(pg), { json: true }),
      h('p', null, 'Istisno: menyu, retsept va bo\'sh stollar ro\'yxati sahifalanmaydi, oddiy massiv qaytadi.'),
      h('h3', null, 'Xatolar'),
      table(['Status', 'Ma\'nosi', 'Shakli'], [
        [td(h('code', null, '400')), 'Validatsiya xatosi', '`{ "price": ["Qiymat kamida 0 bo\'lishi kerak."] }` yoki `{ "detail": "..." }`. Kalit — maydon nomi, xatoni shu maydon yonida ko\'rsating.'],
        [td(h('code', null, '401')), 'Kirilmagan / token muddati', '`{ "detail": "...", "code": "token_expired" }`'],
        [td(h('code', null, '403')), 'Bu rolga ruxsat yo\'q', '`{ "detail": "Bu amalni bajarishga ruxsatingiz yo\'q." }`'],
        [td(h('code', null, '404')), 'Topilmadi', '`{ "detail": "Topilmadi." }`'],
        [td(h('code', null, '429')), 'Juda ko\'p urinish (login/register)', '`{ "detail": "...", "code": "too_many_requests" }`'],
        [td(h('code', null, '204')), 'O\'chirildi', 'Javob tanasi bo\'sh'],
      ]),
      h('h3', null, 'Ma\'lumot turlari'),
      h('ul', { class: 'tight' },
        h('li', { html: inline('**id** lar butun son: `1`, `2`, `3`...') }),
        h('li', { html: inline('**Pul va miqdor** (`price`, `current_stock`, `total_order_price`) javobda **string**: `"5000.00"`. Hisoblashda `Number()` ishlating; yuborishda string ham, son ham mumkin.') }),
        h('li', { html: inline('**Sana** `YYYY-MM-DD`, **vaqt** `HH:MM` yuboriladi, javobda `HH:MM:SS`.') }),
        h('li', { html: inline('**PATCH** — faqat o\'zgargan maydonlarni yuboring. PUT yo\'q.') }),
        h('li', { html: inline('Yo\'l oxiridagi `/` ixtiyoriy: `/api/tables/1` va `/api/tables/1/` bir xil.') })),
      h('h3', null, 'Yo\'l nomlash qoidasi'),
      h('p', { html: inline('Hammasi `/api` ostida, kichik harf, so\'zlar `-` bilan ajratilgan (`stock-in`, `recipe-items`), resurs nomlari ko\'plikda (`/tables`, `/orders`). Restoranga tegishli ro\'yxat va yaratish `/api/restaurants/{id}/...` orqali, bitta resurs ustidagi amal esa `/api/tables/{id}` kabi qisqa yo\'l orqali.') }),
      h('h3', null, 'Maydon va qiymat nomlari'),
      h('p', { html: inline('Hamma maydon, rol va status nomlari inglizcha, `snake_case` ko\'rinishida. Frontend ham aynan shunday yozishi kerak. Eng ko\'p uchraydiganlari:') }),
      table(['Nom', 'Izoh'], [
        ['`restaurant`', 'Restoran id (javob va body maydoni)'],
        ['`seats`', 'Stol o\'rinlari soni'],
        ['`payment_method`', 'To\'lov turi: `unset` (tanlanmagan), `cash`, `card`'],
        ['`free`, `occupied`', 'Stol holati'],
        ['`open`, `closed`', 'Buyurtma holati'],
        ['`new`, `sent`, `cooking`, `ready`', 'Buyurtmadagi taom holati (oshxona oqimi)'],
        ['`pending`, `confirmed`, `completed`, `cancelled`', 'Bron holati'],
        ['`waiter`, `cook`, `storekeeper`', 'Xodim rollari (ofitsiant, oshpaz, omborchi)'],
      ]),
      h('h3', null, 'Tezlik chegarasi (production)'),
      h('p', { html: inline('Production da `POST /api/auth/login` va `/api/auth/register` bir IP dan 15 daqiqada 30 martagacha chaqirilishi mumkin; oshsa `429` va `{ "code": "too_many_requests" }` qaytadi. Test rejimida (shu sahifa) chegara yoqilmaydi.') }));
  }

  /* ================= 6. Statuslar ================= */
  function sectionEnums() {
    return h('section', { id: 'enums' },
      h('h2', null, 'Statuslar va qiymatlar'),
      h('p', { class: 'lead' }, 'Serverga faqat shu qiymatlarni yuboring; boshqasi 400 beradi.'),
      h('div', { class: 'grid' }, ENUMS.map((e) => h('div', { class: 'card' }, h('b', null, e.name), h('p', { class: 'muted' }, e.desc),
        table(['Qiymat', 'Ma\'nosi'], e.values.map(([v, d]) => [td(h('code', null, v)), d]))))));
  }

  /* ================= Sinash paneli ================= */
  const CHOICE_RE = /^([\w-]+(?: [\w-]+)?(?: \| [\w-]+(?: [\w-]+)?)+)/;
  const choicesOf = (spec) => { const m = (spec.desc || '').match(CHOICE_RE); return m ? m[1].split(' | ') : null; };

  function defaultValue(name, example) {
    if (name === 'reservation_date') return todayPlus(7);
    if (example === '<refresh token>') return auth.refresh || '';
    return example === undefined || example === null ? '' : String(example);
  }

  function makeInput(spec, ctxKey) {
    const choices = spec.type === 'boolean' ? ['true', 'false'] : choicesOf(spec);
    let el;
    const initial = ctxKey && ctx[ctxKey] != null ? String(ctx[ctxKey]) : defaultValue(spec.name, spec.example);
    if (choices) {
      el = h('select', null, h('option', { value: '' }, spec.required ? '— tanlang —' : '— yuborilmaydi —'), choices.map((c) => h('option', { value: c }, c)));
      el.value = choices.includes(initial) ? initial : '';
    } else {
      const type = spec.type === 'integer' ? 'number' : spec.type === 'date' ? 'date' : 'text';
      el = h('input', { type, value: initial, placeholder: spec.type === 'time' ? 'HH:MM' : spec.name, autocomplete: 'off' });
    }
    if (ctxKey) bindCtx(el, ctxKey);
    return el;
  }
  // label: yo'l parametri uchun odam o'qiydigan nom (masalan "Restoran id"), qolganlari uchun maydon nomi
  const fieldLabel = (spec, el, where, label) => h('label', { class: 'field', 'data-f': spec.name },
    h('span', null, label || spec.name, spec.required ? h('span', { class: 'req' }, ' *') : null, where ? ` · ${where}` : ''),
    el, spec.desc ? h('span', { class: 'hint' }, spec.desc) : null, h('span', { class: 'ferr' }));

  function convert(spec, value) {
    if (value === '') return undefined;
    if (spec.type === 'integer') return Number(value);
    if (spec.type === 'boolean') return value === 'true';
    return value;
  }

  function tryPanel(ep, { onSuccess } = {}) {
    const inputs = { path: {}, query: {}, body: {} };
    const specs = { path: {}, query: {}, body: {} };
    const paramFields = [];
    ep.params.forEach((p) => {
      const key = PARAM_CTX[p.desc];
      const el = makeInput({ ...p, type: 'string' }, p.in === 'path' ? key : null);
      inputs[p.in][p.name] = el; specs[p.in][p.name] = p;
      paramFields.push(p.in === 'path'
        ? fieldLabel({ ...p, name: p.name, desc: '' }, el, null, p.desc)
        : fieldLabel(p, el, 'query'));
    });
    const bodyFields = ep.body.map((b) => {
      const el = makeInput(b, BODY_CTX[b.name]);
      inputs.body[b.name] = el; specs.body[b.name] = b;
      return fieldLabel(b, el);
    });

    const area = ep.body.length ? h('textarea', { spellcheck: 'false', hidden: true }) : null;
    const jsonToggle = ep.body.length ? h('input', { type: 'checkbox' }) : null;
    const reqLine = h('div', { class: 'reqline' });
    const logEl = h('div', { class: 'log' });
    const out = h('div');
    const snipBox = h('div');
    const warn = h('div');
    let tab = 'axios';

    function formBody() {
      const o = {};
      ep.body.forEach((b) => { const v = convert(b, inputs.body[b.name].value); if (v !== undefined) o[b.name] = v; });
      return o;
    }
    function vals() {
      const used = [];
      const path = ep.path.replace(/\{(\w+)\}/g, (m, k) => { const v = inputs.path[k] ? inputs.path[k].value : ''; const ck = PARAM_CTX[specs.path[k].desc]; if (ck) used.push([ck, v]); return encodeURIComponent(v); });
      const query = {};
      Object.entries(inputs.query).forEach(([k, el]) => { if (el.value !== '') query[k] = el.value; });
      const qs = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
      const url = qs.length ? `${path}?${qs.join('&')}` : path;
      let body;
      if (area) body = jsonToggle.checked ? JSON.parse(area.value || '{}') : formBody();
      return { url, path, query, body, ctxUsed: used };
    }
    function renderPreview() {
      let v;
      try { v = vals(); } catch { reqLine.replaceChildren(h('span', { class: 'ferr' }, 'Body JSON xato — to\'g\'rilang.')); return; }
      reqLine.replaceChildren(methodBadge(ep.method), h('code', null, v.url));
      const hasBody = v.body !== undefined && Object.keys(v.body).length > 0;
      const m = ep.method.toLowerCase();
      const flat = hasBody && Object.values(v.body).every((x) => typeof x !== 'object' || x === null);
      const args = [`'${v.path}'`];
      const qKeys = Object.keys(v.query);
      if (['post', 'patch'].includes(m) && hasBody) args.push(flat ? objLit(v.body, true) : pretty(v.body));
      if (qKeys.length) {
        if (['post', 'patch'].includes(m) && args.length === 1) args.push('undefined');
        args.push(`{ params: ${objLit(Object.fromEntries(qKeys.map((k) => [k, /^\d+$/.test(v.query[k]) ? Number(v.query[k]) : v.query[k]])))} }`);
      }
      const axiosCode = `${m === 'delete' ? '' : 'const { data } = '}await api.${m}(${args.join(', ')});   // api: "Access va Refresh" bo'limidagi axios instance`;
      const curl = [`curl -X ${ep.method} '${BASE}${v.url}'`,
        ep.auth ? "  -H 'Authorization: Bearer <ACCESS>'" : null,
        hasBody ? "  -H 'Content-Type: application/json'" : null,
        hasBody ? `  -d '${JSON.stringify(v.body)}'` : null].filter(Boolean).join(' \\\n');
      snipBox.replaceChildren(codeBlock(tab === 'axios' ? axiosCode : curl));
    }
    function renderWarn() {
      warn.replaceChildren();
      if (!ep.auth) return;
      const need = rolesOf(ep).filter((r) => credsFor(r));
      const buttons = need.length
        ? h('div', { class: 'quick' }, need.slice(0, 3).map((r) => h('button', { type: 'button', onclick: async () => { await loginAs(r); } }, h('span', { class: 'dot', style: `background:${ROLES[r].color}` }), ROLES[r].name)))
        : h('div', { class: 'muted' }, 'Bu rollar uchun akkaunt hali yaratilmagan. "Ssenariylar" bo\'limida yarating, keyin bu yerda tugma paydo bo\'ladi.');
      if (!auth.access) {
        warn.append(h('div', { class: 'warnbox' }, 'Kirilmagan. Shu so\'rov uchun mos rol bilan kiring:', buttons));
      } else if (auth.me && !allowed(ep, auth.me.role)) {
        warn.append(h('div', { class: 'warnbox' }, `Siz ${ROLES[auth.me.role].name} sifatida kirgansiz. Bu so\'rov ${rolesOf(ep).map((r) => ROLES[r].name).join(', ')} uchun, shuning uchun 403 olasiz. Rolni almashtiring:`, buttons));
      }
    }

    // JSON <-> forma almashinuvi
    if (area) {
      jsonToggle.addEventListener('change', () => {
        if (jsonToggle.checked) { area.value = pretty(formBody()); area.hidden = false; bodyBox.hidden = true; }
        else {
          try { const o = JSON.parse(area.value || '{}'); ep.body.forEach((b) => { const el = inputs.body[b.name]; el.value = o[b.name] === undefined ? '' : String(o[b.name]); }); } catch { /* o'zgarishsiz */ }
          area.hidden = true; bodyBox.hidden = false;
        }
        renderPreview();
      });
    }
    const bodyBox = h('div', { class: 'row' }, bodyFields);

    const send = h('button', { class: 'btn', type: 'button' }, 'Yuborish');
    send.addEventListener('click', async () => {
      logEl.textContent = ''; out.replaceChildren();
      panel.querySelectorAll('.field').forEach((f) => { f.classList.remove('bad'); $('.ferr', f).textContent = ''; });
      let v;
      try { v = vals(); } catch { logEl.textContent = 'Body to\'g\'ri JSON emas.'; return; }
      send.disabled = true;
      try {
        const lines = [];
        const r = await request(ep.method, v.url, v.body && Object.keys(v.body).length ? v.body : (ep.body.length ? v.body : undefined), ep.auth, (m) => lines.push(m));
        logEl.textContent = lines.join('\n');
        const cls = `s${String(r.status)[0]}`;
        const parts = [h('div', { style: 'margin-top:10px' }, h('span', { class: `status ${cls}` }, r.status), ` ${r.ms} ms`)];
        if (r.status >= 400 && r.data && typeof r.data === 'object') {
          const lines2 = [];
          Object.entries(r.data).forEach(([k, msgs]) => {
            const field = $(`.field[data-f="${k}"]`, panel);
            const text = Array.isArray(msgs) ? msgs.join(' ') : String(msgs);
            if (field) { field.classList.add('bad'); $('.ferr', field).textContent = text; } else if (k !== 'code') lines2.push(text);
          });
          if (r.status === 403) lines2.push('Bu rolga ruxsat yo\'q. Sinash panelidagi rol tugmasi (yoki Kirish paneli) orqali mos rolga o\'ting.');
          if (lines2.length) parts.push(h('div', { class: 'errbox' }, lines2.join(' ')));
        }
        parts.push(r.data === null || r.data === '' ? h('div', { class: 'log' }, '(bo\'sh javob)') : codeBlock(typeof r.data === 'string' ? r.data : pretty(r.data), { json: typeof r.data !== 'string' }));
        if (r.status >= 200 && r.status < 300) {
          learn(ep, v, r);
          rememberFrom(ep, v);
          if (ep.id === 'POST /api/auth/login') { auth.access = r.data.access; auth.refresh = r.data.refresh; const me = await raw('GET', '/api/users/me', undefined, auth.access); auth.me = me.status === 200 ? me.data : null; save(AUTH_KEY, auth); if (auth.me) setRole(auth.me.role); renderAuth(); }
          if (ep.id === 'POST /api/auth/refresh') { auth.access = r.data.access; save(AUTH_KEY, auth); renderAuth(); }
          if (ep.id === 'POST /api/auth/logout') { auth.access = auth.refresh = auth.me = null; save(AUTH_KEY, auth); renderAuth(); }
          const nexts = NEXT.get(ep.id);
          if (nexts && nexts.length) {
            const n = nexts[0];
            parts.push(h('div', { class: 'nextstep' }, `Ssenariyda keyingi qadam (${n.flow}): `, h('a', { href: `#${anchor(n.ref)}`, onclick: (ev) => { ev.preventDefault(); openEndpoint(`#${anchor(n.ref)}`); } }, n.ref)));
          }
          if (onSuccess) onSuccess();
        }
        out.replaceChildren(...parts);
      } catch (e) {
        out.replaceChildren(h('div', { class: 'errbox' }, `Tarmoq xatosi: ${e.message}. Server ishlayaptimi?`));
      } finally { send.disabled = false; }
    });

    const tabBtns = [['axios', 'axios'], ['curl', 'cURL']].map(([t, label]) => h('button', {
      type: 'button', class: t === tab ? 'on' : '',
      onclick: () => { tab = t; tabBtns.forEach((btn, i) => btn.classList.toggle('on', i === (t === 'axios' ? 0 : 1))); renderPreview(); },
    }, label));

    const panel = h('div', { class: 'try' },
      h('b', null, 'Sinab ko\'rish'),
      warn,
      paramFields.length ? h('div', { class: 'row' }, paramFields) : null,
      bodyFields.length ? bodyBox : null,
      area,
      jsonToggle ? h('label', { class: 'opt' }, jsonToggle, 'JSON ko\'rinishida tahrirlash') : null,
      reqLine,
      h('div', { style: 'margin-top:10px' }, send),
      logEl, out,
      h('div', { class: 'tabs' }, tabBtns), snipBox);
    panel.addEventListener('input', renderPreview);
    panel.addEventListener('change', renderPreview);
    panel.refreshWarn = renderWarn;
    renderPreview(); renderWarn();
    tryPanels.push(panel);
    return panel;
  }
  const tryPanels = [];

  /* ================= 7. Ssenariylar ================= */
  const NEXT = new Map();
  FLOWS.forEach((fl) => fl.steps.forEach(([ref], i) => {
    if (!EP.has(ref)) return;
    const nx = fl.steps.slice(i + 1).find(([r2]) => EP.has(r2));
    if (nx) { const arr = NEXT.get(ref) || []; arr.push({ ref: nx[0], flow: fl.title }); NEXT.set(ref, arr); }
  }));

  const flowCards = [];
  function sectionFlows() {
    const sec = h('section', { id: 'flows' },
      h('h2', null, 'Ssenariylar: qadam-baqadam'),
      h('p', { class: 'lead' }, 'Har bir rol uchun ilovangizda so\'rovlar qaysi tartibda chaqirilishi. "Sinash" ni bosib qadamni shu yerning o\'zida bajaring: oldingi qadamda olingan id lar keyingisiga o\'zi qo\'yiladi.'));
    FLOWS.forEach((fl) => {
      const steps = h('div', { class: 'fsteps' });
      fl.steps.forEach(([ref, text], i) => {
        const ep = EP.get(ref);
        const stepEl = h('div', { class: 'fstep' });
        const num = h('div', { class: 'n' }, i + 1);
        const content = h('div');
        if (ep) {
          let panelEl = null;
          const holder = h('div');
          const toggle = h('button', { class: 'btn ghost sm', type: 'button' }, 'Sinash ▾');
          toggle.addEventListener('click', () => {
            if (!panelEl) { panelEl = tryPanel(ep, { onSuccess: () => { stepEl.classList.add('done'); num.textContent = '✓'; } }); holder.append(panelEl); toggle.textContent = 'Yopish ▴'; return; }
            panelEl.hidden = !panelEl.hidden; toggle.textContent = panelEl.hidden ? 'Sinash ▾' : 'Yopish ▴';
          });
          content.append(
            h('div', { class: 'line' }, methodBadge(ep.method), h('code', null, ep.path), toggle, h('a', { href: `#${anchor(ref)}`, onclick: (ev) => { ev.preventDefault(); openEndpoint(`#${anchor(ref)}`); } }, 'to\'liq tavsif')),
            h('div', { class: 'txt', html: inline(text) }), holder);
        } else {
          content.append(h('div', { class: 'line' }, h('code', null, ref)), h('div', { class: 'txt', html: inline(text) }));
        }
        stepEl.append(num, content); steps.append(stepEl);
      });
      const hint = h('div', { class: 'muted', style: 'font-size:.78rem;margin-top:4px' });
      const card = h('div', { class: 'card flowcard', 'data-role': fl.role },
        h('div', { class: 'fhead' }, h('div', null, roleChip(fl.role), h('b', null, fl.title)),
          h('div', null,
            h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { const res = await loginAs(fl.role); hint.textContent = res.ok ? `${ROLES[fl.role].name} sifatida kirildi.` : (res.r.data && res.r.data.detail) || ''; } }, `${ROLES[fl.role].name} sifatida kirish`),
            hint)),
        h('p', { class: 'muted' }, fl.intro),
        h('details', null, h('summary', null, "Kodda ko'rish (axios)"), codeBlock(flowCode(fl))),
        steps);
      flowCards.push(card); sec.append(card);
    });
    return sec;
  }

  /* ================= 8. Endpointlar ================= */
  const cards = [];
  const pathEl = (path) => h('span', { class: 'path', html: esc(path).replace(/\{(\w+)\}/g, '<i>{$1}</i>') });

  function buildBody(ep) {
    const left = [];
    if (ep.desc) left.push(h('p', { html: inline(ep.desc) }));
    if (ep.tip) left.push(h('div', { class: 'callout', html: inline(`Maslahat: ${ep.tip}`) }));
    left.push(h('h4', null, 'Kim chaqira oladi'), h('div', null, whoChips(ep)));
    if (ep.params.length) left.push(h('h4', null, 'Yo\'l va query parametrlari'), table(['Nom', 'Qayerda', 'Izoh'], ep.params.map((p) => [td(h('span', { class: 'mono' }, p.name), p.required ? h('span', { class: 'req' }, ' *') : null), p.in === 'path' ? 'yo\'lda' : 'query', p.desc])));
    if (ep.body.length) left.push(h('h4', null, 'Body maydonlari  (* — majburiy)'), table(['Maydon', 'Turi', 'Izoh'], ep.body.map((f) => [td(h('span', { class: 'mono' }, f.name), f.required ? h('span', { class: 'req' }, ' *') : null), td(h('code', null, f.type)), f.desc])));
    left.push(h('h4', null, 'Muvaffaqiyatli javob'), h('span', { class: 'status s2' }, ep.status));
    left.push(ep.res !== undefined ? codeBlock(pretty(ep.res), { json: true }) : h('span', { class: 'muted' }, ' Javob tanasi bo\'sh'));
    if (ep.errors.length) left.push(h('h4', null, 'Mumkin bo\'lgan xatolar'), table(['Status', 'Sabab'], ep.errors.map(([s, t]) => [td(h('span', { class: `status s${String(s)[0]}` }, s)), t])));
    return [h('div', { class: 'col-l' }, left), h('div', { class: 'col-r' }, tryPanel(ep))];
  }

  function card(ep) {
    const body = h('div', { class: 'ep-body two', hidden: true });
    const dots = h('span', { class: 'dots' }, !ep.auth || ep.who === 'any'
      ? h('span', { class: 'chip open' }, ep.auth ? 'hamma' : 'ochiq')
      : ep.who.map((r) => h('span', { class: 'dot-r', style: `background:${ROLES[r].color}`, title: ROLES[r].name }, ROLES[r].short)));
    const lock = h('span', { class: 'lock', hidden: true }, '🔒 bu rolga yopiq');
    const head = h('button', { class: 'ep-head', type: 'button', 'aria-expanded': 'false' },
      methodBadge(ep.method), h('span', { class: 'ep-main' }, h('span', { class: 'ep-title' }, ep.title), pathEl(ep.path)), lock, dots);
    const el = h('article', { class: 'ep', id: anchor(ep.id) }, head, body);
    let built = false;
    const toggle = (open) => {
      const willOpen = open ?? body.hidden;
      if (willOpen && !built) { body.append(...buildBody(ep)); built = true; }
      body.hidden = !willOpen;
      head.setAttribute('aria-expanded', String(willOpen));
    };
    head.addEventListener('click', () => toggle());
    el.open = () => toggle(true);
    el.ep = ep; el.lockEl = lock;
    el.text = `${ep.method} ${ep.path} ${ep.title} ${ep.desc} ${ep.group}`.toLowerCase();
    cards.push(el);
    return el;
  }

  let onlyRoleBox; let roleInfo;
  function sectionEndpoints() {
    onlyRoleBox = h('input', { type: 'checkbox', checked: true });
    onlyRoleBox.addEventListener('change', refreshVisibility);
    roleInfo = h('div', { class: 'callout', hidden: true });
    const root = h('section', { id: 'endpoints' },
      h('h2', null, 'Endpointlar'),
      h('p', { class: 'lead' }, `Jami ${ENDPOINTS.length} ta endpoint. Kartochkani bosib oching: chapda tavsif va namunalar, o'ngda "Sinab ko'rish" formasi.`),
      roleInfo,
      h('label', { class: 'opt', id: 'only-role', hidden: true }, onlyRoleBox, h('span', { id: 'only-role-text' }, 'Faqat tanlangan rolga ruxsat etilganlar')));
    GROUPS.forEach((g) => {
      root.append(h('div', { class: 'group-title', id: `g-${g.key}`, 'data-group': g.key }, h('h3', { style: 'margin:0' }, g.title), h('small', null, g.note || '')));
      ENDPOINTS.filter((e) => e.group === g.key).forEach((ep) => root.append(card(ep)));
    });
    root.append(h('div', { id: 'no-results', class: 'empty', hidden: true }, 'Hech narsa topilmadi.'));
    return root;
  }

  function openEndpoint(hash) {
    const el = document.getElementById(hash.slice(1));
    if (!el || !el.open) return;
    el.classList.add('force');
    el.open();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1800);
  }

  /* ================= rol va qidiruv filtri ================= */
  let searchQ = '';
  function refreshVisibility() {
    const onlyRole = currentRole && onlyRoleBox.checked;
    let shown = 0;
    const counts = {};
    cards.forEach((c) => {
      const ok = currentRole ? allowed(c.ep, currentRole) : true;
      c.classList.toggle('locked', !!currentRole && !ok);
      c.lockEl.hidden = !(currentRole && !ok);
      c.classList.toggle('hide-role', !!onlyRole && !ok);
      const match = !searchQ || c.text.includes(searchQ);
      c.classList.toggle('hide-search', !match);
      const vis = !(onlyRole && !ok) && match;
      if (vis) { shown++; counts[c.ep.group] = (counts[c.ep.group] || 0) + 1; }
    });
    document.querySelectorAll('.group-title').forEach((g) => { g.hidden = !counts[g.dataset.group]; });
    document.querySelectorAll('[data-navgroup]').forEach((a) => {
      const total = ENDPOINTS.filter((e) => e.group === a.dataset.navgroup).length;
      $('small', a).textContent = currentRole ? `${counts[a.dataset.navgroup] || 0}/${total}` : total;
    });
    $('#no-results').hidden = shown > 0;
  }
  function setRole(role) {
    currentRole = role || '';
    try { localStorage.setItem('resto_docs_role', currentRole); } catch { /* ignore */ }
    $('#role-select').value = currentRole;
    const allowedCount = currentRole ? ENDPOINTS.filter((e) => allowed(e, currentRole)).length : ENDPOINTS.length;
    roleInfo.hidden = !currentRole;
    $('#only-role').hidden = !currentRole;
    if (currentRole) {
      roleInfo.innerHTML = inline(`**${ROLES[currentRole].name}** nuqtai nazaridan: ${allowedCount} ta endpoint ruxsat etilgan, ${ENDPOINTS.length - allowedCount} tasi yopiq. ${ROLES[currentRole].summary}`);
      $('#only-role-text').textContent = `Faqat ${ROLES[currentRole].name} uchun ruxsat etilganlar`;
    }
    flowCards.forEach((c) => { c.classList.toggle('mine', !!currentRole && c.dataset.role === currentRole); c.classList.toggle('dim', !!currentRole && c.dataset.role !== currentRole); });
    if (currentRole && rolePanel) showRoleTab(currentRole);
    refreshVisibility();
    tryPanels.forEach((p) => p.refreshWarn && p.refreshWarn());
  }

  /* ================= yig'ish ================= */
  const main = $('#main');
  const SECTIONS = [
    ['start', 'Boshlash', sectionStart], ['login-panel', 'Kirish paneli', sectionLogin], ['roles', 'Rollar va ruxsatlar', sectionRoles],
    ['auth-flow', 'Access va Refresh', sectionAuth], ['rules', 'Umumiy qoidalar', sectionRules], ['enums', 'Statuslar', sectionEnums],
    ['flows', 'Ssenariylar', sectionFlows],
  ];
  SECTIONS.forEach(([, , fn]) => main.append(fn()));
  main.append(sectionEndpoints());

  // Rol tanlash ro'yxati
  const sel = $('#role-select');
  sel.append(h('option', { value: '' }, 'Hammasi'), ...Object.entries(ROLES).map(([k, r]) => h('option', { value: k }, r.name)));
  sel.addEventListener('change', () => setRole(sel.value));

  // Yon menyu
  const nav = $('#nav');
  nav.append(h('h4', null, 'Boshlash'));
  SECTIONS.forEach(([id, title]) => nav.append(h('a', { href: `#${id}` }, title)));
  nav.append(h('h4', null, 'Endpointlar'));
  GROUPS.forEach((g) => nav.append(h('a', { href: `#g-${g.key}`, 'data-navgroup': g.key }, g.title, h('small', null, ENDPOINTS.filter((e) => e.group === g.key).length))));

  // Faol bo'lim scroll holatidan hisoblanadi. Oxirgi qisqa guruhlar (Oshxona, Bronlar) ham faol bo'ladi:
  // sahifa oxirida bo'lsa oxirgi bo'lim, menyudan bosilgan bo'lsa shu bo'lim faol turadi.
  const links = [...nav.querySelectorAll('a')];
  const spyTargets = [...document.querySelectorAll('main section, .group-title')];
  let forced = null; // menyudan bosilgan bo'lim id si: foydalanuvchi o'zi scroll qilguncha faol qoladi
  const setActive = (id) => links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
  function updateActive() {
    if (forced) { setActive(forced); return; }
    const visible = spyTargets.filter((t) => !t.hidden && t.offsetParent !== null);
    if (!visible.length) return;
    let current = visible[0];
    visible.forEach((t) => { if (t.getBoundingClientRect().top <= 140) current = t; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = visible[visible.length - 1];
    setActive(current.id);
  }
  let spyTick = false;
  window.addEventListener('scroll', () => { if (spyTick) return; spyTick = true; setTimeout(() => { spyTick = false; updateActive(); }, 40); }, { passive: true });
  ['wheel', 'touchmove', 'keydown'].forEach((evt) => window.addEventListener(evt, () => { if (forced) { forced = null; updateActive(); } }, { passive: true }));
  window.addEventListener('resize', updateActive);

  $('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    document.body.classList.remove('nav-open');
    forced = a.getAttribute('href').slice(1); // bosilgan bo'lim darhol faol bo'ladi
    updateActive();
  });
  $('#search').addEventListener('input', (e) => { searchQ = e.target.value.trim().toLowerCase(); refreshVisibility(); if (searchQ) location.hash = '#endpoints'; });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); } });
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#ep-')) openEndpoint(location.hash); });

  // Test rejimi belgisi: so'rovlar qayerga ketishini doim ko'rsatib turadi
  const badge = $('#test-badge');
  badge.textContent = `TEST · ${location.host}`;
  badge.title = `Bu sahifadagi barcha so'rovlar faqat ${BASE} ga yuboriladi`;

  // Superadmin tugmasi .env dagi (SUPERADMIN_PHONE / SUPERADMIN_PASSWORD) akkaunt bilan ishlashi uchun
  fetch('/docs/config.json').then((r) => (r.ok ? r.json() : null)).then((cfg) => {
    if (!cfg) return;
    if (cfg.superadmin) SUPER.creds = [cfg.superadmin.phone, cfg.superadmin.password];
    // Bazada boshlang'ich yaratilgan akkauntlar (har bir rol uchun bittadan): faqat yo'q bo'lsa qo'shiladi
    INITIAL_ACCOUNTS = cfg.accounts || [];
    INITIAL_RESTAURANT = cfg.restaurant || null;
    (cfg.accounts || []).forEach((a) => { if (!accounts[a.phone] || accounts[a.phone].initial) accounts[a.phone] = { phone: a.phone, password: a.password, role: a.role, name: a.name, initial: true }; });
    save('resto_docs_accounts', accounts);
    if (!auth.access) fillFor(loginRole);
    renderQuick();
  }).catch(() => { /* standart qiymat qoladi */ });

  renderAuth(); renderCtx(); updateActive();
  setRole(currentRole);
  if (location.hash.startsWith('#ep-')) openEndpoint(location.hash);
})();

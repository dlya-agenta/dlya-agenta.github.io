// Поддержка (ТЗ v2, шаг 3.3, окно В): кнопка «💬 Помощь» на всех страницах сайта (и на экране входа) → окно: мои обращения, новое обращение
// (категория, текст, до 3 скриншотов — сжатие до 1600 px здесь, в браузере), переписка с ИИ-помощником и специалистом, «Вопрос решён».
// Лимиты, ответ ИИ и статусы — только сервер (функция support). Без входа обращение привязано к ключу sup_key в localStorage этого браузера.
// В режиме «С клиентом» кнопка скрыта (agent-only). support.html — то же окно на всю страницу (?t=<№> — сразу обращение), админка — support.admin.js (#admin).
window.SUPPORT = (() => {
  const API = String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/support');
  const CAT = { pay: 'Оплата', access: 'Доступ', bug: 'Ошибка', idea: 'Предложение' };
  const ST = { new: 'Новое', work: 'В работе', done: '✅ Решено', admin: '❗ На проверку Admin' };
  const WHO = { ai: '🤖 ИИ-помощник', admin: '👤 Специалист' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const get = (k, ss) => { try { return (ss ? sessionStorage : localStorage).getItem(k); } catch { return null; } };
  const tokenOf = () => { try { return JSON.parse(get('token')); } catch { return null; } };
  function keyOf() {
    let k = get('sup_key');
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(k ?? '')) {
      k = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { localStorage.setItem('sup_key', k); } catch { /* приватный режим — ключ живёт до закрытия вкладки */ }
    }
    return k;
  }
  let fpv = null;
  async function fp() {   // как fp() в app.js: отпечаток браузера для лимита без входа (на сервере — вместе с IP и ключом)
    if (fpv !== null) return fpv;
    const s = [navigator.userAgent, navigator.language, Intl.DateTimeFormat().resolvedOptions().timeZone, `${screen.width}x${screen.height}x${screen.colorDepth}`,
      navigator.hardwareConcurrency, navigator.platform, window.PARTNER?.cv?.() ?? ''].join('|');
    try { fpv = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }
    catch { fpv = ''; }
    return fpv;
  }
  async function call(action, extra = {}) {
    const t = tokenOf(), pay = t ? null : get('pay_token', true);
    const body = { action, key: keyOf(), fp: await fp(), ...(t ? { auth: { token: t } } : pay ? { pay } : {}), ...extra };
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || data.error) throw Object.assign(new Error(data.message || data.error || `HTTP ${r.status}`), { data, status: r.status });
    return data;
  }

  // ---------- скриншоты: только картинки, длинная сторона до 1600 px, JPEG до ~1,9 МБ ----------
  async function bitmap(file) {
    if (window.createImageBitmap) { try { return await createImageBitmap(file); } catch { /* ниже — через data: */ } }
    const url = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
    return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });   // CSP: data: можно, blob: нельзя
  }
  async function shrink(file) {
    if (!/^image\//.test(file.type)) throw new Error('Можно прикладывать только картинки (скриншоты)');
    const b = await bitmap(file).catch(() => { throw new Error('Не удалось открыть картинку'); });
    const k = Math.min(1, 1600 / Math.max(b.width, b.height)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(b.width * k)); c.height = Math.max(1, Math.round(b.height * k));
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(b, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.72, 0.6, 0.45]) {
      const url = c.toDataURL('image/jpeg', q), size = Math.round((url.length - 23) * 3 / 4);
      if (size < 1.9 * 1024 * 1024) return { url, data: url.slice(url.indexOf(',') + 1), size };
    }
    throw new Error('Скриншот слишком большой');
  }

  // ---------- окно ----------
  let S = null, view = 'list', T = null, files = [], cat = null, poll = null, polls = 0, root = null, page = false, busy = false;
  const $ = s => root?.querySelector(s);
  function shell() {
    if (document.getElementById('sup')) return;
    const fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'sup-fab'; fab.className = 'sup-fab agent-only'; fab.setAttribute('aria-label', 'Помощь');
    fab.innerHTML = '<span aria-hidden="true">💬</span><b>Помощь</b><i class="sup-dot" hidden></i>';
    fab.onclick = () => open();
    const wrap = document.createElement('div');
    wrap.id = 'sup'; wrap.className = 'sup-wrap'; wrap.hidden = true;
    wrap.innerHTML = '<div class="sup-panel" role="dialog" aria-modal="true" aria-label="Помощь"></div>';
    wrap.onclick = e => { if (e.target === wrap) close(); };
    document.body.append(fab, wrap);
    root = wrap.querySelector('.sup-panel');
    bind(root);
  }
  function bind(el) {
    el.addEventListener('click', onClick);
    el.addEventListener('submit', onSubmit);
    el.addEventListener('change', onFile);
    el.addEventListener('input', e => { if (e.target.name === 'text') { const n = $('.sup-count'); if (n) n.textContent = `${e.target.value.trim().length} / 4000`; } });
  }
  function dot() { const d = document.querySelector('#sup-fab .sup-dot'); if (d) d.hidden = !(S?.unread > 0); }
  async function open(id) {
    if (!page) { document.getElementById('sup').hidden = false; document.documentElement.classList.add('sup-on'); }
    render('<div class="sup-load"><div class="spinner"></div></div>');
    try { S = await call('state'); } catch (e) { return render(errBox(e.message)); }
    dot();
    if (id) return openTicket(id);
    const list = await call('list').catch(() => ({ items: [] }));
    S.items = list.items;
    if (!S.items.length) return newForm();
    showList();
  }
  function close() {
    if (page) return;
    stop(); document.getElementById('sup').hidden = true; document.documentElement.classList.remove('sup-on');
  }
  const head = (title, back) => `<header class="sup-head">${back ? '<button type="button" class="sup-ic" data-sup="back" aria-label="Назад">‹</button>' : ''}<b>${title}</b>
    ${page ? '' : '<button type="button" class="sup-ic" data-sup="close" aria-label="Закрыть">✕</button>'}</header>`;
  const errBox = m => `${head('Помощь')}<div class="sup-body"><p class="sup-err">${esc(m)}</p><button type="button" class="btn soft" data-sup="retry">Попробовать ещё раз</button></div>`;
  function render(html) { if (root) root.innerHTML = html; }
  const pill = st => `<span class="sup-st sup-st-${esc(st)}">${esc(ST[st] ?? st)}</span>`;
  const limText = () => {
    const l = S?.limit ?? {};
    if (l.lim == null) return '';
    return `${S.me.login ? `После входа — ${l.lim} обращения в сутки` : `Без входа — ${l.lim} обращение в сутки, после входа — ${S.user_day ?? 3}`}; сегодня осталось: <b>${l.left}</b>. Уточнения в одном обращении не считаются новым обращением.`;
  };

  function showList() {
    view = 'list'; stop();
    const items = S.items ?? [];
    render(`${head('Помощь')}<div class="sup-body">
      <button type="button" class="btn primary sup-new" data-sup="new">✍️ Новое обращение</button>
      <div class="sup-group">Мои обращения</div>
      ${items.map(t => `<button type="button" class="sup-item${t.unread ? ' unread' : ''}" data-open="${t.id}">
        <span class="sup-item-top"><b>№${t.id} · ${esc(CAT[t.category] ?? t.category)}</b>${pill(t.status)}</span>
        <span class="sup-item-text">${esc(t.title)}</span>
        <small>${when(t.updated_at)}${t.wait ? ' · ИИ-помощник отвечает…' : t.unread ? ' · новый ответ' : ''}</small></button>`).join('')}
      ${S.me.guest ? '<p class="sup-hint">Обращения без входа видны только в этом браузере.</p>' : ''}</div>`);
  }
  function newForm() {
    view = 'new'; stop(); files = []; cat = cat ?? null;
    const left = S?.limit?.left, none = left === 0;
    render(`${head('Новое обращение', (S.items ?? []).length > 0)}<form class="sup-body" id="sup-form" novalidate>
      <div class="sup-group">Категория</div>
      <div class="sup-cats">${Object.entries(CAT).map(([k, v]) => `<button type="button" class="chip${cat === k ? ' on' : ''}" data-cat="${k}">${v}</button>`).join('')}</div>
      <p class="sup-note">Опишите вопрос подробно: что делали, что ожидали и что получилось. Если что-то не работает — приложите скриншот. Так ответ будет точным и с первого раза.</p>
      <textarea name="text" rows="6" maxlength="4000" placeholder="Например: оплатил PRO через CryptoBot 31.10 в 14:20, 99 USDT, а в профиле всё ещё «Подписчик»" ${none ? 'disabled' : ''}></textarea>
      <span class="sup-count">0 / 4000</span>
      ${S.me.guest ? `<input name="name" maxlength="60" placeholder="Ваше имя — по желанию" autocomplete="name">
        <input name="contact" maxlength="80" placeholder="Телефон или Telegram для ответа — по желанию" autocomplete="tel">` : ''}
      <div class="sup-files"></div>
      ${S.files ? `<label class="btn soft sup-attach">📎 Скриншот (до ${S.files})<input type="file" accept="image/*" multiple hidden name="file"></label>` : ''}
      ${limText() ? `<p class="sup-warn">⚠️ ${limText()}</p>` : ''}
      <p class="sup-err" hidden></p>
      <button class="btn primary" type="submit" ${none ? 'disabled' : ''}>${none ? 'Лимит на сегодня исчерпан' : 'Отправить'}</button>
      ${S.ai ? '<p class="sup-hint">Сначала отвечает ИИ-помощник — обычно за минуту. Сложные вопросы он передаёт специалисту.</p>' : '<p class="sup-hint">Ответ специалиста придёт сюда' + (S.me.login ? ' и в Telegram-бот, если он привязан в профиле' : '') + '.</p>'}
    </form>`);
    drawFiles();
  }
  function drawFiles() {
    const box = $('.sup-files'); if (!box) return;
    box.innerHTML = files.map((f, i) => `<span class="sup-thumb"><img src="${f.url}" alt=""><button type="button" data-unfile="${i}" aria-label="Убрать">✕</button></span>`).join('');
    const a = $('.sup-attach'); if (a) a.hidden = files.length >= S.files;
  }
  async function openTicket(id) {
    view = 'ticket'; stop();
    try { T = await call('get', { id }); } catch (e) { return render(errBox(e.message)); }
    drawTicket(); watch();
  }
  function drawTicket() {
    const t = T.ticket, left = Math.max(0, (t.max_msgs ?? 10) - (t.msgs ?? 0));
    const msgs = T.msgs.map(m => m.role === 'sys' ? `<div class="sup-sys">${esc(m.text)} · ${when(m.at)}</div>` : `<div class="sup-msg sup-${m.role}">
      ${m.role !== 'user' ? `<small class="sup-from">${WHO[m.role] ?? ''}</small>` : ''}<div class="sup-text">${esc(m.text)}</div>
      ${(m.files ?? []).filter(f => f.url).map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener" class="sup-shot"><img src="${esc(f.url)}" alt="Скриншот" loading="lazy"></a>`).join('')}
      <small class="sup-at">${when(m.at)}</small></div>`).join('');
    const waitAi = t.wait ? '<div class="sup-msg sup-ai sup-typing"><small class="sup-from">🤖 ИИ-помощник</small><div class="sup-text">Отвечает<span class="sup-dots"><i></i><i></i><i></i></span></div></div>' : '';
    const quiet = !t.wait && t.status !== 'done' && (T.msgs[T.msgs.length - 1]?.role === 'user')
      ? `<p class="sup-hint">${t.status === 'admin' || t.ai_state ? 'Вопрос у специалиста. Ответ придёт сюда' + (S?.me?.login ? ' и в Telegram-бот, если он привязан' : '') + '.' : ''}</p>` : '';
    render(`${head(`№${t.id} · ${esc(CAT[t.category] ?? t.category)}`, !page || (S?.items ?? []).length > 0)}<div class="sup-body sup-chat">
      <div class="sup-meta">${pill(t.status)}<small>создано ${when(t.created_at)}</small></div>
      ${msgs}${waitAi}${quiet}</div>
      <form class="sup-reply" id="sup-reply" novalidate>
        ${left ? `<div class="sup-files"></div><textarea name="text" rows="2" maxlength="4000" placeholder="Уточнение или ответ…"></textarea>
        <div class="sup-row">${S?.files ? `<label class="sup-ic sup-attach" title="Скриншот">📎<input type="file" accept="image/*" multiple hidden name="file"></label>` : ''}
          <small>осталось сообщений: ${left} из ${t.max_msgs}</small><button class="btn primary" type="submit">Отправить</button></div>`
        : '<p class="sup-hint">В этом обращении больше нельзя писать — создайте новое.</p>'}
        <p class="sup-err" hidden></p>
        ${t.status !== 'done' ? '<button type="button" class="btn ghost sup-solved" data-sup="solved">✅ Вопрос решён</button>' : ''}
      </form>`);
    files = []; drawFiles();
    const body = $('.sup-chat'); if (body) body.scrollTop = body.scrollHeight;
  }
  // ждём ответ: пока ИИ отвечает — каждые 4 с (до ~3 минут), потом раз в 30 с, пока окно открыто
  function watch() {
    stop(); polls = 0;
    const tick = async () => {
      if (view !== 'ticket' || !T) return;
      polls++;
      try {
        const n = await call('get', { id: T.ticket.id });
        const changed = n.msgs.length !== T.msgs.length || n.ticket.wait !== T.ticket.wait || n.ticket.status !== T.ticket.status;
        if (changed && !busy && !($('#sup-reply textarea')?.value)) { T = n; drawTicket(); }
        else if (changed) T = n;
      } catch { /* сеть — попробуем ещё */ }
      poll = setTimeout(tick, T?.ticket?.wait && polls < 45 ? 4000 : 30000);
    };
    poll = setTimeout(tick, T?.ticket?.wait ? 4000 : 30000);
  }
  function stop() { clearTimeout(poll); poll = null; }

  async function onClick(e) {
    const b = e.target.closest('[data-sup], [data-open], [data-cat], [data-unfile]');
    if (!b) return;
    if (b.dataset.cat) { cat = b.dataset.cat; root.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === b)); return; }
    if (b.dataset.unfile) { files.splice(Number(b.dataset.unfile), 1); return drawFiles(); }
    if (b.dataset.open) return openTicket(Number(b.dataset.open));
    const a = b.dataset.sup;
    if (a === 'close') return close();
    if (a === 'retry') return open();
    if (a === 'new') return newForm();
    if (a === 'back') { if (view === 'ticket' || view === 'new') { const l = await call('list').catch(() => ({ items: S?.items ?? [] })); S.items = l.items; return S.items.length ? showList() : newForm(); } return close(); }
    if (a === 'solved') { b.disabled = true; try { T = await call('solved', { id: T.ticket.id }); drawTicket(); } catch (err) { showErr(err.message); b.disabled = false; } }
  }
  async function onFile(e) {
    if (e.target.name !== 'file') return;
    const list = [...e.target.files]; e.target.value = '';
    for (const f of list) {
      if (files.length >= (S?.files ?? 3)) { showErr(`Не больше ${S?.files ?? 3} скриншотов`); break; }
      try { files.push(await shrink(f)); } catch (err) { showErr(err.message); }
    }
    drawFiles();
  }
  function showErr(m) { const p = root.querySelectorAll('.sup-err'); const el = p[p.length - 1]; if (el) { el.textContent = m; el.hidden = !m; } }
  async function onSubmit(e) {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('button[type=submit]'), text = f.text?.value.trim() ?? '';
    showErr('');
    if (f.id === 'sup-form') {
      if (!cat) return showErr('Выберите категорию: Оплата, Доступ, Ошибка или Предложение');
      if (text.length < 15) return showErr('Опишите вопрос подробнее: что делали, что ожидали и что получилось');
    } else if (!text) return showErr('Напишите сообщение');
    busy = true; btn.disabled = true; const label = btn.textContent; btn.textContent = 'Отправляю…';
    try {
      const page_ = location.pathname.split('/').pop() + location.hash;
      const pics = files.map(x => ({ data: x.data }));
      if (f.id === 'sup-form') {
        T = await call('create', { category: cat, text, files: pics, page: page_ || 'index.html', name: f.name?.value ?? '', contact: f.contact?.value ?? '' });
        cat = null; S.limit.left = Math.max(0, (T.lim ?? 0) - (T.used ?? 0)); S.items = [{ id: T.ticket.id }, ...(S.items ?? [])];
      } else T = await call('send', { id: T.ticket.id, text, files: pics });
      view = 'ticket'; files = []; busy = false; drawTicket(); watch();
    } catch (err) { busy = false; btn.disabled = false; btn.textContent = label; showErr(err.message); }
  }

  // ---------- запуск ----------
  async function boot() {
    if (document.body.classList.contains('suppage')) return;   // страница support.html запускает сама
    shell();
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.getElementById('sup')?.hidden) close(); });
    try { S = await call('state'); dot(); } catch { /* кнопка работает и без этого */ }
    const q = new URLSearchParams(location.search).get('support');
    if (q) open(Number(q) || undefined);
  }
  // support.html: окно на всю страницу (el — место на странице)
  function mountPage(el, id) { page = true; root = el; bind(el); return open(id); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  return { open, close, call, mountPage };
})();

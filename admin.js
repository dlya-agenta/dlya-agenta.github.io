// Админ-панель (v5.5): участники и настройки сайта на одной странице. Поля меняются свободно — внизу одна кнопка «Сохранить»:
// она сохраняет всё изменённое (участники — admin_user по каждому, настройки — одним admin_settings). Кнопки-действия
// (одобрить, +30 дней, пакет номеров, пароль, выкинуть входы, админ, отключить) срабатывают сразу; несохранённые правки перед этим сохраняются.
// Групп больше нет: доступ к Архиву и Рекламе — по тарифу, у участника можно включить или выключить вручную.
window.ADMIN = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—';
  const dIn = s => s ? new Date(s).toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' }) : '';   // ГГГГ-ММ-ДД по МСК для поля даты
  const IDS = ['sub', 'pro', 'max'];
  const ST = { pending: ['заявка', 'warn'], active: ['активен', 'ok'], off: ['отключён', 'grey'] };
  const FEAT = { map: 'Карта', favorites: 'Избранное', deals: 'Контакт', selections: 'Подборки PDF', messengers: 'Кнопки мессенджеров', registration: 'Регистрация на сайте',
    modern_filter: 'Фильтр «Дизайнерский» (по фото)', notes: 'Заметки к объектам', compare: 'Сравнение (резерв)' };
  const LIM = { phone_hour: 'Номеров в час (защита от выкачивания базы)', sel_hour: 'Подборок PDF в час', access_days: 'Дней доступа при одобрении' };
  const PF = [['name', 'Название', 'text'], ['usd', 'Цена в месяц, $', 'number'], ['phones_day', 'Номеров в день', 'number'], ['phones_month', 'Номеров в месяц', 'number'],
    ['devices', 'Устройств', 'number'], ['seats', 'Мест (пусто — без ограничений)', 'number'], ['disc_m3', 'Скидка за 3 мес, %', 'number'], ['disc_m12', 'Скидка за 12 мес, %', 'number'],
    ['opts.arch', 'Архив и старые объявления', 'check'], ['opts.rk_month', 'Черновики для рекламы в месяц', 'number'], ['opts.rk_daily', 'Готовых черновиков в день', 'number'],
    ['opts.mail_items', 'Объявлений в рассылке', 'number'], ['opts.mail_groups', 'Чатов для рассылок на мессенджер', 'number'], ['opts.house_chats', 'Домовые чаты', 'check'], ['opts.video', 'Ролики из фото', 'check']];
  let ui = null, r = null, show = 'all';
  const changed = new Map();   // JSON-ключ поля → значение: ["u", логин, поле] | ["s", путь настройки]

  const get = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
  const opt = (v, list) => list.map(([x, t]) => `<option value="${x}"${String(v) === x ? ' selected' : ''}>${t}</option>`).join('');
  const tri = (v, on, off) => opt(v == null ? '' : v ? '1' : '0', [['', 'как у тарифа'], ['1', on], ['0', off]]);
  const sIn = (path, type, v, extra = '') => type === 'check' ? `<input type="checkbox" data-s="${path}" ${v ? 'checked' : ''}${extra}>`
    : `<input type="${type}" data-s="${path}" value="${esc(v ?? '')}"${type === 'number' ? ' min="0" step="any" inputmode="decimal"' : ''}${extra}>`;

  function card(u) {
    const p = r.plans[u.plan] ?? r.plans.sub, adm = u.role === 'admin', q = u.q, own = ['lim_phone_hour', 'lim_phone_day', 'lim_phone_month', 'lim_sel_hour', 'max_sessions'].some(k => u[k] != null);
    const lims = [['lim_phone_hour', 'Номеров в час', r.limits.phone_hour], ['lim_phone_day', 'Номеров в день', p.phones_day], ['lim_phone_month', 'Номеров в месяц', p.phones_month],
      ['lim_sel_hour', 'PDF в час', r.limits.sel_hour], ['max_sessions', 'Устройств', p.devices]];
    return `<article class="ucard" data-login="${esc(u.login)}" data-plan="${esc(u.plan)}" data-st="${esc(u.status)}">
      <div class="u-head"><b>${esc(u.name || u.login)}</b><span class="tag ${ST[u.status]?.[1] ?? ''}">${ST[u.status]?.[0] ?? esc(u.status)}</span>${adm ? '<span class="tag">админ</span>' : ''}
        <small class="muted">${esc([u.login, u.tg_id ? 'Telegram' : '', u.phone, u.email, u.company].filter(Boolean).join(' · '))}</small></div>
      <div class="u-grid">
        <label class="field">Тариф<select data-k="plan">${opt(u.plan, IDS.map(id => [id, esc(r.plans[id].name)]))}</select></label>
        <label class="field">Период с<input type="date" data-k="period_start" value="${dIn(u.period_start ?? u.created_at)}"></label>
        <label class="field">Доступ до<input type="date" data-k="expires_at" value="${dIn(u.expires_at)}"></label>
        <label class="field">Архив<select data-k="can_arch">${tri(u.can_arch, 'включён', 'выключен')}</select></label>
        <label class="field">Реклама<select data-k="can_rk">${tri(u.can_rk, 'включена', 'выключена')}</select></label>
      </div>
      <p class="hint">${adm ? 'Админ — без лимитов и срока' : `Номера: сегодня ${q.day} из ${q.day_lim}, за месяц ${q.month} из ${q.month_lim}${u.packs?.length ? ` (пакеты: ${u.packs.map(k => `+${k.qty} до ${day(k.period_end)}`).join(', ')})` : ''}`}
        · PDF сегодня: ${u.pdfs_day} · входов: ${u.sessions} · последний вход: ${day(u.last_login)}</p>
      <details class="u-lims"${own ? ' open' : ''}><summary>Свои лимиты${own ? ' — заданы' : ''} <small class="muted">(пусто — по тарифу)</small></summary>
        <div class="u-grid">${lims.map(([k, t, ph]) => `<label class="field">${t}<input type="number" min="0" inputmode="numeric" data-k="${k}" placeholder="${ph}" value="${u[k] ?? ''}"></label>`).join('')}</div></details>
      <div class="u-act">
        ${u.status === 'pending' ? '<button type="button" class="btn primary" data-a="approve">Одобрить +30 дней</button>'
          : u.status === 'off' ? '<button type="button" class="btn soft" data-a="on">Включить</button>' : '<button type="button" class="btn soft" data-a="plus">+30 дней</button>'}
        ${adm ? '' : `<button type="button" class="btn soft" data-a="pack">+${r.pack.qty} номеров</button>`}
        <details class="u-more"><summary class="btn ghost">Ещё ▾</summary><div>
          <button type="button" class="btn ghost" data-a="pass">Новый пароль</button>
          <button type="button" class="btn ghost" data-a="kick">Выкинуть со всех устройств</button>
          <button type="button" class="btn ghost" data-a="role">${adm ? 'Снять админа' : 'Сделать админом'}</button>
          ${u.status !== 'off' ? '<button type="button" class="btn ghost bad" data-a="off">Отключить</button>' : ''}</div></details>
      </div></article>`;
  }

  function html() {
    const cnt = id => r.users.filter(u => u.plan === id && u.status === 'active' && u.role !== 'admin').length;
    const pend = r.users.filter(u => u.status === 'pending').length, off = r.users.filter(u => u.status === 'off').length;
    const chips = [['all', `Все (${r.users.length})`], ['pending', `Заявки (${pend})`], ...IDS.map(id => [id, `${esc(r.plans[id].name)} (${cnt(id)}${r.plans[id].seats ? ` из ${r.plans[id].seats}` : ''})`]), ['off', `Отключены (${off})`]];
    return `<div class="a-top"><input id="a-find" type="search" placeholder="Поиск: имя, логин, телефон" autocomplete="off">
        <div class="chips" id="a-show">${chips.map(([k, t]) => `<button type="button" class="chip${show === k ? ' on' : ''}" data-show="${k}">${t}</button>`).join('')}</div></div>
      <div id="a-users" class="ucards">${r.users.map(card).join('')}</div>
      <details class="a-sec"><summary>Тарифы и пакет номеров</summary>
        <div class="ascroll"><table class="atable ptable-admin"><thead><tr><th></th>${IDS.map(id => `<th>${esc(r.plans[id].name)}</th>`).join('')}</tr></thead><tbody>
          ${PF.map(([k, t, type]) => `<tr><td>${t}</td>${IDS.map(id => `<td>${sIn(`plans.${id}.${k}`, type, get(r.plans[id], k))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <div class="u-grid"><label class="field">Пакет: номеров${sIn('pack.qty', 'number', r.pack.qty)}</label><label class="field">Пакет: цена, $${sIn('pack.usd', 'number', r.pack.usd)}</label></div></details>
      <details class="a-sec"><summary>Лимиты для всех тарифов</summary><div class="u-grid">${Object.entries(LIM).map(([k, t]) => `<label class="field">${t}${sIn(`limits.${k}`, 'number', r.limits[k])}</label>`).join('')}</div>
        <p class="hint">Номера в день и в месяц, устройства — в тарифах. Свои лимиты участника — в его карточке.</p></details>
      <details class="a-sec"><summary>Объявления: источники и уникальность</summary><div class="u-grid">
        <label class="field">Ссылки на источники (Авито, Циан…) в карточке<select data-s="src_links">${opt(r.src_links, [['off', 'никому'], ['admin', 'только администраторам'], ['all', 'всем участникам']])}</select></label>
        <label class="field">Проверять ночью новых объявлений<input type="number" min="0" max="300" data-s="uniq.per_night" value="${r.uniq?.per_night ?? 40}"></label>
        <label class="chk opt">${sIn('uniq.enabled', 'check', r.uniq?.enabled)}<span>Проверка уникальности: есть ли живое объявление на площадках</span></label></div></details>
      <details class="a-sec"><summary>Инструменты сайта</summary><div class="u-grid">${Object.entries(FEAT).map(([k, t]) => `<label class="chk opt">${sIn(`features.${k}`, 'check', r.features[k])}<span>${t}</span></label>`).join('')}</div></details>
      <a class="btn soft a-pay" href="pay.html#admin">⚙ Оплата: CryptoBot, кошельки, журнал платежей →</a>
      <div class="a-save"><span id="a-n" class="muted">Изменений нет</span><button type="button" class="btn ghost" id="a-undo" disabled>Отменить</button><button type="button" class="btn primary" id="a-go" disabled>Сохранить</button></div>`;
  }

  function filter() {
    const q = ($('#a-find')?.value ?? '').toLowerCase();
    document.querySelectorAll('#a-users .ucard').forEach(c => {
      const ok = show === 'all' || (show === 'pending' || show === 'off' ? c.dataset.st === show : c.dataset.plan === show && c.dataset.st === 'active');
      c.hidden = !ok || (q && !c.textContent.toLowerCase().includes(q));
    });
  }
  function mark(el) {
    const login = el.closest('.ucard')?.dataset.login, key = el.dataset.k ? JSON.stringify(['u', login, el.dataset.k]) : JSON.stringify(['s', el.dataset.s]);
    const v = el.type === 'checkbox' ? el.checked : el.value, was = el.type === 'checkbox' ? el.defaultChecked : el.tagName === 'SELECT' ? [...el.options].find(o => o.defaultSelected)?.value ?? el.options[0]?.value : el.defaultValue;
    if (String(v) === String(was)) changed.delete(key); else changed.set(key, v);
    el.classList.toggle('dirty', changed.has(key));
    const n = changed.size;
    $('#a-n').textContent = n ? `Изменений: ${n} — не забудьте сохранить` : 'Изменений нет';
    $('#a-n').classList.toggle('warn-text', !!n); $('#a-go').disabled = $('#a-undo').disabled = !n;
  }

  // всё изменённое — одним нажатием: участники по одному запросу, настройки — одним
  const msk = (d, end) => d ? new Date(`${d}T${end ? '23:59:00' : '00:00:00'}+03:00`).toISOString() : null;
  async function save(quiet = false) {
    if (!changed.size) return true;
    const users = new Map(), set = {};
    for (const [key, v] of changed) {
      const [kind, a, b] = JSON.parse(key);
      if (kind === 'u') {
        const s = users.get(a) ?? {}; users.set(a, s);
        s[b] = b === 'period_start' ? msk(v, false) : b === 'expires_at' ? msk(v, true) : b === 'can_arch' || b === 'can_rk' ? (v === '' ? null : v === '1') : v;
      } else {
        const path = a.split('.'); let o = set;
        path.slice(0, -1).forEach(k => o = o[k] ??= {});
        o[path.at(-1)] = typeof v === 'boolean' || a === 'src_links' || a.endsWith('.name') ? v : v === '' ? null : v;
      }
    }
    if (set.uniq) set.uniq = { enabled: $('[data-s="uniq.enabled"]').checked, per_night: $('[data-s="uniq.per_night"]').value, ...set.uniq };   // сервер ждёт оба поля
    const btn = $('#a-go'); btn.disabled = true; btn.textContent = 'Сохраняю…';
    try {
      for (const [login, s] of users) { const x = await ui.call('admin_user', { login, set: s }); if (x.error) throw new Error(`${login}: ${x.message}`); }
      if (Object.keys(set).length) { const x = await ui.call('admin_settings', set); ui.saved?.(x); }
      changed.clear();
      if (!quiet) ui.toast(`Сохранено: ${users.size ? `участников — ${users.size}` : ''}${users.size && Object.keys(set).length ? ', ' : ''}${Object.keys(set).length ? 'настройки' : ''}`);
      return true;
    } catch (e) { ui.toast(e.message, 5000); btn.disabled = false; btn.textContent = 'Сохранить'; return false; }
  }
  // кнопки-действия срабатывают сразу; несохранённые правки сначала сохраняются, чтобы не потерялись
  async function act(b) {
    const login = b.closest('.ucard').dataset.login, a = b.dataset.a;
    const sets = { approve: { status: 'active', add_days: 30 }, plus: { add_days: 30 }, on: { status: 'active' }, off: { status: 'off' }, pack: { add_pack: 1 } };
    let set = sets[a], kick = false;
    if (a === 'off' && !confirm(`Отключить ${login}? Он выйдет со всех устройств.`)) return;
    if (a === 'pack' && !confirm(`Добавить ${login} ${r.pack.qty} номеров без оплаты — до конца его месяца?`)) return;
    if (a === 'pass') { const p = prompt(`Новый пароль для ${login} (от 6 символов):`); if (!p) return; set = { password: p }; }
    if (a === 'kick') { set = {}; kick = true; }
    if (a === 'role') set = { role: b.textContent.startsWith('Снять') ? 'user' : 'admin' };
    if (!(await save(true))) return;
    try { const x = await ui.call('admin_user', { login, set, kick }); if (x.error) throw new Error(x.message); ui.toast('Готово'); open(); }
    catch (e) { ui.toast(e.message, 5000); }
  }
  // закрыть окно с несохранёнными правками — только после вопроса
  document.addEventListener('click', e => {
    if (!changed.size || $('#sheet')?.hidden || !$('#a-users')) return;
    if (!(e.target.id === 'sheet' || e.target.closest('[data-close]'))) return;
    if (!confirm('Есть несохранённые изменения. Закрыть без сохранения?')) { e.stopPropagation(); e.preventDefault(); } else changed.clear();
  }, true);

  async function open() {
    ui.sheet('Админ-панель', '<p class="muted">Загрузка…</p>', true);
    try { r = await ui.call('admin_users'); } catch (e) { $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    r.users.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));
    changed.clear();
    const body = $('#sheet-body');
    body.innerHTML = html(); filter();
    body.oninput = body.onchange = e => { if (e.target.matches('[data-k], [data-s]')) mark(e.target); if (e.target.id === 'a-find') filter(); };
    body.onclick = e => {
      const s = e.target.closest('[data-show]'), b = e.target.closest('button[data-a]');
      if (s) { show = s.dataset.show; body.querySelectorAll('[data-show]').forEach(x => x.classList.toggle('on', x === s)); filter(); }
      if (b) act(b);
    };
    $('#a-go').onclick = async () => { if (await save()) open(); };
    $('#a-undo').onclick = () => { changed.clear(); open(); };
  }

  return { use: deps => { ui = deps; }, open };
})();

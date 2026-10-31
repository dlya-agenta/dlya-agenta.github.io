// Страница support.html (ТЗ v2, шаг 3.3): у участника и гостя — окно поддержки на всю страницу (?t=<№> — сразу обращение);
// у админа — #admin «Обращения»: список с фильтрами, переписка и скриншоты, ответ (уходит пользователю на сайт и в бот), смена статуса,
// настройки ИИ и лимитов, расходы, «Прислать сводку сейчас». Всё решает сервер (функция support: adm_*), действия — в журнале админа.
window.SUPPORTADM = (() => {
  const $ = s => document.querySelector(s);
  const CAT = { pay: 'Оплата', access: 'Доступ', bug: 'Ошибка', idea: 'Предложение' };
  const ST = { new: 'Новое', work: 'В работе', done: '✅ Решено', admin: '❗ На проверку Admin' };
  const ROLE = { user: 'Пользователь', ai: '🤖 ИИ', admin: '👤 Админ', sys: 'Служебное' };
  const AIST = { wait: 'ИИ отвечает…', off: 'ИИ выключен или нет ключа', limit: 'дневной лимит ИИ исчерпан', error: 'ошибка ИИ' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const call = (a, x) => window.SUPPORT.call(a, x);
  const toast = (t, ms = 3000) => { const el = $('#toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
  const pill = st => `<span class="sup-st sup-st-${esc(st)}">${esc(ST[st] ?? st)}</span>`;
  let F = { status: '', category: '', q: '', offset: 0 }, L = null, D = null, C = null;

  // ---------- список ----------
  async function list() {
    $('#sp').innerHTML = '<section class="pcard"><p class="muted">Загрузка…</p></section>';
    try { L = await call('adm_list', F); } catch (e) { $('#sp').innerHTML = `<section class="pcard"><p class="sup-err">${esc(e.message)}</p></section>`; return; }
    const c = L.counts ?? {};
    $('#sp').innerHTML = `<section class="pcard"><h2>Обращения</h2>
      <div class="segs sa-st">${[['', 'Все'], ['new', `Новое (${c.new ?? 0})`], ['admin', `❗ На проверку Admin (${c.admin ?? 0})`], ['work', `В работе (${c.work ?? 0})`], ['done', '✅ Решено']]
        .map(([k, t]) => `<button type="button" class="chip${F.status === k ? ' on' : ''}" data-st="${k}">${t}</button>`).join('')}</div>
      <form class="sa-find" id="sa-find"><select name="category"><option value="">Все категории</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}"${F.category === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
        <input name="q" placeholder="№, логин или слово из текста" value="${esc(F.q)}"><button class="btn soft">Найти</button></form>
      <div class="sa-list">${L.items.length ? L.items.map(t => `<button type="button" class="sup-item${t.unread ? ' unread' : ''}" data-id="${t.id}">
        <span class="sup-item-top"><b>№${t.id} · ${esc(CAT[t.category] ?? t.category)} · ${esc(t.who)}</b>${pill(t.status)}</span>
        <span class="sup-item-text">${esc(t.title)}</span>
        <small>${when(t.updated_at)} · сообщений: ${t.msgs}${t.ai_state ? ' · ' + esc(AIST[t.ai_state] ?? t.ai_state) : ''}${t.unread ? ' · новое от пользователя' : ''}${t.status === 'admin' && t.reason ? ' · ' + esc(t.reason) : ''}</small></button>`).join('')
        : '<p class="muted">Обращений нет.</p>'}</div>
      ${L.total > L.offset + L.limit || L.offset ? `<div class="sheet-foot">${L.offset ? '<button type="button" class="btn ghost" data-page="-1">← Назад</button>' : '<span></span>'}
        <span class="muted">${L.offset + 1}–${Math.min(L.total, L.offset + L.limit)} из ${L.total}</span>${L.total > L.offset + L.limit ? '<button type="button" class="btn ghost" data-page="1">Дальше →</button>' : '<span></span>'}</div>` : ''}
      </section>${C ? settingsHtml() : '<section class="pcard"><details id="sa-set-d"><summary><b>Настройки ИИ, лимиты, расходы</b></summary><p class="muted">Загрузка…</p></details></section>'}`;
    if (!C) call('adm_settings_get').then(r => { C = r; const d = $('#sa-set-d'); if (d) d.closest('.pcard').outerHTML = settingsHtml(); }).catch(() => {});
  }

  // ---------- обращение ----------
  async function open(id) {
    $('#sp').innerHTML = '<section class="pcard"><p class="muted">Загрузка…</p></section>';
    try { D = await call('adm_get', { id }); } catch (e) { $('#sp').innerHTML = `<section class="pcard"><p class="sup-err">${esc(e.message)}</p><a class="btn ghost" href="#admin">← К списку</a></section>`; return; }
    draw();
  }
  function draw() {
    const t = D.ticket, u = D.user;
    const plan = u ? `${esc(u.name || u.login)} (${esc(u.login)}) · ${u.role === 'admin' ? 'админ' : u.guest ? 'гость' : esc({ sub: 'Подписчик', pro: 'PRO', max: 'MAX' }[u.plan] ?? u.plan ?? '—')}` +
      ` · доступ до ${day(u.expires_at) || '—'}${u.status === 'pending' ? ' · заявка не одобрена' : ''}${!u.active ? ' · выключен' : ''} · Telegram ${u.tg ? 'привязан' : 'не привязан'}`
      : `Гость без входа${t.guest?.name ? ' · ' + esc(t.guest.name) : ''}${t.guest?.contact ? ' · ' + esc(t.guest.contact) : ''} — ответ увидит только в окне «Помощь» в своём браузере`;
    $('#sp').innerHTML = `<section class="pcard sa-t">
      <div class="sa-top"><a class="btn ghost" href="#admin">← К списку</a><h2>№${t.id} · ${esc(CAT[t.category] ?? t.category)}</h2>${pill(t.status)}</div>
      <p class="small">${plan}</p>
      <p class="small muted">Создано ${when(t.created_at)} · страница ${esc(t.meta?.page || '—')} · ${esc(String(t.meta?.ua ?? '').slice(0, 90))}${D.ai_usd ? ` · ИИ: ${D.ai_usd} $` : ''}${t.ai_state ? ' · ' + esc(AIST[t.ai_state] ?? t.ai_state) : ''}</p>
      ${t.status === 'admin' && t.reason ? `<p class="pnote warn">❗ ${esc(t.reason)}</p>` : ''}
      <div class="sa-msgs">${D.msgs.map(m => `<div class="sup-msg sup-${m.role}${m.role === 'sys' ? ' sa-sys' : ''}"><small class="sup-from">${ROLE[m.role] ?? m.role}${m.meta?.admin ? ' ' + esc(m.meta.admin) : ''}</small>
        <div class="sup-text">${esc(m.text)}</div>${(m.files ?? []).filter(f => f.url).map(f => `<a href="${esc(f.url)}" target="_blank" rel="noopener" class="sup-shot"><img src="${esc(f.url)}" alt="Скриншот" loading="lazy"></a>`).join('')}
        <small class="sup-at">${when(m.at)}${m.meta?.model ? ` · ${esc(m.meta.model)} · ${m.meta.usd} $${m.meta.tools?.length ? ' · ' + esc(m.meta.tools.join(', ')) : ''}` : ''}</small></div>`).join('')}</div>
      <form id="sa-reply" class="sa-reply"><textarea name="text" rows="4" maxlength="4000" placeholder="Ответ пользователю — уйдёт на сайт${u ? ' и в бот' : ''}"></textarea>
        <div class="sa-act"><label class="small">Статус после ответа <select name="status">${Object.entries(ST).filter(([k]) => k !== 'new').map(([k, v]) => `<option value="${k}"${k === 'done' ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          <button class="btn primary">Ответить</button></div></form>
      <div class="sa-act"><span class="small muted">Статус:</span>${Object.entries(ST).map(([k, v]) => `<button type="button" class="chip${t.status === k ? ' on' : ''}" data-set="${k}">${v}</button>`).join('')}</div>
      <div class="sa-act"><button type="button" class="btn soft" data-ai>🤖 Ответ ИИ заново</button><span class="small muted">ИИ ответит на последнее сообщение пользователя (если ключ ИИ задан).</span></div>
    </section>`;
  }

  // ---------- настройки ----------
  function settingsHtml() {
    const s = C.support, sp = C.spend;
    return `<section class="pcard"><details id="sa-set-d"${location.hash === '#admin-set' ? ' open' : ''}><summary><b>Настройки ИИ, лимиты, расходы</b></summary>
      <p class="pnote${C.key_set ? '' : ' warn'}">${C.key_set ? 'Ключ ИИ сохранён ••••' : 'Ключ ИИ не задан — ИИ не отвечает, обращения ждут вас. Ключ ставится в Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY.'}</p>
      <p class="small">Расходы ИИ: сегодня ${sp.today} $ из ${s.day_usd} $ · за 7 дней ${sp.d7} $ · за 30 дней ${sp.d30} $ · вызовов сегодня ${sp.calls_today}${sp.errors_today ? ` · ошибок ${sp.errors_today}` : ''} · обращений сегодня ${C.tickets_today}</p>
      <form id="sa-set" class="ra-set">
        <label class="ra-nets" style="grid-column: 1 / -1"><input type="checkbox" name="enabled"${s.enabled ? ' checked' : ''}> Принимать обращения</label>
        <label class="ra-nets" style="grid-column: 1 / -1"><input type="checkbox" name="ai"${s.ai ? ' checked' : ''}> ИИ отвечает первым</label>
        <label>Модель<select name="model">${C.models.map(m => `<option value="${m.id}"${s.model === m.id ? ' selected' : ''}>${esc(m.name)} (${m.in} / ${m.out} $ за 1 млн)</option>`).join('')}</select></label>
        <label>Усилие<select name="effort">${[['low', 'низкое — быстро и дёшево'], ['medium', 'среднее'], ['high', 'высокое — дороже']].map(([k, v]) => `<option value="${k}"${s.effort === k ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Лимит расходов в день, $<input name="day_usd" type="number" min="0" max="500" step="0.5" value="${s.day_usd}"></label>
        <label>Обращений в сутки без входа<input name="guest_day" type="number" min="0" max="50" value="${s.guest_day}"></label>
        <label>Обращений в сутки с входом<input name="user_day" type="number" min="0" max="50" value="${s.user_day}"></label>
        <label>Сообщений в одном обращении<input name="max_msgs" type="number" min="1" max="50" value="${s.max_msgs}"></label>
        <label>Скриншотов к сообщению<input name="files" type="number" min="0" max="3" value="${s.files}"></label>
        <label>Почта для обращений<input name="email" type="email" value="${esc(s.email)}" placeholder="${C.mail_key_set ? 'адрес' : 'нужен ключ RESEND_API_KEY'}"></label>
        <label class="ra-nets" style="grid-column: 1 / -1"><input type="checkbox" name="digest"${s.digest ? ' checked' : ''}> Сводка в бот в 10:00 и 18:00 МСК</label>
        <div class="ra-act" style="grid-column: 1 / -1"><button class="btn primary">Сохранить</button><button type="button" class="btn soft" data-digest>Прислать сводку сейчас</button>
          <span class="hint">${C.mail_key_set ? 'Почта подключена.' : 'Почта не подключена — обращения приходят в Telegram.'}</span></div>
      </form></details></section>`;
  }

  document.addEventListener('click', async e => {
    if (!document.body.classList.contains('sa-on')) return;
    const b = e.target.closest('[data-st], [data-id], [data-page], [data-set], [data-ai], [data-digest]');
    if (!b) return;
    if (b.dataset.st !== undefined) { F.status = b.dataset.st; F.offset = 0; return list(); }
    if (b.dataset.id) { location.hash = `#admin=${b.dataset.id}`; return; }
    if (b.dataset.page) { F.offset = Math.max(0, F.offset + Number(b.dataset.page) * (L?.limit ?? 40)); return list(); }
    b.disabled = true;
    try {
      if (b.dataset.set) { D = await call('adm_status', { id: D.ticket.id, status: b.dataset.set }); draw(); toast('Статус изменён'); }
      else if (b.dataset.ai !== undefined) { toast('ИИ отвечает…', 20000); D = await call('adm_ai', { id: D.ticket.id }); draw(); toast(D.ticket.ai_state ? AIST[D.ticket.ai_state] ?? 'Готово' : 'ИИ ответил'); }
      else if (b.dataset.digest !== undefined) { const r = await call('adm_digest'); toast(r.sent ? 'Сводка отправлена в бот' : 'Нечего отправлять'); }
    } catch (err) { toast(err.message, 6000); }
    b.disabled = false;
  });
  document.addEventListener('submit', async e => {
    const f = e.target;
    if (!['sa-find', 'sa-reply', 'sa-set'].includes(f.id)) return;
    e.preventDefault();
    const btn = f.querySelector('.btn.primary, .btn.soft'); if (btn) btn.disabled = true;
    try {
      if (f.id === 'sa-find') { F.category = f.category.value; F.q = f.q.value.trim(); F.offset = 0; return list(); }
      if (f.id === 'sa-reply') {
        if (!f.text.value.trim()) throw new Error('Напишите ответ');
        D = await call('adm_reply', { id: D.ticket.id, text: f.text.value.trim(), status: f.status.value }); draw();
        toast(D.sent ? `Ответ отправлен${D.sent.tg ? ' · в бот дошло' : D.ticket.login ? ' · Telegram не привязан' : ''}` : 'Ответ сохранён — гость увидит его в окне «Помощь»');
      }
      if (f.id === 'sa-set') {
        const v = { enabled: f.enabled.checked, ai: f.ai.checked, model: f.model.value, effort: f.effort.value, day_usd: f.day_usd.value, guest_day: f.guest_day.value,
          user_day: f.user_day.value, max_msgs: f.max_msgs.value, files: f.files.value, email: f.email.value.trim(), digest: f.digest.checked };
        C = await call('adm_settings', { support: v }); f.closest('.pcard').outerHTML = settingsHtml(); $('#sa-set-d').open = true; toast('Сохранено');
      }
    } catch (err) { toast(err.message, 6000); }
    if (btn?.isConnected) btn.disabled = false;
  });

  // ---------- запуск страницы ----------
  function route(me) {
    const m = /^#admin(?:=(\d+))?/.exec(location.hash);
    if (m && me?.admin) {
      document.body.classList.add('sa-on'); $('#go-mine').classList.remove('on'); $('#go-adm').classList.add('on');
      document.title = 'Обращения — админка — Для Агента';
      return m[1] ? open(Number(m[1])) : list();
    }
    document.body.classList.remove('sa-on'); $('#go-adm').classList.remove('on'); $('#go-mine').classList.add('on');
    document.title = 'Помощь — Для Агента';
    $('#sp').innerHTML = '<div class="sup-panel" id="sup-page"></div>';
    return window.SUPPORT.mountPage($('#sup-page'), Number(new URLSearchParams(location.search).get('t')) || undefined);
  }
  async function start() {
    let me = null;
    try { me = (await call('state')).me; } catch { /* окно покажет ошибку само */ }
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#who').textContent = me?.login ? me.name || me.login : 'Гость';
    $('#go-adm').hidden = !me?.admin;
    window.addEventListener('hashchange', () => route(me));
    route(me);
  }
  if (document.body?.classList.contains('suppage')) document.addEventListener('DOMContentLoaded', start);
  return { list, open };
})();

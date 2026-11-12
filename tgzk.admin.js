// v5.21: админка → «Модерация» → «Объявления из Telegram»: сбор объявлений собственников из чатов ЖК (раз в 3 дня, 03:00 МСК), итоги запусков,
// кнопка «Собрать сейчас», вкл/выкл и очередь модерации: похоже на объект базы, а сравнить по фото нечем, или ИИ не уверен, что продаёт собственник.
// Решения: «Это новое — показать» | «Дубль» | «Агент / не продажа». Всё решает сервер (функция auto: tgzk_*), действия — в журнале админа.
window.TGZKADM = (() => {
  const H = window.HUB, esc = H.esc;
  const URL_ = () => String(window.API).replace(/\/web$/, '/auto');
  const tok = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  async function call(action, extra = {}) {
    const r = await fetch(URL_(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tok() }, ...extra }) });
    const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || d.error) throw new Error(d.message || d.error);
    return d;
  }
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const rub = v => v ? `${Number(v).toLocaleString('ru-RU')} ₽` : 'цена не указана';
  const RUN = { new: 'ждёт сервер', run: 'идёт', done: 'готово', error: 'ошибка' };
  const WHY = { dup_nophoto: 'Похоже на объект базы (тот же ЖК, этаж и площадь), а фото для сверки нет', unsure: 'ИИ не уверен, что продаёт собственник', template: 'Шаблон «Соседи, продаю… обременений нет, агентов не беспокоить» без площади и цены — так пишут агенты сразу в нескольких ЖК' };
  const VER = { owner: 'собственник', agent: 'агент', unsure: 'неясно' };
  const what = p => p ? [p.rooms === 0 ? 'студия' : p.rooms ? `${p.rooms}-комн.` : '', p.area ? `${p.area} м²` : '', p.floor ? `${p.floor}/${p.floors ?? '?'} эт.` : ''].filter(Boolean).join(', ') : '';
  const stats = s => s ? `<button type="button" class="lnk tz-chats-b">чатов ${s.chats ?? 0}</button> · найдено ${s.candidates ?? 0} · добавлено ${s.added ?? 0} · дублей ${s.dup ?? 0} · агентов ${s.agent ?? 0} · на модерацию ${s.mod ?? 0} · снято ${s.gone ?? 0}` : '';

  // v5.22: группы для поиска — по нажатию на «чатов N»: список, «Удалить» (больше не искать), «Вернуть», строка «Добавить группу»
  async function chats(box, keep) {
    if (!keep && !box.hidden) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<p class="muted">Загрузка списка…</p>';
    let r; try { r = await call('tgzk_chats'); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const on = r.chats.filter(c => c.active), off = r.chats.filter(c => !c.active);
    const row = c => `<tr class="${c.active ? '' : 'off'}"><td>${c.username ? `<a href="https://t.me/${encodeURIComponent(c.username)}" target="_blank" rel="noopener">${esc(c.title)}</a>` : esc(c.title)}${c.manual ? ' <small class="muted">· вручную</small>' : ''}</td>
      <td>${esc(c.zk ?? 'любой — по тексту')}</td><td>${c.members ? c.members.toLocaleString('ru-RU') : '—'}</td><td>${c.ads}${c.added ? ` / <b>${c.added}</b>` : ''}</td>
      <td>${c.active ? `<button class="btn ghost sm" data-chat-off="${c.peer}" title="Больше не искать в этой группе">🗑 Удалить</button>` : `<button class="btn ghost sm" data-chat-on="${c.peer}">↩ Вернуть</button>`}</td></tr>`;
    box.innerHTML = `<div class="hub-card tz-chats">
      <p><b>Группы, где ищем объявления собственников</b> — ${on.length}${off.length ? ` · удалённых ${off.length}` : ''}. Объявлений: всего / <b>на сайте</b>.</p>
      <form class="tz-add"><input name="u" placeholder="@имя группы или ссылка t.me/…" autocomplete="off" required>
        <select name="zk"><option value="">ЖК — любой (определит ИИ по тексту)</option>${r.zk.map(z => `<option value="${z.id}">ЖК ${esc(z.name)}</option>`).join('')}</select>
        <button class="btn primary">Добавить группу</button></form>
      ${r.add.length ? `<p class="muted">Ждут сервер (найдём при следующем сборе): ${r.add.map(a => `@${esc(a.username)}${a.err ? ` <span class="err">— ${esc(a.err)}</span>` : ''} <button type="button" class="lnk" data-add-drop="${esc(a.username)}">убрать</button>`).join(' · ')}</p>` : ''}
      <div class="tz-tbl"><table><thead><tr><th>Группа</th><th>ЖК</th><th>Участников</th><th>Объявлений</th><th></th></tr></thead><tbody>${[...on, ...off].map(row).join('')}</tbody></table></div></div>`;
    const act = async (extra, msg) => { try { await call('tgzk_chat', extra); H.toast(msg); chats(box, true); } catch (e) { H.toast(e.message, 6000); } };
    box.querySelector('.tz-add').onsubmit = e => { e.preventDefault(); const f = e.target; act({ username: f.u.value, zk_id: +f.zk.value || null }, 'Группа добавлена — сервер найдёт её при следующем сборе (можно нажать «Собрать сейчас»)'); };
    box.querySelectorAll('[data-chat-off]').forEach(b => b.onclick = () => act({ peer: +b.dataset.chatOff, on: false }, 'Группа удалена из поиска — при сборе она не вернётся'));
    box.querySelectorAll('[data-chat-on]').forEach(b => b.onclick = () => act({ peer: +b.dataset.chatOn, on: true }, 'Группа снова в поиске'));
    box.querySelectorAll('[data-add-drop]').forEach(b => b.onclick = () => act({ username: b.dataset.addDrop, drop: true }, 'Убрано'));
  }

  async function render(el) {
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    let st, L;
    try { [st, L] = await Promise.all([call('tgzk_state'), call('tgzk_mod_list')]); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    el.innerHTML = `<p>Сервер раз в ${st.every_days} дня в 03:00 МСК через ваш Telegram смотрит открытые чаты ЖК из справочника, находит объявления о продаже,
        проверяет профиль автора (описание, свой канал, общие чаты, сколько объектов продаёт) и добавляет собственников в базу. Источник на сайте не пишется.</p>
      <div class="adm-tiles">
        <div class="adm-tile"><small>На сайте сейчас</small><b>${st.added}</b></div>
        <button type="button" class="adm-tile tz-chats-b" title="Список групп: удалить ненужные, добавить свои"><small>Чатов ЖК ▾</small><b>${st.chats}</b><span>список и правка</span></button>
        <div class="adm-tile"><small>Ждут решения</small><b>${st.mod}</b></div>
        <div class="adm-tile"><small>Отсеяно агентов</small><b>${st.agents}</b><span>дублей: ${st.dups}</span></div></div>
      <p><label><input type="checkbox" id="tz-on" ${st.on ? 'checked' : ''}> Собирать автоматически</label>
        <button class="btn soft" id="tz-run">Собрать сейчас</button>
        <button class="btn ghost" id="tz-full" title="Заново за год по новым правилам — поймать пропущенное; уже разобранное не трогается">Пересобрать за год</button></p>
      <div id="tz-wy"></div>
      <div id="tz-chats" hidden></div>
      <details><summary>Последние запуски</summary><ul>${st.runs.map(r => `<li>${when(r.created_at)} — ${RUN[r.status] ?? r.status}${r.done_at ? `, закончен ${when(r.done_at)}` : ''}${r.error ? ` · <span class="err">${esc(r.error)}</span>` : ''}<br><small class="muted">${stats(r.stats)}</small></li>`).join('') || '<li>Пока не было</li>'}</ul></details>
      <h3>Ждут решения (${L.items.length})</h3>
      ${L.items.length ? L.items.map(x => `<div class="hub-card tz-item" data-id="${x.id}">
        <p><b>${esc(what(x.parsed))}</b> · ${esc(rub(x.parsed?.price))} · ${esc(x.chat ?? '')} · ${when(x.posted_at)}</p>
        <p class="muted">${esc(WHY[x.reason] ?? x.reason ?? '')} · ИИ: ${esc(VER[x.verdict] ?? x.verdict ?? '')} — ${esc(x.why ?? '')}</p>
        <p>Автор: ${esc(x.author ?? '')}${x.username ? ` (<a href="https://t.me/${encodeURIComponent(x.username)}" target="_blank" rel="noopener">@${esc(x.username)}</a>)` : ''}${x.link ? ` · <a href="${esc(x.link)}" target="_blank" rel="noopener">сообщение в чате</a>` : ''}</p>
        ${x.pics.length ? `<div class="tz-pics">${x.pics.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}
        <details><summary>Текст объявления</summary><p style="white-space:pre-wrap">${esc(x.text ?? '')}</p></details>
        ${x.base ? `<p><b>Похоже на № ${x.base.num}</b>: ${esc(x.base.name ?? '')}, ${esc(rub(x.base.price))}, ${esc(x.base.address ?? '')}${x.base.phone ? ` · тел. ${esc(x.base.phone)}` : ''}</p>
          ${x.base.pics.length ? `<div class="tz-pics">${x.base.pics.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>` : ''}` : ''}
        <p><button class="btn primary" data-as="new">Это новое — показать</button> ${x.base ? '<button class="btn soft" data-as="dup">Дубль</button>' : ''} <button class="btn ghost" data-as="reject">Агент / не продажа</button></p>
      </div>`).join('') : '<p class="muted">Пусто — всё разобрано.</p>'}
      <style>.tz-chats{padding:14px;margin:10px 0}.tz-add{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.tz-add input{flex:1 1 240px}.tz-add select{flex:0 1 260px;max-width:100%}
        .tz-tbl{max-height:420px;overflow:auto}.tz-tbl table{width:100%;border-collapse:collapse;font-size:14px}.tz-tbl td,.tz-tbl th{padding:6px 8px;border-bottom:1px solid var(--line,#ddd);text-align:left;vertical-align:top}
        .tz-tbl tr.off td{opacity:.55}.btn.sm{padding:4px 10px;font-size:13px}button.adm-tile{cursor:pointer;text-align:left;font:inherit;color:inherit}.lnk{border:0;background:none;color:var(--accent);cursor:pointer;padding:0;font:inherit;text-decoration:underline}
        .tz-pics{display:flex;gap:6px;overflow-x:auto;margin:6px 0}.tz-pics img{height:110px;border-radius:8px}.tz-item{padding:14px;margin:10px 0}</style>`;
    el.querySelector('#tz-on').onchange = async e => { try { await call('tgzk_set', { on: e.target.checked }); H.toast(e.target.checked ? 'Сбор включён' : 'Сбор выключен'); } catch (er) { H.toast(er.message, 5000); } };
    // v5.69: «сначала свой компьютер» — сбор через Telegram Web на компьютере агента, сервер — только по галочке; иначе окно «Включите компьютер»
    window.WAYS?.box(el.querySelector('#tz-wy'), 'tgzk', { title: '💻 Сбор — с вашего компьютера', manual: false });
    const wyOk = async () => true;   // v5.69: эту работу пока делает только сервер/Mac (расширение не умеет) — не блокируем; через компьютер — вторая волна v5.70
    el.querySelector('#tz-full').onclick = async e => { if (!(await wyOk())) return; if (!confirm('Пересобрать объявления за год по новым правилам? Сбор идёт 1–2 часа, уже разобранное не трогается.')) return;
      e.target.disabled = true; try { await call('tgzk_run', { full: true }); H.toast('Запущено — сервер проснётся за 1–2 минуты'); render(el); } catch (er) { H.toast(er.message, 5000); e.target.disabled = false; } };
    el.querySelectorAll('.tz-chats-b').forEach(b => b.onclick = () => chats(el.querySelector('#tz-chats')));
    el.querySelector('#tz-run').onclick = async e => { if (!(await wyOk())) return; e.target.disabled = true; try { await call('tgzk_run'); H.toast('Запущено — сервер проснётся за 1–2 минуты, сбор идёт около часа'); render(el); } catch (er) { H.toast(er.message, 5000); e.target.disabled = false; } };
    el.querySelectorAll('[data-as]').forEach(b => b.onclick = async () => {
      const box = b.closest('.tz-item'); box.querySelectorAll('button').forEach(x => x.disabled = true);
      try { await call('tgzk_decide', { id: +box.dataset.id, as: b.dataset.as }); box.remove(); H.toast({ new: 'Показано на сайте', dup: 'Отмечено как дубль', reject: 'Убрано' }[b.dataset.as]); }
      catch (er) { H.toast(er.message, 5000); box.querySelectorAll('button').forEach(x => x.disabled = false); }
    });
  }
  return { render };
})();

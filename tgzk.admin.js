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
  const WHY = { dup_nophoto: 'Похоже на объект базы (тот же ЖК, этаж и площадь), а фото для сверки нет', unsure: 'ИИ не уверен, что продаёт собственник' };
  const VER = { owner: 'собственник', agent: 'агент', unsure: 'неясно' };
  const what = p => p ? [p.rooms === 0 ? 'студия' : p.rooms ? `${p.rooms}-комн.` : '', p.area ? `${p.area} м²` : '', p.floor ? `${p.floor}/${p.floors ?? '?'} эт.` : ''].filter(Boolean).join(', ') : '';
  const stats = s => s ? `чатов ${s.chats ?? 0} · найдено ${s.candidates ?? 0} · добавлено ${s.added ?? 0} · дублей ${s.dup ?? 0} · агентов ${s.agent ?? 0} · на модерацию ${s.mod ?? 0} · снято ${s.gone ?? 0}` : '';

  async function render(el) {
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    let st, L;
    try { [st, L] = await Promise.all([call('tgzk_state'), call('tgzk_mod_list')]); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    el.innerHTML = `<p>Сервер раз в ${st.every_days} дня в 03:00 МСК через ваш Telegram смотрит открытые чаты ЖК из справочника, находит объявления о продаже,
        проверяет профиль автора (описание, свой канал, общие чаты, сколько объектов продаёт) и добавляет собственников в базу. Источник на сайте не пишется.</p>
      <div class="adm-tiles">
        <div class="adm-tile"><small>На сайте сейчас</small><b>${st.added}</b></div>
        <div class="adm-tile"><small>Чатов ЖК</small><b>${st.chats}</b></div>
        <div class="adm-tile"><small>Ждут решения</small><b>${st.mod}</b></div>
        <div class="adm-tile"><small>Отсеяно агентов</small><b>${st.agents}</b><span>дублей: ${st.dups}</span></div></div>
      <p><label><input type="checkbox" id="tz-on" ${st.on ? 'checked' : ''}> Собирать автоматически</label>
        <button class="btn soft" id="tz-run">Собрать сейчас</button></p>
      <details><summary>Последние запуски</summary><ul>${st.runs.map(r => `<li>${when(r.created_at)} — ${RUN[r.status] ?? r.status}${r.done_at ? `, закончен ${when(r.done_at)}` : ''}${r.error ? ` · <span class="err">${esc(r.error)}</span>` : ''}<br><small class="muted">${esc(stats(r.stats))}</small></li>`).join('') || '<li>Пока не было</li>'}</ul></details>
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
      <style>.tz-pics{display:flex;gap:6px;overflow-x:auto;margin:6px 0}.tz-pics img{height:110px;border-radius:8px}.tz-item{padding:14px;margin:10px 0}</style>`;
    el.querySelector('#tz-on').onchange = async e => { try { await call('tgzk_set', { on: e.target.checked }); H.toast(e.target.checked ? 'Сбор включён' : 'Сбор выключен'); } catch (er) { H.toast(er.message, 5000); } };
    el.querySelector('#tz-run').onclick = async e => { e.target.disabled = true; try { await call('tgzk_run'); H.toast('Запущено — сервер проснётся за 1–2 минуты, сбор идёт около часа'); render(el); } catch (er) { H.toast(er.message, 5000); e.target.disabled = false; } };
    el.querySelectorAll('[data-as]').forEach(b => b.onclick = async () => {
      const box = b.closest('.tz-item'); box.querySelectorAll('button').forEach(x => x.disabled = true);
      try { await call('tgzk_decide', { id: +box.dataset.id, as: b.dataset.as }); box.remove(); H.toast({ new: 'Показано на сайте', dup: 'Отмечено как дубль', reject: 'Убрано' }[b.dataset.as]); }
      catch (er) { H.toast(er.message, 5000); box.querySelectorAll('button').forEach(x => x.disabled = false); }
    });
  }
  return { render };
})();

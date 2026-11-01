// «Новостройки» и «Фиксации» (v5.15, пп. 11 и 9). Список ЖК/АК/КП/ТХ с «Важным» от застройщиков, карточка: фото (официальные, с подписью
// источника), сроки, цена от, телефон отдела продаж, короткие правила фиксации, форма фиксации, «Кабинет партнёра» (ссылка; пароли не храним),
// объявления этого ЖК в нашей базе. Фиксации: список, этапы, сроки — задачи и напоминания (push и бот). Админ правит карточку здесь же.
(() => {
  const H = window.HUB, esc = H.esc;
  let el = null, caps = null;
  const tel = p => p ? `<a href="tel:+${esc(p)}">+${esc(p)}</a>` : '—';

  async function open(arg, ctx) {
    el = ctx.el; caps = ctx.caps;
    if (arg) return card(+arg);
    const r = await H.call('nb_list', {});
    const devs = new Set(r.partners.map(p => p.developer));
    el.innerHTML = `<h2>🏗 Новостройки</h2>
      ${r.news.length ? `<section class="hub-sec hub-news"><h3>📣 Важное от застройщиков</h3>${r.news.map(n => `<p><b>${esc(n.title)}</b>${n.body ? ` — ${esc(n.body)}` : ''}${n.url ? ` <a href="${esc(n.url)}" target="_blank" rel="noopener">источник</a>` : ''} <small class="muted">${H.day(n.at)}</small></p>`).join('')}</section>` : ''}
      <form class="hub-ask" id="nb-f"><input id="nb-q" type="search" placeholder="Название ЖК" aria-label="Поиск новостройки"><select id="nb-k"><option value="">Все типы</option>${r.kinds.map(k => `<option>${k}</option>`).join('')}</select><button class="btn primary">Найти</button></form>
      <p class="hint">Подключённые кабинеты застройщиков: ${r.partners.length ? r.partners.map(p => esc(p.developer)).join(', ') : 'нет'}. ${caps?.admin ? '<button class="btn soft" data-nb-new>＋ Добавить объект (админ)</button>' : ''}</p>
      <div class="hub-grid">${r.items.map(o => `<a class="hub-card" href="#newb=${o.id}">
        <span class="hub-ph">${o.photos?.[0]?.url ? `<img src="${esc(o.photos[0].url)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="hub-noph">🏗</span>'}</span>
        <b>${esc(o.kind)} «${esc(o.name)}»</b><small>${esc([o.city, o.district].filter(Boolean).join(', '))}</small>
        <small class="muted">${o.price_from ? `от ${esc(H.mln(o.price_from))}` : ''}${o.deadline ? ` · сдача ${esc(o.deadline)}` : ''}${o.developer && devs.has(o.developer) ? ' · 🔗 кабинет подключён' : ''}</small></a>`).join('') || '<p class="muted">Ничего не нашлось.</p>'}</div>
      <p class="hint">Список дополняется: ЖК из нашей базы, данные наш.дом.рф и фиды застройщиков (подключаются с российского сервера). Телефоны отделов продаж — только с официальных сайтов застройщиков.</p>`;
    el.onsubmit = async e => { e.preventDefault(); const x = await H.call('nb_list', { q: el.querySelector('#nb-q').value, kind: el.querySelector('#nb-k').value }); r.items = x.items; open('', ctx).then(() => { el.querySelector('#nb-q').value = ''; }); };
    el.onclick = e => { if (e.target.closest('[data-nb-new]')) admForm({}); };
  }

  async function card(id) {
    const r = await H.call('nb_get', { id }), o = r.object;
    el.innerHTML = `<p><a class="btn ghost" href="#newb">‹ Все новостройки</a></p>
      <h2>${esc(o.kind)} «${esc(o.name)}»</h2>
      <div class="hub-gal">${(o.photos ?? []).map(p => `<figure><img src="${esc(p.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"><figcaption>Источник: ${esc(p.src)}</figcaption></figure>`).join('') || '<p class="muted">Фото и рендеры появятся из официальных источников застройщика.</p>'}</div>
      <section class="hub-sec"><p>${esc([o.city, o.district, o.address].filter(Boolean).join(', '))}</p>
        <p>Застройщик: <b>${esc(o.developer ?? '—')}</b>${o.dev_site ? ` · <a href="${esc(o.dev_site)}" target="_blank" rel="noopener">сайт</a>` : ''} · Класс: ${esc(o.class ?? '—')} · Сдача: ${esc(o.deadline ?? '—')}</p>
        <p>Цена: ${o.price_from ? `от ${esc(H.mln(o.price_from))}` : '—'}${o.price_m2_from ? ` · от ${Math.round(o.price_m2_from / 1000).toLocaleString('ru-RU')} тыс. ₽/м²` : ''}</p>
        <p>Отдел продаж: ${tel(o.sales_phone)}</p>
        ${r.nums.length ? `<p><a class="btn soft" href="./?q=${encodeURIComponent('ЖК ' + o.name)}" target="_blank">Объявления этого ЖК в базе (${r.nums.length})</a></p>` : ''}</section>
      <section class="hub-sec"><h3>📌 Фиксация клиента</h3>
        <p class="hint">${esc(o.fix_rules || 'Правила фиксации этого застройщика ещё не внесены. Обычно: фиксация до первого контакта клиента с отделом продаж, срок 30–90 дней, клиент не должен быть в базе застройщика. Уточните в отделе продаж.')}</p>
        <form id="fx-f" class="hub-form"><label class="field">Клиент<input name="client_name" required maxlength="120"></label><label class="field">Телефон клиента<input name="client_phone" inputmode="tel" maxlength="20"></label>
          <label class="field">Дата фиксации<input type="date" name="fixed_at" value="${new Date().toISOString().slice(0, 10)}"></label><label class="field">Действует до<input type="date" name="until"></label>
          <button class="btn primary">Зафиксировать</button></form><div id="fx-res"></div>
        ${r.fixations.length ? `<p><b>Мои фиксации здесь:</b> ${r.fixations.map(f => `${esc(f.client_name)} — ${esc(r.statuses[f.status])}, до ${H.day(f.until)}`).join('; ')}</p>` : ''}</section>
      <section class="hub-sec"><h3>🔗 Кабинет партнёра застройщика</h3>
        ${o.partner_url ? `<p><a class="btn soft" href="${esc(o.partner_url)}" target="_blank" rel="noopener">Открыть кабинет партнёра</a></p>` : '<p class="hint">Ссылку на кабинет внесёт администратор.</p>'}
        <label class="hub-chk"><input type="checkbox" data-partner${r.partner ? ' checked' : ''}${o.developer ? '' : ' disabled'}> У меня подключён кабинет этого застройщика</label>
        <p class="hint">Логин и пароль кабинета мы не храним — вы входите на сайте застройщика сами. Когда застройщик даст API, фиксации будут уходить в кабинет автоматически.</p></section>
      ${r.news.length ? `<section class="hub-sec"><h3>Новости</h3>${r.news.map(n => `<p><b>${esc(n.title)}</b> ${esc(n.body ?? '')} <small class="muted">${H.day(n.at)}</small></p>`).join('')}</section>` : ''}
      ${caps?.admin ? '<p><button class="btn ghost" data-adm>✏ Изменить карточку (админ)</button></p>' : ''}`;
    el.onsubmit = async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try { const x = await H.call('fix_save', { ...f, object_id: o.id });
        el.querySelector('#fx-res').innerHTML = `<div class="hub-note"><b>Фиксация сохранена.</b> Задача и напоминания о сроке — в «Клиентах». Отправьте застройщику:<textarea rows="5" readonly>${esc(x.letter)}</textarea>
          <p><button class="btn soft" data-copy="${esc(x.letter)}">Скопировать</button>${x.email ? ` <a class="btn soft" href="mailto:${esc(x.email)}?subject=${encodeURIComponent('Фиксация клиента')}&body=${encodeURIComponent(x.letter)}">Письмом</a>` : ''}${x.phone ? ` ${H.msgLinks(x.phone, x.letter)}` : o.sales_phone ? ` ${H.msgLinks(o.sales_phone, x.letter)}` : ''}</p></div>`;
        e.target.reset(); } catch (er) { H.toast(er.message, 5000); }
    };
    el.onclick = async e => {
      const cp = e.target.closest('[data-copy]'); if (cp) return H.copy(cp.dataset.copy);
      if (e.target.closest('[data-adm]')) return admForm(o);
    };
    el.onchange = async e => { if (e.target.matches('[data-partner]')) { await H.call('nb_partner', { developer: o.developer, on: e.target.checked }); H.toast(e.target.checked ? 'Отмечено: кабинет подключён' : 'Отметка снята'); } };
  }

  function admForm(o) {
    const f = (k, l, t = 'text') => `<label class="field">${l}<input name="${k}" type="${t}" value="${esc(o[k] ?? '')}"></label>`;
    el.innerHTML = `<p><a class="btn ghost" href="#newb${o.id ? '=' + o.id : ''}">‹ Назад</a></p><h2>${o.id ? 'Изменить' : 'Новый объект'}</h2>
      <form id="nb-adm" class="hub-form">${f('name', 'Название')}<label class="field">Тип<select name="kind">${['ЖК', 'АК', 'КП', 'ТХ', 'МФК'].map(k => `<option${k === o.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        ${f('city', 'Город')}${f('district', 'Район')}${f('address', 'Адрес')}${f('developer', 'Застройщик')}${f('dev_site', 'Сайт застройщика (https://…)')}${f('sales_phone', 'Телефон отдела продаж')}
        ${f('deadline', 'Сдача')}${f('class', 'Класс')}${f('price_from', 'Цена от, ₽', 'number')}${f('partner_url', 'Кабинет партнёра (https://…)')}${f('fix_email', 'Почта для фиксаций')}${f('fix_phone', 'Телефон для фиксаций')}${f('top', 'Порядок (больше — выше)', 'number')}
        <label class="field hub-wide">Правила фиксации<textarea name="fix_rules" rows="3">${esc(o.fix_rules ?? '')}</textarea></label>
        <label class="field hub-wide">Фото — по строке: ссылка | источник<textarea name="photos" rows="3">${esc((o.photos ?? []).map(p => `${p.url} | ${p.src}`).join('\n'))}</textarea></label>
        <label class="hub-chk"><input type="checkbox" name="active"${o.active === false ? '' : ' checked'}> Показывать</label>
        <button class="btn primary">Сохранить</button></form>`;
    el.onsubmit = async e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target));
      v.active = !!e.target.active.checked;
      v.photos = String(v.photos || '').split('\n').map(l => l.split('|').map(s => s.trim())).filter(x => x[0]).map(([url, src]) => ({ url, src: src || 'сайт застройщика' }));
      try { const r = await H.call('nb_adm_save', { ...v, id: o.id }); H.toast('Сохранено'); location.hash = `newb=${r.object.id}`; } catch (er) { H.toast(er.message, 5000); }
    };
  }

  // ---------- «Фиксации» ----------
  async function fixOpen(arg, ctx) {
    el = ctx.el;
    const r = await H.call('fix_list');
    const row = f => `<div class="hub-row" data-fx="${f.id}"><b>${esc(f.client_name)} · «${esc(f.object_name ?? '')}»</b>
      <small>${esc(f.developer ?? '')} · с ${H.day(f.fixed_at)} до ${H.day(f.until) || '—'}</small>
      <span class="hub-inline"><select data-st>${Object.entries(r.statuses).map(([k, t]) => `<option value="${k}"${k === f.status ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <select data-sg>${Object.entries(r.stages).map(([k, t]) => `<option value="${k}"${k === f.stage ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      <button class="btn ghost" data-del aria-label="Удалить">✕</button></span></div>`;
    el.innerHTML = `<h2>📌 Фиксации у застройщиков</h2><p class="hint">Новая фиксация — в карточке новостройки. О сроках (за 7, 3 и 1 день) и смене этапа напомним в бот и push; задача появится в «Клиентах».</p>
      <div class="hub-rows">${r.items.map(row).join('') || '<p class="muted">Фиксаций пока нет. Откройте <a href="#newb">Новостройки</a> и зафиксируйте клиента.</p>'}</div>`;
    if (arg) el.querySelector(`[data-fx="${+arg}"]`)?.scrollIntoView({ block: 'center' });
    el.onchange = async e => {
      const x = e.target.closest('[data-fx]'); if (!x) return;
      try { await H.call('fix_save', { id: +x.dataset.fx, status: x.querySelector('[data-st]').value, stage: x.querySelector('[data-sg]').value }); H.toast('Сохранено'); } catch (er) { H.toast(er.message, 5000); }
    };
    el.onclick = async e => { const x = e.target.closest('[data-del]'); if (!x) return; if (!confirm('Удалить фиксацию?')) return; await H.call('fix_del', { id: +x.closest('[data-fx]').dataset.fx }); fixOpen('', ctx); };
  }
  window.SEC = window.SEC || {};
  window.SEC.newb = { title: 'Новостройки', open };
  window.SEC.fix = { title: 'Фиксации', open: fixOpen };
})();

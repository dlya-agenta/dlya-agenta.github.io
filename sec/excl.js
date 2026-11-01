// «Эксклюзивы» (v5.15, п. 4): коллеги — объекты с контактом агента (без контактов собственника), «Мои» — добавить объект, фото до 10,
// договор → проверка ИИ-юристом (договор НЕ хранится — только срок и решение), «Актуален», архив (3 месяца), удалить навсегда.
(() => {
  const H = window.HUB, esc = H.esc;
  const KINDS = ['квартира', 'апартаменты', 'дом', 'участок', 'коммерция'];
  const ST = { draft: 'Черновик — загрузите договор', check: 'Договор не одобрен', active: 'Виден коллегам', hidden: 'Скрыт — подтвердите актуальность', archived: 'В архиве' };
  let el = null;

  async function open(arg, ctx) {
    el = ctx.el;
    if (arg?.startsWith('actual:')) { try { const r = await H.call('excl_act', { id: +arg.split(':')[1], do: 'actual' }); H.toast(r.message, 5000); } catch (e) { H.toast(e.message, 5000); } location.hash = 'excl=my'; return; }
    if (arg === 'my') return my();
    if (arg?.startsWith('edit')) return form(arg.split(':')[1] ? +arg.split(':')[1] : null);
    const r = await H.call('excl_list', {});
    el.innerHTML = `<h2>💎 Эксклюзивы коллег</h2><p><a class="btn primary" href="#excl=my">Мои эксклюзивы</a> <span class="hint">Видны всем агентам сервиса — без контактов собственника, с контактом агента.</span></p>
      <div class="hub-grid">${r.items.map(x => `<div class="hub-card"><span class="hub-ph">${x.photos[0] ? `<img src="${esc(x.photos[0])}" alt="" loading="lazy">` : '<span class="hub-noph">💎</span>'}</span>
        <b>${esc(H.mln(x.price))}</b><small>${esc([x.rooms ? `${x.rooms}-комн.` : '', x.kind, x.area ? `${x.area} м²` : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : ''].filter(Boolean).join(' · '))}</small>
        <small class="muted">${esc([x.complex, x.sub || x.district].filter(Boolean).join(' · '))} · № ${x.num}</small>
        ${x.descr ? `<small>${esc(x.descr.slice(0, 160))}${x.descr.length > 160 ? '…' : ''}</small>` : ''}
        ${x.agent ? `<small>Агент: <b>${esc(x.agent.name ?? '')}</b>${x.agent.company ? `, ${esc(x.agent.company)}` : ''}</small><span class="hub-inline">${x.agent.phone ? `<a class="btn soft" href="tel:${esc(x.agent.phone)}">📞</a>${H.msgLinks(x.agent.phone, `Здравствуйте! По вашему эксклюзиву № ${x.num}`)}` : ''}</span>` : '<small class="muted">Агент скрыл контакт</small>'}
        <a class="btn ghost" href="#deal=new:${x.num}">📑 В сделку</a></div>`).join('') || '<p class="muted">Пока никто не добавил эксклюзивов.</p>'}</div>`;
  }

  async function my() {
    const r = await H.call('excl_my');
    el.innerHTML = `<p><a class="btn ghost" href="#excl">‹ Эксклюзивы коллег</a></p><h2>💎 Мои эксклюзивы</h2>
      <p><a class="btn primary" href="#excl=edit">＋ Добавить объект</a></p>
      <p class="hint">🔒 Мы не храним ваш договор — только срок его действия и решение проверки. Договор закончился — продлите доп. соглашением или новым договором; через 14 дней без продления объект уйдёт в архив (хранится 3 месяца, потом удаляется).</p>
      <div class="hub-rows">${r.items.map(x => `<div class="hub-row"><b>№ ${x.num} · ${esc([x.rooms ? `${x.rooms}-комн.` : '', x.kind, x.area ? `${x.area} м²` : ''].filter(Boolean).join(' '))} · ${esc(H.mln(x.price))}</b>
        <small>${esc(ST[x.status])}${x.contract_until ? ` · договор до ${H.day(x.contract_until)}` : ''}${x.contract_note && !x.contract_ok ? ` · ${esc(x.contract_note)}` : ''}</small>
        <span class="hub-inline"><a class="btn soft" href="#excl=edit:${x.id}">Изменить</a>
        ${x.status === 'hidden' ? `<button class="btn primary" data-act="actual" data-id="${x.id}">✅ Актуален</button>` : ''}
        ${x.status === 'archived' ? `<button class="btn ghost bad" data-act="delete" data-id="${x.id}">Удалить навсегда</button>` : `<button class="btn ghost" data-act="archive" data-id="${x.id}">В архив</button>`}</span></div>`).join('') || '<p class="muted">Своих эксклюзивов пока нет.</p>'}</div>`;
    el.onclick = async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'delete' && !confirm('Удалить объект и фото навсегда?')) return;
      try { const x = await H.call('excl_act', { id: +b.dataset.id, do: b.dataset.act }); if (x.message) H.toast(x.message); my(); } catch (er) { H.toast(er.message, 5000); }
    };
  }

  async function form(id) {
    const r = id ? (await H.call('excl_my')).items.find(x => x.id === id) : {};
    const x = r ?? {};
    const f = (k, l, t = 'text', extra = '') => `<label class="field">${l}<input name="${k}" type="${t}" value="${esc(x[k] ?? '')}" ${extra}></label>`;
    el.innerHTML = `<p><a class="btn ghost" href="#excl=my">‹ Мои эксклюзивы</a></p><h2>${id ? `Эксклюзив № ${x.num}` : 'Новый эксклюзив'}</h2>
      <form id="ex-f" class="hub-form"><label class="field">Тип<select name="kind">${KINDS.map(k => `<option${k === x.kind ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        ${f('rooms', 'Комнат', 'number', 'min="0" max="20"')}${f('area', 'Площадь, м²', 'number', 'step="0.1"')}${f('floor', 'Этаж', 'number')}${f('floors', 'Этажей в доме', 'number')}
        ${f('price', 'Цена, ₽', 'number')}${f('district', 'Район')}${f('sub', 'Микрорайон')}${f('complex', 'ЖК')}${f('address', 'Адрес (коллеги его не видят)')}
        <label class="field hub-wide">Описание<textarea name="descr" rows="4" maxlength="4000">${esc(x.descr ?? '')}</textarea></label>
        <label class="hub-chk hub-wide"><input type="checkbox" name="agent_show"${x.agent_show === false ? '' : ' checked'}> Показывать коллегам мой контакт (имя, телефон из профиля)</label>
        <button class="btn primary">Сохранить</button></form>
      ${id ? `<section class="hub-sec"><h3>📷 Фото (${x.photos ?? 0} из 10)</h3><div class="hub-gal">${(x.photos_urls ?? []).map(u => `<img src="${esc(u)}" alt="">`).join('')}</div>
        <input type="file" id="ex-ph" accept="image/*" multiple> ${x.photos ? '<button class="btn ghost" data-ph-del>Удалить последнее</button>' : ''}</section>
      <section class="hub-sec"><h3>📄 Эксклюзивный договор</h3><p class="hint">🔒 Договор не хранится: проверяем и сразу забываем файл. Сохраняем только срок и решение.</p>
        <p>${x.contract_checked_at ? `${x.contract_ok ? '✅ Одобрен' : '❌ Не одобрен'}${x.contract_until ? `, срок до ${H.day(x.contract_until)}` : ''}. ${esc(x.contract_note ?? '')}` : 'Договор ещё не проверен — объект не виден коллегам.'}</p>
        <input type="file" id="ex-ct" accept="application/pdf,image/jpeg,image/png"> <span class="hint">PDF, JPEG или PNG до 8 МБ. Проверка ~20–40 с.</span><div id="ex-ct-r"></div></section>` : '<p class="hint">Сохраните объект — затем добавьте фото и договор.</p>'}`;
    el.onsubmit = async e => {
      e.preventDefault();
      const v = Object.fromEntries(new FormData(e.target)); v.agent_show = !!e.target.agent_show.checked;
      try { const r2 = await H.call('excl_save', { ...v, id }); H.toast('Сохранено'); location.hash = `excl=edit:${r2.item.id}`; if (id) form(id); } catch (er) { H.toast(er.message, 5000); }
    };
    el.onclick = async e => { if (e.target.closest('[data-ph-del]')) { await H.call('excl_photo', { id, k: 0, del: true }); form(id); } };
    el.onchange = async e => {
      if (e.target.id === 'ex-ph') {
        let k = x.photos ?? 0;
        for (const file of [...e.target.files].slice(0, 10 - k)) {
          try { const data = await shrink(file); await H.call('excl_photo', { id, k, data }); k++; H.toast(`Фото ${k} загружено`); } catch (er) { H.toast(er.message, 5000); break; }
        }
        form(id);
      }
      if (e.target.id === 'ex-ct') {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 8e6) return H.toast('Договор — до 8 МБ');
        const out = el.querySelector('#ex-ct-r'); out.innerHTML = '<p class="muted">⏳ Проверяю договор… ~20–40 секунд</p>';
        try { const data = await b64(file); const r2 = await H.call('excl_contract', { id, data }); out.innerHTML = `<p class="${r2.ok ? '' : 'err'}">${esc(r2.message)}</p><p class="hint">Файл договора не сохранён.</p>`; }
        catch (er) { out.innerHTML = `<p class="err">${esc(er.message)}</p>`; }
        e.target.value = '';
      }
    };
  }
  const b64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
  // фото: до 1280 px по длинной стороне, JPEG 0,82 (меньше 700 КБ)
  async function shrink(file) {
    const img = await createImageBitmap(file), s = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82).split(',')[1];
  }
  window.SEC = window.SEC || {};
  window.SEC.excl = { title: 'Эксклюзивы', open };
})();

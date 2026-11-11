// Один редактор для ссылки агенту и раздела подборок. Правки не изменяют объявления.
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.SELECTION_EDITOR = { async open(id, draft = null) {
    if (document.getElementById('selection-editor')) return;
    const token = JSON.parse(localStorage.getItem('token') || 'null');
    const call = async (action, extra = {}) => {
      const r = await fetch(window.API, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action, auth:{token}, id, ...extra})});
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.message || 'Не удалось выполнить действие'); return d;
    };
    let d; try { d = draft ? {id:0,editable:true,markup:draft.markup,title:draft.title,intro:draft.intro,items:await Promise.all(draft.nums.map(async num=>{const {item:x}=await call('item',{num});return {...x,what:x.what||`${x.rooms??''}-комн. ${x.kind} · ${x.area??''} м²`,place:x.address,client_price:draft.edits?.[num]?.price??(draft.markup?Math.round(x.price*(1+draft.markup/100)/50000+1e-9)*50000:x.price),descr:draft.edits?.[num]?.descr??x.descr,hide:draft.edits?.[num]?.hide??[],cover:draft.edits?.[num]?.cover??null,original:x};}))} : await call('sel_agent'); } catch(e) { return alert(e.message); }
    if (!d.editable || d.kind === 'excl') return alert('Править можно свою подборку объектов собственников');
    const box = document.createElement('dialog'); box.id = 'selection-editor';
    box.className = 'se-box';   // v5.49 (п. 2): поля ровно — подпись над полем, отступы, окно не шире экрана телефона
    // v5.47 E (Алексей, п. 6): фото можно убрать только из этой подборки — нажатием на фото (база и объявление не меняются)
    const allPh = x => x.photos_all ?? (x.original && window.APP_PHOTO_URLS ? window.APP_PHOTO_URLS(x.original) : x.photos ?? []);
    let items = d.items.map(x => ({...x, price: x.client_price, descr:x.descr, hide:new Set(x.hide ?? []), cover:x.cover ?? null})), busy = false;
    // v5.57 (Алексей 11.11): «★ Обложкой» — своё первое фото объекта только в этой подборке (клиенту и вам; объявление и база не меняются)
    const allPhC = x => { const a = allPh(x), k = x.cover ? a.indexOf(x.cover) : -1; return k > 0 ? [a[k], ...a.slice(0, k), ...a.slice(k + 1)] : a; };
    const phHtml = x => { const all = allPh(x); if (!all.length) return '';
      return `<div class="se-ph-h">Фото в подборке: ${all.length - [...x.hide].filter(u => all.includes(u)).length} из ${all.length}. Нажмите на фото, чтобы убрать его только из этой подборки, «★» — сделать обложкой.</div>
        <div class="se-ph">${allPhC(x).map((u, k) => `<span class="se-pw"><button type="button" class="se-im${x.hide.has(u) ? ' off' : ''}${!k && !x.hide.has(u) ? ' cov' : ''}" data-ph="${esc(u)}" aria-pressed="${x.hide.has(u)}" title="${x.hide.has(u) ? 'Вернуть фото в подборку' : 'Убрать фото из подборки'}"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${x.hide.has(u) ? '↩ Вернуть' : '✕'}</span>${!k && !x.hide.has(u) ? '<em>★ Обложка</em>' : ''}</button>${k && !x.hide.has(u) ? `<button type="button" class="se-cv" data-cov="${esc(u)}" title="Сделать обложкой в этой подборке" aria-label="Сделать обложкой">★</button>` : ''}</span>`).join('')}</div>`; };
    box.innerHTML = `<form><h2>Правка подборки</h2><p>Правки видите вы и клиент, база не меняется. Цена — итоговая для клиента.</p>
      <label class="se-l"><span>Название</span><input name="title" maxlength="80" value="${esc(d.title)}"></label>
      <label class="se-l"><span>Общий текст</span><textarea name="intro" rows="3" maxlength="4000" placeholder="Например: подобрал варианты у моря до 12 млн — посмотрите и отметьте понравившиеся">${esc(d.intro)}</textarea></label>
      <div data-items></div><div class="se-add"><input name="num" type="number" min="1" inputmode="numeric" placeholder="Номер объекта"><button type="button" class="btn soft" data-add>＋ Добавить объект</button></div>
      <p data-error role="status"></p><div class="se-foot"><button class="btn primary" type="submit">Сохранить</button> <button type="button" class="btn ghost" data-close>Закрыть</button></div></form>`;
    const error = m => box.querySelector('[data-error]').textContent = m;
    const capture = () => box.querySelectorAll('[data-row]').forEach(el => {const x = items[Number(el.dataset.row)]; x.price = el.querySelector('[data-price]').value; x.descr = el.querySelector('[data-descr]').value;});
    const draw = () => {box.querySelector('[data-items]').innerHTML = items.map((x,i) => `<article data-row="${i}" class="se-row">
      ${x.original && window.APPCARD ? window.APPCARD(x.original) : ''}
      <div class="se-hd"><span class="se-n">${i + 1}</span><div><b>№ ${x.num} · ${esc(x.what)}</b>${x.place ? `<small>${esc(x.place)}</small>` : ''}</div></div><div data-phs>${phHtml(x)}</div>
      <label class="se-l"><span>Цена клиенту, ₽ <small data-pf>${x.price ? Number(x.price).toLocaleString('ru-RU') + ' ₽' : ''}</small></span><input data-price type="number" inputmode="numeric" min="1" max="1000000000000" required value="${esc(x.price)}"></label>
      <label class="se-l"><span>Описание</span><textarea data-descr rows="5" maxlength="12000">${esc(x.descr)}</textarea></label>
      <div class="se-acts"><button class="btn ghost" type="button" data-up ${i ? '' : 'disabled'} aria-label="Выше">↑ Выше</button>
      <button class="btn ghost" type="button" data-down ${i < items.length-1 ? '' : 'disabled'} aria-label="Ниже">↓ Ниже</button>
      <button class="btn ghost" type="button" data-remove>− Убрать из подборки</button></div></article>`).join('');};
    box.addEventListener('input', e => { const p = e.target.closest('[data-price]'); if (p) { const o = p.closest('label').querySelector('[data-pf]'); if (o) o.textContent = +p.value ? (+p.value).toLocaleString('ru-RU') + ' ₽' : ''; } });
    box.onclick = async e => {
      if (busy) return;
      const cv = e.target.closest('[data-cov]');
      if (cv) { const row = cv.closest('[data-row]'), x = items[Number(row.dataset.row)]; x.cover = cv.dataset.cov; x.hide.delete(x.cover); row.querySelector('[data-phs]').innerHTML = phHtml(x); error('Обложка выбрана — нажмите «Сохранить»'); return; }
      const ph = e.target.closest('[data-ph]');
      if (ph) { const row = ph.closest('[data-row]'), x = items[Number(row.dataset.row)], u = ph.dataset.ph, all = allPh(x);
        if (!x.hide.has(u) && all.filter(v => !x.hide.has(v)).length <= 1) return error('Оставьте в подборке хотя бы одно фото объекта');
        x.hide.has(u) ? x.hide.delete(u) : x.hide.add(u); if (x.hide.has(x.cover)) x.cover = null; row.querySelector('[data-phs]').innerHTML = phHtml(x); error(''); return; }
      if(e.target.closest('.card')) window.APP_CARD_ACTION?.(e,e.target.closest('.card'));
      if (e.target.closest('[data-close]')) {box.close();return;}
      const row = e.target.closest('[data-row]');
      if (row && e.target.closest('[data-up],[data-down],[data-remove]')) {
        capture();const i = Number(row.dataset.row);
        if (e.target.closest('[data-remove]')) items.splice(i,1);
        else {const j = i + (e.target.closest('[data-up]') ? -1 : 1);[items[i],items[j]]=[items[j],items[i]];} draw();
      }
      if (e.target.closest('[data-add]')) {
        capture(); const num = Number(box.querySelector('[name=num]').value);
        if (items.length >= 20 || !Number.isSafeInteger(num) || num <= 0 || items.some(x => x.num === num)) return error('Укажите новый номер; в подборке до 20 объектов');
        busy = true;
        try {const r = await call('item',{num}); const x = r.item ?? r;
          if (!x.num) throw new Error('Объект не найден');
          items.push({num:x.num,what:x.what || `Объект № ${num}`,place:x.address || '',original:x,hide:new Set(),price: x.price ? (d.markup ? Math.round(x.price*(1+d.markup/100)/50000+1e-9)*50000 : x.price) : '',descr:x.descr || x.descr_ai || '',photos:[]}); draw();error('Объект добавлен. Проверьте цену и описание.');
        } catch(e) {error(e.message);} finally {busy=false;}
      }
    };
    if (!document.getElementById('se-css')) document.head.insertAdjacentHTML('beforeend', `<style id="se-css">
      .se-box{width:min(900px,calc(100vw - 16px));max-width:none;max-height:92vh;max-height:92dvh;box-sizing:border-box;overflow:auto;background:var(--bg,#fff);color:var(--text,#172033);border:1px solid var(--line,#aaa);border-radius:16px;padding:20px}
      .se-box h2{margin:0 0 6px}.se-box>form>p:first-of-type{margin:0 0 12px;opacity:.85}
      .se-l{display:grid;gap:5px;margin:12px 0}.se-l>span{font-size:13px;font-weight:600;opacity:.85}.se-l small{font-weight:400;opacity:.8;margin-left:6px}
      .se-l input,.se-l textarea,.se-add input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px 12px;border-radius:10px;border:1px solid var(--line,#ccd);background:var(--card,#fff);color:inherit}
      .se-l textarea{resize:vertical;min-height:84px;line-height:1.45}
      .se-row{border:1px solid var(--line,#ccd);border-radius:14px;padding:14px;margin:14px 0;background:color-mix(in srgb,var(--card,#fff) 60%,transparent)}
      .se-hd{display:flex;gap:10px;align-items:flex-start;margin:0 0 6px}.se-hd>div{display:grid;gap:3px;min-width:0}.se-hd small{opacity:.75}
      .se-n{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:700;background:var(--accent,#3b82f6);color:#fff}
      .se-acts,.se-add,.se-foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.se-add{margin:16px 0}.se-add input{flex:1;min-width:150px;width:auto}
      .se-foot{position:sticky;bottom:-20px;padding:10px 0;background:var(--bg,#fff)}
      @media (max-width:600px){.se-box{padding:14px;border-radius:14px}.se-row{padding:10px}.se-acts .btn{flex:1}}
      .se-ph-h{font-size:13px;opacity:.8;margin:6px 0}.se-ph{display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity}
      .se-im{position:relative;flex:none;width:112px;aspect-ratio:4/3;border:2px solid transparent;border-radius:10px;overflow:hidden;padding:0;background:#0f1218;cursor:pointer;scroll-snap-align:start}
      .se-im img{width:100%;height:100%;object-fit:cover;display:block}.se-im span{position:absolute;top:4px;right:4px;background:rgba(15,18,24,.72);color:#fff;border-radius:999px;padding:2px 7px;font-size:12px;font-weight:700}
      .se-pw{position:relative;flex:none;display:block}.se-cv{position:absolute;left:4px;bottom:4px;width:30px;height:30px;border:0;border-radius:999px;background:rgba(15,18,24,.72);color:#ffd54a;font-size:16px;line-height:30px;padding:0;cursor:pointer}.se-cv:hover{background:#1f6fb2}.se-im.cov{border-color:#f5b301}.se-im em{position:absolute;left:4px;bottom:4px;font-style:normal;background:#f5b301;color:#1b1b1b;border-radius:999px;padding:2px 7px;font-size:12px;font-weight:700}.se-im.off{border-color:#c0392b}.se-im.off img{opacity:.3;filter:grayscale(1)}.se-im.off span{background:#c0392b;top:auto;bottom:4px;right:4px;left:4px;text-align:center}</style>`);
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); if (busy) return; capture(); if (!items.length) return error('Оставьте хотя бы один объект');
      busy = true; error('Сохраняю…');
      try {const payload={title:box.querySelector('[name=title]').value,intro:box.querySelector('[name=intro]').value,nums:items.map(x=>x.num),edits:Object.fromEntries(items.map(x=>[x.num,{price:Number(x.price),descr:x.descr,...(x.hide.size?{hide:[...x.hide]}:{}),...(x.cover&&!x.hide.has(x.cover)?{cover:x.cover}:{})}]))};if(draft){draft.save(payload);box.close();}else{await call('sel_edit',payload);location.reload();}}
      catch(e) {error(e.message);} finally {busy=false;}
    };
    box.addEventListener('cancel', e => {if(busy)e.preventDefault();});
    box.addEventListener('close', () => box.remove());document.body.append(box);draw();box.showModal();
  }};
})();

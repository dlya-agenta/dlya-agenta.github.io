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
    let d; try { d = draft ? {id:0,editable:true,markup:draft.markup,title:draft.title,intro:draft.intro,items:await Promise.all(draft.nums.map(async num=>{const {item:x}=await call('item',{num});return {...x,what:x.what||`${x.rooms??''}-комн. ${x.kind} · ${x.area??''} м²`,place:x.address,client_price:draft.edits?.[num]?.price??Math.round(x.price*(1+draft.markup/100)/10000)*10000,descr:draft.edits?.[num]?.descr??x.descr,original:x};}))} : await call('sel_agent'); } catch(e) { return alert(e.message); }
    if (!d.editable || d.kind === 'excl') return alert('Править можно свою подборку объектов собственников');
    const box = document.createElement('dialog'); box.id = 'selection-editor';
    box.style.cssText = 'width:min(900px,94vw);max-height:90vh;overflow:auto;background:var(--bg,#fff);color:var(--text,#172033);border:1px solid #aaa;border-radius:16px;padding:20px';
    let items = d.items.map(x => ({...x, price: x.client_price, descr:x.descr})), busy = false;
    box.innerHTML = `<form><h2>Правка подборки</h2><p>Правки видите вы и клиент, база не меняется. Цена — итоговая для клиента.</p>
      <label class="field">Название<input name="title" maxlength="80" value="${esc(d.title)}"></label>
      <label class="field">Общий текст<textarea name="intro" rows="3" maxlength="4000">${esc(d.intro)}</textarea></label>
      <div data-items></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0"><input name="num" type="number" min="1" placeholder="Номер объекта"><button type="button" class="btn soft" data-add>＋ Добавить объект</button></div>
      <p data-error role="status"></p><button class="btn primary" type="submit">Сохранить</button> <button type="button" class="btn ghost" data-close>Закрыть</button></form>`;
    const error = m => box.querySelector('[data-error]').textContent = m;
    const capture = () => box.querySelectorAll('[data-row]').forEach(el => {const x = items[Number(el.dataset.row)]; x.price = el.querySelector('[data-price]').value; x.descr = el.querySelector('[data-descr]').value;});
    const draw = () => {box.querySelector('[data-items]').innerHTML = items.map((x,i) => `<article data-row="${i}" style="border:1px solid #aaa;border-radius:12px;padding:12px;margin:12px 0">
      ${x.original && window.APPCARD ? window.APPCARD(x.original) : ''}${!x.original && x.photos?.[0] ? `<img src="${esc(x.photos[0])}" alt="Фото объекта" style="width:140px;max-width:100%;height:100px;object-fit:cover;border-radius:8px">` : ''}
      <b>№ ${x.num} · ${esc(x.what)}</b><p>${esc(x.place)}</p>
      <label class="field">Цена клиенту, ₽<input data-price type="number" min="1" max="1000000000000" required value="${esc(x.price)}"></label>
      <label class="field">Описание<textarea data-descr rows="4" maxlength="12000">${esc(x.descr)}</textarea></label>
      <button class="btn ghost" type="button" data-up ${i ? '' : 'disabled'} aria-label="Выше">↑</button>
      <button class="btn ghost" type="button" data-down ${i < items.length-1 ? '' : 'disabled'} aria-label="Ниже">↓</button>
      <button class="btn ghost" type="button" data-remove>− Убрать из подборки</button></article>`).join('');};
    box.onclick = async e => {
      if (busy) return;
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
          items.push({num:x.num,what:x.what || `Объект № ${num}`,place:x.address || '',original:x,price: x.price ? Math.round(x.price*(1+d.markup/100)/10000)*10000 : '',descr:x.descr || x.descr_ai || '',photos:[]}); draw();error('Объект добавлен. Проверьте цену и описание.');
        } catch(e) {error(e.message);} finally {busy=false;}
      }
    };
    box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); if (busy) return; capture(); if (!items.length) return error('Оставьте хотя бы один объект');
      busy = true; error('Сохраняю…');
      try {const payload={title:box.querySelector('[name=title]').value,intro:box.querySelector('[name=intro]').value,nums:items.map(x=>x.num),edits:Object.fromEntries(items.map(x=>[x.num,{price:Number(x.price),descr:x.descr}]))};if(draft){draft.save(payload);box.close();}else{await call('sel_edit',payload);location.reload();}}
      catch(e) {error(e.message);} finally {busy=false;}
    };
    box.addEventListener('cancel', e => {if(busy)e.preventDefault();});
    box.addEventListener('close', () => box.remove());document.body.append(box);draw();box.showModal();
  }};
})();

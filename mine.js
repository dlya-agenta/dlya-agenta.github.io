// v5.48 G (Алексей 10.11, пп. 18, 19): «✏️ Моя правка» — цена, описание и фото объявления или эксклюзива только для этого агента и его клиентов
// (подборки, PDF; база не меняется, у цены — «✏️ отредактировано»), «🗑 Убранные у меня» — вернуть убранное, видео эксклюзива.
// Сервер — web my_edit {num, do: get | save | reset | remove | restore}, my_removed. Подключение — app.js (кнопки в окне объявления и в «Контакте»).
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = v => v ? `${Math.round(v).toLocaleString('ru-RU')} ₽` : '—';
  const mlnTxt = v => v ? String(Math.round(v / 1e3) / 1e3).replace('.', ',') : '';
  const mlnOf = s => { const v = parseFloat(String(s ?? '').replace(/\s/g, '').replace(',', '.')); return v > 0 ? Math.round(v < 1000 ? v * 1e6 : v) : 0; };
  function dlg(html, cls = '') {
    document.getElementById('mine-dlg')?.remove();
    const d = document.createElement('dialog'); d.id = 'mine-dlg'; d.className = `mine-dlg ${cls}`; d.innerHTML = html;
    document.body.append(d); d.showModal();
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-x]')) d.close(); });
    d.addEventListener('close', () => { d.querySelectorAll('video').forEach(v => v.pause()); d.remove(); });
    return d;
  }
  async function edit(num, x, call, done) {
    let r;
    try { r = await call('my_edit', { num, do: 'get' }); } catch (e) { alert(e.message); return; }
    const e = r.edit ?? {}, hide = new Set(e.hide ?? []);
    const urls = x?.all_pics ?? (x?.pics?.length ? x.pics : Array.from(document.querySelectorAll(`.itemv[data-num="${num}"] .iv-th img, .card[data-num="${num}"] .strip img`)).map(i => i.src));
    const photos = [...new Set(urls)].slice(0, 30);
    const d = dlg(`<form method="dialog" class="mine-f">
      <div class="mine-h"><b>✏️ Моя правка · № ${num}</b><button type="button" class="mine-x" data-x aria-label="Закрыть">✕</button></div>
      <p class="hint">Видно только вам и вашим клиентам — в подборках и PDF. Объявление у других агентов и в базе не меняется.</p>
      <label class="field">Цена для клиента, млн ₽ <small class="muted">в объявлении: ${esc(rub(r.base.price))}</small>
        <input name="price" inputmode="decimal" autocomplete="off" placeholder="${esc(mlnTxt(r.base.price))}" value="${esc(mlnTxt(e.price))}"></label>
      <label class="field">Описание<textarea name="descr" rows="7" maxlength="12000">${esc(e.descr ?? r.base.descr ?? '')}</textarea></label>
      ${photos.length ? `<div class="field">Фото <small class="muted">нажмите на фото, чтобы убрать его у себя (ещё раз — вернуть)</small>
        <div class="mine-ph">${photos.map((u, i) => `<button type="button" class="mine-pi${hide.has(u) ? ' off' : ''}" data-i="${i}"><img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"><i>убрано</i></button>`).join('')}</div></div>` : ''}
      <p class="err" data-err></p>
      <div class="mine-foot">${r.edit ? '<button type="button" class="btn ghost" data-reset>Снять правку</button>' : ''}<span></span>
        <button type="button" class="btn ghost" data-x>Отмена</button><button type="submit" class="btn primary">Сохранить у себя</button></div></form>`);
    d.querySelectorAll('.mine-pi').forEach(b => b.onclick = () => { const u = photos[+b.dataset.i]; hide.has(u) ? hide.delete(u) : hide.add(u); b.classList.toggle('off', hide.has(u)); });
    d.querySelector('[data-reset]')?.addEventListener('click', async () => {
      try { const z = await call('my_edit', { num, do: 'reset' }); d.close(); toast(z.message); done?.(); } catch (er) { d.querySelector('[data-err]').textContent = er.message; }
    });
    d.querySelector('form').onsubmit = async ev => {
      ev.preventDefault();
      const f = ev.target, p = mlnOf(f.price.value);
      if (f.price.value.trim() && !p) { d.querySelector('[data-err]').textContent = 'Цена — числом в миллионах, например 12,5'; return; }
      if (photos.length && hide.size >= photos.length) { d.querySelector('[data-err]').textContent = 'Оставьте хотя бы одно фото'; return; }
      try {
        const z = await call('my_edit', { num, do: 'save', price: p || null, descr: f.descr.value, hide: [...hide] });
        d.close(); toast(z.message); done?.();
      } catch (er) { d.querySelector('[data-err]').textContent = er.message; }
    };
  }
  async function removed(call, done) {
    const d = dlg(`<div class="mine-f"><div class="mine-h"><b>🗑 Убранные у меня</b><button type="button" class="mine-x" data-x aria-label="Закрыть">✕</button></div>
      <p class="hint">Эти объявления вы убрали у себя — их нет в вашем поиске, на карте и в «Контакте». У других агентов они остались.</p><div class="mine-rl"><p class="muted">Загрузка…</p></div></div>`);
    const box = d.querySelector('.mine-rl');
    const draw = async () => {
      let r; try { r = await call('my_removed'); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
      box.innerHTML = r.items.length ? r.items.map(x => `<div class="mine-ri"><span>№ ${x.num}${x.excl ? ' 💎' : ''} · ${esc([x.rooms === 0 ? 'студия' : x.rooms ? `${x.rooms}-комн.` : x.kind, x.area && `${x.area} м²`, x.complex && `ЖК ${x.complex}`, x.place].filter(Boolean).join(' · '))} · ${esc(rub(x.price))}</span>
        <button type="button" class="btn ghost sm" data-back="${x.num}">Вернуть</button></div>`).join('') : '<p class="muted">Ничего не убрано.</p>';
    };
    box.onclick = async e => {
      const b = e.target.closest('[data-back]'); if (!b) return;
      b.disabled = true;
      try { await call('my_edit', { num: +b.dataset.back, do: 'restore' }); toast(`№ ${b.dataset.back} снова у вас в поиске`); draw(); done?.(); } catch (er) { b.disabled = false; alert(er.message); }
    };
    draw();
  }
  function video(url) {
    if (!url) return;
    dlg(`<div class="mine-f"><div class="mine-h"><b>🎬 Видео объекта</b><button type="button" class="mine-x" data-x aria-label="Закрыть">✕</button></div>
      <video src="${esc(url)}" controls playsinline autoplay class="mine-v"></video></div>`, 'vid');
  }
  const toast = t => { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4500); };
  window.MINE = { edit, removed, video };
})();

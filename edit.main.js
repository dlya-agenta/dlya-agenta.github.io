// v5.46 D (п. 9 Алексея): группа Main и админ правят объявление в карточке — цена, описание, фото (сервер: web admin_edit*, правки главнее источника).
// Минимальный интерфейс: окно поверх карточки. Карточку позже переделывает часть E — подключение: кнопка data-edit в «Модерации» (app.js ivTools).
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rub = v => v ? Number(v).toLocaleString('ru-RU') + ' ₽' : '—';
  // фото с телефона — до 1600 px по длинной стороне, JPEG: укладываемся в 2 МБ
  const shrink = file => new Promise((ok, bad) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      ok(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(u); bad(new Error('Не удалось открыть картинку')); };
    img.src = u;
  });

  async function open(num, done) {
    let d;
    try { d = await call('admin_edit_get', { num }); } catch (e) { toast(e.message); return; }
    if (!d.ok) { toast(d.error || 'Не удалось открыть'); return; }
    const all = [...new Set([...d.pics, ...d.src_pics])], on = new Set(d.pics);
    const ed = d.edited;
    sheet(`✏️ Правка объявления № ${num}`, `<div class="hub-form em-form">
      <p class="hint">Правка видна всем сразу и остаётся, даже если источник обновит объявление. Фото источника не удаляются — только скрываются.</p>
      <label class="field">Цена, ₽<input name="price" inputmode="numeric" value="${esc(d.price ?? '')}"></label>
      <p class="hint">${ed.price ? `Изменено группой Main. У источника: ${rub(d.src_price)} · <button type="button" class="linkbtn" data-reset="price">вернуть</button>` : 'Сейчас — цена источника'}</p>
      <label class="field">Описание<textarea name="descr" rows="8" maxlength="6000">${esc(d.descr)}</textarea></label>
      <p class="hint">${ed.descr ? 'Изменено группой Main · <button type="button" class="linkbtn" data-reset="descr">вернуть описание источника</button>' : 'Сейчас — описание источника'}</p>
      <div class="field">Фото <span class="muted">— нажмите на фото, чтобы скрыть или вернуть</span></div>
      <div class="em-pics">${all.map(u => `<button type="button" class="em-pic${on.has(u) ? '' : ' off'}" data-u="${esc(u)}"><img src="${esc(u)}" alt="" loading="lazy"><i>${on.has(u) ? '✕' : '↩'}</i></button>`).join('')}</div>
      <label class="btn ghost sm em-add">＋ Добавить фото<input type="file" accept="image/*" multiple hidden></label>
      ${ed.pics ? '<p class="hint">Фото изменены группой Main · <button type="button" class="linkbtn" data-reset="pics">вернуть фото источника</button></p>' : ''}
      <div class="iv-row"><button type="button" class="btn primary" data-save>Сохранить</button><button type="button" class="btn ghost" data-cancel>Отмена</button></div>
      ${d.by ? `<p class="hint">Последняя правка: ${esc(d.by)}, ${new Date(d.at).toLocaleString('ru-RU')}</p>` : ''}
    </div>`);
    const box = document.querySelector('#sheet .em-form'), pics = box.querySelector('.em-pics');
    const finish = r => { if (!r?.ok) { toast(r?.error || 'Не сохранилось'); return false; } toast('Сохранено — видно всем'); closeSheet(); done?.(); return true; };
    pics.onclick = e => {
      const b = e.target.closest('.em-pic'); if (!b) return;
      b.classList.toggle('off'); b.querySelector('i').textContent = b.classList.contains('off') ? '↩' : '✕';
    };
    box.querySelector('.em-add input').onchange = async e => {
      const files = [...e.target.files].slice(0, 10);
      for (const f of files) {
        try {
          toast(`Загружаю фото… (${files.indexOf(f) + 1} из ${files.length})`, 8000);
          const r = await call('admin_edit_photo', { num, data: await shrink(f) });
          if (!r.ok) throw new Error(r.error);
          pics.insertAdjacentHTML('beforeend', `<button type="button" class="em-pic" data-u="${esc(r.url)}"><img src="${esc(r.url)}" alt=""><i>✕</i></button>`);
        } catch (err) { toast(err.message); }
      }
      toast('Фото добавлены — нажмите «Сохранить»');
      e.target.value = '';
    };
    box.onclick = async e => {
      const rs = e.target.closest('[data-reset]');
      if (rs) { finish(await call('admin_edit', { num, reset: rs.dataset.reset }).catch(err => ({ error: err.message }))); return; }
      if (e.target.closest('[data-cancel]')) { closeSheet(); return; }
      const sv = e.target.closest('[data-save]'); if (!sv) return;
      const body = { num }, price = Number(box.querySelector('[name=price]').value.replace(/\D/g, '')), descr = box.querySelector('[name=descr]').value.trim();
      if (price && price !== d.price) body.price = price;
      if (descr && descr !== d.descr.trim()) body.descr = descr;
      const list = [...pics.querySelectorAll('.em-pic:not(.off)')].map(b => b.dataset.u);
      if (list.join('|') !== d.pics.join('|')) body.pics = list;
      if (Object.keys(body).length === 1) { closeSheet(); return; }
      sv.disabled = true;
      if (!finish(await call('admin_edit', body).catch(err => ({ error: err.message })))) sv.disabled = false;
    };
  }
  document.head.insertAdjacentHTML('beforeend', `<style>
    .em-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px;margin:6px 0}
    .em-pic{position:relative;padding:0;border:1px solid var(--line,#ccc);border-radius:8px;overflow:hidden;aspect-ratio:4/3;background:none;cursor:pointer}
    .em-pic img{width:100%;height:100%;object-fit:cover;display:block}
    .em-pic i{position:absolute;top:3px;right:3px;font-style:normal;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:22px;height:22px;line-height:22px;font-size:12px;text-align:center}
    .em-pic.off img{opacity:.25;filter:grayscale(1)} .em-add{margin:4px 0 10px} .linkbtn{background:none;border:0;padding:0;color:var(--acc,#2563eb);text-decoration:underline;cursor:pointer;font:inherit}
  </style>`);
  window.EDITMAIN = { open };
})();

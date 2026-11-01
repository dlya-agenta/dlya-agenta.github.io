// «Мой помощник» (v5.15, п. 7): каждый диалог — своё окно, слева — история («ИИ помощник»), голос — кнопка 🎤 (распознаёт браузер).
// Ответ: объекты (как на главной), «понял так», один альтернативный запрос, лимит запросов. После выдачи — не больше 2 раз в диалоге —
// предложение: написать собственникам, реклама, рассылка, ролик. Сервер — hub/helper.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const photo = x => x.pics ? x.pics[0] : x.web_photos ? (x.web_photos_v === 3 ? `${MEDIA}/${x.num}/0.jpg` : `${PH}/${x.num}/0.jpg`) : '';
  const title = x => [x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн.` : '', x.type_name || x.kind || '', x.area ? `${x.area} м²` : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : ''].filter(Boolean).join(' · ');
  const place = x => [x.zk || x.complex, x.sub || x.district].filter(Boolean).join(' · ');
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
  let st = null, cur = null, picked = new Set(), el = null;

  const card = x => `<label class="hub-card${picked.has(x.num) ? ' on' : ''}" data-num="${x.num}">
    <span class="hub-ph">${photo(x) ? `<img src="${esc(photo(x))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="hub-noph">🏠</span>'}</span>
    <input type="checkbox" data-pick="${x.num}"${picked.has(x.num) ? ' checked' : ''} aria-label="Отметить № ${x.num}">
    <b>${esc(H.mln(x.price))}</b><small>${esc(title(x))}</small><small class="muted">${esc(place(x))} · № ${x.num}</small>
    <a class="hub-open" href="./#o=${x.num}" target="_blank" rel="noopener">Открыть</a></label>`;

  function quotaLine(q) {
    if (!q) return '';
    return q.trial ? `Пробных запросов: осталось <b>${q.left}</b> из ${q.lim}. В PRO — 10 в месяц, в MAX — 30.` : `Запросов в этом месяце: осталось <b>${q.left}</b> из ${q.lim}.`;
  }
  async function open(arg, ctx) {
    el = ctx.el;
    st = await H.call('help_init');
    cur = arg ? +arg : st.dialogs[0]?.id ?? null;
    draw();
    const q0 = store.get('helper_q', '');   // голос из строки поиска на главной
    if (q0) { localStorage.removeItem('helper_q'); cur = null; return ask(q0); }
    if (cur) loadDialog(cur);
  }
  function draw() {
    const voice = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    el.innerHTML = `<div class="hub-two">
      <aside class="hub-side"><button class="btn primary" data-new>＋ Новый диалог</button>
        <div class="hub-list">${st.dialogs.map(d => `<button class="hub-li${d.id === cur ? ' on' : ''}" data-dlg="${d.id}"><b>${esc(d.title || 'Новый диалог')}</b><small>${H.when(d.updated_at)}</small></button>`).join('') || '<p class="muted">Диалогов пока нет</p>'}</div>
        <a class="hint" href="help-helper.html" target="_blank">📘 Как пользоваться помощником</a></aside>
      <section class="hub-body">
        <h2>🤖 Мой помощник</h2>
        <p class="hint">${quotaLine(st.quota)}</p>
        <form class="hub-ask" id="h-ask"><input id="h-q" type="search" placeholder="Например: 1к до 16 млн в центре Сочи, не первый этаж" autocomplete="off" aria-label="Запрос помощнику" maxlength="300">
          ${voice ? '<button type="button" class="btn soft" id="h-mic" title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}
          <button class="btn primary" id="h-go">Спросить</button></form>
        <p class="hint" id="h-wait" hidden>⏳ Ищу — займёт ~5–15 секунд. Ответ придёт и в бот, если уйдёте со страницы.</p>
        <div id="h-turns"></div></section></div>`;
    el.onclick = onClick; el.onchange = onChange;
    el.querySelector('#h-ask').onsubmit = e => { e.preventDefault(); ask(); };
    el.querySelector('#h-mic')?.addEventListener('click', listen);
  }
  async function loadDialog(id) {
    const box = el.querySelector('#h-turns');
    box.innerHTML = '<p class="muted">Загрузка…</p>';
    try {
      const r = await H.call('help_hist', { dialog_id: id });
      const byNum = new Map(r.items.map(x => [x.num, x]));
      box.innerHTML = r.turns.map(t => turnHtml({ q: t.q, via: t.via, understood: t.note, alt: t.alt, count: t.total, items: t.ids.map(n => byNum.get(n)).filter(Boolean) })).join('') || '<p class="muted">Напишите или скажите, что ищете.</p>';
    } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }
  const turnHtml = (r, offer) => `<article class="hub-turn"><p class="hub-q">🗣 ${esc(r.q)}</p>
    <p class="hint">${r.via === 'ai' ? '🤖 Помощник переписал запрос: ' + esc(r.text ?? '') + ' · ' : ''}${r.understood ? `Понял так: ${esc(r.understood)} · ` : ''}найдено <b>${r.count}</b></p>
    ${r.alt ? `<p class="hub-alt">💡 ${esc(r.alt.label)} <b>+${r.alt.more}</b> ${r.alt.q?.length ? `<button class="btn soft" data-alt="${esc(JSON.stringify(r.alt.q))}">Показать</button>` : ''}</p>` : ''}
    <div class="hub-grid">${(r.items ?? []).slice(0, 30).map(card).join('')}</div>
    ${offer ? `<div class="hub-offer"><b>Что дальше?</b> Отметьте объекты галочками и:
      <button class="btn primary" data-owners>✉️ Написать собственникам</button>
      <button class="btn soft" data-go-rk>📣 В рекламу</button><button class="btn soft" data-go-mail>📨 Рассылка</button>
      ${offer.video ? '<button class="btn soft" data-go-video>🎬 Ролик</button>' : ''}</div>` : ''}</article>`;

  async function ask(text) {
    const q = (text ?? el.querySelector('#h-q').value).trim();
    if (!q) return el.querySelector('#h-q').focus();
    if (!cur) { const d = await H.call('help_new'); cur = d.dialog.id; st.dialogs.unshift({ id: cur, title: q.slice(0, 80), updated_at: new Date().toISOString() }); draw(); }
    const wait = el.querySelector('#h-wait'), go = el.querySelector('#h-go');
    wait.hidden = false; go.disabled = true;
    try {
      const r = await H.call('help_ask', { dialog_id: cur, q });
      st.quota = r.quota;
      const box = el.querySelector('#h-turns');
      if (box.querySelector('.muted') && !box.querySelector('.hub-turn')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', turnHtml({ ...r, q }, r.offer));
      box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.querySelector('.hub-body .hint').innerHTML = quotaLine(st.quota);
      el.querySelector('#h-q').value = '';
    } catch (e) { H.toast(e.message, 6000); if (e.code === 'limit') el.querySelector('.hub-body .hint').innerHTML = `${esc(e.message)} <a href="pay.html?plan=pro">Оформить PRO</a>`; }
    finally { wait.hidden = true; go.disabled = false; }
  }
  // голос: распознаёт браузер (Google или Apple), текст подставляется в поле и сразу отправляется
  function listen() {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new R(), mic = el.querySelector('#h-mic');
    rec.lang = 'ru-RU'; rec.interimResults = true; rec.maxAlternatives = 1;
    mic.classList.add('on'); mic.textContent = '⏺';
    rec.onresult = e => { const t = [...e.results].map(x => x[0].transcript).join(' '); el.querySelector('#h-q').value = t; if (e.results[e.results.length - 1].isFinal) { rec.stop(); ask(t); } };
    rec.onerror = e => H.toast(e.error === 'not-allowed' ? 'Разрешите микрофон в настройках браузера' : 'Не расслышал — попробуйте ещё раз');
    rec.onend = () => { mic.classList.remove('on'); mic.textContent = '🎤'; };
    rec.start();
  }
  async function onClick(e) {
    const t = e.target;
    if (t.closest('[data-new]')) { cur = null; draw(); el.querySelector('#h-turns').innerHTML = '<p class="muted">Напишите или скажите, что ищете.</p>'; el.querySelector('#h-q').focus(); return; }
    const d = t.closest('[data-dlg]'); if (d) { cur = +d.dataset.dlg; history.replaceState(null, '', `#helper=${cur}`); draw(); loadDialog(cur); return; }
    const a = t.closest('[data-alt]'); if (a) { const qs = JSON.parse(a.dataset.alt); ask(qs[0]); return; }
    if (t.closest('[data-owners]')) return owners();
    const nums = [...picked];
    if (t.closest('[data-go-rk]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); store.set('sel', nums); location.href = './#rk'; return; }
    if (t.closest('[data-go-video]')) { if (!nums.length) return H.toast('Отметьте объекты галочками'); location.hash = `video=${nums.join(',')}`; return; }
    if (t.closest('[data-go-mail]')) {   // рассылка берёт объекты из «Избранного»
      if (!nums.length) return H.toast('Отметьте объекты галочками');
      for (const num of nums) await H.web('fav', { num, on: true }).catch(() => {});
      H.toast('Объекты добавлены в «Избранное» — рассылка возьмёт их оттуда'); setTimeout(() => location.href = 'mail.html', 1200); return;
    }
  }
  function onChange(e) {
    const c = e.target.closest('[data-pick]'); if (!c) return;
    const n = +c.dataset.pick; c.checked ? picked.add(n) : picked.delete(n);
    c.closest('.hub-card').classList.toggle('on', c.checked);
  }
  // «Написать собственникам»: спросить текст; телефоны открываются по тарифу (уже открытые — бесплатно)
  function owners() {
    const nums = [...picked];
    if (!nums.length) return H.toast('Отметьте объекты, собственникам которых написать');
    const d = document.createElement('div'); d.className = 'sheet';
    d.innerHTML = `<div class="sheet-box"><div class="sheet-head"><b>Написать собственникам (${nums.length})</b><button class="btn ghost" data-x>✕</button></div>
      <div class="sheet-body"><label class="field">Что написать<textarea id="o-text" rows="5" maxlength="1000">Здравствуйте! Я агент по недвижимости, у меня есть покупатель на ваш объект. Удобно обсудить показ?</textarea></label>
      <p class="hint">Уже открытые телефоны — бесплатно и без лимита. Новые откроются по вашему тарифу. Сообщение отправите вы — из своего WhatsApp, Telegram или MAX (кнопки ниже).</p>
      <div id="o-res"></div></div>
      <div class="sheet-foot"><button class="btn ghost" data-x>Закрыть</button><button class="btn primary" data-send>Открыть телефоны и подготовить</button></div></div>`;
    document.body.appendChild(d);
    d.onclick = async e => {
      if (e.target === d || e.target.closest('[data-x]')) return d.remove();
      if (!e.target.closest('[data-send]')) return;
      const b = e.target.closest('[data-send]'); b.disabled = true; b.textContent = 'Открываю телефоны…';
      try {
        const r = await H.call('help_owners', { nums, text: d.querySelector('#o-text').value });
        d.querySelector('#o-res').innerHTML = r.items.map(x => `<div class="hub-own"><b>№ ${x.num}</b> ${x.ok ? `${esc(x.name ?? '')} <a href="tel:${esc(x.phone)}">${esc(x.phone)}</a> ${H.msgLinks(x.phone, r.text)}` : `<span class="err">${esc(x.message ?? 'нет номера')}</span>`}</div>`).join('');
        b.textContent = 'Готово';
      } catch (er) { H.toast(er.message, 6000); b.disabled = false; b.textContent = 'Открыть телефоны и подготовить'; }
    };
  }
  window.SEC = window.SEC || {};
  window.SEC.helper = { title: 'Мой помощник', open };
})();

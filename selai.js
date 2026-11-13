// «🤖 Позвать помощника ИИ» по откликам клиента (v5.31b, пункт 3 задачи Алексея 05.11). window.SELAI.open({ sel_id, t }) — окно поверх страницы
// (на телефоне — во весь экран, закрытие крестиком, Esc и свайпом вниз). Кнопки ставит вкладка A: s.html (страница агента, #…&a=1) и index.html («Мои подборки»).
// Сервер — hub sel_ai {sel_id} (что понял, альтернативы, текст клиенту; ai: true — переписал ИИ, false — по правилам) и sel_ai_make {sel_id, nums, text} → новая подборка ссылкой.
(() => {
  if (window.SELAI) return;
  const V = '5.71q6', HUB = 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/hub';
  // v5.53: окно объявления поверх Помощника и на страницах без objpop.js (страница агента s.html)
  // (только когда агент открыл Помощник — у клиента на s.html номера ссылками не становятся)
  const objpop = () => { if (!window.OBJPOP && !document.querySelector('script[src^="objpop.js"]')) { const sc = document.createElement('script'); sc.src = 'objpop.js?v=5.58h'; document.head.appendChild(sc); } };
  if (!document.querySelector('link[data-selai]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `selai.css?v=${V}`; l.dataset.selai = '1'; document.head.appendChild(l); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  const mln = p => p ? `${(Math.round(p / 1e5) / 10).toLocaleString('ru-RU')} млн` : '';
  const n1 = n => n == null ? '' : String(Math.round(n * 10) / 10).replace('.', ',');
  const sea = m => !m ? '' : m < 1000 ? `${Math.round(m / 10) * 10} м до моря` : `${n1(m / 1000)} км до моря`;
  async function hub(action, body = {}, url = HUB) {
    const t = tok();
    if (!t) throw Object.assign(new Error('Войдите на сайт, чтобы позвать помощника'), { code: 'no_auth' });
    let r, j;
    for (let i = 0; i < 2; i++) {
      try { r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, auth: { token: t }, ...body }) }); j = await r.json().catch(() => ({})); break; }
      catch (e) { if (i) throw new Error('Нет связи с сервером — проверьте интернет и попробуйте ещё раз'); await new Promise(res => setTimeout(res, 1200)); }
    }
    if (!r.ok || j.error) throw Object.assign(new Error(j.message || `Ошибка ${r.status}`), { code: j.error, extra: j, data: j });
    return j;
  }
  const web = (action, body) => hub(action, body, HUB.replace(/\/hub$/, '/web'));
  let ov = null, state = null;
  function close() { if (!ov) return; ov.classList.add('sai-out'); const o = ov; ov = null; setTimeout(() => o.remove(), 180); document.documentElement.classList.remove('sai-lock'); document.removeEventListener('keydown', onKey); }
  const onKey = e => { if (e.key === 'Escape') close(); };
  function shell(title) {
    close();
    ov = document.createElement('div');
    ov.className = 'sai-ov';
    ov.innerHTML = `<div class="sai" role="dialog" aria-modal="true" aria-label="Помощник по откликам">
      <div class="sai-h"><i class="sai-grab" aria-hidden="true"></i><div class="sai-ht"><b>🤖 Помощник по откликам</b><small>${esc(title || '')}</small></div>
        <button class="sai-x" type="button" aria-label="Закрыть">✕</button></div><div class="sai-b"></div></div>`;
    document.body.appendChild(ov);
    document.documentElement.classList.add('sai-lock');
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.sai-x').onclick = close;
    document.addEventListener('keydown', onKey);
    // свайп вниз по шапке — закрыть (телефон)
    const h = ov.querySelector('.sai-h'), box = ov.querySelector('.sai');
    let y0 = null;
    h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    h.addEventListener('touchmove', e => { if (y0 == null) return; const d = Math.max(0, e.touches[0].clientY - y0); box.style.transform = `translateY(${d}px)`; }, { passive: true });
    h.addEventListener('touchend', e => { const d = (e.changedTouches[0]?.clientY ?? y0) - y0; box.style.transform = ''; y0 = null; if (d > 90) close(); });
    return ov.querySelector('.sai-b');
  }
  const STEPS = ['Читаю отметки и комментарии клиента', 'Проверяю пожелания и заданный бюджет', 'Ищу похожие варианты в базе', 'Ставлю вперёд варианты с современным ремонтом', 'Пишу текст клиенту'];
  function loading(b) {
    b.innerHTML = `<div class="sai-load"><div class="sai-spin" aria-hidden="true"></div><p><b>Помощник смотрит отклики…</b></p>
      <div class="sai-bar"><i></i></div><ol class="sai-steps">${STEPS.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
    const lis = b.querySelectorAll('.sai-steps li'), bar = b.querySelector('.sai-bar i');
    let k = 0; lis[0].classList.add('on');
    const t = setInterval(() => { if (!b.isConnected || k >= lis.length - 1) return clearInterval(t); lis[k].classList.replace('on', 'ok'); lis[++k].classList.add('on'); bar.style.width = `${(k + 1) / lis.length * 92}%`; }, 2200);
    bar.style.width = `${100 / lis.length}%`;
    return () => clearInterval(t);
  }
  function fail(b, e, retry) {
    const x = e.extra || {}, btn = x.button;
    b.innerHTML = `<div class="sai-err"><p>${e.code === 'limit' ? '⏳' : e.code === 'no_marks' ? '🕊' : '⚠️'} ${esc(e.message)}</p>
      <div class="sai-row">${btn ? `<a class="sai-btn pri" href="${esc(btn.href)}">${esc(btn.label)}</a>` : ''}${e.code !== 'limit' && e.code !== 'no_marks' && e.code !== 'forbidden' ? '<button class="sai-btn" type="button" data-retry>Повторить</button>' : ''}
      <button class="sai-btn" type="button" data-close>Закрыть</button></div></div>`;
    b.querySelector('[data-retry]')?.addEventListener('click', retry);
    b.querySelector('[data-close]').onclick = close;
  }
  const agentLink = (o, f) => (o.t ? `s.html#${encodeURIComponent(o.t)}&a=1` : `s.html#id=${o.sel_id}&a=1`) + (f ? `&f=${f}` : '');
  const fbLi = (x, icon) => `<li><span class="sai-n">${icon ? icon + ' ' : ''}<a class="objlink" href="./#o=${x.num}" data-obj="${x.num}" title="Открыть объявление">№ ${x.num}</a></span><span>${esc(x.why)}</span></li>`;
  const fbList = (xs, icon) => !xs.length ? '<p class="sai-mut">нет</p>' : `<ul class="sai-fb">${xs.slice(0, 4).map(x => fbLi(x, icon)).join('')}</ul>${xs.length > 4
    ? `<details class="sai-det"><summary>ещё ${xs.length - 4}</summary><ul class="sai-fb">${xs.slice(4, 30).map(x => fbLi(x, icon)).join('')}</ul></details>` : ''}`;
  const qLi = x => `<li><span class="sai-n"><a class="objlink" href="./#o=${x.num}" data-obj="${x.num}" title="Открыть объявление">№ ${x.num}</a></span><q>${esc(x.q)}</q></li>`;
  const qList = xs => `<ul class="sai-q">${xs.slice(0, 4).map(qLi).join('')}</ul>${xs.length > 4 ? `<details class="sai-det"><summary>ещё ${xs.length - 4}</summary><ul class="sai-q">${xs.slice(4, 40).map(qLi).join('')}</ul></details>` : ''}`;
  // v5.48 H2: pick — «вне рамки» у альтернатив за рамкой агента; галочками заранее отмечены только объекты в рамке (первые 6)
  // v5.51: карточка — фото ровно 4:3 (раньше вертикальные фото растягивали карточку), значки на фото, «нужен ремонт / не указан» не показываем
  const RP_OK = new Set(['с ремонтом']);
  // v5.53 (Алексей 11.11): фото листаются, как в поиске — мышкой по фото (кадры меняются, внизу полоски), на телефоне — пальцем; до 12 кадров
  const gal = a => { const n = Math.max(1, Math.min(12, +a.photos || 1)), u = k => k ? String(a.photo).replace(/\/0\.jpg(\?.*)?$/, `/${k}.jpg$1`) : a.photo;
    const L = n > 1 && /\/0\.jpg(\?.*)?$/.test(a.photo) ? n : 1;
    return `<span class="sai-strip">${Array.from({ length: L }, (_, k) => `<img src="${esc(u(k))}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</span>${L > 1 ? `<span class="sai-dots">${Array.from({ length: L }, (_, k) => `<i${k ? '' : ' class="on"'}></i>`).join('')}</span>` : ''}`; };
  // кадра нет (фото ещё не загружено) — убрать из ленты и полосок
  document.addEventListener('error', e => { const im = e.target; if (im.tagName !== 'IMG' || !im.parentElement?.classList.contains('sai-strip')) return;
    const ph = im.closest('.sai-ph'), k = [...im.parentElement.children].indexOf(im); im.remove(); ph?.querySelectorAll('.sai-dots i')[k]?.remove(); }, true);
  const scrub = e => { const ph = e.target.closest?.('.sai-ph'), st = ph?.querySelector('.sai-strip'); if (!st) return; const n = st.children.length; if (n < 2) return;
    const r = ph.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))); if (ph.dataset.k == k) return;
    ph.dataset.k = k; st.scrollTo({ left: k * st.clientWidth, behavior: 'instant' }); ph.querySelectorAll('.sai-dots i').forEach((d, i) => d.classList.toggle('on', i === k)); };
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', scrub);
    document.addEventListener('mouseout', e => { const ph = e.target.closest?.('.sai-ph'); if (ph && !ph.contains(e.relatedTarget) && +ph.dataset.k) { ph.dataset.k = 0; ph.querySelector('.sai-strip')?.scrollTo({ left: 0, behavior: 'instant' }); ph.querySelectorAll('.sai-dots i').forEach((d, i) => d.classList.toggle('on', !i)); } });
  }
  // телефон: лента листается пальцем (scroll-snap) — полоски по месту
  document.addEventListener('scroll', e => { const st = e.target; if (!st.classList?.contains('sai-strip')) return; const k = Math.round(st.scrollLeft / (st.clientWidth || 1));
    st.parentElement.querySelectorAll('.sai-dots i').forEach((d, i) => d.classList.toggle('on', i === k)); }, true);
  function card(a, i, pk) {
    const pa = [a.rooms === 0 ? 'студия' : a.rooms != null ? `${a.rooms}-комн.` : '', a.area ? `${n1(a.area)} м²` : '', a.floor ? `${a.floor} эт.` : ''].filter(Boolean);
    return `<label class="sai-card${a.modern ? ' mod' : ''}${pk && a.outside_frame ? ' out' : ''}"><input type="checkbox" data-num="${a.num}"${i < 6 && !(pk && a.outside_frame) ? ' checked' : ''}>
      <span class="sai-ph">${a.photo ? gal(a) : '<span class="sai-nophoto">фото нет</span>'}
        <span class="sai-badges">${a.modern ? '<b class="sai-badge"><i>✨ </i>Современный ремонт</b>' : RP_OK.has(a.repair) ? '<b class="sai-badge soft">С ремонтом</b>' : ''}${pk && a.outside_frame ? '<b class="sai-badge out">вне рамки</b>' : ''}</span>
        ${a.photos ? `<em>📷 ${a.photos}</em>` : ''}<i class="sai-tick" aria-hidden="true"></i></span>
      <span class="sai-ci"><span class="sai-pr">${esc(mln(a.price_client || a.price))}${a.price_client && a.price && a.price_client !== a.price ? ` <small>собств. ${esc(mln(a.price))}</small>` : ''}</span>
        <span class="sai-pa">${pa.map(esc).join('<i>·</i>')}</span>
        <span class="sai-pl"><span class="sai-mm" data-mm data-num="${a.num}" title="Показать на карте">📍 ${esc([a.zk, a.sub].filter(Boolean).join(', ') || 'Сочи')}</span>${a.sea_m ? `<span class="sai-sea">🌊 ${esc(sea(a.sea_m).replace(' до моря', ''))}</span>` : ''}</span>
        ${a.why ? `<span class="sai-why">${esc(a.why)}</span>` : ''}
        <span class="sai-foot"><span class="sai-num"><a class="objlink" href="./#o=${a.num}" data-obj="${a.num}" title="Открыть объявление">№ ${a.num}</a></span><span class="sai-pick-l"></span></span></span></label>`;
  }
  function render(b, r, o) {
    state = { r, o };
    const q = r.quota, alts = r.alts || [], pk = !!o.pick;
    const chips = [r.budget?.from || r.budget?.to != null ? `💰 ${r.budget.from ? 'от ' + mln(r.budget.from) : ''}${r.budget.to != null ? ' до ' + mln(r.budget.to) : ''}` : '',
      r.want?.rooms ? `🛏 ${r.want.rooms}` : '', r.want?.area ? `📐 ${r.want.area}` : '', (r.want?.districts || []).length ? `📍 ${r.want.districts.join(', ')}` : ''].filter(Boolean);
    b.innerHTML = `
      <section class="sai-s sai-s1"><div class="sai-sh"><span class="sai-ico">🧠</span><h3>Что понял помощник</h3>${r.ai ? '<span class="sai-tag ai">ИИ</span>' : '<span class="sai-tag">по правилам</span>'}</div>
        ${!r.ai ? `<p class="sai-note">${r.ai_error ? 'ИИ сейчас не отвечает — ' : ''}разбор сделан по правилам: бюджет, районы, ремонт и вопросы клиента.</p>` : ''}
        ${r.cached ? `<p class="sai-note">Отклики не менялись — показан прошлый разбор (бесплатно). <button class="sai-lnk" type="button" data-fresh>Разобрать заново</button></p>` : ''}
        <p class="sai-sum">${esc(r.summary)}</p>
        ${chips.length ? `<div class="sai-chips">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
        ${r.likes.length || r.dislikes.length ? `<div class="sai-cols${r.likes.length && r.dislikes.length ? '' : ' one'}">${r.likes.length ? `<div class="sai-box yes"><h4>👍 Подходит <b>${r.likes.length}</b></h4>${fbList(r.likes, '')}</div>` : ''}${r.dislikes.length ? `<div class="sai-box no"><h4>👎 Не подходит <b>${r.dislikes.length}</b></h4>${fbList(r.dislikes, '')}</div>` : ''}</div>` : ''}
        ${r.questions.length ? `<div class="sai-box qq"><h4>💬 Вопросы клиента <b>${r.questions.length}</b></h4>${qList(r.questions)}
          <a class="sai-btn sm" href="${esc(agentLink(o, 'q'))}">✉️ Спросить собственников</a></div>` : ''}
      </section>
      <section class="sai-s"><div class="sai-sh"><span class="sai-ico">🏠</span><h3>Предлагаю посмотреть</h3><span class="sai-tag">${alts.length}</span></div>
        ${alts.length ? `<p class="sai-mut">Сначала — с современным ремонтом, затем ближе к бюджету. Отмечены первые 6 — нажмите на карточку, чтобы убрать или добавить.</p><div class="sai-grid">${alts.map((a, i) => card(a, i, pk)).join('')}</div>`
          : '<p class="sai-note">Похожих вариантов в базе сейчас нет. Попробуйте позже или расширьте район в новой подборке.</p>'}
      </section>
      <section class="sai-s"><div class="sai-sh"><span class="sai-ico">✉️</span><h3>Текст клиенту</h3><span class="sai-mut sai-hint">можно поправить перед отправкой</span></div>
        <div class="sai-msg"><textarea class="sai-ta" rows="12" spellcheck="true">${esc(r.text_client)}</textarea></div>
        <div class="sai-done" hidden></div>
        ${q ? `<p class="sai-mut sai-q2">Разборов в этом месяце: ${q.used} из ${q.lim >= 9999 ? '∞' : q.lim}</p>` : ''}
      </section>
      <div class="sai-bar2"><span class="sai-sel">Выбрано: <b data-cnt2>0</b></span>
        <div class="sai-row sai-act">${alts.length && pk ? '<button class="sai-btn pri" type="button" data-add>➕ Добавить клиенту <span data-cnt></span></button>' : ''}
          ${alts.length ? `<button class="sai-btn${pk ? '' : ' pri'}" type="button" data-make>📄 Собрать доп. подборку${pk ? '' : ' <span data-cnt></span>'}</button>` : ''}
          <button class="sai-btn" type="button" data-copy>📋 Скопировать текст</button></div></div>`;
    SELECTION_REQUEST.createForUser(web).mount(b, web).catch(() => {});
    const cnt = () => { const n = b.querySelectorAll('.sai-card input:checked:not(:disabled)').length; const c = b.querySelector('[data-cnt]'); if (c) c.textContent = `(${n})`; const c2 = b.querySelector('[data-cnt2]'); if (c2) c2.textContent = n; const mk = b.querySelector('[data-make]'); if (mk) mk.disabled = !n; const ad = b.querySelector('[data-add]'); if (ad) ad.disabled = !n; };
    b.querySelectorAll('.sai-card input').forEach(i => i.onchange = cnt); cnt();
    b.querySelectorAll('.sai-ph img').forEach(im => im.addEventListener('error', () => im.remove(), { once: true }));   // без onerror в разметке — его режет CSP сайта
    b.querySelector('[data-fresh]')?.addEventListener('click', () => run(o, true));
    b.querySelector('[data-copy]').onclick = () => copy(b.querySelector('.sai-ta').value);
    b.querySelector('[data-make]')?.addEventListener('click', () => make(b, o));
    b.querySelector('[data-add]')?.addEventListener('click', () => addToClient(b, o));
  }
  // v5.48 H2: ссылка «Самоподбор» — выбранные альтернативы в «Советует агент» (hub sel_ai_add); страница агента перечитывается по событию selai:added
  async function addToClient(b, o) {
    const boxes = [...b.querySelectorAll('.sai-card input:checked:not(:disabled)')], nums = boxes.map(i => +i.dataset.num), btn = b.querySelector('[data-add]');
    if (!nums.length) return toast('Отметьте варианты');
    btn.disabled = true;
    try {
      const r = await hub('sel_ai_add', { sel_id: o.sel_id, nums });
      boxes.forEach(i => { i.disabled = true; i.closest('.sai-card').classList.add('added'); });
      toast(r.added ? `Добавлено в «Советует агент»: ${r.added}` : 'Уже в «Советует агент»');
      document.dispatchEvent(new CustomEvent('selai:added', { detail: { sel_id: o.sel_id, added: r.added ?? 0 } }));
    } catch (e) { toast(e.message); }
    const n = b.querySelectorAll('.sai-card input:checked:not(:disabled)').length; btn.disabled = !n;
    const c = btn.querySelector('[data-cnt]'); if (c) c.textContent = `(${n})`;
  }
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); toast('Скопировано'); }
    catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Скопировано'); }
  }
  function toast(m) { let el = document.querySelector('.sai-toast'); if (!el) { el = document.createElement('div'); el.className = 'sai-toast'; document.body.appendChild(el); } el.textContent = m; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }
  async function make(b, o) {
    const nums = [...b.querySelectorAll('.sai-card input:checked')].map(i => +i.dataset.num), btn = b.querySelector('[data-make]'), box = b.querySelector('.sai-done');
    if (!nums.length) return toast('Отметьте варианты');
    btn.disabled = true; btn.textContent = 'Собираю подборку…';
    try {
      const text = b.querySelector('.sai-ta').value, r = await SELECTION_REQUEST.createForUser(web).send(hub, { sel_id: o.sel_id, nums, text }, 'sel_ai_make');
      const full = `${text.trim()}\n\n${r.link}`;
      box.hidden = false;
      box.innerHTML = `<p>✅ <b>Доп. подборка готова</b> (${r.total} ${r.total % 10 === 1 && r.total % 100 !== 11 ? 'объект' : r.total % 10 >= 2 && r.total % 10 <= 4 && (r.total % 100 < 12 || r.total % 100 > 14) ? 'объекта' : 'объектов'})${r.photos_wait ? ` · фото у ${r.photos_wait} загружаются, 2–4 мин` : ''}</p>
        <input class="sai-link" readonly value="${esc(r.link)}">
        <div class="sai-row"><a class="sai-btn pri" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(full)}">WhatsApp</a>
          <a class="sai-btn pri" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(r.link)}&text=${encodeURIComponent(text.trim())}">Telegram</a>
          <button class="sai-btn" type="button" data-cp>📋 Копировать текст и ссылку</button>
          <a class="sai-btn" target="_blank" rel="noopener" href="${esc(r.link)}">Открыть как клиент</a>${r.agent_link ? `<a class="sai-btn" href="${esc(r.agent_link)}">Ссылка агенту</a>` : ''}</div>`;
      box.querySelector('[data-cp]').onclick = () => copy(full);
      btn.textContent = '✓ Подборка собрана'; box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      btn.disabled = false; btn.innerHTML = '📄 Собрать доп. подборку';
      toast(e.message);
    }
  }
  async function run(o, fresh = false) {
    const b = ov?.querySelector('.sai-b') ?? shell(o.title);
    const stop = loading(b);
    try { const r = await hub('sel_ai', { sel_id: o.sel_id, ...(fresh ? { fresh: true } : {}) }); stop(); if (!b.isConnected) return; ov.querySelector('.sai-ht small').textContent = r.title || ''; render(b, r, o); }
    catch (e) { stop(); if (b.isConnected) fail(b, e, () => run(o, fresh)); }
  }
  window.SELAI = {
    v: V,
    open(o = {}) {
      objpop();
      const sel_id = Number(o.sel_id) || 0;
      if (!sel_id) { toast('Нет номера подборки'); return; }
      shell(o.title || '');
      run({ sel_id, t: o.t ? String(o.t) : '', title: o.title || '', pick: !!o.pick });
    },
    close,
  };
})();

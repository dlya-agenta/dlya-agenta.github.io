// Подборка для клиента по ссылке s.html#<токен> (ТЗ v2, шаг 3.2). Без входа: sel_public — объекты, sel_feedback — ✓ «подходит» / ✗ «не подходит»
// и строка комментария, сохраняется сразу. Агент, открывший свою ссылку в браузере, где вошёл на сайт, видит пометку; его просмотры не считаются.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => Math.round(v).toLocaleString('ru-RU');
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const seaTxt = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  const t = location.hash.slice(1).split(/[?&]/)[0];
  let tok = null;
  try { tok = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }

  async function call(action, extra = {}) {
    const body = JSON.stringify({ action, t, ...(typeof tok === 'string' ? { auth: { token: tok } } : {}), ...extra });
    for (let i = 0; ; i++) {   // первое соединение иногда обрывается — один повтор
      try {
        const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
        if (!r.ok || d.error) throw Object.assign(new Error(d.message || 'Ошибка'), { data: d });
        return d;
      } catch (e) { if (e.data || i) throw e.data ? e : new Error('Нет связи — проверьте интернет и обновите страницу'); }
    }
  }
  function toast(m, ms = 2600) { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
  const fail = m => { $('#s-app').innerHTML = `<div class="s-empty"><h1>Подборка недоступна</h1><p class="muted">${esc(m)}</p></div>`; };

  const digits = p => String(p ?? '').replace(/\D/g, '');
  const intl = p => { let d = digits(p); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d.length >= 11 ? d : ''; };   // 8 918… → 7918…

  function card(x, i, n) {
    const ph = x.photos.length ? `<div class="s-ph" data-i="${i}">${x.photos.map((u, k) => `<div class="s-im"><img src="${esc(u)}" alt="Фото ${k + 1}" loading="${i < 2 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" data-k="${k}"></div>`).join('')}
      ${x.photos.length > 1 ? `<span class="s-cnt">${x.photos.length} фото</span>` : ''}</div>` : '<div class="s-ph s-noph">Фото нет</div>';
    const tags = [...x.tags, x.sea_m ? `≈ ${seaTxt(x.sea_m)} до моря` : null].filter(Boolean);
    return `<article class="s-card${x.mark ? ` m-${x.mark}` : ''}" data-num="${x.num}">${ph}
      <div class="s-body">
        <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : 'цена по запросу'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
        ${x.place ? `<p class="muted s-place">${esc(x.place)}</p>` : ''}
        ${tags.length ? `<div class="s-tags">${tags.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        ${x.gone ? '<p class="s-gone">Объявление снято с продажи — уточните у агента.</p>' : ''}
        ${x.descr ? `<p class="s-descr">${esc(x.descr)}</p><button type="button" class="btn ghost s-more" hidden>Развернуть</button>` : ''}
        <div class="s-fb">
          <div class="s-marks" role="group" aria-label="Подходит ли объект">
            <button type="button" class="s-yes" data-mark="yes" aria-pressed="${x.mark === 'yes'}">✓ Подходит</button>
            <button type="button" class="s-no" data-mark="no" aria-pressed="${x.mark === 'no'}">✗ Не подходит</button>
          </div>
          <input class="s-cm" type="text" maxlength="300" value="${esc(x.comment)}" placeholder="Напишите, что нравится, а что нет" aria-label="Комментарий к объекту ${i + 1}" enterkeyhint="done">
          <small class="s-st muted" aria-live="polite"></small>
        </div>
        <small class="muted s-no-num">${i + 1} из ${n} · № ${x.num}</small>
      </div></article>`;
  }

  let data = null;
  function render(d) {
    data = d;
    document.title = d.title || 'Подборка объектов';
    const n = d.items.length, tel = intl(d.agent_phone);
    $('#s-app').innerHTML = `
      ${d.owner ? `<div class="s-owner">Это ваша подборка — так её видит клиент. Ваши открытия не считаются и уведомления о них не приходят.${d.views != null ? ` Клиент открывал: ${d.views} ${plural(d.views, 'раз', 'раза', 'раз')}.` : ''}</div>` : ''}
      <header class="s-hero">
        <h1>${esc(d.title)}</h1>
        <p class="muted">Подборка от ${day(d.created_at)} · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · ссылка действует до ${day(d.until)}</p>
        ${d.agent || tel ? `<div class="s-agent"><span>Ваш агент${d.agent ? `: <b>${esc(d.agent)}</b>` : ''}</span><span class="s-agent-btns">
          ${tel ? `<a class="btn soft" href="tel:+${tel}">Позвонить</a><a class="btn ghost" href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></div>` : ''}
        <p class="hint">Отметьте у каждого объекта ✓ «подходит» или ✗ «не подходит» и напишите, что нравится, а что нет, — агент увидит сразу.</p>
      </header>
      <div class="s-list">${d.items.map((x, i) => card(x, i, n)).join('') || '<p class="muted">В подборке нет объектов.</p>'}</div>`;
    // «Развернуть» — только у длинных описаний
    requestAnimationFrame(() => document.querySelectorAll('.s-descr').forEach(p => { if (p.scrollHeight - p.clientHeight > 10) p.nextElementSibling.hidden = false; }));
  }

  // сохранить отметку и комментарий объекта (сервер хранит одну строку на объект)
  async function save(cardEl) {
    const num = +cardEl.dataset.num, x = data.items.find(i => i.num === num), st = cardEl.querySelector('.s-st');
    const comment = cardEl.querySelector('.s-cm').value.trim();
    st.textContent = 'Сохраняю…';
    try {
      const r = await call('sel_feedback', { num, mark: x.mark, comment });
      x.comment = r.comment;
      st.textContent = x.mark || comment ? 'Сохранено — агент увидит' : 'Отметка снята';
    } catch (e) { st.textContent = ''; toast(e.message, 5000); }
  }

  document.addEventListener('click', e => {
    const m = e.target.closest('[data-mark]');
    if (m) {
      const c = m.closest('.s-card'), x = data.items.find(i => i.num === +c.dataset.num);
      x.mark = x.mark === m.dataset.mark ? null : m.dataset.mark;   // повторное нажатие снимает отметку
      c.classList.toggle('m-yes', x.mark === 'yes'); c.classList.toggle('m-no', x.mark === 'no');
      c.querySelectorAll('[data-mark]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mark === x.mark)));
      save(c);
    }
    const more = e.target.closest('.s-more');
    if (more) { const p = more.previousElementSibling; p.classList.toggle('open'); more.textContent = p.classList.contains('open') ? 'Свернуть' : 'Развернуть'; }
    const img = e.target.closest('.s-ph img');
    if (img) open(+img.closest('.s-ph').dataset.i, +img.dataset.k);
  });
  // комментарий: через секунду после ввода и при выходе из поля
  document.addEventListener('input', e => {
    const c = e.target.closest('.s-cm');
    if (!c) return;
    const card = c.closest('.s-card');
    clearTimeout(card._t); card._t = setTimeout(() => save(card), 1200);
  });
  document.addEventListener('change', e => { const c = e.target.closest('.s-cm'); if (c) { const card = c.closest('.s-card'); clearTimeout(card._t); save(card); } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.s-cm')) e.target.blur(); });

  // просмотр фото на весь экран
  let cur = null;
  function open(i, k) { cur = { i, k }; show(); $('#s-view').hidden = false; }
  function show() { const p = data.items[cur.i].photos; cur.k = (cur.k + p.length) % p.length; $('#s-view img').src = p[cur.k]; }
  $('#s-view').onclick = e => {
    const s = e.target.closest('[data-step]');
    if (s) { cur.k += +s.dataset.step; return show(); }
    $('#s-view').hidden = true;
  };
  document.addEventListener('keydown', e => {
    if ($('#s-view').hidden) return;
    if (e.key === 'Escape') $('#s-view').hidden = true;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { cur.k += e.key === 'ArrowRight' ? 1 : -1; show(); }
  });

  addEventListener('hashchange', () => location.reload());   // вставили другую ссылку в ту же вкладку
  if (!/^[A-Za-z0-9_-]{22,40}$/.test(t)) fail('В ссылке нет кода подборки — попросите агента прислать её ещё раз.');
  else call('sel_public').then(render, e => fail(e.message));
})();

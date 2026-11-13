// Подборка для клиента по ссылке s.html#<токен> (ТЗ v2, шаг 3.2). Без входа: sel_public — объекты, sel_feedback — ✓ «подходит» / ✗ «не подходит»
// и строка комментария, сохраняется сразу. Агент, открывший свою ссылку в браузере, где вошёл на сайт, видит пометку; его просмотры не считаются.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // описание (v5.17.3): разделы **жирным** по шаблону; у старых описаний — «Заголовок:» жирным, строка «Коротко:» не показывается
  const descrHtml = s => esc(String(s ?? '').replace(/^Коротко:.*(\n|$)/m, '').trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^([А-ЯЁ][а-яё ]{2,20}:)/gm, '<b>$1</b>');
  const money = v => Math.round(v).toLocaleString('ru-RU');
  // v5.58: «📎 Анализ подборки» (галочка при создании) — вид «A + C» (aimd.js); номер в анализе ведёт к карточке объекта на этой странице, мини-фото — из подборки
  const anHtml = d => { if (!d?.analysis || !window.AIMD) return ''; window.__SAN = d.items ?? [];
    return `<section class="s-an"><h2>📊 Анализ подборки</h2>${window.AIMD.md(d.analysis)}${d.analysis_agent ? `<details class="s-an-ag" open><summary>🔒 Только для вас — клиент этого не видит</summary>${window.AIMD.md(d.analysis_agent)}</details>` : ''}</section>`; };
  const anFill = () => document.querySelectorAll('.s-an .objm-th img:not([src])').forEach(im => { const x = (window.__SAN ?? []).find(y => +y.num === +im.parentElement.dataset.obj); if (x?.photos?.[0]) im.src = x.photos[0]; else im.parentElement.style.visibility = 'hidden'; });
  new MutationObserver(() => { if (document.querySelector('.s-an .objm-th img:not([src])')) anFill(); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', e => { const a = e.target.closest('.s-an a.objlink, .s-an .objm-th'); if (!a) return; e.preventDefault(); e.stopPropagation();
    const c = document.querySelector(`[data-num="${a.dataset.obj}"]`); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.add('s-an-hl'); setTimeout(() => c.classList.remove('s-an-hl'), 1600); } }, true);
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const seaTxt = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  const hs = location.hash.slice(1), t = hs.split(/[?&]/)[0];
  // v5.20: страница агента — #<токен>&a=1 или #id=<номер подборки>&a=1 (подборка только с PDF): собственники, написать всем, позвонить
  const agentMode = /(^|[?&])a=1(&|$)/.test(hs), selId = +(/(?:^|[?&])id=(\d+)/.exec(hs)?.[1] || 0);
  let tok = null;
  try { tok = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }

  // v5.48 H: метка браузера для ссылки «Самоподбор» (≤ 2 устройства на ссылку): 24 случайных знака в localStorage; на остальных подборках сервер её не читает
  let memDev = null;
  const devId = () => {
    try { const v = localStorage.getItem('pick_dev'); if (/^[a-z0-9]{24}$/.test(v || '')) return v; } catch { /* приватный режим */ }
    memDev = memDev || Array.from(crypto.getRandomValues(new Uint8Array(24)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
    try { localStorage.setItem('pick_dev', memDev); } catch { /* только до закрытия страницы */ }
    return memDev;
  };
  async function call(action, { _fn, ...extra } = {}) {
    const body = JSON.stringify({ action, t, dev: devId(), ...(selId ? { id: selId } : {}), ...(typeof tok === 'string' ? { auth: { token: tok } } : {}), ...extra });
    const url = _fn === 'auto' ? String(window.API).replace(/\/web$/, '/auto') : window.API;
    for (let i = 0; ; i++) {   // первое соединение иногда обрывается — один повтор
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
        if (!r.ok || d.error) throw Object.assign(new Error(d.message || 'Ошибка'), { data: d });
        return d;
      } catch (e) { if (e.data || i) throw e.data ? e : new Error('Нет связи — проверьте интернет и обновите страницу'); }
    }
  }
  function toast(m, ms = 2600) { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
  const fail = (m, h = 'Подборка недоступна') => { $('#s-app').innerHTML = `<div class="s-empty"><h1>${esc(h)}</h1><p class="muted">${esc(m)}</p></div>`; };

  const digits = p => String(p ?? '').replace(/\D/g, '');
  const intl = p => { let d = digits(p); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d.length >= 11 ? d : ''; };   // 8 918… → 7918…

  // v5.23e: свои рисованные значки (как design.js) и заглушка «Фото нет» — одна на странице клиента и агента (раньше у клиента — чёрная плашка)
  const ic = d => `<i class="mi sa-ic" data-e="" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></i>`;
  const HOME = 'M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z';
  const noPhoto = () => `<div class="sa-noph" role="img" aria-label="Фото нет">${ic(HOME)}<span>Фото нет</span></div>`;
  // v5.20: фото листаются, как на главной: стрелки, точки, свайп пальцем; на компьютере — ведёшь мышкой по фото; нажатие — на весь экран
  const gal = (photos, i) => photos.length ? `<div class="s-gal"><div class="s-ph" data-i="${i}">${photos.map((u, k) => `<div class="s-im"><img src="${esc(u)}" alt="Фото ${k + 1}" loading="${i < 2 && !k ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" crossorigin="anonymous" data-k="${k}"></div>`).join('')}</div>
      ${photos.length > 1 ? `<button type="button" class="s-nav l" data-nav="-1" aria-label="Предыдущее фото">‹</button><button type="button" class="s-nav r" data-nav="1" aria-label="Следующее фото">›</button>
      <div class="s-dots">${photos.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div><span class="s-cnt">${photos.length} фото</span>` : ''}</div>` : noPhoto();
  // v5.23d: вертикальное фото — целиком на размытом фоне (как на главной), горизонтальное — на всю рамку; низ 1/20 срезан у всех.
  // Чёрные поля по краям кадра (стоп-кадр из видео) обрезаются, чтобы в рамке не было чёрных полос
  function bands(im) {
    const w = im.naturalWidth, h = im.naturalHeight, sw = 48, sh = Math.max(8, Math.round(sw * h / w));
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, sw, sh);
    const px = g.getImageData(0, 0, sw, sh).data, lum = (x, y) => { const o = (y * sw + x) * 4; return px[o] * .3 + px[o + 1] * .59 + px[o + 2] * .11; };
    const dark = (len, at) => { for (let j = 0; j < len; j++) if (at(j) > 34) return false; return true; };
    const row = y => dark(sw, x => lum(x, y)), col = x => dark(sh, y => lum(x, y));
    let t = 0, b = 0, l = 0, r = 0;
    while (t < sh / 2 && row(t)) t++;
    while (b < sh / 2 - t && row(sh - 1 - b)) b++;
    while (l < sw / 2 && col(l)) l++;
    while (r < sw / 2 - l && col(sw - 1 - r)) r++;
    if ((t + b) / sh < .04 && (l + r) / sw < .04) return null;   // полос нет — фото как есть
    if (t + b > sh * .6 || l + r > sw * .6) return null;         // тёмное фото, а не поля
    const px2 = (n, k) => n ? Math.ceil((n + 1) * k) : 0;          // +1 строка — край поля размыт сжатием JPEG
    const x = px2(l, w / sw), y = px2(t, h / sh);
    return { x, y, w: w - x - px2(r, w / sw), h: h - y - px2(b, h / sh) };
  }
  function cut(im) {
    try {
      const z = bands(im); if (!z || z.w < 40 || z.h < 40) return false;
      const c = document.createElement('canvas'); c.width = z.w; c.height = z.h;
      c.getContext('2d').drawImage(im, z.x, z.y, z.w, z.h, 0, 0, z.w, z.h);
      im.dataset.src = im.src; im.src = c.toDataURL('image/jpeg', .9);   // data: — разрешён правилами страницы (blob: — нет)
      return true;
    } catch { return false; }   // фото без разрешения на чтение — показываем как есть
  }
  function fit(im) {
    const box = im.parentElement, fw = box.clientWidth || 4, fh = box.clientHeight || 3;
    const tall = im.naturalWidth / (im.naturalHeight * .95) < fw / fh * .8;   // в рамке осталось бы меньше 80 % высоты фото
    box.classList.toggle('tall', tall);
    if (tall) box.style.setProperty('--bg', `url("${im.src}")`);
  }
  document.addEventListener('load', e => {
    const im = e.target;
    if (im.tagName !== 'IMG' || !im.parentElement?.classList.contains('s-im')) return;
    if (!im.dataset.cut) { im.dataset.cut = 1; if (cut(im)) return; }   // обрезали — придёт новый load уже с обрезанным фото
    fit(im);
  }, true);
  // хранилище не дало разрешения на чтение — грузим фото обычным способом (без обрезки полос)
  document.addEventListener('error', e => {
    const im = e.target;
    if (im.tagName !== 'IMG' || !im.parentElement?.classList.contains('s-im') || !im.crossOrigin) return;
    im.removeAttribute('crossorigin'); im.dataset.cut = 1; im.src = im.src;
  }, true);
  document.addEventListener('scroll', e => {
    const st = e.target; if (!st.classList?.contains('s-ph')) return;
    const k = Math.round(st.scrollLeft / st.clientWidth);
    st.parentElement.querySelectorAll('.s-dots i').forEach((d, j) => d.classList.toggle('on', j === k));
  }, true);
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', e => {
      const g = e.target.closest?.('.s-gal'), st = g?.querySelector('.s-ph'); if (!st || e.target.closest('[data-nav]')) return;
      const n = st.children.length; if (n < 2) return;
      const r = g.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
      if (g.dataset.k == k) return;
      g.dataset.k = k; st.scrollTo({ left: k * st.clientWidth, behavior: 'instant' });
    });
    document.addEventListener('mouseout', e => { const g = e.target.closest?.('.s-gal'); if (g && !g.contains(e.relatedTarget) && +g.dataset.k) { g.dataset.k = 0; g.querySelector('.s-ph').scrollTo({ left: 0, behavior: 'instant' }); } });
  }

  function card(x, i, n, pk) {   // pk — карточка ссылки «Самоподбор» (pick.js): свои кнопки ⭐ ✗ ❓ и «Ответ агента»
    const ph = gal(x.photos, i);
    const tags = [...x.tags, x.sea_m ? `≈ ${seaTxt(x.sea_m)} до моря` : null].filter(Boolean);
    return `<article class="s-card${x.mark ? ` m-${x.mark}` : ''}${pk ? ' p-card' : ''}" data-num="${x.num}">${ph}
      <div class="s-body">
        <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : 'цена по запросу'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
        <div class="s-place-row">${x.place ? `<p class="muted s-place"${data?.kind === 'excl' ? '' : ` data-map="${x.num}" title="Показать на карте"`}>${esc(x.place)}</p>` : ''}${data?.kind === 'excl' ? '' : `<button type="button" class="link s-onmap" data-map="${x.num}">📍 Посмотреть на карте</button>`}</div>
        ${tags.length ? `<div class="s-tags">${tags.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        ${x.gone ? '<p class="s-gone">Объявление снято с продажи — уточните у агента.</p>' : ''}
        ${x.video ? `<video class="s-video" src="${esc(x.video)}" controls playsinline preload="metadata"></video>` : ''}
        ${x.descr ? `<p class="s-descr">${descrHtml(x.descr)}</p><button type="button" class="btn ghost s-more" hidden>Развернуть</button>` : ''}
        ${pk ? pickFb(x) : `<div class="s-fb">
          <div class="s-marks" role="group" aria-label="Подходит ли объект">
            <button type="button" class="s-yes" data-mark="yes" aria-pressed="${x.mark === 'yes'}">✓ Подходит</button>
            <button type="button" class="s-no" data-mark="no" aria-pressed="${x.mark === 'no'}">✗ Не подходит</button>
          </div>
          <input class="s-cm" type="text" maxlength="300" value="${esc(x.comment)}" placeholder="Напишите, что нравится, а что нет" aria-label="Комментарий к объекту ${i + 1}" enterkeyhint="done">
          <small class="s-st muted" aria-live="polite"></small>
        </div>`}
        <small class="muted s-no-num">${pk ? '' : `${i + 1} из ${n} · `}№ ${x.num}</small>
      </div></article>`;
  }

  // кнопки клиента на ссылке pick: ⭐ «Хочу посмотреть» (yes), ✗ «Не подходит» (no), ❓ «Вопрос» (строка до 300 знаков, сохраняется сразу)
  const pickFb = x => `<div class="s-fb p-fb">
          <div class="p-marks" role="group" aria-label="Ваш выбор">
            <button type="button" class="p-yes" data-pm="yes" aria-pressed="${x.mark === 'yes'}">⭐ Хочу посмотреть</button>
            <button type="button" class="p-no" data-pm="no" aria-pressed="${x.mark === 'no'}">✗ Не подходит</button>
            <button type="button" class="p-ask" data-pm="q" aria-pressed="${!!x.comment}" aria-expanded="${!!x.comment}">❓ Вопрос</button>
          </div>
          <div class="p-q"${x.comment ? '' : ' hidden'}><textarea class="p-cm" rows="2" maxlength="300" placeholder="Напишите вопрос по этому объекту — до 300 знаков" aria-label="Вопрос по объекту № ${x.num}" enterkeyhint="done">${esc(x.comment)}</textarea><small class="s-st muted" aria-live="polite"></small></div>
          ${x.answer ? `<div class="p-ans"><b>Ответ агента</b><p>${esc(x.answer)}</p></div>` : ''}
        </div>`;
  let data = null;
  function render(d) {
    data = d;
    document.title = d.title || 'Подборка объектов';
    const n = d.items.length, tel = intl(d.agent_phone);
    $('#s-app').innerHTML = `
      ${d.owner ? `<div class="s-owner">Это ваша подборка — так её видит клиент. Ваши открытия не считаются и уведомления о них не приходят.${d.views != null ? ` Клиент открывал: ${d.views} ${plural(d.views, 'раз', 'раза', 'раз')}.` : ''}</div>` : ''}
      <header class="s-hero">
        <h1>${esc(d.title)}</h1>${d.intro ? `<p style="white-space:pre-wrap">${esc(d.intro)}</p>` : ''}${anHtml(d)}
        <p class="muted">Подборка от ${day(d.created_at)} · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · ссылка действует до ${day(d.until)}</p>
        ${d.agent || tel ? `<div class="s-agent">${d.agent_photo ? `<img class="s-agent-ph" src="${esc(d.agent_photo)}" alt="" width="48" height="48" loading="lazy">` : ''}<span>Ваш агент${d.agent ? `: <b>${esc(d.agent)}</b>` : ''}</span><span class="s-agent-btns">
          ${tel ? `<a class="btn soft" href="tel:+${tel}">Позвонить</a><a class="btn ghost" href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></div>` : ''}
        <p class="hint">Отметьте у каждого объекта ✓ «подходит» или ✗ «не подходит» и напишите, что нравится, а что нет, — агент увидит сразу.</p>
        ${n && d.kind !== 'excl' ? '<button type="button" class="btn soft s-allmap" data-map="all">🗺 Все объекты на карте</button>' : ''}
      </header>
      <div class="s-list">${d.items.map((x, i) => card(x, i, n)).join('') || '<p class="muted">В подборке нет объектов.</p>'}</div>`;
    // «Развернуть» — только у длинных описаний
    requestAnimationFrame(() => document.querySelectorAll('.s-descr').forEach(p => { if (p.scrollHeight - p.clientHeight > 10) p.nextElementSibling.hidden = false; }));
    marked();
  }
  // v5.31a: у клиента есть хотя бы одна отметка (✓, ✗ или комментарий) — promo.js показывает кнопку регистрации (если автор на бесплатных 7 днях);
  // после 3 отметок — мягкая подсказка «напишите агенту, что важно»
  function marked() {
    const n = data.items.filter(x => x.mark || x.comment).length;
    window.SEL_MARKED = n > 0;
    if (n) document.dispatchEvent(new CustomEvent('sel:mark', { detail: { n } }));
    if (n >= 3 && !$('#s-tip') && !data.owner) $('.s-list')?.insertAdjacentHTML('afterend', `<p class="hint s-tip" id="s-tip">Спасибо за отметки! Напишите агенту${data.agent ? ` (${esc(data.agent)})` : ''}, что для вас важнее всего — район, этаж, ремонт, бюджет, — и он подберёт точнее.</p>`);
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
      marked();
    } catch (e) { st.textContent = ''; toast(e.message, 5000); }
  }

  document.addEventListener('click', e => {
    const nv = e.target.closest('.s-gal [data-nav]');
    if (nv) { const st = nv.closest('.s-gal').querySelector('.s-ph'); st.scrollBy({ left: st.clientWidth * +nv.dataset.nav, behavior: 'smooth' }); return; }
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
    const mp = e.target.closest('[data-map]');
    if (mp) mapOpen(mp.dataset.map === 'all' ? null : +mp.dataset.map);
    if (e.target.closest('[data-mapx]') || e.target.classList.contains('s-map')) mapClose();
  });

  // ---------- v5.31a (п. 1 Алексея): карта подборки. Координаты — отдельным запросом sel_map и только при открытии карты.
  // v5.31f: адрес скрыт — одна отметка на улице ~200 м от дома (раньше: центр улицы и круг ~300 м и подпись «… (точный адрес — у агента)»; адрес открыт — точка объекта.
  let mapData = null, mapObj = null;
  const loadJs = src => new Promise((ok, no) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = no; document.head.appendChild(el); });
  async function leaflet() {
    if (!window.L) {
      document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="vendor/leaflet/leaflet.min.css">');
      await loadJs('vendor/leaflet/leaflet.min.js');
    }
    if (!window.MAPBASE) await loadJs('mapbase.js?v=5.31e1');
  }
  function mapClose() { const m = $('#s-map'); if (!m) return; mapObj?.remove(); mapObj = null; m.remove(); document.body.classList.remove('s-lock'); }
  // v5.48 H2: sel — номер объекта, список номеров (ссылка pick: «Подбор» — найденное клиентом) или null (все). Свои точки у sel_map только для выбранных/советов,
  // найденное в поиске сервер отдаёт по одному num (лимит 24, по 4 запроса сразу); ответ со списком не кэшируем
  const PK_COLORS = { yes: ['#d99a00', '⭐ хочет посмотреть'], q: ['#2f6fdf', '❓ вопрос'], no: ['#c0392b', '✗ не подходит'], adv: ['#7b3fe4', '🔗 советует агент'], none: ['#8a97a3', 'без отметки'] };
  const pkKind = p => p.mark === 'yes' ? 'yes' : p.mark === 'no' ? 'no' : p.q ? 'q' : p.advised ? 'adv' : 'none';
  let mapSeq = 0;
  async function mapOpen(sel) {
    const my = ++mapSeq;
    if (Array.isArray(sel) && sel.length === 1) sel = sel[0];
    const list = Array.isArray(sel) ? [...new Set(sel)].slice(0, 24) : null, num = list ? null : sel;
    mapClose();
    document.body.insertAdjacentHTML('beforeend', `<div class="s-map" id="s-map" role="dialog" aria-modal="true" aria-label="Карта"><div class="s-map-box">
      <div class="s-map-head"><b>${num ? `📍 № ${num} на карте` : list ? `🗺 Найденные объекты на карте (${list.length})` : '🗺 Объекты подборки на карте'}</b><button type="button" class="s-x2" data-mapx aria-label="Закрыть карту">✕</button></div>
      <div class="s-map-el" id="s-map-el"><p class="muted s-map-wait">Загружаю карту…</p></div><p class="s-map-note muted" id="s-map-note" aria-live="polite"></p></div></div>`);
    document.body.classList.add('s-lock');
    // телефон: закрыть свайпом вниз по шапке окна
    const hd = $('#s-map .s-map-head'); let y0 = null;
    hd.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    hd.addEventListener('touchend', e => { if (y0 != null && e.changedTouches[0].clientY - y0 > 70) mapClose(); y0 = null; });
    try {
      // v5.48 H (M2): ссылка pick — объект из поиска клиента (ещё не в ответе sel_map) просим отдельно с num; такой ответ не кэшируем — «все на карте» остаются выбранными
      const pickNum = data?.kind === 'pick' && !agentMode && num && !(mapData?.points.some(p => p.num === num));
      const [, md] = await Promise.all([leaflet(), list && data?.kind === 'pick' && !agentMode ? { points: [] } : !pickNum && mapData && !mapData.points.some(p => p.kind === 'later') ? mapData : call(agentMode?'sel_map_agent':'sel_map',agentMode?{id:data.id}:pickNum?{num}:{})]);
      if (my !== mapSeq) return;
      if (!pickNum && !list) mapData = md;
      if (!$('#s-map')) return;
      let draw = md;
      if (list && data?.kind === 'pick' && !agentMode) {   // одним запросом: сервер оставит только разрешённые номера, улицы без адреса
        const r = await call('sel_map', { nums: list }).catch(() => null);
        if (my !== mapSeq || !$('#s-map')) return;
        draw = r ? { ...r, partial: list.some(n => !(r.points ?? []).some(p => p.num === n)) } : { points: [], partial: true };
      }
      drawMap(list ?? num, draw);
    } catch (e) { const el = $('#s-map-el'); if (el) el.innerHTML = `<p class="muted s-map-wait">${esc(e.message || 'Карта не загрузилась')}</p>`; }
  }
  function drawMap(sel, md = mapData) {
    const el = $('#s-map-el'); el.innerHTML = '';
    const list = Array.isArray(sel) ? sel : null, num = list ? null : sel, pk = data?.kind === 'pick' && agentMode;
    const byNum = new Map(data.items.map(x => [x.num, x])), pts = md.points.filter(p => list ? list.includes(p.num) : !num || p.num === num);
    const ok = pts.filter(p => p.lat != null);
    mapObj = L.map(el, { zoomControl: true, attributionControl: false, maxZoom: 19 }).setView([43.585, 39.723], 11);   // центр сразу: круги и точки без него не рисуются
    // v5.31e: источник карты — свёрнутый «ⓘ», как на главной (MAPBASE сам подставит «Яндекс Карты», если подложка Яндекса)
    const Info = L.Control.extend({ options: { position: 'bottomleft' }, onAdd() {
      const d = L.DomUtil.create('div', 'map-info');
      d.innerHTML = '<button type="button" aria-label="Источник карты" title="Источник карты">ⓘ</button><span hidden>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></span>';
      L.DomEvent.disableClickPropagation(d);
      d.querySelector('button').onclick = () => { const t = d.querySelector('span'); t.hidden = !t.hidden; };
      return d;
    } });
    new Info().addTo(mapObj);
    // ревью 05.11: серый прямоугольник на телефоне — окно ещё меняло размер; пересчитать размер карты, когда окно встало, и повторить плитки при ошибке
    Promise.resolve(MAPBASE.add(mapObj)).then(layer => layer?.on?.('tileerror', e => { const t = e.tile, k = +(t.dataset.retry || 0);
      if (k < 2) setTimeout(() => { t.dataset.retry = k + 1; t.src = t.src.replace(/([?&])r=\d+/, '').replace(/$/, (t.src.includes('?') ? '&' : '?') + 'r=' + (k + 1)); }, 600 * (k + 1)); })).catch(() => {});
    if (window.ResizeObserver) new ResizeObserver(() => mapObj?.invalidateSize()).observe(el);
    [60, 300, 900].forEach(ms => setTimeout(() => mapObj?.invalidateSize(), ms));
    const css = getComputedStyle(document.body), acc = css.getPropertyValue('--accent').trim() || '#2f6fdf';
    const info = x => x ? `${x.photos?.[0] ? `<img class="s-pop-im" src="${esc(x.photos[0])}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}<b>${esc(x.what)}</b><br>${x.price ? `${money(x.price)} ₽` : 'цена по запросу'}${x.sea_m ? ` · ≈ ${seaTxt(x.sea_m)} до моря` : ''}` : '';
    // объекты на одной улице — один круг со списком номеров
    const POPO = { maxWidth: 280, minWidth: 240, autoPanPadding: [14, 14] };   // v5.47 E: окно с фото, не за краем карты
    const groups = new Map();
    for (const p of ok) { const k = p.kind === 'street' ? `${p.lat},${p.lon}` : `n${p.num}`; groups.set(k, [...(groups.get(k) ?? []), p]); }
    const layers = [];
    for (const g of groups.values()) {
      const p = g[0], lines = g.map(q => `№ ${q.num}${pk ? ` ${PK_COLORS[pkKind(q)][1]}` : ''} — ${info(byNum.get(q.num))}`).join('<br>');
      if (p.kind === 'street') {
        // v5.31f (Алексей 06.11): адрес скрыт — без круга и без «точный адрес — у агента»: одна отметка на улице (~200 м от дома, сервер), подпись — улица и микрорайон
        const m = L.circleMarker([p.lat, p.lon], { radius: 9, color: '#fff', weight: 2, fillColor: pk ? PK_COLORS[pkKind(p)][0] : acc, fillOpacity: 1 }).addTo(mapObj)
          .bindPopup(`<div class="s-pop">${p.label ? `<p class="s-pop-st">${esc(p.label)}</p>` : ''}${lines}</div>`, POPO);
        if (p.label) m.bindTooltip(esc(p.label), { direction: 'top' });
        layers.push(m);
      } else {
        const m = L.circleMarker([p.lat, p.lon], { radius: 9, color: '#fff', weight: 2, fillColor: pk ? PK_COLORS[pkKind(p)][0] : acc, fillOpacity: 1 }).addTo(mapObj)
          .bindPopup(`<div class="s-pop">${lines}<br><small>${esc(p.label || '')}</small></div>`, POPO);
        layers.push(m);
      }
    }
    if (layers.length) {
      const b = L.featureGroup(layers).getBounds();
      if (layers.length === 1) mapObj.setView(b.getCenter(), 16); else mapObj.fitBounds(b.pad(.15), { maxZoom: 15 });
      if (num && layers.length === 1) layers[0].openPopup();
    }
    if (data?.kind === 'pick' && !agentMode) for (const n of list ?? (num ? [num] : [])) if (!pts.some(p => p.num === n)) pts.push({ num: n, kind: 'none' });   // v5.48 H: объект из поиска ещё не в ответе sel_map — «уточните у агента»
    const later = pts.filter(p => p.kind === 'later').length, none = pts.filter(p => p.kind === 'none').map(p => p.num);
    if (pk && ok.length) {   // v5.48 H2: агенту — легенда цветов по отметкам клиента
      const used = new Set(ok.map(pkKind));
      $('#s-map-el').insertAdjacentHTML('afterend', `<ul class="s-map-leg" aria-label="Цвета точек">${Object.entries(PK_COLORS).filter(([k]) => used.has(k)).map(([k, v]) => `<li><i style="background:${v[0]}"></i>${v[1]}</li>`).join('')}</ul>`);
    }
    $('#s-map-note').textContent = [   // v5.31e3: надпись «Агент скрыл точные адреса» убрана (Алексей 05.11)
      later ? `Расположение ещё ${later} ${plural(later, 'объекта', 'объектов', 'объектов')} уточняется — откройте карту через минуту.` : '',
      md.partial ? 'Часть точек не загрузилась.' : '',
      none.length ? `${none.length === 1 ? `Где находится № ${none[0]}` : `Где находятся № ${none.join(', ')}`} — уточните у агента.` : ''].filter(Boolean).join(' ');
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#s-map')) mapClose(); });
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
  function show() {
    const p = data.items[cur.i].photos; cur.k = (cur.k + p.length) % p.length;
    const el = document.querySelector(`.s-ph[data-i="${cur.i}"] img[data-k="${cur.k}"]`);   // уже без чёрных полей, если их обрезали
    $('#s-view img').src = el?.dataset.src ? el.src : p[cur.k];
  }
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

  // v5.48 H: pick.js рисует свою страницу, но карточку, карту и просмотр фото берёт отсюда. setData — общий список объектов страницы (индекс = data-i у фото)
  window.SEL = { gal, cardHtml: (x, i, pk) => card(x, i, 0, pk), openMap: n => mapOpen(n), mapReset: () => { mapData = null; },
    setData: d => { data = d; }, esc, money, day, plural, intl, toast, marked: () => {}, fit: () => document.querySelectorAll('.s-descr').forEach(p => { if (p.scrollHeight - p.clientHeight > 10) p.nextElementSibling.hidden = false; }) };
  addEventListener('hashchange', () => location.reload());   // вставили другую ссылку в ту же вкладку
  if (agentMode) AGENT();
  else if (!/^[A-Za-z0-9_-]{22,40}$/.test(t)) fail('В ссылке нет кода подборки — попросите агента прислать её ещё раз.');
  else call('sel_public').then(d => d.kind === 'pick' && window.PICK ? window.PICK.client(d, call) : render(d), e => window.PICK && e.data?.kind === 'pick' && ['expired', 'device', 'day'].includes(e.data?.error) ? window.PICK.stop(e.data, t) : fail(e.message, e.data?.error === 'deleted' ? 'Подборка удалена агентом' : undefined));

  // ---------- v5.20 → v5.23a: страница агента — собственники подборки, ответы, переписка, проверенная подборка ----------
  // Отметки «написал» и ответы — на сервере (auto own_marks / own_mark / own_chat / own_reply), проверка ответов — сервер мессенджеров:
  // через 30, 60, 90, 120 мин и через 12 ч после сообщения. Заметка — та же, что на главной (web note).
  function AGENT() {
    document.body.classList.add('sa');
    const fail2 = (h, m) => { $('#s-app').innerHTML = `<div class="s-empty"><h1>${esc(h)}</h1><p class="muted">${esc(m)}</p><a class="btn soft" href="./">На сайт</a></div>`; };
    if (typeof tok !== 'string') return fail2('Нужен вход', 'Откройте ссылку там, где вы вошли на сайт «Для Агента», — страница с телефонами собственников видна только вам.');
    if (!selId && !/^[A-Za-z0-9_-]{22,40}$/.test(t)) return fail2('Подборка не найдена', 'В ссылке нет кода подборки — откройте её из «Моих подборок».');
    const KEY = `sa:${selId || t.slice(0, 12)}`, TKEY = 'saText', OKEY = 'saOpen', FKEY = 'saFilter';
    // v5.24: без {имя} (имена собственников приходят редко), с {ЖК}; № объекта дописывается сам (auto/own.ts ownText) — тот же текст и здесь
    const TPL = 'Здравствуйте! Я агент, у меня есть покупатель на ваш объект {ЖК}, {адрес}, {цена}. Продажа актуальна?';
    const OLD_TPL = 'Здравствуйте, {имя}! Я агент, у меня есть покупатель на ваш объект {адрес}, {цена}. Продажа актуальна?';
    // v5.31a (п. 2 Алексея): «Написать собственникам по отмеченным клиентом» — шаблон с вопросом клиента; {вопрос} — комментарий клиента к этому объекту
    // (без ссылок и телефонов, до 200 знаков), без комментария — «когда можно посмотреть и торг возможен?». Та же подстановка на сервере (auto/own.ts ownText)
    const QTPL = 'Здравствуйте! По вашему объекту {ЖК}, {адрес}, {цена}: у меня покупатель, ему понравилось. Уточните, пожалуйста: {вопрос}. Продажа актуальна?';
    const VIDEO_ASK = 'Если есть видео квартиры — пришлите, пожалуйста: так покупателю проще решиться на просмотр.';
    const cleanQ = c => { let q = String(c ?? '').replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
      .replace(/(^|[\s(«"])(?:[a-zа-я0-9-]+\.)+(?:ru|рф|su|com|me|org|net|io|ly|link|app|info|biz|pro|online|site|club|chat|to|cc|tv|gg)(?:\/\S*)?/gi, '$1').replace(/(^|[^\w])@[\w.]{2,}/g, '$1')
      .replace(/(?:\+7|8)?[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}(?!\d)/g, '').replace(/\s+/g, ' ').trim();
      if (q.length > 200) q = q.slice(0, 199).replace(/\s+\S*$/, '') + '…'; q = q.replace(/(^|\s)(звоните|пишите|тел\.?|телефон)[\s:.!]*$/i, '').replace(/[.!,;:\s]+$/, '');
      if (q && !/\?$/.test(q) && /^(как|где|когда|сколько|почему|зачем|что|чем|кто|чей|есть ли|можно ли|будет ли)(\s|$)|\sли\s/i.test(q)) q += '?'; return q ? q[0].toLowerCase() + q.slice(1) : ''; };   // как cleanQ в auto/own.ts
    const liked = x => x.cmark === 'yes', asked = x => !!x.ccomment && x.cmark !== 'no', clPick = x => liked(x) || asked(x);
    const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
    const SV = { tg: 'Telegram', wa: 'WhatsApp', max: 'MAX' };
    const selArg = () => selId ? { sel_id: selId } : {};
    const I = { mail: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM4 6.5l8 6.5 8-6.5',
      eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
      note: 'M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20zM14.5 3.5v4.5H19M9 12h6M9 15.5h6', check: 'M4.5 12.5 9.5 17.5 19.5 6.5' };
    const unpicked = new Set();
    let svcs = null, job = null, marks = {}, filter = get(FKEY, 'all');
    // v5.31a: #…&a=1&f=liked | q | cl — из «Моих подборок» / помощника ИИ: сразу фильтр и выбор «отмеченные клиентом»
    const fHash = /(?:^|[?&])f=(liked|q|cl)(?:&|$)/.exec(hs)?.[1] ?? null;
    let cpick = !!fHash; if (fHash) filter = fHash; else if (['liked', 'q', 'cl'].includes(filter)) filter = 'all';
    const cpList = () => data.items.filter(clPick);
    const opened = new Set(get(`${KEY}:o`, [])), allOpen = () => !!get(OKEY, false);
    const short = a => String(a ?? '').replace(/^(г\.?\s*о\.?\s*)?Сочи,?\s*/i, '').replace(/мкр-н\s+[^,]+,\s*/i, '').trim();
    const fill = (tx, x) => tx.replace(/\{вопрос\}/gi, () => cleanQ(x.ccomment) || 'когда можно посмотреть и торг возможен?').replace(/,?\s*\{имя\}/gi, '').replace(/\{ЖК\}/gi, x.zk ? `ЖК «${x.zk}»` : '')
      .replace(/\{адрес\}/g, short(x.address) || x.what).replace(/\{цена\}/g, x.price ? `${money(x.price)} ₽` : '').replace(/\{объект\}/g, x.what)
      .replace(/(Здравствуйте|Добрый день),\s*!/g, '$1!').replace(/\s+([,.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/(объекту?|квартиру)\s*,/g, '$1').replace(/\?\./g, '?').replace(/ {2,}/g, ' ').trim()
      + (data?.kind !== 'excl' && !marks[x.num]?.wrote && !/видео/i.test(tx) ? `\n\n${VIDEO_ASK}` : '') + `\n\n№ ${x.num}`;   // v5.31a: в первое сообщение — просьба о видео
    // сохранённый текст со старым шаблоном — на новый; свой текст — без {имя}
    { const v = get(TKEY, null); if (v === OLD_TPL) put(TKEY, TPL); else if (typeof v === 'string' && /\{имя\}/i.test(v)) put(TKEY, v.replace(/,?\s*\{имя\}/gi, '').replace(/(Здравствуйте|Добрый день),\s*!/g, '$1!')); }
    const text = () => $('#sa-text')?.value.trim() || TPL;
    const copyTxt = async v => { try { await navigator.clipboard.writeText(v); return true; } catch { return false; } };
    const tm = s => { const d = new Date(s), now = new Date(), o = { timeZone: 'Europe/Moscow' };
      const dd = x => x.toLocaleDateString('ru-RU', o), hm = d.toLocaleTimeString('ru-RU', { ...o, hour: '2-digit', minute: '2-digit' });
      if (dd(d) === dd(now)) return hm;
      if (dd(d) === dd(new Date(Date.now() + 864e5))) return `завтра в ${hm}`;
      if (dd(d) === dd(new Date(Date.now() - 864e5))) return `вчера в ${hm}`;
      return `${d.toLocaleDateString('ru-RU', { ...o, day: 'numeric', month: 'short' })} ${hm}`; };
    const kind = st => st === 'yes' ? 'yes' : st === 'no' || st === 'sold' ? 'no' : st === 'none' ? 'none' : st === 'wait' ? 'wait' : '';
    const fmtPh = d => `+${d.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5')}`;
    const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

    // v5.23e: время настоящего ответа собственника — replied_at (новое поле own_marks), у прежнего сервера at = replied_at ?? sent_at
    const repAt = m => m?.replied_at ?? (m?.at && m.at !== m.sent_at ? m.at : null);
    // ручной итог ✓ и ✗ — одинаково; sent_at === undefined — отметка из sel_agent (own_marks ещё не пришли): итог ✓/✗ — ответ
    const answered = m => !!m && (!!repAt(m) || ((!!m.manual || m.sent_at === undefined) && ['yes', 'no', 'sold'].includes(m.st)));
    const when = m => m.manual ? (repAt(m) ? `${tm(repAt(m))} · итог отмечен вами` : 'отмечено вами') : m.at ? tm(m.at) : '';
    // статус собственника на карточке: ✓ зелёный — ответил, ✗ красный — не актуально / продано, ✗ серый — не ответил, ⏳ — ждём
    function stHtml(m) {
      if (!m) return '';
      const q = m.text ? `: «${esc(clip(m.text, 90))}»` : '';
      if (m.st === 'yes') return `<div class="sa-res yes">✓ Ответил${q}<small>${when(m)}</small></div>`;
      if (m.st === 'sold') return `<div class="sa-res no">✗ Продано${q}<small>${when(m)}</small></div>`;
      if (m.st === 'no') return `<div class="sa-res no">✗ Не актуально${q}<small>${when(m)}</small></div>`;
      if (m.st === 'none') return `<div class="sa-res none">✗ Не ответил<small>проверил ${m.checks || 5} раз, последний — через 12 ч</small></div>`;
      return `<div class="sa-res wait">⏳ Ждём ответа${m.err ? `<small class="sa-err">${esc(m.err)}${/подключите/.test(m.err) ? ' · <a href="hub.html#msg">подключить</a>' : ''}</small>`
        : m.next ? `<small>проверю ${/^завтра|^вчера|\s/.test(tm(m.next)) ? tm(m.next) : `в ${tm(m.next)}`}</small>` : ''}</div>`;
    }
    // v5.23e: как в прежнем PDF агенту — «Уникальна» / «Есть в рекламе» и ссылка на объявление «Проверить в рекламе», ещё ссылки — мелко «2», «3»
    function adHtml(x) {
      const t = x.ad_state === 'unique' ? '<span class="tag ok">Уникальна</span>' : x.ad_state === 'ads' ? '<span class="tag grey">Есть в рекламе</span>' : '';
      const L = (x.src ?? []).map((s, k) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"${k ? ' class="src-n" title="Ещё одна ссылка на объявление"' : ''}>${k ? k + 1 : 'Проверить в рекламе'}</a>`).join('');
      return t || L ? `<div class="sa-ad">${t}${L ? `<span class="src">${L}</span>` : ''}</div>` : '';
    }
    function row(x, i) {
      const d = intl(x.phone), m = marks[x.num], k = kind(m?.st), open = opened.has(x.num) !== allOpen();
      const st = job?.items?.find(j => j.num === x.num);
      return `<article class="sa-card${k ? ` sa-${k}` : ''}${open ? ' sa-open' : ''}" data-num="${x.num}">${x.photos?.length ? gal(x.photos, i) : noPhoto()}
        <div class="sa-body">
          <label class="chk"><input type="checkbox" data-action-pick value="${x.num}" ${unpicked.has(x.num) ? "" : "checked"}> Выбрать для действия</label>
          <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : '—'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
          ${x.place ? `<p class="muted s-place"${data?.kind === 'excl' ? '' : ` data-map="${x.num}" title="Показать на карте"`}>${esc(x.place)}</p>` : ''}
          ${x.gone ? '<p class="s-gone">Снято с продажи</p>' : ''}
          ${adHtml(x)}
          ${x.cmark || x.ccomment ? `<div class="sa-cfb">${x.cmark === 'yes' ? '<b class="t-ok">👍 Клиенту подходит</b>' : x.cmark === 'no' ? '<b class="t-bad">👎 Клиенту не подходит</b>' : '<b>💬 Вопрос клиента</b>'}${x.ccomment ? ` <span>«${esc(clip(x.ccomment, 160))}»</span>` : ''}</div>` : ''}
          ${stHtml(m)}
          ${st && !st.ok ? `<div class="sa-res no">✗ Не отправлено: ${esc(st.error || 'ошибка')}</div>` : ''}
          <div class="sa-more">
            <div class="sa-owner"><span>👤 <b>${esc(x.owner || 'Собственник')}</b></span>${d ? `<a class="sa-ph" href="tel:+${d}">${fmtPh(d)}</a>` : '<span class="muted">телефон не открыт</span>'}</div>
            ${x.tags?.length ? `<div class="s-tags">${x.tags.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
            ${x.descr ? `<div class="sa-descr">${descrHtml(x.descr)}</div>` : '<p class="muted">Описания нет.</p>'}
            ${x.note ? `<p class="sa-mynote"><b>Ваша заметка:</b> ${esc(x.note)}</p>` : ''}
          </div>
          <button type="button" class="link sa-tgl" data-tgl aria-expanded="${open}">${ic(I.eye)}${open ? 'Скрыть описание и контакты' : 'Показать описание и контакты'}</button>
          <div class="sa-btns">${d ? `<a class="btn primary" href="tel:+${d}">📞 Позвонить</a>
            <a class="btn soft sa-wa" href="https://wa.me/${d}?text=${encodeURIComponent(fill(text(), x))}" target="_blank" rel="noopener" data-w="wa">WhatsApp</a>
            <a class="btn soft sa-tg" href="https://t.me/+${d}" target="_blank" rel="noopener" data-w="tg" data-cp>Telegram</a>
            <a class="btn soft sa-max" href="https://web.max.ru/" target="_blank" rel="noopener" data-w="max" data-cp data-cpph>MAX</a>`
            : `<button type="button" class="btn soft sa-wide" data-open>📞 Открыть телефон</button>`}
            <button type="button" class="btn ghost sa-note-b" data-note>${ic(I.note)}Переписка${m?.unseen ? '<i class="sa-dot" title="Новый ответ"></i>' : ''}</button>
            ${d ? `<button type="button" class="btn ghost sa-mark" data-done aria-pressed="${!!m?.wrote}">${m?.wrote ? '✓ Написал' : 'Отметить «написал»'}</button>` : ''}</div>
          <small class="muted s-no-num">${i + 1} из ${data.items.length} · № ${x.num}</small>
        </div></article>`;
    }
    const sendList = () => data.items.filter(x => !unpicked.has(x.num) && x.phone && (data.kind === 'excl' || !cpick || clPick(x)));
    // v5.67 (п. 2 Алексея): два способа отправки — «☁️ Сервер сервиса» (вход хранится на сервере) и «💻 Мой браузер» (расширение «Для Агента»,
    // вход агента в WhatsApp Web / Telegram Web / MAX в его браузере; компьютер включён — можно отправлять и с телефона)
    const here = () => !!document.documentElement.dataset.daExt;   // расширение стоит в ЭТОМ браузере
    // v5.69 (требование Алексея): «сначала свой компьютер» — способ решает общий модуль WAYS (ways.js): 💻 компьютер агента с расширением →
    // ☁️ сервер сервиса только по галочке агента → компьютер выключен — окно «Включите компьютер» (молча не шлём); ✋ вручную — всегда.
    function svcHtml() {
      const n = sendList().length;
      if (!svcs) return '<p class="muted">Проверяю подключённые мессенджеры…</p>';
      if (svcs.error) return `<p class="muted">Отправка всем сразу пока недоступна: ${esc(svcs.error)}</p>
        <a class="btn soft sa-conn" href="hub.html#msg">🔗 Подключить мессенджеры</a>`;
      const lbl = `${cpick && data.kind !== 'excl' ? 'отмеченным' : 'всем'} (${n})`, dis = n && !job?.live ? '' : ' disabled';
      const btns = ['tg', 'wa', 'max'].map(k => `<button type="button" class="btn soft" data-all="${k}"${dis}>${SV[k]} — ${lbl}</button>`).join('');
      setTimeout(() => window.WAYS?.box($('#sa-wy'), ['tg', 'wa', 'max'], { mass: true }), 0);
      return `<div class="sa-svcs">${btns}</div><div id="sa-wy"></div>
        ${svcs.day_left != null ? `<small class="muted">Сегодня можно отправить ещё ${svcs.day_left}. Сообщения уходят по одному с паузами, чтобы мессенджер не счёл их рассылкой. Ответы проверю сам: через 30, 60, 90 и 120 минут, затем через 12 часов.</small>` : ''}
        ${!cpick && n < data.items.length ? `<small class="muted">Написать можно только тем, чей телефон открыт (${n} из ${data.items.length}).</small>` : ''}`;
    }
    function jobHtml() {
      if (!job) return '';
      const S = { new: job.via === 'ext' ? 'ждёт компьютер с расширением (5 мин, потом — запасной способ)' : 'в очереди', run: 'идёт отправка', done: 'готово', stopped: 'остановлено', error: 'ошибка', manual: 'не ушло само — отправьте вручную' };
      const sw = (job.fb ?? []).some(f => f.to === 'srv') && job.via === 'srv' ? ' · браузер не отправил — перешёл на ☁️ сервер' : '';
      return `<div class="sa-job${job.status === 'done' ? ' ok' : ''}"><b>${job.via === 'ext' ? '💻 ' : job.status === 'manual' ? '✋ ' : ''}${SV[job.svc] ?? ''}: ${S[job.status] ?? esc(job.status)}</b>
        · отправлено ${job.sent ?? 0} из ${job.total ?? job.planned ?? 0}${job.failed ? ` · не ушло ${job.failed}` : ''}${sw}${job.message ? ` · ${esc(job.message)}` : ''}
        ${job.status === 'manual' && job.id ? ` <button type="button" class="btn primary sm" data-ma-manual="${job.id}">✋ Отправить вручную</button>` : ''}</div>`;
    }
    // сводка и фильтр: «Ответили 4 из 10 · актуально 3 · не актуально 1 · ждём 5»
    function sumHtml() {
      const all = data.items.length, c = { yes: 0, no: 0, none: 0, wait: 0 };
      data.items.forEach(x => { const k = kind(marks[x.num]?.st); if (k) c[k]++; });
      const wrote = c.yes + c.no + c.none + c.wait, ans = data.items.filter(x => answered(marks[x.num])).length;
      const nl = data.items.filter(liked).length, nq = data.items.filter(asked).length, ncl = cpList().length;
      const F = [['all', `Все ${all}`], ['yes', `✓ ${c.yes}`], ['no', `✗ ${c.no + c.none}`], ['wait', `Ждём ${c.wait}`],
        ...(nl ? [['liked', `👍 Подходит клиенту (${nl})`]] : []), ...(nq ? [['q', `💬 Есть вопрос (${nq})`]] : [])];
      return `<div class="sa-sum"><p>${wrote ? `Написали ${wrote} из ${all} · ответили ${ans} · <b class="t-ok">актуально ${c.yes}</b> · <b class="t-bad">не актуально ${c.no}</b>${c.none ? ` · не ответили ${c.none}` : ''} · ждём ${c.wait}`
          : 'Собственникам ещё не писали — напишите всем сразу или каждому кнопкой WhatsApp / Telegram / MAX.'}</p>
        ${ncl ? `<div class="sa-cl"><button type="button" class="btn primary" data-cpick aria-pressed="${cpick}">✉️ Написать собственникам по отмеченным клиентом (${ncl})</button>
          <button type="button" class="btn soft" data-selai>🤖 Позвать помощника ИИ</button></div>` : (data.items.some(x => x.cmark || x.ccomment) ? '<div class="sa-cl"><button type="button" class="btn soft" data-selai>🤖 Позвать помощника ИИ</button></div>' : '')}
        <div class="sa-flt" role="group" aria-label="Показать">${F.map(([k, l]) => `<button type="button" data-flt="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>
        <div class="sa-tools"><button type="button" class="btn ghost" data-tgl-all>${ic(I.eye)}${allOpen() ? 'Скрыть у всех описание и контакты' : 'Показать у всех описание и контакты'}</button>
          <button type="button" class="btn primary" data-checked${c.yes ? '' : ' title="Пока никто не ответил «актуально» — объекты можно выбрать вручную"'}>${ic(I.check)}Сформировать проверенную подборку${c.yes ? ` (${c.yes})` : ''}</button></div></div>`;
    }
    const shown = x => filter === 'all' || (filter === 'liked' ? liked(x) : filter === 'q' ? asked(x) : filter === 'cl' ? clPick(x)
      : kind(marks[x.num]?.st) === filter || (filter === 'no' && kind(marks[x.num]?.st) === 'none'));
    function listHtml() {
      const L = data.items.map((x, i) => shown(x) ? row(x, i) : '').join('');
      return L || `<p class="muted sa-nolist">${data.items.length ? 'В этом фильтре пока пусто.' : 'В подборке нет объектов.'}</p>`;
    }
    // ---------- v5.25b: страница агента у подборки эксклюзивов — агенты-коллеги, их контакты (по подписке), комиссия, «Написать всем» агентам ----------
    const TPLX = 'Здравствуйте! По вашему эксклюзиву {объект}, {ЖК}, {цена} на «Для Агента» — есть покупатель. Объект актуален? Комиссия — как указана?';
    const XKEY = 'saTextX', xpick = new Set(get(`${KEY}:x`, null) ?? []);
    const xOk = x => !x.mine && !x.gone && !!x.agent?.phone;   // кому можно написать
    const xSel = () => data.items.filter(x => xOk(x) && (!xpick.size || xpick.has(x.num)));
    const tgOf = a => a?.tg ? `https://t.me/${String(a.tg).replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')}` : a?.phone ? `https://t.me/+${intl(a.phone)}` : '';
    function xRow(x, i) {
      const a = x.agent, d = intl(a?.phone), w = intl(a?.wa || a?.phone), m = marks[x.num], k = kind(m?.st), tx = fill($('#sa-text')?.value.trim() || get(XKEY, TPLX), x);
      const who = x.mine ? '<p class="muted">Это ваш эксклюзив.</p>'
        : x.locked ? `<div class="sa-owner sa-xlock"><span>🔒 <b>Контакт агента — по подписке</b></span><a class="btn primary" href="pay.html">Оформить подписку</a></div>`
        : x.hidden || !a ? '<p class="muted">Агент скрыл контакт — напишите в чат подписчиков.</p>'
        : `<div class="sa-owner"><span>👤 <b>${esc(a.name)}</b>${a.company ? ` · ${esc(a.company)}` : ''}</span>${d ? `<a class="sa-ph" href="tel:+${d}">${fmtPh(d)}</a>` : ''}</div>`;
      const btns = x.mine || x.locked || x.hidden || !a ? '' : `<div class="sa-btns">${d ? `<a class="btn primary" href="tel:+${d}">📞 Позвонить</a>` : ''}
        ${w ? `<a class="btn soft sa-wa" href="https://wa.me/${w}?text=${encodeURIComponent(tx)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${tgOf(a) ? `<a class="btn soft sa-tg" href="${esc(tgOf(a))}" target="_blank" rel="noopener" data-xcp>Telegram</a>` : ''}
        ${d ? `<a class="btn soft sa-max" href="https://web.max.ru/" target="_blank" rel="noopener" data-max="${d}" data-xcp>MAX</a>` : ''}
        ${xOk(x) ? `<label class="sa-xpick"><input type="checkbox" data-xpick="${x.num}"${!xpick.size || xpick.has(x.num) ? ' checked' : ''}> в «Написать всем»</label>` : ''}</div>`;
      return `<article class="sa-card sa-open${k ? ` sa-${k}` : ''}" data-num="${x.num}">${x.photos?.length ? gal(x.photos, i) : noPhoto()}
        <div class="sa-body">
          <label class="chk"><input type="checkbox" data-action-pick value="${x.num}" ${unpicked.has(x.num) ? "" : "checked"}> Выбрать для действия</label>
          <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : '—'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
          ${x.place ? `<p class="muted s-place"${data?.kind === 'excl' ? '' : ` data-map="${x.num}" title="Показать на карте"`}>${esc(x.place)}</p>` : ''}
          ${x.gone ? '<p class="s-gone">Снято с размещения</p>' : ''}
          ${x.video ? `<video class="s-video" src="${esc(x.video)}" controls playsinline preload="metadata"></video>` : ''}
          ${x.comm ? `<div class="sa-ad"><span class="tag ok">🤝 Комиссия коллеге: ${esc(x.comm)}</span>${x.comm_note ? `<small class="muted">${esc(x.comm_note)}</small>` : ''}</div>` : ''}
          ${stHtml(m)}
          ${who}
          ${x.descr ? `<details class="sa-xd"><summary>Описание</summary><div class="sa-descr">${descrHtml(x.descr)}</div></details>` : ''}
          ${btns}
          <small class="muted s-no-num">${i + 1} из ${data.items.length} · 💎 № ${x.num}</small>
        </div></article>`;
    }
    function xDraw() {
      const n = data.items.length, ok = data.items.filter(xOk).length, ags = new Set(data.items.filter(xOk).map(x => intl(x.agent.phone))).size;
      data.items.forEach(x => { x.phone = xOk(x) && (!xpick.size || xpick.has(x.num)) ? x.agent.phone : null; });   // для «Написать всем» (svcHtml считает x.phone)
      $('#s-app').innerHTML = `<header class="s-hero">
          <a class="link sa-back" href="./#sels=ex">← Подборки эксклюзивов</a>
          <div class="sa-only" role="note">🔒 Это ссылка для вас (агента) — клиенту её не отправляйте: здесь контакты коллег и комиссия. Клиенту — «Ссылка для клиента».</div>
          <h1>${esc(data.title)}</h1>${data.intro ? `<p style="white-space:pre-wrap">${esc(data.intro)}</p>` : ''}${anHtml(data)}${data.editable ? `<button type="button" class="btn soft" data-map="all">🗺 На карте</button> <button type="button" class="btn soft" data-edit-selection>✎ Править подборку</button> <button type="button" class="btn soft" data-selection-pdf>PDF с правками</button> <a class="btn soft" href="mail.html?selection=${data.id}">✉️ В рассылку</a>` : ''}
          <p class="muted">💎 Эксклюзивы коллег · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · агентов: ${ags} · цены агентов</p>
        </header>
        ${data.can_view ? `<section class="sa-box">
          <label class="sa-lbl" for="sa-text">Сообщение агентам ${ic(I.mail)}</label>
          <textarea id="sa-text" rows="3" maxlength="600">${esc(get(XKEY, TPLX))}</textarea>
          <small class="muted">{объект}, {ЖК} и {цена} подставятся у каждого объекта; в конце — № эксклюзива. Одному агенту — одно сообщение (все его объекты подборки). <button type="button" class="link" data-tplx>Вернуть шаблон</button></small>
          ${window.MSGAPP?.warn('агентам') ?? ''}
          <div class="sa-all"><div class="sa-h">Написать всем выбранным агентам сразу — с ваших аккаунтов</div><div id="sa-svc">${svcHtml()}</div><div id="sa-job">${jobHtml()}</div></div>
          ${ok ? '' : '<p class="muted">Написать некому: у объектов нет контактов агентов (или все объекты — ваши).</p>'}
        </section>` : `<section class="sa-box"><div class="sa-xlock-box"><b>🔒 Контакты агентов — по подписке</b><p>Подборку клиенту можно отправлять и без подписки. Чтобы видеть контакты коллег и писать им — оформите подписку.</p>
          <a class="btn primary" href="pay.html">Оформить подписку</a></div></section>`}
        <div class="sa-list">${data.items.map(xRow).join('') || '<p class="muted sa-nolist">В подборке нет объектов.</p>'}</div>`;
    }
    document.addEventListener('click', async e => {
      if (e.target.closest('[data-edit-selection]')) window.SELECTION_EDITOR?.open(data.id);
      const b = e.target.closest('[data-selection-pdf]');
      if (b) { b.disabled = true; try {const r = await call('sel_pdf', {id:data.id}); const a=document.createElement('a');a.href=r.url;a.target='_blank';a.rel='noopener';a.className='btn primary';a.textContent='Открыть готовый PDF';b.after(a);a.click();} catch(e) {toast(e.message, 6000);} finally {b.disabled=false;} }
    });
    function draw() {
      if (data.kind === 'excl') return xDraw();
      const n = data.items.length, wp = data.items.filter(x => x.phone).length, closed = n - wp;
      $('#s-app').innerHTML = `<header class="s-hero">
          <a class="link sa-back" href="./#sels">← Мои подборки</a>
          <div class="sa-only" role="note">🔒 Это ссылка для вас (агента) — клиенту её не отправляйте: здесь телефоны собственников и переписка с ними. Клиенту — «Ссылка для клиента» или проверенная подборка.</div>
          <h1>${esc(data.title)}</h1>${data.intro ? `<p style="white-space:pre-wrap">${esc(data.intro)}</p>` : ''}${anHtml(data)}${data.editable ? `<button type="button" class="btn soft" data-map="all">🗺 На карте</button> <button type="button" class="btn soft" data-edit-selection>✎ Править подборку</button> <button type="button" class="btn soft" data-selection-pdf>PDF с правками</button> <a class="btn soft" href="mail.html?selection=${data.id}">✉️ В рассылку</a>` : ''}${data.editable ? ` <button type="button" class="btn soft" data-client-link>🔗 Ссылка для клиента</button>` : ''}
          <p class="muted">Собственники подборки · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · телефон открыт у ${wp} · цены собственника</p>
        </header>
        <section class="sa-box">
          <label class="sa-lbl" for="sa-text">Сообщение собственникам ${ic(I.mail)}</label>
          <textarea id="sa-text" rows="3" maxlength="600">${esc(cpick ? get(`${TKEY}Q`, QTPL) : get(TKEY, TPL))}</textarea>
          <small class="muted">{ЖК}, {адрес}${cpick ? ', {цена} и {вопрос} (комментарий клиента)' : ' и {цена}'} подставятся у каждого собственника; в конце — № объекта в нашей базе. К сообщению — 1 фото квартиры; в первое сообщение собственнику — просьба прислать видео, если есть. <button type="button" class="link" data-tpl>Вернуть шаблон</button></small>
          ${cpick ? (() => { const L = cpList(), np = L.filter(x => x.phone).length; return `<div class="sa-cpb">✉️ Пишем только по объектам, которые клиент отметил «подходит» или о которых спросил: <b>${L.length}</b>${np < L.length ? ` · телефон открыт у ${np} — <button type="button" class="link" data-open-cl>📞 открыть остальные (${L.length - np})</button>` : ''}. <button type="button" class="link" data-cpick-off>Писать всем</button></div>`; })() : ''}
          ${window.MSGAPP?.warn('собственникам') ?? ''}
          <div class="sa-all"><div class="sa-h">Написать всем сразу — с ваших аккаунтов</div><div id="sa-svc">${svcHtml()}</div><div id="sa-job">${jobHtml()}</div></div>
          ${closed ? `<button type="button" class="btn soft sa-openall" data-open-all>📞 Открыть телефоны (${closed})</button>` : ''}
        </section>
        <div id="sa-actions"></div><div id="sa-sum">${sumHtml()}</div>
        <div class="sa-list">${listHtml()}</div>`;
    }
    document.addEventListener('change', e=>{if(!e.target.matches('[data-action-pick]'))return;const n=+e.target.value;if(e.target.checked)unpicked.delete(n);else unpicked.add(n);redraw();});
    const drawWithActions=draw;
    draw=function(){drawWithActions();window.SELECTION_ACTIONS?.mount($('#sa-actions'),data);};
    const redraw = () => { if (data.kind === 'excl' && $('#sa-text')) put(XKEY, $('#sa-text').value.trim() || TPLX);
      const y = scrollY, v = $('#sa-text')?.value, f = document.activeElement?.id === 'sa-text';
      draw(); if (v != null) $('#sa-text').value = v; if (f) $('#sa-text').focus({ preventScroll: true }); scrollTo(0, y); };   // v5.23e: поле на телефоне раскрыто, пока в нём пишут — не сворачивать при обновлении

    async function loadMarks() {
      try { marks = (await call('own_marks', { _fn: 'auto', nums: data.items.map(x => x.num) })).marks ?? {}; } catch { /* нет связи — покажем то, что было */ }
    }
    async function markSrv(nums, extra) {
      try { const r = await call('own_mark', { _fn: 'auto', nums, ...selArg(), ...extra }); Object.assign(marks, r.marks ?? {}); nums.forEach(n => { if (!(r.marks ?? {})[n]) delete marks[n]; }); return true; }
      catch (e) { toast(e.message, 5000); return false; }
    }
    // v5.20-отметки из браузера — один раз на сервер
    async function migrate() {
      const old = get(KEY, []).filter(n => !marks[n] && data.items.some(x => x.num === n && x.phone));
      if (old.length && !(await markSrv(old, { on: true, old: true }))) return;   // не удалось — попробуем в следующий раз
      try { localStorage.removeItem(KEY); } catch { /* приватный режим */ }
    }
    async function openPhone(x, b) {
      if (b) { b.disabled = true; b.textContent = 'Открываю…'; }
      try { const r = await call('phone', { num: x.num }); if (!r.phone) throw new Error(r.error || 'Номера нет в объявлении'); x.phone = r.phone; x.owner = r.owner ?? r.owner_name ?? x.owner;
        x.ad_state = r.ad_state ?? x.ad_state; if (r.src?.length && !x.src?.length) x.src = r.src.slice(0, 3); return true; }   // v5.23e: номер открыт — реклама проверена
      catch (e) { toast(e.message, 5000); if (b) { b.disabled = false; b.textContent = '📞 Открыть телефон'; } return false; }
    }
    async function poll() {
      if (!job?.id) return;
      try { Object.assign(job, await call('own_job', { _fn: 'auto', id: job.id })); } catch (e) { job.message = e.message; }
      job.live = ['new', 'run'].includes(job.status);
      $('#sa-job').innerHTML = jobHtml();
      if (!job.live) { await loadMarks(); redraw(); return; }
      setTimeout(poll, 3000);
    }
    // пока кто-то «ждём» — раз в минуту освежить отметки (страница открыта)
    setInterval(async () => {
      if (document.hidden || !data || $('#sa-note') || !Object.values(marks).some(m => m.st === 'wait')) return;
      const was = JSON.stringify(marks); await loadMarks(); if (JSON.stringify(marks) !== was) redraw();
    }, 60e3);

    // ---------- окно «Переписка» (v5.24, было «Заметка»): заметка агента + переписка с собственником + «Ответить» ----------
    function modal(html) {
      $('#sa-note')?.remove();
      document.body.insertAdjacentHTML('beforeend', `<div class="sa-modal" id="sa-note" role="dialog" aria-modal="true"><div class="sa-sheet">${html}</div></div>`);
      document.body.classList.add('sa-lock');
      return $('#sa-note');
    }
    const close = () => { $('#sa-note')?.remove(); document.body.classList.remove('sa-lock'); };
    const bub = m => `<div class="sa-msg ${m.who === 'me' ? 'me' : 'own'}${m.pending ? ' pend' : ''}"><p>${esc(m.text)}</p><small>${m.who === 'me' ? 'Вы' : 'Собственник'} · ${SV[m.svc] ?? ''}${m.at ? ` · ${tm(m.at)}` : ''}${m.pending ? ' · отправляю…' : ''}</small></div>`;
    async function noteOpen(x) {
      const el = modal(`<div class="sa-sh-head"><b>${ic(I.note)}Переписка · ${esc(x.what)}</b><button type="button" class="s-x2" data-close aria-label="Закрыть">✕</button></div>
        <p class="muted sa-sh-sub">${esc(x.owner || 'Собственник')}${x.phone ? ` · ${fmtPh(intl(x.phone))}` : ''} · № ${x.num}</p>
        <label class="sa-lbl" for="sa-nt">Ваша заметка <small class="muted" id="sa-nt-st"></small></label>
        <textarea id="sa-nt" rows="3" maxlength="1000" placeholder="Например: торг до 18 млн, показ в субботу, ключи у соседки">${esc(x.note || '')}</textarea>
        <div class="sa-lbl">Переписка с собственником</div><div class="sa-chat" id="sa-chat"><p class="muted">Загружаю…</p></div>
        <div class="sa-res-set" role="group" aria-label="Итог вручную"><span class="muted">Итог вручную (после звонка):</span>
          <button type="button" class="btn ghost" data-st="yes">✓ Актуально</button><button type="button" class="btn ghost" data-st="no">✗ Не актуально</button><button type="button" class="btn ghost" data-st="sold">✗ Продано</button></div>
        <div id="sa-rep"></div>`);
      el.dataset.num = x.num;
      try {
        const r = await call('own_chat', { _fn: 'auto', num: x.num });
        if (r.mark) { marks[x.num] = { ...r.mark, unseen: false }; }
        if (!$('#sa-note') || $('#sa-note').dataset.num != x.num) return;
        $('#sa-chat').innerHTML = r.msgs?.length ? r.msgs.map(bub).join('') : '<p class="muted">Переписки пока нет. Напишите собственнику — его ответ появится здесь (проверяю через 30, 60, 90, 120 минут и через 12 часов).</p>';
        $('#sa-chat').scrollTop = 1e6;
        if (r.mark) $('#sa-chat').insertAdjacentHTML('beforebegin', stHtml(r.mark));
        const ok = (r.svcs ?? []).filter(s => s !== 'max'), cur = r.mark?.svc && ok.includes(r.mark.svc) ? r.mark.svc : ok[0];
        $('#sa-rep').innerHTML = !x.phone ? '<p class="muted">Чтобы ответить, сначала откройте телефон собственника.</p>'
          : ok.length ? `<div class="sa-rep"><textarea id="sa-rt" rows="2" maxlength="1500" placeholder="Ответить собственнику…"></textarea>
            <div class="sa-rep-b">${ok.length > 1 ? `<select id="sa-rs" aria-label="Мессенджер">${ok.map(s => `<option value="${s}"${s === cur ? ' selected' : ''}>${SV[s]}</option>`).join('')}</select>` : `<span class="muted">через ${SV[cur]}</span>`}
            <button type="button" class="btn primary" data-reply="${cur}">Ответить</button></div><small class="muted">Сообщение уйдёт с вашего аккаунта через сервер — обычно за 1–3 минуты.</small></div>`
          : '<p class="muted">Чтобы отвечать отсюда, подключите Telegram или WhatsApp: <a href="hub.html#msg">🔗 Мессенджеры</a>. Или ответьте в приложении на телефоне.</p>';
        const c = document.querySelector(`.sa-card[data-num="${x.num}"] .sa-dot`); c?.remove();
      } catch (e) { $('#sa-chat') && ($('#sa-chat').innerHTML = `<p class="muted">${esc(e.message)}</p>`); }
      setTimeout(() => $('#sa-nt')?.focus({ preventScroll: true }), 50);
    }
    async function noteSave(x, v) {
      const s = $('#sa-nt-st'); if (s) s.textContent = 'сохраняю…';
      try { await call('note', { num: x.num, text: v }); x.note = v.trim(); if ($('#sa-nt-st')) $('#sa-nt-st').textContent = 'сохранено'; }
      catch (e) { if ($('#sa-nt-st')) $('#sa-nt-st').textContent = ''; toast(e.message, 5000); }
    }

    // ---------- «✓ Сформировать проверенную подборку» → web sel_create {format: 'link', from_sel, nums} ----------
    function checkedOpen() {
      const L = data.items.map(x => ({ x, m: marks[x.num] })), pre = n => marks[n]?.st === 'yes';
      const any = L.some(({ x }) => pre(x.num));
      modal(`<div class="sa-sh-head"><b>${ic(I.check)}Проверенная подборка для клиента</b><button type="button" class="s-x2" data-close aria-label="Закрыть">✕</button></div>
        <p class="muted sa-sh-sub">${any ? 'Отмечены объекты, где собственник ответил «актуально». Можно снять или добавить галочки.' : 'Пока никто не ответил «актуально» — отметьте объекты вручную.'} Клиент увидит ссылку без телефонов и цен собственника.</p>
        <label class="field">Название<input id="sa-ct" maxlength="80" value="${esc(`Проверенная подборка — ${data.title || ''}`.slice(0, 80))}"></label>
        <div class="sa-crow"><label class="field">Комиссия, %<input id="sa-cm" type="number" min="0" max="10" step="0.5" value="${data.markup ?? 0}"></label>
          <label class="sa-chk"><input type="checkbox" id="sa-ch"${data.hide_addr !== false ? ' checked' : ''}> скрыть улицу и дом</label></div>
        <div class="sa-clist">${L.map(({ x, m }) => `<label class="sa-chk sa-ci"><input type="checkbox" value="${x.num}"${pre(x.num) ? ' checked' : ''}>
          <span><b>${esc(x.what)}</b> · ${x.price ? `${money(x.price)} ₽` : '—'}<small class="muted">${esc(clip(x.place, 70))}</small></span>
          <em class="sa-cst ${kind(m?.st)}">${m?.st === 'yes' ? '✓ актуально' : m?.st === 'sold' ? '✗ продано' : m?.st === 'no' ? '✗ не актуально' : m?.st === 'none' ? 'не ответил' : m?.st === 'wait' ? 'ждём' : ''}</em></label>`).join('')}</div>
        <div class="sa-cfoot"><button type="button" class="btn primary" data-mk>Сформировать ссылку</button><small class="muted" id="sa-cn"></small></div><div id="sa-cres"></div>`);
      const cnt = () => { const n = document.querySelectorAll('.sa-clist input:checked').length; $('#sa-cn').textContent = n ? `выбрано ${n} (до 20)` : 'выберите объекты'; };
      $('#sa-note').addEventListener('change', cnt); cnt();
    }
    async function checkedMake(b) {
      const nums = [...document.querySelectorAll('.sa-clist input:checked')].map(i => +i.value);
      if (!nums.length) return toast('Отметьте хотя бы один объект');
      if (nums.length > 20) return toast('В подборке ссылкой — до 20 объектов');
      b.disabled = true; b.textContent = 'Собираю…';
      try {
        const r = await call('sel_create', { format: 'link', from_sel: data.id || selId || undefined, nums, title: $('#sa-ct').value.trim(), markup: Math.max(0, Math.min(10, +$('#sa-cm').value || 0)),
          hide_addr: $('#sa-ch').checked, agent: data.agent || undefined, agent_phone: data.agent_phone || undefined, phones: false });
        if (!r.link) throw new Error(r.message || 'Ссылка не получилась');
        $('#sa-cres').innerHTML = `<div class="sa-done-box"><p><b>✓ Проверенная подборка готова</b> — ${r.total ?? nums.length} ${plural(r.total ?? nums.length, 'объект', 'объекта', 'объектов')}</p>
          <input readonly value="${esc(r.link)}" aria-label="Ссылка для клиента">
          <div class="sa-btns2"><button type="button" class="btn primary" data-cpl="${esc(r.link)}">Скопировать ссылку</button>
          ${navigator.share ? `<button type="button" class="btn soft" data-shl="${esc(r.link)}">Поделиться</button>` : ''}<a class="btn ghost" href="${esc(r.link)}" target="_blank" rel="noopener">Открыть</a></div>
          <small class="muted">Эту ссылку — клиенту. Она есть и в «Моих подборках» с пометкой «✓ проверенная».${r.until ? ` Действует до ${day(r.until)}.` : ''}</small></div>`;
        b.textContent = 'Готово'; $('#sa-cres').scrollIntoView({ block: 'nearest' });
      } catch (e) { b.disabled = false; b.textContent = 'Сформировать ссылку'; toast(e.message, 6000); }
    }

    document.addEventListener('input', e => {
      if (e.target.id === 'sa-text' && data?.kind === 'excl') { put(XKEY, e.target.value); clearTimeout(AGENT.t); AGENT.t = setTimeout(() => {   // v5.25b: агентам — свой шаблон
        document.querySelectorAll('.sa-card').forEach(c => { const x = data.items.find(i => i.num === +c.dataset.num), a = c.querySelector('.sa-wa'); if (x && a) a.href = `https://wa.me/${intl(x.agent?.wa || x.agent?.phone)}?text=${encodeURIComponent(fill(text(), x))}`; }); }, 400); return; }
      if (e.target.id === 'sa-text') { put(cpick ? `${TKEY}Q` : TKEY, e.target.value); clearTimeout(AGENT.t); AGENT.t = setTimeout(() => {
        document.querySelectorAll('.sa-card').forEach(c => { const x = data.items.find(i => i.num === +c.dataset.num), a = c.querySelector('.sa-wa'); if (x && a) a.href = `https://wa.me/${intl(x.phone)}?text=${encodeURIComponent(fill(text(), x))}`; }); }, 400); }
      if (e.target.id === 'sa-nt') { const x = data.items.find(i => i.num === +$('#sa-note').dataset.num); clearTimeout(AGENT.n); if ($('#sa-nt-st')) $('#sa-nt-st').textContent = '';
        AGENT.n = setTimeout(() => x && noteSave(x, e.target.value), 1200); }
    });
    document.addEventListener('keydown', async e => {
      const md = $('#sa-note'); if (e.key !== 'Escape' || !md) return;
      const x = data.items.find(i => i.num === +md.dataset.num), v = $('#sa-nt')?.value;
      if (x && v != null && v.trim() !== (x.note || '')) { clearTimeout(AGENT.n); await noteSave(x, v); }
      close(); redraw();
    });
    document.addEventListener('click', async e => {
      const md = $('#sa-note');
      if (md && (e.target === md || e.target.closest('[data-close]'))) {
        const x = data.items.find(i => i.num === +md.dataset.num), v = $('#sa-nt')?.value;
        if (x && v != null && v.trim() !== (x.note || '')) { clearTimeout(AGENT.n); await noteSave(x, v); }
        close(); return redraw();
      }
      if (md) {
        const go = e.target.closest('[data-go-send]');
        if (go) { const { svc, nums } = md._send; close(); return sendNow(svc, nums); }
        const nx = data.items.find(i => i.num === +md.dataset.num);
        const st = e.target.closest('[data-st]');
        if (st && nx) { await markSrv([nx.num], { st: st.dataset.st }); toast('Итог сохранён'); close(); return redraw(); }
        const rp = e.target.closest('[data-reply]');
        if (rp && nx) {
          const v = $('#sa-rt').value.trim(), svc = $('#sa-rs')?.value || rp.dataset.reply; if (v.length < 2) return toast('Напишите текст ответа');
          rp.disabled = true;
          try { if (window.WAYS && await window.WAYS.pick(svc, { action: 'ответить' }) === 'off') { rp.disabled = false; return toast('Не отправлено: компьютер не на связи'); }
            let rr; try { rr = await call('own_reply', { _fn: 'auto', num: nx.num, svc, text: v }); }
            catch (e1) { if (!window.WAYS?.isNeedPc(e1) || await window.WAYS.needPc(svc, e1) === 'off') throw e1; rr = await call('own_reply', { _fn: 'auto', num: nx.num, svc, text: v }); } $('#sa-rt').value = ''; if (rr.via === 'ext' && here()) window.postMessage({ da: 'sendPoll' }, location.origin);
            const ch = $('#sa-chat'); if (ch.querySelector('p.muted')) ch.innerHTML = ''; ch.insertAdjacentHTML('beforeend', bub({ who: 'me', text: v, svc, pending: true })); ch.scrollTop = 1e6;
            toast('Ответ в очереди — уйдёт с вашего аккаунта за 1–3 минуты'); }
          catch (err) { toast(err.message, 6000); }
          rp.disabled = false; return;
        }
        if (e.target.closest('[data-mk]')) return checkedMake(e.target.closest('[data-mk]'));
        const cp = e.target.closest('[data-cpl]'); if (cp) { toast(await copyTxt(cp.dataset.cpl) ? 'Ссылка скопирована — отправьте её клиенту' : 'Скопируйте ссылку из поля'); return; }
        const sh = e.target.closest('[data-shl]'); if (sh) { navigator.share({ title: 'Подборка объектов', url: sh.dataset.shl }).catch(() => {}); return; }
        return;
      }
      const c = e.target.closest('.sa-card'), x = c && data.items.find(i => i.num === +c.dataset.num);
      if (data?.kind === 'excl') {   // v5.25b: эксклюзивы — свои кнопки (ссылки мессенджеров открывает msgapp.js)
        if (e.target.closest('[data-tplx]')) { $('#sa-text').value = TPLX; put(XKEY, TPLX); return redraw(); }
        const xp = e.target.closest('[data-xpick]');
        if (xp) { const all = data.items.filter(xOk).map(i => i.num); if (!xpick.size) all.forEach(n => xpick.add(n));
          xp.checked ? xpick.add(+xp.dataset.xpick) : xpick.delete(+xp.dataset.xpick); if (xpick.size === all.length) xpick.clear(); put(`${KEY}:x`, [...xpick]);
          if (!all.some(n => xpick.has(n)) && !xpick.size) {} return redraw(); }
        if (e.target.closest('[data-xcp]') && x) { const ok = await copyTxt(fill(text(), x)); if (ok) toast('Текст скопирован — вставьте его в чат', 3500); return; }
        if (!e.target.closest('[data-all]')) return;
      }
      if (e.target.closest('[data-tpl]')) { $('#sa-text').value = cpick ? QTPL : TPL; put(cpick ? `${TKEY}Q` : TKEY, cpick ? QTPL : TPL); return; }
      // v5.31a: «Написать собственникам по отмеченным клиентом» — выбор отмеченных + шаблон с вопросом; «Писать всем» — обратно
      if (e.target.closest('[data-cpick]') || e.target.closest('[data-cpick-off]')) {   // draw(), а не redraw(): шаблон в поле должен смениться
        cpick = !e.target.closest('[data-cpick-off]') && !cpick; filter = cpick ? 'cl' : 'all'; put(FKEY, filter);
        const y = scrollY; draw(); scrollTo(0, y); if (cpick) $('.sa-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      if (e.target.closest('[data-selai]')) return selai();
      const ocl = e.target.closest('[data-open-cl]');
      if (ocl) { ocl.disabled = true; const list = cpList().filter(i => !i.phone);
        for (let k = 0; k < list.length; k++) { ocl.textContent = `Открываю ${k + 1} из ${list.length}…`; if (!(await openPhone(list[k]))) break; }
        return redraw(); }
      const f = e.target.closest('[data-flt]'); if (f) { filter = f.dataset.flt; put(FKEY, filter); return redraw(); }
      if (e.target.closest('[data-tgl-all]')) { put(OKEY, !allOpen()); opened.clear(); put(`${KEY}:o`, []); return redraw(); }
      if (e.target.closest('[data-checked]')) return checkedOpen();
      if (e.target.closest('[data-tgl]') && x) { opened.has(x.num) ? opened.delete(x.num) : opened.add(x.num); put(`${KEY}:o`, [...opened]);
        const open = opened.has(x.num) !== allOpen(), b = e.target.closest('[data-tgl]'); c.classList.toggle('sa-open', open); b.setAttribute('aria-expanded', open);
        b.lastChild.textContent = open ? 'Скрыть описание и контакты' : 'Показать описание и контакты'; return; }
      if (e.target.closest('[data-note]') && x) return noteOpen(x);
      const w = e.target.closest('[data-w]');
      if (w && x) {
        if (w.dataset.cp != null) { const ok = await copyTxt(w.dataset.cpph != null ? `+${intl(x.phone)}\n${fill(text(), x)}` : fill(text(), x));
          toast(ok ? (w.dataset.cpph != null ? 'Номер и текст скопированы — в MAX найдите собственника по номеру и вставьте текст' : 'Текст скопирован — вставьте его в чат') : 'Скопируйте текст из поля сверху', 5000); }
        if (!marks[x.num]?.wrote || marks[x.num].st !== 'wait') { await markSrv([x.num], { on: true, svc: w.dataset.w, text: fill(text(), x) }); setTimeout(redraw, 300); }
        return;
      }
      if (e.target.closest('[data-done]') && x) { const on = !marks[x.num]?.wrote;
        if (!on && marks[x.num]?.text && !confirm('Снять отметку «написал»? Ответ собственника и переписка на этой странице пропадут.')) return;
        await markSrv([x.num], on ? { on: true, text: fill(text(), x) } : { on: false }); return redraw(); }
      if (e.target.closest('[data-open]') && x) { if (await openPhone(x, e.target.closest('[data-open]'))) redraw(); return; }
      const oa = e.target.closest('[data-open-all]');
      if (oa) {
        oa.disabled = true; const list = data.items.filter(i => !i.phone);
        for (let k = 0; k < list.length; k++) { oa.textContent = `Открываю ${k + 1} из ${list.length}…`; if (!(await openPhone(list[k]))) break; }
        return redraw();
      }
      const all = e.target.closest('[data-all]');
      if (all) {
        const svc = all.dataset.all, nums = sendList().map(i => i.num), xw = data.kind === 'excl';
        if (xw && !nums.length) return toast('Отметьте хотя бы одного агента галочкой «в «Написать всем»»');
        if (!nums.length) return toast('Нет открытых телефонов — откройте их кнопкой «📞 Открыть телефоны»');
        return previewOpen(svc, nums);
      }
    });
    // v5.31a: перед отправкой — превью 1–2 сообщений ровно так, как их соберёт сервер (own_send dry: {вопрос}, просьба о видео, № объекта, фото)
    async function previewOpen(svc, nums) {
      const xw = data.kind === 'excl', who = xw ? `агентам выбранных объектов (${nums.length})` : `${nums.length} ${plural(nums.length, 'собственнику', 'собственникам', 'собственникам')}`;
      const el = modal(`<div class="sa-sh-head"><b>${ic(I.mail)}Проверьте сообщение</b><button type="button" class="s-x2" data-close aria-label="Закрыть">✕</button></div>
        <p class="muted sa-sh-sub">Отправить ${who} через ${SV[svc]} с вашего аккаунта. Так увидят собственники первые сообщения:</p>
        <div class="sa-prev" id="sa-prev"><p class="muted">Собираю текст…</p></div>
        <p class="muted sa-sh-sub">Незнакомым — не больше 30 в день: мессенджер может посчитать это спамом. Сообщения уходят по одному с паузами.</p>
        <div id="sa-ways"></div>
        <div class="sa-cfoot"><button type="button" class="btn primary" data-go-send disabled>Отправить ${nums.length}</button><button type="button" class="btn ghost" data-close>Изменить текст</button></div>`);
      el._send = { svc, nums };
      window.WAYS?.box($('#sa-ways'), svc, { mass: true, action: 'написать всем' });   // v5.69: сначала свой компьютер
      try {
        const r = await call('own_send', { _fn: 'auto', svc, text: text(), nums, dry: true, ...selArg() });
        if ($('#sa-note') !== el) return;
        $('#sa-prev').innerHTML = (r.preview ?? []).map(p => `<div class="sa-pv">${p.photo ? `<img src="${esc(p.photo)}" alt="Фото к сообщению" loading="lazy" referrerpolicy="no-referrer">` : '<div class="sa-pv-no">без фото</div>'}<p>${esc(p.text)}</p></div>`).join('')
          + (r.planned > 2 ? `<p class="muted">…и ещё ${r.planned - 2} — у каждого свои ЖК, адрес, цена и № объекта.</p>` : '');
        const b = el.querySelector('[data-go-send]'); b.disabled = false; b.textContent = `Отправить ${r.planned ?? nums.length}`;
      } catch (err) { if ($('#sa-prev')) $('#sa-prev').innerHTML = `<p class="err">${esc(err.message)}</p>`; }
    }
    async function sendNow(svc, nums) {
      const b = document.querySelector(`[data-all="${svc}"]`); if (b) b.disabled = true;
      try {
        let via = window.WAYS ? await window.WAYS.pick(svc, { mass: true, action: 'написать всем' }) : 'ext';
        if (via === 'off') { if (b) b.disabled = false; return toast('Не отправлено: включите компьютер с расширением или разрешите сервер галочкой'); }
        let r; try { r = await call('own_send', { _fn: 'auto', svc, text: text(), nums, ...window.WAYS?.via(via), ...selArg() }); }
        catch (e1) { if (!window.WAYS?.isNeedPc(e1) || (via = await window.WAYS.needPc(svc, e1, { mass: true })) === 'off') throw e1;
          r = await call('own_send', { _fn: 'auto', svc, text: text(), nums, ...window.WAYS?.via(via), ...selArg() }); }
        if (via === 'ext' && here()) window.postMessage({ da: 'sendPoll' }, location.origin);   // расширение в этом браузере заберёт сразу
        window.MSGAPP?.watch?.(r.id);   // v5.68: 5 мин без отправки — сервер или окно «вручную»
        job = { id: r.id, svc, via: r.via ?? via, status: 'new', total: r.planned ?? nums.length, sent: 0, failed: 0, live: true }; $('#sa-job').innerHTML = jobHtml(); setTimeout(poll, 2500);
      } catch (err) { if (b) b.disabled = false; toast(err.message, 6000); job = { svc, status: 'error', message: err.message, total: nums.length }; $('#sa-job').innerHTML = jobHtml(); }
    }
    // v5.31a → вкладка B: «🤖 Позвать помощника ИИ» — window.SELAI.open({ sel_id, t }) из selai.js (если ещё не загрузился — подгрузить и повторить)
    async function selai() {
      const arg = { sel_id: data.id || selId || null, t: /^[A-Za-z0-9_-]{22,40}$/.test(t) ? t : null };
      if (window.SELAI?.open) return window.SELAI.open(arg);
      toast('Помощник загружается…');
      await new Promise(ok => { const el = document.createElement('script'); el.src = 'selai.js?v=5.53a'; el.onload = el.onerror = ok; document.head.appendChild(el); });
      if (window.SELAI?.open) window.SELAI.open(arg); else toast('Помощник пока недоступен — обновите страницу через минуту', 5000);
    }

    call('sel_agent').then(async d => {
      if (d.kind === 'pick' && window.PICK?.agent) return window.PICK.agent(d, call);   // v5.48 H9: ссылка «Самоподбор» — своя страница агента (pick.js)
      data = d; document.title = `${d.kind === 'excl' ? 'Агенты эксклюзивов' : 'Собственники'} — ${d.title || 'подборка'}`;
      d.items.forEach(x => { if (x.st) marks[x.num] = { st: x.st, wrote: true }; });
      draw();
      await loadMarks(); if (d.kind !== 'excl') await migrate(); redraw();
      if (d.kind === 'excl' && !d.can_view) return;   // v5.25b: без подписки «Написать всем» нет (сервер мессенджеров — по подписке)
      call('own_init', { _fn: 'auto', ...selArg() }).then(r => { svcs = { svcs: r.svcs ?? [], day_left: r.day_left ?? null, ext: r.ext ?? null }; }, e => { svcs = { error: e.message }; })
        .finally(() => { const el = $('#sa-svc'); if (el) el.innerHTML = svcHtml(); });
    }, e => fail2(e.data?.error === 'owner' ? 'Чужая подборка' : 'Подборка недоступна', e.message));
  }
})();

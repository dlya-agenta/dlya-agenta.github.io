// Подборка для клиента по ссылке s.html#<токен> (ТЗ v2, шаг 3.2). Без входа: sel_public — объекты, sel_feedback — ✓ «подходит» / ✗ «не подходит»
// и строка комментария, сохраняется сразу. Агент, открывший свою ссылку в браузере, где вошёл на сайт, видит пометку; его просмотры не считаются.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // описание (v5.17.3): разделы **жирным** по шаблону; у старых описаний — «Заголовок:» жирным, строка «Коротко:» не показывается
  const descrHtml = s => esc(String(s ?? '').replace(/^Коротко:.*(\n|$)/m, '').trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^([А-ЯЁ][а-яё ]{2,20}:)/gm, '<b>$1</b>');
  const money = v => Math.round(v).toLocaleString('ru-RU');
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const seaTxt = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  const hs = location.hash.slice(1), t = hs.split(/[?&]/)[0];
  // v5.20: страница агента — #<токен>&a=1 или #id=<номер подборки>&a=1 (подборка только с PDF): собственники, написать всем, позвонить
  const agentMode = /(^|[?&])a=1(&|$)/.test(hs), selId = +(/(?:^|[?&])id=(\d+)/.exec(hs)?.[1] || 0);
  let tok = null;
  try { tok = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }

  async function call(action, { _fn, ...extra } = {}) {
    const body = JSON.stringify({ action, t, ...(selId ? { id: selId } : {}), ...(typeof tok === 'string' ? { auth: { token: tok } } : {}), ...extra });
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
  const fail = m => { $('#s-app').innerHTML = `<div class="s-empty"><h1>Подборка недоступна</h1><p class="muted">${esc(m)}</p></div>`; };

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

  function card(x, i, n) {
    const ph = gal(x.photos, i);
    const tags = [...x.tags, x.sea_m ? `≈ ${seaTxt(x.sea_m)} до моря` : null].filter(Boolean);
    return `<article class="s-card${x.mark ? ` m-${x.mark}` : ''}" data-num="${x.num}">${ph}
      <div class="s-body">
        <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : 'цена по запросу'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
        ${x.place ? `<p class="muted s-place">${esc(x.place)}</p>` : ''}
        ${tags.length ? `<div class="s-tags">${tags.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        ${x.gone ? '<p class="s-gone">Объявление снято с продажи — уточните у агента.</p>' : ''}
        ${x.descr ? `<p class="s-descr">${descrHtml(x.descr)}</p><button type="button" class="btn ghost s-more" hidden>Развернуть</button>` : ''}
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

  addEventListener('hashchange', () => location.reload());   // вставили другую ссылку в ту же вкладку
  if (agentMode) AGENT();
  else if (!/^[A-Za-z0-9_-]{22,40}$/.test(t)) fail('В ссылке нет кода подборки — попросите агента прислать её ещё раз.');
  else call('sel_public').then(render, e => fail(e.message));

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
    const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
    const SV = { tg: 'Telegram', wa: 'WhatsApp', max: 'MAX' };
    const selArg = () => selId ? { sel_id: selId } : {};
    const I = { mail: 'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5zM4 6.5l8 6.5 8-6.5',
      eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
      note: 'M6 3.5h9l4 4V20a.5.5 0 0 1-.5.5h-12A.5.5 0 0 1 6 20zM14.5 3.5v4.5H19M9 12h6M9 15.5h6', check: 'M4.5 12.5 9.5 17.5 19.5 6.5' };
    let svcs = null, job = null, marks = {}, filter = get(FKEY, 'all');
    const opened = new Set(get(`${KEY}:o`, [])), allOpen = () => !!get(OKEY, false);
    const short = a => String(a ?? '').replace(/^(г\.?\s*о\.?\s*)?Сочи,?\s*/i, '').replace(/мкр-н\s+[^,]+,\s*/i, '').trim();
    const fill = (tx, x) => tx.replace(/,?\s*\{имя\}/gi, '').replace(/\{ЖК\}/gi, x.zk ? `ЖК «${x.zk}»` : '')
      .replace(/\{адрес\}/g, short(x.address) || x.what).replace(/\{цена\}/g, x.price ? `${money(x.price)} ₽` : '').replace(/\{объект\}/g, x.what)
      .replace(/(Здравствуйте|Добрый день),\s*!/g, '$1!').replace(/\s+([,.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/(объект|квартиру)\s*,/g, '$1').replace(/ {2,}/g, ' ').trim()
      + `\n\n№ ${x.num}`;
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
          <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : '—'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
          ${x.place ? `<p class="muted s-place">${esc(x.place)}</p>` : ''}
          ${x.gone ? '<p class="s-gone">Снято с продажи</p>' : ''}
          ${adHtml(x)}
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
    function svcHtml() {
      const n = data.items.filter(x => x.phone).length;
      if (!svcs) return '<p class="muted">Проверяю подключённые мессенджеры…</p>';
      if (svcs.error) return `<p class="muted">Отправка всем сразу пока недоступна: ${esc(svcs.error)}</p>
        <a class="btn soft sa-conn" href="hub.html#msg">🔗 Подключить мессенджеры</a>`;
      return `<div class="sa-svcs">${['tg', 'wa', 'max'].map(k => { const s = svcs.svcs.find(v => v.svc === k);
        if (s?.soon) return `<span class="btn ghost" aria-disabled="true" title="MAX не всегда находит человека по номеру — пишите вручную кнопкой «MAX» у собственника">${SV[k]} — вручную</span>`;
        return s?.ok ? `<button type="button" class="btn soft" data-all="${k}"${n && !job?.live ? '' : ' disabled'}>${SV[k]} — всем (${n})</button>`
          : `<a class="btn ghost" href="hub.html#msg" title="Войдите в ${SV[k]} на сервере — один раз">Подключить ${SV[k]}</a>`; }).join('')}</div>
        ${svcs.day_left != null ? `<small class="muted">Сегодня можно отправить ещё ${svcs.day_left}. Сообщения уходят по одному с паузами, чтобы мессенджер не счёл их рассылкой. Ответы проверю сам: через 30, 60, 90 и 120 минут, затем через 12 часов.</small>` : ''}
        ${n < data.items.length ? `<small class="muted">Написать можно только тем, чей телефон открыт (${n} из ${data.items.length}).</small>` : ''}`;
    }
    function jobHtml() {
      if (!job) return '';
      const S = { new: 'в очереди', run: 'идёт отправка', done: 'готово', stopped: 'остановлено', error: 'ошибка' };
      return `<div class="sa-job${job.status === 'done' ? ' ok' : ''}"><b>${SV[job.svc] ?? ''}: ${S[job.status] ?? esc(job.status)}</b>
        · отправлено ${job.sent ?? 0} из ${job.total ?? job.planned ?? 0}${job.failed ? ` · не ушло ${job.failed}` : ''}${job.message ? ` · ${esc(job.message)}` : ''}</div>`;
    }
    // сводка и фильтр: «Ответили 4 из 10 · актуально 3 · не актуально 1 · ждём 5»
    function sumHtml() {
      const all = data.items.length, c = { yes: 0, no: 0, none: 0, wait: 0 };
      data.items.forEach(x => { const k = kind(marks[x.num]?.st); if (k) c[k]++; });
      const wrote = c.yes + c.no + c.none + c.wait, ans = data.items.filter(x => answered(marks[x.num])).length;
      const F = [['all', `Все ${all}`], ['yes', `✓ ${c.yes}`], ['no', `✗ ${c.no + c.none}`], ['wait', `Ждём ${c.wait}`]];
      return `<div class="sa-sum"><p>${wrote ? `Написали ${wrote} из ${all} · ответили ${ans} · <b class="t-ok">актуально ${c.yes}</b> · <b class="t-bad">не актуально ${c.no}</b>${c.none ? ` · не ответили ${c.none}` : ''} · ждём ${c.wait}`
          : 'Собственникам ещё не писали — напишите всем сразу или каждому кнопкой WhatsApp / Telegram / MAX.'}</p>
        <div class="sa-flt" role="group" aria-label="Показать">${F.map(([k, l]) => `<button type="button" data-flt="${k}" aria-pressed="${filter === k}">${l}</button>`).join('')}</div>
        <div class="sa-tools"><button type="button" class="btn ghost" data-tgl-all>${ic(I.eye)}${allOpen() ? 'Скрыть у всех описание и контакты' : 'Показать у всех описание и контакты'}</button>
          <button type="button" class="btn primary" data-checked${c.yes ? '' : ' title="Пока никто не ответил «актуально» — объекты можно выбрать вручную"'}>${ic(I.check)}Сформировать проверенную подборку${c.yes ? ` (${c.yes})` : ''}</button></div></div>`;
    }
    const shown = x => filter === 'all' || kind(marks[x.num]?.st) === filter || (filter === 'no' && kind(marks[x.num]?.st) === 'none');
    function listHtml() {
      const L = data.items.map((x, i) => shown(x) ? row(x, i) : '').join('');
      return L || `<p class="muted sa-nolist">${data.items.length ? 'В этом фильтре пока пусто.' : 'В подборке нет объектов.'}</p>`;
    }
    function draw() {
      const n = data.items.length, wp = data.items.filter(x => x.phone).length, closed = n - wp;
      $('#s-app').innerHTML = `<header class="s-hero">
          <a class="link sa-back" href="./#sels">← Мои подборки</a>
          <div class="sa-only" role="note">🔒 Это ссылка для вас (агента) — клиенту её не отправляйте: здесь телефоны собственников и переписка с ними. Клиенту — «Ссылка для клиента» или проверенная подборка.</div>
          <h1>${esc(data.title)}</h1>
          <p class="muted">Собственники подборки · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · телефон открыт у ${wp} · цены собственника</p>
        </header>
        <section class="sa-box">
          <label class="sa-lbl" for="sa-text">Сообщение собственникам ${ic(I.mail)}</label>
          <textarea id="sa-text" rows="3" maxlength="600">${esc(get(TKEY, TPL))}</textarea>
          <small class="muted">{ЖК}, {адрес} и {цена} подставятся у каждого собственника; в конце — № объекта в нашей базе, к сообщению — 1 фото квартиры. <button type="button" class="link" data-tpl>Вернуть шаблон</button></small>
          ${window.MSGAPP?.warn('собственникам') ?? ''}
          <div class="sa-all"><div class="sa-h">Написать всем сразу — с ваших аккаунтов</div><div id="sa-svc">${svcHtml()}</div><div id="sa-job">${jobHtml()}</div></div>
          ${closed ? `<button type="button" class="btn soft sa-openall" data-open-all>📞 Открыть телефоны (${closed})</button>` : ''}
        </section>
        <div id="sa-sum">${sumHtml()}</div>
        <div class="sa-list">${listHtml()}</div>`;
    }
    const redraw = () => { const y = scrollY, v = $('#sa-text')?.value, f = document.activeElement?.id === 'sa-text';
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
        <div class="sa-crow"><label class="field">Комиссия, %<input id="sa-cm" type="number" min="0" max="10" step="0.5" value="${data.markup ?? 5}"></label>
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
      if (e.target.id === 'sa-text') { put(TKEY, e.target.value); clearTimeout(AGENT.t); AGENT.t = setTimeout(() => {
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
        const nx = data.items.find(i => i.num === +md.dataset.num);
        const st = e.target.closest('[data-st]');
        if (st && nx) { await markSrv([nx.num], { st: st.dataset.st }); toast('Итог сохранён'); close(); return redraw(); }
        const rp = e.target.closest('[data-reply]');
        if (rp && nx) {
          const v = $('#sa-rt').value.trim(), svc = $('#sa-rs')?.value || rp.dataset.reply; if (v.length < 2) return toast('Напишите текст ответа');
          rp.disabled = true;
          try { await call('own_reply', { _fn: 'auto', num: nx.num, svc, text: v }); $('#sa-rt').value = '';
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
      if (e.target.closest('[data-tpl]')) { $('#sa-text').value = TPL; put(TKEY, TPL); return; }
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
        const svc = all.dataset.all, nums = data.items.filter(i => i.phone).map(i => i.num);
        if (!confirm(`Отправить сообщение ${nums.length} ${plural(nums.length, 'собственнику', 'собственникам', 'собственникам')} через ${SV[svc]} с вашего аккаунта? У каждого подставятся ЖК, адрес, цена и № объекта, к сообщению — 1 фото.\n\nНезнакомым — не больше 30 в день: мессенджер может посчитать это спамом.`)) return;
        all.disabled = true;
        try {
          const r = await call('own_send', { _fn: 'auto', svc, text: text(), nums, ...selArg() });
          job = { id: r.id, svc, status: 'new', total: r.planned ?? nums.length, sent: 0, failed: 0, live: true }; $('#sa-job').innerHTML = jobHtml(); setTimeout(poll, 2500);
        } catch (err) { all.disabled = false; toast(err.message, 6000); job = { svc, status: 'error', message: err.message, total: nums.length }; $('#sa-job').innerHTML = jobHtml(); }
      }
    });

    call('sel_agent').then(async d => {
      data = d; document.title = `Собственники — ${d.title || 'подборка'}`;
      d.items.forEach(x => { if (x.st) marks[x.num] = { st: x.st, wrote: true }; });
      draw();
      await loadMarks(); await migrate(); redraw();
      call('own_init', { _fn: 'auto', ...selArg() }).then(r => { svcs = { svcs: r.svcs ?? [], day_left: r.day_left ?? null }; }, e => { svcs = { error: e.message }; })
        .finally(() => { const el = $('#sa-svc'); if (el) el.innerHTML = svcHtml(); });
    }, e => fail2(e.data?.error === 'owner' ? 'Чужая подборка' : 'Подборка недоступна', e.message));
  }
})();

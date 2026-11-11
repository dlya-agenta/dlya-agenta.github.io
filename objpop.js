// v5.47 E (Алексей, п. 6): «№ 150017» и «#150017» в текстах (Помощник, CRM, сделки, чаты, заметки) — подсвеченная ссылка; нажатие открывает
// объявление окном поверх текущей страницы, без перехода. На главной — своё окно объявления (window.APP_OPEN_ITEM из app.js),
// на других страницах — главная в рамке (./?embed=1#o=N): то же окно с фото, телефоном и кнопками; закрыли окно — рамка закрывается.
(() => {
  const RE = /(№\s?|#)(\d{6,7})(?!\d)/g;
  const SKIP = 'a, button, input, textarea, select, option, script, style, code, pre, svg, [contenteditable], .objpop, .op-hov, .sheet-title, #sheet-title, .no-objlink';
  function link(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 3) return;
    const texts = [];
    if (root.nodeType === 3) texts.push(root);
    else {
      if (root.closest?.(SKIP)) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /(№\s?|#)\d{6,7}/.test(n.data) && !n.parentElement?.closest(SKIP) ? 1 : 3 });
      while (w.nextNode()) texts.push(w.currentNode);
    }
    for (const t of texts) {
      if (!t.parentNode || t.parentElement?.closest(SKIP)) continue;
      RE.lastIndex = 0; if (!RE.test(t.data)) continue;
      const f = document.createDocumentFragment(); let last = 0; RE.lastIndex = 0;
      for (const m of t.data.matchAll(RE)) {
        f.append(t.data.slice(last, m.index));
        const a = document.createElement('a');
        a.className = 'objlink'; a.href = `./#o=${m[2]}`; a.dataset.obj = m[2]; a.textContent = m[0]; a.title = 'Открыть объявление';
        f.append(a); last = m.index + m[0].length;
      }
      f.append(t.data.slice(last));
      t.replaceWith(f);
    }
  }
  let box = null;
  function close() { box?.remove(); box = null; document.documentElement.classList.remove('objpop-on'); }
  function open(num) {
    num = +num; if (!num) return;
    if (window.APP_OPEN_ITEM) return window.APP_OPEN_ITEM(num);
    // v5.54: страница в рамке (окно ИИ-Агента — hub.html?ag=1) — объявление открывает сама страница вокруг рамки, на всю ширину и поверх агента
    try { if (window.parent !== window && !/[?&]embed=1/.test(location.search) && window.parent.location.origin === location.origin) {
      const P = window.parent; if (P.APP_OPEN_ITEM) return P.APP_OPEN_ITEM(num); if (P.OBJPOP?.open) return P.OBJPOP.open(num); } } catch { /* другая страница */ }
    close();
    box = document.createElement('div'); box.className = 'objpop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', `Объявление № ${num}`);
    box.innerHTML = `<div class="op-box"><div class="op-wait">Открываю № ${num}…</div><iframe title="Объявление № ${num}" src="./?embed=1#o=${num}"></iframe>
      <button type="button" class="op-x" aria-label="Закрыть">✕</button></div>`;
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.op-x')) close(); });
    box.querySelector('iframe').addEventListener('load', () => box?.querySelector('.op-wait')?.remove(), { once: true });
    document.body.appendChild(box); document.documentElement.classList.add('objpop-on');
  }
  addEventListener('message', e => { if (e.origin !== location.origin) return; if (e.data === 'objpop-close') close(); if (e.data === 'objpop-ready') box?.querySelector('.op-x')?.setAttribute('hidden', ''); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && box) close(); });
  document.addEventListener('click', e => {
    const a = e.target.closest?.('a.objlink, [data-obj]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;   // с Ctrl/⌘ — как обычная ссылка, в новой вкладке
    e.preventDefault(); open(a.dataset.obj);
  });
  // всё, что появляется на странице позже (ответы Помощника, CRM, чаты), подсвечиваем по мере появления
  const q = new Set(); let raf = 0;
  const run = () => { raf = 0; for (const n of q) if (n.isConnected) link(n); q.clear(); };
  const start = () => { link(document.body); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) q.add(n); if (!raf && q.size) raf = requestAnimationFrame(run); }).observe(document.body, { childList: true, subtree: true }); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', start) : start();
  // ---------- v5.54 (Алексей 11.11): объекты в ответах ИИ (ИИ-Агент, Помощник, Помощник по откликам, юрист, ипотека, автоответы) ----------
  // 1) адрес («Тоннельная, 18», «ул. Цюрупы 34») и «ЖК Название» в тексте ответа → ссылка на объявление, если объект есть в карточках этого ответа;
  // 2) перечисление (список, где ≥ 2 строк с объектами) — маленькое фото слева от строки; 3) наведение на ссылку/фото — всплывающая карточка
  // (фото, цена, что за объект, адрес, «Открыть», «📍 На карте»). Данные — из карточек на странице, остальное — действием items (до 60, без «просмотрено»).
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const info = new Map(), dom = new Map(), wait = new Map(); let qn = new Set(), qt = 0;   // info — с сервера (items), dom — из карточек на странице
  // адреса кадров — как в карточках (sec/helper.js phUrl); нижние 5 % кадра срезаются в CSS — там водяные знаки площадок
  const photoAt = (x, k) => x?.pics?.[k] || (x?.web_photos ? (x.web_photos_v === 3 ? `${MEDIA}/${x.num}/${k}.jpg` : k < 4 ? `${PH}/${x.num}/${k}.jpg` : `${MEDIA}/${x.num}/${k}.webp`) : !k ? x?.photo || null : null);
  const photoOf = x => photoAt(x, 0);
  const photosOf = x => { const n = Math.min(15, Math.max(x?.pics?.length || 0, x?.web_photos || 0)); return n ? Array.from({ length: n }, (_, k) => photoAt(x, k)).filter(Boolean) : [photoOf(x)].filter(Boolean); };
  function fetchInfo(nums) {
    const need = nums.filter(n => !info.has(n)); need.forEach(n => qn.add(n));
    const all = nums.map(n => info.has(n) ? Promise.resolve(info.get(n)) : (wait.get(n) ?? wait.set(n, new Promise(ok => { const t = setInterval(() => { if (info.has(n)) { clearInterval(t); ok(info.get(n)); } }, 120); setTimeout(() => { clearInterval(t); ok(info.get(n) ?? null); }, 9000); })).get(n)));
    if (qn.size && !qt) qt = setTimeout(async () => {
      const list = [...qn].slice(0, 60); qn = new Set([...qn].slice(60)); qt = 0;
      let token = null; try { token = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }
      const r = token && window.API ? await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'items', auth: { token }, nums: list }) }).then(r => r.json()).catch(() => null) : null;
      for (const x of r?.items ?? []) info.set(+x.num, { ...(info.get(+x.num) ?? {}), ...x });
      list.forEach(n => { if (!info.has(n)) info.set(n, null); });
    }, 60);
    return Promise.all(all);
  }
  // карточки на странице (Помощник, выдача, Помощник по откликам) — уже известные объекты
  function cardsIn(scope) {
    const out = [];
    scope.querySelectorAll('.card[data-num], .sai-card').forEach(c => {
      const num = +(c.dataset.num || c.querySelector('[data-num]')?.dataset.num); if (!num) return;
      const addr = (c.querySelector('.addr, .iv-addr, .sai-pl')?.textContent || '').replace(/^📍\s*/, '').trim();
      const zk = (c.querySelector('.zk')?.textContent || '').trim();
      const ph = c.querySelector('.strip img, .sai-strip img, img')?.getAttribute('src');
      const x = { num, addr, zk, photo: ph, price_t: c.querySelector('.price b, .sai-pr')?.textContent?.trim(), title_t: c.querySelector('.title, .sai-pa')?.textContent?.trim() };
      dom.set(num, { ...(dom.get(num) ?? {}), ...x });
      out.push(x);
    });
    return out;
  }
  const TYPE = /(^|\s)(ул|улица|пер|переулок|пр-т|пр-кт|просп|проспект|ш|шоссе|б-р|бульвар|наб|набережная|пл|площадь|туп|тупик|проезд|пр-д|мкр|мкр-н|микрорайон|аллея|г|с|пгт|пос)\.?(?=\s|,|$)/gi;
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function keyOf(addr) {   // «Тоннельная ул, 18 · Завокзальный» → { stem: 'Тоннельн', house: '18' }
    const a = String(addr).split('·')[0].replace(/,?\s*Сочи\b/i, '');
    const m = /^(.*?)[\s,]+(?:д\.?\s*)?(\d{1,4}(?:\s?[а-яa-z](?![а-яa-z]))?(?:\s*[/-]\s*\d{1,4}[а-я]?)?(?:\s*к\.?\s*\d+)?)\s*(?:,|$)/i.exec(a);
    if (!m) return null;
    const words = m[1].replace(TYPE, ' ').split(/[\s,]+/).filter(w => /^[А-ЯЁа-яё-]{4,}$/.test(w));
    const w = words.sort((p, q) => q.length - p.length)[0]; if (!w) return null;
    return { stem: w.slice(0, Math.max(4, w.length - 2)), house: m[2].replace(/\s+/g, '') };
  }
  function mention(scope, textSel, extra = []) {
    const xs = [...cardsIn(scope), ...extra.filter(e => !scope.querySelector(`.card[data-num="${e.num}"]`))]; if (!xs.length) return;
    const pats = [];
    for (const x of xs) {
      const k = keyOf(x.addr);
      if (k) pats.push({ num: x.num, re: new RegExp(`(?<![А-ЯЁа-яё])${reEsc(k.stem)}[А-ЯЁа-яё-]*[^\\d\\n]{0,18}?${reEsc(k.house).replace(/([а-я])$/i, '\\s?$1')}(?![\\dА-ЯЁа-яё/])`, 'i') });
      const z = x.zk.replace(/^ЖК\s*/i, '').replace(/[«»"]/g, '').trim();
      if (z.length >= 4 && xs.filter(y => y.zk === x.zk).length === 1) pats.push({ num: x.num, re: new RegExp(`ЖК\\s*[«"]?${reEsc(z.split(/\s+/)[0].slice(0, Math.max(4, z.split(/\s+/)[0].length - 1)))}[А-ЯЁа-яё-]*(?:\\s+[А-ЯЁа-яё-]+)?[»"]?`, 'i') });
    }
    if (!pats.length) return;
    scope.querySelectorAll(textSel).forEach(box => {
      const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest(SKIP) ? 3 : 1 }), texts = [];
      while (w.nextNode()) texts.push(w.currentNode);
      for (const t of texts) {
        let best = null;
        for (const p of pats) { const m = p.re.exec(t.data); if (m && (!best || m.index < best.m.index)) best = { m, p }; }
        if (!best) continue;
        const { m, p } = best, a = document.createElement('a');
        a.className = 'objlink objm'; a.href = `./#o=${p.num}`; a.dataset.obj = p.num; a.title = `Открыть объявление № ${p.num}`; a.textContent = m[0];
        const rest = t.splitText(m.index); rest.data = rest.data.slice(m[0].length); t.after(a);
        texts.push(rest);   // в остатке строки могут быть ещё объекты
      }
    });
  }
  // v5.57 (Алексей 11.11): номер объекта без «№» («260015 Сочи-Парк…», «**260537** — ЖК…») — ИИ так пишет, когда сравнивает выбранные объекты
  // и карточек в ответе нет. Номер становится ссылкой, только если объект есть (проверка действием items) — цены, индексы и годы не трогаются.
  // По найденным объектам дальше ищутся их адреса и ЖК, как по карточкам.
  const BARE = /(?<![\d.,+\/№#=:-]|\d[\s\u00a0])(\d{6,7})(?![\d.,]\d|[\s\u00a0]?\d|[\s\u00a0]?(?:₽|р\.|руб|тыс|млн|м²|м2|кв|%|г\.|год))/g;
  const textsIn = box => { const w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest(SKIP) ? 3 : 1 }), out = []; while (w.nextNode()) out.push(w.currentNode); return out; };
  function bare(scope, textSel) {
    const boxes = [...scope.querySelectorAll(textSel)]; if (scope.matches?.(textSel)) boxes.push(scope);
    const cand = new Set();
    for (const b of boxes) for (const t of textsIn(b)) for (const m of t.data.matchAll(BARE)) cand.add(+m[1]);
    if (!cand.size) return;
    fetchInfo([...cand].slice(0, 60)).then(() => {
      const ok = new Set([...cand].filter(n => info.get(n)));
      if (!ok.size || !scope.isConnected) return;
      for (const b of boxes) for (const t0 of textsIn(b)) {
        let t = t0;
        for (;;) {
          BARE.lastIndex = 0; let m; while ((m = BARE.exec(t.data)) && !ok.has(+m[1]));
          if (!m) break;
          const a = document.createElement('a'); a.className = 'objlink objm'; a.href = `./#o=${m[1]}`; a.dataset.obj = m[1]; a.title = `Открыть объявление № ${m[1]}`; a.textContent = m[1];
          const rest = t.splitText(m.index); rest.data = rest.data.slice(m[1].length); t.after(a); t = rest;
        }
      }
      const extra = [...ok].map(n => { const x = info.get(n); return { num: n, addr: x.address || x.street || '', zk: x.complex ? `ЖК ${x.complex}` : '' }; });
      mention(scope, textSel, extra.filter(e => extra.filter(y => y.zk && y.zk === e.zk).length <= 1 || !e.zk));
      thumbs(scope);
    });
  }
  // перечисление объектов: строки списка (и строки таблицы ИИ — p.md-row, абзацы, начинающиеся с объекта) — маленькое фото слева
  function rows(l) {
    if (l.tagName === 'UL' || l.tagName === 'OL') return [...l.children].filter(li => li.tagName === 'LI' && li.querySelector('a.objlink[data-obj]'));
    // блок абзацев: строка, где объект назван в начале (первые 40 знаков)
    return [...l.children].filter(p => p.tagName === 'P' && (() => { const a = p.querySelector('a.objlink[data-obj]'); if (!a) return false;
      const r = document.createRange(); r.setStart(p, 0); r.setEndBefore(a); return r.toString().replace(/[\s*—–-]+/g, ' ').trim().length <= 40; })());
  }
  function thumbs(root) {
    root.querySelectorAll?.('ul, ol, .md').forEach(l => {
      if (l.closest('.objpop, .op-hov, .hub-cards, nav, .mg-p, .sp-menu')) return;
      const lis = rows(l);
      if (lis.length < 2) return;
      const nums = [];
      lis.forEach(li => { if (li.querySelector(':scope > .objm-th')) return; const n = +li.querySelector('a.objlink[data-obj]').dataset.obj; nums.push(n);
        li.insertAdjacentHTML('afterbegin', `<span class="objm-th" data-obj="${n}"><img alt="" loading="lazy" referrerpolicy="no-referrer"></span>`); li.classList.add('objm-li'); });
      if (!nums.length) return;
      fetchInfo([...new Set(nums)]).then(() => lis.forEach(li => { const th = li.querySelector(':scope > .objm-th'), im = th?.querySelector('img'); if (!im || im.src) return; const u = dom.get(+th.dataset.obj)?.photo || photoOf(info.get(+th.dataset.obj)); if (u) im.src = u; else th.classList.add('none'); }));
    });
  }
  // v5.57: все окна ИИ — Помощник и ИИ-Агент, Помощник по откликам, юрист и ипотека (.hub-msgs .hub-msg.ai), чат ИИ в сделке, заключения юриста, Помощь, Управляющий
  const SCOPES = [['.hub-turn', '.hub-reply'], ['.sai-ov', '.sai-sum, .sai-box, .sai-why'], ['.ag-msgs, .chat, .law-chat', '.msg, .m-text, .bubble'],
    ['.hub-msgs, .lw-grp, .dl-sec', '.hub-msg.ai, .dl-note'], ['#sup', '.sup-msg.sup-ai, .sup-msg.sup-agent'], ['#mg-chat, #mg-right', '.mg-msg:not(.mg-owner), .mg-logt']];
  function scan(n) {
    if (n.nodeType !== 1) return;
    for (const [sc, txt] of SCOPES) { const list = n.matches(sc) ? [n] : [...n.querySelectorAll(sc)]; if (n.closest?.(sc)) list.push(n.closest(sc)); new Set(list).forEach(s => { mention(s, txt); bare(s, txt); }); }
    thumbs(n.closest?.('ul, ol')?.parentElement ?? n);
  }
  // всплывающая карточка при наведении (компьютер)
  let hov = null, hovT = 0, hovN = 0;
  const hide = () => { clearTimeout(hovT); hovT = setTimeout(() => { hov?.remove(); hov = null; hovN = 0; }, 180); };
  const what = x => x.title_t || [x.rooms === 0 ? 'Студия' : x.rooms ? `${x.rooms}-комн.` : '', x.area ? `${String(x.area).replace('.', ',')} м²` : '', x.floor ? `${x.floor}${x.floors ? `/${x.floors}` : ''} эт.` : ''].filter(Boolean).join(' · ');
  function showHov(el) {
    const n = +el.dataset.obj; if (!n || hovN === n && hov) return;
    hovN = n; hov?.remove();
    hov = document.createElement('div'); hov.className = 'op-hov'; hov.innerHTML = '<div class="op-hw">Загружаю № ' + n + '…</div>';
    document.body.appendChild(hov);
    const place = () => { if (!hov) return; const r = el.getBoundingClientRect(), w = hov.offsetWidth, h = hov.offsetHeight;
      let x = Math.min(innerWidth - w - 8, Math.max(8, r.left)), y = r.bottom + 6; if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
      hov.style.left = x + 'px'; hov.style.top = y + 'px'; };
    place();
    hov.addEventListener('mouseenter', () => clearTimeout(hovT)); hov.addEventListener('mouseleave', hide);
    fetchInfo([n]).then(([x0]) => {
      if (!hov || hovN !== n) return;
      const x = x0 ? { ...(dom.get(n) ?? {}), ...x0 } : dom.get(n) ?? null;
      if (!x) { hov.innerHTML = `<div class="op-hw">№ ${n} — объявление снято или недоступно</div>`; return; }
      const phs = photosOf(x), price = x.price ? `${Math.round(x.price).toLocaleString('ru-RU')} ₽` : x.price_t || '';
      const ad = [x.street || x.address || x.addr, x.sub || x.district].filter(Boolean).join(' · ');
      hov.innerHTML = `${phs.length ? `<div class="op-hph" data-n="${phs.length}"><img src="${esc(phs[0])}" alt="" referrerpolicy="no-referrer">${phs.length > 1 ? `<span class="op-hd">${phs.map((_, k) => `<i${k ? '' : ' class="on"'}></i>`).join('')}</span><span class="op-hc">1 / ${phs.length}</span>` : ''}</div>` : ''}<div class="op-hb"><b>${esc(price)}</b><span>${esc(what(x))}</span>${x.zk || x.complex ? `<span class="op-hz">${esc(x.zk || x.complex)}</span>` : ''}
        ${ad ? `<span class="op-ha">📍 ${esc(ad)}</span>` : ''}<span class="op-hf"><button type="button" class="op-hbtn" data-obj="${n}">Открыть</button><button type="button" class="op-hbtn soft" data-mm data-num="${n}"${x.lat != null ? ` data-lat="${x.lat}" data-lng="${x.lng}"` : ''} data-place="${esc(ad)}">📍 На карте</button><small>№ ${n}</small></span></div>`;
      place();
      // быстрое листание, как в выдаче: ведёте мышкой по фото — кадры меняются, полоски внизу; кадра нет — пропускается
      const box = hov.querySelector('.op-hph'); if (!box || phs.length < 2) return;
      const im = box.querySelector('img'), bad = new Set();
      phs.slice(1, 6).forEach(u => { const p = new Image(); p.referrerPolicy = 'no-referrer'; p.src = u; });
      const go = k => { if (box.dataset.k == k) return; box.dataset.k = k; im.src = phs[k]; box.querySelectorAll('.op-hd i').forEach((d, i) => d.classList.toggle('on', i === k)); box.querySelector('.op-hc').textContent = `${k + 1} / ${phs.length}`; };
      im.addEventListener('error', () => { const k = +box.dataset.k || 0; bad.add(k); const nx = phs.findIndex((_, i) => i > k && !bad.has(i)); if (nx > 0) go(nx); });
      box.addEventListener('mousemove', e => { const r = box.getBoundingClientRect(); let k = Math.max(0, Math.min(phs.length - 1, Math.floor((e.clientX - r.left) / r.width * phs.length))); while (bad.has(k) && k > 0) k--; go(k); });
      box.addEventListener('mouseleave', () => go(0));
    });
  }
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('mouseover', e => { const a = e.target.closest?.('a.objlink[data-obj], .objm-th'); if (!a || a.closest('.op-hov')) return; clearTimeout(hovT); hovT = setTimeout(() => showHov(a), 260); });
    document.addEventListener('mouseout', e => { if (e.target.closest?.('a.objlink[data-obj], .objm-th')) hide(); });
  }
  document.addEventListener('click', e => { if (hov && !e.target.closest('.op-hov')) { hov.remove(); hov = null; hovN = 0; } else if (e.target.closest('.op-hov [data-obj], .op-hov [data-mm]')) setTimeout(() => { hov?.remove(); hov = null; hovN = 0; }, 0); }, true);
  const css = `.op-hov{position:fixed;z-index:2147483600;width:290px;background:var(--card,#fff);color:var(--text,#121722);border:1px solid var(--line,#e3e7ee);border-radius:14px;box-shadow:0 14px 40px rgba(0,0,0,.28);overflow:hidden;font-size:13.5px;line-height:1.35}
    .op-hph{position:relative;aspect-ratio:4/3;overflow:hidden;background:var(--soft,#eef2f7);cursor:ew-resize}.op-hph img{display:block;width:100%;height:calc(100% / .95);object-fit:cover;object-position:center top}
    .op-hd{position:absolute;left:8px;right:8px;bottom:7px;display:flex;gap:3px;pointer-events:none}.op-hd i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.45)}.op-hd i.on{background:#fff}
    .op-hc{position:absolute;right:8px;top:8px;font-size:11.5px;font-weight:600;padding:2px 7px;border-radius:99px;background:rgba(0,0,0,.55);color:#fff;pointer-events:none}.op-hw{padding:14px;color:var(--muted,#6b7280)}
    .op-hb{display:flex;flex-direction:column;gap:3px;padding:10px 12px 12px}.op-hb b{font-size:17px}.op-hz{font-weight:600}.op-ha{color:var(--muted,#6b7280)}
    .op-hf{display:flex;align-items:center;gap:6px;margin-top:6px}.op-hf small{margin-left:auto;color:var(--muted,#6b7280)}
    .op-hbtn{border:0;border-radius:8px;padding:7px 11px;font:inherit;font-weight:600;cursor:pointer;background:var(--accent,#1f6fb2);color:var(--accent-text,#fff)}.op-hbtn.soft{background:var(--soft,#eef2f7);color:var(--link,#1f6fb2)}
    li.objm-li{list-style-position:outside}p.objm-li{overflow:hidden}p.objm-li .objm-th{margin-top:0}.objm-th{float:left;width:56px;height:42px;overflow:hidden;border-radius:7px;margin:2px 10px 4px 0;background:var(--soft,#eef2f7);cursor:pointer}.objm-th img{display:block;width:100%;height:calc(100% / .95);object-fit:cover;object-position:center top}.objm-th.none{visibility:hidden}
    li.objm-li::after{content:'';display:block;clear:both}a.objm{white-space:normal}`;
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);
  // строка адреса → карта (minimap.js) — подгрузить на любой странице с объявлениями
  if (!window.MINIMAP && !document.querySelector('script[src^="minimap.js"]')) { const sc = document.createElement('script'); sc.src = 'minimap.js?v=5.54'; sc.defer = true; document.head.appendChild(sc); }
  const scanAll = () => scan(document.body);
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', scanAll) : scanAll();
  new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && !n.closest('.op-hov')) scan(n); }).observe(document.documentElement, { childList: true, subtree: true });
  window.OBJPOP = { open, close, link, mention, info: fetchInfo };
})();


// v5.49 (п. 6): краткий курс по сервису после регистрации — 8 шагов, ~1,5 минуты. Подсвечивает настоящие кнопки главной.
// Сам запускается один раз после регистрации (localStorage 'tour_due' ставит app.js); кто зарегистрирован раньше — одна карточка
// «Пройти курс за минуту?»; всегда — Меню → «🎓 Краткий курс» (./#tour). Пройден/пропущен — 'tour_done'.
(() => {
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
  const mob = () => matchMedia('(max-width: 760px)').matches;
  const vis = el => el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const pick = (...q) => { for (const s of q) { const el = typeof s === 'function' ? s() : document.querySelector(s); if (vis(el)) return el; } return null; };
  const STEPS = [
    { t: '👋 Добро пожаловать в «Для Агента»', p: 'За минуту покажу главное: как найти объект от собственника, собрать подборку клиенту, связаться с собственником и поручить работу ИИ-Агенту.' },
    { el: () => pick('#qform', '#q'), t: '🔍 Поиск словами или голосом', p: 'Пишите как говорите: «2к до 15 млн Мамайка у моря» или «студия с ремонтом в Адлере». 🎤 в поле — то же голосом. Сайт сам поймёт тип, цену и район.' },
    { el: () => pick('#toggle-f'), t: '🎛 Фильтры', p: 'Районы и ЖК на карте, площадь, этаж, ремонт, до моря. Включите комиссию — цены покажутся сразу с ней (шаг 50 тыс.).' },
    { el: () => pick('.card .pick', '#list .card'), t: '☑️ Отметьте объекты', p: '«Выбрать» на карточках — снизу появится панель: 📄 подборка-ссылка клиенту (он отмечает «нравится»), реклама, рассылка, видео.' },
    { el: () => pick('.card .ph-dd > summary', '.card .phone'), t: '📞 Связаться с собственником', p: 'Телефон, WhatsApp, MAX и Telegram в одном меню. Номера открываются по тарифу — остаток видно в «Профиле».' },
    { el: () => pick('#ag-fabs .ag-open', '#ag-fabs'), t: '✨ ИИ-Агент — ваш помощник', p: 'Скажите или напишите задачу: «подбери 3 лучших до 12 млн у моря и сделай подборку», «напиши собственникам», «поставь показ на завтра». 🎤 — голосом, страница не закрывается: ответ придёт карточкой.' },
    { el: () => pick('#burger', '#menu'), t: '☰ Все разделы', p: 'Мои подборки (что открывал и выбрал клиент, ответы собственников), Клиенты CRM и задачи, Реклама и рассылки, Сделка и юрист, Эксклюзивы коллег, Партнёрам.' },
    { el: () => pick('#go-prof'), t: '👤 Профиль', p: 'Тариф, остаток номеров, устройства. Подключите Telegram-бот — туда придут ответы собственников и отклики клиентов. Курс всегда можно повторить: Меню → «🎓 Краткий курс».' },
  ];
  let i = 0, ov = null, hole = null, tip = null;
  const css = `.tr-ov{position:fixed;inset:0;z-index:4000;pointer-events:auto}
    .tr-hole{position:fixed;z-index:4001;border-radius:14px;box-shadow:0 0 0 9999px rgba(8,12,20,.62);transition:all .25s ease;pointer-events:none;outline:3px solid #ffcf33;outline-offset:2px}
    .tr-hole.c{width:0;height:0;left:50%;top:45%;outline:0}
    .tr-tip{position:fixed;z-index:4002;width:min(360px,calc(100vw - 24px));box-sizing:border-box;background:var(--card,#fff);color:var(--text,#121722);border-radius:16px;padding:16px 16px 12px;box-shadow:0 16px 48px rgba(0,0,0,.35);font-size:15px;line-height:1.45;transition:top .25s ease,left .25s ease}
    .tr-tip b{display:block;font-size:17px;margin:0 0 6px}.tr-tip p{margin:0 0 12px}
    .tr-row{display:flex;align-items:center;gap:8px}.tr-row .tr-n{flex:1;font-size:13px;opacity:.7}
    .tr-dots{display:flex;gap:4px;margin:0 0 10px}.tr-dots i{flex:1;height:4px;border-radius:2px;background:color-mix(in srgb,currentColor 18%,transparent)}.tr-dots i.on{background:#ffcf33}
    .tr-row .btn{min-height:42px}`;
  function place() {
    const s = STEPS[i], el = s.el?.();
    const W = innerWidth, H = innerHeight, tw = Math.min(360, W - 24);
    if (!el) { hole.className = 'tr-hole c'; Object.assign(hole.style, { left: '50%', top: '45%', width: '0px', height: '0px' }); Object.assign(tip.style, { left: (W - tw) / 2 + 'px', top: Math.max(12, H * 0.28) + 'px' }); return; }
    const r = el.getBoundingClientRect(), pad = 6;
    hole.className = 'tr-hole';
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const th = tip.offsetHeight || 200, below = r.bottom + 14, above = r.top - 14 - th;
    const top = below + th < H - 8 ? below : above > 8 ? above : Math.max(8, H - th - 8);
    const left = Math.max(12, Math.min(W - tw - 12, r.left + r.width / 2 - tw / 2));
    Object.assign(tip.style, { left: left + 'px', top: top + 'px' });
  }
  function show() {
    const s = STEPS[i], el = s.el?.();
    if (s.el && !el) { i += dir; if (i < 0 || i >= STEPS.length) return end(true); return show(); }   // кнопки нет на экране (например, нет карточек) — шаг пропускаем
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 40) el.scrollIntoView({ block: 'center' }); }
    tip.innerHTML = `<div class="tr-dots">${STEPS.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div><b>${s.t}</b><p>${s.p}</p>
      <div class="tr-row"><span class="tr-n">${i + 1} из ${STEPS.length}</span>${i ? '<button type="button" class="btn ghost" data-tr="back">Назад</button>' : '<button type="button" class="btn ghost" data-tr="skip">Пропустить</button>'}
      <button type="button" class="btn primary" data-tr="next">${i === STEPS.length - 1 ? 'Готово 🎉' : 'Далее'}</button></div>`;
    requestAnimationFrame(place); setTimeout(place, 300);
  }
  let dir = 1;
  function start() {
    end(false); i = 0; dir = 1;
    window.AGENT?.minimize?.(); document.getElementById('ag-tour-offer')?.remove();
    if (!document.getElementById('tr-css')) { const st = document.createElement('style'); st.id = 'tr-css'; st.textContent = css; document.head.appendChild(st); }
    ov = document.createElement('div'); ov.className = 'tr-ov'; hole = document.createElement('div'); hole.className = 'tr-hole c';
    tip = document.createElement('div'); tip.className = 'tr-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', 'Краткий курс');
    document.body.append(ov, hole, tip);
    tip.onclick = e => { const k = e.target.closest('[data-tr]')?.dataset.tr; if (!k) return;
      if (k === 'skip') return end(true);
      dir = k === 'back' ? -1 : 1; i += dir; if (i >= STEPS.length) return end(true); if (i < 0) i = 0; show(); };
    ov.onclick = () => { dir = 1; i++; if (i >= STEPS.length) return end(true); show(); };
    addEventListener('resize', place); addEventListener('scroll', place, { passive: true });
    document.addEventListener('keydown', key);
    show();
  }
  const key = e => { if (e.key === 'Escape') end(true); if (e.key === 'ArrowRight') { i++; if (i >= STEPS.length) return end(true); dir = 1; show(); } if (e.key === 'ArrowLeft' && i) { i--; dir = -1; show(); } };
  function end(done) {
    [ov, hole, tip].forEach(x => x?.remove()); ov = hole = tip = null;
    removeEventListener('resize', place); removeEventListener('scroll', place); document.removeEventListener('keydown', key);
    if (done) { set('tour_done', Date.now()); set('tour_due', null); }
  }
  function offer() {
    if (document.getElementById('ag-tour-offer')) return;
    const d = document.createElement('div'); d.id = 'ag-tour-offer'; d.className = 'ag-card agent-only'; d.setAttribute('role', 'status');
    d.innerHTML = `<button type="button" class="ag-x" aria-label="Закрыть">✕</button><b>🎓 Краткий курс — 1 минута</b><p>Покажу главное: поиск голосом, подборка клиенту, связь с собственником, ИИ-Агент.</p>
      <div class="ag-row"><button type="button" class="btn primary" data-go>Пройти</button><button type="button" class="btn ghost" data-no>Не нужно</button></div>`;
    document.body.appendChild(d);
    d.onclick = e => { if (e.target.closest('[data-go]')) { d.remove(); start(); } else if (e.target.closest('[data-no], .ag-x')) { d.remove(); set('tour_done', Date.now()); } };
  }
  // app.js зовёт после входа; me — из init
  function auto(me) {
    if (!me || me.guest || me.role === 'client' || window.parent !== window) return;
    if (location.hash === '#tour') { history.replaceState(null, '', location.pathname + location.search); return setTimeout(start, 1500); }
    if (get('tour_due')) return setTimeout(start, 2500);
    if (!get('tour_done') && !sessionStorage.getItem('tour_off')) { sessionStorage.setItem('tour_off', '1'); setTimeout(offer, 9000); }
  }
  addEventListener('hashchange', () => { if (location.hash === '#tour') { history.replaceState(null, '', location.pathname + location.search); start(); } });
  window.TOUR = { start, auto };
})();

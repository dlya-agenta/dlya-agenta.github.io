// «Подключения» (v5.16, пп. 5–6): окно живого входа — экран настоящего браузера на нашем сервере (кадр раз в ~0,7 с). Человек сам нажимает
// на экран, печатает (прямо с клавиатуры или полем «Ввести»), листает — входит, как в обычном браузере (QR, номер и код, пароль, капча).
// Ввод уходит в функцию auto и шифруется там ключом сервера; сессия остаётся на сервере в зашифрованном виде. Сервер — auto/conn.ts, worker/conn.ts.
// window.CONN.open(svc, {onOk, title}) — открыть окно; CONN.call(action, extra) — запрос к auto.
window.CONN = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const URL_ = () => String(window.API).replace(/\/web$/, '/auto');
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  async function call(action, extra = {}) {
    const r = await fetch(URL_(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() }, ...extra }) });
    const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
    if (!r.ok || d.error) throw Object.assign(new Error(d.message || d.error || `HTTP ${r.status}`), { code: d.error, status: r.status });
    return d;
  }
  const KEYS = { Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Escape: 'Escape', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Delete: 'Delete' };

  function open(svc, o = {}) {
    const d = document.createElement('div');
    d.className = 'sheet conn-sheet';
    d.innerHTML = `<div class="sheet-box conn-box" role="dialog" aria-modal="true" aria-label="Вход">
      <div class="sheet-head"><b>${esc(o.title ?? 'Вход')}</b><button class="btn ghost" data-x aria-label="Закрыть">✕</button></div>
      <p class="hint conn-msg" id="cn-msg">Открываем браузер на нашем сервере…</p>
      <div class="conn-scr" id="cn-scr" tabindex="0" title="Нажимайте на экран и печатайте, как в обычном браузере"><img id="cn-img" alt="Экран входа" draggable="false"><div class="conn-wait" id="cn-wait"><div class="spinner"></div><span>Загружаем страницу входа — 5–20 секунд</span></div></div>
      <div class="conn-tools">
        <input id="cn-text" placeholder="Текст для ввода (номер, код, логин, пароль)" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="btn primary" data-type>Ввести</button><button class="btn soft" data-key="Enter">⏎ Enter</button><button class="btn soft" data-key="Backspace">⌫</button>
        <button class="btn soft" data-key="Tab">Tab</button><button class="btn ghost" data-wheel="-500" title="Прокрутить вверх">▲</button><button class="btn ghost" data-wheel="500" title="Прокрутить вниз">▼</button>
        <button class="btn ghost" data-back title="Назад">‹ Назад</button><button class="btn ghost" data-reload title="Обновить страницу">⟳</button></div>
      <p class="hint">Нажимайте прямо на экран — нажатие и текст передаются в браузер сервера (задержка ~1 с). Пароль и коды шифруются и нигде не сохраняются; хранится только вход — в зашифрованном виде на нашем сервере. Отключить можно в «🔗 Мессенджеры и соцсети».</p></div>`;
    document.body.appendChild(d);
    const img = d.querySelector('#cn-img'), scr = d.querySelector('#cn-scr'), msg = d.querySelector('#cn-msg'), txt = d.querySelector('#cn-text');
    let seq = 0, w = 1000, h = 720, alive = true, buf = '', bufT = null, done = false, started = Date.now();
    const send = ev => call('conn_input', { svc, ev }).catch(e => { msg.textContent = e.message; });
    const flush = () => { clearTimeout(bufT); if (buf) { const v = buf; buf = ''; send([{ t: 'text', v }]); } };
    const close = async () => { alive = false; flush(); d.remove(); if (!done) await call('conn_stop', { svc }).catch(() => null); o.onClose?.(); };
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-x]')) return close();
      const k = e.target.closest('[data-key]'); if (k) { flush(); send([{ t: 'key', k: k.dataset.key }]); return; }
      const wl = e.target.closest('[data-wheel]'); if (wl) { send([{ t: 'wheel', dy: +wl.dataset.wheel }]); return; }
      if (e.target.closest('[data-back]')) { send([{ t: 'back' }]); return; }
      if (e.target.closest('[data-reload]')) { send([{ t: 'reload' }]); return; }
      if (e.target.closest('[data-type]')) { if (txt.value) { send([{ t: 'text', v: txt.value }]); txt.value = ''; } txt.focus(); return; }
    });
    txt.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (txt.value) { send([{ t: 'text', v: txt.value }, { t: 'key', k: 'Enter' }]); txt.value = ''; } else send([{ t: 'key', k: 'Enter' }]); } });
    // нажатие на экран → координаты страницы сервера
    img.addEventListener('click', e => {
      const r = img.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) * w / r.width), y = Math.round((e.clientY - r.top) * h / r.height);
      flush(); send([{ t: 'click', x, y }]);
      const dot = document.createElement('i'); dot.className = 'conn-dot'; dot.style.left = `${e.clientX - r.left}px`; dot.style.top = `${e.clientY - r.top}px`; scr.appendChild(dot); setTimeout(() => dot.remove(), 600);
      scr.focus();
    });
    let wheelT = null, wheelDy = 0;
    scr.addEventListener('wheel', e => { e.preventDefault(); wheelDy += e.deltaY; clearTimeout(wheelT); wheelT = setTimeout(() => { send([{ t: 'wheel', dy: Math.round(wheelDy) }]); wheelDy = 0; }, 250); }, { passive: false });
    // печать прямо с клавиатуры, когда экран в фокусе
    scr.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (KEYS[e.key]) { e.preventDefault(); flush(); send([{ t: 'key', k: KEYS[e.key] }]); return; }
      if (e.key.length === 1) { e.preventDefault(); buf += e.key; clearTimeout(bufT); bufT = setTimeout(flush, 350); }
    });
    scr.addEventListener('paste', e => { const v = e.clipboardData?.getData('text'); if (v) { e.preventDefault(); flush(); send([{ t: 'text', v }]); } });

    (async () => {
      try { await call('conn_start', { svc }); } catch (e) { msg.innerHTML = `<span class="err">${esc(e.message)}</span>`; d.querySelector('#cn-wait').hidden = true; return; }
      while (alive) {
        try {
          const f = await call('conn_frame', { svc, seq });
          if (f.img) { seq = f.seq; w = f.w || w; h = f.h || h; img.src = `data:image/jpeg;base64,${f.img}`; d.querySelector('#cn-wait').hidden = true; }
          if (f.message) msg.textContent = f.message;
          if (f.status === 'ok') { done = true; msg.innerHTML = '✅ Подключено! Сессия сохранена на нашем сервере в зашифрованном виде.'; scr.classList.add('ok'); o.onOk?.(); setTimeout(() => { if (alive) close(); }, 2500); return; }
          if (['error', 'need', 'none'].includes(f.status) && Date.now() - started > 4000) { done = true; msg.innerHTML = `<span class="err">${esc(f.message || 'Вход не удался')}</span> <button class="btn soft" data-again>Начать заново</button>`;
            d.querySelector('[data-again]')?.addEventListener('click', () => { close(); open(svc, o); }); d.querySelector('#cn-wait').hidden = true; return; }
        } catch (e) { msg.textContent = e.message; }
        await new Promise(r => setTimeout(r, document.hidden ? 2000 : 700));
      }
    })();
    setTimeout(() => scr.focus(), 300);
    return { close };
  }
  return { open, call };
})();

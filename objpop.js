// v5.47 E (Алексей, п. 6): «№ 150017» и «#150017» в текстах (Помощник, CRM, сделки, чаты, заметки) — подсвеченная ссылка; нажатие открывает
// объявление окном поверх текущей страницы, без перехода. На главной — своё окно объявления (window.APP_OPEN_ITEM из app.js),
// на других страницах — главная в рамке (./?embed=1#o=N): то же окно с фото, телефоном и кнопками; закрыли окно — рамка закрывается.
(() => {
  const RE = /(№\s?|#)(\d{6,7})(?!\d)/g;
  const SKIP = 'a, button, input, textarea, select, option, script, style, code, pre, svg, [contenteditable], .objpop, .sheet-title, #sheet-title, .no-objlink';
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
  window.OBJPOP = { open, close, link };
})();

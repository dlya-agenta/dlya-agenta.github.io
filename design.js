// Оформление сайта (v5.5): два варианта — A «Море» (по умолчанию) и B «Песок». Кнопка «🎨 Стиль» в меню ([data-style]) переключает их сразу,
// без перезагрузки; выбор запоминается в браузере (localStorage design). Файлы design-a.css / design-b.css — поверх style.css. ?design=a|b — открыть нужный.
(() => {
  const V = '5.5', NAMES = { a: 'Море', b: 'Песок' };
  const q = new URLSearchParams(location.search).get('design');
  let d = q === 'a' || q === 'b' ? q : null;
  try { if (d) localStorage.setItem('design', d); else d = localStorage.getItem('design'); } catch { /* приватный режим */ }
  if (d !== 'a' && d !== 'b') d = 'a';
  document.write(`<link rel="stylesheet" id="design-css" href="design-${d}.css?v=${V}">`);
  const label = () => document.querySelectorAll('[data-style]').forEach(b => {
    b.textContent = `🎨 Стиль: ${NAMES[d]}`; b.title = `Сменить оформление на «${NAMES[d === 'a' ? 'b' : 'a']}»`; });
  // новый файл стилей подключается рядом со старым, старый убирается, когда новый загрузился, — без вспышки «голой» страницы
  function set(x) {
    if (x !== 'a' && x !== 'b' || x === d) return;
    d = x;
    try { localStorage.setItem('design', d); } catch { /* приватный режим */ }
    const old = document.getElementById('design-css'), l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `design-${d}.css?v=${V}`;
    l.onload = l.onerror = () => { old?.remove(); l.id = 'design-css'; };
    (old ?? document.head.lastChild).after(l);
    label();
  }
  window.DESIGN = { get: () => d, set };
  document.addEventListener('click', e => { if (e.target.closest('[data-style]')) set(d === 'a' ? 'b' : 'a'); });
  document.addEventListener('DOMContentLoaded', label);
})();

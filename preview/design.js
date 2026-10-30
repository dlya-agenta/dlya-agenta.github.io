// Варианты оформления (v5.5, на выбор Алексею): ?design=a | b | 0 — выбор запоминается в браузере (localStorage design) и подключает
// design-a.css («Море») или design-b.css («Песок») поверх style.css. Участники без ссылки видят прежнее оформление;
// переключатель внизу экрана — только в предпросмотре (папка /preview/) или после ?design=…
(() => {
  const V = '5.5', q = new URLSearchParams(location.search).get('design');
  let d = q;
  try { if (q !== null) localStorage.setItem('design', q); d = localStorage.getItem('design'); } catch { /* приватный режим */ }
  if (d === 'a' || d === 'b') document.write(`<link rel="stylesheet" href="design-${d}.css?v=${V}">`);
  if (!location.pathname.includes('/preview/') && q === null) return;
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.createElement('div');
    el.className = 'dsw';
    el.innerHTML = '<b>Оформление:</b>' + [['0', 'Сейчас'], ['a', 'A · Море'], ['b', 'B · Песок']]
      .map(([k, t]) => `<a href="?design=${k}${location.hash}" class="${(d === 'a' || d === 'b' ? d : '0') === k ? 'on' : ''}">${t}</a>`).join('');
    document.body.appendChild(el);
  });
})();

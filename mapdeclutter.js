// v5.52 (п. 1 Алексея 11.11): метки карт без наложений, как у Авито. После каждого сдвига/приближения и появления меток
// (MutationObserver в слое меток) метки-цены раскладываются по важности: «Низкая цена» и 💎 → крупные группы → остальные;
// метка, которая наехала бы на уже поставленную, становится точкой (цена — подсказкой при наведении, нажатие — как у метки).
// Использование: MAPDECLUTTER.attach(map) — для меток .mk-p / .mk-c (L.divIcon с <span>).
window.MAPDECLUTTER = (() => {
  const PAD = 4;
  const css = `.leaflet-marker-icon.mk-dot > span { font-size: 0 !important; line-height: 0; width: 12px; height: 12px; padding: 0 !important; border-radius: 50% !important;
      background: var(--accent, #1f6fb2) !important; border: 2px solid #fff; box-sizing: border-box; transform: translate(-50%, -50%) !important; animation: none !important;
      box-shadow: 0 1px 3px rgba(0,0,0,.35) !important; min-width: 0; }
    .leaflet-marker-icon.mk-dot > span::before, .leaflet-marker-icon.mk-dot > span::after { display: none !important; }
    .leaflet-marker-icon.mk-dot > span > * { display: none; }
    .leaflet-marker-icon.mk-dot.low > span { background: #15803d !important; }
    .leaflet-marker-icon.mk-dot.mk-x > span { background: #c9a24a !important; }
    .leaflet-marker-icon.mk-dot:hover > span { transform: translate(-50%, -50%) scale(1.35) !important; }
    .leaflet-marker-icon.mk-dot { z-index: 1 !important; }`;
  let styled = false;
  const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
  const count = e => +(e.querySelector('b')?.textContent ?? 1) || 1;
  function run(map) {
    const box = map.getContainer(); if (!box.isConnected || !box.offsetWidth) return;
    const R = box.getBoundingClientRect();
    const els = [...box.querySelectorAll('.leaflet-marker-pane .mk-p, .leaflet-marker-pane .mk-c')];
    els.forEach(e => e.classList.remove('mk-dot'));
    const items = [];
    els.forEach((e, i) => { const s = e.firstElementChild; if (!s) return; const r = s.getBoundingClientRect();
      if (!r.width || r.right < R.left || r.left > R.right || r.bottom < R.top || r.top > R.bottom) return;
      const c = e.classList.contains('mk-c');
      items.push({ e, s, r, pri: (e.classList.contains('low') ? 2e6 : 0) + (e.classList.contains('mk-x') ? 1e6 : 0) + (c ? 1000 + count(s) : 0), i }); });
    items.sort((a, b) => b.pri - a.pri || a.i - b.i);
    const placed = [];
    for (const it of items) {
      const r = it.r, hit = placed.some(p => r.left < p.right + PAD && r.right + PAD > p.left && r.top < p.bottom + PAD && r.bottom + PAD > p.top);
      if (hit) { it.e.classList.add('mk-dot'); it.e.title = it.s.textContent.trim(); } else { placed.push(r); it.e.removeAttribute('title'); }
    }
  }
  function attach(map) {
    if (!map || map._declutter) return; style();
    let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => requestAnimationFrame(() => run(map)), 60); };
    map._declutter = later;
    map.on('zoomend moveend resize viewreset', later);
    const pane = map.getPane('markerPane'); if (pane) new MutationObserver(later).observe(pane, { childList: true });
    later();
  }
  return { attach, run };
})();

// v5.23 (03.11.2026, просьба Алексея): подложка карт — Яндекс (ключ JavaScript API из админки: «Ключи, API и ИИ» → «Карта Яндекса»),
// без ключа или если Яндекс не загрузился — OpenStreetMap. Подпись источника — свёрнутый «ⓘ» на каждой карте.
// Использование: MAPBASE.add(map) вместо L.tileLayer(...).addTo(map). Ключ Яндекса браузерный — его и так видно в коде страницы.
window.MAPBASE = (() => {
  let cfg = null, ya = null;
  const OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const conf = () => cfg ??= fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'public' }) })
    .then(r => r.json()).then(d => d.map ?? {}).catch(() => ({}));
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const yandex = key => ya ??= (async () => {
    if (!window.ymaps) await load(`https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`);
    await new Promise((ok, no) => { const t = setTimeout(() => no(new Error('Яндекс не ответил')), 12000); ymaps.ready(() => { clearTimeout(t); ok(); }, no); });
    if (!L.Yandex) await load('https://cdnjs.cloudflare.com/ajax/libs/leaflet-plugins/3.4.0/layer/tile/Yandex.js');
  })();
  const note = (map, html) => map.getContainer().querySelectorAll('.map-info span, .ex-attr span').forEach(s => { s.innerHTML = html; });
  async function add(map) {
    map.options.maxZoom ??= 19;   // v5.23e: предел приближения сразу — подложка приходит после запроса public, а кластеры меток без maxZoom падают («Map has no maxZoom specified»)
    const c = await conf();
    if (c.yandex) {
      try {
        await yandex(c.yandex);
        const y = L.yandex('yandex#map', { maxZoom: 19, mapOptions: { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true,
          copyrightLogoVisible: false, copyrightProvidersVisible: false, copyrightUaVisible: false } }).addTo(map);
        setTimeout(() => note(map, '© <a href="https://yandex.ru/legal/maps_termsofuse/" target="_blank" rel="noopener">Яндекс Карты</a>'), 50);
        return y;
      } catch (e) { console.warn('Карта Яндекса не загрузилась — OpenStreetMap', e); ya = null; }
    }
    return L.tileLayer(OSM, { maxZoom: 19 }).addTo(map);
  }
  return { add };
})();

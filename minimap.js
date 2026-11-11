// v5.53 (Алексей 11.11): «посмотреть на карте» прямо из карточки — клик по строке адреса открывает маленькую карту поверх, без перехода в объявление.
// MINIMAP.open({ num, lat, lng, title, place }) — координаты есть (выдача, точка карты) — сразу; нет (Помощник по откликам) — берём у сервера действием item
// (только агент: в ссылке клиента со скрытым адресом карта — своя, s.js sel_map, только улица). Нужны Leaflet и mapbase.js на странице.
window.MINIMAP = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let box = null, m = null;
  const css = `.mm-ov{position:fixed;inset:0;z-index:2147483400;background:rgba(8,12,20,.5);display:flex;align-items:center;justify-content:center;padding:16px}
    .mm-box{position:relative;width:min(720px,100%);height:min(520px,calc(100vh - 32px));background:var(--card,#fff);color:var(--text,#121722);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.35)}
    .mm-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line,#e5e7eb)}
    .mm-head b{flex:1;min-width:0;font-size:15.5px;line-height:1.3;overflow-wrap:anywhere}.mm-head small{display:block;font-weight:400;color:var(--muted,#6b7280);font-size:13px}
    .mm-x{border:0;background:var(--soft,#eef2f7);color:inherit;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;flex:none}
    .mm-map{flex:1;min-height:0}.mm-wait{padding:24px;color:var(--muted,#6b7280)}
    @media(max-width:560px){.mm-ov{padding:0;align-items:flex-end}.mm-box{height:72vh;border-radius:16px 16px 0 0}}`;
  const style = () => { if (document.getElementById('mm-css')) return; const s = document.createElement('style'); s.id = 'mm-css'; s.textContent = css; document.head.appendChild(s); };
  function close() { m?.remove(); m = null; box?.remove(); box = null; removeEventListener('keydown', key); }
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  async function coords(num) {
    let token = null; try { token = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }
    if (!token || !window.API) return null;
    const auth = { token };
    const r = await fetch(window.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'item', auth, num }) }).then(r => r.json()).catch(() => null);
    return r?.item ?? null;
  }
  const load = (src, css) => new Promise(ok => { const el = document.createElement(css ? 'link' : 'script'); if (css) { el.rel = 'stylesheet'; el.href = src; } else el.src = src; el.onload = el.onerror = ok; document.head.appendChild(el); });
  const leaflet = async () => { await Promise.all([load('vendor/leaflet/leaflet.min.css', 1), load('vendor/leaflet/leaflet.min.js')]); if (!window.MAPBASE) await load('mapbase.js?v=5.31e1'); };
  async function open(o = {}) {
    style(); close();
    box = document.createElement('div'); box.className = 'mm-ov'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Объект на карте');
    box.innerHTML = `<div class="mm-box"><div class="mm-head no-objlink"><b>📍 ${o.num ? `№ ${esc(o.num)} на карте` : 'На карте'}<small>${esc(o.place || '')}</small></b><button type="button" class="mm-x" aria-label="Закрыть">✕</button></div><div class="mm-map"><p class="mm-wait">Загружаю карту…</p></div></div>`;
    box.addEventListener('click', e => { if (e.target === box || e.target.closest('.mm-x')) close(); });
    document.body.appendChild(box); addEventListener('keydown', key);
    const me = box;
    let lat = +o.lat, lng = +(o.lng ?? o.lon), place = o.place;
    if (!(lat && lng) && o.num) { const x = await coords(o.num); if (me !== box) return; lat = +x?.lat; lng = +x?.lng; const ad = [x?.street || x?.address, x?.sub].filter(Boolean).join(' · '); if (ad) place = ad; }
    const el = box.querySelector('.mm-map');
    if (place) box.querySelector('.mm-head small').textContent = place;
    if (lat && lng && !window.L) await leaflet(); if (me !== box) return;
    if (!(lat && lng) || !window.L) { el.innerHTML = `<p class="mm-wait">${window.L ? 'Точки на карте у этого объекта нет — адрес не распознан.' : 'Карта ещё загружается — попробуйте через секунду.'}</p>`; return; }
    el.innerHTML = '';
    m = L.map(el, { zoomControl: true, attributionControl: false, maxZoom: 19 }).setView([lat, lng], 16);
    (window.MAPBASE ? MAPBASE.add(m) : L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(m));
    const acc = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#1f6fb2';
    if (o.approx) L.circle([lat, lng], { radius: o.approx, color: acc, weight: 1.5, fillOpacity: .12 }).addTo(m);
    else L.circleMarker([lat, lng], { radius: 10, color: '#fff', weight: 3, fillColor: acc, fillOpacity: 1 }).addTo(m);
    [60, 300].forEach(ms => setTimeout(() => m?.invalidateSize(), ms));
  }
  // любая строка адреса с data-mm (data-num, data-lat, data-lng, data-place) — карта поверх; в карточке клик дальше не идёт (не открывает объявление, не ставит галочку)
  document.addEventListener('click', e => {
    const a = e.target.closest?.('[data-mm]'); if (!a) return;
    e.preventDefault(); e.stopPropagation();
    open({ num: a.dataset.num, lat: a.dataset.lat, lng: a.dataset.lng, place: a.dataset.place || a.textContent.replace(/^📍\s*/, '').trim() });
  }, true);
  return { open, close };
})();

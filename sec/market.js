// Цены рынка (v5.15, п. 10): медиана ₽/м² и цены по неделям размещения, новые и снятые — тип, район, комнаты. График — свой SVG.
// Таблица пересчитывается раз в неделю (понедельник), раз в месяц — короткая сводка в бот и push.
(() => {
  const H = window.HUB, esc = H.esc;
  let el = null, f = { kind: 'квартира', district: '', rooms: '' };
  async function open(arg, ctx) { el = ctx.el; return load(); }
  async function load() {
    const r = await H.call('mkt_series', f);
    const rows = r.rows.filter(x => x.med_m2);
    el.innerHTML = `<h2>📈 Цены рынка</h2><p class="hint">Медиана по объявлениям собственников, размещённым за неделю. Обновляется по понедельникам; раз в месяц пришлём сводку в бот.</p>
      <form id="mk-f" class="hub-ask"><select name="kind">${r.kinds.map(k => `<option${k === f.kind ? ' selected' : ''}>${k}</option>`).join('')}</select>
        <select name="district"><option value="">Все районы</option>${r.districts.map(d => `<option${d === f.district ? ' selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <select name="rooms"${['квартира', 'апартаменты'].includes(f.kind) && f.district ? '' : ' disabled'}><option value="">Все комнаты</option>${[0, 1, 2, 3, 4].map(n => `<option value="${n}"${String(n) === String(f.rooms) ? ' selected' : ''}>${n === 0 ? 'Студии' : n === 4 ? '4+' : n + '-комн.'}</option>`).join('')}</select></form>
      ${rows.length < 3 ? '<p class="muted">Мало данных для графика — выберите другой район или тип.</p>' : `
      <section class="hub-sec"><h3>₽ за м² (медиана)</h3>${chart(rows.map(x => [x.week, x.med_m2]), v => `${Math.round(v / 1000)} т`)}</section>
      <section class="hub-sec"><h3>Цена объекта (медиана)</h3>${chart(rows.map(x => [x.week, x.med_price]), v => `${(v / 1e6).toFixed(1)} м`)}</section>
      <section class="hub-sec"><h3>Новых объявлений за неделю</h3>${chart(r.rows.map(x => [x.week, x.n_new]), v => String(Math.round(v)), true)}</section>`}`;
    el.onchange = e => { const fd = new FormData(el.querySelector('#mk-f')); f = { kind: fd.get('kind'), district: fd.get('district') || '', rooms: fd.get('rooms') ?? '' }; if (!f.district) f.rooms = ''; load(); };
  }
  // линия или столбцы: последние 2 года по неделям
  function chart(pts, fmt, bars = false) {
    if (!pts.length) return '';
    const w = 900, h = 220, p = 36, vs = pts.map(x => Number(x[1])), max = Math.max(...vs) * 1.05, min = bars ? 0 : Math.min(...vs) * 0.95;
    const x = i => p + i * (w - 2 * p) / Math.max(1, pts.length - 1), y = v => h - p - (v - min) / (max - min || 1) * (h - 2 * p);
    const ticks = [0, .5, 1].map(t => min + t * (max - min));
    const path = pts.map((q, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(q[1]).toFixed(1)}`).join('');
    const bw = Math.max(2, (w - 2 * p) / pts.length - 2);
    const label = i => new Date(pts[i][0]).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
    return `<svg viewBox="0 0 ${w} ${h}" class="mk-svg" role="img" aria-label="График">
      ${ticks.map(t => `<line x1="${p}" x2="${w - p}" y1="${y(t)}" y2="${y(t)}" class="mk-grid"/><text x="2" y="${y(t) + 4}" class="mk-t">${fmt(t)}</text>`).join('')}
      ${bars ? pts.map((q, i) => `<rect x="${x(i) - bw / 2}" y="${y(q[1])}" width="${bw}" height="${h - p - y(q[1])}" class="mk-bar"><title>${esc(q[0])}: ${q[1]}</title></rect>`).join('') : `<path d="${path}" class="mk-line"/>`}
      ${[0, Math.floor(pts.length / 2), pts.length - 1].map(i => `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" class="mk-t">${label(i)}</text>`).join('')}</svg>`;
  }
  window.SEC = window.SEC || {};
  window.SEC.market = { title: 'Цены рынка', open };
})();

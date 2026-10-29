// «Для Агента» — общее для фильтров главной и архива (v5.1): подсказки «?» одним словарём, «от» больше «до»,
// несовместимые варианты, сообщение «Ничего не нашлось» с тем, какой фильтр больше всего мешает. Наружу — только window.FUI.
(() => {
'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// подсказки к фильтрам: ключ — data-h у подписи фильтра (.fl)
const HELP = {
  kind: 'Можно выбрать несколько типов. Ничего не выбрано — показываются все.',
  rooms: '«4+» — четыре комнаты и больше. Студии бывают только у квартир и апартаментов.',
  area: 'Общая площадь в квадратных метрах. Можно заполнить одно поле — только «от» или только «до».',
  price: 'Можно коротко: 12 — это 12 000 000 ₽. Можно заполнить одно поле.',
  place: 'Районы и микрорайоны (галочка на районе — весь район) или ЖК по названию.',
  sea: 'Расстояние по прямой до берега — без учёта дорог и подъёмов.',
  floor: 'Этаж «от» и «до». «Не первый» и «не последний» можно отметить и без чисел.',
  afloor: 'Этаж «от» и «до». «Не первый» можно отметить и без чисел.',
  fin: '«С ремонтом» — хороший ремонт по фото и описанию (функция пробная). Чистовая и черновая — по описанию.',
  flags: 'Бассейн и ФЗ-214 — по описанию. «Уникальные» — нет в рекламе на площадках. «Непросмотренные» — вы их ещё не открывали.',
  ext: 'Галочка снята — объявления с этой площадки скрыты. Проверенная база собственников видна всегда.',
  sort: '«Сначала новые» — по дате размещения объявления. Ваш выбор запоминается.',
  areas: 'Микрорайоны, как их называет источник. Галочка на районе — весь район.',
  addr: 'Например: Депутатская 10. Поиск по области — на карте: сдвиньте карту и нажмите «Искать в этой области».',
  sale: '«Все» — в продаже и снятые за 2 года. «Только в продаже» — без снятых.',
};
function help() {
  document.querySelectorAll('.fl[data-h]').forEach(el => {
    if (!HELP[el.dataset.h] || el.querySelector('.qm')) return;
    el.insertAdjacentHTML('beforeend', ` <button type="button" class="qm" data-qm="${el.dataset.h}" aria-label="Подсказка: ${esc(el.textContent.trim())}" aria-expanded="false">?</button>`);
  });
}
// подсказка — одно окошко рядом со значком: по нажатию (и на компьютере по наведению); закрывается нажатием мимо, Esc, прокруткой
let tip = null, tipFor = null, pinned = false;
function show(b, pin) {
  if (!tip) { tip = document.createElement('div'); tip.className = 'qtip'; tip.setAttribute('role', 'tooltip'); document.body.append(tip); }
  if (tipFor && tipFor !== b) tipFor.setAttribute('aria-expanded', 'false');
  tipFor = b; pinned = pin; tip.textContent = HELP[b.dataset.qm]; tip.hidden = false; b.setAttribute('aria-expanded', 'true');
  const r = b.getBoundingClientRect(), w = Math.min(280, innerWidth - 16);
  tip.style.width = `${w}px`;
  tip.style.left = `${Math.max(8, Math.min(r.left - 12, innerWidth - w - 8))}px`;
  const below = r.bottom + 8 + tip.offsetHeight < innerHeight;
  tip.style.top = `${below ? r.bottom + 6 : r.top - tip.offsetHeight - 6}px`;
}
function hide() { if (!tip || tip.hidden) return; tip.hidden = true; tipFor?.setAttribute('aria-expanded', 'false'); tipFor = null; pinned = false; }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-qm]');
  if (!b) return hide();
  e.preventDefault(); e.stopPropagation();
  tipFor === b && pinned ? hide() : show(b, true);
}, true);
const hover = matchMedia('(hover: hover)');
document.addEventListener('mouseover', e => { const b = hover.matches && e.target.closest?.('[data-qm]'); if (b && tipFor !== b) show(b, false); });
document.addEventListener('mouseout', e => { if (!pinned && tipFor && e.target.closest?.('[data-qm]') === tipFor) hide(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
addEventListener('scroll', hide, true); addEventListener('resize', hide);

// «от» больше «до»: пара подсвечивается, под ней подсказка, в запрос не идёт, пока не исправят
const PAIRS = [['amin', 'amax'], ['pmin', 'pmax'], ['fmin', 'fmax']];
const isBad = (f, a, b) => +f[a] > 0 && +f[b] > 0 && +f[a] > +f[b];
const clean = f => { const q = { ...f }; for (const [a, b] of PAIRS) if (isBad(f, a, b)) { delete q[a]; delete q[b]; } return q; };
function pairs(f) {
  for (const [a, b] of PAIRS) {
    const ia = document.getElementById(a), ib = document.getElementById(b), pair = ia?.closest('.pair');
    if (!pair) continue;
    const on = isBad(f, a, b), m = pair.nextElementSibling?.classList.contains('perr') ? pair.nextElementSibling : null;
    [ia, ib].forEach(i => { i.classList.toggle('bad', on); i.setAttribute('aria-invalid', on); });
    if (on && !m) pair.insertAdjacentHTML('afterend', '<div class="perr" role="alert">„от“ больше „до“</div>');
    if (!on) m?.remove();
  }
}
// несовместимые варианты неактивны: у участков нет комнат и этажей, студии — только у квартир и апартаментов, «не первый» при «этаж до 1»
function compat(f) {
  const k = Array.isArray(f.k) ? f.k : [], land = k.length > 0 && k.every(x => x === 'участок');
  return { land, studio: !k.length || k.some(x => x === 'квартира' || x === 'апартаменты'), nf: !land && +f.fmax !== 1 };
}

// «Ничего не нашлось»: сервер посчитал, сколько нашлось бы без каждого фильтра (drop), и без всех сразу (hidden)
const n = v => Number(v).toLocaleString('ru-RU');
function empty(r, any) {
  const d = (r.drop ?? []).find(x => x.count > 0);
  const all = '<button type="button" class="btn ghost" data-drop-all>Сбросить все</button>';
  if (d) return `<p>Ничего не нашлось. Больше всего мешает «${esc(d.label)}» — без него ${n(d.count)}</p>
    <div class="drop-b"><button type="button" class="btn soft" data-drop="${esc((d.keys ?? [d.key]).join(','))}">Сбросить его</button>${all}</div>`;
  if (!any) return '<p>Ничего не нашлось — попробуйте изменить запрос.</p>';
  if (r.drop && !r.hidden) return '<p>Ничего не нашлось — даже без фильтров. Попробуйте изменить запрос.</p>';
  return `<p>Ничего не нашлось${r.hidden ? `: мешает сочетание фильтров — без них нашлось бы ${n(r.hidden)}` : ''}.</p><div class="drop-b">${all}</div>`;
}

window.FUI = { help, hide, clean, pairs, compat, empty };
})();

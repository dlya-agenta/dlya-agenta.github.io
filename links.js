// Связи объявления с разделами (v5.23c, п. 12 Алексея; схема — strategy/СХЕМА-СВЯЗЕЙ-v5.23.md). Полоска под карточкой объявления на главной —
// только агенту (agent-only: в режиме «С клиентом» скрыта):
//   ✓/✗/⏳ ответ собственника (own_status вкладки A) → «💎 Предложить эксклюзив» (текст собственнику + excl.html#new=<номер>) и «✉️ В рассылку»;
//   «📄 В подборках: N» → «Мои подборки»; 👍 клиент отметил «подходит» → «📅 На показ» (CRM.show: клиент, задача, статус «Показ»);
//   «👥 Иван» → карточка клиента в CRM; «📑 Сделка» → hub.html#deal=<id>.
// Данные — одним запросом hub lnk_cards {nums} на каждую порцию выдачи (MutationObserver на #list); нет данных или ошибка — полоски нет, ничего не мешает.
// Снаружи: LINKS.use(deps) из app.js; LINKS.show(num, {why, what}) — «Записать на показ» (для «Моих подборок» вкладки B); LINKS.refresh(nums); LINKS.ownChip(own).
window.LINKS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = t => t ? new Date(t).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }) : '';
  const hm = t => t ? new Date(t).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '';
  const digits = p => { const d = String(p ?? '').replace(/\D/g, ''); return /^8\d{10}$/.test(d) ? '7' + d.slice(1) : /^\d{10}$/.test(d) ? '7' + d : d; };
  let ui = null, by = new Map(), pend = new Set(), timer = 0;

  // ответ собственника — одной «таблеткой»; текст ответа — в подсказке
  function ownChip(o) {
    if (!o) return '';
    const tip = o.text ? ` title="Ответ: ${esc(o.text)}"` : '';
    if (o.st === 'yes') return `<span class="lk-c ok"${tip}>✓ Собственник: актуально${o.at ? ` · ${day(o.at)}` : ''}</span>`;
    if (o.st === 'sold') return `<span class="lk-c bad"${tip}>✗ Продано${o.at ? ` · ${day(o.at)}` : ''}</span>`;
    if (o.st === 'no') return `<span class="lk-c bad"${tip}>✗ Не актуально${o.at ? ` · ${day(o.at)}` : ''}</span>`;
    if (o.st === 'none') return '<span class="lk-c grey">✗ Собственник не ответил</span>';
    // v5.23e: проверка невозможна (мессенджер не подключён, вход закончился) — так и пишем, со ссылкой на подключение; прошедшее время «проверю в …» не показываем никогда
    if (o.err) {
      const t = String(o.err).replace(/\s*в «🔗 Мессенджеры»/, ''), short = t.charAt(0).toLowerCase() + t.slice(1);
      return /подключите|войдите/i.test(t) ? `<a class="lk-c wait lnk" href="hub.html#msg" title="${esc(o.err)}">⏳ Ждём · ${esc(short)}</a>`
        : `<span class="lk-c wait" title="${esc(o.err)}">⏳ Ждём · ${esc(short)}</span>`;
    }
    const soon = o.next && new Date(o.next).getTime() > Date.now();
    return `<span class="lk-c wait">⏳ Ждём ответ${soon ? ` · проверю в ${hm(o.next)}` : ''}</span>`;
  }
  // v5.24a (п. 7 Алексея): на карточке — только значки с подсказкой (наведение или нажатие), всё с подписями и «снять» — внутри объявления (full)
  function ownIcon(o) {
    if (!o) return '';
    const tip = (t, cls, ic) => `<span class="lk-i ${cls}" title="${esc(t)}" data-tip tabindex="0">${ic}</span>`;
    const ans = o.text ? ` Ответ: «${o.text}».` : '';
    if (o.st === 'yes') return tip(`Собственник: актуально${o.at ? ` · ${day(o.at)}` : ''}.${ans}`, 'ok', '✓');
    if (o.st === 'sold') return tip(`Собственник: продано${o.at ? ` · ${day(o.at)}` : ''}.${ans}`, 'bad', '✗');
    if (o.st === 'no') return tip(`Собственник: не актуально${o.at ? ` · ${day(o.at)}` : ''}.${ans}`, 'bad', '✗');
    if (o.st === 'none') return tip('Собственник не ответил', 'grey', '✗');
    if (o.err) return tip(`Ждём ответ · ${o.err}`, 'wait', '⏳');
    const soon = o.next && new Date(o.next).getTime() > Date.now();
    return tip(`Ждём ответ собственника${soon ? ` · проверю в ${hm(o.next)}` : ''}`, 'wait', '⏳');
  }
  function icons(num, v) {
    const yes = v.sels.filter(s => s.fb === 'yes'), no = v.sels.filter(s => s.fb === 'no'), show = v.cl.filter(c => c.st === 'show');
    const i = (t, cls, ic) => `<span class="lk-i ${cls}" title="${esc(t)}" data-tip tabindex="0">${ic}</span>`;
    const parts = [ownIcon(v.own),
      v.sels.length ? i(`В подборках: ${v.sels.length} — ${v.sels.map(s => `«${s.title}»`).join(', ')}`, '', `📄<b>${v.sels.length}</b>`) : '',
      yes.length ? i(`Клиенту подходит: ${yes.map(s => s.cm ? `«${s.title}» — ${s.cm}` : `«${s.title}»`).join(', ')}`, 'ok', '👍') : '',
      !yes.length && no.length ? i(`Клиенту не подошло${no[0].cm ? `: ${no[0].cm}` : ''}`, 'grey', '👎') : '',
      show.length ? i(`На показ: ${show.map(c => c.name).join(', ')}`, '', '📅') : '',
      v.cl.length ? i(`У клиентов в CRM: ${v.cl.map(c => c.name).join(', ')}`, '', `👥${v.cl.length > 1 ? `<b>${v.cl.length}</b>` : ''}`) : '',
      v.deal ? i(`В сделке${v.deal.title ? `: ${v.deal.title}` : ''}`, '', '📑') : ''].filter(Boolean);
    return parts.length ? `<div class="lk lk-ic agent-only" data-lk>${parts.join('')}</div>` : '';
  }
  function strip(num, v) {
    const yes = v.sels.filter(s => s.fb === 'yes'), no = v.sels.filter(s => s.fb === 'no');
    const tab = v.own ? 'own' : yes.length || no.length ? 'fb' : 'all';
    const parts = [ownChip(v.own),
      v.sels.length ? `<button type="button" class="lk-c lnk" data-lk-sels="${tab}" title="${esc(v.sels.map(s => s.title).join(' · '))}">📄 В подборках: ${v.sels.length}</button>` : '',
      yes.length ? `<span class="lk-c ok" title="${esc(yes.map(s => s.cm ? `«${s.title}»: ${s.cm}` : `«${s.title}»`).join(' · '))}">👍 Клиенту подходит${yes.length > 1 ? ` · ${yes.length}` : ''}</span>` : '',
      !yes.length && no.length ? `<span class="lk-c grey" title="${esc(no.map(s => s.cm || s.title).join(' · '))}">👎 Клиенту не подошло</span>` : '',
      ...v.cl.slice(0, 3).map(c => `<button type="button" class="lk-c lnk" data-lk-cl="${c.id}" title="Карточка клиента в CRM">👥 ${esc(c.name)}</button>`),
      v.cl.length > 3 ? `<span class="lk-c grey">ещё ${v.cl.length - 3}</span>` : '',
      v.deal ? `<a class="lk-c lnk" href="hub.html#deal=${v.deal.id}" title="${esc(v.deal.title || 'Сделка')}">📑 В сделке</a>` : ''].filter(Boolean);
    const acts = [yes.length || v.own?.st === 'yes' ? '<button type="button" class="btn soft lk-b" data-lk-show>📅 На показ</button>' : '',
      v.own?.st === 'yes' ? `<button type="button" class="btn ghost lk-b" data-lk-ex>💎 Предложить эксклюзив</button><button type="button" class="btn ghost lk-b" data-mail="${num}">✉️ В рассылку</button>` : ''].filter(Boolean);
    const off = v.own ? `<button type="button" class="lk-c lnk lk-off" data-lk-off title="Убрать отметку «написал» и ответ собственника (проверка ответа остановится)">✕ Снять отметку собственника</button>` : '';
    return parts.length || acts.length ? `<div class="lk agent-only" data-lkf>${parts.join('')}${off}${acts.length ? `<span class="lk-acts">${acts.join('')}</span>` : ''}</div>` : '';
  }
  // внутри объявления: отметки с подписями, «📅 На показ», «💎 Предложить эксклюзив», «✕ Снять отметку собственника»
  async function full(num, box) {
    if (!box || !ui?.agent?.()) return;
    if (!by.has(num)) {
      try { const r = await HUB.call('lnk_cards', { nums: [num] }); by.set(num, r.by?.[num] ?? null); } catch { return; }
    }
    const v = by.get(num);
    box.innerHTML = v ? strip(num, v) : '';
  }
  async function ownOff(num, b) {
    b.disabled = true;
    try {
      const token = JSON.parse(localStorage.getItem('token') || 'null');
      const r = await fetch(String(window.API).replace(/\/web$/, '/auto'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'own_mark', auth: { token }, num, on: false }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Не получилось');
      const v = by.get(num); if (v) v.own = null;
      ui.toast('Отметка собственника снята');
      document.querySelectorAll(`[data-ivlk="${num}"]`).forEach(x => full(num, x));
      document.querySelectorAll(`#list .card:not(.mc)[data-num="${num}"]`).forEach(paint);
    } catch (er) { b.disabled = false; ui.toast(er.message); }
  }
  function paint(el) {
    const num = +el.dataset.num, v = by.get(num);
    el.querySelector(':scope .body > [data-lk]')?.remove();
    if (!v) return;
    const h = icons(num, v);
    if (!h) return;
    const at = el.querySelector(':scope .body > .actions');
    at ? at.insertAdjacentHTML('beforebegin', h) : el.querySelector(':scope .body')?.insertAdjacentHTML('beforeend', h);
  }
  // карточки выдачи (не карта и не «Похожие») — порциями: одна просьба на всё, что появилось за 250 мс
  function scan() {
    document.querySelectorAll('#list .card:not(.mc)').forEach(el => {
      const n = +el.dataset.num;
      if (!n) return;
      if (by.has(n)) { if (!el.querySelector(':scope .body > [data-lk]')) paint(el); return; }
      if (!el.dataset.lk) { el.dataset.lk = 1; pend.add(n); }
    });
    if (pend.size) { clearTimeout(timer); timer = setTimeout(load, 250); }
  }
  async function load() {
    const nums = [...pend].slice(0, 60);
    nums.forEach(n => pend.delete(n));
    if (!nums.length || !window.HUB || !ui?.agent?.()) return;
    try {
      const r = await HUB.call('lnk_cards', { nums });
      nums.forEach(n => by.set(n, r.by?.[n] ?? null));
      nums.forEach(n => document.querySelectorAll(`#list .card:not(.mc)[data-num="${n}"]`).forEach(paint));
    } catch { /* нет связи или гость — без полоски */ }
    if (pend.size) load();
  }
  function refresh(nums) {
    nums.forEach(n => { by.delete(n); document.querySelectorAll(`#list .card[data-num="${n}"]`).forEach(el => delete el.dataset.lk); });
    scan();
  }

  // ---------- «💎 Предложить эксклюзив»: собственник ответил «актуально» — готовый текст ему и размещение в «Эксклюзивах» ----------
  function excl(num, cardEl) {
    const v = by.get(num), me = ui.me?.() ?? {};
    const what = cardEl?.querySelector('.title')?.textContent.trim() ?? `объект № ${num}`;
    const addr = cardEl?.querySelector('.addr')?.textContent.split('·')[0].trim() ?? '';
    const ph = digits(v?.own?.ph || cardEl?.querySelector('.phone a.num')?.textContent);
    const text = `Здравствуйте! Это ${me.name || 'агент'}${me.company ? `, ${me.company}` : ''}. Спасибо, что ответили по вашей квартире (${[what, addr].filter(Boolean).join(', ')}). ` +
      'Предлагаю продать её на эксклюзиве: бесплатно сделаю хорошие фото и видео, размещу рекламу и покажу объект агентам Сочи, сам проведу показы, проверю покупателя и документы и сопровожу сделку до расчёта. ' +
      'Так продаётся быстрее и без потока звонков. Удобно созвониться сегодня?';
    ui.sheet(`💎 Предложить эксклюзив · № ${num}`, `<div class="lk-ex">
      <p class="hint">Собственник ответил, что продажа актуальна — самое время предложить эксклюзивный договор. Текст можно поправить.</p>
      <label class="field">Сообщение собственнику<textarea id="lk-ex-t" rows="7" maxlength="1500">${esc(text)}</textarea></label>
      <div class="lk-row">${ph ? `<a class="btn soft" id="lk-ex-wa" href="#" target="_blank" rel="noopener">WhatsApp</a><a class="btn soft" href="https://t.me/+${esc(ph)}" target="_blank" rel="noopener" data-lk-copy>Telegram</a>` : ''}
        <button type="button" class="btn ghost" data-lk-copy>Копировать текст</button></div>
      ${ph ? '' : '<p class="hint">Номер собственника ещё не открыт — нажмите «📞 Телефон» на карточке.</p>'}
      <h4>Договорились?</h4>
      <div class="lk-row"><a class="btn primary" href="excl.html#new=${num}">💎 Разместить в «Эксклюзивах»</a>
        <button type="button" class="btn ghost" data-lk-call>⏰ Напомнить перезвонить завтра</button></div>
      <p class="hint">«Разместить» заполнит форму из объявления (цена, площадь, этаж, район, описание) — фото сделайте свои.</p></div>`);
    const body = document.querySelector('#sheet-body'), t = body.querySelector('#lk-ex-t'), wa = body.querySelector('#lk-ex-wa');
    const sync = () => { if (wa) wa.href = `https://wa.me/${ph}?text=${encodeURIComponent(t.value)}`; };
    sync(); t.oninput = sync;
    body.onclick = async e => {
      if (e.target.closest('[data-lk-copy]')) { try { await navigator.clipboard.writeText(t.value); ui.toast('Текст скопирован — вставьте в чат собственника'); } catch { /* нет доступа к буферу */ } }
      const c = e.target.closest('[data-lk-call]');
      if (c) {
        c.disabled = true;
        const d = new Date(Date.now() + 864e5 + 3 * 3600e3).toISOString().slice(0, 10);
        try { await ui.call('crm_task_save', { text: `Эксклюзив: перезвонить собственнику № ${num} (${what})`, due: `${d}T11:00:00+03:00`, num, via: ['tg', 'push', 'site'] }); ui.toast('⏰ Напомню завтра в 11:00'); }
        catch (er) { ui.toast(er.message, 5000); c.disabled = false; }
      }
    };
  }

  function show(num, o = {}) { if (window.CRM?.show) CRM.show(num, o); }
  document.addEventListener('click', e => {
    const tip = e.target.closest('[data-lk] [data-tip]');
    if (tip && ui) { e.preventDefault(); e.stopPropagation(); return ui.toast(tip.title, 4000); }
    const off = e.target.closest('[data-lk-off]');
    if (off && ui) { e.preventDefault(); e.stopPropagation(); return ownOff(+off.closest('.card')?.dataset.num, off); }
    const s = e.target.closest('[data-lkf] [data-lk-sels], [data-lk-show], [data-lk-ex], [data-lk-cl]');
    if (!s || !ui) return;
    e.preventDefault(); e.stopPropagation();
    const cardEl = s.closest('.card'), num = +cardEl?.dataset.num;
    // v5.23e: click() возвращает undefined — через ?? всегда открывалась ещё и общая; теперь: кнопка вкладки, а нет её — общая
    if (s.dataset.lkSels) return void (document.querySelector(`.top [data-go="sels"][data-tab="${s.dataset.lkSels}"]`) ?? document.querySelector('.top [data-go="sels"]'))?.click();
    if (s.dataset.lkCl) return window.CRM?.openClient?.(+s.dataset.lkCl);
    if (s.matches('[data-lk-ex]')) return excl(num, cardEl);
    if (s.matches('[data-lk-show]')) {
      const v = by.get(num), y = v?.sels.find(x => x.fb === 'yes');
      return show(num, { what: cardEl.querySelector('.title')?.textContent.trim(), why: y ? `Клиент отметил «подходит» в подборке «${y.title}»${y.cm ? `: ${y.cm}` : ''}` : v?.own?.st === 'yes' ? 'Собственник подтвердил: продажа актуальна' : '' });
    }
  }, true);

  function use(deps) {
    ui = deps;
    const list = document.querySelector('#list');
    if (list && !list.dataset.lkObs) { list.dataset.lkObs = 1; new MutationObserver(scan).observe(list, { childList: true }); }
    scan();
  }
  return { use, show, refresh, ownChip, full };
})();

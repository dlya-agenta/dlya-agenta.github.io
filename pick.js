// v5.48 H: страница клиента по ссылке «Самоподбор» (s.html#<код>, kind = 'pick'). Без входа. s.js передаёт сюда ответ sel_public и свою call();
// карточку, карту и просмотр фото берём у s.js через window.SEL. Вкладки: «Подбор» (фильтр в рамке агента), «Мой выбор (N)», «Советует агент».
// Клиент никогда не получает телефон собственника, номер дома, источник — сервер отдаёт только белый список; текст — только через esc().
(() => {
  const $ = s => document.querySelector(s);
  const SORTS = [['new', 'Новее'], ['cheap', 'Дешевле'], ['expensive', 'Дороже'], ['area', 'Площадь']];
  const ROOMS = { 0: 'Студия', 1: '1', 2: '2', 3: '3', 4: '4+' };
  const FINS = [['clean', 'Чистовая', ['clean']], ['whitebox', 'White box', ['whitebox']], ['rough', 'Черновая', ['rough']], ['repair', 'С ремонтом', ['designer', 'euro', 'modern']]];
  const when = u => new Date(u).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const isChosen = x => x.mark === 'yes' || (!!x.comment && x.mark !== 'no');
  const S = () => window.SEL;
  const esc = s => S().esc(s);
  const tel = p => S().intl(p);

  // контакты агента — на экранах «срок закончился / два устройства / сутки», где сервер контактов не отдаёт: берём из последней удачной загрузки этой ссылки
  const agKey = t => 'pick_ag:' + String(t || '').slice(0, 12);
  const agentBtns = a => { const n = tel(a?.agent_phone); return n ? `<a class="btn soft" href="tel:+${n}">Позвонить</a><a class="btn ghost" href="https://wa.me/${n}" target="_blank" rel="noopener">WhatsApp</a>` : ''; };

  // экраны ошибок ссылки (expired / device / day): сообщение сервера и кнопки связи с агентом
  function stop(e, t) {
    // контакты — из самой ошибки (сервер, R19); кэш прошлой загрузки — запасной вариант
    let a = e?.agent || e?.agent_phone ? e : null;
    if (!a) try { a = JSON.parse(localStorage.getItem(agKey(t))); } catch { /* нет сохранённого */ }
    const H = { device: 'Ссылка уже открыта на двух устройствах', day: 'На сегодня подбор исчерпан' };
    $('#s-app').innerHTML = `<div class="s-empty p-stop"><h1>${esc(H[e?.error] || e?.message || 'Ссылка недоступна')}</h1>${H[e?.error] ? `<p class="muted">${esc(e?.message || '')}</p>` : ''}
      ${a?.agent || a?.agent_phone ? `<p class="p-stop-ag">Ваш агент${a.agent ? `: <b>${esc(a.agent)}</b>` : ''}</p><div class="s-agent-btns">${agentBtns(a)}</div>` : '<p class="muted">Свяжитесь с агентом, который прислал вам ссылку.</p>'}</div>`;
  }

  function client(d, call) {
    const t = location.hash.slice(1).split(/[?&]/)[0];
    try { localStorage.setItem(agKey(t), JSON.stringify({ agent: d.agent, agent_phone: d.agent_phone })); } catch { /* приватный режим */ }
    const o = d.frame_opts || { d: [], zk: [], r: [], k: [], pmin: null, pmax: null, amin: null, amax: null };
    const store = new Map(), all = [];   // все объекты страницы (индекс = номер фото-галереи у s.js)
    const put = x => { const old = store.get(x.num); if (old) { Object.assign(old, x); return old; } store.set(x.num, x); all.push(x); return x; };
    const chosenList = [...d.chosen].map(put), advised = d.advised.map(put);
    S().setData({ kind: 'pick', items: all, title: d.title, owner: !!d.owner });
    document.title = d.title || 'Подбор объектов';
    const left = Date.parse(d.until) - Date.now(), n2 = tel(d.agent_phone);
    const soon = left > 0 && left <= 2 * 3600e3;
    const rest = left > 3600e3 ? `${Math.ceil(left / 3600e3)} ${S().plural(Math.ceil(left / 3600e3), 'час', 'часа', 'часов')}` : `${Math.max(1, Math.ceil(left / 60e3))} ${S().plural(Math.max(1, Math.ceil(left / 60e3)), 'минута', 'минуты', 'минут')}`;
    const roomsOn = o.r.length > 1, dOn = o.d.length > 1, zOn = o.zk.length > 1;
    const chip = (name, val, txt, on) => `<label class="p-chip"><input type="checkbox" name="${name}" value="${esc(val)}"${on ? ' checked' : ''}><span>${esc(txt)}</span></label>`;
    const range = (n, lab, ph1, ph2, unit) => `<div class="p-fld"><span class="p-lab">${lab}</span><div class="p-rng"><input type="number" inputmode="decimal" min="0" step="any" name="${n}min" placeholder="${esc(ph1)}" aria-label="${lab}: от"><i>—</i><input type="number" inputmode="decimal" min="0" step="any" name="${n}max" placeholder="${esc(ph2)}" aria-label="${lab}: до">${unit ? `<small>${unit}</small>` : ''}</div></div>`;
    const bounds = (a, b) => [a != null ? `от ${a}` : 'от', b != null ? `до ${b}` : 'до'];

    $('#s-app').innerHTML = `
      ${d.owner ? '<div class="s-owner">Это ваша ссылка — так её видит клиент. Ваши открытия не считаются.</div>' : ''}
      <header class="s-hero">
        <h1>${esc(d.title || 'Подбор объектов')}</h1>${d.intro ? `<p style="white-space:pre-wrap">${esc(d.intro)}</p>` : ''}
        <p class="muted p-until">Доступ до ${esc(when(d.until))}</p>
        ${soon ? `<p class="p-soon" role="status">Осталось ${rest} — попросите агента продлить, если не успеваете</p>` : ''}
        ${d.agent || n2 ? `<div class="s-agent">${d.agent_photo ? `<img class="s-agent-ph" src="${esc(d.agent_photo)}" alt="" width="48" height="48" loading="lazy">` : ''}<span>Ваш агент${d.agent ? `: <b>${esc(d.agent)}</b>` : ''}</span><span class="s-agent-btns">${agentBtns(d)}</span></div>` : ''}
        ${d.frame_text ? `<p class="hint p-frame">Агент подобрал для вас: ${esc(d.frame_text)}. Отмечайте ⭐ то, что хотите посмотреть, и задавайте вопросы — агент увидит сразу.</p>` : ''}
      </header>
      <div class="p-tabs" role="tablist">
        <button type="button" role="tab" id="p-t-s" data-tab="s" aria-selected="true">Подбор</button>
        <button type="button" role="tab" id="p-t-c" data-tab="c" aria-selected="false">Мой выбор (<span id="p-nc">0</span>)</button>
        ${advised.length ? `<button type="button" role="tab" id="p-t-a" data-tab="a" aria-selected="false" aria-label="Советует агент (${advised.length})"><span class="p-long">Советует агент</span><span class="p-short">От агента</span> (${advised.length})</button>` : ''}
      </div>
      <section class="p-pane" id="p-s" role="tabpanel" aria-labelledby="p-t-s">
        <details class="p-filter" id="p-f" open><summary>Фильтр</summary>
          <form id="p-form" autocomplete="off">
            ${range('p', 'Цена, млн ₽ (с комиссией)', ...bounds(o.pmin, o.pmax), '')}
            ${roomsOn ? `<div class="p-fld"><span class="p-lab">Комнаты</span><div class="p-chips">${o.r.map(r => chip('r', r, ROOMS[r] ?? String(r))).join('')}</div></div>` : ''}
            ${dOn ? `<div class="p-fld"><span class="p-lab">Район</span><div class="p-chips">${o.d.map(x => chip('d', x.key, x.name)).join('')}</div></div>` : ''}
            ${zOn ? `<div class="p-fld"><span class="p-lab">ЖК</span><div class="p-chips">${o.zk.map(x => chip('zk', x.id, x.name)).join('')}</div></div>` : ''}
            ${range('a', 'Площадь, м²', ...bounds(o.amin, o.amax), '')}
            ${range('f', 'Этаж', 'от', 'до', '')}
            <div class="p-fld"><span class="p-lab">Отделка</span><div class="p-chips">${FINS.map(f => chip('fin', f[0], f[1])).join('')}${chip('fz', '1', 'ФЗ-214')}</div></div>
            <div class="p-fld p-sort"><label class="p-lab" for="p-sort">Сортировка</label><select id="p-sort" name="sort">${SORTS.map(s => `<option value="${s[0]}">${s[1]}</option>`).join('')}</select></div>
            <div class="p-go"><button type="submit" class="btn primary">Показать</button><button type="button" class="btn soft" id="p-reset">Сбросить</button></div>
          </form>
        </details>
        <p class="p-count muted" id="p-count" aria-live="polite"></p>
        <button type="button" class="btn soft s-allmap p-mapbtn" id="p-mapbtn" data-pk-map hidden>🗺 На карте</button>
        <div class="s-list" id="p-list"></div>
        <div class="p-more"><button type="button" class="btn soft" id="p-more" hidden>Показать ещё</button></div>
      </section>
      <section class="p-pane" id="p-c" role="tabpanel" aria-labelledby="p-t-c" hidden></section>
      <section class="p-pane" id="p-a" role="tabpanel" aria-labelledby="p-t-a" hidden></section>`;

    // ---------- вкладки «Мой выбор» и «Советует агент»
    const cardsHtml = list => list.map(x => S().cardHtml(x, all.indexOf(x), true)).join('');
    const fit = () => requestAnimationFrame(S().fit);
    const nChosen = () => all.filter(isChosen).length;
    const counts = () => { const el = $('#p-nc'); if (el) el.textContent = nChosen(); };
    const mapBtn = '<button type="button" class="btn soft s-allmap" data-map="all">🗺 На карте</button>';
    function drawChosen() {
      const l = all.filter(isChosen);
      $('#p-c').innerHTML = l.length ? `${mapBtn}<div class="s-list">${cardsHtml(l)}</div>` : '<div class="p-empty"><p>Пока ничего не отмечено.</p><p class="muted">Нажмите «⭐ Хочу посмотреть» или «❓ Вопрос» у объекта во вкладке «Подбор» — он появится здесь, а агент увидит ваш выбор.</p></div>';
      fit();
    }
    function drawAdvised() {
      $('#p-a').innerHTML = `${mapBtn}<div class="s-list">${cardsHtml(advised)}</div>`; fit();
    }
    function tab(k) {
      for (const [id, name] of [['s', 'p-s'], ['c', 'p-c'], ['a', 'p-a']]) {
        const b = $(`#p-t-${id}`); if (!b) continue;
        b.setAttribute('aria-selected', String(id === k)); $('#' + name).hidden = id !== k;
      }
      if (k === 'c') drawChosen(); if (k === 'a') drawAdvised();
      scrollTo({ top: Math.max(0, $('.p-tabs').getBoundingClientRect().top + scrollY - 8) });
    }

    // ---------- поиск: фильтр клиента → pick_search (цены в млн с комиссией, сервер пересчитывает)
    const fm = () => $('#p-form');
    const val = n => { const v = parseFloat(String(fm().elements[n]?.value ?? '').replace(',', '.')); return Number.isFinite(v) && v > 0 ? v : undefined; };
    const picked = n => [...fm().querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
    function filter() {
      const f = {}, set = (k, v) => { if (v !== undefined && !(Array.isArray(v) && !v.length)) f[k] = v; };
      set('pmin', val('pmin')); set('pmax', val('pmax')); set('amin', val('amin')); set('amax', val('amax')); set('fmin', val('fmin')); set('fmax', val('fmax'));
      set('r', picked('r').map(Number)); set('d', picked('d')); set('zk', picked('zk').map(Number));
      set('fin', FINS.filter(x => picked('fin').includes(x[0])).flatMap(x => x[2]));
      if (picked('fz').length) f.fz = true;
      return f;
    }
    let off = 0, busy = false, shownList = [];
    function fail(e) {
      const x = e?.data;
      if (x && ['expired', 'device', 'day'].includes(x.error)) return stop(x, t);
      S().toast(e?.message || 'Не получилось загрузить — попробуйте ещё раз', 5000);
    }
    // пока идёт поиск — кнопки и сортировка выключены (лимит поисков на ссылку мал, повтор не теряется молча)
    const lock = on => { busy = on; fm()?.querySelectorAll('button, select').forEach(b => { b.disabled = on; }); const mb = $('#p-more'); if (mb) mb.disabled = on; };   // страница могла смениться экраном ошибки
    async function search(more) {
      if (busy) return; lock(true);
      const cnt = $('#p-count'), btn = $('#p-more');
      if (!more) { off = 0; shownList = []; if ($('#p-mapbtn')) $('#p-mapbtn').hidden = true; $('#p-list').innerHTML = '<div class="s-load"><div class="spinner"></div></div>'; cnt.textContent = 'Ищу…'; btn.hidden = true; }
      try {
        const r = await call('pick_search', { f: filter(), offset: off, sort: fm().elements.sort.value });
        const items = r.items.map(put); shownList.push(...items); off += r.page || 12;
        const list = $('#p-list'); if (!more) list.innerHTML = '';
        list.insertAdjacentHTML('beforeend', cardsHtml(items)); fit();
        cnt.textContent = !r.count ? '' : r.count > r.shown ? `Показано ${r.shown} из ${r.count} — сузьте фильтр или спросите агента` : `Найдено: ${r.count}`;
        if (!r.count) list.innerHTML = '<div class="p-empty"><p>Ничего не найдено.</p><p class="muted">Измените фильтр или спросите агента.</p></div>';
        btn.hidden = shownList.length >= r.shown; counts();
        const mb = $('#p-mapbtn'); if (mb) { mb.hidden = !shownList.length; mb.textContent = shownList.length > 24 ? '🗺 На карте (первые 24)' : '🗺 На карте'; }
      } catch (e) { if (!more && $('#p-list')) { $('#p-list').innerHTML = ''; cnt.textContent = ''; } fail(e); }
      finally { lock(false); }
    }

    // ---------- отметки: ⭐ / ✗ (повторное нажатие снимает), ❓ — вопрос до 300 знаков, сохраняется сразу
    // карточка одного объекта может быть в нескольких вкладках сразу — привести все к одному состоянию
    function sync(x) {
      document.querySelectorAll(`.s-card[data-num="${x.num}"]`).forEach(c => {
        c.classList.toggle('m-yes', x.mark === 'yes'); c.classList.toggle('m-no', x.mark === 'no');
        c.querySelectorAll('[data-pm="yes"],[data-pm="no"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pm === x.mark)));
        const ta = c.querySelector('.p-cm'), ask = c.querySelector('.p-ask');
        if (ta && document.activeElement !== ta && ta.value !== (x.comment || '')) ta.value = x.comment || '';
        if (ask) ask.setAttribute('aria-pressed', String(!!x.comment));
        if (x.comment) { const q = c.querySelector('.p-q'); if (q) q.hidden = false; }
        let ans = c.querySelector('.p-ans');
        if (x.answer && !ans) { ans = document.createElement('div'); ans.className = 'p-ans'; ans.innerHTML = `<b>Ответ агента</b><p></p>`; c.querySelector('.p-fb').appendChild(ans); }
        if (ans) { if (x.answer) ans.querySelector('p').textContent = x.answer; else ans.remove(); }
      });
    }
    async function save(c, prev) {
      const num = +c.dataset.num, x = store.get(num), set = x.mark, st = c.querySelector('.s-st'), comment = c.querySelector('.p-cm').value.replace(/\s+/g, ' ').trim().slice(0, 300);
      st.textContent = 'Сохраняю…';
      try {
        const r = await call('sel_feedback', { num, mark: x.mark, comment });
        x.comment = r.comment ?? comment; sync(x);
        st.textContent = isChosen(x) ? 'Сохранено — агент увидит' : x.mark === 'no' ? 'Отмечено: не подходит' : 'Отметка снята';
        S().mapReset(); counts();
      } catch (e) { st.textContent = ''; if (prev !== undefined && x.mark === set) { x.mark = prev; sync(x); counts(); } fail(e); }   // не сохранилось — вернуть прежнюю отметку
    }
    // финальное ревью C2: карточка считается (pick_card: сутки, 10 минут, «Смотрел» у агента) один раз за открытие страницы — при первом настоящем действии с ней:
    // фото (листание, открыть), «Развернуть», 📍 карта, ⭐ / ✗ / ❓. Поиск сам ничего не считает. Ошибка срока/устройства/суток — экран PICK.stop, «нет в подборке» — подсказка
    const opened = new Set();
    function touch(c) {
      const num = +c?.dataset?.num; if (!num || opened.has(num)) return;
      opened.add(num);
      call('pick_card', { num }).catch(e => { if (!e?.data) opened.delete(num); fail(e); });   // нет связи — попробуем при следующем действии
    }
    const root = $('#s-app');
    root.addEventListener('click', e => {
      const c0 = e.target.closest('.s-card[data-num]'); if (c0 && e.target.closest('.s-ph img, [data-nav], .s-more, [data-map], [data-pm]')) touch(c0);
      const tb = e.target.closest('[data-tab]'); if (tb) return tab(tb.dataset.tab);
      if (e.target.closest('[data-pk-map]')) return S().openMap(shownList.slice(0, 24).map(x => x.num));   // v5.48 H2: найденное в «Подборе» — точки по одному (улица, адрес скрыт всегда)
      const m = e.target.closest('[data-pm]');
      if (m) {
        const c = m.closest('.s-card'), x = store.get(+c.dataset.num);
        if (m.dataset.pm === 'q') {
          const q = c.querySelector('.p-q'); q.hidden = !q.hidden; m.setAttribute('aria-expanded', String(!q.hidden));
          if (!q.hidden) c.querySelector('.p-cm').focus();
          return;
        }
        const prev = x.mark;
        x.mark = x.mark === m.dataset.pm ? null : m.dataset.pm;
        sync(x); counts(); save(c, prev);
      }
    });
    root.addEventListener('touchmove', e => { const g = e.target.closest?.('.s-ph'); if (g) touch(g.closest('.s-card')); }, { passive: true });   // листание фото пальцем (наведение мышью — не действие)
    root.addEventListener('input', e => { const c = e.target.closest('.p-cm'); if (c) { const card = c.closest('.s-card'); clearTimeout(card._t); card._t = setTimeout(() => save(card), 1200); } });
    root.addEventListener('change', e => { const c = e.target.closest('.p-cm'); if (c) { const card = c.closest('.s-card'); clearTimeout(card._t); save(card); } });
    root.addEventListener('submit', e => {
      e.preventDefault(); search(false);
      if (matchMedia('(max-width: 819px)').matches) { $('#p-f').open = false; scrollTo({ top: Math.max(0, $('#p-count').getBoundingClientRect().top + scrollY - 70) }); }
    });
    $('#p-sort').addEventListener('change', () => search(false));
    $('#p-reset').addEventListener('click', () => { fm().reset(); search(false); });
    $('#p-more').addEventListener('click', () => search(true));
    counts(); search(false);
  }


  // ====================================================================================================
  // v5.48 H9: сторона агента. sendHtml / onCopy — кнопки «Скопировать / WhatsApp / Telegram / MAX» с готовым текстом (окно создания на главной,
  // страница ссылки, CRM); agent(d, call) — страница ссылки s.html#<код>&a=1 (s.js зовёт её для sel_agent с kind = 'pick').
  // Агент видит телефоны/владельцев/цены собственника; всё, что приходит с сервера, — только через esc().
  // ====================================================================================================
  const eh = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mskTxt = u => new Date(u).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const sendText = (until, link) => `Подобрал для вас варианты — выберите, что посмотреть, и задайте вопросы. Ссылка действует до ${mskTxt(until)}${link ? `\n${link}` : ''}`;
  // phone — телефон клиента CRM (если есть): WhatsApp откроется сразу его чатом. MSGAPP (msgapp.js) сам превращает wa.me / t.me в приложение
  function sendHtml(link, until, phone) {
    const msg = sendText(until, link), d = String(phone ?? '').replace(/\D/g, ''), ph = /^8\d{10}$/.test(d) ? '7' + d.slice(1) : d.length === 10 ? '7' + d : d;
    return `<div class="pk-send" role="group" aria-label="Отправить ссылку клиенту">
      <button type="button" class="btn primary" data-pk-copy="${eh(msg)}">Скопировать</button>
      <a class="btn soft" href="https://wa.me/${eh(ph)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>
      <a class="btn soft" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(sendText(until))}" target="_blank" rel="noopener">Telegram</a>
      <button type="button" class="btn soft" data-pk-copy="${eh(msg)}" data-pk-max title="MAX не открывает чат по ссылке: текст скопируется — вставьте его клиенту">MAX</button></div>`;
  }
  // true — нажатие обработано. toast — функция страницы
  function onCopy(e, toast) {
    const b = e.target.closest?.('[data-pk-copy]'); if (!b) return false;
    const txt = b.dataset.pkCopy, done = () => toast(b.hasAttribute('data-pk-max') ? 'Текст скопирован — вставьте его клиенту в MAX' : 'Текст со ссылкой скопирован');
    (navigator.clipboard?.writeText(txt) ?? Promise.reject()).then(done, () => toast(txt, 9000));
    return true;
  }

  const QS = { none: 'без ответа', sent: 'отправлен собственнику', replied: 'собственник ответил', answered: 'ответ клиенту отправлен' };
  const QSTEPS = ['none', 'sent', 'replied', 'answered'];
  const CLOSED = { cards10m: 'Ссылка закрыта автоматически: за 10 минут открыто больше 100 карточек.', nets: 'Ссылка была закрыта автоматически: её открывали из трёх разных сетей за сутки.' };   // nets больше не закрывает (R22) — только у старых ссылок
  const FLT = [['all', 'Все'], ['yes', 'Хочет посмотреть'], ['q', 'Есть вопросы без ответа'], ['no', 'Не подходит']];
  const fmtPh = n => `+${n.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5')}`;
  const mon = v => Math.round(v).toLocaleString('ru-RU');
  const pl = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  // текст собственника → клиенту: pick-scrub.js (те же правила, что cleanAnswer на сервере)
  const scrub = t => window.PICK_SCRUB ? window.PICK_SCRUB(t) : '';

  function agent(d, call) {
    const hs = location.hash.slice(1), t = hs.split(/[?&]/)[0], root = $('#s-app');
    const clientLink = () => `${location.href.split('#')[0]}#${t}`;
    const creationRequest = SELECTION_REQUEST.createForUser(call);
    const toast = (m, ms) => S().toast(m, ms);
    let flt = 'all', marks = {}, mod = null;
    document.title = `Самоподбор — ${d.title || 'ссылка'}`;
    const live = () => !!d.live;
    const byNum = new Map();
    const index = () => { byNum.clear(); (d.items ?? []).forEach(x => byNum.set(x.num, x)); };
    index();
    S().setData(d);   // v5.48 H2: s.js рисует карту агента (sel_map_agent) по d.id и d.items
    const hasQ = x => !!x.ccomment && x.cmark !== 'no';
    const lists = () => {
      const chosen = d.chosen ?? [], rejected = (d.items ?? []).filter(x => x.cmark === 'no');
      const seen = (d.seen ?? []).filter(s => { const x = byNum.get(s.num); return !x || !(x.cmark || x.ccomment); });
      return { chosen, rejected, seen, advised: (d.items ?? []).filter(x => x.advised) };
    };
    const shown = L => flt === 'yes' ? L.chosen.filter(x => x.cmark === 'yes') : flt === 'q' ? L.chosen.filter(x => hasQ(x) && !x.answer) : flt === 'no' ? L.rejected : L.chosen;

    // ---------- окна
    const lock = on => document.body.classList.toggle('sa-lock', on);
    function modal(html) {
      $('#pk-modal')?.remove();
      document.body.insertAdjacentHTML('beforeend', `<div class="sa-modal" id="pk-modal" role="dialog" aria-modal="true"><div class="sa-sheet">${html}</div></div>`);
      lock(true); mod = $('#pk-modal'); return mod;
    }
    const closeMod = () => { $('#pk-modal')?.remove(); mod = null; lock(false); };
    const head = (title) => `<div class="sa-sh-head"><b>${eh(title)}</b><button type="button" class="s-x2" data-close aria-label="Закрыть">✕</button></div>`;

    // ---------- рисование
    function status() {
      const left = Date.parse(d.until) - Date.now();
      const st = live() ? `<span class="pk-b on">активна до ${eh(mskTxt(d.until))}</span>` : '<span class="pk-b off">закрыта</span>';
      const soon = live() && left > 0 && left <= 2 * 3600e3 ? ' <span class="pk-b warn">скоро закончится</span>' : '';
      return `${st}${soon}<span class="pk-b">открывали: ${d.views ?? 0} ${pl(d.views ?? 0, 'раз', 'раза', 'раз')}</span><span class="pk-b">устройств: ${d.devices ?? 0} из 2</span>`;
    }
    function card(x, kind) {
      const q = hasQ(x), step = QSTEPS.indexOf(x.qstate ?? 'none'), m = marks[x.num], ph = x.photos?.[0];
      const price = [x.price ? `Собственник: <b>${mon(x.price)} ₽</b>` : '', x.client_price ? `клиенту: <b>${mon(x.client_price)} ₽</b>` : ''].filter(Boolean).join(' · ');
      const tel = S().intl(x.phone);
      return `<article class="pk-card" data-num="${x.num}">
        ${ph ? (S().gal ? `<div class="pk-ph pk-gal">${S().gal(x.photos, 9)}</div>` : `<img class="pk-ph" src="${eh(ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">`) : '<div class="pk-ph pk-noph" aria-hidden="true">Фото нет</div>'}
        <div class="pk-body">
          <div class="pk-top"><h3>${eh(x.what)}</h3><small class="muted">№ ${x.num}</small></div>
          ${x.place ? `<p class="muted pk-place">${eh(x.place)}</p>` : ''}
          ${price ? `<p class="pk-price">${price}</p>` : ''}
          <div class="pk-tags">${x.cmark === 'yes' ? '<span class="pk-b on">⭐ Хочет посмотреть</span>' : x.cmark === 'no' ? '<span class="pk-b off">✗ Не подходит</span>' : q ? '<span class="pk-b">❓ Вопрос</span>' : ''}
            ${x.ad_state === 'ads' ? '<span class="pk-b warn">В рекламе</span>' : x.ad_state === 'unique' ? '<span class="pk-b on">Уникальна</span>' : ''}${x.gone ? '<span class="pk-b off">Снято с продажи</span>' : ''}</div>
          ${x.ccomment ? `<p class="pk-q"><b>Вопрос клиента:</b> «${eh(x.ccomment)}»</p>` : ''}
          ${q ? `<div class="pk-qs" role="list" aria-label="Состояние вопроса">${QSTEPS.map((k, i) => `<span role="listitem" class="${i < step ? 'done' : i === step ? 'cur' : ''}">${eh(QS[k])}</span>`).join('')}</div>` : ''}
          ${q && m?.text ? `<p class="pk-own"><b>Собственник ответил:</b> «${eh(m.text)}»</p>` : ''}
          ${x.answer ? `<p class="pk-ans"><b>Вы ответили клиенту:</b> «${eh(x.answer)}»</p>` : ''}
          <div class="pk-acts">
            ${tel ? `<a class="btn soft" href="tel:+${tel}">📞 ${eh(fmtPh(tel))}</a>${x.owner ? `<small class="muted pk-ow">${eh(x.owner)}</small>` : ''}` : '<button type="button" class="btn soft" data-pk-open>📞 Открыть телефон</button>'}
            ${kind === 'chosen' && x.cmark !== 'no' ? `<button type="button" class="btn ghost" data-pk-reply="${x.num}">${x.answer ? 'Изменить ответ клиенту' : 'Ответить клиенту'}</button>` : ''}
          </div>
          <div class="pk-reply" id="pk-r-${x.num}" hidden></div>
        </div></article>`;
    }
    function seenRow(s) {
      const x = byNum.get(s.num);
      return `<li><span class="pk-n">№ ${s.num}</span><span>${x ? eh(x.what) : 'объект из рамки'}${x?.price ? ` · ${mon(x.price)} ₽` : ''}</span><small class="muted">смотрел ${eh(mskTxt(s.at))}</small></li>`;
    }
    // перерисовка не должна стирать недописанный ответ клиенту и открытое «Ещё действия»
    const typing = () => [...root.querySelectorAll('.pk-reply textarea')].some(t => t.value.trim() || t === document.activeElement);
    const soft = () => { if (!typing()) draw(); };
    function draw() {
      index(); const moreOpen = !!root.querySelector('.pk-more[open]');
      const L = lists(), nq = L.chosen.filter(x => hasQ(x) && !x.answer).length, list = shown(L);
      const closed = d.closed_reason && CLOSED[d.closed_reason] ? `<p class="pk-warn" role="status">${eh(CLOSED[d.closed_reason])} Если это ваш клиент — продлите ссылку${(d.devices ?? 0) >= 2 ? ' и сбросьте устройства' : ''}.</p>` : '';
      root.innerHTML = `
        <header class="s-hero pk-hero">
          <p class="pk-kicker">🎯 Самоподбор · страница агента</p>
          <h1>${eh(d.title || 'Подбор для клиента')}</h1>
          ${d.client ? `<p class="pk-client">Клиент: <a href="./#client=${+d.client.id}">${eh(d.client.name)}</a></p>` : ''}
          ${d.frame_text ? `<p class="pk-frame">Рамка: ${eh(d.frame_text)}</p>` : ''}
          <div class="pk-status">${status()}</div>${closed}
          <div class="pk-main">
            <button type="button" class="btn primary" data-pk="extend">Продлить на сутки</button>
            ${live() ? '<button type="button" class="btn soft" data-pk="close">Закрыть сейчас</button>' : ''}
            ${nq ? `<button type="button" class="btn soft" data-pk="ask">Передать вопросы собственникам (${nq})</button>` : ''}
            ${L.chosen.length ? '<button type="button" class="btn soft" data-pk="sel">Сделать подборку из выбранного</button>' : ''}
            ${L.chosen.length || L.rejected.length ? '<button type="button" class="btn soft" data-pk="ai">🤖 Позвать ИИ</button>' : ''}
            ${(d.items ?? []).length ? '<button type="button" class="btn soft" data-pk="map">🗺 Все на карте</button>' : ''}
          </div>
          ${live() ? `<div class="pk-sendbox"><span class="pk-lab">Отправить клиенту</span>${sendHtml(clientLink(), d.until)}</div>` : '<p class="muted">Ссылка закрыта — клиент видит «срок закончился». Продлите её, чтобы отправить клиенту снова.</p>'}
          <details class="pk-more"><summary>Ещё действия</summary><div class="pk-acts2">
            <button type="button" class="btn ghost" data-pk="edit">✎ Изменить рамку и комиссию</button>
            <button type="button" class="btn ghost" data-pk="retoken">Новая ссылка</button>
            <button type="button" class="btn ghost" data-pk="resetdev">Сбросить устройства</button>
            <button type="button" class="btn ghost" data-pk="client">${d.client ? 'Клиент CRM: сменить или отвязать' : 'Привязать к клиенту'}</button>
            <button type="button" class="btn ghost" data-pk="add">Добавить объект клиенту</button>
            <button type="button" class="btn ghost bad" data-pk="del">🗑 Удалить</button></div></details>
          <p class="hint">Новая ссылка — старая перестанет работать, новая откроется на сутки (и закрытая тоже), отметки останутся. «Добавить объект клиенту» кладёт его в «Советует агент» на странице клиента.</p>
        </header>
        <section class="pk-sec"><h2>Выбрал клиент <span class="pk-cnt">${L.chosen.length}</span></h2>
          <div class="pk-flt" role="group" aria-label="Показать">${FLT.map(([k, n]) => `<button type="button" data-pk-flt="${k}" aria-pressed="${flt === k}">${n}${k === 'all' ? '' : ` ${k === 'yes' ? L.chosen.filter(x => x.cmark === 'yes').length : k === 'q' ? nq : L.rejected.length}`}</button>`).join('')}</div>
          <div class="pk-list">${list.length ? list.map(x => card(x, flt === 'no' ? 'rej' : 'chosen')).join('') : `<p class="muted pk-empty">${L.chosen.length || L.rejected.length ? 'В этом фильтре пусто.' : 'Клиент пока ничего не отметил.'}</p>`}</div></section>
        <section class="pk-sec"><h2>Смотрел <span class="pk-cnt">${L.seen.length}</span></h2>
          <p class="hint">Карточки, которые клиент открывал, но не отметил, — подсказка, что ему интересно.</p>
          ${L.seen.length ? `<ul class="pk-rows">${L.seen.slice(0, 60).map(seenRow).join('')}</ul>` : '<p class="muted pk-empty">Пока никого не открывал без отметки.</p>'}</section>
        ${L.advised.length ? `<section class="pk-sec"><h2>Советует агент <span class="pk-cnt">${L.advised.length}</span></h2><p class="hint">Эти объекты клиент видит на вкладке «Советует агент».</p>
          <div class="pk-list">${L.advised.map(x => card(x, 'adv')).join('')}</div></section>` : ''}`;
      if (moreOpen) root.querySelector('.pk-more').open = true;
      creationRequest.mount(root, call).catch(() => {});
    }

    // ---------- данные
    async function reload() { const r = await call('sel_agent'); Object.assign(d, r); S().mapReset(); soft(); loadMarks(); }
    // v5.48 H2: «🤖 Позвать ИИ» — окно помощника (selai.js); добавленное в «Советует агент» → страница перечитывается
    async function aiOpen() {
      const arg = { sel_id: d.id, t, pick: true };
      if (!window.SELAI?.open) { toast('Помощник загружается…'); await new Promise(ok => { const el = document.createElement('script'); el.src = 'selai.js?v=5.71q6'; el.onload = el.onerror = ok; document.head.appendChild(el); }); }
      if (window.SELAI?.open) window.SELAI.open(arg); else toast('Помощник пока недоступен — обновите страницу через минуту', 5000);
    }
    if (window.__pkAdded) document.removeEventListener('selai:added', window.__pkAdded);   // один обработчик на страницу
    window.__pkAdded = e => { if (e.detail?.sel_id === d.id) reload().catch(() => {}); };
    document.addEventListener('selai:added', window.__pkAdded);
    async function loadMarks() {
      const nums = (d.chosen ?? []).filter(hasQ).map(x => x.num); if (!nums.length) return;
      try { const r = await call('own_marks', { _fn: 'auto', nums }); marks = r.marks ?? {}; soft(); } catch { /* ответы собственников — без них страница работает */ }
    }
    const run = async (b, fn, ok) => {
      if (b) b.disabled = true;
      try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok, 4000); return r; }
      catch (e) { toast(e.message || 'Не получилось', 6000); return null; }
      finally { if (b) b.disabled = false; }
    };

    // ---------- «Передать вопросы собственникам» (готовая рассылка «Написать всем»: auto own_init / own_send, для pick сервер берёт объекты с вопросами без ответа)
    const ASK_TPL = 'Здравствуйте! По вашей квартире {объект} в {ЖК}: {вопрос}';
    async function ask() {
      const L = lists(), qs = L.chosen.filter(x => hasQ(x) && !x.answer);
      if (!qs.length) return toast('Нет вопросов клиента без ответа');
      const el = modal(`${head('Передать вопросы собственникам')}<p class="muted sa-sh-sub">Сообщение уйдёт собственнику с вашего аккаунта мессенджера на уже открытый номер. Контакты клиента собственнику не передаются.</p><div id="pk-ask"><p class="muted">Проверяю мессенджеры…</p></div>`);
      let svcs = null;
      try { svcs = await call('own_init', { _fn: 'auto' }); } catch (e) { svcs = { error: e.message }; }
      if (mod !== el) return;
      // v5.69: «сначала свой компьютер» — способ решает WAYS (ways.js): компьютер с расширением → сервер только по галочке → окно «Включите компьютер»
      const ok = [['tg', 'Telegram'], ['wa', 'WhatsApp'], ['max', 'MAX']].map(([svc, title]) => ({ svc, title, ok: true }));
      const box = $('#pk-ask');
      if (svcs.error || !ok.length) { box.innerHTML = `<p class="err">${eh(svcs.error || 'Мессенджер не подключён.')}</p><a class="btn soft" href="hub.html#msg">🔗 Подключить мессенджеры</a><p class="hint">MAX — только вручную: отправка всем сразу выключена.</p>`; return; }
      // R21: объекты без открытого телефона — с кнопкой «Открыть телефон» (то же действие phone, что в карточках: лимиты тарифа действуют)
      const rowHtml = x => `<div class="pk-chk" data-row="${x.num}"><input type="checkbox" value="${x.num}" ${x.qstate === 'sent' ? '' : 'checked'} data-ph="${x.phone ? 1 : 0}" aria-label="№ ${x.num}"><span><b>${eh(x.what)}</b> · № ${x.num}<br><small class="muted">«${eh(x.ccomment)}»${x.qstate === 'sent' ? ' · уже отправлен' : ''}</small>
        ${x.phone ? '' : `<br><small class="pk-nophone">телефон не открыт</small> <button type="button" class="btn soft pk-op" data-ask-open="${x.num}">📞 Открыть телефон</button>`}</span></div>`;
      box.innerHTML = `
        <div class="pk-ask-list" role="group" aria-label="Объекты с вопросами">${qs.map(rowHtml).join('')}</div>
        <p class="hint" id="pk-open-n" role="status"></p><p class="hint" id="pk-quota" role="status"></p>
        <label class="sa-lbl" for="pk-ask-t">Текст сообщения</label>
        <textarea id="pk-ask-t" rows="3" maxlength="1500">${eh(ASK_TPL)}</textarea>
        <p class="hint">Подставятся объект, ЖК и вопрос клиента (без телефонов и ссылок). К первому сообщению добавится № объекта.</p>
        <div class="pk-svcs">${ok.map(s => `<button type="button" class="btn soft" data-ask-svc="${eh(s.svc)}">${eh(s.title)}: предпросмотр</button>`).join('')}</div>
        <div id="pk-wy"></div>
        <small class="muted">${svcs.day_left != null ? `Сегодня можно отправить ещё ${svcs.day_left}. ` : ''}Сообщения уходят по одному с паузами. Ответы проверяю через 30, 60, 90, 120 минут и через 12 часов.</small>
        <div id="pk-prev"></div>`;
      const sel = () => [...box.querySelectorAll('.pk-ask-list input:checked')].map(i => +i.value);
      const needOpen = () => { const n = [...box.querySelectorAll('.pk-ask-list input:checked')].filter(i => i.dataset.ph === '0').length; $('#pk-open-n').textContent = n ? `У ${n} ${pl(n, 'объекта', 'объектов', 'объектов')} телефон не открыт — откройте телефон кнопкой в списке.` : ''; };
      needOpen();
      window.WAYS?.box($('#pk-wy'), ['tg', 'wa', 'max'], { mass: true });   // v5.69: компьютер, галочка облака, вручную
      let lastSvc = null;
      async function preview(svc) {
        const nums = sel(), text = $('#pk-ask-t').value.trim();
        if (!nums.length) return toast('Отметьте хотя бы один объект');
        lastSvc = svc; $('#pk-prev').innerHTML = '<p class="muted">Собираю текст…</p>';
        try {
          const r = await call('own_send', { _fn: 'auto', svc, text, nums, dry: true });
          $('#pk-prev').innerHTML = `<div class="sa-prev">${(r.preview ?? []).map(p => `<div class="sa-pv"><p>${eh(p.text)}</p></div>`).join('')}</div>
            ${r.planned > 2 ? `<p class="muted">…и ещё ${r.planned - 2}.</p>` : ''}${r.need_open ? `<p class="pk-warn">У ${r.need_open} ${pl(r.need_open, 'объекта', 'объектов', 'объектов')} телефон не открыт — откройте телефон в списке; им сообщение не уйдёт.</p>` : ''}
            <div id="pk-ways"></div>
            <div class="sa-cfoot"><button type="button" class="btn primary" data-ask-go="${eh(svc)}">Отправить ${r.planned ?? nums.length}</button></div>`;
          window.WAYS?.box($('#pk-ways'), svc, { mass: true, allowWait: true, action: 'передать вопросы' });   // v5.69: сначала свой компьютер
        } catch (er) { $('#pk-prev').innerHTML = `<p class="err">${eh(er.message)}</p>`; }
      }
      box.addEventListener('change', needOpen);
      box.addEventListener('click', async e => {
        const b = e.target.closest('[data-ask-svc]'), go = e.target.closest('[data-ask-go]'), op = e.target.closest('[data-ask-open]');
        if (op) {
          const x = byNum.get(+op.dataset.askOpen); op.disabled = true; op.textContent = 'Открываю…';
          try {
            const r = await call('phone', { num: x.num }); if (!r.phone) throw new Error(r.error || 'Номера нет в объявлении');
            x.phone = r.phone; x.owner = r.owner ?? r.owner_name ?? x.owner;
            const row = box.querySelector(`[data-row="${x.num}"]`); row.querySelector('input').dataset.ph = '1'; row.querySelectorAll('.pk-nophone, .pk-op').forEach(n => n.remove());
            const u = r.used; if (u && (u.day_lim != null || u.month_lim != null)) $('#pk-quota').textContent = [u.day_lim != null && `Сегодня номеров открыто ${u.day} из ${u.day_lim}, осталось ${Math.max(0, u.day_lim - u.day)}`, u.month_lim != null && `в месяц ${u.month} из ${u.month_lim}, осталось ${Math.max(0, u.month_lim - u.month)}`].filter(Boolean).join(' · ');
            needOpen(); soft();
            if (lastSvc) preview(lastSvc);   // тот же предпросмотр заново — теперь с этим номером
          } catch (er) { op.disabled = false; op.textContent = '📞 Открыть телефон'; toast(er.message, 6000); }
          return;
        }
        if (b) { b.disabled = true; await preview(b.dataset.askSvc); b.disabled = false; return; }
        if (go) {
          const text = $('#pk-ask-t').value.trim(), nums = sel();
          go.disabled = true; go.textContent = 'Отправляю…';
          try {
            const svc = go.dataset.askGo;
            let via = window.WAYS ? await window.WAYS.pick(svc, { mass: true, allowWait: true, action: 'передать вопросы' }) : 'ext';
            if (via === 'off') { go.disabled = false; go.textContent = 'Отправить'; return; }
            let r; try { r = await call('own_send', { _fn: 'auto', svc, text, nums, ...window.WAYS?.via(via) }); }
            catch (e1) { if (!window.WAYS?.isNeedPc(e1) || (via = await window.WAYS.needPc(svc, e1, { mass: true, allowWait: true })) === 'off') throw e1; r = await call('own_send', { _fn: 'auto', svc, text, nums, ...window.WAYS?.via(via) }); }
            if (via === 'ext' && document.documentElement.dataset.daExt) window.postMessage({ da: 'sendPoll' }, location.origin);
            if (!r.waiting) window.MSGAPP?.watch?.(r.id);   // v5.68: 5 мин без отправки — сервер или окно «вручную»
            $('#pk-prev').innerHTML = `<p class="pk-ok" role="status">${r.waiting ? 'Сохранено до подключения сервера' : 'Поставил в очередь'}: ${r.planned ?? nums.length}. ${r.waiting ? 'Сообщения пока не отправлены. Состояние обновится после подключения.' : 'Отправка идёт по одному с паузами — состояние вопроса обновится на этой странице.'}</p>${r.need_open ? `<p class="pk-warn">У ${r.need_open} ${pl(r.need_open, 'объекта', 'объектов', 'объектов')} телефон не открыт — им не отправлено.</p>` : ''}`;
            setTimeout(() => reload().catch(() => {}), 20000);
          } catch (er) { go.disabled = false; go.textContent = 'Отправить'; $('#pk-prev').insertAdjacentHTML('afterbegin', `<p class="err">${eh(er.message)}</p>`); }
        }
      });
    }

    // ---------- «Изменить рамку и комиссию»
    function edit() {
      const fr = d.frame ?? {}, v = k => fr[k] ?? '';
      const el = modal(`${head('Рамка и комиссия')}
        <label class="sa-lbl" for="pk-e-t">Название</label><input id="pk-e-t" maxlength="80" value="${eh(d.title)}">
        <label class="sa-lbl" for="pk-e-m">Комиссия сверху цены: <b id="pk-e-mv">${eh(d.markup)}%</b></label><input id="pk-e-m" type="range" min="0" max="10" step="0.5" value="${eh(d.markup)}">
        <p class="hint">Районы и ЖК менять здесь нельзя: ${eh(d.frame_text || 'не заданы')}. Чтобы их сменить — создайте новую ссылку на главной.</p>
        <div class="pk-two"><label>Цена от, млн ₽<input id="pk-e-pmin" inputmode="decimal" value="${eh(v('pmin'))}"></label><label>до, млн ₽<input id="pk-e-pmax" inputmode="decimal" value="${eh(v('pmax'))}"></label></div>
        <div class="pk-two"><label>Площадь от, м²<input id="pk-e-amin" inputmode="decimal" value="${eh(v('amin'))}"></label><label>до, м²<input id="pk-e-amax" inputmode="decimal" value="${eh(v('amax'))}"></label></div>
        <div class="sa-lbl">Комнаты</div><div class="pk-chips">${[0, 1, 2, 3, 4].map(n => `<label class="p-chip"><input type="checkbox" name="r" value="${n}"${(fr.r ?? []).includes(n) ? ' checked' : ''}><span>${n ? (n === 4 ? '4+' : n) : 'Студия'}</span></label>`).join('')}</div>
        <p class="hint">Клиент увидит новую рамку при следующем поиске. Отметки останутся.</p>
        <div class="sa-cfoot"><button type="button" class="btn primary" id="pk-e-go">Сохранить</button><button type="button" class="btn ghost" data-close>Отмена</button></div>`);
      $('#pk-e-m').oninput = () => { $('#pk-e-mv').textContent = `${$('#pk-e-m').value}%`; };
      $('#pk-e-go').onclick = async ev => {
        const num = id => { const x = parseFloat(String($(id).value).replace(',', '.')); return x > 0 ? x : undefined; };
        const f = { ...fr }; for (const k of ['pmin', 'pmax', 'amin', 'amax']) { const x = num('#pk-e-' + k); if (x) f[k] = x; else delete f[k]; }
        const r4 = [...el.querySelectorAll('input[name="r"]:checked')].map(i => +i.value); if (r4.length) f.r = r4; else delete f.r;
        const r = await run(ev.currentTarget, () => call('pick_edit', { id: d.id, title: $('#pk-e-t').value.trim(), markup: +$('#pk-e-m').value, f }), x => `Сохранено · в рамке ${x.count ?? '—'} ${pl(x.count ?? 0, 'объект', 'объекта', 'объектов')}`);
        if (r) { closeMod(); reload(); }
      };
    }
    async function clientLinkDlg() {
      const cur = d.client?.id ?? null;
      const el = modal(`${head('Клиент CRM')}<p class="muted">Выбранные клиентом ⭐ и ❓ сами попадут в объекты этого клиента с пометкой «выбрал сам».</p>${cur ? `<p>Сейчас: <b>${eh(d.client.name)}</b></p>` : '<p class="muted">Сейчас ссылка без клиента.</p>'}<div id="pk-cl"><p class="muted">Загружаю клиентов…</p></div>`);
      let L = null; try { L = await call('crm_list', {}); } catch (e) { $('#pk-cl').innerHTML = `<p class="err">${eh(e.message)}</p>`; return; }
      if (mod !== el) return;
      const cs = (L.clients ?? []).slice(0, 500);
      if (cur && !cs.some(c => c.id === cur)) cs.unshift({ id: cur, name: d.client.name });
      $('#pk-cl').innerHTML = `<label class="sa-lbl" for="pk-cl-s">Клиент</label><select id="pk-cl-s">${cur ? '' : '<option value="">— выберите клиента —</option>'}${cs.map(c => `<option value="${c.id}"${c.id === cur ? ' selected' : ''}>${eh(c.name || c.phone || `Клиент ${c.id}`)}</option>`).join('')}</select>
        <div class="sa-cfoot"><button type="button" class="btn primary" id="pk-cl-go" disabled>${cur ? 'Сменить клиента' : 'Привязать'}</button>${cur ? '<button type="button" class="btn ghost bad" id="pk-cl-off">Отвязать от клиента</button>' : ''}<button type="button" class="btn ghost" data-close>Отмена</button></div>`;
      const go = $('#pk-cl-go'), sel = $('#pk-cl-s');
      sel.onchange = () => { go.disabled = !sel.value || +sel.value === cur; };   // нужен явный выбор другого клиента
      go.onclick = async ev => {
        const c = cs.find(x => x.id === +sel.value);
        const r = await run(ev.currentTarget, () => call('pick_edit', { id: d.id, client_id: +sel.value }), 'Ссылка привязана к клиенту');
        if (r) { d.client = { id: c.id, name: c.name || c.phone || `Клиент ${c.id}` }; closeMod(); soft(); }
      };
      $('#pk-cl-off')?.addEventListener('click', async ev => {
        if (!confirm(`Отвязать ссылку от клиента «${d.client.name}»? Уже добавленные ему объекты останутся.`)) return;
        const r = await run(ev.currentTarget, () => call('pick_edit', { id: d.id, client_id: null }), 'Ссылка отвязана от клиента');
        if (r) { d.client = null; closeMod(); soft(); }
      });
    }
    function addDlg() {
      modal(`${head('Добавить объект клиенту')}<p class="muted">Номера объектов через запятую — они появятся у клиента на вкладке «Советует агент» (до 20).</p>
        <input id="pk-a-n" inputmode="numeric" placeholder="Например: 150017, 150233" autocomplete="off">
        <div class="sa-cfoot"><button type="button" class="btn primary" id="pk-a-go">Добавить</button><button type="button" class="btn ghost" data-close>Отмена</button></div>`);
      $('#pk-a-go').onclick = async ev => {
        const nums = ($('#pk-a-n').value.match(/\d{3,}/g) ?? []).map(Number); if (!nums.length) return toast('Впишите номера объектов');
        const r = await run(ev.currentTarget, () => call('pick_add', { id: d.id, nums }), 'Добавлено клиенту');
        if (r) { closeMod(); reload(); }
      };
    }
    function replyDlg(x) {
      const box = $(`#pk-r-${x.num}`); if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      const pre = x.answer || scrub(marks[x.num]?.text);
      box.hidden = false;
      box.innerHTML = `<label class="sa-lbl" for="pk-rt-${x.num}">Ответ клиенту</label><textarea id="pk-rt-${x.num}" rows="3" maxlength="500" placeholder="Что ответить клиенту по этому объекту">${eh(pre)}</textarea>
        <p class="hint">${pre && !x.answer ? 'Подставлен ответ собственника — без телефонов, ссылок и номера дома. Поправьте и отправьте. ' : ''}Клиент увидит текст под объектом как «Ответ агента».</p>
        <p class="pk-warn" id="pk-rw-${x.num}" hidden role="status"></p>
        <div class="pk-acts"><button type="button" class="btn primary" data-pk-send="${x.num}">Отправить</button>${x.answer ? `<button type="button" class="btn ghost" data-pk-unans="${x.num}">Снять ответ</button>` : ''}</div>`;
      box.querySelector('textarea').focus();
    }
    async function sendReply(x, b, text) {
      const r = await run(b, () => call('pick_answer', { id: d.id, num: x.num, text }), text ? 'Ответ отправлен клиенту' : 'Ответ снят');
      if (!r) return;
      x.answer = r.text || ''; if (text) x.qstate = 'answered'; else if (x.qstate === 'answered') x.qstate = marks[x.num]?.text ? 'replied' : 'none';
      if (r.warn) { draw(); const w = $(`#pk-r-${x.num}`); if (w) { replyDlg(x); const m = $(`#pk-rw-${x.num}`); m.hidden = false; m.textContent = 'Проверьте: в тексте похоже на телефон/адрес'; } toast('Проверьте: в тексте похоже на телефон/адрес', 7000); }
      else draw();
    }

    // ---------- события
    root.addEventListener('click', async e => {
      if (onCopy(e, toast)) return;
      const f = e.target.closest('[data-pk-flt]'); if (f) { flt = f.dataset.pkFlt; draw(); return; }
      const card0 = e.target.closest('.pk-card'), x = card0 ? byNum.get(+card0.dataset.num) : null;
      if (e.target.closest('[data-pk-open]') && x) {
        const b = e.target.closest('[data-pk-open]'); b.textContent = 'Открываю…';
        const r = await run(b, () => call('phone', { num: x.num })); 
        if (r?.phone) { x.phone = r.phone; x.owner = r.owner ?? r.owner_name ?? x.owner; draw(); } else b.textContent = '📞 Открыть телефон';
        return;
      }
      if (e.target.closest('[data-pk-reply]') && x) return replyDlg(x);
      const sb = e.target.closest('[data-pk-send]'); if (sb && x) { const tx = $(`#pk-rt-${x.num}`).value.trim(); if (!tx) return toast('Напишите ответ или нажмите «Снять ответ»'); return sendReply(x, sb, tx); }
      if (e.target.closest('[data-pk-unans]') && x) return sendReply(x, e.target.closest('[data-pk-unans]'), '');
      const b = e.target.closest('[data-pk]'); if (!b) return;
      const k = b.dataset.pk;
      if (k === 'extend') { const r = await run(b, () => call('pick_extend', { id: d.id }), x2 => `Продлено до ${mskTxt(x2.until)}`); if (r) { d.until = r.until; d.live = true; d.closed_reason = null; draw(); } }
      else if (k === 'close') { if (!confirm('Закрыть ссылку сейчас? Клиент сразу увидит «срок закончился». Отметки сохранятся.')) return; const r = await run(b, () => call('pick_close', { id: d.id }), 'Ссылка закрыта'); if (r) { d.until = new Date().toISOString(); d.live = false; draw(); } }
      else if (k === 'retoken') {
        if (!confirm('Выпустить новую ссылку? Старая перестанет открываться, новая действует сутки, устройства сбросятся — отметки клиента останутся.')) return;
        const r = await run(b, () => call('pick_retoken', { id: d.id }), 'Новая ссылка готова — отправьте её клиенту');
        if (r?.link) { const nt = String(r.link).split('#')[1]; if (nt) { history.replaceState(null, '', `${location.pathname}${location.search}#${nt}&a=1`); location.reload(); } }
      }
      else if (k === 'resetdev') { const r = await run(b, () => call('pick_reset_dev', { id: d.id }), 'Устройства сброшены — ссылку можно открыть на двух новых'); if (r) { d.devices = 0; draw(); } }
      else if (k === 'sel') {
        const r = await run(b, () => creationRequest.send(call, {id: d.id, nums: lists().chosen.map(x => x.num)}, 'pick_to_sel'));
        if (r) {
          const l = r.link || '';
          modal(`${head('Подборка готова')}<p>Обычная подборка-ссылка на 30 дней из выбранного клиентом${r.cut ? ` (не вошло: ${r.cut} — ссылкой до 20 объектов)` : ''}, с той же комиссией. Клиенту её выбирать заново не нужно.</p>
            ${l ? `<input readonly value="${eh(l)}" aria-label="Ссылка на подборку"><div class="sa-cfoot"><button type="button" class="btn primary" data-pk-copy="${eh(l)}">Скопировать ссылку</button>` : '<div class="sa-cfoot">'}<a class="btn soft" href="./#sels=all">Открыть в «Моих подборках»</a><button type="button" class="btn ghost" data-close>Закрыть</button></div>`);
        }
      }
      else if (k === 'ask') ask();
      else if (k === 'ai') aiOpen();
      else if (k === 'map') S().openMap(null);
      else if (k === 'edit') edit();
      else if (k === 'client') clientLinkDlg();
      else if (k === 'add') addDlg();
      else if (k === 'del') {
        if (!confirm('Удалить ссылку? Клиенту она перестанет открываться. Отметки сохранятся 30 дней, потом удалятся.')) return;
        const r = await run(b, () => call('sel_delete', { id: d.id })); if (r) location.href = './#sels=pick';
      }
    });
    document.addEventListener('click', e => { if (mod && e.target.closest('#pk-modal')) onCopy(e, toast); if (mod && (e.target === mod || e.target.closest('#pk-modal [data-close]'))) closeMod(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && mod) closeMod(); });

    draw(); loadMarks();
    // «Продлить» из уведомления (&do=extend): сразу продлить и убрать признак из адреса, чтобы повторное открытие не продлевало снова
    if (/(^|[?&])do=extend(&|$)/.test(hs)) {
      history.replaceState(null, '', `${location.pathname}${location.search}#${hs.replace(/(^|&)do=extend(?=&|$)/, '').replace(/^&/, '')}`);
      call('pick_extend', { id: d.id }).then(r => { d.until = r.until; d.live = true; d.closed_reason = null; draw(); toast(`Ссылка продлена до ${mskTxt(r.until)}`, 6000); }, e => toast(e.message || 'Не удалось продлить', 7000));
    }
  }

  window.PICK = { client, stop, agent, sendHtml, onCopy, sendText };
})();

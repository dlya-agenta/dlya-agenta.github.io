// Подборка для клиента по ссылке s.html#<токен> (ТЗ v2, шаг 3.2). Без входа: sel_public — объекты, sel_feedback — ✓ «подходит» / ✗ «не подходит»
// и строка комментария, сохраняется сразу. Агент, открывший свою ссылку в браузере, где вошёл на сайт, видит пометку; его просмотры не считаются.
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // описание (v5.17.3): разделы **жирным** по шаблону; у старых описаний — «Заголовок:» жирным, строка «Коротко:» не показывается
  const descrHtml = s => esc(String(s ?? '').replace(/^Коротко:.*(\n|$)/m, '').trim())
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/^([А-ЯЁ][а-яё ]{2,20}:)/gm, '<b>$1</b>');
  const money = v => Math.round(v).toLocaleString('ru-RU');
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
  const seaTxt = m => m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км`;
  const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;
  const hs = location.hash.slice(1), t = hs.split(/[?&]/)[0];
  // v5.20: страница агента — #<токен>&a=1 или #id=<номер подборки>&a=1 (подборка только с PDF): собственники, написать всем, позвонить
  const agentMode = /(^|[?&])a=1(&|$)/.test(hs), selId = +(/(?:^|[?&])id=(\d+)/.exec(hs)?.[1] || 0);
  let tok = null;
  try { tok = JSON.parse(localStorage.getItem('token')); } catch { /* приватный режим */ }

  async function call(action, { _fn, ...extra } = {}) {
    const body = JSON.stringify({ action, t, ...(selId ? { id: selId } : {}), ...(typeof tok === 'string' ? { auth: { token: tok } } : {}), ...extra });
    const url = _fn === 'auto' ? String(window.API).replace(/\/web$/, '/auto') : window.API;
    for (let i = 0; ; i++) {   // первое соединение иногда обрывается — один повтор
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        const d = await r.json().catch(() => ({ error: 'server', message: `Ошибка сервера (HTTP ${r.status})` }));
        if (!r.ok || d.error) throw Object.assign(new Error(d.message || 'Ошибка'), { data: d });
        return d;
      } catch (e) { if (e.data || i) throw e.data ? e : new Error('Нет связи — проверьте интернет и обновите страницу'); }
    }
  }
  function toast(m, ms = 2600) { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); }
  const fail = m => { $('#s-app').innerHTML = `<div class="s-empty"><h1>Подборка недоступна</h1><p class="muted">${esc(m)}</p></div>`; };

  const digits = p => String(p ?? '').replace(/\D/g, '');
  const intl = p => { let d = digits(p); if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1); if (d.length === 10) d = '7' + d; return d.length >= 11 ? d : ''; };   // 8 918… → 7918…

  // v5.20: фото листаются, как на главной: стрелки, точки, свайп пальцем; на компьютере — ведёшь мышкой по фото; нажатие — на весь экран
  const gal = (photos, i) => photos.length ? `<div class="s-gal"><div class="s-ph" data-i="${i}">${photos.map((u, k) => `<div class="s-im"><img src="${esc(u)}" alt="Фото ${k + 1}" loading="${i < 2 && !k ? 'eager' : 'lazy'}" referrerpolicy="no-referrer" data-k="${k}"></div>`).join('')}</div>
      ${photos.length > 1 ? `<button type="button" class="s-nav l" data-nav="-1" aria-label="Предыдущее фото">‹</button><button type="button" class="s-nav r" data-nav="1" aria-label="Следующее фото">›</button>
      <div class="s-dots">${photos.map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div><span class="s-cnt">${photos.length} фото</span>` : ''}</div>` : '<div class="s-ph s-noph">Фото нет</div>';
  document.addEventListener('scroll', e => {
    const st = e.target; if (!st.classList?.contains('s-ph')) return;
    const k = Math.round(st.scrollLeft / st.clientWidth);
    st.parentElement.querySelectorAll('.s-dots i').forEach((d, j) => d.classList.toggle('on', j === k));
  }, true);
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', e => {
      const g = e.target.closest?.('.s-gal'), st = g?.querySelector('.s-ph'); if (!st || e.target.closest('[data-nav]')) return;
      const n = st.children.length; if (n < 2) return;
      const r = g.getBoundingClientRect(), k = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
      if (g.dataset.k == k) return;
      g.dataset.k = k; st.scrollTo({ left: k * st.clientWidth, behavior: 'instant' });
    });
    document.addEventListener('mouseout', e => { const g = e.target.closest?.('.s-gal'); if (g && !g.contains(e.relatedTarget) && +g.dataset.k) { g.dataset.k = 0; g.querySelector('.s-ph').scrollTo({ left: 0, behavior: 'instant' }); } });
  }

  function card(x, i, n) {
    const ph = gal(x.photos, i);
    const tags = [...x.tags, x.sea_m ? `≈ ${seaTxt(x.sea_m)} до моря` : null].filter(Boolean);
    return `<article class="s-card${x.mark ? ` m-${x.mark}` : ''}" data-num="${x.num}">${ph}
      <div class="s-body">
        <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : 'цена по запросу'}${x.ppm ? `<small>${money(x.ppm)} ₽/м²</small>` : ''}</div></div>
        ${x.place ? `<p class="muted s-place">${esc(x.place)}</p>` : ''}
        ${tags.length ? `<div class="s-tags">${tags.map(g => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : ''}
        ${x.gone ? '<p class="s-gone">Объявление снято с продажи — уточните у агента.</p>' : ''}
        ${x.descr ? `<p class="s-descr">${descrHtml(x.descr)}</p><button type="button" class="btn ghost s-more" hidden>Развернуть</button>` : ''}
        <div class="s-fb">
          <div class="s-marks" role="group" aria-label="Подходит ли объект">
            <button type="button" class="s-yes" data-mark="yes" aria-pressed="${x.mark === 'yes'}">✓ Подходит</button>
            <button type="button" class="s-no" data-mark="no" aria-pressed="${x.mark === 'no'}">✗ Не подходит</button>
          </div>
          <input class="s-cm" type="text" maxlength="300" value="${esc(x.comment)}" placeholder="Напишите, что нравится, а что нет" aria-label="Комментарий к объекту ${i + 1}" enterkeyhint="done">
          <small class="s-st muted" aria-live="polite"></small>
        </div>
        <small class="muted s-no-num">${i + 1} из ${n} · № ${x.num}</small>
      </div></article>`;
  }

  let data = null;
  function render(d) {
    data = d;
    document.title = d.title || 'Подборка объектов';
    const n = d.items.length, tel = intl(d.agent_phone);
    $('#s-app').innerHTML = `
      ${d.owner ? `<div class="s-owner">Это ваша подборка — так её видит клиент. Ваши открытия не считаются и уведомления о них не приходят.${d.views != null ? ` Клиент открывал: ${d.views} ${plural(d.views, 'раз', 'раза', 'раз')}.` : ''}</div>` : ''}
      <header class="s-hero">
        <h1>${esc(d.title)}</h1>
        <p class="muted">Подборка от ${day(d.created_at)} · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · ссылка действует до ${day(d.until)}</p>
        ${d.agent || tel ? `<div class="s-agent"><span>Ваш агент${d.agent ? `: <b>${esc(d.agent)}</b>` : ''}</span><span class="s-agent-btns">
          ${tel ? `<a class="btn soft" href="tel:+${tel}">Позвонить</a><a class="btn ghost" href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</span></div>` : ''}
        <p class="hint">Отметьте у каждого объекта ✓ «подходит» или ✗ «не подходит» и напишите, что нравится, а что нет, — агент увидит сразу.</p>
      </header>
      <div class="s-list">${d.items.map((x, i) => card(x, i, n)).join('') || '<p class="muted">В подборке нет объектов.</p>'}</div>`;
    // «Развернуть» — только у длинных описаний
    requestAnimationFrame(() => document.querySelectorAll('.s-descr').forEach(p => { if (p.scrollHeight - p.clientHeight > 10) p.nextElementSibling.hidden = false; }));
  }

  // сохранить отметку и комментарий объекта (сервер хранит одну строку на объект)
  async function save(cardEl) {
    const num = +cardEl.dataset.num, x = data.items.find(i => i.num === num), st = cardEl.querySelector('.s-st');
    const comment = cardEl.querySelector('.s-cm').value.trim();
    st.textContent = 'Сохраняю…';
    try {
      const r = await call('sel_feedback', { num, mark: x.mark, comment });
      x.comment = r.comment;
      st.textContent = x.mark || comment ? 'Сохранено — агент увидит' : 'Отметка снята';
    } catch (e) { st.textContent = ''; toast(e.message, 5000); }
  }

  document.addEventListener('click', e => {
    const nv = e.target.closest('.s-gal [data-nav]');
    if (nv) { const st = nv.closest('.s-gal').querySelector('.s-ph'); st.scrollBy({ left: st.clientWidth * +nv.dataset.nav, behavior: 'smooth' }); return; }
    const m = e.target.closest('[data-mark]');
    if (m) {
      const c = m.closest('.s-card'), x = data.items.find(i => i.num === +c.dataset.num);
      x.mark = x.mark === m.dataset.mark ? null : m.dataset.mark;   // повторное нажатие снимает отметку
      c.classList.toggle('m-yes', x.mark === 'yes'); c.classList.toggle('m-no', x.mark === 'no');
      c.querySelectorAll('[data-mark]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mark === x.mark)));
      save(c);
    }
    const more = e.target.closest('.s-more');
    if (more) { const p = more.previousElementSibling; p.classList.toggle('open'); more.textContent = p.classList.contains('open') ? 'Свернуть' : 'Развернуть'; }
    const img = e.target.closest('.s-ph img');
    if (img) open(+img.closest('.s-ph').dataset.i, +img.dataset.k);
  });
  // комментарий: через секунду после ввода и при выходе из поля
  document.addEventListener('input', e => {
    const c = e.target.closest('.s-cm');
    if (!c) return;
    const card = c.closest('.s-card');
    clearTimeout(card._t); card._t = setTimeout(() => save(card), 1200);
  });
  document.addEventListener('change', e => { const c = e.target.closest('.s-cm'); if (c) { const card = c.closest('.s-card'); clearTimeout(card._t); save(card); } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('.s-cm')) e.target.blur(); });

  // просмотр фото на весь экран
  let cur = null;
  function open(i, k) { cur = { i, k }; show(); $('#s-view').hidden = false; }
  function show() { const p = data.items[cur.i].photos; cur.k = (cur.k + p.length) % p.length; $('#s-view img').src = p[cur.k]; }
  $('#s-view').onclick = e => {
    const s = e.target.closest('[data-step]');
    if (s) { cur.k += +s.dataset.step; return show(); }
    $('#s-view').hidden = true;
  };
  document.addEventListener('keydown', e => {
    if ($('#s-view').hidden) return;
    if (e.key === 'Escape') $('#s-view').hidden = true;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { cur.k += e.key === 'ArrowRight' ? 1 : -1; show(); }
  });

  addEventListener('hashchange', () => location.reload());   // вставили другую ссылку в ту же вкладку
  if (agentMode) AGENT();
  else if (!/^[A-Za-z0-9_-]{22,40}$/.test(t)) fail('В ссылке нет кода подборки — попросите агента прислать её ещё раз.');
  else call('sel_public').then(render, e => fail(e.message));

  // ---------- v5.20: страница агента — собственники подборки ----------
  function AGENT() {
    document.body.classList.add('sa');
    const fail2 = (h, m) => { $('#s-app').innerHTML = `<div class="s-empty"><h1>${esc(h)}</h1><p class="muted">${esc(m)}</p><a class="btn soft" href="./">На сайт</a></div>`; };
    if (typeof tok !== 'string') return fail2('Нужен вход', 'Откройте ссылку там, где вы вошли на сайт «Для Агента», — страница с телефонами собственников видна только вам.');
    if (!selId && !/^[A-Za-z0-9_-]{22,40}$/.test(t)) return fail2('Подборка не найдена', 'В ссылке нет кода подборки — откройте её из «Моих подборок».');
    const KEY = `sa:${selId || t.slice(0, 12)}`, TKEY = 'saText';
    const TPL = 'Здравствуйте, {имя}! Я агент, у меня есть покупатель на ваш объект {адрес}, {цена}. Удобно обсудить?';
    const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
    const done = new Set(get(KEY, []));
    const SV = { tg: 'Telegram', wa: 'WhatsApp', max: 'MAX' };
    let svcs = null, job = null;
    const short = a => String(a ?? '').replace(/^(г\.?\s*о\.?\s*)?Сочи,?\s*/i, '').replace(/мкр-н\s+[^,]+,\s*/i, '').trim();
    const fill = (tx, x) => {
      const name = String(x.owner ?? '').trim().split(/\s+/)[0] || '';
      return tx.replace(/,?\s*\{имя\}/g, name ? (m => m.startsWith(',') ? `, ${name}` : ` ${name}`) : '')
        .replace(/\{адрес\}/g, short(x.address) || x.what).replace(/\{цена\}/g, x.price ? `${money(x.price)} ₽` : '').replace(/\s+([,.!?])/g, '$1').trim();
    };
    const text = () => $('#sa-text')?.value.trim() || TPL;
    const copyTxt = async v => { try { await navigator.clipboard.writeText(v); return true; } catch { return false; } };

    function row(x, i) {
      const d = intl(x.phone), ok = done.has(x.num), st = job?.items?.find(j => j.num === x.num);
      return `<article class="sa-card${ok ? ' sa-done' : ''}" data-num="${x.num}">${gal(x.photos, i)}
        <div class="sa-body">
          <div class="s-head"><h2>${esc(x.what)}</h2><div class="s-price">${x.price ? `${money(x.price)} ₽` : '—'}</div></div>
          ${x.place ? `<p class="muted s-place">${esc(x.place)}</p>` : ''}
          ${x.gone ? '<p class="s-gone">Снято с продажи</p>' : ''}
          <div class="sa-owner"><span>👤 <b>${esc(x.owner || 'Собственник')}</b></span>${d ? `<a class="sa-ph" href="tel:+${d}">+${d.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5')}</a>` : ''}
            ${st ? `<span class="sa-st ${st.ok ? 'ok' : 'bad'}">${st.ok ? `✓ отправлено` : `✗ ${esc(st.error || 'не отправлено')}`}</span>` : ''}</div>
          <div class="sa-btns">${d ? `<a class="btn primary" href="tel:+${d}" data-w>📞 Позвонить</a>
            <a class="btn soft sa-wa" href="https://wa.me/${d}?text=${encodeURIComponent(fill(text(), x))}" target="_blank" rel="noopener" data-w>WhatsApp</a>
            <a class="btn soft sa-tg" href="https://t.me/+${d}" target="_blank" rel="noopener" data-w data-cp>Telegram</a>
            <a class="btn soft sa-max" href="https://web.max.ru/" target="_blank" rel="noopener" data-w data-cp data-cpph>MAX</a>`
            : `<button type="button" class="btn soft" data-open>📞 Открыть телефон</button>`}
            <button type="button" class="btn ghost sa-mark" data-done aria-pressed="${ok}">${ok ? '✓ Написал' : 'Отметить «написал»'}</button></div>
          <small class="muted s-no-num">${i + 1} из ${data.items.length} · № ${x.num}</small>
        </div></article>`;
    }
    function svcHtml() {
      const n = data.items.filter(x => x.phone).length;
      if (!svcs) return '<p class="muted">Проверяю подключённые мессенджеры…</p>';
      if (svcs.error) return `<p class="muted">Отправка всем сразу пока недоступна: ${esc(svcs.error)}</p>
        <a class="btn soft sa-conn" href="hub.html#msg">🔗 Подключить мессенджеры</a>`;
      return `<div class="sa-svcs">${['tg', 'wa', 'max'].map(k => { const s = svcs.svcs.find(v => v.svc === k);
        if (s?.soon) return `<span class="btn ghost" aria-disabled="true" title="MAX не всегда находит человека по номеру — пишите вручную кнопкой «MAX» у собственника">${SV[k]} — вручную</span>`;
        return s?.ok ? `<button type="button" class="btn soft" data-all="${k}"${n && !job?.live ? '' : ' disabled'}>${SV[k]} — всем (${n})</button>`
          : `<a class="btn ghost" href="hub.html#msg" title="Войдите в ${SV[k]} на сервере — один раз">Подключить ${SV[k]}</a>`; }).join('')}</div>
        ${svcs.day_left != null ? `<small class="muted">Сегодня можно отправить ещё ${svcs.day_left}. Сообщения уходят по одному с паузами, чтобы мессенджер не счёл их рассылкой.</small>` : ''}
        ${n < data.items.length ? `<small class="muted">Написать можно только тем, чей телефон открыт (${n} из ${data.items.length}).</small>` : ''}`;
    }
    function jobHtml() {
      if (!job) return '';
      const S = { new: 'в очереди', run: 'идёт отправка', done: 'готово', stopped: 'остановлено', error: 'ошибка' };
      return `<div class="sa-job${job.status === 'done' ? ' ok' : ''}"><b>${SV[job.svc] ?? ''}: ${S[job.status] ?? esc(job.status)}</b>
        · отправлено ${job.sent ?? 0} из ${job.total ?? job.planned ?? 0}${job.failed ? ` · не ушло ${job.failed}` : ''}${job.message ? ` · ${esc(job.message)}` : ''}</div>`;
    }
    function draw() {
      const n = data.items.length, wp = data.items.filter(x => x.phone).length, closed = n - wp;
      $('#s-app').innerHTML = `<header class="s-hero">
          <a class="link sa-back" href="./#sels">← Мои подборки</a>
          <h1>${esc(data.title)}</h1>
          <p class="muted">Собственники подборки · ${n} ${plural(n, 'объект', 'объекта', 'объектов')} · телефон открыт у ${wp} · цены собственника</p>
        </header>
        <section class="sa-box">
          <label class="sa-lbl" for="sa-text">Сообщение собственникам</label>
          <textarea id="sa-text" rows="3" maxlength="600">${esc(get(TKEY, TPL))}</textarea>
          <small class="muted">{имя}, {адрес} и {цена} подставятся у каждого собственника. <button type="button" class="link" data-tpl>Вернуть шаблон</button></small>
          <div class="sa-all"><div class="sa-h">Написать всем сразу — с ваших аккаунтов</div><div id="sa-svc">${svcHtml()}</div><div id="sa-job">${jobHtml()}</div></div>
          ${closed ? `<button type="button" class="btn soft sa-openall" data-open-all>📞 Открыть телефоны (${closed})</button>` : ''}
        </section>
        <div class="sa-list">${data.items.map(row).join('') || '<p class="muted">В подборке нет объектов.</p>'}</div>`;
    }
    const redraw = () => { const y = scrollY, v = $('#sa-text')?.value; draw(); if (v != null) $('#sa-text').value = v; scrollTo(0, y); };

    async function openPhone(x, b) {
      if (b) { b.disabled = true; b.textContent = 'Открываю…'; }
      try { const r = await call('phone', { num: x.num }); if (!r.phone) throw new Error(r.error || 'Номера нет в объявлении'); x.phone = r.phone; x.owner = r.owner ?? r.owner_name ?? x.owner; return true; }
      catch (e) { toast(e.message, 5000); if (b) { b.disabled = false; b.textContent = '📞 Открыть телефон'; } return false; }
    }
    async function poll() {
      if (!job?.id) return;
      try { Object.assign(job, await call('own_job', { _fn: 'auto', id: job.id })); } catch (e) { job.message = e.message; }
      job.live = ['new', 'run'].includes(job.status);
      $('#sa-job').innerHTML = jobHtml();
      if (!job.live) { (job.items ?? []).filter(j => j.ok).forEach(j => done.add(j.num)); put(KEY, [...done]); redraw(); return; }
      setTimeout(poll, 3000);
    }

    document.addEventListener('input', e => { if (e.target.id === 'sa-text') { put(TKEY, e.target.value); clearTimeout(AGENT.t); AGENT.t = setTimeout(() => {
      document.querySelectorAll('.sa-card').forEach(c => { const x = data.items.find(i => i.num === +c.dataset.num), a = c.querySelector('.sa-wa'); if (x && a) a.href = `https://wa.me/${intl(x.phone)}?text=${encodeURIComponent(fill(text(), x))}`; }); }, 400); } });
    document.addEventListener('click', async e => {
      const c = e.target.closest('.sa-card'), x = c && data.items.find(i => i.num === +c.dataset.num);
      if (e.target.closest('[data-tpl]')) { $('#sa-text').value = TPL; put(TKEY, TPL); return; }
      const w = e.target.closest('[data-w]');
      if (w && x) {
        if (w.dataset.cp != null) { const ok = await copyTxt(w.dataset.cpph != null ? `+${intl(x.phone)}\n${fill(text(), x)}` : fill(text(), x));
          toast(ok ? (w.dataset.cpph != null ? 'Номер и текст скопированы — в MAX найдите собственника по номеру и вставьте текст' : 'Текст скопирован — вставьте его в чат') : 'Скопируйте текст из поля сверху', 5000); }
        done.add(x.num); put(KEY, [...done]); setTimeout(redraw, 300); return;
      }
      if (e.target.closest('[data-done]') && x) { done.has(x.num) ? done.delete(x.num) : done.add(x.num); put(KEY, [...done]); return redraw(); }
      if (e.target.closest('[data-open]') && x) { if (await openPhone(x, e.target.closest('[data-open]'))) redraw(); return; }
      const oa = e.target.closest('[data-open-all]');
      if (oa) {
        oa.disabled = true; const list = data.items.filter(i => !i.phone);
        for (let k = 0; k < list.length; k++) { oa.textContent = `Открываю ${k + 1} из ${list.length}…`; if (!(await openPhone(list[k]))) break; }
        return redraw();
      }
      const all = e.target.closest('[data-all]');
      if (all) {
        const svc = all.dataset.all, nums = data.items.filter(i => i.phone).map(i => i.num);
        if (!confirm(`Отправить сообщение ${nums.length} ${plural(nums.length, 'собственнику', 'собственникам', 'собственникам')} через ${SV[svc]} с вашего аккаунта? У каждого подставятся имя, адрес и цена.`)) return;
        all.disabled = true;
        try {
          const r = await call('own_send', { _fn: 'auto', svc, text: text(), nums, ...(selId ? { sel_id: selId } : {}) });
          job = { id: r.id, svc, status: 'new', total: r.planned ?? nums.length, sent: 0, failed: 0, live: true }; $('#sa-job').innerHTML = jobHtml(); setTimeout(poll, 2500);
        } catch (err) { all.disabled = false; toast(err.message, 6000); job = { svc, status: 'error', message: err.message, total: nums.length }; $('#sa-job').innerHTML = jobHtml(); }
      }
    });

    call('sel_agent').then(d => {
      data = d; document.title = `Собственники — ${d.title || 'подборка'}`; draw();
      call('own_init', { _fn: 'auto', ...(selId ? { sel_id: selId } : {}) }).then(r => { svcs = { svcs: r.svcs ?? [], day_left: r.day_left ?? null }; }, e => { svcs = { error: e.message }; })
        .finally(() => { const el = $('#sa-svc'); if (el) el.innerHTML = svcHtml(); });
    }, e => fail2(e.data?.error === 'owner' ? 'Чужая подборка' : 'Подборка недоступна', e.message));
  }
})();

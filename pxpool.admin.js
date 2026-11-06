// «🌐 Прокси сервиса (Россия)» (v5.40, задача Алексея 06.11): админ вставляет список российских прокси пачкой, сервис сам раздаёт их участникам
// и ЗАКРЕПЛЯЕТ на срок (30 дней, потом продлевает тот же). Без ротации: участник переезжает на другой прокси, только если админ отключил/удалил
// его прокси или нажал «Выровнять». Сервер — hub proxy_pool_* (hub/proxy.ts, _shared/pxpool.ts). Пароли сайту не приходят — только маска.
// window.PXPOOL.open(el) — раздел админки «Прокси сервиса» (admin2.js, #pxpool).
window.PXPOOL = (() => {
  const H = () => window.HUB, esc = s => H().esc(s);
  const CC = { RU: 'Россия', BY: 'Беларусь', KZ: 'Казахстан', NL: 'Нидерланды', DE: 'Германия', FI: 'Финляндия', TR: 'Турция', AM: 'Армения' };
  const flag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1A5 + c.charCodeAt(0))) : '';
  const n = v => Number(v || 0).toLocaleString('ru-RU');
  const dm = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit' }) : '';
  let el = null, L = null, filt = 'all', open_ = null, poll = null, last = null;

  async function open(box) {
    el = box; clearTimeout(poll);
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    try { L = await H().call('proxy_pool_list'); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    paint();
    el.onclick = click; el.onchange = change;
  }
  const status = x => !x.active ? ['off', '⏸ выключен'] : x.err && (!x.ok_at || Date.parse(x.fail_at || 0) >= Date.parse(x.ok_at)) ? ['bad', '❌ не отвечает'] : x.ok_at ? ['ok', '✅ отвечает'] : ['wait', '⏳ не проверен'];
  function tiles() {
    const s = L.stats, c = L.cfg, t = (label, v, sub = '', cls = '') => `<div class="adm-tile pp-tile ${cls}"><small>${esc(label)}</small><b>${v}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    return `<div class="adm-tiles pp-tiles">${t('Прокси всего', n(s.total))}${t('Включено', n(s.active))}${t('Отвечают', n(s.ok), s.bad ? `не отвечают: ${n(s.bad)}` : '', s.bad ? 'warn' : '')}
      ${t('Участников', n(s.eligible), 'оплатили или Main')}${t('Закреплено', n(s.assigned))}${t('Без прокси', n(s.without), s.without ? 'нажмите «Распределить всем»' : '', s.without ? 'warn' : '')}
      ${t('Людей на прокси', c.per ? `до ${n(c.per)}` : `авто ${n(c.per_auto)}`, c.per ? 'ручной предел' : `${n(s.eligible)} уч. / ${n(s.active)} прокси`)}</div>`;
  }
  function paint() {
    const c = L.cfg, all = L.all || {};
    el.innerHTML = `<section class="hub-sec pp"><h3>🌐 Прокси сервиса (Россия)</h3>
        <p class="hint pp-lead">Каждый участник получает один постоянный российский адрес на месяц. Адрес не меняется сам по себе — только если вы отключили прокси.
          <span>Например, 200 участников и 50 прокси → по 4 человека на прокси.</span></p>
        ${tiles()}</section>
      <section class="hub-sec pp"><h3>➕ Добавить прокси</h3>
        <label class="field">Вставьте список прокси — по строке<textarea id="pp-text" rows="5" spellcheck="false" autocomplete="off" autocapitalize="off"
          placeholder="45.137.10.12:8000:login:password&#10;login:password@91.200.15.7:3128&#10;socks5://login:password@185.12.40.3:1080"></textarea></label>
        <div class="pp-addrow"><label class="field">Поставщик<input id="pp-prov" list="pp-provs" placeholder="Proxy6" autocomplete="off"></label>
          <label class="field">Страна<select id="pp-cc">${Object.entries(CC).map(([k, v]) => `<option value="${k}"${k === 'RU' ? ' selected' : ''}>${flag(k)} ${esc(v)}</option>`).join('')}</select></label>
          <label class="field">Заметка<input id="pp-note" placeholder="например, «оплачен до 06.12»" maxlength="120" autocomplete="off"></label>
          <button class="btn primary" type="button" data-add>Добавить</button></div>
        <datalist id="pp-provs"><option value="Proxy6"><option value="ProxyLine"><option value="Proxy-Seller"><option value="Другой"></datalist>
        <p class="hint">Понимаю IP:порт:логин:пароль, логин:пароль@IP:порт, http://…, socks5://… Нужны <b>статические</b> IPv4 (один адрес на месяц), не «ротационные». Пароли хранятся зашифрованными, здесь видна только маска.</p>
        <div id="pp-res" aria-live="polite"></div></section>
      <section class="hub-sec pp"><h3>⚙ Как раздавать</h3>
        <div class="pp-cfg"><div class="field">Людей на один прокси<div class="pp-per"><label class="hub-chk"><input type="radio" name="pp-per" value="auto"${c.per ? '' : ' checked'}> авто (сейчас ${n(c.per_auto)})</label>
            <label class="hub-chk"><input type="radio" name="pp-per" value="num"${c.per ? ' checked' : ''}> не больше</label><input id="pp-pern" type="number" min="1" max="50" value="${c.per || Math.max(1, c.per_auto || 4)}"${c.per ? '' : ' disabled'} aria-label="Сколько человек на прокси"></div></div>
          <label class="field">Срок закрепления, дней<input id="pp-days" type="number" min="7" max="90" value="${c.days || 30}"></label></div>
        <div class="field">Какие сервисы идут через эти прокси<div class="pp-svcs">${Object.entries(all).map(([k, v]) => `<label class="pp-sv"><input type="checkbox" value="${esc(k)}"${(c.svcs || []).includes(k) ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></div>
        <p class="hint">По умолчанию — Авито, Циан, ДомКлик и MAX: российские площадки, с зарубежного адреса сервера они не пускают. Свой прокси участника (если он его поставил) главнее.</p>
        <div class="pp-act"><button class="btn primary" type="button" data-cfg>Сохранить</button>
          <button class="btn soft" type="button" data-fill title="Закрепить прокси за всеми, у кого его ещё нет">👥 Распределить всем</button>
          <button class="btn soft" type="button" data-even title="Снять лишних с перегруженных прокси и переложить на свободные">⚖ Выровнять</button>
          <button class="btn soft" type="button" data-test title="Проверить, что прокси отвечают и выходят в нужной стране">🔄 Проверить все</button></div>
        <div id="pp-msg" class="hint" aria-live="polite"></div></section>
      <section class="hub-sec pp" id="pp-list">${list()}</section>`;
  }
  function list() {
    const it = L.items || [], bad = it.filter(x => status(x)[0] === 'bad').length, off = it.filter(x => !x.active).length;
    const sh = it.filter(x => filt === 'bad' ? status(x)[0] === 'bad' : filt === 'off' ? !x.active : filt === 'full' ? x.users >= x.cap : true);
    if (!it.length) return '<h3>Прокси</h3><p class="muted">Прокси пока нет — вставьте список выше.</p>';
    return `<div class="pp-lh"><h3>Прокси (${n(it.length)})</h3><div class="chips">${[['all', 'Все'], ['bad', `Не отвечают (${bad})`], ['off', `Выключены (${off})`], ['full', 'Заполнены']]
        .map(([k, t]) => `<button type="button" class="chip${filt === k ? ' on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
        <button class="btn ghost bad pp-delbad" type="button" data-delbad${bad ? '' : ' hidden'}>🗑 Удалить неотвечающие</button></div>
      <div class="pp-wrap"><table class="pp-t"><thead><tr><th>Адрес</th><th>Поставщик</th><th>Выход</th><th>Участники</th><th>Статус</th><th>Заметка</th><th>Вкл.</th><th></th></tr></thead>
      <tbody>${sh.map(row).join('') || '<tr><td colspan="8" class="muted">Нет прокси под этот отбор.</td></tr>'}</tbody></table></div>`;
  }
  function row(x) {
    const [st, sl] = status(x), pct = x.cap ? Math.min(100, Math.round(x.users / x.cap * 100)) : 0, op = open_ === x.id;
    return `<tr class="pp-r ${st}${op ? ' open' : ''}" data-id="${x.id}">
      <td data-l="Адрес"><b class="pp-mask">${esc(x.mask)}</b> <span class="tag">${esc(x.kind || 'HTTP')}</span></td>
      <td data-l="Поставщик">${esc(x.provider || '—')}</td>
      <td data-l="Выход"><span>${x.exit_ip ? `${flag(x.exit_cc)} ${esc(x.exit_ip)}${x.exit_cc && x.exit_cc !== (x.country || 'RU') ? ` <span class="tag warn" title="Страна выхода не совпадает с заявленной">${esc(x.exit_cc)} ≠ ${esc(x.country || 'RU')}</span>` : ''}` : `<span class="muted">${flag(x.country || 'RU')} ещё не проверен</span>`}</span></td>
      <td data-l="Участники"><div class="pp-load"><span>${n(x.users)} из ${n(x.cap)}</span><i><b style="width:${pct}%"></b></i></div></td>
      <td data-l="Статус"><span><span class="pp-st ${st}">${sl}</span>${st === 'bad' && x.err ? `<small class="pp-err">${esc(x.err)}${x.fail_at ? ` · ${H().when(x.fail_at)}` : ''}</small>` : x.ok_at ? `<small class="muted">${H().when(x.ok_at)}</small>` : ''}</span></td>
      <td data-l="Заметка"><input class="pp-note" data-note="${x.id}" value="${esc(x.note || '')}" maxlength="120" placeholder="—" aria-label="Заметка"></td>
      <td data-l="Вкл."><label class="pp-sw"><input type="checkbox" data-on="${x.id}"${x.active ? ' checked' : ''} aria-label="Включён"><i></i></label></td>
      <td class="pp-btns"><button class="btn ghost sm" type="button" data-who="${x.id}" aria-expanded="${op}">👥 Кто на нём</button><button class="btn ghost sm bad" type="button" data-del="${x.id}" aria-label="Удалить прокси">🗑</button></td></tr>
      ${op ? `<tr class="pp-users"><td colspan="8" id="pp-u${x.id}"><p class="muted">Загрузка…</p></td></tr>` : ''}`;
  }
  async function users(id) {
    const box = el.querySelector(`#pp-u${id}`); if (!box) return;
    let r; try { r = await H().call('proxy_pool_users', { id }); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const others = (L.items || []).filter(x => x.id !== id && x.active);
    box.innerHTML = `${r.users?.length ? `<ul class="pp-ul">${r.users.map(u => `<li><span><b>${esc(u.name || u.login)}</b> <span class="muted">${esc(u.login)}</span></span>
        <span class="muted">с ${dm(u.since)} до <b>${dm(u.until)}</b>${u.manual ? ' · <span class="tag">вручную</span>' : ''}</span>
        <span class="pp-uact"><select data-move="${esc(u.login)}" aria-label="Перенести на другой прокси"><option value="">Перенести на…</option>${others.map(o => `<option value="${o.id}">${esc(o.mask)} (${o.users}/${o.cap})</option>`).join('')}</select>
          <button class="btn ghost sm" type="button" data-unpin="${esc(u.login)}">Снять</button></span></li>`).join('')}</ul>` : '<p class="muted">На этом прокси пока никого.</p>'}
      <form class="pp-pin" data-pin="${id}"><input name="login" placeholder="логин участника" autocomplete="off" spellcheck="false" autocapitalize="off" required><button class="btn soft sm">📌 Закрепить на этом прокси</button></form>
      <p class="hint">Закрепление вручную сервис сам не меняет — пока прокси включён. «Снять» — участник получит прокси заново при следующем запросе.</p>`;
  }
  const msg = (t, bad) => { const m = el.querySelector('#pp-msg'); if (m) { m.className = bad ? 'err' : 'hint'; m.textContent = t; } };
  function relist(l) { if (l) L = l; const k = el.querySelector('#pp-list'); if (k) k.innerHTML = list(); const t = el.querySelector('.pp-tiles'); if (t) t.outerHTML = tiles(); if (open_ != null) users(open_); }
  async function act(btn, action, body, done) {
    if (btn) btn.disabled = true;
    try { const r = await H().call(action, body); done?.(r); if (r.list) relist(r.list); return r; }
    catch (e) { H().toast(e.message, 6000); msg(e.message, true); }
    finally { if (btn) btn.disabled = false; }
  }
  function testPoll() {
    clearTimeout(poll); const t0 = Date.now();
    const tick = async () => {
      if (!el?.isConnected || !el.querySelector('.pp')) return;
      try { relist(await H().call('proxy_pool_list')); } catch { /* следующая попытка */ }
      const left = (L.items || []).filter(x => x.active && (!x.ok_at || Date.parse(x.ok_at) < last) && (!x.fail_at || Date.parse(x.fail_at) < last)).length;
      if (!left) return msg('Проверка закончена.');
      if (Date.now() - t0 > 120e3) return msg(`Ещё не проверено: ${left}. Сервер проверки занят или не на связи — загляните позже.`);
      msg(`Проверяю… осталось ${left}`); poll = setTimeout(tick, 5000);
    };
    poll = setTimeout(tick, 5000);
  }
  async function click(e) {
    const b = e.target.closest('button, [data-f]'); if (!b) return;
    const d = b.dataset;
    if (d.f) { filt = d.f; relist(); return; }
    if ('add' in d) {
      const text = el.querySelector('#pp-text').value.trim(), res = el.querySelector('#pp-res');
      if (!text) { res.innerHTML = '<p class="err">Вставьте хотя бы одну строку прокси.</p>'; return; }
      await act(b, 'proxy_pool_add', { text, provider: el.querySelector('#pp-prov').value.trim() || undefined, country: el.querySelector('#pp-cc').value, note: el.querySelector('#pp-note').value.trim() || undefined }, r => {
        el.querySelector('#pp-text').value = '';
        res.innerHTML = `<div class="pp-res${r.bad?.length ? ' warn' : ' ok'}"><p>✅ Добавлено: <b>${n(r.added)}</b>${r.dup ? ` · уже были (дубли): <b>${n(r.dup)}</b>` : ''}${r.bad?.length ? ` · не понял строк: <b>${n(r.bad.length)}</b>` : ''}</p>
          ${r.bad?.length ? `<ul>${r.bad.slice(0, 30).map(x => `<li>строка ${n(x.n)}: <code>${esc(x.line_mask)}</code> — ${esc(x.why)}</li>`).join('')}${r.bad.length > 30 ? `<li class="muted">…и ещё ${r.bad.length - 30}</li>` : ''}</ul>` : ''}
          ${r.added ? '<p class="muted">Новые прокси получат участники без прокси — нажмите «Распределить всем» и «Проверить все».</p>' : ''}</div>`;
      });
      return;
    }
    if ('cfg' in d) {
      const per = el.querySelector('[name="pp-per"]:checked').value === 'num' ? Math.max(1, +el.querySelector('#pp-pern').value || 1) : 0;
      const svcs = [...el.querySelectorAll('.pp-svcs input:checked')].map(i => i.value);
      if (!svcs.length) { msg('Отметьте хотя бы один сервис.', true); return; }
      await act(b, 'proxy_pool_cfg', { per, days: Math.min(90, Math.max(7, +el.querySelector('#pp-days').value || 30)), svcs }, () => { msg('Сохранено.'); H().toast('Настройки прокси сохранены'); });
      return;
    }
    if ('fill' in d) { await act(b, 'proxy_pool_assign', { mode: 'fill' }, r => msg(`Закреплено новых: ${n(r.assigned)}${r.without ? ` · без прокси осталось: ${n(r.without)} — добавьте прокси или поднимите предел` : ' · без прокси никого'}.`)); return; }
    if ('even' in d) {
      if (!confirm('Выровнять: с перегруженных прокси часть участников переедет на свободные (у них сменится адрес). Продолжить?')) return;
      await act(b, 'proxy_pool_assign', { mode: 'even' }, r => msg(`Переехали: ${n(r.moved)} · закреплено новых: ${n(r.assigned)}${r.without ? ` · без прокси: ${n(r.without)}` : ''}.`)); return;
    }
    if ('test' in d) { last = Date.now() - 2000; await act(b, 'proxy_pool_test', {}, r => { msg(`Проверка запущена: ${n(r.jobs)} прокси. Результат появится в таблице.`); testPoll(); }); return; }
    if (d.who) { const id = +d.who; open_ = open_ === id ? null : id; relist(); return; }
    if (d.del) {
      const x = L.items.find(y => y.id === +d.del);
      if (!confirm(`Удалить прокси ${x?.mask ?? ''}?${x?.users ? ` Его ${x.users} участн. переедут на другие прокси.` : ''}`)) return;
      if (open_ === +d.del) open_ = null;
      await act(b, 'proxy_pool_del', { ids: [+d.del] }, r => msg(r.moved ? `Удалён. Переехали: ${n(r.moved)}.` : 'Удалён.')); return;
    }
    if ('delbad' in d) {
      const ids = L.items.filter(x => status(x)[0] === 'bad').map(x => x.id);
      if (!ids.length || !confirm(`Удалить ${ids.length} неотвечающих прокси? Их участники переедут на другие.`)) return;
      await act(b, 'proxy_pool_del', { ids }, r => msg(`Удалено: ${ids.length}. Переехали: ${n(r.moved)}.`)); return;
    }
    if (d.unpin) { await act(b, 'proxy_pool_pin', { login: d.unpin, id: null }, () => msg(`${d.unpin}: прокси снят.`)); return; }
  }
  async function change(e) {
    const t = e.target, d = t.dataset;
    if (t.name === 'pp-per') { el.querySelector('#pp-pern').disabled = t.value !== 'num'; return; }
    if (d.on) {
      const x = L.items.find(y => y.id === +d.on);
      if (!t.checked && x?.users && !confirm(`Выключить прокси ${x.mask}? Его ${x.users} участн. переедут на другие прокси (у них сменится адрес).`)) { t.checked = true; return; }
      t.disabled = true; await act(null, 'proxy_pool_set', { id: +d.on, active: t.checked }, r => msg(t.checked ? 'Прокси включён.' : `Прокси выключен${r.moved ? `, переехали: ${n(r.moved)}` : ''}.`)); return;
    }
    if (d.note) { await act(null, 'proxy_pool_set', { id: +d.note, note: t.value.trim() }, () => H().toast('Заметка сохранена')); return; }
    if (d.move && t.value) { await act(null, 'proxy_pool_pin', { login: d.move, id: +t.value }, () => msg(`${d.move}: закреплён вручную на другом прокси.`)); return; }
  }
  document.addEventListener('submit', async e => {
    const f = e.target.closest?.('.pp-pin'); if (!f) return;
    e.preventDefault();
    const login = f.login.value.trim(); if (!login) return;
    await act(f.querySelector('button'), 'proxy_pool_pin', { login, id: +f.dataset.pin }, () => msg(`${login}: закреплён вручную.`));
  });
  return { open };
})();

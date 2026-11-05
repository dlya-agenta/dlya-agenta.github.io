// «🌐 Свой прокси» (v5.31b, пункт 6 задачи Алексея 05.11). window.PROXY.open() — окно поверх страницы (пункт меню под «Профилем» ставит вкладка C).
// Один ПОСТОЯННЫЙ адрес на учётку: ваши мессенджеры на нашем сервере открываются с одного и того же адреса — вход не слетает. Без ротации IP.
// Сервер — hub proxy_get | proxy_save | proxy_test → {job} | proxy_job | proxy_del. Пароль прокси сайту не возвращается: после сохранения — только маска адреса.
(() => {
  if (window.PROXY) return;
  const V = '5.31b1', HUB = 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/hub';
  if (!document.querySelector('link[data-proxy]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `proxy.css?v=${V}`; l.dataset.proxy = '1'; document.head.appendChild(l); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  async function hub(action, body = {}) {
    const t = tok();
    if (!t) throw new Error('Войдите на сайт');
    const r = await fetch(HUB, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, auth: { token: t }, ...body }) }).catch(() => null);
    if (!r) throw new Error('Нет связи с сервером — проверьте интернет');
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw Object.assign(new Error(j.message || `Ошибка ${r.status}`), { code: j.error });
    return j;
  }
  // провайдеры статических прокси (исследование 05.11.2026 — цены с сайтов провайдеров и обзоров, проверяйте при покупке)
  const PROV = [
    { id: 'proxy6', name: 'Proxy6', url: 'https://proxy6.net/', price: 'от 120 ₽ / мес', note: 'Российский сервис, цены в рублях. Есть Германия, Нидерланды, Россия. Один адрес — и HTTPS, и SOCKS5.',
      how: ['Зарегистрируйтесь и пополните баланс', 'Купить прокси → «IPv4», страна — см. ниже, срок — 1 месяц, количество — 1', 'Мои прокси → кнопка копирования строки «IP:порт:логин:пароль» → вставьте сюда'] },
    { id: 'proxyline', name: 'ProxyLine', url: 'https://proxyline.net/', price: 'от ~140 ₽ / мес ($1,77)', note: 'Индивидуальные IPv4, HTTP и SOCKS5, от 5 дней. Оплата картой и криптой.',
      how: ['Зарегистрируйтесь, «Купить прокси»', 'Тип — «Индивидуальные IPv4», страна — см. ниже, 30 дней, 1 шт.', 'Мои прокси → «Экспорт» → формат «IP:PORT:USER:PASS» → вставьте строку сюда'] },
    { id: 'proxyseller', name: 'Proxy-Seller', url: 'https://proxy-seller.com/', price: 'от ~$1–2 / мес', note: '40+ стран, логин-пароль, срок от недели. Способ оплаты из России уточните при заказе.',
      how: ['Зарегистрируйтесь, раздел «IPv4»', 'Страна — см. ниже, период — 1 месяц, авторизация — логин и пароль', 'Мои прокси → «Скачать / скопировать» в формате ip:port:login:password → вставьте сюда'] },
    { id: 'other', name: 'Другой', url: '', price: '', note: 'Любой СТАТИЧЕСКИЙ прокси (один постоянный адрес) с логином и паролем.', how: ['Купите статический IPv4 (не «ротационный», не «резидентский с ротацией»)', 'Скопируйте строку подключения и вставьте сюда'] },
  ];
  const SV = { wa: 'WhatsApp', tg: 'Telegram', max: 'MAX', ig: 'Instagram', yt: 'YouTube', vk: 'ВКонтакте' };
  const DEF = ['wa', 'tg', 'ig'];   // закрыты или тормозят из России; MAX и ВКонтакте — российские, через зарубежный прокси им не нужно
  // разбор строки — та же логика, что hub/proxy.ts parseProxy (юнит-тест — hub/selai_test.ts)
  const isHost = s => /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s);
  const isPort = s => /^\d{2,5}$/.test(s) && +s > 0 && +s < 65536;
  const dec = x => { try { return decodeURIComponent(x); } catch { return x; } };
  function parse(raw) {
    let s = String(raw ?? '').trim();
    if (!s || s.length > 400) return null;
    let scheme = 'http';
    const sm = s.match(/^(https?|socks5h?|socks)\s*:\/\//i) || s.match(/^(https?|socks5h?|socks)\s+/i);
    if (sm) { const k = sm[1].toLowerCase(); scheme = k.startsWith('socks') ? 'socks5' : k === 'https' ? 'https' : 'http'; s = s.slice(sm[0].length).trim(); }
    else if (/socks/i.test(s)) scheme = 'socks5';
    const lab = re => (s.match(re)?.[1] ?? '').trim();
    const lh = lab(/(?:ip|хост|host|адрес|сервер)\s*[:=]\s*([^\s,;]+)/i), lp = lab(/(?:порт|port)\s*[:=]\s*(\d{2,5})/i);
    if (lh && lp) {
      const u = lab(/(?:логин|login|user(?:name)?|пользователь)\s*[:=]\s*([^\s,;]+)/i), p = lab(/(?:пароль|password|pass)\s*[:=]\s*([^\s,;]+)/i), h = lh.replace(/:\d+$/, '');
      return isHost(h) && isPort(lp) ? { scheme, host: h, port: +lp, user: u, pass: p } : null;
    }
    s = s.replace(/\/+$/, '');
    if (s.includes('@')) {
      const i = s.lastIndexOf('@'), a = s.slice(0, i), b = s.slice(i + 1);
      const hp = x => { const k = x.lastIndexOf(':'); return k > 0 && isHost(x.slice(0, k)) && isPort(x.slice(k + 1)); };
      const cred = x => { const k = x.indexOf(':'); return k < 0 ? [x, ''] : [x.slice(0, k), x.slice(k + 1)]; };
      if (hp(b)) { const k = b.lastIndexOf(':'), [u, p] = cred(a); return { scheme, host: b.slice(0, k), port: +b.slice(k + 1), user: dec(u), pass: dec(p) }; }
      if (hp(a)) { const k = a.lastIndexOf(':'), [u, p] = cred(b); return { scheme, host: a.slice(0, k), port: +a.slice(k + 1), user: dec(u), pass: dec(p) }; }
      return null;
    }
    const pt = s.split(/[\s:|;,]+/).filter(Boolean);
    if (pt.length === 2 && isHost(pt[0]) && isPort(pt[1])) return { scheme, host: pt[0], port: +pt[1], user: '', pass: '' };
    if (pt.length === 4) {
      if (isHost(pt[0]) && isPort(pt[1])) return { scheme, host: pt[0], port: +pt[1], user: pt[2], pass: pt[3] };
      if (isHost(pt[2]) && isPort(pt[3])) return { scheme, host: pt[2], port: +pt[3], user: pt[0], pass: pt[1] };
    }
    return null;
  }
  const mask = p => { const ip = p.host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/); return `${ip ? `${ip[1]}.${ip[2][0]}**.**.${ip[4]}` : p.host.length > 6 ? `${p.host.slice(0, 3)}***${p.host.slice(p.host.lastIndexOf('.'))}` : '***'}:${p.port}`; };
  const umask = u => !u ? '' : u.length <= 3 ? `${u[0]}**` : `${u.slice(0, 2)}${'*'.repeat(Math.min(6, u.length - 2))}`;

  let ov = null, poll = null;
  const onKey = e => { if (e.key === 'Escape') close(); };
  function close() { clearTimeout(poll); if (!ov) return; const o = ov; ov = null; o.classList.add('px-out'); setTimeout(() => o.remove(), 180); document.documentElement.classList.remove('px-lock'); document.removeEventListener('keydown', onKey); }
  function shell() {
    close();
    ov = document.createElement('div'); ov.className = 'px-ov';
    ov.innerHTML = `<div class="px" role="dialog" aria-modal="true" aria-label="Свой прокси"><div class="px-h"><i class="px-grab" aria-hidden="true"></i>
      <div class="px-ht"><b>🌐 Свой прокси</b><small>один постоянный адрес для ваших мессенджеров</small></div><button class="px-x" type="button" aria-label="Закрыть">✕</button></div><div class="px-b"></div></div>`;
    document.body.appendChild(ov); document.documentElement.classList.add('px-lock');
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('.px-x').onclick = close; document.addEventListener('keydown', onKey);
    const h = ov.querySelector('.px-h'), box = ov.querySelector('.px'); let y0 = null;
    h.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    h.addEventListener('touchmove', e => { if (y0 != null) box.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)`; }, { passive: true });
    h.addEventListener('touchend', e => { const d = (e.changedTouches[0]?.clientY ?? y0) - y0; box.style.transform = ''; y0 = null; if (d > 90) close(); });
    return ov.querySelector('.px-b');
  }
  const WHY = `<details class="px-why"><summary>Зачем это и как работает</summary><p>Ваши WhatsApp, Telegram и другие мессенджеры подключены к нашему серверу (рассылки, «Написать всем»).
    Если сервер выходит в интернет с общего адреса, площадка может попросить войти заново. Свой прокси — это ваш постоянный адрес: мессенджеры всегда видят один и тот же «компьютер», и вход не слетает.</p>
    <p>Нужен <b>статический</b> прокси — один адрес на месяц. Ротационные и «меняющие IP» не подходят и не нужны. Если прокси перестанет работать, сервис временно пойдёт через общий адрес и пришлёт вам сообщение в бот.</p></details>`;
  const COUNTRY = `<div class="px-tip"><b>Какую страну брать:</b> WhatsApp, Instagram, Telegram — <b>Германия</b> или <b>Нидерланды</b> (из России они закрыты или тормозят).
    MAX и ВКонтакте — российские, через прокси их пускать не нужно (галочку не ставьте). Тип — <b>IPv4</b>, протокол — HTTP(S) или SOCKS5, срок — 1 месяц, 1 адрес.</div>`;

  async function open() {
    const b = shell();
    b.innerHTML = '<p class="px-mut px-pad">Загрузка…</p>';
    try { view(b, await hub('proxy_get')); } catch (e) { b.innerHTML = `<p class="px-err px-pad">⚠️ ${esc(e.message)}</p>`; }
  }
  function view(b, s) {
    if (s.set) return saved(b, s);
    form(b, s, null);
  }
  const resHtml = (res, wait) => {
    if (!res) return `<div class="px-res wait"><span class="px-spin" aria-hidden="true"></span> ${esc(wait || 'Проверяем через ваш прокси…')}</div>`;
    if (res.error && !res.svcs) return `<div class="px-res bad">❌ ${esc(res.error)}</div>`;
    const lines = Object.entries(res.svcs || {}).map(([k, v]) => `<li class="${v.ok ? 'ok' : 'bad'}">${v.ok ? '✅' : '❌'} <b>${esc(SV[k] || k)}</b> ${esc(v.ok ? 'открывается' : res.error && res.error.startsWith(v.msg || '-') ? 'не открылся' : v.msg || 'не открылся')}</li>`).join('');
    return `<div class="px-res ${res.ok ? 'ok' : 'bad'}">${res.ip ? `<p>Адрес выхода: <b>${esc(res.ip)}</b>${res.country ? ` · ${esc(res.country)}` : ''}</p>` : ''}${res.error ? `<p>❌ ${esc(res.error)}</p>` : ''}<ul>${lines}</ul></div>`;
  };
  function saved(b, s) {
    const p = PROV.find(x => x.id === s.provider);
    b.innerHTML = `<div class="px-on"><div class="px-on-h"><span class="px-dot ${s.err ? 'bad' : s.ok_at ? 'ok' : ''}"></span><div><b>Прокси ${s.err ? 'с ошибкой' : s.ok_at ? 'работает' : 'сохранён'}</b>
        <small>${esc(s.host_mask)} · ${esc(s.kind || 'HTTP')}${p && p.id !== 'other' ? ` · ${esc(p.name)}` : ''}</small></div></div>
      <p class="px-mut">Через прокси: ${(s.svcs || []).map(k => `<span class="px-chip">${esc(SV[k] || k)}</span>`).join(' ')}</p>
      ${s.err && !s.test?.res ? `<p class="px-err">❌ ${esc(s.err)}</p>` : ''}${s.ok_at ? `<p class="px-mut">Проверен ${esc(new Date(s.ok_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}</p>` : ''}
      <div class="px-test">${s.test && (s.test.res || !s.test.done) ? resHtml(s.test.res, s.test.done ? '' : 'Проверка ждёт сервер…') : ''}</div>
      <div class="px-row"><button class="px-btn pri" type="button" data-test>🔄 Проверить</button><button class="px-btn" type="button" data-edit>✏️ Заменить</button>
        <button class="px-btn danger" type="button" data-del>🗑 Удалить прокси</button></div>
      <p class="px-mut px-sm">Пароль хранится зашифрованным и сайту не показывается.</p></div>${WHY}`;
    b.querySelector('[data-test]').onclick = () => test(b);
    b.querySelector('[data-edit]').onclick = () => form(b, s, s.provider);
    b.querySelector('[data-del]').onclick = async e => {
      if (!confirm('Удалить свой прокси? Мессенджеры пойдут через общий адрес сервиса.')) return;
      e.target.disabled = true;
      try { view(b, await hub('proxy_del')); } catch (er) { alert(er.message); e.target.disabled = false; }
    };
    if (s.test && !s.test.done) wait(b, s.test.job);
  }
  function form(b, s, prov) {
    let pick = prov || null;
    const svcs = new Set(s?.svcs?.length ? s.svcs : DEF);
    b.innerHTML = `<div class="px-steps">
      <section><h3><i>1</i> Где купить прокси</h3><div class="px-prov">${PROV.map(p => `<button type="button" class="px-pc${pick === p.id ? ' on' : ''}" data-p="${p.id}">
        <b>${esc(p.name)}</b>${p.price ? `<span class="px-price">${esc(p.price)}</span>` : ''}<small>${esc(p.note)}</small></button>`).join('')}</div>
        <div class="px-how"></div>${COUNTRY}</section>
      <section><h3><i>2</i> Вставьте строку прокси</h3>
        <textarea class="px-in" rows="2" placeholder="Например: 45.137.10.12:8000:login:password" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>
        <div class="px-parse px-mut">Понимаю форматы IP:порт:логин:пароль, логин:пароль@IP:порт, socks5://…, http://… и «IP: … Порт: … Логин: … Пароль: …»</div></section>
      <section><h3><i>3</i> Что пустить через прокси</h3><div class="px-svcs">${Object.entries(SV).map(([k, n]) => `<label class="px-cb"><input type="checkbox" value="${k}"${svcs.has(k) ? ' checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div>
        <p class="px-mut px-sm">По умолчанию — WhatsApp, Telegram и Instagram: из России они закрыты или тормозят.</p></section>
      <div class="px-row"><button class="px-btn pri" type="button" data-save disabled>Сохранить и проверить</button>${s?.set ? '<button class="px-btn" type="button" data-back>Отмена</button>' : ''}</div>
      <p class="px-err" data-e hidden></p></div>${WHY}`;
    const how = b.querySelector('.px-how'), inp = b.querySelector('.px-in'), out = b.querySelector('.px-parse'), save = b.querySelector('[data-save]'), er = b.querySelector('[data-e]');
    const showHow = () => { const p = PROV.find(x => x.id === pick); how.innerHTML = p ? `<ol>${p.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${p.url ? `<a class="px-btn" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Открыть ${esc(p.name)} ↗</a>` : ''}` : ''; };
    b.querySelectorAll('.px-pc').forEach(x => x.onclick = () => { pick = x.dataset.p; b.querySelectorAll('.px-pc').forEach(y => y.classList.toggle('on', y === x)); showHow(); });
    showHow();
    const chk = () => {
      const p = parse(inp.value), any = b.querySelectorAll('.px-svcs input:checked').length;
      if (!inp.value.trim()) { out.className = 'px-parse px-mut'; out.textContent = 'Понимаю форматы IP:порт:логин:пароль, логин:пароль@IP:порт, socks5://…, http://… и «IP: … Порт: … Логин: … Пароль: …»'; }
      else if (!p) { out.className = 'px-parse bad'; out.textContent = 'Не понял строку. Скопируйте её из личного кабинета провайдера целиком: IP:порт:логин:пароль'; }
      else { out.className = 'px-parse ok'; out.innerHTML = `✓ Адрес <b>${esc(mask(p))}</b> · Логин <b>${esc(umask(p.user) || 'без логина')}</b> · Тип <b>${p.scheme === 'socks5' ? 'SOCKS5' : 'HTTP'}</b>`; }
      save.disabled = !p || !any;
    };
    inp.oninput = chk; b.querySelectorAll('.px-svcs input').forEach(i => i.onchange = chk);
    b.querySelector('[data-back]')?.addEventListener('click', () => saved(b, s));
    save.onclick = async () => {
      const p = parse(inp.value); if (!p) return;
      save.disabled = true; save.textContent = 'Сохраняю…'; er.hidden = true;
      try {
        await hub('proxy_save', { provider: pick || 'other', url: inp.value.trim(), svcs: [...b.querySelectorAll('.px-svcs input:checked')].map(i => i.value) });
        inp.value = '';
        const s2 = await hub('proxy_get'); saved(b, s2); test(b);
      } catch (e) { er.hidden = false; er.textContent = `❌ ${e.message}`; save.disabled = false; save.textContent = 'Сохранить и проверить'; }
    };
  }
  async function test(b) {
    const box = b.querySelector('.px-test'), btn = b.querySelector('[data-test]');
    if (btn) btn.disabled = true;
    if (box) box.innerHTML = resHtml(null);
    try { const r = await hub('proxy_test'); wait(b, r.job, r.server); }
    catch (e) { if (box) box.innerHTML = `<div class="px-res bad">❌ ${esc(e.message)}</div>`; if (btn) btn.disabled = false; }
  }
  function wait(b, job, server = true) {
    const t0 = Date.now();
    const tick = async () => {
      if (!ov || !b.isConnected) return;
      const box = b.querySelector('.px-test');
      try {
        const r = await hub('proxy_job', { job });
        if (r.done) { const s = await hub('proxy_get'); saved(b, s); const bx = b.querySelector('.px-test'); if (bx) bx.innerHTML = resHtml(r.res); return; }
        const sec = Math.round((Date.now() - t0) / 1000);
        if (box) box.innerHTML = resHtml(null, !r.server ? 'Сервер проверки сейчас не на связи — проверка пройдёт, как только он включится. Можно закрыть окно: результат появится здесь.'
          : r.taken ? `Открываю WhatsApp, Telegram и MAX через ваш прокси… ${sec} с` : `Проверка в очереди… ${sec} с`);
        if (Date.now() - t0 > 150e3) { if (box) box.insertAdjacentHTML('beforeend', '<p class="px-mut px-sm">Дольше обычного — загляните сюда позже.</p>'); const btn = b.querySelector('[data-test]'); if (btn) btn.disabled = false; return; }
      } catch (e) { if (box) box.innerHTML = `<div class="px-res bad">❌ ${esc(e.message)}</div>`; return; }
      poll = setTimeout(tick, 3000);
    };
    clearTimeout(poll); poll = setTimeout(tick, server ? 2500 : 500);
  }
  window.PROXY = { v: V, open, close, parse, mask };
  if (location.hash === '#proxy') setTimeout(() => tok() && open(), 600);   // ссылка из сообщения бота «Прокси не отвечает»
})();

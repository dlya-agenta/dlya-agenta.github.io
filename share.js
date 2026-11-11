// Подборка ссылкой (ТЗ v2, шаг 3.2): выбор «PDF / Ссылка / Оба» в окне подборки, готовая ссылка (копировать, отправить, открыть).
// v5.23: ссылкой — до 20 объектов, PDF и «Оба» — до 10; PDF агенту больше нет — вместо него «🔗 Ссылка агенту» (s.html#<токен>&a=1:
// собственники, переписка, актуальность). «Мои подборки» — раздел на главной (./#sels=all | own | fb), разметка — page() ниже, стили — sels.css.
window.SHARE = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—';
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
  const MAX = { link: 20, pdf: 10, both: 10 };
  const FMT = [['pdf', 'PDF'], ['link', 'Ссылка'], ['both', 'Оба']];
  const AGENT = 'Для вас — <b>ссылка агенту</b>: собственники и их телефоны (по тарифу), «Написать всем», переписка и кто ответил «актуально»; из ответивших — проверенная подборка.';
  const HINT = {
    pdf: `<b>PDF клиенту</b> — без контактов собственника, цены с вашей комиссией, хранится 7 дней. ${AGENT}`,
    link: `<b>Ссылка клиенту</b>: цены с вашей комиссией, без телефонов собственников. Клиент ставит ✓ «подходит» или ✗ «не подходит» и пишет комментарий — вам придёт сообщение. Ссылка действует 30 дней, её можно продлить. ${AGENT}`,
    both: `PDF и ссылка для клиента (до 10 объектов). ${AGENT}`,
  };
  // v5.25b: подборка эксклюзивов — то же, но на ссылке агенту не собственники, а агенты-коллеги, разместившие объекты
  const AGENTX = 'Для вас — <b>ссылка агенту</b>: агенты, разместившие эксклюзивы, их контакты и комиссия (по подписке), «Написать всем» агентам через мессенджеры.';
  const HINTX = Object.fromEntries(Object.entries(HINT).map(([k, v]) => [k, v.replace(AGENT, AGENTX).replace('без контактов собственника', 'без контактов агентов').replace('без телефонов собственников', 'без контактов агентов')]));
  const hintOf = (k, v) => (k === 'excl' ? HINTX : HINT)[v] ?? (k === 'excl' ? HINTX : HINT).both;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const obj = n => `${n} ${plural(n, 'объект', 'объекта', 'объектов')}`;

  // n — сколько объектов выбрано: больше 10 — PDF и «Оба» недоступны (с подсказкой), выбран формат «Ссылка»
  const formatHtml = (n = 0, kind = 'own') => {
    let v = get('selFmt', 'both');
    if (n > MAX[v]) v = 'link';
    return `<div class="field"><span>Как отправить клиенту</span><div class="chips fmt" id="s-fmt" role="radiogroup" data-kind="${kind}">${FMT.map(([k, t]) => { const off = n > MAX[k];
      return `<label class="chip${v === k ? ' on' : ''}${off ? ' dis' : ''}"${off ? ` title="В PDF до ${MAX.pdf} объектов"` : ''}><input type="radio" name="s-fmt" value="${k}"${v === k ? ' checked' : ''}${off ? ' disabled' : ''}> ${t}</label>`; }).join('')}</div></div>
      ${n > MAX.pdf ? `<div class="hint warn-hint">Выбрано ${obj(n)}: ссылкой можно до ${MAX.link}, в PDF — до ${MAX.pdf}. Для PDF уберите ${obj(n - MAX.pdf)}.</div>` : ''}
      <div class="hint" id="s-fmt-hint">${hintOf(kind, v)}</div>`;
  };
  const format = () => document.querySelector('[name="s-fmt"]:checked')?.value ?? 'both';
  // переключение: подсказка и поля только для PDF
  function mount() {
    const box = $('#s-fmt');
    if (!box) return;
    const sync = save => {
      const v = format();
      box.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
      $('#s-fmt-hint').innerHTML = hintOf(box.dataset.kind, v);
      document.querySelectorAll('.pdf-only').forEach(x => x.hidden = v === 'link');
      if (save) put('selFmt', v);   // выбор человека; «Ссылка» при 11+ объектах — не запоминаем
    };
    box.onchange = () => sync(true); sync(false);
  }

  // ссылка: копировать (с запасным способом), отправить (меню «Поделиться» телефона), открыть
  async function copy(t, toast, what = 'Ссылка скопирована') {
    try { await navigator.clipboard.writeText(t); toast?.(what); }
    catch { const i = document.createElement('textarea'); i.value = t; document.body.append(i); i.select(); document.execCommand?.('copy'); i.remove(); toast?.(what); }
  }
  // готовая подборка: ссылка клиенту и (v5.23) ссылка агенту вместо PDF агенту
  // ссылка агенту — относительная (s.html#… на том же адресе сайта, где агент вошёл) и в Telegram-приложении — в том же окне: во внешнем браузере входа нет
  const rel = u => String(u ?? '').replace(/^https?:\/\/[^#]*?s\.html#/, 's.html#');
  const ablank = () => window.Telegram?.WebApp?.initData ? '' : ' target="_blank" rel="noopener"';
  const agentBtn = (r, kind) => r.agent_link ? `<div class="share-agent agent-only"><a class="btn soft" href="${esc(rel(r.agent_link))}"${ablank()}>🔗 Ссылка агенту</a>
      <span class="hint">${kind === 'excl' ? 'агенты эксклюзивов, их контакты и «Написать всем»' : 'собственники, переписка, актуальность'} — только для вас, клиенту не отправляйте${r.phones != null && r.total ? ` · телефоны открыты: ${r.phones} из ${r.total}` : ''}</span></div>` : '';
  const resultHtml = (r, kind = 'own') => (r.link ? `<div class="share-box"><label class="field">Ссылка для клиента<input id="s-link" readonly value="${esc(r.link)}"></label>
      <div class="sheet-foot"><button class="btn primary" data-copy="${esc(r.link)}">Скопировать ссылку</button>${navigator.share ? `<button class="btn soft" data-share="${esc(r.link)}">Поделиться</button>` : ''}
        <a class="btn ghost" href="${esc(r.link)}" target="_blank" rel="noopener" data-url="${esc(r.link)}">Открыть</a></div>
      <p class="hint">${r.query ? `${esc(r.query)} · ` : ''}действует до ${day(r.until)}. Когда клиент откроет подборку или отметит объекты, вам придёт уведомление: в Telegram (привяжите его в профиле), в браузер и на сайте.</p></div>` : '') + agentBtn(r, kind);
  function bind(el, toast) {   // окно (#sheet-body) одно на всю страницу — обработчик вешается один раз
    if (el.dataset.shareOn) return;   // не data-share: иначе любой клик в окне ловился как «Поделиться»
    el.dataset.shareOn = 1;
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]'), s = e.target.closest('[data-share]');
      if (c) copy(c.dataset.copy, toast);
      if (s) navigator.share({ title: 'Подборка объектов', url: s.dataset.share }).catch(() => {});
    });
  }

  // ---------- «Мои подборки» — раздел на главной ----------
  const TABS = [['all', 'Все подборки', 'Все'], ['own', 'Ответы собственников', 'Собственники'], ['fb', 'Отклики клиентов', 'Клиенты'], ['ex', 'Подборки эксклюзивов', 'Эксклюзивы'], ['pick', 'Самоподбор', 'Самоподбор']];   // v5.48 H9: ссылки «Самоподбор»
  const isEx = s => s.kind === 'excl', isPk = s => s.kind === 'pick';   // v5.25b: подборки эксклюзивов — своя вкладка «Подборки эксклюзивов» (в «Все» не входят)
  const agentLink = s => rel(s.agent_link || (s.link ? `${s.link}&a=1` : `s.html#id=${s.id}&a=1`));
  let css = false;
  const style = () => { if (css) return; css = true; document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="sels.css?v=5.54">'); };
  // сводка ответов собственников по подборке: marks — { [num]: { st, at, text } } из auto own_marks (вкладка A)
  function ownSum(s, marks) {
    const m = (s.nums ?? []).map(n => marks?.[n]).filter(Boolean);
    if (!m.length) return null;
    const c = k => m.filter(x => k.includes(x.st)).length;
    return { sent: m.length, total: s.nums.length, yes: c(['yes']), no: c(['no', 'sold']), none: c(['none']), wait: c(['wait']), answered: c(['yes', 'no', 'sold']), unseen: m.some(x => x.unseen) };
  }
  const ownLine = o => `${o.unseen ? '<span class="sp-b">новые ответы</span> ' : ''}Собственники: ответили ${o.answered} из ${o.sent}${o.yes ? ` · <b class="ok">актуально ${o.yes}</b>` : ''}${o.no ? ` · <b class="bad">не актуально ${o.no}</b>` : ''}${o.wait ? ` · ждём ${o.wait}` : ''}${o.none ? ` · молчат ${o.none}` : ''}`;
  const fbLine = s => s.link ? [`👁 ${s.views ? `клиент открыл ${s.views} ${plural(s.views, 'раз', 'раза', 'раз')}` : 'клиент ещё не открывал'}`, s.yes && `<b class="ok">✓ ${s.yes}</b>`, s.no && `<b class="bad">✗ ${s.no}</b>`,
    s.comments && `💬 ${s.comments}`].filter(Boolean).join(' · ') : '';
  const linkBadge = s => s.link ? (s.live ? `<span class="sp-b">🔗 ссылка до ${day(s.link_until)}</span>` : '<span class="sp-b off">ссылка закончилась</span>')
    : s.url ? `<span class="sp-b">PDF до ${day(s.pdf_until)}</span>` : '<span class="sp-b off">PDF удалён</span>';
  const meta = s => [when(s.created_at), obj(s.nums.length), document.body.classList.contains('client') ? '' : s.markup ? `+${s.markup}% клиенту` : isEx(s) ? 'цены агентов' : 'цены собственника', s.query && esc(s.query)].filter(Boolean).join(' · ');
  // v5.52 (п. 1 Алексея 11.11): карточка в одном порядке во всех вкладках — заголовок со сроком, одна строка «о чём», цифры значками,
  // три главные кнопки (Ссылка клиенту + 📋, Ссылка агенту, ⋯), всё редкое — в «⋯ Ещё» (Править, Продлить, PDF, В подборку, реклама, ролик, удалить);
  // отклики — нижней строкой: «Отклики (N) ▾» слева, «✉️ Собственникам · N» и «🤖 ИИ» справа маленькими кнопками.
  const btnLink = s => s.link && s.live ? `<span class="sp-pair"><a class="btn primary" href="${esc(s.link)}" target="_blank" rel="noopener" data-url="${esc(s.link)}" title="Страница, которую видит клиент"><span class="sp-lw">Ссылка к</span><span class="sp-ln">К</span>лиенту</a><button class="btn primary sp-ic" data-copy="${esc(s.link)}" title="Скопировать ссылку клиенту" aria-label="Скопировать ссылку клиенту">⧉</button></span>` : '';
  const btnAgent = s => `<a class="btn soft" href="${esc(agentLink(s))}"${ablank()} title="${isEx(s) ? 'Агенты эксклюзивов, их контакты, «Написать всем» — только для вас' : 'Собственники, «Написать всем», переписка, кто ответил — только для вас'}"><span class="sp-lw">Ссылка а</span><span class="sp-ln">А</span>генту</a>`;
  const kidBtn = s => s.kid ? `<a class="btn soft ok" href="${esc(s.kid.link || rel(`s.html#id=${s.kid.id}&a=1`))}" target="_blank" rel="noopener" title="${esc(s.kid.title || '')}">✓ Проверенная</a>` : '';
  const menu = (items, title) => { const L = items.filter(Boolean).join(''); return L ? `<details class="sp-dots"><summary class="btn ghost" title="${title}" aria-label="Ещё действия">⋯</summary><div class="sp-menu">${L}</div></details>` : ''; };
  const more = (s, edit = true) => menu([
    edit && !isEx(s) && `<button class="btn ghost agent-only" data-edit-selection="${s.id}">✎ Править подборку</button>`,
    s.link && `<button class="btn ghost" data-extend="${s.id}" title="Ссылка клиенту будет действовать ещё 30 дней">⏱ Продлить на 30 дней</button>`,
    s.link && s.live && navigator.share && `<button class="btn ghost" data-share="${esc(s.link)}">↗ Поделиться</button>`,
    s.url && `<a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener" data-url="${esc(s.url)}">📄 PDF клиенту</a>`,
    ...(isEx(s) ? [`<a class="btn ghost" href="excl.html#sel=${s.nums.join(',')}">💎 В подборку</a>`] : [
      s.url_agent && `<a class="btn ghost" href="${esc(s.url_agent)}" target="_blank" rel="noopener" data-url="${esc(s.url_agent)}" title="Старый PDF агенту — хранится 7 дней, новые не делаются">📄 PDF агенту</a>`,
      `<button class="btn ghost" data-again="${s.nums.join(',')}">＋ Объекты в новую подборку</button>`,
      `<button class="btn ghost" data-rk="${s.nums.join(',')}">📣 В рекламу</button>`,
      `<button class="btn ghost" data-video="${s.nums.slice(0, 10).join(',')}">🎬 Ролик</button>`]),
    `<button class="btn ghost sp-del" data-del="${s.id}">🗑 Удалить подборку</button>`], 'Править, продлить, PDF, в подборку, реклама, ролик, удалить');
  const clFb = s => (s.fb ?? []).filter(f => f.mark === 'yes' || (f.comment && f.mark !== 'no'));
  const tok = s => esc(s.token ?? (s.link ? String(s.link).split('#')[1] : ''));
  const clBtns = s => { const n = new Set(clFb(s).map(f => f.num)).size, any = (s.fb ?? []).length;
    return isEx(s) || !any ? '' : `${n ? `<a class="btn soft sp-sm" href="${esc(agentLink(s))}&f=cl"${ablank()} title="Написать собственникам по объектам, которые клиент отметил «подходит» или о которых спросил">✉️ Собственникам · ${n}</a>` : ''}<button class="btn soft sp-sm" data-selai="${s.id}" data-t="${tok(s)}" title="Помощник ИИ: что понял по откликам, текст клиенту">🤖 ИИ</button>`; };
  const opened = () => new Set(get('spOpen', []));
  const fbRows = s => (s.fb ?? []).map(f => `<li><span class="sp-n">№ ${f.num}</span>${f.mark === 'yes' ? '<b class="ok">✓ подходит</b>' : f.mark === 'no' ? '<b class="bad">✗ не подходит</b>' : '<b>💬</b>'}<span>${esc(f.what)}</span>${f.comment ? `<span class="muted">«${esc(f.comment)}»</span>` : ''}<small class="muted">${when(f.at)}</small></li>`).join('');
  const ST = { yes: ['ok', '✓ актуально'], no: ['bad', '✗ не актуально'], sold: ['bad', '✗ продано'], none: ['', '✗ не ответил'], wait: ['', '⏳ ждём'] };
  const ownRows = (s, marks) => s.nums.map(n => marks?.[n] && { n, m: marks[n] }).filter(Boolean).map(({ n, m }) => `<li><span class="sp-n">№ ${n}</span><b class="${ST[m.st]?.[0] ?? ''}">${ST[m.st]?.[1] ?? esc(m.st)}</b>${m.text ? `<span class="muted">«${esc(String(m.text).slice(0, 120))}»</span>` : ''}${m.unseen ? '<span class="sp-b">новый ответ</span>' : ''}${m.at ? `<small class="muted">${m.st === 'wait' || m.st === 'none' ? 'написали ' : ''}${when(m.at)}</small>` : ''}${m.err ? `<small class="muted">${esc(m.err)}</small>` : m.st === 'wait' && m.next ? `<small class="muted">проверю ${when(m.next)}</small>` : ''}</li>`).join('');
  // нижняя строка: «Отклики (N) ▾» + кнопки справа; раскрытое — под ней (key своё у вкладки: all:12 / fb:12)
  const foot = (key, label, n, body, right = '') => { const on = n && body && opened().has(key);
    if (!(n && body) && !right) return '';
    return `<div class="sp-foot">${n && body ? `<button type="button" class="link sp-tg" data-sptg="${key}" aria-expanded="${!!on}">${label} (${n}) <span aria-hidden="true">${on ? '▴' : '▾'}</span></button>` : '<span></span>'}${right ? `<span class="sp-fr">${right}</span>` : ''}</div>${n && body ? `<div class="sp-det"${on ? '' : ' hidden'}>${body}</div>` : ''}`; };
  const kpi = L => { const x = L.filter(Boolean); return x.length ? `<div class="sp-kpi">${x.join('')}</div>` : ''; };
  const k = (cls, t, title = '') => `<span class="sp-k${cls ? ` ${cls}` : ''}"${title ? ` title="${esc(title)}"` : ''}>${t}</span>`;
  const fbKpi = s => s.link ? [k('', `👁 ${s.views || 0}`, s.views ? `Клиент открыл ${s.views} ${plural(s.views, 'раз', 'раза', 'раз')}` : 'Клиент ещё не открывал'),
    s.yes && k('ok', `✓ ${s.yes}`, 'Подходит'), s.no && k('bad', `✗ ${s.no}`, 'Не подходит'), s.comments && k('', `💬 ${s.comments}`, 'Комментарии клиента')] : [];
  const ownKpi = o => o ? [k(o.unseen ? 'new' : '', `Собственники ${o.answered}/${o.sent}`, `Ответили ${o.answered} из ${o.sent}${o.yes ? `, актуально ${o.yes}` : ''}${o.no ? `, не актуально ${o.no}` : ''}${o.wait ? `, ждём ${o.wait}` : ''}${o.none ? `, молчат ${o.none}` : ''}`),
    o.yes && k('ok', `актуально ${o.yes}`), o.no && k('bad', `не актуально ${o.no}`), o.unseen && k('new', 'новые ответы')] : [];
  const head = s => `<div class="sp-top"><b class="sp-t">${esc(s.title)}</b>${isEx(s) ? '<span class="sp-b ex">💎 эксклюзивы</span>' : ''}${s.checked ? '<span class="sp-b ok" title="Собрана со страницы агента из объектов, где собственник ответил «актуально»">✓ проверенная</span>' : ''}${linkBadge(s)}</div>
    <div class="sp-meta muted">${meta(s)}</div>
    ${s.from ? `<div class="sp-rel muted">Собрана из подборки ${s.from.title ? `«${esc(s.from.title)}»` : `№ ${s.from.id}`}</div>` : ''}`;
  function cardAll(s, marks) {
    const o = ownSum(s, marks), rows = fbRows(s), orows = o ? ownRows(s, marks) : '';
    const det = `${rows ? `<div class="sp-sub">Отклики клиента</div><ul class="sp-rows">${rows}</ul>` : ''}${orows ? `<div class="sp-sub">Ответы собственников</div><ul class="sp-rows">${orows}</ul>` : ''}`;
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}${kpi([...fbKpi(s), ...ownKpi(o)])}
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${kidBtn(s)}${more(s)}</div>${foot(`all:${s.id}`, 'Отклики', (s.fb ?? []).length + (o?.sent ?? 0), det, clBtns(s))}</article>`;
  }
  function cardOwn(s, marks) {
    const o = ownSum(s, marks);
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}${kpi(ownKpi(o))}
      <div class="sp-acts"><a class="btn primary" href="${esc(agentLink(s))}"${ablank()}>Открыть ссылку агента</a>${kidBtn(s)}${more(s)}</div>${foot(`own:${s.id}`, 'Ответы', o.sent, `<ul class="sp-rows">${ownRows(s, marks)}</ul>`)}</article>`;
  }
  function cardFb(s) {
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}${kpi(fbKpi(s))}
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${more(s)}</div>${foot(`fb:${s.id}`, 'Отклики', (s.fb ?? []).length, `<ul class="sp-rows">${fbRows(s)}</ul>`, clBtns(s))}</article>`;
  }
  // v5.48 H9: ссылка «Самоподбор» — срок, сколько открывали, что выбрал, вопросы без ответа; страница ссылки (…&a=1) — всё остальное
  const pkMsg = s => window.PICK ? window.PICK.sendText(s.link_until, s.link) : s.link;
  function cardPick(s, tag) {
    const st = s.live ? `<span class="sp-b">до ${when(s.link_until)}</span>` : `<span class="sp-b off">${s.closed_reason ? 'закрыта автоматически' : 'закрыта'}</span>`;
    return `<article class="sp-card sp-pick" data-sid="${s.id}"><div class="sp-top"><b class="sp-t">${esc(s.title)}</b>${tag ? '<span class="sp-b ex">🎯 Самоподбор</span>' : ''}${st}</div>
      <div class="sp-meta muted">${[when(s.created_at), s.markup ? `+${s.markup}% клиенту` : 'цены собственника', s.query && esc(s.query)].filter(Boolean).join(' · ')}</div>
      ${s.client ? `<div class="sp-rel">Клиент: <a href="./#client=${+s.client.id}" data-client-open="${+s.client.id}">${esc(s.client.name)}</a></div>` : ''}
      ${kpi([k('', `👁 ${s.views || 0}`, s.views ? `Открывали ${s.views} ${plural(s.views, 'раз', 'раза', 'раз')}` : 'Клиент ещё не открывал'), k('', `📱 ${s.devices ?? 0}/2`, 'Устройств клиента из 2 разрешённых'),
        s.chosen ? k('ok', `⭐ выбрал ${s.chosen}`) : k('', 'пока ничего не выбрал'), s.open_q && k('bad', `❓ без ответа ${s.open_q}`, 'Вопросы клиента без ответа')])}
      <div class="sp-acts"><a class="btn primary" href="${esc(agentLink(s))}"${ablank()} title="Что выбрал клиент, вопросы, ответы собственников, продление">Открыть</a>
        ${s.live && s.link ? `<button class="btn soft" data-pk-copy="${esc(pkMsg(s))}" title="Текст со ссылкой для клиента">Скопировать</button>` : ''}
        ${s.chosen || s.open_q || (s.fb ?? []).length ? `<button class="btn soft" data-selai="${s.id}" data-t="${tok(s)}" data-pick="1" title="Помощник по выбору клиента: что понял и что ещё предложить">🤖 ИИ</button>` : ''}
        ${menu([`<button class="btn ghost" data-pext="${s.id}" title="Ссылка будет действовать ещё сутки от нажатия">⏱ Продлить на сутки</button>`, `<button class="btn ghost sp-del" data-del="${s.id}">🗑 Удалить</button>`], 'Продлить, удалить')}</div></article>`;
  }
  function toggle(key) {
    const o = opened(); o.has(key) ? o.delete(key) : o.add(key); put('spOpen', [...o].slice(-200));
    const b = document.querySelector(`[data-sptg="${CSS.escape(key)}"]`); if (!b) return;
    const on = o.has(key); b.setAttribute('aria-expanded', on); b.lastElementChild.textContent = on ? '▴' : '▾'; b.closest('.sp-foot').nextElementSibling.hidden = !on;
  }
  const EMPTY = {
    all: 'Подборок пока нет. Отметьте объекты галочкой «Выбрать» и нажмите внизу «В подборку»: ссылкой — до 20 объектов, PDF — до 10. Ссылки живут 30 дней (можно продлить), PDF — 7.',
    own: 'Ответов собственников пока нет. Откройте «🔗 Ссылку агенту» у подборки и нажмите «Написать всем» — кто ответил «актуально», появится здесь, и из них можно собрать проверенную подборку.',
    fb: 'Откликов пока нет. Когда клиент откроет ссылку и отметит объекты ✓ / ✗ или напишет комментарий, это появится здесь, а вам придёт уведомление.',
    pick: 'Ссылок «Самоподбор» пока нет. В меню «Мои подборки» нажмите «➕ Новый самоподбор»: текущий фильтр станет рамкой, клиент сам отметит ⭐ и задаст вопросы, а вы увидите это здесь. Ссылка живёт 24 часа, продлевается.',
    ex: 'Подборок эксклюзивов пока нет. Откройте <a href="excl.html">💎 Эксклюзивы</a>, отметьте объекты галочкой «Выбрать» и нажмите внизу «В подборку» — ссылкой до 20, PDF до 10, как у собственников.',
  };
  const HOW = 'Как собрать: отметьте объекты галочкой «Выбрать» в выдаче или в «Избранном» → внизу «В подборку» → отправьте клиенту ссылку, а себе откройте «Ссылку агенту».';
  // d — { items, marks } ; tab — all | own | fb
  // v5.37a: «👥 Main · общие» — подборки других участников группы Main: ссылка клиенту, ссылка агенту, PDF, «В подборку» (удалить и продлить — только автор)
  const MAIN = ['main', '👥 Main · общие', 'Main'];
  function cardMain(s) {
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}<div class="sp-rel sp-owner">👤 ${esc(s.owner?.name || s.owner?.login)} (${esc(s.owner?.login)})</div>
      ${kpi(fbKpi(s))}
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${menu([!isEx(s) && `<button class="btn ghost agent-only" data-edit-selection="${s.id}">✎ Править подборку</button>`,
        s.url && `<a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener" data-url="${esc(s.url)}">📄 PDF клиенту</a>`,
        !isEx(s) && `<button class="btn ghost" data-again="${s.nums.join(',')}">＋ Объекты в новую подборку</button>`], 'Править, PDF, в подборку')}</div>${foot(`main:${s.id}`, 'Отклики', (s.fb ?? []).length, `<ul class="sp-rows">${fbRows(s)}</ul>`)}</article>`;
  }
  function page(d, tab) {
    style();
    if (tab === 'main') {
      const T = [...TABS, MAIN], m = d.mainItems;
      return `<div class="sp-head"><h1>Мои подборки</h1><p class="muted">Подборки участников группы Main: откройте ссылку клиенту или агенту, PDF, возьмите объекты «В подборку». Удалить и продлить может только автор.</p></div>
        <nav class="sp-tabs" role="tablist" aria-label="Мои подборки">${T.map(([k, t, sh]) => `<a href="#sels=${k}" role="tab" class="sp-tab${tab === k ? ' on' : ''}"${tab === k ? ' aria-selected="true"' : ''} title="${t}"><span class="sp-l">${t}</span><span class="sp-s">${sh}</span>${k === 'main' && m?.length ? ` <b>${m.length}</b>` : ''}</a>`).join('')}</nav>
        ${d.mainErr ? `<p class="err">${esc(d.mainErr)}</p>` : !m ? '<p class="muted">Загрузка…</p>' : m.length ? `<div class="sp-list">${m.map(cardMain).join('')}</div>` : '<p class="muted sp-empty">У других участников группы Main подборок пока нет.</p>'}`;
    }
    const marks = d.marks ?? null, items = d.items ?? [];
    const pk = items.filter(isPk), rest = items.filter(s => !isPk(s)), base = rest.filter(s => !isEx(s)), ex = rest.filter(isEx);
    const own = marks ? base.filter(s => ownSum(s, marks)) : [], fb = rest.filter(s => s.link && (s.views || s.fb?.length));
    const allList = [...base, ...pk].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));   // v5.48 H2: «Все подборки» — и ссылки «Самоподбор» (карточка cardPick с пометкой)
    const list = tab === 'own' ? own : tab === 'fb' ? fb : tab === 'ex' ? ex : tab === 'pick' ? pk : allList, n = { all: allList.length, own: own.length, fb: fb.length, ex: ex.length, pick: pk.length };
    return `<div class="sp-head"><h1>Мои подборки</h1><details class="sp-how"><summary>Как собрать подборку?</summary><p class="muted">${HOW}</p></details></div>
      <nav class="sp-tabs" role="tablist" aria-label="Мои подборки">${(d.main ? [...TABS, MAIN] : TABS).map(([k, t, sh]) => `<a href="#sels=${k}" role="tab" class="sp-tab${tab === k ? ' on' : ''}"${tab === k ? ' aria-selected="true"' : ''} title="${t}"><span class="sp-l">${t}</span><span class="sp-s">${sh}</span>${n[k] ? ` <b>${n[k]}</b>` : ''}</a>`).join('')}</nav>
      ${tab === 'ex' ? '<p class="hint sp-exh">💎 Подборки из «Эксклюзивов» коллег: ссылка клиенту и PDF — как у собственников, на «Ссылке агенту» — агенты, разместившие объекты, и «Написать всем».</p>' : ''}
      ${list.length ? `<div class="sp-list">${list.map(s => isPk(s) ? cardPick(s, tab === 'all') : tab === 'own' ? cardOwn(s, marks) : tab === 'fb' ? cardFb(s) : cardAll(s, marks)).join('')}</div>` : `<p class="muted sp-empty">${tab === 'own' && d.pending ? 'Загружаю ответы собственников…' : EMPTY[tab]}</p>`}`;
  }

  style();   // стили раздела, окна подборки и «Проверить в рекламе» — сразу (share.js подключён только на главной)
  return { MAX, formatHtml, format, mount, resultHtml, bind, copy, page, toggle, TABS: [...TABS.map(t => t[0]), 'main'] };
})();

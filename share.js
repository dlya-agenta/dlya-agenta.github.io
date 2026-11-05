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
  const TABS = [['all', 'Все подборки', 'Все'], ['own', 'Ответы собственников', 'Собственники'], ['fb', 'Отклики клиентов', 'Клиенты'], ['ex', 'Подборки эксклюзивов', 'Эксклюзивы']];
  const isEx = s => s.kind === 'excl';   // v5.25b: подборки эксклюзивов — своя вкладка «Подборки эксклюзивов» (в «Все» не входят)
  const agentLink = s => rel(s.agent_link || (s.link ? `${s.link}&a=1` : `s.html#id=${s.id}&a=1`));
  let css = false;
  const style = () => { if (css) return; css = true; document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="sels.css?v=5.31a1">'); };
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
  const meta = s => [when(s.created_at), obj(s.nums.length), s.markup ? `+${s.markup}% клиенту` : isEx(s) ? 'цены агентов' : 'цены собственника', s.query && esc(s.query)].filter(Boolean).join(' · ');
  // v5.31a (п. 2 Алексея): карточка свёрнута — заголовок, дата, «клиент открыл N раз», ✓ ✗ 💬, главные кнопки и «⋯» (остальное и «🗑 Удалить подборку»);
  // отклики и ответы — по «Показать отклики (N) ▾», раскрытие помнится (localStorage spOpen). У подборки с 👍/💬 — «✉️ Написать собственникам по отмеченным»
  // (страница агента с фильтром и выбором, #…&a=1&f=cl) и «🤖 Позвать помощника ИИ» (selai.js вкладки B).
  const btnLink = (s, cls = 'primary') => s.link && s.live ? `<a class="btn ${cls}" href="${esc(s.link)}" target="_blank" rel="noopener" data-url="${esc(s.link)}" title="Страница, которую видит клиент">Ссылка клиенту</a><button class="btn soft" data-copy="${esc(s.link)}">Копировать</button>` : '';
  const btnAgent = s => `<a class="btn soft" href="${esc(agentLink(s))}"${ablank()} title="${isEx(s) ? 'Агенты эксклюзивов, их контакты, «Написать всем» — только для вас' : 'Собственники, «Написать всем», переписка, кто ответил — только для вас'}">🔗 Ссылка агенту</a>`;
  const btnExt = s => s.link ? `<button class="btn ghost" data-extend="${s.id}" title="Ссылка клиенту будет действовать ещё 30 дней">Продлить</button>` : '';
  const kidBtn = s => s.kid ? `<a class="btn soft ok" href="${esc(s.kid.link || rel(`s.html#id=${s.kid.id}&a=1`))}" target="_blank" rel="noopener" title="${esc(s.kid.title || '')}">✓ Проверенная подборка</a>` : '';
  const more = s => {
    const L = [s.link && s.live && navigator.share && `<button class="btn ghost" data-share="${esc(s.link)}">Поделиться</button>`,
      s.url && `<a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener" data-url="${esc(s.url)}">PDF клиенту</a>`,
      ...(isEx(s) ? [`<a class="btn ghost" href="excl.html#sel=${s.nums.join(',')}">💎 В подборку</a>`] : [
        s.url_agent && `<a class="btn ghost" href="${esc(s.url_agent)}" target="_blank" rel="noopener" data-url="${esc(s.url_agent)}" title="Старый PDF агенту — хранится 7 дней, новые не делаются">PDF агенту</a>`,
        `<button class="btn ghost" data-again="${s.nums.join(',')}">В подборку</button>`,
        `<button class="btn ghost" data-rk="${s.nums.join(',')}">📣 В рекламу</button>`,
        `<button class="btn ghost" data-video="${s.nums.slice(0, 10).join(',')}">🎬 Ролик</button>`]),
      `<button class="btn ghost sp-del" data-del="${s.id}">🗑 Удалить подборку</button>`].filter(Boolean).join('');
    return `<details class="sp-dots"><summary class="btn ghost" title="Ещё действия: поделиться, PDF, в подборку, реклама, ролик, удалить">⋯ Ещё</summary><div class="sp-menu">${L}</div></details>`;
  };
  const clFb = s => (s.fb ?? []).filter(f => f.mark === 'yes' || (f.comment && f.mark !== 'no'));
  const clBtns = (s, all = true) => { const n = new Set(clFb(s).map(f => f.num)).size, any = (s.fb ?? []).length;
    return isEx(s) || !any ? '' : `${n ? `<a class="btn primary sp-cl" href="${esc(agentLink(s))}&f=cl"${ablank()} title="Страница агента: выбраны объекты, которые клиент отметил «подходит» или о которых спросил; шаблон — с вопросом клиента">✉️ Написать собственникам по отмеченным клиентом (${n})</a>` : ''}${all ? `<button class="btn soft" data-selai="${s.id}" data-t="${esc(s.token ?? (s.link ? String(s.link).split('#')[1] : ''))}">🤖 Позвать помощника ИИ</button>` : ''}`; };
  const opened = () => new Set(get('spOpen', []));
  const fbRows = s => (s.fb ?? []).map(f => `<li><span class="sp-n">№ ${f.num}</span>${f.mark === 'yes' ? '<b class="ok">✓ подходит</b>' : f.mark === 'no' ? '<b class="bad">✗ не подходит</b>' : '<b>💬</b>'}<span>${esc(f.what)}</span>${f.comment ? `<span class="muted">«${esc(f.comment)}»</span>` : ''}<small class="muted">${when(f.at)}</small></li>`).join('');
  const ST = { yes: ['ok', '✓ актуально'], no: ['bad', '✗ не актуально'], sold: ['bad', '✗ продано'], none: ['', '✗ не ответил'], wait: ['', '⏳ ждём'] };
  const ownRows = (s, marks) => s.nums.map(n => marks?.[n] && { n, m: marks[n] }).filter(Boolean).map(({ n, m }) => `<li><span class="sp-n">№ ${n}</span><b class="${ST[m.st]?.[0] ?? ''}">${ST[m.st]?.[1] ?? esc(m.st)}</b>${m.text ? `<span class="muted">«${esc(String(m.text).slice(0, 120))}»</span>` : ''}${m.unseen ? '<span class="sp-b">новый ответ</span>' : ''}${m.at ? `<small class="muted">${m.st === 'wait' || m.st === 'none' ? 'написали ' : ''}${when(m.at)}</small>` : ''}${m.err ? `<small class="muted">${esc(m.err)}</small>` : m.st === 'wait' && m.next ? `<small class="muted">проверю ${when(m.next)}</small>` : ''}</li>`).join('');
  // раскрывающаяся часть: key — своя для вкладки (all:12 / own:12 / fb:12), чтобы «Все» и «Отклики» раскрывались независимо
  const fold = (key, label, n, body) => { if (!n || !body) return ''; const on = opened().has(key);
    return `<button type="button" class="link sp-tg" data-sptg="${key}" aria-expanded="${on}">${label} (${n}) <span aria-hidden="true">${on ? '▴' : '▾'}</span></button><div class="sp-det"${on ? '' : ' hidden'}>${body}</div>`; };
  const head = s => `<div class="sp-top"><b class="sp-t">${esc(s.title)}</b>${isEx(s) ? '<span class="sp-b ex">💎 эксклюзивы</span>' : ''}${s.checked ? '<span class="sp-b ok" title="Собрана со страницы агента из объектов, где собственник ответил «актуально»">✓ проверенная</span>' : ''}${linkBadge(s)}</div>
    <div class="sp-meta muted">${meta(s)}</div>
    ${s.from ? `<div class="sp-rel muted">Собрана из подборки ${s.from.title ? `«${esc(s.from.title)}»` : `№ ${s.from.id}`}</div>` : ''}`;
  function cardAll(s, marks) {
    const o = ownSum(s, marks), f = fbLine(s), rows = fbRows(s), orows = o ? ownRows(s, marks) : '';
    const det = `${rows ? `<div class="sp-sub">Отклики клиента</div><ul class="sp-rows">${rows}</ul>` : ''}${orows ? `<div class="sp-sub">Ответы собственников</div><ul class="sp-rows">${orows}</ul>` : ''}${clBtns(s) ? `<div class="sp-acts">${clBtns(s)}</div>` : ''}`;
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}${f || o ? `<div class="sp-st">${f ? `<span>${f}</span>` : ''}${o ? `<span>${ownLine(o)}</span>` : ''}</div>` : ''}
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${kidBtn(s)}${btnExt(s)}${more(s)}</div>${fold(`all:${s.id}`, 'Показать отклики', (s.fb ?? []).length + (o?.sent ?? 0), det)}</article>`;
  }
  function cardOwn(s, marks) {
    const o = ownSum(s, marks);
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}<div class="sp-st"><span>${ownLine(o)}</span></div>
      <div class="sp-acts"><a class="btn primary" href="${esc(agentLink(s))}"${ablank()}>Открыть ссылку агента</a>${kidBtn(s)}${more(s)}</div>${fold(`own:${s.id}`, 'Показать ответы', o.sent, `<ul class="sp-rows">${ownRows(s, marks)}</ul>`)}</article>`;
  }
  function cardFb(s) {
    const rows = fbRows(s);
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}<div class="sp-st"><span>${fbLine(s)}</span></div>
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${btnExt(s)}${more(s)}</div>${clBtns(s) ? `<div class="sp-acts sp-clrow">${clBtns(s)}</div>` : ''}${fold(`fb:${s.id}`, 'Показать отклики', (s.fb ?? []).length, `<ul class="sp-rows">${rows}</ul>`)}</article>`;
  }
  function toggle(key) {
    const o = opened(); o.has(key) ? o.delete(key) : o.add(key); put('spOpen', [...o].slice(-200));
    const b = document.querySelector(`[data-sptg="${CSS.escape(key)}"]`); if (!b) return;
    const on = o.has(key); b.setAttribute('aria-expanded', on); b.lastElementChild.textContent = on ? '▴' : '▾'; b.nextElementSibling.hidden = !on;
  }
  const EMPTY = {
    all: 'Подборок пока нет. Отметьте объекты галочкой «Выбрать» и нажмите внизу «В подборку»: ссылкой — до 20 объектов, PDF — до 10. Ссылки живут 30 дней (можно продлить), PDF — 7.',
    own: 'Ответов собственников пока нет. Откройте «🔗 Ссылку агенту» у подборки и нажмите «Написать всем» — кто ответил «актуально», появится здесь, и из них можно собрать проверенную подборку.',
    fb: 'Откликов пока нет. Когда клиент откроет ссылку и отметит объекты ✓ / ✗ или напишет комментарий, это появится здесь, а вам придёт уведомление.',
    ex: 'Подборок эксклюзивов пока нет. Откройте <a href="excl.html">💎 Эксклюзивы</a>, отметьте объекты галочкой «Выбрать» и нажмите внизу «В подборку» — ссылкой до 20, PDF до 10, как у собственников.',
  };
  const HOW = 'Как собрать: отметьте объекты галочкой «Выбрать» в выдаче или в «Избранном» → внизу «В подборку» → отправьте клиенту ссылку, а себе откройте «Ссылку агенту».';
  // d — { items, marks } ; tab — all | own | fb
  // v5.37a: «👥 Main · общие» — подборки других участников группы Main: ссылка клиенту, ссылка агенту, PDF, «В подборку» (удалить и продлить — только автор)
  const MAIN = ['main', '👥 Main · общие', 'Main'];
  function cardMain(s) {
    const L = [s.url && `<a class="btn ghost" href="${esc(s.url)}" target="_blank" rel="noopener" data-url="${esc(s.url)}">PDF клиенту</a>`,
      !isEx(s) && `<button class="btn ghost" data-again="${s.nums.join(',')}">В подборку</button>`].filter(Boolean).join('');
    return `<article class="sp-card" data-sid="${s.id}">${head(s)}<div class="sp-rel sp-owner">👤 аккаунт: ${esc(s.owner?.name || s.owner?.login)} (${esc(s.owner?.login)})</div>
      ${fbLine(s) ? `<div class="sp-st"><span>${fbLine(s)}</span></div>` : ''}
      <div class="sp-acts">${btnLink(s)}${btnAgent(s)}${L}</div>${fold(`main:${s.id}`, 'Показать отклики', (s.fb ?? []).length, `<ul class="sp-rows">${fbRows(s)}</ul>`)}</article>`;
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
    const base = items.filter(s => !isEx(s)), ex = items.filter(isEx);
    const own = marks ? base.filter(s => ownSum(s, marks)) : [], fb = items.filter(s => s.link && (s.views || s.fb?.length));
    const list = tab === 'own' ? own : tab === 'fb' ? fb : tab === 'ex' ? ex : base, n = { all: base.length, own: own.length, fb: fb.length, ex: ex.length };
    return `<div class="sp-head"><h1>Мои подборки</h1><p class="muted">${HOW}</p></div>
      <nav class="sp-tabs" role="tablist" aria-label="Мои подборки">${(d.main ? [...TABS, MAIN] : TABS).map(([k, t, sh]) => `<a href="#sels=${k}" role="tab" class="sp-tab${tab === k ? ' on' : ''}"${tab === k ? ' aria-selected="true"' : ''} title="${t}"><span class="sp-l">${t}</span><span class="sp-s">${sh}</span>${n[k] ? ` <b>${n[k]}</b>` : ''}</a>`).join('')}</nav>
      ${tab === 'ex' ? '<p class="hint sp-exh">💎 Подборки из «Эксклюзивов» коллег: ссылка клиенту и PDF — как у собственников, на «Ссылке агенту» — агенты, разместившие объекты, и «Написать всем».</p>' : ''}
      ${list.length ? `<div class="sp-list">${list.map(s => tab === 'own' ? cardOwn(s, marks) : tab === 'fb' ? cardFb(s) : cardAll(s, marks)).join('')}</div>` : `<p class="muted sp-empty">${tab === 'own' && d.pending ? 'Загружаю ответы собственников…' : EMPTY[tab]}</p>`}`;
  }

  style();   // стили раздела, окна подборки и «Проверить в рекламе» — сразу (share.js подключён только на главной)
  return { MAX, formatHtml, format, mount, resultHtml, bind, copy, page, toggle, TABS: [...TABS.map(t => t[0]), 'main'] };
})();

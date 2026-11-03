// v5.24b: общее для «Юриста», «Ипотечника» и «Сделки» (window.LAWR): отчёт проверки объекта/собственника, окно, лимит тарифа.
// Отчёт: что проверено → что найдено → чего не хватает → вывод → степень риска → какие документы запросить → шаги → открытые источники (+ банки у ипотечника).
// Кнопки: «Поделиться» (ссылка на 7 дней, law_share), «Копировать текст», «Прикрепить к сделке» (deal_list → law_attach). Сервер — hub/law.ts, hub/check.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const RISK = { low: ['Низкий', 'low'], mid: ['Средний', 'mid'], high: ['Высокий', 'high'] };
  const SRC = { ok: ['✓', 'проверено — ничего не найдено'], found: ['⚠️', 'найдено — важно'], manual: ['🔗', 'капча или плата — проверьте сами'], fail: ['⏳', 'не ответил — проверьте по ссылке'] };
  const arr = v => Array.isArray(v) ? v.filter(x => x != null && String(x).trim()) : [];

  // маленькое окно поверх страницы (разметка .sheet из style.css); возвращает {box, close}
  function sheet(title, html, onClose) {
    const d = document.createElement('div');
    d.className = 'sheet lr-sheet';
    d.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><b>${esc(title)}</b><button class="x" data-x aria-label="Закрыть">✕</button></div>
      <div class="sheet-body">${html}</div></div>`;
    const close = () => { d.remove(); onClose?.(); };
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-x]')) close(); });
    document.body.appendChild(d);
    return { box: d.querySelector('.sheet-body'), close };
  }

  // лимит тарифа: окно с текстом и «Перейти на PRO/MAX»; true — это был лимит
  function limit(e) {
    if (!(e?.code === 'limit' || e?.status === 402)) return false;
    const up = e.data?.up === 'max' ? 'max' : e.data?.up === 'pro' ? 'pro' : null;
    sheet('Лимит тарифа', `<p class="lr-limit">🔒 ${esc(e.message || 'Лимит на этот месяц закончился')}</p>
      <p class="hub-actions">${up ? `<a class="btn primary" href="pay.html?plan=${up}">Перейти на ${up === 'max' ? 'MAX' : 'PRO'}</a>` : ''}
        <a class="btn ghost" href="prices.html" target="_blank">Что входит в тарифы</a></p>`);
    return true;
  }
  const fail = e => { if (!limit(e)) H.toast(e?.name === 'TimeoutError' ? 'Ответ идёт дольше обычного — откройте раздел снова через минуту' : e?.message || 'Ошибка', 7000); };

  const list = (title, items, cls = '') => arr(items).length ? `<div class="lr-blk ${cls}"><b>${title}</b><ul>${arr(items).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
  const srcRow = s => { const [ic, t] = SRC[s.status] ?? SRC.fail;
    return `<li class="lr-src ${esc(s.status ?? 'fail')}"><span class="lr-src-ic" aria-hidden="true">${ic}</span><span><b>${esc(s.name)}</b> — ${esc(s.text || t)}
      ${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${s.status === 'manual' || s.status === 'fail' ? 'открыть и проверить' : 'источник'}</a>` : ''}</span></li>`; };

  // отчёт → HTML; opts: {id, share, attach, deal_id, title}
  function html(r, o = {}) {
    const rk = RISK[r.risk] ?? RISK.mid, who = r.role === 'broker' ? '🏦 Ипотечный брокер' : '⚖️ Юрист';
    return `<article class="lr" data-lr="${esc(o.id ?? '')}">
      <div class="lr-top"><b>${esc(o.title ?? (r.kind === 'owner' ? '🔎 Проверка собственника' : '🔎 Проверка объекта'))}</b><small class="muted">${esc(who)}${r.at ? ' · ' + H.when(r.at) : ''}</small></div>
      ${list('✅ Что проверено', r.checked)}
      ${list('🔍 Что найдено', r.findings, 'find')}
      ${list('⚠️ Чего не хватает', r.missing, 'miss')}
      <div class="lr-sum"><div class="lr-risk ${rk[1]}"><small>Степень риска</small><b>${rk[0]}</b></div>
        <div class="lr-out"><small>Вывод</small><p>${esc(r.summary || '—')}</p></div></div>
      ${list('📄 Какие документы запросить', r.request_docs, 'req')}
      ${arr(r.steps).length ? `<div class="lr-blk steps"><b>👉 Шаги</b><ol>${arr(r.steps).map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
      ${list('🏦 Банки', r.banks)}
      ${arr(r.questions).length ? list('❓ Уточните', r.questions) : ''}
      ${arr(r.sources).length ? `<div class="lr-blk"><b>🌐 Открытые источники</b><ul class="lr-srcs">${r.sources.map(srcRow).join('')}</ul>
        <small class="muted">Проверяем только то, что открыто без капчи и платы. Где капча или плата — ссылка, проверьте сами.</small></div>` : ''}
      ${H.star()}
      ${o.share !== false || o.attach !== false ? `<p class="hub-actions lr-act">
        ${o.share !== false && o.id ? '<button class="btn soft" data-lr-share>📤 Поделиться</button>' : ''}
        <button class="btn soft" data-lr-copy>📋 Копировать текст</button>
        ${o.attach !== false && o.id ? `<button class="btn soft" data-lr-attach>📑 Прикрепить к сделке</button>` : ''}
        ${r.deal_id || o.deal_id ? `<a class="btn ghost" href="#deal=${esc(r.deal_id || o.deal_id)}">Открыть сделку</a>` : ''}</p>` : ''}
    </article>`;
  }

  // отчёт простым текстом (копировать / отправить в мессенджер)
  function text(r) {
    const L = (t, a, num) => arr(a).length ? `${t}\n${arr(a).map((x, i) => `${num ? `${i + 1}.` : '•'} ${x}`).join('\n')}\n` : '';
    return [r.kind === 'owner' ? 'Проверка собственника' : 'Проверка объекта', '', L('Что проверено:', r.checked), L('Что найдено:', r.findings), L('Чего не хватает:', r.missing),
      `Вывод: ${r.summary || '—'}`, `Степень риска: ${(RISK[r.risk] ?? RISK.mid)[0]}`, '', L('Какие документы запросить:', r.request_docs), L('Шаги:', r.steps, true), L('Банки:', r.banks),
      arr(r.sources).length ? `Открытые источники:\n${r.sources.map(s => `• ${s.name}: ${s.text || (SRC[s.status] ?? SRC.fail)[1]}${s.url ? ` — ${s.url}` : ''}`).join('\n')}\n` : '',
      H.STAR].filter(x => x !== '').join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // выбор сделки и прикрепление
  async function attach(id, r) {
    let deals;
    try { deals = (await H.call('deal_list')).deals ?? []; } catch (e) { fail(e); return; }
    const open = deals.filter(d => !['done', 'lost'].includes(d.stage));
    const s = sheet('Прикрепить к сделке', open.length ? `<p class="hint">Отчёт и документы пакета появятся в выбранной сделке.</p>
      <div class="lr-deals">${open.map(d => `<button class="lr-deal" data-d="${d.id}"><b>${esc(d.title)}</b><small>${H.when(d.updated_at)}</small></button>`).join('')}</div>`
      : '<p>Открытых сделок нет.</p><p><a class="btn primary" href="#deal=new">＋ Новая сделка</a></p>');
    s.box.addEventListener('click', async e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      b.disabled = true;
      try { await H.call('law_attach', { id, deal_id: +b.dataset.d }); s.close(); r.deal_id = +b.dataset.d; H.toast('Прикреплено к сделке'); render.last?.(); }
      catch (er) { b.disabled = false; fail(er); }
    });
  }
  async function share(id, r) {
    try {
      const s = await H.call('law_share', { id });
      if (navigator.share) { try { await navigator.share({ title: 'Отчёт проверки', text: s.text || 'Отчёт проверки объекта', url: s.url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
      await H.copy(s.url, `Ссылка скопирована — действует до ${H.day(s.until)}`);
    } catch (e) { fail(e); }
  }

  // показать отчёт в el; opts — как у html()
  function render(el, r, o = {}) {
    el.innerHTML = html(r, o);
    const redraw = () => render(el, r, o);
    el.onclick = e => {
      if (e.target.closest('[data-lr-copy]')) { H.copy(text(r), 'Текст отчёта скопирован'); return; }
      if (e.target.closest('[data-lr-share]')) { share(o.id, r); return; }
      if (e.target.closest('[data-lr-attach]')) { render.last = redraw; attach(o.id, r); }
    };
  }

  window.LAWR = { report: render, html, text, limit, fail, sheet, RISK };
})();

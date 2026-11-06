// База знаний по сделкам с поиском (v5.16, п. 12): виды сделок (этапы, документы продавца и покупателя, риски), способы расчёта, проверка собственника.
// Поиск — по всем словам сразу, без учёта регистра и «ё»; найденное раскрывается и подсвечивается. Данные — hub deal_kb (hub/kb.ts), без ИИ.
// window.KB.render(el, kb) — встроить (внизу списка сделок); hub.html#kb — отдельный раздел.
(() => {
  const H = window.HUB, esc = H.esc;
  const norm = s => String(s ?? '').toLowerCase().replace(/ё/g, 'е');
  // подсветка: позиции ищем в нормализованной строке (та же длина), режем исходную
  function hl(text, words) {
    const s = String(text ?? ''), n = norm(s), marks = [];
    for (const w of words) { let i = n.indexOf(w); while (w && i >= 0) { marks.push([i, i + w.length]); i = n.indexOf(w, i + w.length); } }
    if (!marks.length) return esc(s);
    marks.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0;
    for (const [a, b] of marks) { if (a < at) continue; out += esc(s.slice(at, a)) + `<mark>${esc(s.slice(a, b))}</mark>`; at = b; }
    return out + esc(s.slice(at));
  }
  const hit = (words, ...parts) => { const t = norm(parts.flat().join(' ')); return words.every(w => t.includes(w)); };

  function html(kb, q) {
    const words = norm(q).split(/[\s,.;:!?«»"()]+/).filter(w => w.length >= 2);
    const any = words.length > 0, h = s => hl(s, words);
    const kinds = kb.kinds.filter(k => !any || hit(words, k.name, k.when, k.stages, k.seller, k.buyer, k.risks, k.terms ?? ''));
    const pay = kb.pay.filter(p => !any || hit(words, p.name, p.how, p.opinion ?? '', p.risks ?? []));
    const checks = kb.checks.filter(c => !any || hit(words, c.name, c.where));
    // v5.38: путь сделки по этапам и сценарии «если пошло не так» (hub/path.ts)
    const ST = kb.stages ?? {}, path = Object.entries(kb.path ?? {}).filter(([s, p]) => !any || hit(words, ST[s] ?? '', p.goal, p.do, p.docs.map(x => x.name), p.who, p.check, p.tips ?? []));
    const scs = (kb.scenarios ?? []).filter(x => !any || hit(words, x.name, x.when, x.money ?? '', x.steps, x.checks ?? []));
    const n = kinds.length + pay.length + checks.length + path.length + scs.length;
    if (any && !n) return `<p class="kb-none">Ничего не нашлось по «${esc(q)}». <a class="btn soft" href="#lawyer">⚖️ Спросить юриста</a> <a class="btn soft" href="#broker">🏦 Спросить ипотечного брокера</a></p>`;
    return `${any ? `<p class="hint">Найдено: ${n}</p>` : ''}
      ${kinds.length ? `<h3>🧾 Виды сделок</h3><div class="hub-kbw">${kinds.map(k => `<details${any ? ' open' : ''}><summary><b>${h(k.name)}</b> — ${h(k.when)}</summary>
        <div class="kb-in"><p><b>Этапы:</b></p><ol>${k.stages.map(s => `<li>${h(s)}</li>`).join('')}</ol>
        <div class="kb-2"><div><p><b>Документы продавца:</b></p><ul>${k.seller.map(s => `<li>${h(s)}</li>`).join('')}</ul></div>
        <div><p><b>Документы покупателя:</b></p><ul>${k.buyer.map(s => `<li>${h(s)}</li>`).join('')}</ul></div></div>
        <p><b>⚠️ Риски:</b> ${k.risks.map(h).join('; ')}</p>${k.terms ? `<p class="hint">${h(k.terms)}</p>` : ''}</div></details>`).join('')}</div>` : ''}
      ${pay.length ? `<h3>💳 Способы расчёта</h3><div class="hub-kbw">${pay.map(p => `<details${any ? ' open' : ''}><summary><b>${h(p.name)}</b>${p.op ? ' <span class="hub-op">💡 мнение</span>' : ''}</summary>
        <div class="kb-in"><p>${h(p.how)}</p>${p.opinion ? `<p><i>${h(p.opinion)}</i></p>` : ''}${p.risks?.length ? `<p><b>⚠️ Риски:</b></p><ul>${p.risks.map(r => `<li>${h(r)}</li>`).join('')}</ul>` : ''}</div></details>`).join('')}</div>` : ''}
      ${checks.length ? `<h3>🔎 Проверка собственника</h3><ul class="kb-checks">${checks.map(c => `<li><b>${h(c.name)}</b> — ${h(c.where)}${c.url ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">сайт</a>` : ''}</li>`).join('')}</ul>` : ''}
      ${path.length ? `<h3>🧭 Путь сделки: этапы и что делать</h3><div class="hub-kbw">${path.map(([s, p]) => `<details${any ? ' open' : ''}><summary><b>${h(ST[s] ?? s)}</b> — ${h(p.goal)}</summary>
        <div class="kb-in"><p><b>Что сделать:</b></p><ol>${p.do.map(x => `<li>${h(x)}</li>`).join('')}</ol>
        <div class="kb-2"><div><p><b>Документы:</b></p><ul>${p.docs.map(x => `<li>${h(x.name)}</li>`).join('')}</ul><p><b>Кто:</b> ${h(p.who)}</p></div>
        <div><p><b>Готово к следующему этапу:</b></p><ul>${p.check.map(x => `<li>${h(x)}</li>`).join('')}</ul></div></div>
        ${(p.tips ?? []).map(t => `<p class="hint">💡 ${h(t)}</p>`).join('')}</div></details>`).join('')}</div>` : ''}
      ${scs.length ? `<h3>⚠️ Если что-то пошло не так</h3><div class="hub-kbw">${scs.map(x => `<details${any ? ' open' : ''}><summary><b>${h(x.name)}</b> — ${h(x.when)}</summary>
        <div class="kb-in">${x.money ? `<p>💰 ${h(x.money)}</p>` : ''}<ol>${x.steps.map(t => `<li>${h(t)}</li>`).join('')}</ol>
        <p class="hint">Документы составляются в карточке сделки — «📝 Составить документы».</p></div></details>`).join('')}</div>` : ''}`;
  }

  function render(box, kb) {
    if (!box) return;
    box.innerHTML = `<div class="kb-search"><input type="search" id="kb-q" placeholder="🔎 Поиск по базе знаний: ячейка, наследство, маткапитал, аккредитив…" aria-label="Поиск по базе знаний" autocomplete="off"></div>
      <div class="kb-res">${html(kb, '')}</div>${H.star()}`;
    const inp = box.querySelector('#kb-q'), res = box.querySelector('.kb-res');
    let t = null;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { res.innerHTML = html(kb, inp.value); }, 150); });
  }

  async function open(arg, ctx) {
    const kb = await H.call('deal_kb');
    ctx.el.innerHTML = `<div class="dl-head"><h2>📚 База знаний по сделкам</h2></div>
      <p class="hint">Справка по видам сделок, расчётам и проверке собственника. Не нашли ответ — спросите <a href="#lawyer">⚖️ юриста</a> или <a href="#broker">🏦 ипотечного брокера</a> (ИИ, можно голосом).</p>
      <section class="hub-sec dl-sec" id="kb-box"></section>`;
    render(ctx.el.querySelector('#kb-box'), kb);
    if (arg) { const i = ctx.el.querySelector('#kb-q'); i.value = arg; i.dispatchEvent(new Event('input')); }
  }
  window.KB = { render };
  window.SEC = window.SEC || {};
  window.SEC.kb = { title: 'База знаний', open };
})();

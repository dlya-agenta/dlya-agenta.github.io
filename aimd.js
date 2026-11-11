// v5.58 (Алексей 11.11, выбран вид «A + C»): единое оформление ответов ИИ — Помощник, ИИ-Агент, юрист, ипотека, сделка, отклики, Помощь,
// анализ, прикреплённый к подборке (страница агента и клиента). Разметку задаёт правило _shared/aiformat.ts в промтах:
//   «**Итог:** …» — вывод сверху; таблица | Объект | Цена | ₽/м² | С чем сравнил | Рынок ₽/м² | Разница | — над ней плашки-вердикты
//   и шкала «цена против рынка» (вид C), сама таблица с мини-фото (вид A); «### 260134 — вывод» — разбор объекта (раскрывается);
//   «+ плюс» / «− минус» — строки с цветным знаком; «⚠️ …» — отдельная плашка «Не подтверждено».
// Ссылки на объекты, мини-фото и карточку при наведении делает objpop.js; сравнение по объекту кладётся в window.AICMP (карточка показывает «с чем сравнил»).
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|\s)([−-]\s?\d{1,3}(?:[.,]\d)?\s?%)/g, '$1<span class="ai-neg">$2</span>').replace(/(^|\s)(\+\s?\d{1,3}(?:[.,]\d)?\s?%)/g, '$1<span class="ai-pos">$2</span>');
  const NUM = /(?<!\d)(\d{6,7})(?!\d)/;
  const th = n => `<span class="objm-th" data-obj="${n}"><img alt="" loading="lazy" referrerpolicy="no-referrer"></span>`;
  const objA = (n, t = n) => `<a class="objlink objm" href="./#o=${n}" data-obj="${n}" title="Открыть объявление № ${n}">${esc(t)}</a>`;
  const CMP = window.AICMP ??= new Map();
  const pctOf = s => { const m = /([−+-])?\s?(\d{1,3}(?:[.,]\d+)?)\s?%/.exec(String(s)); return m ? (m[1] === '−' || m[1] === '-' ? -1 : 1) * parseFloat(m[2].replace(',', '.')) : null; };
  const cls = d => d == null ? '' : d <= -5 ? 'ok' : d >= 5 ? 'bad' : 'mid';
  const verdict = d => d <= -5 ? '💚 Дешевле рынка' : d >= 5 ? '🔴 Дороже рынка' : '🟡 В рынке';
  const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(x => x.trim());

  function table(rows) {
    const head = rows[0], body = rows.slice(1).filter(r => r.some(Boolean));
    const ci = re => head.findIndex(h => re.test(h));
    const iD = ci(/разниц|diff|к рынку|отклон/i), iP = ci(/₽\s*\/\s*м|за\s*м|м²|м2/i), iM = ci(/рын|медиан|аналог/i), iW = ci(/с чем|сравн|база|по чему/i), iC = ci(/^цена|стоим/i);
    const cmp = iD >= 0 && body.length >= 1 && body.every(r => NUM.test(r[0] ?? ''));
    if (!cmp) return `<div class="ai-tw"><table class="ai-t"><thead><tr>${head.map(h => `<th>${inl(h)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${head.map((_, k) => `<td>${inl(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const objs = body.map(r => { const n = +NUM.exec(r[0])[1], d = pctOf(r[iD]);
      const o = { num: n, top: /⭐/.test(r[0]), what: r[0].replace(/⭐\s*/g, '').replace(NUM, '').replace(/^[\s—–:,-]+/, '').trim(), diff: d, ppm: iP >= 0 ? r[iP] : '', market: iM >= 0 && iM !== iP ? r[iM] : '', with: iW >= 0 ? r[iW] : '', price: iC >= 0 ? r[iC] : '' };
      CMP.set(n, o); return o; });
    const sorted = [...objs].filter(o => o.diff != null).sort((a, b) => a.diff - b.diff);
    const chips = sorted.length >= 2 ? `<div class="ai-vd">${sorted.slice(0, 4).map(o => `<div class="ai-vc ${cls(o.diff)}${o.top ? ' ai-topc' : ''}">${th(o.num)}<div><i>${o.top ? '⭐ ' : ''}${verdict(o.diff)}</i><b>${objA(o.num)} <span>${o.diff > 0 ? '+' : o.diff < 0 ? '−' : ''}${Math.abs(o.diff).toString().replace('.', ',')} %</span></b></div></div>`).join('')}</div>` : '';
    const bars = sorted.length ? `<div class="ai-bars">${sorted.map(o => { const x = Math.max(4, Math.min(96, 50 + o.diff * 1.2));
      return `<div class="ai-bar"><div class="ai-bo">${th(o.num)}<div>${objA(o.num)}<small>${esc(o.ppm)}${o.with ? ` · ${esc(o.with)}` : ''}</small></div></div>
        <div class="ai-sc" title="Точка — цена объекта за м², черта — середина рынка того, с чем сравнивали"><span class="ai-mid"></span><span class="ai-dot ${cls(o.diff)}" style="left:${x}%"></span></div>
        <span class="ai-bd ${cls(o.diff)}">${o.diff > 0 ? '+' : o.diff < 0 ? '−' : ''}${Math.abs(o.diff).toString().replace('.', ',')} %</span></div>`; }).join('')}
      <p class="ai-leg">Точка — цена за м², черта — рынок (с чем сравнивали). Левее — дешевле.</p></div>` : '';
    const tbl = `<div class="ai-tw"><table class="ai-t ai-cmp"><thead><tr>${head.map((h, k) => `<th${k && k !== iW ? ' class="r"' : ''}>${inl(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r, j) => `<tr${objs[j].top ? ' class="ai-top"' : ''}>${head.map((h, k) => !k
      ? `<td data-l="${esc(h)}"><div class="ai-to">${th(objs[j].num)}<div>${objs[j].top ? '<span class="ai-star" title="В тройке лучших">⭐ Топ-3</span> ' : ''}${objA(objs[j].num)}<small>${esc(objs[j].what)}</small></div></div></td>`
      : k === iD ? `<td class="r" data-l="${esc(h)}"><span class="ai-bd ${cls(objs[j].diff)}">${esc(r[k] ?? '')}</span></td>`
      : `<td${k !== iW ? ' class="r"' : ''} data-l="${esc(h)}">${inl(r[k] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return chips + bars + tbl;
  }

  // простые блоки: абзацы, списки, «+»/«−»
  function blocks(lines) {
    const out = []; let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of lines) {
      const l = raw.trimEnd(); let m;
      if (!l.trim()) { close(); continue; }
      if ((m = /^\s*(?:[-*•]\s*)?🔒\s*(.*)/.exec(l))) { close(); out.push(`<p class="ai-ag" title="Клиент этого не увидит"><b>🔒 Для вас:</b> ${inl(m[1])}</p>`); continue; }
      if ((m = /^\s*([+＋])\s+(.*)/.exec(l))) { close(); out.push(`<p class="ai-pl">${inl(m[2])}</p>`); continue; }
      if ((m = /^\s*[−–]\s+(.*)/.exec(l))) { close(); out.push(`<p class="ai-mn">${inl(m[1])}</p>`); continue; }
      if (/^\s*([-*•])\s+/.test(l)) { const tx = l.replace(/^\s*[-*•]\s+/, '');
        if ((m = /^([+＋]|[−–-])\s+(.*)/.exec(tx))) { close(); out.push(`<p class="${/[+＋]/.test(m[1]) ? 'ai-pl' : 'ai-mn'}">${inl(m[2])}</p>`); continue; }   // «- + плюс» / «- − минус»
        if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inl(tx)}</li>`); continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inl(m[1])}</li>`); continue; }
      close(); out.push(`<p>${inl(l)}</p>`);
    }
    close(); return out.join('');
  }

  function md(text) {
    const L = String(text ?? '').replace(/\r/g, '').split('\n'), out = [];
    let buf = [], sec = null, nsec = 0;
    const flush = () => { if (!buf.length) return; const h = blocks(buf); buf = []; if (sec) sec.body += h; else out.push(h); };
    const endSec = () => { flush(); if (!sec) return; nsec++;
      out.push(`<details class="ai-sec${sec.top ? ' ai-top' : ''}${sec.agent ? ' ai-agsec' : ''}"${sec.open ? ' open' : ''}><summary>${sec.num ? th(sec.num) : ''}<span>${sec.agent ? '<b class="ai-agt">🔒 Только для вас</b> ' : ''}${sec.top ? '<span class="ai-star">⭐ Топ-3</span> ' : ''}${sec.num ? `${objA(sec.num)}${sec.title ? ' — ' : ''}` : ''}${inl(sec.title)}</span></summary><div class="ai-sb">${sec.body}</div></details>`); sec = null; };
    for (let i = 0; i < L.length; i++) {
      const l = L[i].trimEnd(), t = l.trim(); let m;
      if (/^\*\s*Перед сделкой/.test(t)) { endSec(); out.push(`<p class="hub-star"><b>*</b> ${esc(t.replace(/^\*\s*/, ''))}</p>`); continue; }
      if (t.includes('|') && cells(t).length >= 2 && (/^\s*\|?\s*:?-{3,}/.test(L[i + 1] ?? '') || t.startsWith('|'))) {   // таблица
        flush(); const rows = [];
        for (; i < L.length && L[i].includes('|'); i++) if (!/^\s*\|?\s*:?-{3,}/.test(L[i])) rows.push(cells(L[i]));
        i--; const h = rows.length >= 2 ? table(rows) : blocks(rows.map(r => r.join(' · ')));
        if (sec) sec.body += h; else { endSec(); out.push(h); } continue;
      }
      if (/^\s*\|?\s*:?-{3,}/.test(t)) continue;
      if ((m = /^#{1,6}\s+(.*)/.exec(t))) {
        endSec(); const n = NUM.exec(m[1]), lead = n && m[1].indexOf(n[1]) <= 3;
        const agentH = /🔒|отбраковк|для агента|торг/i.test(m[1]);
        if (lead) sec = { num: +n[1], top: /⭐/.test(m[1]), title: m[1].slice(m[1].indexOf(n[1]) + n[1].length).replace(/^[\s*—–:.,-]+/, ''), body: '', open: true };
        else if (agentH) sec = { num: 0, agent: true, title: m[1].replace(/🔒\s*/, ''), body: '', open: true };
        else out.push(`<p class="md-h">${inl(m[1])}</p>`);
        continue;
      }
      // v5.58a (Алексей 11.11): ссылки сервиса и текст для клиента — цитатой, нажатие копирует
      if (!t.startsWith('>') && (m = /^(.*?)(https:\/\/dlya-agenta\.github\.io\/\S+?)[.,;)»]*\s*$/.exec(t))) { flush(); const lab = m[1].replace(/[\s:—–-]+$/, '').replace(/\*\*/g, '').trim(), u = m[2];
        const h = `<div class="ai-lk" data-copy="${esc(u)}" title="Нажмите — скопировать ссылку">${lab ? `<b>${esc(lab)}</b>` : ''}<code>${esc(u)}</code><span class="ai-cp">📋 Копировать</span><a href="${esc(u)}" target="_blank" rel="noopener" class="ai-op" title="Открыть">↗</a></div>`;
        if (sec) sec.body += h; else out.push(h); continue; }
      if (/^>\s?/.test(t)) { flush(); const q = []; for (; i < L.length && /^\s*>\s?/.test(L[i]); i++) q.push(L[i].trim().replace(/^>\s?/, '')); i--;
        const raw = q.join('\n').replace(/\*\*/g, '').trim(), h = `<blockquote class="ai-q" data-copy="${esc(raw)}" title="Нажмите — скопировать текст">${q.map(x => x.trim() ? `<p>${inl(x)}</p>` : '').join('')}<span class="ai-cp">📋 Нажмите, чтобы скопировать</span></blockquote>`;
        if (sec) sec.body += h; else out.push(h); continue; }
      if ((m = /^(?:\*\*)?(Итог|Вывод|Коротко|Главное)(?:\*\*)?\s*[:：](?:\*\*)?\s*(.*)/i.exec(t)) && !sec) { flush(); out.push(`<p class="ai-sum"><b>${esc(m[1])}:</b> ${inl(m[2].replace(/^\*\*\s*/, ''))}</p>`); continue; }
      if (/^(⚠️|⚠|❗)/.test(t)) { endSec(); const s = t.replace(/^(⚠️|⚠|❗)\s*/, ''), k = s.indexOf(':');
        out.push(`<div class="ai-note">⚠️ ${k > 0 && k < 40 ? `<b>${inl(s.slice(0, k).replace(/\*\*/g, ''))}</b>${inl(s.slice(k + 1))}` : inl(s)}</div>`); continue; }
      buf.push(l);
    }
    endSec();
    // много разборов — первые два открыты, остальные по нажатию
    let html = out.join('');
    if (nsec > 3) { let k = 0; html = html.replace(/<details class="ai-sec" open>/g, s => ++k <= 2 ? s : '<details class="ai-sec">'); }
    return `<div class="md ai-md">${html}</div>`;
  }

  const css = `.ai-md{display:grid;gap:8px;line-height:1.55}.ai-md p{margin:0}.ai-md ul,.ai-md ol{margin:0;padding-left:20px;display:grid;gap:3px}
  .ai-sum{font-size:1.04em;padding:10px 14px;border-radius:12px;background:color-mix(in srgb,var(--accent,#3b82f6) 10%,transparent);border:1px solid color-mix(in srgb,var(--accent,#3b82f6) 30%,transparent)}
  .ai-neg{color:#1f9d5c;font-weight:700}.ai-pos{color:#d64545;font-weight:700}
  .ai-vd{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}
  .ai-vc{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:12px;background:var(--soft,#eef2f7);border:1px solid var(--line,#e3e7ee)}
  .ai-vc .objm-th{float:none;margin:0}.ai-vc i{display:block;font-style:normal;font-size:12px;color:var(--muted,#6b7280)}.ai-vc b span{font-weight:800;white-space:nowrap}
  .ai-vc.ok b span,.ai-bd.ok{color:#1f9d5c}.ai-vc.bad b span,.ai-bd.bad{color:#d64545}.ai-vc.mid b span,.ai-bd.mid{color:#b7860b}
  .ai-bars{display:grid;gap:10px;max-width:820px;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#e3e7ee)}
  .ai-bar{display:grid;grid-template-columns:minmax(150px,240px) 1fr 64px;gap:12px;align-items:center}.ai-bo,.ai-to{display:flex;gap:8px;align-items:center;line-height:1.25}
  .ai-bo .objm-th,.ai-to .objm-th,.ai-sec summary .objm-th{float:none;margin:0;flex:none}.ai-bo small,.ai-to small{display:block;color:var(--muted,#6b7280);font-size:12px}
  .ai-sc{position:relative;height:22px;border-radius:7px;background:linear-gradient(90deg,rgba(31,157,92,.2),rgba(183,134,11,.12) 50%,rgba(214,69,69,.2))}
  .ai-sc .ai-mid{position:absolute;left:50%;top:-3px;bottom:-3px;width:2px;background:var(--text,#121722);opacity:.45}
  .ai-dot{position:absolute;top:50%;width:16px;height:16px;border-radius:50%;transform:translate(-50%,-50%);border:3px solid var(--card,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.15)}
  .ai-dot.ok{background:#1f9d5c}.ai-dot.bad{background:#d64545}.ai-dot.mid{background:#e0a400}
  .ai-bd{display:inline-block;font-weight:800;white-space:nowrap;padding:1px 8px;border-radius:99px;background:var(--soft,#eef2f7)}.ai-leg{font-size:12px;color:var(--muted,#6b7280)}
  .ai-tw{overflow-x:auto;container-type:inline-size}.ai-t{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px;border:1px solid var(--line,#e3e7ee);border-radius:12px;overflow:hidden}
  .ai-t th{background:var(--soft,#eef2f7);color:var(--muted,#6b7280);font-weight:600;font-size:12px;text-align:left;padding:7px 10px;text-transform:uppercase;letter-spacing:.02em}
  .ai-t td{padding:8px 10px;border-top:1px solid var(--line,#e3e7ee);vertical-align:middle}.ai-t .r{text-align:right;white-space:nowrap}
  @container (max-width:620px){.ai-cmp thead{display:none}.ai-cmp,.ai-cmp tbody,.ai-cmp tr,.ai-cmp td{display:block}.ai-cmp tr{padding:8px 10px;border-top:1px solid var(--line,#e3e7ee)}.ai-cmp tr:first-child{border-top:0}
    .ai-cmp td{border:0;padding:2px 0;text-align:left!important;white-space:normal!important;display:flex;justify-content:space-between;gap:10px}.ai-cmp td:first-child{display:block;margin-bottom:4px}
    .ai-cmp td:not(:first-child)::before{content:attr(data-l);color:var(--muted,#6b7280);font-size:12px}}
  @media (max-width:560px){.ai-bar{grid-template-columns:1fr 58px}.ai-bo{grid-column:1/-1}}
  .ai-sec{border:1px solid var(--line,#e3e7ee);border-radius:12px;padding:8px 12px;background:var(--card,transparent)}.ai-sec summary{cursor:pointer;display:flex;gap:10px;align-items:center;font-weight:600;list-style:none}
  .ai-sec summary::-webkit-details-marker{display:none}.ai-sec summary::after{content:'▾';margin-left:auto;color:var(--muted,#6b7280)}.ai-sec:not([open]) summary::after{content:'▸'}
  .ai-sb{display:grid;gap:6px;margin-top:8px}.ai-pl::before{content:'＋ ';color:#1f9d5c;font-weight:800}.ai-mn::before{content:'− ';color:#d64545;font-weight:800}
  .ai-md .objm-th{display:inline-block;width:56px;height:42px;overflow:hidden;border-radius:7px;background:var(--soft,#eef2f7);cursor:pointer;vertical-align:middle}.ai-md .objm-th img{display:block;width:100%;height:calc(100% / .95);object-fit:cover;object-position:center top}
  .s-an{margin:14px 0;padding:14px 16px;border-radius:16px;border:1px solid var(--line,#e3e7ee);background:var(--card,#fff)}.s-an h2{font-size:18px;margin:0 0 10px}.s-an-hl{outline:3px solid #f5b301;outline-offset:3px;transition:outline-color .4s}
  .s-an-box{border:1px solid var(--line,#e3e7ee);border-radius:12px;padding:10px 12px;margin:8px 0;background:color-mix(in srgb,var(--accent,#3b82f6) 6%,transparent)}.s-an-d summary{cursor:pointer;color:var(--link,#1f6fb2);margin-top:6px}
  .s-an-d textarea{width:100%;box-sizing:border-box;margin-top:6px;font:13px/1.45 ui-monospace,Menlo,monospace}.s-an-pv{margin-top:8px;max-height:420px;overflow:auto}
  .ai-lk,.ai-q{position:relative;cursor:copy;border-left:4px solid var(--accent,#3b82f6);background:color-mix(in srgb,var(--accent,#3b82f6) 8%,transparent);border-radius:10px;padding:9px 12px;margin:0;transition:background .2s}
  .ai-lk{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.ai-lk code{font:13px/1.4 ui-monospace,Menlo,monospace;word-break:break-all;background:none;padding:0;flex:1 1 260px}
  .ai-lk:hover,.ai-q:hover{background:color-mix(in srgb,var(--accent,#3b82f6) 15%,transparent)}.ai-cp{font-size:12px;font-weight:600;color:var(--link,#1f6fb2);white-space:nowrap}
  .ai-q p{margin:0 0 4px}.ai-q .ai-cp{display:block;margin-top:4px}.ai-op{text-decoration:none;font-weight:700;padding:0 4px}.ai-copied{background:rgba(31,157,92,.18)!important}.ai-copied .ai-cp{color:#1f9d5c}
.ai-t tr.ai-top td{background:rgba(245,179,1,.10)}.ai-t tr.ai-top td:first-child{box-shadow:inset 4px 0 0 #f5b301}.ai-star{display:inline-block;font-size:11.5px;font-weight:800;color:#8a6200;background:rgba(245,179,1,.2);border-radius:99px;padding:1px 7px;margin-right:4px;white-space:nowrap}
  .ai-vc.ai-topc{border-color:#f5b301;box-shadow:0 0 0 1px #f5b301 inset}.ai-sec.ai-top{border-color:#f5b301;box-shadow:0 0 0 1px rgba(245,179,1,.6) inset}
  .ai-ag{padding:7px 10px;border-radius:9px;background:rgba(124,92,255,.10);border:1px dashed rgba(124,92,255,.45)}.ai-agsec{border-style:dashed;border-color:rgba(124,92,255,.55);background:rgba(124,92,255,.06)}.ai-agt{color:#7c5cff}
  .s-an-ag{margin-top:12px;border:1px dashed rgba(124,92,255,.55);border-radius:12px;padding:10px 12px;background:rgba(124,92,255,.06)}.s-an-ag summary{cursor:pointer;font-weight:700;color:#7c5cff;margin-bottom:6px}
  .ai-note{padding:10px 12px;border-radius:12px;background:rgba(224,164,0,.12);border:1px solid rgba(224,164,0,.35)}`;
  const st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);
  document.addEventListener('click', e => {
    const b = e.target.closest?.('.ai-lk, .ai-q'); if (!b || e.target.closest('.ai-op, a.objlink')) return;
    const t = b.dataset.copy || ''; if (!t) return;
    const ok = () => { const c = b.querySelector('.ai-cp'), was = c?.textContent; b.classList.add('ai-copied'); if (c) c.textContent = '✓ Скопировано'; setTimeout(() => { b.classList.remove('ai-copied'); if (c) c.textContent = was; }, 1600); };
    (navigator.clipboard?.writeText(t) ?? Promise.reject()).then(ok, () => { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch { /* */ } a.remove(); });
  });
  // v5.58e: та же разбивка, что на сервере (selection-edits.ts splitAnalysis): клиенту / «🔒 для агента»
  const AGENT_HEAD = /🔒|отбраковк|для агента|агенту|торг|переговор|что предлагаю дальше|предлагаю дальше|следующ(?:ие|ий) шаг/i;
  const AGENT_LINE = /^\s*(?:[-*•]\s*)?🔒|^\s*(?:\*\*)?(?:Что предлагаю дальше|Предлагаю дальше|Можно дальше)|объясняйте|не показыва|показывать не перв|отсека(?:ть|йте)|аргумент (?:в|для) торг|для вас как агента|клиенту не говор|комисси/i;
  const split = t => { const cl = [], ag = []; let inA = false;
    for (const l of String(t ?? '').replace(/\r/g, '').split('\n')) { const h = /^\s*#{1,6}\s+(.*)/.exec(l) || /^\s*\*\*([^*]{3,80})\*\*\s*:?\s*$/.exec(l); if (h) inA = AGENT_HEAD.test(h[1]);
      (inA || AGENT_LINE.test(l) ? ag : cl).push(inA || AGENT_LINE.test(l) ? l.replace(/^(\s*(?:[-*•]\s*)?)🔒\s*/, '$1') : l); }
    return { client: cl.join('\n').trim(), agent: ag.join('\n').trim() }; };
  window.AIMD = { md, split };
})();

// «Сделка» (v5.15, п. 1): список сделок, карточка — объект, вид и расчёт, этап, участники, чек-лист документов и проверок собственника
// (база знаний с сервера, deal_kb), опрос перед чатом, два чата (с клиентом и без), приглашение брокера, помощь ИИ 2 раза в сутки.
// На каждом экране — красная звёздочка: проверка реального юриста и ипотечного брокера. Сервер — hub/deal.ts, база знаний — hub/kb.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  let kb = null, el = null, cur = null;
  const opt = (list, v) => list.map(x => `<option value="${x.id}"${x.id === v ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const optMap = (m, v) => Object.entries(m).map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('');

  async function open(arg, ctx) {
    el = ctx.el;
    kb ??= await H.call('deal_kb');
    if (!kb.can) { el.innerHTML = H.locked('Сделка', 'Вкладка «Сделка» — в тарифах PRO и MAX со второго оплаченного месяца: карточка сделки, документы и проверки по виду сделки, чаты с участниками, помощь ИИ-юриста и ипотечного брокера.') + kbHtml(); return; }
    if (arg?.startsWith('new')) { const num = arg.split(':')[1]; const r = await H.call('deal_save', { title: num ? `Объект № ${num}` : 'Новая сделка', num: num ? +num : undefined }); location.hash = `deal=${r.deal.id}`; return; }
    if (arg) return card(+arg);
    const r = await H.call('deal_list');
    el.innerHTML = `<h2>📑 Сделки</h2>${H.star()}
      <p><button class="btn primary" data-new>＋ Новая сделка</button> <span class="hint">Объект можно отправить в сделку и с карточки объявления — кнопка «📑 В сделку».</span></p>
      <div class="hub-rows">${r.deals.map(d => `<a class="hub-row" href="#deal=${d.id}"><b>${esc(d.title)}</b><small>${esc(kb.kinds.find(k => k.id === d.kind)?.name ?? '')} · ${esc(r.stages[d.stage])} · ${H.when(d.updated_at)}</small></a>`).join('') || '<p class="muted">Сделок пока нет.</p>'}</div>
      <details class="hub-kb"><summary>📚 База знаний: виды сделок, расчёты, проверка собственника</summary>${kbHtml()}</details>`;
    el.onclick = async e => { if (e.target.closest('[data-new]')) location.hash = 'deal=new'; };
  }
  function kbHtml() {
    return `<div class="hub-kbw">${kb.kinds.map(k => `<details><summary><b>${esc(k.name)}</b> — ${esc(k.when)}</summary>
      <p><b>Этапы:</b></p><ol>${k.stages.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p><b>Документы продавца:</b></p><ul>${k.seller.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <p><b>Документы покупателя:</b></p><ul>${k.buyer.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <p><b>Риски:</b> ${k.risks.map(esc).join('; ')}</p>${k.terms ? `<p class="hint">${esc(k.terms)}</p>` : ''}</details>`).join('')}
      <h3>Способы расчёта</h3>${kb.pay.map(p => `<p><b>${esc(p.name)}</b>${p.op ? ' <span class="hub-op">💡 мнение</span>' : ''} — ${esc(p.how)}${p.opinion ? `<br><i>${esc(p.opinion)}</i>` : ''}</p>`).join('')}
      <h3>Проверка собственника</h3><ul>${kb.checks.map(c => `<li>${esc(c.name)} — ${esc(c.where)}${c.url ? ` · <a href="${esc(c.url)}" target="_blank" rel="noopener">сайт</a>` : ''}</li>`).join('')}</ul>${H.star()}</div>`;
  }

  async function card(id) {
    const r = await H.call('deal_get', { id });
    cur = r;
    const d = r.deal, k = kb.kinds.find(x => x.id === d.kind) ?? kb.kinds[0], ch = d.checklist ?? {};
    const box = (key, text) => `<label class="hub-chk"><input type="checkbox" data-ck="${esc(key)}"${ch[key] ? ' checked' : ''}> ${esc(text)}</label>`;
    const o = r.object;
    el.innerHTML = `<p><a class="btn ghost" href="#deal">‹ Все сделки</a></p>
      <h2>📑 ${esc(d.title)}</h2>${H.star()}
      <section class="hub-sec"><div class="hub-form">
        <label class="field">Название<input id="d-title" value="${esc(d.title)}" maxlength="120"></label>
        <label class="field">Вид сделки<select id="d-kind">${opt(kb.kinds, d.kind)}</select></label>
        <label class="field">Расчёт<select id="d-pay">${opt(kb.pay, d.pay)}</select></label>
        <label class="field">Этап<select id="d-stage">${optMap(kb.stages, d.stage)}</select></label>
        <label class="field hub-wide">Заметки<textarea id="d-note" rows="2" maxlength="4000">${esc(d.note ?? '')}</textarea></label></div>
        <p class="hint">Объект: ${o ? `${esc([o.rooms ? `${o.rooms}-комн.` : '', o.kind ?? o.type_name ?? '', o.area ? `${o.area} м²` : '', o.complex ?? '', o.sub ?? o.district ?? '', o.address ?? ''].filter(Boolean).join(', '))}${o.num ? ` · № ${o.num}` : ''}` : 'не выбран — отправьте объект в сделку с карточки объявления или эксклюзива'}</p>
        <p class="hub-actions"><button class="btn primary" data-save>Сохранить</button>
          ${o?.num ? `<a class="btn soft" href="./#o=${o.num}" target="_blank">Открыть объект</a><button class="btn soft" data-rk="${o.num}">📣 На рекламу</button>` : ''}
          <button class="btn soft" data-invite>🏦 Позвать ипотечного брокера</button><button class="btn ghost bad" data-del>Удалить сделку</button></p></section>

      <section class="hub-sec"><h3>✅ Документы и проверки — ${esc(k.name)}</h3>
        <div class="hub-cols"><div><b>Продавец</b>${k.seller.map((s, i) => box(`s${i}`, s)).join('')}</div><div><b>Покупатель</b>${k.buyer.map((s, i) => box(`b${i}`, s)).join('')}</div>
        <div><b>Проверка собственника</b>${kb.checks.map(c => box(`c_${c.id}`, `${c.name} — ${c.where}`)).join('')}</div></div>
        <p><b>Этапы:</b> ${k.stages.map((s, i) => `${i + 1}. ${esc(s)}`).join(' → ')}</p><p class="hint">Риски: ${k.risks.map(esc).join('; ')}</p>
        ${r.docs_on ? '' : '<p class="hint">📎 Загрузка документов сделки (паспорта, ЕГРН) включится после переноса хранения в Россию (152-ФЗ). Сейчас отмечайте, что собрано.</p>'}</section>

      <section class="hub-sec"><h3>👥 Участники</h3><div id="d-people">${(r.people.length ? r.people : [{ role: 'agent', name: '' }]).map(personRow).join('')}</div>
        <p><button class="btn ghost" data-add-p>＋ Участник</button> <button class="btn soft" data-save-p>Сохранить участников</button></p></section>

      <section class="hub-sec"><h3>💬 Чат по сделке</h3><p class="hint">Перед созданием чата ответьте на вопросы — по ним составим список необходимого для сделки.</p>
        ${kb.questions.map(q => `<label class="field">${esc(q.q)}<textarea data-q="${q.id}" rows="2" maxlength="1000">${esc(d.answers?.[q.id] ?? '')}</textarea></label>`).join('')}
        <p><button class="btn primary" data-chat>Создать 2 чата: с клиентом и без</button></p><div id="d-chat"></div></section>

      <section class="hub-sec"><h3>🧑‍⚖️ Помощь юриста и ипотечного брокера (ИИ)</h3>
        <p class="hint">${r.ai.used} из ${r.ai.lim} за сегодня. Опишите очень подробно, что нужно решить: что обсудили на переговорах, какие вопросы остались, какие документы есть.</p>
        <div class="hub-msgs">${r.msgs.map(m => `<div class="hub-msg ${m.role}">${esc(m.text).replace(/\n/g, '<br>')}</div>`).join('')}</div>
        <textarea id="d-ai" rows="4" maxlength="6000" placeholder="Например: продавец получил квартиру по наследству 2 года назад, есть второй наследник-брат, который отказался… Покупатель берёт ипотеку в банке… Что проверить и какие документы собрать?"></textarea>
        <p><button class="btn primary" data-ai>Спросить</button></p>${H.star()}</section>`;
    el.onclick = onClick;
  }
  const personRow = p => `<div class="hub-person"><input placeholder="Имя" data-pn value="${esc(p.name ?? '')}" maxlength="80"><input placeholder="Телефон" data-pp value="${esc(p.phone ? '+' + p.phone : '')}" inputmode="tel" maxlength="20">
    <select data-pr>${optMap(kb.roles, p.role ?? 'client')}</select><button class="btn ghost" data-rm-p aria-label="Убрать">✕</button></div>`;

  async function onClick(e) {
    const t = e.target, d = cur.deal;
    if (t.closest('[data-save]')) {
      const checklist = Object.fromEntries([...el.querySelectorAll('[data-ck]')].map(x => [x.dataset.ck, x.checked]));
      try { await H.call('deal_save', { id: d.id, title: el.querySelector('#d-title').value, kind: el.querySelector('#d-kind').value, pay: el.querySelector('#d-pay').value,
        stage: el.querySelector('#d-stage').value, note: el.querySelector('#d-note').value, checklist }); H.toast('Сохранено'); card(d.id); } catch (er) { H.toast(er.message, 5000); }
      return;
    }
    if (t.closest('[data-del]')) { if (!confirm('Удалить сделку? Участники, заметки и ответы ИИ удалятся.')) return; await H.call('deal_del', { id: d.id }); location.hash = 'deal'; return; }
    if (t.closest('[data-add-p]')) { el.querySelector('#d-people').insertAdjacentHTML('beforeend', personRow({ role: 'client' })); return; }
    if (t.closest('[data-rm-p]')) { t.closest('.hub-person').remove(); return; }
    if (t.closest('[data-save-p]')) {
      const people = [...el.querySelectorAll('.hub-person')].map(x => ({ name: x.querySelector('[data-pn]').value, phone: x.querySelector('[data-pp]').value, role: x.querySelector('[data-pr]').value }));
      try { await H.call('deal_people', { deal_id: d.id, people }); H.toast('Участники сохранены'); } catch (er) { H.toast(er.message, 5000); } return;
    }
    if (t.closest('[data-rk]')) { try { localStorage.setItem('sel', JSON.stringify([+t.closest('[data-rk]').dataset.rk])); } catch { /* */ } location.href = './#rk'; return; }
    if (t.closest('[data-invite]')) {
      try { const r = await H.call('deal_invite', { deal_id: d.id, role: 'broker' });
        el.querySelector('#d-chat').insertAdjacentHTML('afterbegin', `<div class="hub-note"><b>Ссылка для ипотечного брокера</b> (14 дней): <input readonly value="${esc(r.link)}"> <button class="btn soft" data-copy="${esc(r.text)}">Скопировать с текстом</button><p class="hint">${esc(r.note)}</p></div>`);
        el.querySelector('#d-chat').scrollIntoView({ behavior: 'smooth' }); } catch (er) { H.toast(er.message, 5000); } return;
    }
    const cp = t.closest('[data-copy]'); if (cp) return H.copy(cp.dataset.copy);
    if (t.closest('[data-chat]')) {
      const answers = Object.fromEntries([...el.querySelectorAll('[data-q]')].map(x => [x.dataset.q, x.value]));
      try {
        await H.call('deal_save', { id: d.id, answers });
        const r = await H.call('deal_chat', { deal_id: d.id });
        const chatBox = c => `<div class="hub-note"><b>${esc(c.title)}</b><textarea rows="8" readonly>${esc(c.text)}</textarea>
          <p><button class="btn soft" data-copy="${esc(c.text)}">Скопировать первое сообщение</button> <a class="btn soft" href="${esc(c.tg)}" target="_blank" rel="noopener">Telegram</a></p>
          ${c.people.length ? `<p class="hint">Участники: ${c.people.map(p => `${esc(p.name)} (${esc(p.role)})${p.wa ? ` <a href="${esc(p.wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`).join(' · ')}</p>` : '<p class="hint">Добавьте участников с телефонами — появятся кнопки.</p>'}</div>`;
        el.querySelector('#d-chat').innerHTML = chatBox(r.client) + chatBox(r.inner) + `<p class="hint">${esc(r.note)}</p>`;
      } catch (er) { H.toast(er.message, 5000); } return;
    }
    if (t.closest('[data-ai]')) {
      const b = t.closest('[data-ai]'), text = el.querySelector('#d-ai').value;
      b.disabled = true; b.textContent = 'Думаю… ~20–40 с';
      try { const r = await H.call('deal_ai', { deal_id: d.id, text }); el.querySelector('.hub-msgs').insertAdjacentHTML('beforeend', `<div class="hub-msg user">${esc(text)}</div><div class="hub-msg ai">${esc(r.answer).replace(/\n/g, '<br>')}</div>`);
        el.querySelector('#d-ai').value = ''; } catch (er) { H.toast(er.message, 6000); }
      b.disabled = false; b.textContent = 'Спросить'; return;
    }
  }
  // гость по ссылке — ипотечный брокер или юрист (без входа): hub.html#deal-guest=<токен>
  async function guest(token, ctx) {
    const r = await H.call('deal_guest', { t: token });
    ctx.el.innerHTML = `<h2>📑 ${esc(r.title)}</h2><p class="hint">Вы приглашены как ${esc(r.role)}. Этап: ${esc(r.stage)}.</p>${H.star()}
      <h3>Документы продавца</h3><ul>${r.kind.seller.map(s => `<li>${esc(s)}</li>`).join('')}</ul><h3>Документы покупателя</h3><ul>${r.kind.buyer.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <h3>Этапы</h3><ol>${r.kind.stages.map(s => `<li>${esc(s)}</li>`).join('')}</ol><p class="hint">С банком сервис не связан — документы в банк загружаете вы.</p>`;
  }
  window.SEC = window.SEC || {};
  window.SEC.deal = { title: 'Сделки', open };
  window.SEC['deal-guest'] = { title: 'Сделка', open: guest, public: true };
})();

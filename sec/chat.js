// Чат подписчиков (v5.15, п. 5): ничего не грузится, пока не нажали «Открыть чат»; дальше — опрос раз в 5 с, пока чат открыт и вкладка видна.
// Срочное объявление — 1 USDT (оплата на pay.html, после оплаты публикуется и закрепляется). Мат и оскорбления — 1 замечание,
// второе — отключение на месяц, третье — бан навсегда. «Пожаловаться» — модератору. Админ — раздел модерации здесь же.
(() => {
  const H = window.HUB, esc = H.esc;
  let el = null, last = 0, timer = null, caps = null;
  const RULES = 'Правила чата: по делу — объекты, покупатели, вопросы коллегам. Мат и оскорбления запрещены: 1-е нарушение — замечание, 2-е — отключение на месяц, 3-е — бан в чате навсегда. Реклама и повторы — только «Срочным объявлением».';
  async function open(arg, ctx) {
    el = ctx.el; caps = ctx.caps;
    stop();
    el.innerHTML = `<h2>💬 Чат подписчиков</h2><p class="hint">${esc(RULES)}</p><p><button class="btn primary" data-open>Открыть чат</button>${caps?.admin ? ' <button class="btn ghost" data-mod>🛡 Модерация</button>' : ''}</p>`;
    el.onclick = e => { if (e.target.closest('[data-open]')) start(); if (e.target.closest('[data-mod]')) mod(); };
    addEventListener('hashchange', stop, { once: true });
  }
  const msg = m => `<div class="chat-m${m.mine ? ' mine' : ''}${m.urgent ? ' urgent' : ''}" data-id="${m.id}"><b>${esc(m.name)}</b> <small class="muted">${H.when(m.at)}</small>${m.urgent ? ' <span class="chat-u">⚡ Срочно</span>' : ''}
    <p>${esc(m.text).replace(/\n/g, '<br>')}</p>${m.mine ? '<button class="btn ghost" data-del>Удалить</button>' : '<button class="btn ghost" data-rep>Пожаловаться</button>'}</div>`;
  async function start() {
    const r = await H.call('chat_list', {});
    last = r.items.at(-1)?.id ?? 0;
    el.innerHTML = `<h2>💬 Чат подписчиков</h2>
      ${r.pins.length ? `<div class="chat-pins">${r.pins.map(msg).join('')}</div>` : ''}
      <div class="chat-box" id="ch-box">${r.items.map(msg).join('') || '<p class="muted">Сообщений пока нет — напишите первым.</p>'}</div>
      ${r.me.blocked ? `<p class="err">${esc(r.me.blocked)}</p>` : `<p class="hint">${esc(RULES)}${r.me.strikes ? ` У вас замечаний: ${r.me.strikes}.` : ''}</p>
      <form id="ch-f" class="chat-f"><textarea id="ch-t" rows="2" maxlength="1000" placeholder="Сообщение коллегам" aria-label="Сообщение"></textarea>
        <div><button class="btn primary">Отправить</button> <label class="hub-chk"><input type="checkbox" id="ch-u"> ⚡ Срочное объявление — ${H.rub(r.urgent_usd) || ''} (${r.urgent_usd} USDT), закреп на ${r.urgent_hours} ч</label></div></form>`}`;
    const box = el.querySelector('#ch-box'); box.scrollTop = box.scrollHeight;
    el.onsubmit = async e => {
      e.preventDefault();
      const t = el.querySelector('#ch-t'), urgent = el.querySelector('#ch-u').checked;
      try { const x = await H.call('chat_send', { text: t.value, urgent }); t.value = '';
        if (x.pay) { if (!(await H.rules())) return; location.href = x.pay.url; return; }
        poll(); } catch (er) { H.toast(er.message, 7000); }
    };
    el.onclick = async e => {
      const m = e.target.closest('[data-id]');
      if (e.target.closest('[data-rep]')) { const reason = prompt('Что не так с сообщением?') ?? ''; try { const x = await H.call('chat_report', { id: +m.dataset.id, reason }); H.toast(x.message); } catch (er) { H.toast(er.message); } }
      if (e.target.closest('[data-del]')) { await H.call('chat_del', { id: +m.dataset.id }); m.remove(); }
    };
    timer = setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 5000);
  }
  async function poll() {
    try {
      const r = await H.call('chat_list', { after: last });
      if (!r.items.length) return;
      const box = el.querySelector('#ch-box'); if (!box) return stop();
      const atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 40;
      box.querySelector('.muted')?.remove();
      box.insertAdjacentHTML('beforeend', r.items.map(msg).join(''));
      last = r.items.at(-1).id;
      if (atEnd) box.scrollTop = box.scrollHeight;
    } catch { /* следующая попытка через 5 с */ }
  }
  function stop() { clearInterval(timer); timer = null; }
  async function mod() {
    const r = await H.call('chat_adm');
    el.innerHTML = `<p><button class="btn ghost" data-back>‹ Чат</button></p><h2>🛡 Модерация чата</h2>
      <h3>Жалобы</h3>${r.reports.map(x => `<div class="hub-row" data-r="${x.id}"><b>${esc(x.chat_msgs?.name ?? '')}</b>: ${esc(x.chat_msgs?.text ?? '')}<small class="muted">жалоба ${esc(x.by_login)}: ${esc(x.reason ?? '')}</small>
        <span class="hub-inline"><button class="btn primary" data-do="strike">Нарушение</button><button class="btn ghost" data-do="ok">Всё в порядке</button></span></div>`).join('') || '<p class="muted">Жалоб нет</p>'}
      <h3>Наказания</h3>${r.strikes.map(s => `<div class="hub-row"><b>${esc(s.login)}</b> — ${s.n} ${s.banned ? '· бан навсегда' : s.muted_until ? `· отключён до ${H.day(s.muted_until)}` : ''}<small>${esc(s.last_text ?? '')}</small><button class="btn ghost" data-reset="${esc(s.login)}">Снять</button></div>`).join('') || '<p class="muted">Нет</p>'}`;
    el.onclick = async e => {
      if (e.target.closest('[data-back]')) return open('', { el, caps });
      const d = e.target.closest('[data-do]'); if (d) { await H.call('chat_adm_decide', { id: +d.closest('[data-r]').dataset.r, do: d.dataset.do }); mod(); }
      const rs = e.target.closest('[data-reset]'); if (rs && confirm('Снять все замечания и бан?')) { await H.call('chat_adm_reset', { login: rs.dataset.reset }); mod(); }
    };
  }
  window.SEC = window.SEC || {};
  window.SEC.chat = { title: 'Чат подписчиков', open };
})();

// «Мессенджеры и соцсети» (v5.16, пп. 5–6): живой вход — на нашем сервере открывается настоящий браузер, вы видите его экран здесь и входите сами
// (QR-код, номер и код, пароль) — без ключей API. Сессия хранится на нашем сервере в зашифрованном виде и используется только для ваших действий
// (рассылки, чаты по сделке, сообщения собственникам, публикация роликов). Окно входа — conn.js, сервер — auto/conn.ts и worker/conn.ts.
// ДомКлик (реклама) — свой вход по СМС в разделе «📣 Реклама» (браузер-робот площадка не пускает).
(() => {
  const H = window.HUB, esc = H.esc;
  const USE = { tg: 'рассылки в группы, чаты по сделке, сообщения собственникам', max: 'чаты по сделке, сообщения собственникам', wa: 'сообщения собственникам и клиентам, чаты по сделке',
    ig: 'публикация роликов (Reels)', yt: 'публикация роликов (Shorts)', vk: 'публикация роликов (Клипы) и постов' };
  let el = null;
  async function open(arg, ctx) {
    el = ctx.el;
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    let r;
    try { r = await CONN.call('conn_init'); } catch (e) { el.innerHTML = e.code === 'need_pro' ? H.locked('Мессенджеры и соцсети', 'Подключение мессенджеров — для участников с действующим доступом') : `<p class="err">${esc(e.message)}</p>`; return; }
    const st = x => x.status === 'ok' ? `<span class="st ok">✅ Подключено${x.acc_name ? `: ${esc(x.acc_name)}` : ''}${x.ok_at ? ` · ${H.when(x.ok_at)}` : ''}</span>`
      : x.status === 'need' ? '<span class="st err">⚠ Вход закончился — войдите снова</span>'
      : x.status === 'error' ? `<span class="st err">${esc(x.message ?? 'Вход не удался')}</span>`
      : ['start', 'live'].includes(x.status) ? '<span class="st">⏳ Идёт вход…</span>' : '<span class="st muted">Не подключено</span>';
    el.innerHTML = `<h2>🔗 Мессенджеры и соцсети</h2>
      <p class="hint">Вход — как в обычном браузере: на нашем сервере открывается настоящая страница сервиса, вы видите её здесь и входите сами (QR-код, номер и код, пароль). Ключи API не нужны.
      Сессия хранится на нашем сервере <b>в зашифрованном виде</b> и используется только для ваших действий. Отключить — кнопкой «Отключить» здесь.</p>
      <p class="conn-srv${r.online ? ' on' : ''}"><i></i>${r.online ? 'Сервер подключений на связи' : 'Сервер подключений сейчас не на связи — вход временно недоступен'}</p>
      <div class="conn-list">${r.items.map(x => `<div class="conn-card"><h3>${x.icon} ${esc(x.name)}</h3>${st(x)}
        <small class="muted">Для чего: ${esc(USE[x.id] ?? '')}</small><small>${esc(x.note)}</small>
        <div class="row">${x.status === 'ok' ? `<button class="btn soft" data-in="${x.id}">Войти заново</button><button class="btn ghost bad" data-out="${x.id}">Отключить</button>`
          : `<button class="btn primary" data-in="${x.id}"${r.online ? '' : ' disabled'}>Войти</button>`}${x.id === 'tg' && x.status === 'ok' ? '<a class="btn soft" href="mail.html">✉️ Рассылки</a>' : ''}</div></div>`).join('')}
        <div class="conn-card"><h3>🏠 ДомКлик (реклама)</h3><span class="st muted">Вход по СМС</span><small class="muted">Для чего: черновики объявлений в вашем кабинете партнёра</small>
          <small>Вход — номер телефона и код из СМС в разделе «📣 Реклама».</small><div class="row"><a class="btn primary" href="./#rk=login">Войти</a></div></div></div>
      <p class="hint">⚠ WhatsApp и Instagram не разрешают сторонние программы официально — используйте рабочие аккаунты. Telegram: завершить сеанс можно и в самом Telegram → Настройки → Устройства.</p>`;
    el.onclick = async e => {
      const i = e.target.closest('[data-in]'), o = e.target.closest('[data-out]');
      if (i) { const x = r.items.find(y => y.id === i.dataset.in); CONN.open(x.id, { title: `${x.icon} Вход: ${x.name}`, onOk: () => setTimeout(() => open(arg, ctx), 2600), onClose: () => open(arg, ctx) }); }
      if (o) { if (!confirm('Отключить и удалить сессию с нашего сервера?')) return; try { const z = await CONN.call('conn_logout', { svc: o.dataset.out }); H.toast(z.note ?? 'Отключено', 7000); open(arg, ctx); } catch (er) { H.toast(er.message, 5000); } }
    };
    if (arg && r.items.some(x => x.id === arg) && !r.items.find(x => x.id === arg && x.status === 'ok') && r.online) el.querySelector(`[data-in="${arg}"]`)?.click();
  }
  window.SEC = window.SEC || {};
  window.SEC.msg = { title: 'Мессенджеры и соцсети', open };
})();

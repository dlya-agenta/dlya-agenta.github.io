// Профиль участника (ТЗ v2, шаг 2.1) — окно из шапки (нажатие на имя): тариф и срок, номера, имя, телефон, мессенджеры, агентство, «О себе»,
// соцсети (тариф MAX — для продающих роликов позже), активные устройства с кнопкой «Выйти».
// Кошельки для выплат (шаг 3.1) и «Привязать Telegram» (шаг 3.2) — места под них.
window.PROFILE = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—';
  const when = s => s ? new Date(s).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  let ui = null;   // { call, sheet, toast, logout, saved }

  const devs = list => list.length ? list.map(x => `<div class="opt dev"><span><b>${esc(x.label)}</b>${x.me ? ' <span class="tag ok">Это устройство</span>' : ''}<br>
      <small class="muted">вход ${when(x.created_at)} · в сети ${when(x.last_seen)}</small></span>
      <button class="btn ghost" data-out="${esc(x.id)}" data-me="${x.me ? 1 : ''}">Выйти</button></div>`).join('')
    : '<p class="muted">Активных входов нет.</p>';

  async function open() {
    ui.sheet('Профиль', '<p class="muted">Загрузка…</p>');
    let r;
    try { r = await ui.call('profile'); } catch (e) { $('#sheet-body').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    const p = r.profile ?? {}, u = r.used;
    $('#sheet-body').innerHTML = `
      <div class="prof-plan">
        <div><small class="muted">Тариф</small><b>${esc(r.plan_name)}</b></div>
        <div><small class="muted">Доступ до</small><b>${r.role === 'admin' ? 'без срока' : day(r.expires_at)}</b></div>
        ${u ? `<div><small class="muted">Номера сегодня</small><b>${u.day}${u.day_lim != null ? ` из ${u.day_lim}` : ''}</b></div>
          <div><small class="muted">Номера за месяц</small><b>${u.month}${u.month_lim != null ? ` из ${u.month_lim}` : ''}</b></div>` : ''}
      </div>
      ${u ? `<p class="hint">Месяц номеров: ${day(r.month_start)} — ${day(r.month_end)}${r.packs ? ` · с пакетами +${r.packs}` : ''}. День — с 00:00 МСК. Повтор того же номера — бесплатно.</p>` : ''}
      ${r.role !== 'admin' ? `<div class="sheet-foot"><button class="btn soft" data-pro-open>${r.plan === 'max' ? 'Тарифы' : 'Что даёт PRO'}</button>${u ? '<button class="btn ghost" data-pack>Докупить номера</button>' : ''}</div>` : ''}
      <form id="prof" class="prof-form">
        <label class="field">Имя<input name="name" value="${esc(r.name)}" maxlength="80" required autocomplete="name"></label>
        <label class="field">Телефон<input name="phone" type="tel" value="${esc(r.phone)}" maxlength="30" placeholder="+7 918 123-45-67" autocomplete="tel"></label>
        <label class="field">WhatsApp<input name="whatsapp" type="tel" value="${esc(p.whatsapp)}" maxlength="30" placeholder="если номер другой"></label>
        <label class="field">Telegram<input name="telegram" value="${esc(p.telegram)}" maxlength="64" placeholder="@имя"></label>
        <label class="field">MAX<input name="max" value="${esc(p.max)}" maxlength="64" placeholder="номер или имя в MAX"></label>
        <label class="field">Агентство<input name="agency" value="${esc(p.agency)}" maxlength="120" autocomplete="organization"></label>
        <label class="field wide">О себе<textarea name="about" rows="3" maxlength="1000" placeholder="Чем занимаетесь, районы, опыт">${esc(p.about)}</textarea></label>
        ${r.socials ? `<label class="field wide">Ссылки на соцсети — по одной в строке<textarea name="socials" rows="3" placeholder="https://vk.com/…">${esc((p.socials ?? []).join('\n'))}</textarea>
          <small class="muted">Тариф MAX: сюда будем публиковать продающие ролики из фото (скоро).</small></label>` : ''}
        <p class="err wide" id="prof-err"></p>
        <div class="sheet-foot wide"><span></span><button class="btn primary">Сохранить</button></div>
      </form>
      <div class="group">Активные устройства${r.max_devices ? ` — можно ${r.max_devices}` : ''}</div>
      <div id="devs">${devs(r.devices)}</div>
      ${r.max_devices ? `<p class="hint">${r.max_devices === 1 ? 'Вход на другом устройстве сразу выходит из этого.' : `Вход на ${r.max_devices + 1}-м устройстве выходит из самого старого.`}</p>` : ''}
      <div id="partner-box"></div>
      <div class="group">Кошельки для выплат</div>
      <p class="muted">Адреса кошельков для выплат по партнёрской программе — скоро.</p>
      <div class="group">Telegram</div>
      <p class="muted">${r.tg ? 'Telegram привязан.' : 'Привязка Telegram для уведомлений о задачах и оплате — скоро.'}</p>`;
    window.PARTNER?.mount($('#partner-box'), ui.toast);   // код партнёра (site/partner.js)
    $('#prof').onsubmit = async e => {
      e.preventDefault();
      const fm = e.target, btn = fm.querySelector('.btn.primary');
      btn.disabled = true; $('#prof-err').textContent = '';
      const profile = { whatsapp: fm.whatsapp.value, telegram: fm.telegram.value, max: fm.max.value, agency: fm.agency.value, about: fm.about.value,
        ...(fm.socials ? { socials: fm.socials.value.split(/\s+/).filter(Boolean) } : {}) };
      try { const x = await ui.call('profile_save', { name: fm.name.value, phone: fm.phone.value, profile }); ui.saved?.(x.name); ui.toast('Профиль сохранён'); }
      catch (err) { $('#prof-err').textContent = err.message; }
      btn.disabled = false;
    };
    $('#devs').onclick = async e => {
      const b = e.target.closest('[data-out]');
      if (!b) return;
      if (b.dataset.me && !confirm('Выйти на этом устройстве?')) return;
      b.disabled = true;
      try {
        const x = await ui.call('device_out', { id: b.dataset.out });
        if (x.me) return ui.logout();
        const d = await ui.call('devices');
        $('#devs').innerHTML = devs(d.items); ui.toast('Устройство вышло');
      } catch (err) { b.disabled = false; ui.toast(err.message); }
    };
  }

  return { use: deps => { ui = deps; }, open };
})();

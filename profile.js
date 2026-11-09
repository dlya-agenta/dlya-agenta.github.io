// Профиль участника (ТЗ v2, шаг 2.1) — окно из шапки (нажатие на имя): тариф и срок, номера, имя, телефон, мессенджеры, агентство, «О себе»,
// соцсети (тариф MAX — для продающих роликов позже), активные устройства с кнопкой «Выйти».
// v5.31c: блок «Оформление» (5 стилей кружками + светлая/тёмная/как в системе — design.js pickerHtml) и «🌐 Прокси» (окно proxy.js, открывает nav.js по [data-proxy]).
// Кошелёк для выплат и партнёрская программа (шаг 3.1) — блок site/partner.js. «Привязать Telegram» и уведомления в браузере (шаг 3.2) — site/notify.js.
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
      <div class="prof-photo" id="prof-photo">${photoBox(p.photo)}</div>
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
      <div class="group">Пароль</div>
      <form id="pw-form" class="prof-form">${r.has_pw ? '<label class="field">Старый пароль<input name="old" type="password" autocomplete="current-password" required></label>' : '<p class="hint wide">Пароля пока нет — вы входите через Telegram. Задайте пароль, чтобы входить на сайт и в браузере.</p>'}
        <label class="field">${r.has_pw ? 'Новый пароль' : 'Пароль'}<input name="password" type="password" minlength="6" autocomplete="new-password" required></label>
        <p class="err wide" id="pw-err"></p><div class="sheet-foot wide"><span></span><button class="btn soft">${r.has_pw ? 'Сменить пароль' : 'Задать пароль'}</button></div></form>
      <div class="group">Оформление</div>
      <div id="dz-box">${window.DESIGN?.pickerHtml ? window.DESIGN.pickerHtml() : ''}</div>
      <p class="hint">Стиль и тема — только у вас на этом устройстве. Тот же выбор — в меню под «Профилем» → «🎨 Стиль».</p>
      <div class="group agent-only">Свой прокси</div>
      <div class="agent-only prof-proxy"><button type="button" class="btn soft" data-proxy>🌐 Прокси для мессенджеров</button>
        <small class="muted">Свой постоянный адрес для WhatsApp, Telegram и MAX — чтобы вход не слетал.</small></div>
      <div class="group">Активные устройства${r.max_devices ? ` — можно ${r.max_devices}` : ''}</div>
      <div id="devs">${devs(r.devices)}</div>
      ${r.max_devices ? `<p class="hint">${r.max_devices === 1 ? 'Вход на другом устройстве сразу выходит из этого.' : `Вход на ${r.max_devices + 1}-м устройстве выходит из самого старого.`}</p>` : ''}
      <div id="partner-box"></div>
      <div class="group agent-only">Telegram</div>
      <div id="tg-box" class="agent-only"></div>
      <div class="group agent-only">Уведомления в этом браузере</div>
      <div id="push-box" class="agent-only"></div>
      ${r.role !== 'admin' && !r.main ? `<div class="group">Удаление профиля</div>
      <label class="field">Удалить автоматически, если я не захожу<select id="prof-autodel">
        ${[['', 'не удалять'], ['1', '1 месяц'], ['3', '3 месяца'], ['12', '12 месяцев']].map(([v, t]) => `<option value="${v}"${String(r.auto_del ?? '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <small class="muted">За 7 дней до удаления придёт предупреждение в Telegram и на сайт. Вход на сайт или в бот сбрасывает отсчёт.</small></label>
      <div class="prof-del" id="prof-del-box"><p class="hint">Удалится всё: учётка, клиенты и задачи, подборки, сделки, уведомления. Оплаченные дни не возвращаются. Зарегистрироваться заново можно, но пробный доступ второй раз не даётся.</p>
        <button type="button" class="btn ghost danger" id="prof-del">Удалить мой профиль</button></div>` : ''}`;
    window.NOTIFY?.tgBox($('#tg-box'), r.tg); window.NOTIFY?.pushBox($('#push-box'));
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
    $('#prof-del')?.addEventListener('click', () => delAsk(r.login));
    $('#pw-form').onsubmit = async e => {   // v5.46a: задать / сменить пароль
      e.preventDefault(); const fm = e.target; $('#pw-err').textContent = '';
      try { await ui.call('pw_change', { old: fm.old ? fm.old.value : null, password: fm.password.value }); ui.toast('Пароль сохранён'); fm.reset(); }
      catch (err) { $('#pw-err').textContent = err.message; }
    };
    $('#prof-autodel')?.addEventListener('change', async e => {   // v5.46a: автоудаление — сохраняется сразу, вместе с текущими именем и телефоном
      const fm = $('#prof');
      try { await ui.call('profile_save', { name: fm.name.value, phone: fm.phone.value, auto_del: e.target.value ? Number(e.target.value) : null });
        ui.toast(e.target.value ? `Автоудаление: через ${e.target.selectedOptions[0].textContent} без входа` : 'Автоудаление выключено'); }
      catch (err) { ui.toast(err.message, 5000); }
    });
    photoWire();
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

  // v5.46a (п. 23 Алексея): фото профиля по желанию — ужимаем в браузере до 512×512 JPEG и отправляем; «Убрать» удаляет файл
  const photoBox = url => `${url ? `<img src="${esc(url)}" alt="Фото профиля" width="72" height="72" loading="lazy">` : '<span class="prof-ph-empty" aria-hidden="true">👤</span>'}
    <span><label class="btn soft sm">${url ? 'Заменить фото' : 'Добавить фото'}<input type="file" accept="image/*" id="ph-file" hidden></label>
    ${url ? '<button type="button" class="btn ghost sm" id="ph-del">Убрать</button>' : ''}<small class="muted">По желанию: видно в шапке и клиентам в подборках.</small></span>`;
  async function shrink(file) {
    const img = await createImageBitmap(file), k = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    return new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  }
  function photoWire() {
    const set = url => { $('#prof-photo').innerHTML = photoBox(url); photoWire(); ui.photo?.(url); };
    $('#ph-file')?.addEventListener('change', async e => {
      const f = e.target.files?.[0]; if (!f) return;
      try { const r = await ui.call('profile_photo', { data: await shrink(f) }); set(r.photo); ui.toast('Фото сохранено'); }
      catch (err) { ui.toast(err.message || 'Фото не загрузилось', 5000); }
    });
    $('#ph-del')?.addEventListener('click', async () => {
      try { await ui.call('profile_photo_del'); set(''); ui.toast('Фото убрано'); } catch (err) { ui.toast(err.message, 5000); }
    });
  }
  // v5.46a (п. 18 Алексея): удалить свой профиль — сначала сервер считает, что удалится, потом ввод своего логина
  async function delAsk(login) {
    const box = $('#prof-del-box');
    let c; try { c = await ui.call('account_delete_check'); } catch (e) { return ui.toast(e.message, 5000); }
    box.innerHTML = `<p><b>Удалить профиль навсегда?</b> Записей: ${Number(c.rows) || 0}. Копия хранится 30 дней на случай ошибки, затем стирается.</p>
      <label class="field">Чтобы подтвердить, введите свой логин <b>${esc(login)}</b><input id="del-login" autocomplete="off" autocapitalize="none"></label>
      <p class="err" id="del-err"></p><div class="sheet-foot"><button type="button" class="btn ghost" id="del-no">Отмена</button><button type="button" class="btn danger" id="del-yes" disabled>Удалить навсегда</button></div>`;
    $('#del-login').oninput = e => { $('#del-yes').disabled = e.target.value.trim().toLowerCase() !== login; };
    $('#del-no').onclick = () => open();
    $('#del-yes').onclick = async () => {
      $('#del-yes').disabled = true;
      try { await ui.call('account_delete', { confirm: $('#del-login').value.trim().toLowerCase(), rows: c.rows }); ui.toast('Профиль удалён', 4000); ui.logout('Профиль удалён. Зарегистрироваться заново можно по коду партнёра.'); }
      catch (e) { $('#del-err').textContent = e.message; $('#del-yes').disabled = false; }
    };
  }

  return { use: deps => { ui = deps; }, open };
})();

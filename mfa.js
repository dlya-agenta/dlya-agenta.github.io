// Второй шаг входа администратора (ТЗ v2, шаг 2.4): после пароля — код из Telegram-бота (живёт 5 минут) или один из 10 запасных кодов.
// У каждого админа включается отдельно, в админ-панели; пока не включён — вход как раньше. ask — экран кода при входе, panel — блок в панели.
// Коды проверяет только сервер (функция web). Запасные коды он показывает один раз: здесь они только в памяти страницы, в браузере не сохраняются.
window.MFA = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const FIELD = 'name="code" autocomplete="one-time-code" autocapitalize="none" autocorrect="off" spellcheck="false" required';
  let ui = null, box = null;   // { call, toast, setToken } и блок в панели: панель перерисовывается целиком, блок каждый раз новый
  let fresh = null;   // запасные коды на экране: кнопка «Сохранить» перерисовывает панель, а закрыть окно легко случайно — до «Я сохранил коды» они не теряются

  // ---------- вход: пароль верный, login ответил need_code ----------
  function ask(r, { call, gate, fp, done, back }) {
    const text = r.sent ? 'Код отправлен в Telegram-бот, он действует 5 минут. Можно ввести запасной код.'
      : `Telegram сейчас не ответил. Введите запасной код. Запасных кодов осталось: ${r.backup}.`;   // кода нет и запасных нет — сервер отвечает ошибкой, сюда не дойдёт
    gate(`<form id="mfa-login" class="form">
      <p class="muted">${esc(text)}</p>
      <input ${FIELD} placeholder="Код" aria-label="Код из Telegram или запасной код">
      <button class="btn primary" type="submit">Войти</button>
      <button class="btn ghost" type="button" id="mfa-back">Назад</button>
      <p class="err" id="gerr"></p></form>`);
    const fm = $('#mfa-login'), btn = fm.querySelector('.primary');
    fm.code.focus();
    $('#mfa-back').onclick = () => back();
    fm.onsubmit = async e => {
      e.preventDefault();
      const code = fm.code.value.trim();
      if (!code) return;
      btn.disabled = true; $('#gerr').textContent = '';
      try { const x = await call('login_code', { ticket: r.ticket, code, fp: await fp() }); done(x.token); }
      catch (err) {
        if (err.data?.restart) return back(err.message);   // код или билет истёк, вход заблокирован — снова с пароля
        $('#gerr').textContent = err.message; btn.disabled = false; fm.code.select();
      }
    };
  }

  // ---------- блок в админ-панели ----------
  const q = s => box.querySelector(s);
  const show = (html, cls = '') => { box.innerHTML = `<div class="mfa${cls}">${html}</div>`; };
  const steps = (send, go) => `<button type="button" class="btn soft" id="mfa-send">${send}</button>
    <form id="mfa-form" class="mfa-form" hidden><input ${FIELD} inputmode="numeric" placeholder="Код из Telegram" aria-label="Код из Telegram"><button type="submit" class="btn primary">${go}</button></form>
    <p class="err" id="mfa-err"></p>`;

  // браузер может не дать доступ к буферу (Telegram, старые версии): тогда коды выделяются прямо на экране, в скрытое поле они не попадают
  async function copy() {
    try { await navigator.clipboard.writeText(fresh.join('\n')); return ui.toast('Коды скопированы'); } catch { /* ниже запасной путь */ }
    const sel = getSelection(), rng = document.createRange();
    rng.selectNodeContents(q('#mfa-list')); sel.removeAllRanges(); sel.addRange(rng);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* старый браузер */ }
    ui.toast(ok ? 'Коды скопированы' : 'Не получилось скопировать: коды выделены, скопируйте их вручную', 5000);
  }
  function codes() {
    show(`<b>Запасные коды</b>
      <p class="warn-text">Они показаны один раз. Сохраните их вне этого браузера: на бумаге или в менеджере паролей. Каждый код работает один раз.</p>
      <ul class="mfa-list" id="mfa-list">${fresh.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
      <div class="sheet-foot"><button type="button" class="btn soft" id="mfa-copy">Скопировать</button><button type="button" class="btn primary" id="mfa-saved">Я сохранил коды</button></div>`);
    q('#mfa-copy').onclick = copy;
    q('#mfa-saved').onclick = () => { fresh = null; panel(box, ui); };
  }

  async function panel(el, deps) {
    box = el; ui = deps;
    let r = null;
    if (!fresh) try { r = await ui.call('admin_mfa'); } catch (e) { box.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (fresh) return codes();
    if (r.on) show(`<b>Второй шаг включён, запасных кодов осталось ${esc(r.backup)}</b>
      ${r.tg ? `<p class="hint">Новые коды заменят прежние: старые перестанут работать.</p>${steps('Новые запасные коды', 'Получить новые коды')}` : '<p class="hint">Telegram не привязан: войти можно только запасным кодом.</p>'}`);
    else if (!r.tg) show('<p>Telegram не привязан. Второй шаг входа пока не включить.</p>');
    else show(`<p class="mfa-red">Вход в админку защищён только паролем. Включите второй шаг: после пароля нужен будет код из Telegram-бота.</p>
      <p class="hint">После включения все другие входы закроются: на других устройствах нужно будет войти заново.</p>${steps('Отправить код в Telegram', 'Включить второй шаг')}`, ' off');
    const send = q('#mfa-send'), fm = q('#mfa-form'), err = q('#mfa-err');
    if (!send) return;
    send.onclick = async () => {
      send.disabled = true; err.textContent = '';
      try { await ui.call('admin_mfa_send'); fm.hidden = false; fm.code.focus(); send.textContent = 'Отправить код ещё раз'; ui.toast('Код отправлен в Telegram-бот, он действует 5 минут'); }
      catch (e) { err.textContent = e.message; }
      send.disabled = false;
    };
    fm.onsubmit = async e => {
      e.preventDefault();
      const btn = fm.querySelector('.primary'), code = fm.code.value.trim();
      if (!code) return;
      btn.disabled = true; err.textContent = '';
      try {
        const x = await ui.call(r.on ? 'admin_mfa_new' : 'admin_mfa_on', { code });
        if (x.token) ui.setToken(x.token);   // первым делом: старые входы уже закрыты, без нового токена следующий запрос выбросит из панели
        fresh = x.backup; codes();
      } catch (e2) { err.textContent = e2.message; btn.disabled = false; }
    };
  }

  return { ask, panel };
})();

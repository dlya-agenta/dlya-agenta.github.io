// Подборка ссылкой (ТЗ v2, шаг 3.2): выбор «PDF / Ссылка / Оба» в окне подборки, готовая ссылка (копировать, отправить, открыть),
// строка ссылки в «Моих подборках»: короткий запрос, просмотры, ✓ / ✗ клиента. Страница клиента — s.html (s.js).
window.SHARE = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const day = s => s ? new Date(s).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '—';
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } };
  const FMT = [['pdf', 'PDF'], ['link', 'Ссылка'], ['both', 'Оба']];
  const HINT = {
    pdf: 'Два PDF: <b>клиенту</b> — без контактов собственника, цены с вашей комиссией; <b>агенту</b> — цены собственника, телефоны собственников, пометка «Уникальна». Перед сборкой сайт откроет телефоны (в пределах ваших лимитов) — 10–15 секунд на объект.',
    link: 'Ссылка на страницу для клиента: цены с вашей комиссией, без телефонов собственников. Клиент ставит ✓ «подходит» или ✗ «не подходит» и пишет комментарий — вам придёт сообщение. Телефоны не открываются и в лимит не идут. Ссылка действует 30 дней.',
    both: 'Два PDF и ссылка для клиента. Перед сборкой PDF сайт откроет телефоны (в пределах ваших лимитов) — 10–15 секунд на объект.',
  };

  const formatHtml = () => {
    const v = get('selFmt', 'both');
    return `<div class="field"><span>Как отправить клиенту</span><div class="chips fmt" id="s-fmt" role="radiogroup">${FMT.map(([k, t]) =>
      `<label class="chip${v === k ? ' on' : ''}"><input type="radio" name="s-fmt" value="${k}"${v === k ? ' checked' : ''}> ${t}</label>`).join('')}</div></div>
      <div class="hint" id="s-fmt-hint">${HINT[v] ?? HINT.both}</div>`;
  };
  const format = () => document.querySelector('[name="s-fmt"]:checked')?.value ?? 'both';
  // переключение: подсказка и поля только для PDF
  function mount() {
    const box = $('#s-fmt');
    if (!box) return;
    const sync = () => {
      const v = format();
      box.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.querySelector('input').checked));
      $('#s-fmt-hint').innerHTML = HINT[v];
      document.querySelectorAll('.pdf-only').forEach(x => x.hidden = v === 'link');
      put('selFmt', v);
    };
    box.onchange = sync; sync();
  }

  // ссылка: копировать (с запасным способом), отправить (меню «Поделиться» телефона), открыть
  async function copy(t, toast) {
    try { await navigator.clipboard.writeText(t); toast?.('Ссылка скопирована'); }
    catch { const i = $('#s-link'); if (i) { i.select(); document.execCommand?.('copy'); toast?.('Ссылка скопирована'); } }
  }
  const resultHtml = r => r.link ? `<div class="share-box"><label class="field">Ссылка для клиента<input id="s-link" readonly value="${esc(r.link)}"></label>
      <div class="sheet-foot"><button class="btn primary" data-copy="${esc(r.link)}">Копировать</button>${navigator.share ? `<button class="btn soft" data-share="${esc(r.link)}">Отправить</button>` : ''}
        <a class="btn ghost" href="${esc(r.link)}" target="_blank" rel="noopener" data-url="${esc(r.link)}">Открыть</a></div>
      <p class="hint">${r.query ? `${esc(r.query)} · ` : ''}действует до ${day(r.until)}. Когда клиент откроет подборку или отметит объекты, вам придёт уведомление: в Telegram (привяжите его в профиле), в браузер и на сайте.</p></div>` : '';
  function bind(el, toast) {   // окно (#sheet-body) одно на всю страницу — обработчик вешается один раз
    if (el.dataset.share) return;
    el.dataset.share = 1;
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-copy]'), s = e.target.closest('[data-share]');
      if (c) copy(c.dataset.copy, toast);
      if (s) navigator.share({ title: 'Подборка объектов', url: s.dataset.share }).catch(() => {});
    });
  }

  // «Мои подборки»: строка ссылки
  const row = s => s.link ? `<br><small class="muted">🔗 ${s.live ? `ссылка до ${day(s.link_until)}` : 'срок ссылки закончился'} · просмотров клиента: ${s.views ?? 0}${s.yes || s.no ? ` · ✓ ${s.yes} · ✗ ${s.no}` : ''}${s.comments ? ` · комментариев: ${s.comments}` : ''}</small>` : '';
  const btns = s => s.link && s.live ? `<button class="btn soft" data-copy="${esc(s.link)}">Ссылка</button>` : '';

  return { formatHtml, format, mount, resultHtml, bind, row, btns, copy };
})();

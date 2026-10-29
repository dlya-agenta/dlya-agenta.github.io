// Подсказки единой строки поиска — главная и архив (ТЗ v2, шаг 1.2): улица, дом, ЖК, район с пометкой.
// От 2 символов, задержка 0,25 с, стрелки, Enter, нажатие, Esc. Выбранная подсказка ставит точный фильтр (pick), а не текст.
// SUGG.attach(input, { load: q => Promise<items>, pick: item => void })
(() => {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'объект' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'объекта' : 'объектов';
  function attach(input, { load, pick }) {
    const box = document.createElement('ul');
    box.className = 'sugg'; box.id = input.id + '-sugg'; box.hidden = true; box.setAttribute('role', 'listbox');
    input.parentElement.classList.add('has-sugg');
    input.insertAdjacentElement('afterend', box);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-controls', box.id); input.setAttribute('aria-expanded', 'false');
    let items = [], act = -1, t = 0, ctl = null, seq = 0;
    const hide = () => { box.hidden = true; act = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
    const mark = i => {
      act = i;
      box.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === i));
      if (i >= 0) { input.setAttribute('aria-activedescendant', `${box.id}-${i}`); box.children[i]?.scrollIntoView({ block: 'nearest' }); }
    };
    const show = list => {
      items = list; act = -1;
      if (!list.length) return hide();
      box.innerHTML = list.map((x, i) => `<li role="option" id="${box.id}-${i}" data-i="${i}"><span class="sg-n">${esc(x.name)}</span>`
        + `<span class="sg-t">${esc(x.type)}${x.cnt ? ` · ${x.cnt.toLocaleString('ru-RU')} ${plural(x.cnt)}` : ''}</span></li>`).join('');
      box.hidden = false; input.setAttribute('aria-expanded', 'true');
    };
    const choose = i => { const x = items[i]; if (!x) return; hide(); pick(x); };
    input.addEventListener('input', () => {
      clearTimeout(t); ctl?.abort();
      const q = input.value.trim();
      // в запросе уже есть цена, комнаты и т. п. («2к до 15 млн Мамайка») — подсказки по адресу мешают; ищем, пока это похоже на адрес
      if (q.length < 2 || q.length > 60 || /\d\s*(?:к|кк|млн|м2|м²|тыс)(?![а-яё])|(?:^|\s)(?:до|от)\s+\d/i.test(q)) return hide();
      t = setTimeout(async () => {
        const my = ++seq; ctl = new AbortController();
        try { const list = await load(q, ctl.signal); if (my === seq && document.activeElement === input) show(list || []); }
        catch (e) { if (e?.name !== 'AbortError') hide(); }
      }, 250);
    });
    input.addEventListener('keydown', e => {
      if (box.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); mark((act + 1) % items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mark(act <= 0 ? items.length - 1 : act - 1); }
      else if (e.key === 'Enter' && act >= 0) { e.preventDefault(); e.stopPropagation(); choose(act); }
      else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    });
    // mousedown — раньше, чем поле потеряет фокус и список закроется
    box.addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(+li.dataset.i); } });
    box.addEventListener('mousemove', e => { const li = e.target.closest('li'); if (li && +li.dataset.i !== act) mark(+li.dataset.i); });
    input.addEventListener('blur', () => setTimeout(hide, 120));
    input.form?.addEventListener('submit', () => { clearTimeout(t); ctl?.abort(); seq++; hide(); });
    return { hide };
  }
  window.SUGG = { attach };
})();

// «Юрист» и «Ипотечный брокер» (v5.16, п. 4): вопрос ИИ текстом или голосом (🎤 — HUB.voice, слушает, пока человек говорит),
// история разговора, примеры вопросов, лимит в сутки. Сервер — hub/law.ts (law_init, law_ask, law_clear), ответ — 30–60 с.
(() => {
  const H = window.HUB, esc = H.esc;
  const R = {
    lawyer: { icon: '⚖️', title: 'Юрист', other: ['broker', '🏦 Ипотечный брокер'], ph: 'Например: продавец получил квартиру по наследству 2 года назад, второй наследник отказался у нотариуса. Что проверить и какие документы нужны?',
      ex: ['Как проверить собственника перед задатком?', 'Квартира куплена в браке, супруг в другом городе — как оформить согласие?', 'Дети прописаны в продаваемой квартире — что нужно от опеки?', 'Налог продавца: квартира в собственности 3 года, единственное жильё'] },
    broker: { icon: '🏦', title: 'Ипотечный брокер', other: ['lawyer', '⚖️ Юрист'], ph: 'Например: клиент — ИП, доход 250 тыс. в месяц, первый взнос 30 %, хочет 2к на вторичке в Сочи за 14 млн. Какие программы и банки подойдут?',
      ex: ['Семейная ипотека на вторичку в Сочи — можно ли?', 'Ипотека на апартаменты — какие условия и какие банки дают?', 'Как посчитать платёж: 12 млн, 20 лет, ставка 18 %?', 'Как оплатить маткапиталом часть первого взноса?'] },
  };

  async function open(role, ctx) {
    const el = ctx.el, c = R[role];
    el.innerHTML = '<p class="muted">Загрузка…</p>';
    const st = await H.call('law_init', { role });
    el.innerHTML = `<div class="dl-head"><h2>${c.icon} ${c.title}</h2><a class="btn ghost" href="#${c.other[0]}">${c.other[1]}</a></div>${H.star()}
      <section class="hub-sec dl-sec law">
        <p class="hint" id="l-left"></p>
        <div class="hub-msgs law-msgs" id="l-msgs">${st.msgs.length ? st.msgs.map(m => msg(m.who, m.text)).join('') : `<p class="muted">Задайте вопрос текстом или голосом 🎤 — ИИ ответит как ${c.title === 'Юрист' ? 'юрист по сделкам с недвижимостью' : 'ипотечный брокер'}. Пишите подробно: цифры, сроки, кто собственники.</p>`}</div>
        <div class="law-ex">${c.ex.map(x => `<button type="button" class="chip" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>
        <div class="law-in"><textarea id="l-q" rows="3" maxlength="6000" placeholder="${esc(c.ph)}"></textarea>
          ${H.voiceOk() ? '<button type="button" class="btn soft law-mic" id="l-mic" title="Сказать голосом" aria-label="Сказать голосом">🎤</button>' : ''}</div>
        <p class="hub-actions"><button class="btn primary" id="l-go">Спросить</button>${st.msgs.length ? '<button class="btn ghost" id="l-clear">Очистить историю</button>' : ''}
          <a class="btn ghost" href="#kb">📚 База знаний</a></p>
        <p class="hint" id="l-wait" hidden>⏳ Думаю… до минуты. Не закрывайте страницу.</p></section>`;
    const left = (used, lim) => { el.querySelector('#l-left').innerHTML = `Вопросов сегодня: осталось <b>${Math.max(0, lim - used)}</b> из ${lim}. Ответ ИИ — справка, не юридическая консультация.`; };
    left(st.used, st.lim);
    const box = el.querySelector('#l-msgs'), q = el.querySelector('#l-q'), go = el.querySelector('#l-go');
    box.scrollTop = box.scrollHeight;
    async function ask() {
      const text = q.value.trim();
      if (text.length < 10) { H.toast('Напишите или скажите вопрос подробнее'); q.focus(); return; }
      go.disabled = true; go.textContent = 'Думаю… до минуты'; el.querySelector('#l-wait').hidden = false;
      if (!box.querySelector('.hub-msg')) box.innerHTML = '';
      box.insertAdjacentHTML('beforeend', msg('user', text) + '<div class="hub-msg ai law-typing"><span></span><span></span><span></span></div>');
      box.scrollTop = box.scrollHeight;
      try {
        const r = await H.call('law_ask', { role, text }, { signal: AbortSignal.timeout?.(150000) });
        box.querySelector('.law-typing')?.remove();
        box.insertAdjacentHTML('beforeend', msg('ai', r.answer));
        box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
        q.value = ''; left(r.used, r.lim);
      } catch (e) {
        box.querySelector('.law-typing')?.remove(); box.lastElementChild?.remove();
        H.toast(e.name === 'TimeoutError' ? 'ИИ думает слишком долго — попробуйте ещё раз' : e.message, 7000);
      } finally { go.disabled = false; go.textContent = 'Спросить'; el.querySelector('#l-wait').hidden = true; }
    }
    go.onclick = ask;
    q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask(); });
    el.querySelector('#l-mic')?.addEventListener('click', e => H.voice(q, e.currentTarget));
    el.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => { q.value = b.dataset.ex; q.focus(); });
    el.querySelector('#l-clear')?.addEventListener('click', async () => { if (!confirm('Очистить историю вопросов?')) return; await H.call('law_clear', { role }); open(role, ctx); });
  }
  const msg = (who, text) => `<div class="hub-msg ${who === 'ai' ? 'ai' : 'user'}">${who === 'ai' ? H.md(text) : esc(text).replace(/\n/g, '<br>')}</div>`;

  window.SEC = window.SEC || {};
  window.SEC.lawyer = { title: 'Юрист', open: (a, ctx) => open('lawyer', ctx) };
  window.SEC.broker = { title: 'Ипотечный брокер', open: (a, ctx) => open('broker', ctx) };
})();

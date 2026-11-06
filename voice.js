// v5.42A п. 8: 🎤 во всех окнах — сам добавляет кнопку голоса ко всем textarea и текстовым полям форм и окон (MutationObserver).
// Пропускает: пароли, телефоны, числа, суммы, поля с уже своей 🎤, data-novoice. Логика — как HUB.voice (hub.js): говорите, пауза 4 с или ⏹ — конец.
// window.VOICE.start(input, btn, {onDone, lang, silence_ms}) — то же, что HUB.voice, для страниц без hub.js.
(() => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const toast = (t, ms) => { if (window.HUB?.toast) return window.HUB.toast(t, ms); let d = document.getElementById('v-toast'); if (!d) { d = document.createElement('div'); d.id = 'v-toast'; document.body.appendChild(d); } d.textContent = t; d.hidden = false; clearTimeout(d._t); d._t = setTimeout(() => { d.hidden = true; }, ms || 3500); };
  function start(input, btn, o = {}) {
    if (!R) { toast('Голос не поддерживается этим браузером — откройте сайт в Chrome, Яндекс Браузере или Safari'); return null; }
    if (btn._rec) { btn._rec.stopNow(); return null; }
    const rec = new R(), base = input.value ? input.value.replace(/\s+$/, '') + ' ' : '', label = btn.innerHTML, quiet = o.silence_ms ?? 4000;
    let finals = '', inter = '', stopped = false, t = null;
    rec.lang = o.lang ?? 'ru-RU'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    const show = () => { input.value = (base + finals + inter).replace(/\s+/g, ' ').trimStart(); input.dispatchEvent(new Event('input', { bubbles: true })); };
    const arm = () => { clearTimeout(t); t = setTimeout(() => rec.stopNow(), quiet); };
    rec.stopNow = () => { stopped = true; clearTimeout(t); try { rec.stop(); } catch { /* уже */ } };
    rec.onresult = e => { inter = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) finals += x[0].transcript + ' '; else inter += x[0].transcript; } show(); arm(); };
    rec.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return; stopped = true; toast(e.error === 'not-allowed' ? 'Разрешите микрофон в настройках браузера' : 'Не расслышал — попробуйте ещё раз'); };
    rec.onend = () => {
      if (!stopped) { try { rec.start(); return; } catch { /* не вышло */ } }
      clearTimeout(t); btn._rec = null; btn.classList.remove('on'); btn.innerHTML = label; btn.title = 'Сказать голосом';
      inter = ''; show(); input.dispatchEvent(new Event('change', { bubbles: true })); const v = input.value.trim(); if (v && o.onDone) o.onDone(v);
    };
    btn._rec = rec; btn.classList.add('on'); btn.innerHTML = '⏹'; btn.title = 'Остановить запись';
    try { rec.start(); arm(); } catch { btn._rec = null; btn.innerHTML = label; }
    toast('Говорите — пауза 4 секунды или ⏹ закончит запись', 2500);
    return rec;
  }
  window.VOICE = { ok: !!R, start };
  if (!R) return;

  const NO = /phone|tel|тел|price|цен|sum|сумм|amount|пароль|pass|code|код|inn|инн|snils|паспорт|passport|email|почт|mail|url|ссылк|login|логин|card|txid|wallet|кош|кадастр|date|дата/i;
  const mine = el => el.closest('[data-novoice]') || el.dataset.vmic;
  const hasMic = el => { const p = el.parentElement; if (!p) return true; return [...p.querySelectorAll('button')].some(b => /🎤/.test(b.textContent) || /mic/i.test(b.id || '')); };
  function want(el) {
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled && !mine(el) && !hasMic(el);
    if (el.tagName !== 'INPUT') return false;
    const ty = (el.getAttribute('type') || 'text').toLowerCase();
    if (!['text', 'search', ''].includes(ty) || el.readOnly || el.disabled || mine(el)) return false;
    if (/numeric|decimal|tel|email/.test(el.inputMode || '')) return false;
    if (NO.test([el.name, el.id, el.placeholder, el.getAttribute('aria-label'), el.closest('label')?.textContent?.slice(0, 60)].join(' '))) return false;
    if (!el.closest('.sheet, .sheet-box, .field, dialog, .modal, form, .hub-body, .crm, [role=dialog]')) return false;
    const w = el.offsetWidth, pw = el.parentElement?.clientWidth || 0;
    return w >= 160 && pw && w >= pw * 0.85 && !hasMic(el);
  }
  function attach(el) {
    el.dataset.vmic = '1';
    const w = document.createElement('span'); w.className = 'vwrap' + (el.tagName === 'TEXTAREA' ? ' vta' : '');
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vmic'; b.textContent = '🎤'; b.title = 'Сказать голосом'; b.setAttribute('aria-label', 'Сказать голосом');
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); start(el, b); });
    w.appendChild(b);
  }
  let q = null;
  const scan = () => { q = null; for (const el of document.querySelectorAll('textarea:not([data-vmic]), input:not([data-vmic])')) { try { if (el.offsetParent && want(el)) attach(el); } catch { /* */ } } };
  const later = () => { if (!q) q = setTimeout(scan, 300); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('focusin', e => { const el = e.target; if ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && !el.dataset.vmic && want(el)) attach(el); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();

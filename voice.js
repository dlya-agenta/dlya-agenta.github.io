// Голосовой ввод сайта (v5.42A п. 8; v5.48 F п. 20 — переписан).
// window.VOICE.start(input, btn, {onDone, lang, silence_ms = 4000, max_ms = 60000, live}) — слушает до 1 минуты; пауза 4 с или ⏹ — конец.
// Ошибка до v5.48: таймер тишины шёл с момента нажатия, а Chrome при первом нажатии включает микрофон через ~3,4 с —
// запись обрывалась через полсекунды («первое нажатие сбрасывается»). Теперь таймер тишины — только после того, как микрофон заработал.
// Два способа: браузер (SpeechRecognition — компьютер, Android) и запись + Yandex SpeechKit (iPhone/iPad, где Safari обрывает
// распознавание через 1–2 с; hub sp_rec, ключ — тот же, что у бота). Нет ключа — iPhone слушает через Safari.
// Сам добавляет 🎤 только к запросам, поиску и длинным полям: textarea, input[type=search], [data-voice] (MutationObserver).
(() => {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MD = !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext || window.webkitAudioContext);
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const MIC = '<svg class="vico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  const STOP = '<svg class="vico" viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2.5"/></svg>';
  const toast = (t, ms) => { if (window.HUB?.toast) return window.HUB.toast(t, ms); let d = document.getElementById('v-toast'); if (!d) { d = document.createElement('div'); d.id = 'v-toast'; document.body.appendChild(d); } d.textContent = t; d.hidden = false; clearTimeout(d._t); d._t = setTimeout(() => { d.hidden = true; }, ms || 3500); };
  const sget = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
  const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } };
  const token = () => { try { return JSON.parse(localStorage.getItem('token')); } catch { return null; } };
  const HUBURL = () => String(window.API || 'https://arojogajdamsyrrpcmso.supabase.co/functions/v1/web').replace(/\/web$/, '/hub');
  async function hub(action, body = {}) {
    const r = await fetch(HUBURL(), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, auth: { token: token() }, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { const e = new Error(j.message || 'Нет связи'); e.code = j.error; throw e; }
    return j;
  }
  // iPhone: включён ли SpeechKit (ключ в админке) — спрашиваем один раз за сессию заранее, чтобы нажатие не ждало сети
  if (IOS && MD && token() && sget('sp_on') == null) hub('sp_cfg').then(r => sset('sp_on', r.on ? '1' : '0'), () => {});
  const engine = () => (MD && token() && sget('sp_on') === '1' && (IOS || !R)) ? 'rec' : R ? 'web' : null;

  // ---------- полоска «Слушаю 0:12 из 1:00» (внизу экрана или внутри o.live) ----------
  function liveBar(o, stop) {
    const box = document.createElement('div');
    box.className = 'v-live' + (o.live ? ' v-in' : '');
    box.setAttribute('role', 'status');
    box.innerHTML = `<span class="v-bars" aria-hidden="true">${'<i></i>'.repeat(5)}</span><span class="v-txt">Включаю микрофон…</span><button type="button" class="v-stop">${STOP}<b>Готово</b></button>`;
    box.querySelector('.v-stop').onclick = e => { e.preventDefault(); stop(); };
    (o.live || document.body).appendChild(box);
    const txt = box.querySelector('.v-txt'), bars = [...box.querySelectorAll('.v-bars i')];
    const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    return {
      warm() { box.classList.add('warm'); },
      listen(sec, max) { box.classList.remove('warm'); box.classList.add('on'); txt.textContent = `Слушаю ${mmss(sec)} из ${mmss(max)} — пауза 4 с закончит`; },
      level(v) { box.classList.add('lv'); bars.forEach((b, i) => { b.style.transform = `scaleY(${Math.max(0.18, Math.min(1, v * (1.4 - Math.abs(i - 2) * 0.25)))})`; }); },
      busy(t) { box.classList.remove('on'); box.classList.add('warm'); txt.textContent = t; },
      close() { box.remove(); },
    };
  }

  function start(input, btn, o = {}) {
    if (btn._rec) { btn._rec.stopNow(); return null; }
    const how = o.engine || engine();
    if (!how) { toast('Голос не поддерживается этим браузером — откройте сайт в Chrome, Яндекс Браузере или Safari'); return null; }
    const base = input.value ? input.value.replace(/\s+$/, '') + ' ' : '', label = btn.innerHTML, quiet = o.silence_ms ?? 4000, max = o.max_ms ?? 60000;
    const show = (t) => { input.value = (base + t).replace(/\s+/g, ' ').trimStart(); input.dispatchEvent(new Event('input', { bubbles: true })); };
    let ended = false, t0 = 0, tick = null;
    const ui = liveBar(o, () => ctl.stopNow());
    const ctl = { stopNow: () => {} };
    btn._rec = ctl; btn.classList.add('on'); btn.innerHTML = STOP; btn.title = 'Закончить запись'; btn.setAttribute('aria-pressed', 'true');
    ui.warm();
    const begin = () => { if (t0) return; t0 = Date.now(); ui.listen(0, max / 1000); tick = setInterval(() => ui.listen((Date.now() - t0) / 1000, max / 1000), 500); };
    const finish = (text, err) => {
      if (ended) return; ended = true;
      clearInterval(tick); ui.close();
      btn._rec = null; btn.classList.remove('on'); btn.innerHTML = label; btn.title = 'Сказать голосом'; btn.removeAttribute('aria-pressed');
      if (err) toast(err, 5000);
      if (text != null) show(text);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const v = input.value.trim(); if (v && o.onDone && text) o.onDone(v);
    };
    return how === 'rec' ? record(o, ctl, ui, begin, finish, show, quiet, max) : browser(o, ctl, begin, finish, show, quiet, max);
  }

  // ---------- браузер: SpeechRecognition ----------
  function browser(o, ctl, begin, finish, show, quiet, max) {
    const rec = new R();
    let finals = '', inter = '', stopped = false, heard = false, t = null, cap = null, warm = null;
    rec.lang = o.lang ?? 'ru-RU'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    const arm = () => { clearTimeout(t); t = setTimeout(() => ctl.stopNow(), quiet); };
    const live = () => { if (heard) return; heard = true; clearTimeout(warm); begin(); arm(); cap = setTimeout(() => ctl.stopNow(), max); };
    ctl.stopNow = () => { stopped = true; clearTimeout(t); clearTimeout(cap); clearTimeout(warm); try { rec.stop(); } catch { done(); } };
    const done = (err) => { clearTimeout(t); clearTimeout(cap); clearTimeout(warm); finish(finals + inter, err); };
    rec.onaudiostart = live;   // микрофон реально заработал — только теперь считаем тишину (причина ошибки «первое нажатие»)
    rec.onresult = e => { live(); inter = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const x = e.results[i]; if (x.isFinal) finals += x[0].transcript + ' '; else inter += x[0].transcript; } show(finals + inter); arm(); };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      stopped = true;
      // уже слушали — Safari иногда отказывает в перезапуске: просто завершаем с тем, что услышали, без пугающей ошибки
      if (heard && /not-allowed|service-not-allowed/.test(e.error)) return;
      rec._err = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Разрешите микрофон для этого сайта в настройках браузера'
        : e.error === 'network' ? 'Нет связи с распознаванием речи — проверьте интернет' : e.error === 'audio-capture' ? 'Микрофон не найден' : 'Не расслышал — попробуйте ещё раз';
    };
    // Chrome и Safari сами завершают распознавание через 5–60 с — продолжаем, пока человек говорит (до 1 минуты)
    rec.onend = () => {
      if (!stopped && heard) { try { rec.start(); return; } catch { /* не вышло — завершаем */ } }
      if (!stopped && !heard) { try { rec.start(); return; } catch { /* */ } }
      inter = ''; done(rec._err);
    };
    warm = setTimeout(() => { if (!heard) { rec._err = 'Микрофон не включился — нажмите ещё раз'; ctl.stopNow(); } }, 9000);
    try { rec.start(); } catch { done('Микрофон занят — нажмите ещё раз'); return null; }
    return rec;
  }

  // ---------- запись + SpeechKit (iPhone): 16 кГц, 16 бит; тишина считается по громкости; куски до 29 с ----------
  function record(o, ctl, ui, begin, finish, show, quiet, max) {
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC();   // создаём в нажатии — иначе iOS не даст звук
    const chunks = [], RATE = 16000;
    let stream = null, node = null, src = null, stopped = false, speech = false, lastLoud = 0, floor = 0.01, cap = null, nosp = null;
    const close = () => { clearTimeout(cap); clearTimeout(nosp); try { node?.disconnect(); src?.disconnect(); } catch { /* */ } stream?.getTracks().forEach(t => t.stop()); ac.close().catch(() => {}); };
    ctl.stopNow = () => { if (stopped) return; stopped = true; close(); send(); };
    async function send() {
      const n = chunks.reduce((a, c) => a + c.length, 0);
      if (!speech || n < RATE * 0.4) return finish('', speech ? null : 'Ничего не услышал — нажмите и говорите');
      ui.busy('Распознаю…');
      const all = new Int16Array(n); let p = 0; for (const c of chunks) { all.set(c, p); p += c.length; }
      const step = RATE * 29; let text = '';
      try {
        for (let i = 0; i < all.length; i += step) {
          const part = all.subarray(i, Math.min(all.length, i + step)), bytes = new Uint8Array(part.buffer, part.byteOffset, part.byteLength);
          let bin = ''; for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
          const r = await hub('sp_rec', { pcm: btoa(bin) });
          text += (r.text ? r.text + ' ' : ''); show(text);
        }
        finish(text || '', text ? null : 'Не расслышал — попробуйте ещё раз');
      } catch (e) {
        if (e.code === 'nokey') sset('sp_on', '0');
        finish(text || '', e.message);
      }
    }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }).then(s => {
      if (stopped) { s.getTracks().forEach(t => t.stop()); return; }
      stream = s; src = ac.createMediaStreamSource(s); node = ac.createScriptProcessor(4096, 1, 1);
      const ratio = ac.sampleRate / RATE;
      node.onaudioprocess = e => {
        if (stopped) return;
        const x = e.inputBuffer.getChannelData(0), out = new Int16Array(Math.floor(x.length / ratio));
        let sum = 0;
        for (let i = 0; i < out.length; i++) { const v = x[Math.floor(i * ratio)]; sum += v * v; out[i] = Math.max(-1, Math.min(1, v)) * 0x7fff; }
        chunks.push(out);
        const rms = Math.sqrt(sum / Math.max(1, out.length)), now = Date.now();
        if (!speech) floor = floor * 0.95 + rms * 0.05;
        ui.level(Math.min(1, rms * 12));
        if (rms > Math.max(0.02, floor * 2.5)) { speech = true; lastLoud = now; }
        if (speech && now - lastLoud > quiet) ctl.stopNow();
      };
      src.connect(node); node.connect(ac.destination);
      ac.resume?.();
      begin();
      cap = setTimeout(() => ctl.stopNow(), max);
      nosp = setTimeout(() => { if (!speech) ctl.stopNow(); }, 9000);
    }, () => { stopped = true; close(); finish(null, 'Разрешите микрофон для этого сайта: Настройки → Safari → Микрофон'); });
    return ctl;
  }

  window.VOICE = { ok: !!R || MD, start, engine, MIC, ios: IOS };

  // ---------- 🎤 к полям: запросы, поиск, длинные поля (п. 20) ----------
  const NO = /phone|tel|тел|price|цен|sum|сумм|amount|пароль|pass|code|код|inn|инн|snils|паспорт|passport|email|почт|mail|url|ссылк|login|логин|card|txid|wallet|кош|кадастр|date|дата/i;
  const isMic = b => b.classList.contains('vmic') || /🎤/.test(b.textContent) || /mic/i.test(b.id || '') || b.hasAttribute('data-mic') || b.hasAttribute('data-amic');
  const hasMic = el => { const p = el.parentElement; if (!p) return true; return [...p.querySelectorAll('button')].some(isMic); };
  function want(el) {
    if (el.closest('[data-novoice]') || el.dataset.vmic || el.readOnly || el.disabled) return false;
    if (el.tagName === 'TEXTAREA') return (el.rows >= 2 || el.offsetHeight >= 56) && !hasMic(el);
    if (el.tagName !== 'INPUT') return false;
    const ty = (el.getAttribute('type') || 'text').toLowerCase();
    if (!(ty === 'search' || el.hasAttribute('data-voice'))) return false;
    if (NO.test([el.name, el.id, el.placeholder].join(' '))) return false;
    return el.offsetWidth >= 160 && !hasMic(el);
  }
  function attach(el) {
    el.dataset.vmic = '1';
    const w = document.createElement('span'); w.className = 'vwrap' + (el.tagName === 'TEXTAREA' ? ' vta' : '');
    el.parentNode.insertBefore(w, el); w.appendChild(el);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'vmic'; b.innerHTML = MIC; b.title = 'Сказать голосом'; b.setAttribute('aria-label', 'Сказать голосом');
    b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); start(el, b); });
    w.appendChild(b);
  }
  // свои кнопки разделов (🎤 в поиске, Помощнике, юристе, сделке) — тот же стильный вид
  const dress = () => { for (const b of document.querySelectorAll('#q-mic, #h-mic, .law-mic, [data-mic], [data-amic]')) if (!b.classList.contains('vbtn') && /🎤/.test(b.textContent)) { b.classList.add('vbtn'); b.innerHTML = MIC; } };
  if (!window.VOICE.ok) return;
  let q = null;
  const scan = () => { q = null; dress(); for (const el of document.querySelectorAll('textarea:not([data-vmic]), input:not([data-vmic])')) { try { if (el.offsetParent && want(el)) attach(el); } catch { /* */ } } };
  const later = () => { if (!q) q = setTimeout(scan, 300); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('focusin', e => { const el = e.target; if ((el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && !el.dataset.vmic && want(el)) attach(el); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();

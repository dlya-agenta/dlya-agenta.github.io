// «Видеомонтаж-СММ» (v5.15, п. 3, тариф MAX): ролик 9:16 до 30 с из 4–9 фото собирается прямо в браузере (canvas + MediaRecorder),
// на сервер уходит готовый файл (второй проект, живёт 1 час). Поле 1 — видео, поле 2 — короткие характеристики для статусов.
// Кнопки: «Поделиться» (меню телефона: «Избранное» Telegram и MAX, себе в WhatsApp), статусы Telegram и WhatsApp — после вопроса,
// YouTube, Rutube, Instagram, VK — после подключения соцсетей в профиле. Сервер — hub/video.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const W = 720, HH = 1280, FPS = 30;
  let el = null, prep = null, chosen = [], blob = null, job = null;
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } } };
  const url = (num, k, v = 2) => v === 3 ? `${MEDIA}/${num}/${k}.jpg` : k < 4 ? `${PH}/${num}/${k}.jpg` : `${MEDIA}/${num}/${k}.webp`;

  async function open(arg, ctx) {
    el = ctx.el;
    if (!ctx.caps?.can?.video) { el.innerHTML = H.locked('Видеомонтаж-СММ', 'Короткие ролики до 30 секунд из фото ваших объектов — для статусов, Reels, Shorts и Rutube — в тарифе MAX.', 'max'); return; }
    if (/^\d+$/.test(arg) && +arg < 100000) return show(+arg);   // готовый ролик по ссылке из уведомления
    const nums = (arg ? arg.split(',') : store.get('sel', [])).map(Number).filter(n => n > 100000).slice(0, 9);
    if (!nums.length) {
      el.innerHTML = `<h2>🎬 Видеомонтаж-СММ</h2><p>Выберите объекты: отметьте их галочками в выдаче, избранном или подборке и нажмите «🎬 Ролик», или откройте помощника.</p>
        <p><a class="btn primary" href="./">К объявлениям</a> <a class="btn soft" href="#helper">🤖 Помощник</a></p>`; return;
    }
    el.innerHTML = '<p class="muted">Готовлю фото…</p>';
    prep = await H.call('vid_prepare', { nums, price: false });
    chosen = prep.pick.map(p => url(p.num, p.k, p.v));
    if (!chosen.length) { el.innerHTML = '<h2>🎬 Видеомонтаж-СММ</h2><p>У выбранных объектов ещё нет фото в нашем хранилище — они загружаются ночью. Выберите другие объекты.</p>'; return; }
    draw();
  }
  function draw() {
    el.innerHTML = `<h2>🎬 Видеомонтаж-СММ</h2><p class="hint">Роликов сегодня: ${prep.used} из ${prep.lim}. Ролик до 30 секунд, 9:16. Видео удалится через час после монтажа — скачайте или опубликуйте сразу.</p>
      <p class="hint">⚠ Перед публикацией в соцсети подключите их в профиле — <a href="#msg">Мессенджеры и соцсети</a>.</p>
      <section class="hub-sec"><h3>Фото (${chosen.length} из 4–9)</h3><div class="vid-ph">${prep.pick.map(p => { const u = url(p.num, p.k, p.v); return `<label><input type="checkbox" data-u="${esc(u)}"${chosen.includes(u) ? ' checked' : ''}><img src="${esc(u)}" alt="" crossorigin="anonymous"></label>`; }).join('')}</div>
        <p class="hint">Взяли фото за вас: обложки объектов первыми. Снимите лишние галочки.</p>
        <label class="hub-chk"><input type="checkbox" id="v-price"> Показать цену в ролике</label></section>
      <div class="vid-two"><section class="hub-sec"><h3>1. Видео</h3><div id="v-out"><canvas id="v-cv" width="${W}" height="${HH}" class="vid-cv"></canvas></div>
        <p><button class="btn primary" data-make>Собрать ролик</button></p><div id="v-actions"></div></section>
      <section class="hub-sec"><h3>2. Коротко для статусов</h3><textarea id="v-short" rows="3" maxlength="300">${esc(prep.short)}</textarea>
        <h3>Описание к видео</h3><textarea id="v-cap" rows="6" maxlength="2000">${esc(prep.caption)}</textarea>
        <p><button class="btn soft" data-copy-cap>Скопировать описание</button></p></section></div>`;
    el.onchange = e => { const c = e.target.closest('[data-u]'); if (c) { c.checked ? chosen.push(c.dataset.u) : chosen.splice(chosen.indexOf(c.dataset.u), 1); el.querySelector('h3').textContent = `Фото (${chosen.length} из 4–9)`; } };
    el.onclick = onClick;
  }
  const load = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // кадр: фото с медленным приближением, низ 1/20 срезан (водяные знаки), подписи снизу
  function frame(ctx, img, t, text, sub) {
    ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, W, HH);
    const ih = img.height * 0.95, z = 1 + 0.08 * t, s = Math.max(W / img.width, HH / ih) * z;
    ctx.drawImage(img, 0, 0, img.width, ih, (W - img.width * s) / 2, (HH - ih * s) / 2, img.width * s, ih * s);
    const g = ctx.createLinearGradient(0, HH * 0.62, 0, HH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.78)'); ctx.fillStyle = g; ctx.fillRect(0, HH * 0.62, W, HH * 0.38);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui, sans-serif'; wrap(ctx, text, 40, HH - 210, W - 80, 52);
    if (sub) { ctx.font = '32px system-ui, sans-serif'; ctx.fillStyle = '#e5e7eb'; wrap(ctx, sub, 40, HH - 90, W - 80, 40); }
  }
  function wrap(ctx, s, x, y, w, lh) { let line = '', yy = y; for (const word of String(s).split(' ')) { const t = line ? `${line} ${word}` : word; if (ctx.measureText(t).width > w && line) { ctx.fillText(line, x, yy); line = word; yy += lh; } else line = t; } if (line) ctx.fillText(line, x, yy); }
  async function make() {
    if (chosen.length < 1) return H.toast('Отметьте хотя бы одно фото');
    if (!window.MediaRecorder) return H.toast('Этот браузер не умеет собирать видео — откройте сайт в Chrome или Safari');
    const imgs = []; for (const u of chosen.slice(0, 9)) try { imgs.push(await load(u)); } catch { /* фото не загрузилось — пропуск */ }
    if (!imgs.length) return H.toast('Фото не загрузились');
    const cv = el.querySelector('#v-cv'), ctx = cv.getContext('2d');
    const per = Math.min(3.2, 27 / imgs.length), total = per * imgs.length + 3;   // последний кадр — контакт агента, 3 с
    const type = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(cv.captureStream(FPS), { mimeType: type, videoBitsPerSecond: 2_500_000 }), parts = [];
    rec.ondataavailable = e => e.data.size && parts.push(e.data);
    const priceOn = el.querySelector('#v-price').checked, title = el.querySelector('#v-short').value;
    const it = prep.items, price = priceOn && it.length === 1 && it[0].price ? H.mln(it[0].price) : '';
    const b = el.querySelector('[data-make]'); b.disabled = true;
    rec.start(500);
    const t0 = performance.now();
    await new Promise(done => {
      const step = () => {
        const s = (performance.now() - t0) / 1000;
        if (s >= total) return done();
        const i = Math.floor(s / per);
        if (i < imgs.length) frame(ctx, imgs[i], (s % per) / per, title, price);
        else { ctx.fillStyle = '#0f2a5c'; ctx.fillRect(0, 0, W, HH); ctx.fillStyle = '#fff'; ctx.font = 'bold 52px system-ui'; wrap(ctx, 'Запишитесь на просмотр', 50, 520, W - 100, 62);
          ctx.font = '40px system-ui'; wrap(ctx, [prep.agent.name, prep.agent.company, prep.agent.phone].filter(Boolean).join(' · '), 50, 680, W - 100, 50); }
        b.textContent = `Собираю… ${Math.round(s / total * 100)} %`;
        requestAnimationFrame(step);
      };
      step();
    });
    rec.stop(); await new Promise(r => rec.onstop = r);
    blob = new Blob(parts, { type: type.split(';')[0] });
    b.textContent = 'Загружаю…';
    try {
      const up = await H.call('vid_upload', { type: type.includes('mp4') ? 'mp4' : 'webm', nums: it.map(x => x.num), caption: el.querySelector('#v-cap').value });
      const r = await fetch(up.upload, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
      if (!r.ok) throw new Error(`Хранилище не приняло ролик (${r.status})`);
      job = (await H.call('vid_done', { id: up.id, size: blob.size }));
      job.id = up.id;
      el.querySelector('#v-out').innerHTML = `<video src="${esc(job.url)}" controls playsinline class="vid-cv"></video>`;
      actions();
    } catch (er) { H.toast(er.message, 6000); el.querySelector('#v-out').innerHTML = `<video src="${URL.createObjectURL(blob)}" controls playsinline class="vid-cv"></video>`; actions(true); }
    b.disabled = false; b.textContent = 'Собрать заново';
  }
  function actions(local = false) {
    const t = new Date(job?.expires_at ?? Date.now() + 3600e3).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });
    el.querySelector('#v-actions').innerHTML = `<p class="hub-warn">⏳ Видео удалится через час${local ? '' : ` — в ${t} МСК`}. Уведомление о готовности ушло в бот и push.</p>
      <p class="hub-inline"><button class="btn primary" data-share>📤 Поделиться</button><a class="btn soft" download="rolik.${blob.type.includes('mp4') ? 'mp4' : 'webm'}" href="${URL.createObjectURL(blob)}">⬇ Скачать</a>
      <button class="btn soft" data-status>Статус Telegram / WhatsApp</button><button class="btn ghost" data-social>YouTube · Rutube · Instagram · VK</button></p>
      <p class="hint">«Поделиться» на телефоне: «Избранное» в Telegram и MAX, себе («Вы») в WhatsApp.</p>`;
  }
  async function share(asStatus) {
    const file = new File([blob], `rolik.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: blob.type }), text = el.querySelector(asStatus ? '#v-short' : '#v-cap').value;
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch { /* отмена */ } }
    else { await H.copy(text, 'Текст скопирован — скачайте ролик и отправьте его в мессенджере'); }
  }
  async function onClick(e) {
    if (e.target.closest('[data-make]')) return make();
    if (e.target.closest('[data-copy-cap]')) return H.copy(el.querySelector('#v-cap').value);
    if (e.target.closest('[data-share]')) return share(false);
    if (e.target.closest('[data-status]')) { if (confirm('Опубликовать ролик в статус? Откроется меню «Поделиться» — выберите Telegram или WhatsApp, затем «Статус» / «История».')) share(true); return; }
    if (e.target.closest('[data-social]')) { H.toast('Подключите YouTube, Rutube, Instagram и VK в профиле — «Мессенджеры и соцсети». Пока скачайте ролик и загрузите вручную.', 7000); return; }
  }
  async function show(id) {
    try { const r = await H.call('vid_get', { id }); el.innerHTML = `<h2>🎬 Ролик</h2><video src="${esc(r.url)}" controls playsinline class="vid-cv"></video><p class="hub-warn">⏳ Удалится в ${new Date(r.expires_at).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })} МСК.</p>
      <p><a class="btn primary" href="${esc(r.url)}" download>⬇ Скачать</a> <button class="btn soft" data-c="${esc(r.caption ?? '')}">Скопировать описание</button></p>`;
      el.onclick = e => { const c = e.target.closest('[data-c]'); if (c) H.copy(c.dataset.c); }; }
    catch (er) { el.innerHTML = `<p class="err">${esc(er.message)}</p><a class="btn primary" href="#video">Собрать новый</a>`; }
  }
  window.SEC = window.SEC || {};
  window.SEC.video = { title: 'Видеомонтаж-СММ', open };
})();

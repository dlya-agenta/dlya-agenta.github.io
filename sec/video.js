// «Видеомонтаж-СММ» (тариф MAX; v5.16 — по скиллу «Видеообзор с контактами»): ролик 9:16, ровно 10 с, 30 кадров/с собирается прямо в браузере
// (canvas + MediaRecorder). 4–6 сцен: 1-я — обложка с «крючком» (ЖК золотом + площадь · фишка), медленный зум 1.0↔1.1 с панорамой,
// титры пословно (размытие → резкость), бренд-строка сверху, переходы чередуются «растворение» 0,3 с и «хлыст» 0,25 с, финальный кадр 2 с
// на размытой обложке: агентство / имя / телефон / мессенджеры / адрес — того, кто делает ролик (из профиля или введённые здесь).
// Безопасные зоны: ничего важного выше 200 и ниже 1300 px (из 1920). Низ фото срезан на 1/20 (водяные знаки площадок).
// Перед сборкой агент обязательно пишет короткое описание (или «✨ Написать ИИ») и проверяет имя и телефон. Готово: просмотр, «Скачать»,
// «Поделиться», описание к посту и заголовок для YouTube/Rutube с кнопками «Скопировать». Ролик хранится на сервере 1 час. Сервер — hub/video.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const W = 1080, HH = 1920, FPS = 30, DUR = 10, END = 2, BODY = DUR - END, XF = 0.3, WHIP = 0.25, SAFE_TOP = 200, SAFE_BOTTOM = 1300, MAXW = W - 120;
  const GOLD = '#d6b46a', FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  let el = null, prep = null, scenes = [], blob = null, job = null, busy = false;
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } } };
  const url = (num, k, v = 2) => v === 3 ? `${MEDIA}/${num}/${k}.jpg` : k < 4 ? `${PH}/${num}/${k}.jpg` : `${MEDIA}/${num}/${k}.webp`;
  const km = m => m >= 1000 ? `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км` : `${Math.round(m / 10) * 10} м`;
  const area = a => a ? `${String(a).replace('.', ',')} м²` : '';
  const css = `.vid-steps{display:grid;gap:14px}.vid-ph{display:flex;flex-wrap:wrap;gap:8px}.vid-ph label{position:relative;width:92px;cursor:pointer}
    .vid-ph img{width:92px;height:122px;object-fit:cover;border-radius:10px;display:block;border:3px solid transparent}.vid-ph input{position:absolute;left:6px;top:6px;z-index:1}
    .vid-ph input:checked+img{border-color:${GOLD}}.vid-ph b{position:absolute;right:6px;top:4px;background:#0009;color:#fff;border-radius:8px;padding:0 6px;font-size:12px}
    .vid-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 12px}.vid-grid .field{margin:0}.vid-grid input,.vid-grid textarea{width:100%}
    .vid-sc{display:grid;grid-template-columns:48px 1fr 1fr;gap:6px;align-items:center;margin:4px 0}.vid-sc img{width:48px;height:64px;object-fit:cover;border-radius:6px}
    .vid-two{display:grid;grid-template-columns:minmax(260px,360px) 1fr;gap:16px;align-items:start}.vid-cv{width:100%;max-width:360px;aspect-ratio:9/16;border-radius:14px;background:#0b0e14;display:block}
    .vid-need{color:#b91c1c;font-weight:600}.vid-obj{display:flex;flex-wrap:wrap;gap:6px}.vid-obj span{background:var(--soft,#eef3ff);border-radius:10px;padding:4px 10px;font-size:13px}
    @media (max-width:760px){.vid-two{grid-template-columns:1fr}.vid-sc{grid-template-columns:40px 1fr}.vid-sc input:last-child{grid-column:2}}`;
  const addCss = () => { if (!document.getElementById('vid-css')) { const s = document.createElement('style'); s.id = 'vid-css'; s.textContent = css; document.head.appendChild(s); } };

  async function open(arg, ctx) {
    el = ctx.el; addCss();
    if (!ctx.caps?.can?.video) { el.innerHTML = H.locked('Видеомонтаж-СММ', 'Видеообзор объекта за минуту: ролик 10 секунд 9:16 из фото, с вашим именем и контактами на финальном кадре, плюс готовое описание к посту — для Reels, Shorts, статусов и Rutube. В тарифе MAX.', 'max'); return; }
    if (/^\d+$/.test(arg) && +arg < 100000) return show(+arg);   // готовый ролик по ссылке из уведомления
    const nums = (arg ? arg.split(',') : []).map(Number).filter(n => n > 100000).slice(0, 6);
    if (!nums.length) return empty();
    el.innerHTML = '<p class="muted">Готовлю фото и характеристики…</p>';
    try { prep = await H.call('vid_prepare', { nums }); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (!prep.pick.length) { el.innerHTML = '<h2>🎬 Видеообзор</h2><p>У выбранных объектов ещё нет фото в нашем хранилище — они загружаются ночью. Выберите другие объекты.</p><p><a class="btn primary" href="./">К объявлениям</a></p>'; return; }
    blob = null; job = null;
    scenes = prep.pick.map((p, i) => ({ u: url(p.num, p.k, p.v), num: p.num, on: true, ...titleOf(i, p) }));
    draw();
  }
  // без выбранных объектов: как выбрать + номера вручную + из «Избранного» на главной
  function empty() {
    const sel = store.get('sel', []).filter(n => n > 100000);
    el.innerHTML = `<h2>🎬 Видеообзор объекта</h2>
      <p>Ролик 10 секунд 9:16 из фото объекта с вашим именем и контактами — для Reels, Shorts, статусов и Rutube.</p>
      <ol><li>На главной отметьте объекты галочкой «В подборку» — в выдаче, в «★ Избранном» или нажмите «В подборку» у подборки в «Мои подборки».</li>
        <li>Внизу появится полоса выбора — нажмите <b>«🎬 Ролик»</b>.</li><li>Или попросите помощника: «сделай ролик по № 172480».</li></ol>
      ${sel.length ? `<p><button class="btn primary" data-sel-go="${sel.join(',')}">🎬 Ролик из отмеченных на главной (${sel.length})</button></p>` : ''}
      <form class="hub-ask" id="v-nums"><input id="v-n" placeholder="Или номера объектов через запятую: 172480, 188198" inputmode="numeric" aria-label="Номера объектов"><button class="btn primary">Сделать ролик</button></form>
      <p><a class="btn soft" href="./">К объявлениям</a> <a class="btn soft" href="#helper">🤖 Помощник</a></p>`;
    el.onclick = e => { const b = e.target.closest('[data-sel-go]'); if (b) location.hash = `video=${b.dataset.selGo}`; };
    el.querySelector('#v-nums').onsubmit = e => { e.preventDefault(); const n = (el.querySelector('#v-n').value.match(/\d{6}/g) ?? []).slice(0, 6); if (!n.length) return H.toast('Введите номера объектов (6 цифр)'); location.hash = `video=${n.join(',')}`; };
  }
  const itemOf = num => prep.items.find(x => x.num === num) ?? prep.items[0];
  // подписи сцен (≤ 4 слов в названии, ≤ 5 в подзаголовке): 1 объект — характеристики по сценам; несколько — по объекту на сцену
  function titleOf(i, p) {
    const x = itemOf(p.num), one = prep.items.length === 1;
    const what = [x.rooms, x.kind === 'квартира' && x.rooms ? '' : x.kind].filter(Boolean).join(' ') || 'Объект';
    if (!one) return { title: [x.rooms || x.kind, area(x.area)].filter(Boolean).join(' · '), sub: [x.place, x.sea_m && x.sea_m < 1500 ? `${km(x.sea_m)} до моря` : ''].filter(Boolean).join(' · ') };
    const T = [
      { title: what, sub: [area(x.area), x.floor ? `${x.floor}/${x.floors ?? '?'} этаж` : ''].filter(Boolean).join(' · ') },
      { title: x.place || 'Сочи', sub: x.district ? `${x.district} район` : 'Сочи' },
      x.sea_m ? { title: `${km(x.sea_m)} до моря`, sub: x.finish || '' } : { title: x.finish || 'Готов к показу', sub: x.place },
      { title: x.finish ? x.finish[0].toUpperCase() + x.finish.slice(1) : what, sub: x.new ? 'Новостройка' : 'Готовый дом' },
      { title: 'Запишитесь на показ', sub: 'Покажем в удобное время' },
    ];
    return i === 0 ? { title: x.zk || what, sub: area(x.area) } : T[(i - 1) % T.length];
  }
  const hookOf = () => { const x = prep.items[0], f = el?.querySelector('#v-fish')?.value.trim() ?? x.fishka;
    const n = prep.items.length, places = [...new Set(prep.items.map(i => i.place).filter(Boolean))];
    if (n > 1) return [`${n} ${n < 5 ? 'объекта' : 'объектов'} в Сочи`, f || places.slice(0, 2).join(' · ')];
    return [x.zk || [x.rooms, x.kind].filter(Boolean).join(' ') || 'Объект', [area(x.area), f].filter(Boolean).join(' · ')]; };

  function draw() {
    const a = prep.agent, x = prep.items[0], need = !a.name || !a.phone;
    el.innerHTML = `<h2>🎬 Видеообзор объекта</h2>
      <p class="hint">Роликов сегодня: ${prep.used} из ${prep.lim}. Ролик 10 секунд 9:16, финальный кадр — ваше имя и контакты. Видео хранится на сервере 1 час — скачайте его сразу.</p>
      <div class="vid-obj">${prep.items.map(i => `<span>№ ${i.num} · ${esc([i.zk, i.rooms || i.kind, area(i.area), i.place].filter(Boolean).join(' · '))}</span>`).join('')}</div>
      <div class="vid-two">
        <section class="hub-sec"><h3>Видео</h3><div id="v-out"><canvas id="v-cv" width="${W}" height="${HH}" class="vid-cv"></canvas></div>
          <p><button class="btn primary" data-make>🎬 Собрать ролик</button> <button class="btn ghost" data-preview>Обложка</button></p><div id="v-actions"></div></section>
        <div class="vid-steps">
          <section class="hub-sec"><h3>1. Фото и подписи (${scenes.filter(s => s.on).length} из 4–6, первое — обложка)</h3>
            <div class="vid-ph">${scenes.map((s, i) => `<label><input type="checkbox" data-on="${i}"${s.on ? ' checked' : ''}><img src="${esc(s.u)}" alt="" crossorigin="anonymous"><b>${i + 1}</b></label>`).join('')}</div>
            <details><summary>Подписи сцен (до 4 слов, подзаголовок до 5)</summary>${scenes.map((s, i) => `<div class="vid-sc"><img src="${esc(s.u)}" alt="" crossorigin="anonymous">
              ${i === 0 ? '<small class="muted">Обложка — «крючок» ниже</small><span></span>' : `<input data-t="${i}" value="${esc(s.title)}" maxlength="40" aria-label="Название сцены ${i + 1}"><input data-s="${i}" value="${esc(s.sub)}" maxlength="50" aria-label="Подзаголовок сцены ${i + 1}">`}</div>`).join('')}</details></section>
          <section class="hub-sec"><h3>2. Описание <span class="vid-need">*</span></h3>
            <div class="vid-grid"><label class="field" style="grid-column:1/-1">Коротко об объекте — обязательно (до 200 знаков, пойдёт в описание к посту)
              <textarea id="v-short" rows="3" maxlength="200" placeholder="Например: светлая двушка с видом на горы, 10 минут пешком до парка «Ривьера», чистый подъезд, тихие соседи">${esc(prep.short ?? '')}</textarea></label>
              <label class="field">Фишка для обложки (до 4 слов)<input id="v-fish" value="${esc(prep.items.length > 1 ? '' : x.fishka ?? '')}" maxlength="40" placeholder="например: вид на море"></label>
              </div>
            <label class="hub-chk"><input type="checkbox" id="v-price"> Показать цену в ролике и в описании${x.price && prep.items.length === 1 ? ` (${esc(H.mln(x.price))})` : ''}</label>
            <p><button class="btn soft" data-ai>✨ Написать ИИ</button> <small class="muted">ИИ пишет только по характеристикам объекта — проверьте текст.</small></p></section>
          <section class="hub-sec"><h3>3. Ваше имя и контакты ${need ? '<span class="vid-need">* в профиле их нет — заполните</span>' : '<small class="muted">из профиля</small>'}</h3>
            <div class="vid-grid"><label class="field">Имя и фамилия *<input id="v-name" value="${esc(a.name)}" maxlength="80" autocomplete="name"></label>
              <label class="field">Телефон *<input id="v-phone" value="${esc(a.phone)}" maxlength="30" inputmode="tel" autocomplete="tel" placeholder="+7 918 123-45-67"></label>
              <label class="field">Агентство<input id="v-ag" value="${esc(a.agency)}" maxlength="120" placeholder="без агентства — крупно имя"></label>
              <label class="field">Мессенджеры<input id="v-msg" value="${esc(a.messengers)}" maxlength="120" placeholder="WhatsApp · Telegram @ник"></label>
              <label class="field" style="grid-column:1/-1">Адрес офиса<input id="v-addr" value="${esc(a.address)}" maxlength="160" placeholder="по желанию"></label></div>
            <label class="hub-chk"><input type="checkbox" id="v-save"${need ? ' checked' : ''}> Сохранить в профиль — в следующий раз подставятся сами</label></section>
          <section class="hub-sec" id="v-post" hidden><h3>4. Описание к посту</h3>
            <label class="field">Заголовок (YouTube, Rutube, Дзен)<input id="v-title" maxlength="120"></label>
            <textarea id="v-cap" rows="11" maxlength="3000"></textarea>
            <p><button class="btn primary" data-copy-cap>Скопировать описание</button> <button class="btn soft" data-copy-title>Скопировать заголовок</button></p></section>
        </div></div>`;
    el.onchange = e => {
      const c = e.target.closest('[data-on]');
      if (c) { scenes[+c.dataset.on].on = c.checked; el.querySelector('.vid-steps h3').textContent = `1. Фото и подписи (${scenes.filter(s => s.on).length} из 4–6, первое — обложка)`; }
    };
    el.oninput = e => { const t = e.target; if (t.dataset.t) scenes[+t.dataset.t].title = t.value; if (t.dataset.s) scenes[+t.dataset.s].sub = t.value; };
    el.onclick = onClick;
    cover();
  }
  const val = id => el.querySelector(id)?.value.trim() ?? '';
  const contact = () => ({ name: val('#v-name'), phone: val('#v-phone'), agency: val('#v-ag').replace(/^[«"]|[»"]$/g, ''), messengers: val('#v-msg'), address: val('#v-addr') });

  // ---------- описание к посту (этап 2 скилла): ЖК, 5–7 пунктов «◾️», цена по запросу, контакт, 3–4 хэштега; заголовок ----------
  let ai = null;
  function post() {
    const x = prep.items[0], c = contact(), one = prep.items.length === 1, price = el.querySelector('#v-price').checked;
    const head = one ? [x.zk || [x.rooms, x.kind].filter(Boolean).join(' '), x.new ? 'новостройка' : ''].filter(Boolean).join(' · ') : `${prep.items.length} объекта в Сочи`;
    const rules = one ? [[x.rooms, x.kind, area(x.area)].filter(Boolean).join(' '), x.floor ? `${x.floor} этаж из ${x.floors ?? '?'}` : '', x.place ? `${x.place}${x.district && x.district !== x.place ? `, ${x.district} район` : ''}` : '',
      x.sea_m ? `${km(x.sea_m)} до моря` : '', x.finish ? x.finish[0].toUpperCase() + x.finish.slice(1) : '', x.new ? 'Дом по 214-ФЗ' : '']
      : prep.items.map(i => [i.zk, i.rooms || i.kind, area(i.area), i.place, price && i.price ? H.mln(i.price) : ''].filter(Boolean).join(' · '));
    const bullets = (ai?.bullets?.length >= 3 ? ai.bullets : rules).filter(Boolean).slice(0, 7);
    const msg = c.messengers ? ` (${c.messengers})` : '';
    const tag = s => '#' + String(s).replace(/[^\p{L}\p{N}]/gu, '');
    const tags = ['#недвижимостьсочи', x.kind === 'апартаменты' ? '#апартаментысочи' : x.kind === 'дом' ? '#домвсочи' : '#квартирасочи', x.sea_m && x.sea_m <= 1000 ? '#уморя' : '#купитьквартирусочи', one && x.zk ? tag(x.zk) : ''].filter(Boolean).slice(0, 4);
    const text = [head, '', ...bullets.map(b => `◾️ ${b}`), '', val('#v-short'), '',
      price && one && x.price ? `💰 Цена: ${H.mln(x.price)}` : '💬 Цена — по запросу',
      `📞 ${c.phone} ${c.name}${msg}`.trim(), c.agency ? `🏢 Агентство «${c.agency}»${c.address ? `, ${c.address}` : ''}` : c.address ? `📍 ${c.address}` : '', '', tags.join(' ')]
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const f = val('#v-fish');
    const title = ai?.title || (one ? `${x.zk || [x.rooms, x.kind].filter(Boolean).join(' ')} — ${[x.kind, area(x.area)].filter(Boolean).join(' ')}${f ? `, ${f}` : ''}, Сочи` : `${prep.items.length} объекта в Сочи — видеообзор`);
    el.querySelector('#v-cap').value = text; el.querySelector('#v-title').value = title; el.querySelector('#v-post').hidden = false;
  }

  // ---------- кадры ----------
  const clamp = v => Math.min(Math.max(v, 0), 1);
  const easeIO = x => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; };
  const easeOut = x => { x = clamp(x); return x >= 1 ? 1 : 1 - 2 ** (-10 * x); };
  const load = src => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  // фото на весь кадр: низ 1/20 срезан, запас 12 % под зум 1.0↔1.1 и панораму (power2.inOut), направление чередуется
  function photo(ctx, img, p, idx, x0 = 0) {
    const iw = img.naturalWidth, ih = img.naturalHeight * 0.95, BW = W * 1.12, BH = HH * 1.12, s = Math.max(BW / iw, BH / ih);
    const offX = (iw * s - BW) / 2 / s, offY = (ih * s - BH) / 2 / s, e = easeIO(p), z = 1 + 0.1 * (idx % 2 === 0 ? e : 1 - e);
    const cw = BW / (1.06 * z), ch = BH / (1.06 * z), dx = (BW - cw) * (0.5 + (idx % 2 ? 0.35 : -0.35) * (e - 0.5)), dy = (BH - ch) * 0.5;
    ctx.drawImage(img, offX + dx / s, offY + dy / s, cw / s, ch / s, x0, 0, W, HH);
  }
  function shade(ctx) {   // затемнение снизу (под титры) и сверху (под бренд)
    let g = ctx.createLinearGradient(0, 820, 0, HH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,.82)');
    ctx.fillStyle = g; ctx.fillRect(0, 820, W, HH - 820);
    g = ctx.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);
  }
  const font = (w, px) => `${w} ${px}px ${FONT}`;
  function fit(ctx, text, w, px, min = 28, max = MAXW) { ctx.font = font(w, px); while (ctx.measureText(text).width > max && px > min) { px -= 2; ctx.font = font(w, px); } return px; }
  // слова появляются по очереди: размытие 6→0 и прозрачность за 0,13 с, шаг 0,067 с; уход — размытие за 0,13 с
  function words(ctx, list, x, y, tIn, tOut, t, w, px, colors) {
    ctx.font = font(w, px); ctx.textBaseline = 'top';
    const sp = ctx.measureText(' ').width;
    list.forEach((wd, i) => {
      let a = tIn == null ? 1 : easeOut((t - tIn - i * 0.067) / 0.13);
      if (tOut != null) a = Math.min(a, 1 - clamp((t - tOut - i * 0.03) / 0.13));
      if (a > 0.01) { ctx.save(); ctx.globalAlpha = a; const b = 6 * (1 - a); if (b > 0.3) ctx.filter = `blur(${b.toFixed(1)}px)`; ctx.fillStyle = colors[i] ?? colors.at(-1); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 12; ctx.fillText(wd, x, y); ctx.restore(); }
      x += ctx.measureText(wd).width + sp;
    });
  }
  function titles(ctx, title, sub, t, tIn, tOut) {
    const tw = String(title || '').split(/\s+/).filter(Boolean), sw = String(sub || '').split(/\s+/).filter(Boolean), x0 = 80;
    const tpx = fit(ctx, tw.join(' '), 700, 96, 56, W - 160), spx = sw.length ? fit(ctx, sw.join(' '), 500, 46, 30, W - 160) : 0;
    const y = SAFE_BOTTOM - tpx - 30 - (sw.length ? spx + 20 : 0) - 20;
    let pa = tIn == null ? 1 : easeOut((t - tIn) / 0.35); if (tOut != null) pa = Math.min(pa, 1 - clamp((t - tOut) / 0.15));
    if (pa > 0) { ctx.fillStyle = GOLD; ctx.fillRect(x0, y - 34, 120 * pa, 8); }
    words(ctx, tw, x0, y, tIn, tOut, t, 700, tpx, tw.length > 1 ? [GOLD, '#fff'] : ['#fff']);
    if (sw.length) words(ctx, sw, x0, y + tpx + 30, tIn == null ? null : tIn + 0.12, tOut, t, 500, spx, ['#ebebeb']);
  }
  function brand(ctx, s) {
    if (!s) return;
    const px = fit(ctx, s, 600, 34); ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillText(s, (W - ctx.measureText(s).width) / 2, SAFE_TOP); ctx.fillStyle = GOLD; ctx.fillRect((W - 60) / 2, SAFE_TOP + px + 22, 60, 4);
  }
  // финальный кадр: агентство / имя / телефон / мессенджеры / адрес (пустые — пропускаются; имена и телефоны не сокращаются — уменьшается шрифт)
  function card(c, ctx) {
    const L = []; let bar = null;
    const add = (text, w, px, color, gap) => { const p = fit(ctx, text, w, px); L.push({ text, w, px: p, color, gap }); };
    if (c.agency) { add('АГЕНТСТВО НЕДВИЖИМОСТИ', 500, 40, '#dcdcdc', 24); add(`«${c.agency}»`, 700, 120, GOLD, 76); if (c.name) { bar = L.length; add(c.name, 600, 62, '#fff', 70); } }
    else if (c.name) { add('НЕДВИЖИМОСТЬ', 500, 40, '#dcdcdc', 24); add(c.name, 700, 96, GOLD, 76); }
    if (c.phone) { if (bar == null) bar = L.length; add(c.phone, 700, 72, '#fff', 24); }
    if (c.messengers) add(c.messengers, 400, 38, '#e6e6e6', 26);
    if (c.address) add(c.address, 400, 40, '#e6e6e6', 26);
    const total = L.reduce((s, l) => s + l.px + l.gap, 0) - (L.at(-1)?.gap ?? 0);
    let y = (HH - total) / 2 - 60; for (const l of L) { l.y = y; y += l.px + l.gap; }
    return { L, bar };
  }
  async function build() {
    const on = scenes.filter(s => s.on).slice(0, 6);
    const imgs = []; for (const s of on) { try { imgs.push({ img: await load(s.u), s }); } catch { /* фото не загрузилось — пропуск */ } }
    if (!imgs.length) throw new Error('Фото не загрузились — проверьте интернет и попробуйте ещё раз');
    const n = imgs.length, kinds = imgs.slice(1).map((_, i) => i % 2 === 0 ? 'xf' : 'whip'), ov = kinds.map(k => k === 'xf' ? XF : WHIP);
    const seg = (BODY + ov.reduce((a, b) => a + b, 0)) / n, starts = []; let s = 0;
    for (let i = 0; i < n; i++) { starts.push(s); s += seg - (i < n - 1 ? ov[i] : 0); }
    const ends = starts.map(x => x + seg), c = contact(), hook = hookOf(), price = el.querySelector('#v-price').checked && prep.items.length === 1 && prep.items[0].price ? H.mln(prep.items[0].price) : '';
    if (price && n > 1) imgs[1].s = { ...imgs[1].s, title: price, sub: imgs[1].s.title };
    const brandText = c.agency ? `АГЕНТСТВО «${c.agency.toUpperCase()}»` : c.name.toUpperCase();
    // фон финального кадра: обложка размыта и затемнена (один раз)
    const endbg = document.createElement('canvas'); endbg.width = W; endbg.height = HH;
    const eb = endbg.getContext('2d'); eb.filter = 'blur(28px)'; photo(eb, imgs[0].img, 0.5, 0); eb.filter = 'none'; eb.fillStyle = 'rgba(0,0,0,.58)'; eb.fillRect(0, 0, W, HH);
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = HH; const tc = tmp.getContext('2d');
    return (ctx, t) => {
      if (t < BODY) {
        const act = []; for (let i = 0; i < n; i++) if (starts[i] <= t && t < ends[i]) act.push(i);
        if (!act.length) act.push(n - 1);
        const i = act.at(-1), p = k => (t - starts[k]) / (ends[k] - starts[k] + END * (k === n - 1));
        ctx.save(); ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, W, HH);
        if (act.length === 2) {
          const [j, k] = act, q = (t - starts[k]) / ov[j];
          if (kinds[j] === 'xf') { photo(ctx, imgs[j].img, p(j), j); ctx.globalAlpha = q; photo(ctx, imgs[k].img, p(k), k); ctx.globalAlpha = 1; }
          else { const off = W * easeIO(q), b = 40 * Math.sin(Math.PI * q); if (b > 1) ctx.filter = `blur(${b.toFixed(0)}px)`; photo(ctx, imgs[j].img, p(j), j, -off); photo(ctx, imgs[k].img, p(k), k, W - off); ctx.filter = 'none'; }
        } else photo(ctx, imgs[i].img, p(i), i);
        shade(ctx); brand(ctx, brandText);
        for (const k of act) {
          if (k === 0) titles(ctx, hook[0], hook[1], t, null, ends[0] - 0.35);
          else titles(ctx, imgs[k].s.title, imgs[k].s.sub, t, starts[k] + 0.15, k < n - 1 ? ends[k] - 0.3 : BODY - 0.3);
        }
        ctx.restore();
        if (t > BODY - 0.35) {   // в финальный кадр — размытие и растворение 0,35 с
          const q = (t - (BODY - 0.35)) / 0.35;
          tc.clearRect(0, 0, W, HH); tc.drawImage(ctx.canvas, 0, 0);
          ctx.save(); ctx.filter = `blur(${(20 * q).toFixed(0)}px)`; ctx.drawImage(tmp, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = easeIO(q); ctx.drawImage(endbg, 0, 0); ctx.restore();
        }
      } else {
        ctx.drawImage(endbg, 0, 0);
        const { L, bar } = card(c, ctx);
        L.forEach((l, li) => { ctx.font = font(l.w, l.px); words(ctx, [l.text], (W - ctx.measureText(l.text).width) / 2, l.y, BODY + li * 0.08, null, t, l.w, l.px, [l.color]); });
        if (bar != null) { const pa = easeOut((t - BODY - 0.2) / 0.4); ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 80 * pa, L[bar].y - 30, 160 * pa, 5); }
      }
    };
  }
  function check() {
    const c = contact();
    if (scenes.filter(s => s.on).length < 1) { H.toast('Отметьте хотя бы одно фото (лучше 4–6)'); return false; }
    if (val('#v-short').length < 15) { H.toast('Допишите короткое описание объекта — хотя бы одно предложение (или «✨ Написать ИИ»)', 5000); el.querySelector('#v-short').focus(); return false; }
    if (c.name.length < 2) { H.toast('Укажите имя — оно будет на финальном кадре', 4000); el.querySelector('#v-name').focus(); return false; }
    if (!/^[+\d\s()-]{6,30}$/.test(c.phone)) { H.toast('Укажите телефон цифрами, например +7 918 123-45-67', 4000); el.querySelector('#v-phone').focus(); return false; }
    return true;
  }
  async function cover() {   // обложка (1-й кадр) — сразу видно, как будет в ленте
    if (busy) return;
    const cv = el.querySelector('#v-cv'); if (!cv) return;
    try { const f = await build(); f(cv.getContext('2d'), 0.6); } catch (e) { /* фото ещё грузятся */ }
  }
  function mime() {
    for (const t of ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'])
      if (MediaRecorder.isTypeSupported(t)) return t;
    return '';
  }
  async function make() {
    if (busy || !check()) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return H.toast('Этот браузер не умеет собирать видео — откройте сайт в Chrome, Яндекс Браузере или Safari', 6000);
    const b = el.querySelector('[data-make]'); busy = true; b.disabled = true; b.textContent = 'Готовлю кадры…';
    try {
      if (el.querySelector('#v-save').checked) H.call('vid_profile', contact()).then(() => { prep.agent = contact(); }).catch(er => H.toast('Профиль не сохранён: ' + er.message, 5000));
      post();
      const frame = await build(), cv = el.querySelector('#v-out canvas') ?? (() => { el.querySelector('#v-out').innerHTML = `<canvas id="v-cv" width="${W}" height="${HH}" class="vid-cv"></canvas>`; return el.querySelector('#v-cv'); })();
      const ctx = cv.getContext('2d'), type = mime();
      frame(ctx, 0);
      const stream = cv.captureStream(FPS), rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 }), parts = [];
      rec.ondataavailable = e => e.data.size && parts.push(e.data);
      rec.start(250);
      const t0 = performance.now();
      await new Promise(done => {
        const step = () => {
          const t = (performance.now() - t0) / 1000;
          frame(ctx, Math.min(t, DUR - 0.001));
          b.textContent = `Собираю… ${Math.min(100, Math.round(t / DUR * 100))} %`;
          if (t >= DUR) return done();
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      rec.stop(); await new Promise(r => rec.onstop = r); stream.getTracks().forEach(x => x.stop());
      blob = new Blob(parts, { type: (rec.mimeType || type || 'video/webm').split(';')[0] });
      if (!blob.size) throw new Error('Видео не записалось — попробуйте в Chrome или Safari');
      const mp4 = blob.type.includes('mp4');
      el.querySelector('#v-out').innerHTML = `<video src="${URL.createObjectURL(blob)}" controls playsinline class="vid-cv" id="v-video"></video>`;
      actions(true, mp4);
      b.textContent = 'Загружаю на сервер…';
      try {
        const up = await H.call('vid_upload', { type: mp4 ? 'mp4' : 'webm', nums: prep.items.map(x => x.num), caption: el.querySelector('#v-cap').value });
        const r = await fetch(up.upload, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
        if (!r.ok) throw new Error(`Хранилище не приняло ролик (${r.status})`);
        job = await H.call('vid_done', { id: up.id, size: blob.size }); job.id = up.id;
        actions(false, mp4);
      } catch (er) { H.toast(`Ролик готов, но на сервер не загрузился: ${er.message}. Скачайте его кнопкой «Скачать».`, 7000); }
    } catch (er) { H.toast(er.message, 6000); }
    busy = false; b.disabled = false; b.textContent = '🎬 Собрать заново';
  }
  function actions(local, mp4) {
    const t = job?.expires_at ? new Date(job.expires_at).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) : '';
    const kb = Math.round(blob.size / 1024);
    el.querySelector('#v-actions').innerHTML = `<p class="hub-inline"><a class="btn primary" download="obzor.${mp4 ? 'mp4' : 'webm'}" href="${URL.createObjectURL(blob)}">⬇ Скачать ${mp4 ? 'MP4' : 'WebM'}</a>
      <button class="btn soft" data-share>📤 Поделиться</button></p>
      <p class="hint">${mp4 ? 'MP4' : 'WebM'}, 9:16, 10 с, ${kb > 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${kb} КБ`}.${mp4 ? '' : ' Этот браузер записывает видео только в WebM: Telegram, YouTube, VK и Rutube его принимают; для Instagram и WhatsApp-статуса откройте сайт в Safari или новом Chrome — там будет MP4.'}</p>
      <p class="hint">${local ? '⏳ Загружаю копию на сервер…' : `⏳ Копия на сервере удалится в ${t} МСК. Уведомление о готовности ушло в бот и push.`}</p>`;
  }
  async function share() {
    const file = new File([blob], `obzor.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: blob.type }), text = el.querySelector('#v-cap').value;
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); } catch { /* отмена */ } }
    else await H.copy(text, 'Описание скопировано — скачайте ролик и отправьте его в мессенджере');
  }
  async function aiText(b) {
    b.disabled = true; b.textContent = 'ИИ пишет… ~5–15 с';
    try {
      ai = await H.call('vid_text', { items: prep.items, hint: val('#v-short') });
      if (ai.short) el.querySelector('#v-short').value = ai.short.slice(0, 200);
      if (ai.fishka) el.querySelector('#v-fish').value = ai.fishka.split(/\s+/).slice(0, 4).join(' ');
      post(); cover(); H.toast('Готово — проверьте текст');
    } catch (er) { H.toast(er.message, 6000); }
    b.disabled = false; b.textContent = '✨ Написать ИИ ещё раз';
  }
  async function onClick(e) {
    if (e.target.closest('[data-make]')) return make();
    if (e.target.closest('[data-preview]')) return cover();
    if (e.target.closest('[data-ai]')) return aiText(e.target.closest('[data-ai]'));
    if (e.target.closest('[data-copy-cap]')) return H.copy(el.querySelector('#v-cap').value, 'Описание скопировано');
    if (e.target.closest('[data-copy-title]')) return H.copy(el.querySelector('#v-title').value, 'Заголовок скопирован');
    if (e.target.closest('[data-share]')) return share();
  }
  async function show(id) {
    try {
      const r = await H.call('vid_get', { id });
      el.innerHTML = `<h2>🎬 Ролик</h2><video src="${esc(r.url)}" controls playsinline class="vid-cv"></video><p class="hub-warn">⏳ Удалится в ${new Date(r.expires_at).toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' })} МСК.</p>
        <p><a class="btn primary" href="${esc(r.url)}" download>⬇ Скачать</a> <button class="btn soft" data-c="${esc(r.caption ?? '')}">Скопировать описание</button></p>`;
      el.onclick = e => { const c = e.target.closest('[data-c]'); if (c) H.copy(c.dataset.c); };
    } catch (er) { el.innerHTML = `<p class="err">${esc(er.message)}</p><a class="btn primary" href="#video">Собрать новый</a>`; }
  }
  window.SEC = window.SEC || {};
  window.SEC.video = { title: 'Видеообзор', open };
})();

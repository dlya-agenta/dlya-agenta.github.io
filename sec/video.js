// «Видеомонтаж-СММ» (тариф MAX; v5.16 — по скиллу «Видеообзор с контактами»; v5.26 — шаблон «Мотион», объекты по порядку, ИИ-режиссёр).
// Ролик 9:16, 30 кадров/с собирается прямо в браузере (canvas + MediaRecorder), без сервера и минут GitHub.
// v5.26 (задача Алексея 04.11): фото идут СТРОГО по объектам — сначала все кадры 1-го, потом 2-го…; на каждый объект — свои 15 секунд, до 10 объектов.
//   По 15 с на квартиру (уточнение Алексея 04.11). Один объект — ролик 15 с (12 с кадров + 3 с контакты с призывом позвонить). Несколько — крючок 1,6 с + по 15 с на объект + контакты 3 с в конце.
//   Шаблон «Мотион» (референс — моушн-реклама: цветные шторки, «выезд» слов из-под линии, плашки с цифрами, номер объекта 01/02):
//   переходы wipe (шторка акцентного цвета), zoom (влёт), card (карточка уезжает вверх), leak (засветка), iris (круг), whip (хлыст), xf (растворение);
//   плашки фактов «всплывают» с отскоком, площадь считается от нуля, полоса хода ролика сверху. «Классика» — прежний плавный ролик.
//   ИИ-режиссёр (Админка → ИИ → «Видеомонтаж», PRO и MAX): ИИ смотрит фото, ставит порядок кадров ВНУТРИ объекта, подписи и переходы — по тому же шаблону.
//   Описание к посту — 4 разных стиля (меняются сами, «🔀 Другой вариант»), под телефон: короткие строки, один факт — одна строка.
// Безопасные зоны: ничего важного выше 200 и ниже 1300 px (из 1920). Низ фото срезан на 1/20 (водяные знаки площадок). Сервер — hub/video.ts.
(() => {
  const H = window.HUB, esc = H.esc;
  const PH = 'https://arojogajdamsyrrpcmso.supabase.co/storage/v1/object/public/photos/w', MEDIA = 'https://zpkqduhbymvadtwgcyhp.supabase.co/storage/v1/object/public/photos/w';
  const W = 1080, HH = 1920, FPS = 30, PER = 15, ONE = 15, ENDS = 3, HOOK = 1.6, SAFE_TOP = 200, SAFE_BOTTOM = 1300, MAXW = W - 120;
  const ACC = { gold: '#d6b46a', sea: '#38bdf8', coral: '#fb7185', mint: '#34d399', sand: '#e9c99a' }, ACC_NAME = { gold: 'Золото', sea: 'Море', coral: 'Коралл', mint: 'Мята', sand: 'Песок' };
  const GOLD = ACC.gold, FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const FXM = ['wipe', 'zoom', 'card', 'leak', 'iris', 'whip'], FXC = ['xf', 'whip'];
  let el = null, prep = null, scenes = [], cov = 0, blob = null, job = null, busy = false, opt = { tpl: 'motion', acc: 'gold', style: -1 }, aiPlan = null;
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } } };
  const url = (num, k, v = 2) => v === 3 ? `${MEDIA}/${num}/${k}.jpg` : k < 4 ? `${PH}/${num}/${k}.jpg` : `${MEDIA}/${num}/${k}.webp`;
  const km = m => m >= 1000 ? `${(m / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} км` : `${Math.round(m / 10) * 10} м`;
  const area = a => a ? `${String(a).replace('.', ',')} м²` : '';
  const objW = n => n % 10 === 1 && n % 100 !== 11 ? 'объект' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'объекта' : 'объектов';
  const css = `.vid-steps{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;min-width:0}.vid-step{min-width:0;grid-template-columns:minmax(0,1fr)}.vid-step>*{min-width:0}.vid-step .btn{white-space:normal;max-width:100%}.vid-opt label{min-width:0}.vid-ph{display:flex;flex-wrap:wrap;gap:8px}.vid-ph label{position:relative;width:92px;cursor:pointer}
    .vid-ph img{width:92px;height:122px;object-fit:cover;border-radius:10px;display:block;border:3px solid transparent}.vid-ph input{position:absolute;left:6px;top:6px;z-index:1}
    .vid-ph input:checked+img{border-color:${GOLD}}.vid-ph b{position:absolute;right:6px;top:4px;background:#0009;color:#fff;border-radius:8px;padding:0 6px;font-size:12px}
    .vid-pc{position:absolute;left:0;right:0;bottom:3px;display:flex;justify-content:center;gap:4px}.vid-pc button{width:28px;height:28px;border:0;border-radius:8px;background:#000a;color:#fff;font-size:15px;line-height:1;cursor:pointer}.vid-pc button:disabled{opacity:.35}
    .vid-add{width:92px;height:122px;border:2px dashed var(--line);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-weight:600;cursor:pointer;color:var(--accent)}.vid-add small{color:var(--muted);font-weight:400}
    .vid-od{margin-top:8px}.vid-od textarea{width:100%}.vid-orm{margin:4px 0 0}.vid-more{display:flex;flex-wrap:wrap;gap:8px}
    .vid-ownf{position:fixed;inset:0;z-index:1000;background:#0008;display:flex;align-items:center;justify-content:center;padding:12px}.vid-ownc{background:var(--card,#fff);color:var(--text);border-radius:16px;padding:16px;max-width:560px;width:100%;max-height:92vh;overflow:auto}
    .vid-ownc .field input,.vid-ownc .field select,.vid-ownc textarea{font-size:16px;width:100%}.vid-add-big{cursor:pointer;min-height:46px;display:inline-flex;align-items:center}
    .vid-ph i{position:absolute;left:4px;right:4px;bottom:4px;background:#000a;color:#fff;border-radius:6px;padding:1px 4px;font-size:11px;font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .vid-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 12px}.vid-grid .field{margin:0}.vid-grid input,.vid-grid textarea,.vid-grid select{width:100%}
    .vid-sc{display:grid;grid-template-columns:48px 1fr 1fr;gap:6px;align-items:center;margin:4px 0}.vid-sc img{width:48px;height:64px;object-fit:cover;border-radius:6px}
    .vid-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,380px);gap:16px;align-items:start}.vid-cv{width:100%;max-width:360px;aspect-ratio:9/16;border-radius:14px;background:#0b0e14;display:block}
    .vid-make{position:sticky;top:12px}
    .vid-need{color:#b91c1c;font-weight:600}.vid-obj{display:flex;flex-wrap:wrap;gap:6px}.vid-obj span{background:var(--soft,#eef3ff);border-radius:10px;padding:4px 10px;font-size:13px}
    .vid-step h3{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:18px}.vid-step h3 small{flex-basis:100%;font-size:13px;font-weight:500;padding-left:40px}.vid-n{flex:none;width:30px;height:30px;border-radius:50%;background:${GOLD};color:#1b1b1b;display:grid;place-items:center;font-weight:800;font-size:16px}
    .vid-cov{display:flex;flex-wrap:wrap;gap:10px}.vid-cov label{position:relative;cursor:pointer}.vid-cov input{position:absolute;opacity:0}.vid-cov img{width:104px;height:138px;object-fit:cover;border-radius:12px;display:block;border:4px solid transparent}
    .vid-cov input:checked+img{border-color:${GOLD}}.vid-cov input:focus-visible+img{outline:2px solid ${GOLD};outline-offset:2px}.vid-cov em{position:absolute;left:6px;bottom:6px;background:${GOLD};color:#1b1b1b;font-style:normal;font-weight:700;font-size:12px;border-radius:8px;padding:1px 7px}
    .vid-ob{border:1px solid var(--line,#d9dee8);border-radius:14px;padding:10px;display:grid;gap:8px}.vid-ob+.vid-ob{margin-top:10px}
    .vid-oh{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.vid-oh b{font-size:15px;min-width:0;overflow-wrap:anywhere}.vid-oh .k{flex:none;min-width:34px;height:26px;border-radius:8px;background:${GOLD};color:#1b1b1b;display:grid;place-items:center;font-weight:800;font-size:13px}
    .vid-oh .sp{flex:1}.vid-oh button{padding:4px 10px;min-height:30px}
    .vid-opt{display:flex;flex-wrap:wrap;gap:8px}.vid-opt label{display:flex;align-items:center;gap:6px;border:1px solid var(--line,#d9dee8);border-radius:12px;padding:8px 12px;cursor:pointer}
    .vid-opt input:checked+span{font-weight:700}.vid-dot{width:16px;height:16px;border-radius:50%;display:inline-block}
    .vid-send{display:grid;gap:10px;margin-top:8px}.vid-big{font-size:17px;padding:14px 18px;width:100%}.vid-tg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
    .vid-to{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#d9dee8);background:var(--card,#fff);color:inherit;cursor:pointer;font:inherit}
    .vid-to b{font-size:15px}.vid-to small{font-size:12px;opacity:.75}.vid-to .ok{color:#15803d;opacity:1;font-weight:600}.vid-to a{font-size:12px}
    .vid-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.vid-item{border:1px solid var(--line,#d9dee8);border-radius:14px;padding:10px;display:grid;gap:8px;min-width:0}
    .vid-item video{width:100%;aspect-ratio:9/16;max-height:340px;border-radius:10px;background:#0b0e14;object-fit:contain}.vid-item .row{display:flex;flex-wrap:wrap;gap:6px}
    #v-cap{font-size:15px;line-height:1.45}
    @media (max-width:760px){.vid-two{grid-template-columns:minmax(0,1fr)}.vid-make{position:static}.vid-cv{max-height:62vh;width:auto;margin:0 auto}.vid-sc{grid-template-columns:40px 1fr}.vid-sc input:last-child{grid-column:2}.vid-ph label,.vid-ph img{width:84px}.vid-ph img{height:112px}}`;
  const addCss = () => { if (!document.getElementById('vid-css')) { const s = document.createElement('style'); s.id = 'vid-css'; s.textContent = css; document.head.appendChild(s); } };

  async function open(arg, ctx) {
    el = ctx.el; addCss();
    if (!ctx.caps?.can?.video) { el.innerHTML = H.locked('Видеомонтаж-СММ', 'Видеообзор объектов за минуту: ролик 9:16 из фото — по 15 секунд на каждую квартиру, с вашим именем и контактами на финальном кадре, плюс готовое описание к посту — для Reels, Shorts, статусов и Rutube. В тарифе MAX.', 'max'); return; }
    if (/^\d+$/.test(arg) && +arg < 100000) return show(+arg);   // готовый ролик по ссылке из уведомления
    const nums = [...new Set((arg ? arg.split(',') : []).map(Number).filter(n => n > 100000))].slice(0, 10);
    if (arg === 'own') return ownStart();   // v5.42B: ролик из своего объекта — фото с телефона
    if (!nums.length) return empty();
    el.innerHTML = '<p class="muted">Готовлю фото и характеристики…</p>';
    try { prep = await H.call('vid_prepare', { nums }); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (!prep.pick.length) { el.innerHTML = '<h2>🎬 Видеообзор</h2><p>У выбранных объектов ещё нет фото в нашем хранилище — они загружаются ночью. Выберите другие объекты.</p><p><a class="btn primary" href="./">К объявлениям</a></p>'; return; }
    blob = null; job = null; aiPlan = null; cov = 0;
    opt = { tpl: prep.tpl === 'classic' ? 'classic' : 'motion', acc: 'gold', style: -1 };
    // объекты без своих фото — убираем из ролика (иначе у объекта были бы пустые 15 секунд)
    const withPh = new Set(prep.pick.map(p => p.num)), skipped = prep.items.filter(x => !withPh.has(x.num));
    prep.items = prep.items.filter(x => withPh.has(x.num)); prep.skipped = skipped;
    scenes = prep.pick.map(p => ({ u: p.u ?? url(p.num, p.k, p.v), num: p.num, k: p.k, on: true, title: '', sub: '', fx: null }));   // v5.42B: у эксклюзива — готовый адрес фото
    retitle();
    draw();
  }
  // без выбранных объектов: как выбрать + номера вручную + из «Избранного» на главной
  function empty() {
    const sel = store.get('sel', []).filter(n => n > 100000);
    el.innerHTML = `<h2>🎬 Видеообзор объектов</h2>
      <p>Ролик 9:16 из фото: по 15 секунд на каждую квартиру (до 10 в одном ролике), контакты и призыв позвонить — в конце — с вашим именем и контактами. Для Reels, Shorts, статусов и Rutube.</p>
      <ol><li>На главной отметьте объекты галочкой «В подборку» — в выдаче, в «★ Избранном» или нажмите «В подборку» у подборки в «Мои подборки».</li>
        <li>Внизу появится полоса выбора — нажмите <b>«🎬 Ролик»</b>. Объекты пойдут в ролике в том порядке, в каком вы их отметили.</li><li>Или попросите помощника: «сделай ролик по № 172480».</li></ol>
      ${sel.length ? `<p><button class="btn primary" data-sel-go="${sel.slice(0, 10).join(',')}">🎬 Ролик из отмеченных на главной (${Math.min(sel.length, 10)})</button></p>` : ''}
      <form class="hub-ask" id="v-nums"><input id="v-n" placeholder="Или номера объектов через запятую: 172480, 188198" inputmode="numeric" aria-label="Номера объектов"><button class="btn primary">Сделать ролик</button></form>
      <p><a class="btn soft" href="#video=own">📷 Свой объект — фото с телефона</a> <a class="btn soft" href="excl.html">💎 Из «Эксклюзивов»</a> <a class="btn soft" href="./">К объявлениям</a> <a class="btn soft" href="#helper">🤖 Помощник</a></p>
      <section class="hub-sec"><h3>Мои ролики за 12 часов</h3><div id="v-mine"><p class="muted">Загрузка…</p></div></section>`;
    mine();
    el.onclick = e => { const b = e.target.closest('[data-sel-go]'); if (b) location.hash = `video=${b.dataset.selGo}`; else onSend(e); };
    el.querySelector('#v-nums').onsubmit = e => { e.preventDefault(); const n = [...new Set(el.querySelector('#v-n').value.match(/\d{6}/g) ?? [])].slice(0, 10); if (!n.length) return H.toast('Введите номера объектов (6 цифр)'); location.hash = `video=${n.join(',')}`; };
  }
  const itemOf = num => prep.items.find(x => x.num === num) ?? prep.items[0];
  const oIdx = num => Math.max(0, prep.items.findIndex(x => x.num === num));
  const multi = () => prep.items.length > 1;
  const finUp = x => x.finish ? x.finish[0].toUpperCase() + x.finish.slice(1) : '';
  // подписи сцен (≤ 4 слов в названии, ≤ 5 в подзаголовке) — по каждому объекту отдельно: 1-й кадр объекта — что это, дальше — факты
  function capsOf(x, j, last) {
    const what = [x.rooms, x.kind === 'квартира' && x.rooms ? '' : x.kind].filter(Boolean).join(' ') || 'Объект';
    const T = [
      { title: x.place || 'Сочи', sub: [area(x.area), x.floor ? `${x.floor}/${x.floors ?? '?'} этаж` : ''].filter(Boolean).join(' · ') },
      x.sea_m && x.sea_m < 3000 ? { title: `${km(x.sea_m)} до моря`, sub: finUp(x) } : { title: finUp(x) || 'Готов к показу', sub: x.district ? `${x.district} район` : 'Сочи' },
      { title: finUp(x) || what, sub: x.new ? 'Новостройка' : 'Готовый дом' },
      { title: 'Запишитесь на показ', sub: 'Покажем в удобное время' },
    ];
    if (j === 0) return { title: x.zk || what, sub: [x.zk ? what : '', area(x.area)].filter(Boolean).join(' · ') };
    if (last) return T[3];
    return T[(j - 1) % 3];
  }
  function retitle() {   // подписи заново по порядку кадров внутри каждого объекта (ручные правки и подписи ИИ — сохраняются)
    prep.items.forEach((x, o) => {
      const list = scenes.filter(s => s.num === x.num && s.on), lastObj = o === prep.items.length - 1;
      list.forEach((s, j) => { if (s.own) return; Object.assign(s, capsOf(x, j, lastObj && j === list.length - 1 && list.length > 2)); });
    });
  }
  const hookOf = () => { const x = prep.items[0], f = el?.querySelector('#v-fish')?.value.trim() ?? x.fishka;
    const n = prep.items.length, places = [...new Set(prep.items.map(i => i.place).filter(Boolean))];
    if (n > 1) return [`${n} ${objW(n)} в Сочи`, f || places.slice(0, 3).join(' · ')];
    return [x.zk || [x.rooms, x.kind].filter(Boolean).join(' ') || 'Объект', [area(x.area), f].filter(Boolean).join(' · ')]; };
  const durOf = () => multi() ? HOOK + PER * prep.items.length + ENDS : ONE;

  function objBlock(x, o) {
    const list = scenes.map((s, i) => [s, i]).filter(([s]) => s.num === x.num), n = prep.items.length;
    return `<div class="vid-ob" data-ob="${o}"><div class="vid-oh"><span class="k">${n > 1 ? String(o + 1).padStart(2, '0') : '№'}</span><b>№ ${x.num} · ${esc([x.zk, x.rooms || x.kind, area(x.area), x.place].filter(Boolean).join(' · '))}</b><span class="sp"></span>
        ${n > 1 ? `<button class="btn ghost" data-mv="${o}:-1"${o === 0 ? ' disabled' : ''} aria-label="Раньше">↑</button><button class="btn ghost" data-mv="${o}:1"${o === n - 1 ? ' disabled' : ''} aria-label="Позже">↓</button>` : ''}</div>
      <div class="vid-ph">${list.map(([s, i], j) => `<label><input type="checkbox" data-on="${i}"${s.on ? ' checked' : ''} aria-label="Фото ${j + 1}"><img src="${esc(s.u)}" alt="" crossorigin="anonymous"><b>${j + 1}</b>${s.on && s.title ? `<i>${esc(s.title)}</i>` : ''}
          <span class="vid-pc"><button type="button" data-pm="${i}:-1"${j === 0 ? ' disabled' : ''} aria-label="Раньше">‹</button><button type="button" data-pm="${i}:1"${j === list.length - 1 ? ' disabled' : ''} aria-label="Позже">›</button><button type="button" data-pdel="${i}" aria-label="Удалить фото">✕</button></span></label>`).join('')}
        ${list.length < 9 ? `<label class="vid-add">＋ Фото<small>${list.length} из 9</small><input type="file" accept="image/*" multiple data-padd="${x.num}" hidden></label>` : ''}</div>
      <label class="field vid-od">Своё описание объекта (пойдёт в пост)<textarea data-od="${x.num}" rows="2" maxlength="300" placeholder="Например: евроремонт, вид на горы, 7 минут до моря пешком">${esc(x.descr_own ?? '')}</textarea></label>
      ${n > 1 ? `<p class="vid-orm"><button type="button" class="linkish" data-odel="${o}">Убрать объект из ролика</button></p>` : ''}</div>`;
  }
  function draw() {
    const a = prep.agent, x = prep.items[0], need = !a.name || !a.phone, n = prep.items.length, d = Math.round(durOf());
    el.innerHTML = `<h2>🎬 Видеообзор ${n > 1 ? `${n} ${objW(n)}` : 'объекта'}</h2>
      <p class="hint">Роликов сегодня: ${prep.used} из ${prep.lim}. Ролик ~${d} с, 9:16${n > 1 ? ` — по 15 секунд на каждый объект, строго по порядку, контакты — в конце` : ''}; финальный кадр — ваше имя и контакты. Готовый ролик хранится на сервере 12 часов — он будет в «Моих роликах».</p>
      ${prep.skipped?.length ? `<p class="hub-warn">Без фото в нашем хранилище, в ролик не вошли: № ${prep.skipped.map(s => s.num).join(', № ')} (фото загружаются ночью).</p>` : ''}
      <div class="vid-two">
        <div class="vid-steps">
          <section class="hub-sec vid-step"><h3><span class="vid-n">1</span>Обложка — первый кадр ролика</h3>
            <p class="hint">Обложку видно в ленте и в статусах до того, как ролик начнут смотреть. Нажмите на самое яркое фото.${n > 1 ? ' Порядок объектов от неё не меняется.' : ''}</p>
            <div class="vid-cov" role="radiogroup" aria-label="Обложка">${scenes.map((s, i) => `<label><input type="radio" name="v-cover" data-cover="${i}"${i === cov ? ' checked' : ''} aria-label="Фото ${i + 1}"><img src="${esc(s.u)}" alt="" crossorigin="anonymous">${i === cov ? '<em>Обложка</em>' : ''}</label>`).join('')}</div></section>
          <section class="hub-sec vid-step"><h3><span class="vid-n">2</span>${n > 1 ? 'Объекты и фото — по порядку' : 'Фото в ролике'} <small class="muted" id="v-cnt">${cntText()}</small></h3>
            ${prep.items.map(objBlock).join('')}
            ${n < 10 ? `<p class="vid-more"><button type="button" class="btn soft" data-own-add>📷 ＋ Свой объект</button><button type="button" class="btn soft" data-x-add>💎 ＋ Эксклюзив по номеру</button></p>` : ''}
            <details><summary>Подписи сцен (до 4 слов, подзаголовок до 5)</summary>${scenes.map((s, i) => !s.on ? '' : `<div class="vid-sc"><img src="${esc(s.u)}" alt="" crossorigin="anonymous">
              <input data-t="${i}" value="${esc(s.title)}" maxlength="40" aria-label="Название сцены ${i + 1}"><input data-s="${i}" value="${esc(s.sub)}" maxlength="50" aria-label="Подзаголовок сцены ${i + 1}"></div>`).join('')}</details></section>
          <section class="hub-sec vid-step"><h3><span class="vid-n">3</span>Стиль ролика</h3>
            <div class="vid-opt" role="radiogroup" aria-label="Шаблон">
              <label><input type="radio" name="v-tpl" value="motion"${opt.tpl === 'motion' ? ' checked' : ''}><span>⚡ «Мотион» — динамичный: шторки, влёт, плашки с цифрами</span></label>
              <label><input type="radio" name="v-tpl" value="classic"${opt.tpl === 'classic' ? ' checked' : ''}><span>🌙 «Классика» — плавный, спокойный</span></label></div>
            <div class="vid-opt" role="radiogroup" aria-label="Цвет акцента" style="margin-top:8px">${Object.entries(ACC).map(([k, c]) => `<label><input type="radio" name="v-acc" value="${k}"${opt.acc === k ? ' checked' : ''}><span class="vid-dot" style="background:${c}"></span><span>${ACC_NAME[k]}</span></label>`).join('')}</div>
            ${prep.ai ? `<p style="margin-top:10px"><button class="btn soft" data-plan>🎬 ИИ-режиссёр: подобрать порядок фото и подписи</button> <small class="muted">ИИ посмотрит фото и расставит лучшие кадры внутри каждого объекта по шаблону. ${aiPlan ? '✓ применено' : ''}</small></p>` : ''}</section>
          <section class="hub-sec vid-step"><h3><span class="vid-n">4</span>Описание <span class="vid-need">*</span></h3>
            <div class="vid-grid"><label class="field" style="grid-column:1/-1">Коротко ${n > 1 ? 'о подборке' : 'об объекте'} — обязательно (до 200 знаков, пойдёт в описание к посту)
              <textarea id="v-short" rows="3" maxlength="200" placeholder="Например: светлая двушка с видом на горы, 10 минут пешком до парка «Ривьера», тихий двор">${esc(prep.short ?? '')}</textarea></label>
              <label class="field">Фишка для обложки (до 4 слов)<input id="v-fish" value="${esc(n > 1 ? '' : x.fishka ?? '')}" maxlength="40" placeholder="например: вид на море"></label>
              </div>
            <label class="hub-chk"><input type="checkbox" id="v-price"> Показать цену в ролике и в описании${x.price && n === 1 ? ` (${esc(H.mln(x.price))})` : ''}</label>
            <p><button class="btn soft" data-ai>✨ Написать ИИ</button> <small class="muted">ИИ пишет только по характеристикам объекта — проверьте текст.</small></p></section>
          <section class="hub-sec vid-step"><h3><span class="vid-n">5</span>Ваше имя и контакты ${need ? '<span class="vid-need">* в профиле их нет — заполните</span>' : '<small class="muted">из профиля</small>'}</h3>
            <div class="vid-grid"><label class="field">Имя и фамилия *<input id="v-name" value="${esc(a.name)}" maxlength="80" autocomplete="name"></label>
              <label class="field">Телефон *<input id="v-phone" value="${esc(a.phone)}" maxlength="30" inputmode="tel" autocomplete="tel" placeholder="+7 918 123-45-67"></label>
              <label class="field">Агентство<input id="v-ag" value="${esc(a.agency)}" maxlength="120" placeholder="без агентства — крупно имя"></label>
              <label class="field">Мессенджеры<input id="v-msg" value="${esc(a.messengers)}" maxlength="120" placeholder="WhatsApp · Telegram @ник"></label>
              <label class="field" style="grid-column:1/-1">Адрес офиса<input id="v-addr" value="${esc(a.address)}" maxlength="160" placeholder="по желанию"></label></div>
            <label class="hub-chk"><input type="checkbox" id="v-save"${need ? ' checked' : ''}> Сохранить в профиль — в следующий раз подставятся сами</label></section>
          <section class="hub-sec" id="v-post" hidden><h3>Описание к посту — скопируется само при отправке</h3>
            <label class="field">Заголовок (YouTube, Rutube, Дзен)<input id="v-title" maxlength="120"></label>
            <textarea id="v-cap" rows="14" maxlength="3000"></textarea>
            <p><button class="btn primary" data-copy-cap>Скопировать описание</button> <button class="btn soft" data-restyle>🔀 Другой вариант</button> <button class="btn soft" data-copy-title>Скопировать заголовок</button></p></section>
        </div>
        <section class="hub-sec vid-step vid-make"><h3><span class="vid-n">6</span>Соберите ролик</h3><div id="v-out"><canvas id="v-cv" width="${W}" height="${HH}" class="vid-cv"></canvas></div>
          <p><button class="btn primary" data-make>🎬 Собрать ролик (~${d} с)</button> <button class="btn ghost" data-preview>Обложка</button></p>
          <p class="hint">Пока ролик собирается, не сворачивайте вкладку — браузер записывает его в реальном времени.</p><div id="v-actions"></div></section>
      </div>`;
    el.onchange = e => {
      const pa = e.target.closest('[data-padd]');
      if (pa && pa.files?.length) { addPhotos(+pa.dataset.padd, pa.files); pa.value = ''; return; }
      const c = e.target.closest('[data-on]');
      if (c) { scenes[+c.dataset.on].on = c.checked; if (!scenes.some(s => s.on && s.num === scenes[+c.dataset.on].num)) { c.checked = true; scenes[+c.dataset.on].on = true; return H.toast('У объекта должно остаться хотя бы одно фото'); } retitle(); redraw(); return; }
      const cv = e.target.closest('[data-cover]');
      if (cv) {
        const k = +cv.dataset.cover;
        if (!multi() && k > 0) {   // один объект: выбранное фото — первым (обложка), подписи — заново по порядку
          const s0 = { ...scenes[k], on: true };
          scenes = [s0, ...scenes.filter((_, i) => i !== k)].map(s => ({ ...s, own: false })); cov = 0; retitle();
        } else cov = k;
        redraw(); H.toast('Обложка выбрана');
        return;
      }
      if (e.target.name === 'v-tpl') { opt.tpl = e.target.value; cover(); }
      if (e.target.name === 'v-acc') { opt.acc = e.target.value; cover(); }
    };
    el.oninput = e => { const t = e.target; if (t.dataset.od) { const it = prep.items.find(x => x.num === +t.dataset.od); if (it) it.descr_own = t.value; return; } if (t.dataset.t) { scenes[+t.dataset.t].title = t.value; scenes[+t.dataset.t].own = true; } if (t.dataset.s) { scenes[+t.dataset.s].sub = t.value; scenes[+t.dataset.s].own = true; } };
    el.onclick = onClick;
    cover();
  }
  const cntText = () => { const on = scenes.filter(s => s.on).length; return multi() ? `в ролике ${on} фото: по 2–5 на объект, на каждый объект — 15 секунд` : `в ролике ${on} фото вместе с обложкой (лучше 4–6)`; };
  // перерисовать окно, не теряя введённое
  function redraw() {
    const keep = { short: val('#v-short'), fish: val('#v-fish'), price: el.querySelector('#v-price')?.checked, c: contact(), save: el.querySelector('#v-save')?.checked };
    draw();
    el.querySelector('#v-short').value = keep.short; el.querySelector('#v-fish').value = keep.fish; el.querySelector('#v-price').checked = !!keep.price; el.querySelector('#v-save').checked = !!keep.save;
    [['#v-name', 'name'], ['#v-phone', 'phone'], ['#v-ag', 'agency'], ['#v-msg', 'messengers'], ['#v-addr', 'address']].forEach(([id, k2]) => el.querySelector(id).value = keep.c[k2]);
  }
  function move(o, dir) {   // объект раньше/позже: кадры объекта переезжают вместе с ним
    const j = o + dir; if (j < 0 || j >= prep.items.length) return;
    const it = prep.items; [it[o], it[j]] = [it[j], it[o]];
    const cu = scenes[cov]?.u;
    scenes = it.flatMap(x => scenes.filter(s => s.num === x.num)); cov = Math.max(0, scenes.findIndex(s => s.u === cu));
    retitle(); redraw();
  }
  const val = id => el.querySelector(id)?.value.trim() ?? '';
  const contact = () => ({ name: val('#v-name'), phone: val('#v-phone'), agency: val('#v-ag').replace(/^[«"]|[»"]$/g, ''), messengers: val('#v-msg'), address: val('#v-addr') });

  // ---------- описание к посту (v5.26): 4 стиля по очереди — чтобы посты не были «под копирку»; под телефон: короткие строки, один факт — строка ----------
  let ai = null;
  const phoneFmt = p => { const d = String(p).replace(/\D/g, ''); const m = d.length === 11 && /^[78]/.test(d) ? d.slice(1) : d.length === 10 ? d : null;
    return m ? `+7 ${m.slice(0, 3)} ${m.slice(3, 6)}-${m.slice(6, 8)}-${m.slice(8)}` : String(p).trim(); };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function factsOf(i, price) {   // строки одного объекта: «2-комн. · 45,2 м²», «Раздольное, ЖК Сочи-Парк»
    const what = [i.rooms || (i.kind !== 'квартира' ? i.kind : ''), area(i.area)].filter(Boolean).join(' · ');
    const where = [i.place, i.zk].filter(Boolean).join(', ');
    const extra = [i.floor ? `${i.floor}/${i.floors ?? '?'} эт.` : '', i.sea_m && i.sea_m <= 1500 ? `${km(i.sea_m)} до моря` : '', i.finish].filter(Boolean).slice(0, 2).join(' · ');
    return { what, where, extra: [extra, i.descr_own?.trim()].filter(Boolean).join(' · '), price: price && i.price ? H.mln(i.price) : '' };   // v5.42B: своё описание объекта — в пост
  }
  function post() {
    const x = prep.items[0], c = contact(), one = prep.items.length === 1, price = el.querySelector('#v-price').checked, n = prep.items.length;
    if (opt.style < 0) opt.style = Math.floor(Math.random() * 4);
    const st = opt.style % 4, short = val('#v-short'), phone = phoneFmt(c.phone), msg = c.messengers;
    const kindUp = x.kind === 'апартаменты' ? 'Апартаменты' : x.kind === 'дом' ? 'Дом' : x.kind === 'участок' ? 'Участок' : x.kind === 'коммерция' ? 'Коммерция' : 'Квартира';
    const headOne = x.zk || `${kindUp} · ${x.place || 'Сочи'}`;
    const F = prep.items.map(i => factsOf(i, price));
    if (one) F[0].where = x.zk && x.place ? x.place : '';   // место уже в заголовке — не повторять
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const tag = s => '#' + String(s).replace(/[^\p{L}\p{N}]/gu, '');
    const pool = ['#недвижимостьсочи', '#сочинедвижимость', '#квартиравсочи', '#жильевсочи', '#переездвсочи', '#сочи2026', '#купитьквартирусочи', '#новостройкисочи'];
    const tags = [...new Set([x.kind === 'апартаменты' ? '#апартаментысочи' : x.kind === 'дом' ? '#домвсочи' : pick(['#квартирасочи', '#квартиравсочи']), pick(pool), pick(pool), one && x.zk ? tag(x.zk) : ''])].filter(Boolean).slice(0, 3);
    const ag = c.agency ? `«${c.agency}»` : '';
    const pr = one && price && x.price ? H.mln(x.price) : '';
    const L = [];
    if (st === 0) {   // «Карточки»: номер объекта, что и где — отдельными строками
      L.push(one ? headOne : `Подборка: ${n} ${objW(n)} в Сочи`, '');
      F.forEach((f, k) => { L.push(`${one ? '🏠' : nums[k]} ${f.what}`); if (f.where) L.push(f.where); if (f.extra) L.push(f.extra); if (f.price) L.push(`💰 ${f.price}`); L.push(''); });
      if (short) L.push(short, '');
      L.push(pr ? `Цена: ${pr}` : 'Цена — по запросу', `📲 ${phone} · ${c.name}`, msg ? msg : '', ag ? `🏢 ${ag}` : '');
    } else if (st === 1) {   // «Коротко»: список с тире, всё по делу
      L.push(one ? `${x.place || 'Сочи'} · ${F[0].what}` : `Сочи · ${n} ${n < 5 ? 'варианта' : 'вариантов'} ↓`, '');
      F.forEach(f => { L.push(`— ${f.what}`); L.push(`   ${[f.where, f.extra, f.price].filter(Boolean).join(' · ')}`.replace(/^ +$/, '')); });
      L.push('', short, '', pr ? `${pr}` : 'Стоимость уточняйте', `Звоните: ${phone}`, [c.name, ag].filter(Boolean).join(', '), msg);
    } else if (st === 2) {   // «Вопрос»: крючок вопросом
      L.push(one ? pick(['Ищете жильё в Сочи?', 'Присматриваетесь к Сочи?', 'Переезжаете к морю?']) : pick([`Выбираете квартиру в Сочи? Вот ${n} ${n < 5 ? 'варианта' : 'вариантов'}:`, `${n} ${n < 5 ? 'свежих варианта' : 'свежих вариантов'} в Сочи — смотрите ролик`]), '');
      F.forEach((f, k) => { L.push(`${one ? '▫️' : `${k + 1}.`} ${[f.what, f.where].filter(Boolean).join(' — ')}`); if (f.extra || f.price) L.push(`    ${[f.extra, f.price].filter(Boolean).join(' · ')}`); });
      L.push('', short, '', pr ? `Цена ${pr}` : 'Цену и планировку пришлю в личку', `${c.name}${ag ? `, ${ag}` : ''}`, `☎️ ${phone}`, msg);
    } else {   // «Минимал»: без эмодзи-цифр, точки-разделители
      L.push(one ? headOne : `${n} ${objW(n)} · Сочи`, '');
      F.forEach(f => { L.push(`• ${[f.what, f.where].filter(Boolean).join(', ')}`); if (f.extra) L.push(`  ${f.extra}`); if (f.price) L.push(`  ${f.price}`); });
      L.push('', short, '', pr || 'Цена по запросу', `${phone}`, [c.name, ag, msg].filter(Boolean).join(' · '));
    }
    if (c.address) L.push(`📍 ${c.address}`);
    L.push('', tags.join(' '));
    const text = L.filter(s => s != null).join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const f = val('#v-fish');
    const title = ai?.title || (one ? `${x.zk || [x.rooms, x.kind].filter(Boolean).join(' ')} — ${[x.kind, area(x.area)].filter(Boolean).join(' ')}${f ? `, ${f}` : ''}, Сочи` : `${n} ${objW(n)} в Сочи — видеообзор`);
    el.querySelector('#v-cap').value = text; el.querySelector('#v-title').value = title; el.querySelector('#v-post').hidden = false;
  }

  // ---------- кадры ----------
  const clamp = v => Math.min(Math.max(v, 0), 1);
  const easeIO = x => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2; };
  const easeOut = x => { x = clamp(x); return x >= 1 ? 1 : 1 - 2 ** (-10 * x); };
  const easeBack = x => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
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
    g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
  }
  const font = (w, px) => `${w} ${px}px ${FONT}`;
  function fit(ctx, text, w, px, min = 28, max = MAXW) { ctx.font = font(w, px); while (ctx.measureText(text).width > max && px > min) { px -= 2; ctx.font = font(w, px); } return px; }
  function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // «Классика»: слова появляются по очереди — размытие 6→0 и прозрачность за 0,13 с, шаг 0,067 с
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
  // «Мотион»: слова «выезжают» снизу из-под невидимой линии (маска), с лёгким отскоком; уход — вверх
  function rise(ctx, list, x, y, tIn, tOut, t, w, px, colors) {
    ctx.font = font(w, px); ctx.textBaseline = 'top';
    const sp = ctx.measureText(' ').width, hgt = px * 1.25;
    ctx.save(); ctx.beginPath(); ctx.rect(0, y - px * 0.15, W, hgt); ctx.clip();
    list.forEach((wd, i) => {
      const a = tIn == null ? 1 : easeBack((t - tIn - i * 0.07) / 0.42), o = tOut == null ? 0 : easeIO((t - tOut - i * 0.03) / 0.3);
      const dy = (1 - a) * hgt - o * hgt;
      if (a > 0.001 && o < 0.999) { ctx.fillStyle = colors[i] ?? colors.at(-1); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 14; ctx.fillText(wd, x, y + dy); }
      x += ctx.measureText(wd).width + sp;
    });
    ctx.restore();
  }
  function titles(ctx, title, sub, t, tIn, tOut, acc, motion) {
    const tw = String(title || '').split(/\s+/).filter(Boolean), sw = String(sub || '').split(/\s+/).filter(Boolean), x0 = 80;
    const tpx = fit(ctx, tw.join(' '), 800, motion ? 100 : 96, 56, W - 160), spx = sw.length ? fit(ctx, sw.join(' '), 500, 46, 30, W - 160) : 0;
    const y = SAFE_BOTTOM - tpx - 30 - (sw.length ? spx + 20 : 0) - 20;
    let pa = tIn == null ? 1 : easeOut((t - tIn) / 0.35); if (tOut != null) pa = Math.min(pa, 1 - clamp((t - tOut) / 0.2));
    if (pa > 0) { ctx.fillStyle = acc; ctx.fillRect(x0, y - 34, (motion ? 160 : 120) * pa, motion ? 10 : 8); }
    const fn = motion ? rise : words;
    fn(ctx, tw, x0, y, tIn, tOut, t, motion ? 800 : 700, tpx, tw.length > 1 ? [acc, '#fff'] : ['#fff']);
    if (sw.length) fn(ctx, sw, x0, y + tpx + 30, tIn == null ? null : tIn + 0.14, tOut, t, 500, spx, ['#ebebeb']);
  }
  function brand(ctx, s, acc) {
    if (!s) return;
    const px = fit(ctx, s, 600, 34); ctx.textBaseline = 'top'; ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillText(s, (W - ctx.measureText(s).width) / 2, SAFE_TOP); ctx.fillStyle = acc; ctx.fillRect((W - 60) / 2, SAFE_TOP + px + 22, 60, 4);
  }
  // «Мотион»: плашки фактов объекта — «всплывают» по очереди с отскоком; площадь считается от нуля
  function chips(ctx, x, t, t0, t1, acc) {
    const list = [x.rooms || x.kind, x.area ? 'AREA' : '', x.floor ? `${x.floor}/${x.floors ?? '?'} эт.` : '', x.sea_m && x.sea_m <= 1500 ? `🌊 ${km(x.sea_m)}` : ''].filter(Boolean).slice(0, 4);
    let cx = 80; const y = SAFE_TOP + 92, h = 70;
    ctx.save(); ctx.font = font(700, 36); ctx.textBaseline = 'middle';
    list.forEach((s, i) => {
      const a = easeBack((t - t0 - 0.35 - i * 0.12) / 0.45), out = clamp((t - t1 + 0.35) / 0.3);
      let txt = s;
      if (s === 'AREA') { const q = easeOut((t - t0 - 0.35 - i * 0.12) / 0.9), v = x.area * q; txt = `${v.toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: x.area % 1 ? 1 : 0 })} м²`; }
      const full = s === 'AREA' ? area(x.area) : s, w = ctx.measureText(full).width + 48;
      if (cx + w > W - 60) return;
      if (a > 0.01 && out < 1) {
        ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(cx + w / 2, y + h / 2); ctx.scale(a, a); ctx.translate(-(cx + w / 2), -(y + h / 2));
        rrect(ctx, cx, y, w, h, 35); ctx.fillStyle = i === 0 ? acc : 'rgba(10,14,22,.62)'; ctx.fill();
        if (i) { ctx.lineWidth = 3; ctx.strokeStyle = acc; ctx.stroke(); }
        ctx.fillStyle = i === 0 ? '#14161b' : '#fff'; ctx.fillText(txt, cx + 24, y + h / 2 + 2); ctx.restore();
      }
      cx += w + 14;
    });
    ctx.restore();
  }
  // «Мотион»: номер объекта в начале его 15 секунд — большой «01» и шторка, потом маленький «1/2» в углу
  function badge(ctx, o, n, t, t0, t1, acc, name) {
    const q = t - t0;
    ctx.save(); ctx.textBaseline = 'top';
    if (q < 1.5) {
      const a = easeOut(q / 0.35), out = easeIO((q - 1.1) / 0.4), x = -820 + 880 * a - 1000 * out, nm = String(name || '').toUpperCase().slice(0, 24);
      ctx.fillStyle = acc; ctx.beginPath(); ctx.moveTo(x, 760); ctx.lineTo(x + 800, 760); ctx.lineTo(x + 740, 1000); ctx.lineTo(x - 60, 1000); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#14161b'; ctx.font = font(900, 170); const nw = ctx.measureText(String(o + 1).padStart(2, '0')).width; ctx.fillText(String(o + 1).padStart(2, '0'), x + 70, 790);
      const tx = x + 70 + nw + 24; ctx.font = font(700, 44); ctx.fillText(`/${String(n).padStart(2, '0')}`, tx, 805);
      if (nm) { const px = fit(ctx, nm, 700, 40, 24, x + 700 - tx); ctx.font = font(700, px); ctx.fillText(nm, tx, 870); }
    }
    const b = easeOut((q - 1.2) / 0.4), bo = clamp((t - t1 + 0.3) / 0.3);
    if (b > 0 && bo < 1) {
      ctx.globalAlpha = b * (1 - bo); const s = `${o + 1}/${n}`; ctx.font = font(800, 40); const w = ctx.measureText(s).width + 36;
      rrect(ctx, W - 80 - w, SAFE_TOP - 6, w, 60, 30); ctx.fillStyle = 'rgba(10,14,22,.6)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = acc; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText(s, W - 80 - w + 18, SAFE_TOP + 4);
    }
    ctx.restore();
  }
  // финальный кадр: агентство / имя / телефон / мессенджеры / адрес (пустые — пропускаются; имена и телефоны не сокращаются — уменьшается шрифт)
  function card(c, ctx, acc) {
    const L = []; let bar = null;
    const add = (text, w, px, color, gap) => { const p = fit(ctx, text, w, px); L.push({ text, w, px: p, color, gap }); };
    if (c.agency) { add('АГЕНТСТВО НЕДВИЖИМОСТИ', 500, 40, '#dcdcdc', 24); add(`«${c.agency}»`, 700, 120, acc, 76); if (c.name) { bar = L.length; add(c.name, 600, 62, '#fff', 70); } }
    else if (c.name) { add('НЕДВИЖИМОСТЬ', 500, 40, '#dcdcdc', 24); add(c.name, 700, 96, acc, 76); }
    add(c.cta || 'Звоните — покажу в удобное время', 600, 50, '#fff', 56);   // v5.26: призыв позвонить (последние 3 с)
    if (c.phone) { if (bar == null) bar = L.length; add(phoneFmt(c.phone), 800, 84, '#fff', 24); L.at(-1).pulse = true; }
    if (c.messengers) add(c.messengers, 400, 38, '#e6e6e6', 26);
    if (c.address) add(c.address, 400, 40, '#e6e6e6', 26);
    const total = L.reduce((s, l) => s + l.px + l.gap, 0) - (L.at(-1)?.gap ?? 0);
    let y = (HH - total) / 2 - 60; for (const l of L) { l.y = y; y += l.px + l.gap; }
    return { L, bar };
  }
  // переход между кадрами A → B (q 0…1): каждая функция рисует оба кадра сама
  function trans(ctx, kind, A, B, q, acc) {
    const e = easeIO(q);
    if (kind === 'xf') { A(ctx); ctx.globalAlpha = e; B(ctx); ctx.globalAlpha = 1; return; }
    if (kind === 'whip') { const off = W * e, b = 40 * Math.sin(Math.PI * q); if (b > 1) ctx.filter = `blur(${b.toFixed(0)}px)`; ctx.save(); ctx.translate(-off, 0); A(ctx); ctx.restore(); ctx.save(); ctx.translate(W - off, 0); B(ctx); ctx.restore(); ctx.filter = 'none'; return; }
    if (kind === 'zoom') {   // влёт: старый кадр улетает «в камеру» с размытием, новый приезжает из глубины
      ctx.save(); const s1 = 1 + 0.45 * e; ctx.translate(W / 2, HH / 2); ctx.scale(s1, s1); ctx.translate(-W / 2, -HH / 2); if (q > 0.05) ctx.filter = `blur(${(18 * e).toFixed(0)}px)`; ctx.globalAlpha = 1 - easeIO((q - 0.3) / 0.6); A(ctx); ctx.restore();
      ctx.save(); const s2 = 1.25 - 0.25 * easeOut(q); ctx.translate(W / 2, HH / 2); ctx.scale(s2, s2); ctx.translate(-W / 2, -HH / 2); ctx.globalAlpha = easeIO((q - 0.25) / 0.6); B(ctx); ctx.restore(); ctx.filter = 'none'; return;
    }
    if (kind === 'card') {   // карточка: старый кадр уменьшается в скруглённую карточку и уезжает вверх, новый выезжает снизу
      ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, W, HH);
      const s = 1 - 0.16 * Math.sin(Math.PI * Math.min(1, q * 1.2)), up = -HH * easeIO((q - 0.15) / 0.85), dn = HH * (1 - easeOut((q - 0.2) / 0.8));
      for (const [F, y] of [[A, up], [B, dn]]) { ctx.save(); ctx.translate(W / 2, HH / 2 + y); ctx.scale(s, s); ctx.translate(-W / 2, -HH / 2); rrect(ctx, 0, 0, W, HH, 70); ctx.clip(); F(ctx); ctx.restore(); }
      return;
    }
    if (kind === 'leak') {   // засветка: тёплое пятно света проходит по кадру на смене
      A(ctx); ctx.globalAlpha = easeIO((q - 0.3) / 0.4); B(ctx); ctx.globalAlpha = 1;
      const k = Math.sin(Math.PI * q), g = ctx.createRadialGradient(W * (0.2 + 0.6 * q), HH * 0.45, 0, W * (0.2 + 0.6 * q), HH * 0.45, HH * 0.75);
      g.addColorStop(0, `rgba(255,214,150,${(0.85 * k).toFixed(3)})`); g.addColorStop(0.45, `rgba(255,140,80,${(0.35 * k).toFixed(3)})`); g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, HH); ctx.restore(); return;
    }
    if (kind === 'iris') {   // круг: новый кадр раскрывается кругом с кольцом акцентного цвета
      A(ctx); const r = Math.hypot(W, HH) * 0.62 * easeIO(q);
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, HH * 0.45, r, 0, Math.PI * 2); ctx.clip(); B(ctx); ctx.restore();
      if (q < 0.97) { ctx.save(); ctx.lineWidth = 16; ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(W / 2, HH * 0.45, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      return;
    }
    // wipe: шторка акцентного цвета под углом закрывает старый кадр и открывает новый
    const sk = 260, e1 = -sk + (W + 2 * sk) * easeIO(Math.min(1, q / 0.62)), e2 = -sk + (W + 2 * sk) * easeIO(Math.max(0, (q - 0.32) / 0.68));
    const poly = (x) => { ctx.beginPath(); ctx.moveTo(-sk * 2, 0); ctx.lineTo(x + sk / 2, 0); ctx.lineTo(x - sk / 2, HH); ctx.lineTo(-sk * 2, HH); ctx.closePath(); };
    A(ctx);
    ctx.save(); poly(e1); ctx.fillStyle = acc; ctx.fill(); ctx.restore();
    ctx.save(); poly(e1 - 70); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.globalAlpha = 0.25; ctx.fill(); ctx.restore();
    ctx.save(); poly(e2); ctx.clip(); B(ctx); ctx.restore();
  }
  // раскладка по времени: сегменты (кадры) с переходами; для нескольких объектов — крючок 1,6 с, по 15 с на объект, контакты 3 с
  function timeline(on) {
    const many = multi(), motion = opt.tpl === 'motion', TR = motion ? 0.5 : 0.3, segs = [], blocks = [];
    let t = 0;
    if (many) { segs.push({ s: scenes[cov] ?? on[0], hook: true, a: 0, b: HOOK }); t = HOOK; }
    prep.items.forEach((x, o) => {
      const list = on.filter(s => s.num === x.num); if (!list.length) return;
      const len = many ? PER : ONE - ENDS, d = len / list.length;
      blocks.push({ o, x, t0: t, t1: t + len });
      list.forEach((s, j) => segs.push({ s, o, j, a: t + j * d, b: t + (j + 1) * d, hook: !many && j === 0 }));
      t += len;
    });
    const END = ENDS, fx = motion ? FXM : FXC;
    let fi = 0;
    segs.forEach((g, i) => { if (i) g.fx = (g.s.fx && (motion || FXC.includes(g.s.fx)) ? g.s.fx : fx[fi++ % fx.length]); });
    return { segs, blocks, TR, BODY: t, END, DUR: t + END };
  }
  async function build() {
    const on = scenes.filter(s => s.on), motion = opt.tpl === 'motion', acc = ACC[opt.acc] ?? GOLD;
    const imgs = new Map();
    for (const s of [...new Set([...on, scenes[cov]].filter(Boolean))]) { try { imgs.set(s.u, await load(s.u)); } catch { /* фото не загрузилось — пропуск */ } }
    const ok = on.filter(s => imgs.has(s.u));
    if (!ok.length) throw new Error('Фото не загрузились — проверьте интернет и попробуйте ещё раз');
    if (!imgs.has(scenes[cov]?.u)) cov = scenes.indexOf(ok[0]);
    const T = timeline(ok), { segs, blocks, TR, BODY, DUR } = T;
    const c = contact(), hook = hookOf(), price = el.querySelector('#v-price').checked && !multi() && prep.items[0].price ? H.mln(prep.items[0].price) : '';
    if (price && segs[1]) segs[1].cap = { title: price, sub: segs[1].s.title };
    const brandText = c.agency ? `АГЕНТСТВО «${c.agency.toUpperCase()}»` : c.name.toUpperCase();
    // фон финального кадра: обложка размыта и затемнена (один раз)
    const endbg = document.createElement('canvas'); endbg.width = W; endbg.height = HH;
    const eb = endbg.getContext('2d'); eb.filter = 'blur(28px)'; photo(eb, imgs.get(scenes[cov].u) ?? imgs.get(ok[0].u), 0.5, 0); eb.filter = 'none'; eb.fillStyle = 'rgba(0,0,0,.58)'; eb.fillRect(0, 0, W, HH);
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = HH; const tc = tmp.getContext('2d');
    const P = (g, t) => clamp((t - g.a + TR / 2) / (g.b - g.a + TR));
    const draw1 = (g, t, i) => cx => photo(cx, imgs.get(g.s.u), P(g, t), i);
    const f = (ctx, t) => {
      if (t < BODY) {
        let i = segs.findIndex(g => t < g.b); if (i < 0) i = segs.length - 1;
        ctx.save(); ctx.fillStyle = '#0b0e14'; ctx.fillRect(0, 0, W, HH);
        const g = segs[i], nx = segs[i + 1], pv = segs[i - 1];
        if (nx && t > g.b - TR / 2) trans(ctx, nx.fx, draw1(g, t, i), draw1(nx, t, i + 1), (t - (g.b - TR / 2)) / TR, acc);
        else if (pv && t < g.a + TR / 2) trans(ctx, g.fx, draw1(pv, t, i - 1), draw1(g, t, i), (t - (g.a - TR / 2)) / TR, acc);
        else draw1(g, t, i)(ctx);
        ctx.restore(); ctx.save();
        shade(ctx); brand(ctx, brandText, acc);
        if (motion) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(80, SAFE_TOP - 40, W - 160, 6); ctx.fillStyle = acc; ctx.fillRect(80, SAFE_TOP - 40, (W - 160) * clamp(t / DUR), 6); }
        const blk = blocks.find(b => b.t0 <= t && t < b.t1);
        if (motion && blk) { chips(ctx, blk.x, t, blk.t0, blk.t1, acc); if (multi()) badge(ctx, blk.o, prep.items.length, t, blk.t0, blk.t1, acc, blk.x.zk || blk.x.place); }
        for (const k of [i - 1, i, i + 1]) {
          const s = segs[k]; if (!s || t < s.a - 0.2 || t > s.b + 0.2) continue;
          const tOut = s.b - (k === segs.length - 1 ? 0.3 : 0.32);
          if (s.hook) titles(ctx, hook[0], hook[1], t, k === 0 && !multi() ? null : s.a + 0.1, tOut, acc, motion);
          else { const cp = s.cap ?? s.s; const tIn = s.a + (motion && blk && s.a === blk.t0 && multi() ? 1.25 : 0.18); if (t >= tIn - 0.05) titles(ctx, cp.title, cp.sub, t, tIn, tOut, acc, motion); }
        }
        ctx.restore();
        if (t > BODY - 0.35) {   // в финальный кадр — размытие и растворение 0,35 с
          const q = (t - (BODY - 0.35)) / 0.35;
          tc.clearRect(0, 0, W, HH); tc.drawImage(ctx.canvas, 0, 0);
          ctx.save(); ctx.filter = `blur(${(20 * q).toFixed(0)}px)`; ctx.drawImage(tmp, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = easeIO(q); ctx.drawImage(endbg, 0, 0); ctx.restore();
        }
      } else {
        ctx.drawImage(endbg, 0, 0);
        const { L, bar } = card(c, ctx, acc);
        L.forEach((l, li) => { ctx.font = font(l.w, l.px); const tw = ctx.measureText(l.text).width;
          if (l.pulse && t > BODY + 1) {   // телефон «дышит» и подсвечен плашкой акцента — взгляд на номер
            const k = 1 + 0.045 * Math.sin((t - BODY - 1) * Math.PI * 2 / 1.1);
            ctx.save(); ctx.translate(W / 2, l.y + l.px / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(l.y + l.px / 2));
            rrect(ctx, (W - tw) / 2 - 36, l.y - 22, tw + 72, l.px + 44, (l.px + 44) / 2); ctx.fillStyle = acc; ctx.globalAlpha = 0.95; ctx.fill(); ctx.globalAlpha = 1;
            ctx.textBaseline = 'top'; ctx.fillStyle = '#14161b'; ctx.fillText(l.text, (W - tw) / 2, l.y); ctx.restore(); return; }
          (motion ? rise : words)(ctx, [l.text], (W - tw) / 2, l.y, BODY + li * 0.08, null, t, l.w, l.px, [l.color]); });
        if (bar != null) { const pa = easeOut((t - BODY - 0.2) / 0.4); ctx.fillStyle = acc; ctx.fillRect(W / 2 - 80 * pa, L[bar].y - 30, 160 * pa, 5); }
      }
    };
    f.DUR = DUR; return f;
  }
  function check() {
    const c = contact();
    if (scenes.filter(s => s.on).length < 1) { H.toast('Отметьте хотя бы одно фото (лучше 4–6)'); return false; }
    if (val('#v-short').length < 15) { H.toast('Допишите короткое описание — хотя бы одно предложение (или «✨ Написать ИИ»)', 5000); el.querySelector('#v-short').focus(); return false; }
    if (c.name.length < 2) { H.toast('Укажите имя — оно будет на финальном кадре', 4000); el.querySelector('#v-name').focus(); return false; }
    if (!/^[+\d\s()-]{6,30}$/.test(c.phone)) { H.toast('Укажите телефон цифрами, например +7 918 123-45-67', 4000); el.querySelector('#v-phone').focus(); return false; }
    return true;
  }
  async function cover() {   // обложка (1-й кадр) — сразу видно, как будет в ленте
    if (busy) return;
    const cv = el.querySelector('#v-cv'); if (!cv) return;
    try { const f = await build(); f(cv.getContext('2d'), multi() ? 0.9 : 0.6); } catch (e) { /* фото ещё грузятся */ }
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
      const frame = await build(), DUR = frame.DUR, cv = el.querySelector('#v-out canvas') ?? (() => { el.querySelector('#v-out').innerHTML = `<canvas id="v-cv" width="${W}" height="${HH}" class="vid-cv"></canvas>`; return el.querySelector('#v-cv'); })();
      const ctx = cv.getContext('2d'), type = mime(), bps = Math.round(Math.min(6e6, Math.max(8e5, 17e6 * 8 / DUR)));   // v5.48 G: файл ≤ 20 МБ (общее правило видео; длинный ролик — чуть ниже качество)
      frame(ctx, 0);
      const stream = cv.captureStream(FPS), rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: bps } : { videoBitsPerSecond: bps }), parts = [];
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
      actions(true, mp4, DUR);
      b.textContent = 'Загружаю на сервер…';
      try {
        const up = await H.call('vid_upload', { type: mp4 ? 'mp4' : 'webm', nums: prep.items.map(x => x.num), caption: el.querySelector('#v-cap').value });
        const r = await fetch(up.upload, { method: 'PUT', body: blob, headers: { 'content-type': blob.type } });
        if (!r.ok) throw new Error(`Хранилище не приняло ролик (${r.status})`);
        job = await H.call('vid_done', { id: up.id, size: blob.size }); job.id = up.id; job.dl = job.dl || up.dl;
        actions(false, mp4, DUR);
      } catch (er) { H.toast(`Ролик готов, но на сервер не загрузился: ${er.message}. Скачайте его кнопкой «Скачать».`, 7000); }
    } catch (er) { H.toast(er.message, 6000); }
    busy = false; b.disabled = false; b.textContent = '🎬 Собрать заново';
  }
  function actions(local, mp4, dur) {
    const kb = Math.round(blob.size / 1024);
    el.querySelector('#v-actions').innerHTML = `<h3 class="vid-step" style="margin:14px 0 0"><span class="vid-n" style="display:inline-grid;margin-right:8px">7</span>Куда отправить</h3>
      <div id="v-send"></div>
      <p class="hint">${mp4 ? 'MP4' : 'WebM'}, 9:16, ${Math.round(dur)} с, ${kb > 1024 ? `${(kb / 1024).toFixed(1)} МБ` : `${kb} КБ`}.${mp4 ? '' : ' Этот браузер записывает видео только в WebM: Telegram, YouTube, VK и Rutube его принимают; для Instagram и WhatsApp-статуса откройте сайт в Safari или новом Chrome — там будет MP4.'}${dur > 30 ? ' Статус WhatsApp берёт до 60 с, Telegram-история — до 60 с.' : ''}</p>
      <p class="hint">${local ? '⏳ Сохраняю ролик на сервер…' : `✅ Ролик сохранён на 12 часов — до ${until(job.expires_at)}. Найти его: «Видеомонтаж» → «Мои ролики».`}</p>`;
    sendBlock(el.querySelector('#v-send'), { blob, dl: job?.dl, caption: () => el.querySelector('#v-cap')?.value ?? '', title: () => el.querySelector('#v-title')?.value ?? '', mp4 });
  }
  // ИИ-режиссёр (v5.26): порядок кадров внутри каждого объекта, подписи по фото, переходы и цвет — по шаблону «Мотион»
  async function aiDirector(b) {
    b.disabled = true; b.textContent = 'ИИ смотрит фото… ~10–30 с';
    try {
      const objs = prep.items.filter(x => !x.own).map(x => ({ facts: x, photos: scenes.filter(s => s.num === x.num && !s.local).map(s => s.u) }));   // v5.42B: свои фото из браузера ИИ не видит
      aiPlan = await H.call('vid_plan', { objs });
      const next = [];
      prep.items.forEach((x, o) => {
        const list = scenes.filter(s => s.num === x.num), p = aiPlan.objs[o];
        if (!p) { next.push(...list); return; }
        const used = p.order.map((k, j) => ({ ...list[k], on: true, own: !!p.caps[j], title: p.caps[j] || list[k].title, fx: j ? p.fx[j - 1] : null })).filter(s => s.u);
        const rest = list.filter((_, k) => !p.order.includes(k)).map(s => ({ ...s, on: false, own: false }));
        if (o === 0 && p.hook && !multi()) { const fi = el.querySelector('#v-fish'); if (fi && !fi.value) fi.value = p.hook; }
        next.push(...used, ...rest);
      });
      const cu = scenes[cov]?.u; scenes = next;
      cov = multi() ? Math.max(0, scenes.findIndex(s => s.u === cu)) : 0;
      if (ACC[aiPlan.accent]) opt.acc = aiPlan.accent;
      opt.tpl = 'motion'; retitle(); redraw(); H.toast('ИИ расставил кадры — проверьте и соберите ролик');
    } catch (er) { H.toast(er.message, 6000); b.disabled = false; b.textContent = '🎬 ИИ-режиссёр: ещё раз'; }
  }
  const until = s => { if (!s) return ''; const d = new Date(s), o = { timeZone: 'Europe/Moscow' };
    const same = d.toLocaleDateString('ru-RU', o) === new Date().toLocaleDateString('ru-RU', o);
    return `${d.toLocaleTimeString('ru-RU', { ...o, hour: '2-digit', minute: '2-digit' })} МСК${same ? '' : ` ${d.toLocaleDateString('ru-RU', { ...o, day: '2-digit', month: '2-digit' })}`}`; };

  // ---------- «Куда отправить» (v5.18): один клик — файл, описание и нужная страница сервиса ----------
  // svc — живой вход из «Мессенджеры и соцсети» (auto conn_init); на телефоне всё уходит через системное «Поделиться» с файлом
  const TO = [
    { id: 'wa', name: 'WhatsApp — статус', icon: '🟢', svc: 'wa', href: 'https://web.whatsapp.com/', how: 'Статус → «+» → перетащите файл' },
    { id: 'max', name: 'MAX', icon: '💬', svc: 'max', href: 'https://web.max.ru/', how: 'Чат или канал → скрепка → файл' },
    { id: 'tg', name: 'Telegram', icon: '✈️', svc: 'tg', href: 'https://web.telegram.org/a/', how: 'Чат или канал → перетащите файл' },
    { id: 'yt', name: 'YouTube Shorts', icon: '▶️', svc: 'yt', href: 'https://www.youtube.com/upload', how: 'Перетащите файл, вставьте заголовок' },
    { id: 'rt', name: 'Rutube', icon: '🟣', svc: null, href: 'https://studio.rutube.ru/', how: '«Загрузить видео» → файл' },
    { id: 'ig', name: 'Instagram Reels', icon: '📸', svc: 'ig', href: 'https://www.instagram.com/', how: '«Создать» → перетащите файл' },
    { id: 'vk', name: 'VK Клипы', icon: '🔵', svc: 'vk', href: 'https://vk.com/clips', how: '«Опубликовать клип» → файл' },
  ];
  let conns = null;
  async function connState() {
    if (conns) return conns;
    try {
      const r = await fetch(String(window.API).replace(/\/web$/, '/auto'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'conn_init', auth: { token: H.token() } }) });
      const d = await r.json(); conns = Object.fromEntries((d.items ?? []).map(x => [x.id, x.status]));
    } catch { conns = {}; }
    return conns;
  }
  const sendCtx = new WeakMap();
  async function sendBlock(box, o) {
    if (!box) return;
    sendCtx.set(box, o);
    const phone = H.mobile(), st = await connState();
    box.innerHTML = `<div class="vid-send">
      ${phone ? `<button class="btn primary vid-big" data-sys>📤 Отправить: статусы WhatsApp, MAX, Telegram, Instagram…</button>` : ''}
      <div class="row" style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn ${phone ? 'soft' : 'primary'}" data-dl>⬇ Скачать ролик</button><button class="btn soft" data-cap>Скопировать описание</button></div>
      <small class="muted">${phone ? 'Или выберите сервис — откроется его страница, описание скопируется:' : 'Один клик: ролик скачается, описание скопируется, откроется страница сервиса — перетащите файл в окно.'}</small>
      <div class="vid-tg">${TO.map(t => `<div class="vid-to" data-to="${t.id}" role="button" tabindex="0"><b>${t.icon} ${esc(t.name)}</b><small>${esc(t.how)}</small>
        ${t.svc ? (st[t.svc] === 'ok' ? '<small class="ok">вы вошли ✓</small>' : `<a href="hub.html#msg=${t.svc}" data-login>Войти один раз</a>`) : ''}</div>`).join('')}</div></div>`;
  }
  async function fileOf(o) {
    if (o.blob) return new File([o.blob], `obzor.${o.blob.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: o.blob.type });
    const r = await fetch(o.url); const b = await r.blob();
    return new File([b], `obzor.${o.url.includes('.mp4') ? 'mp4' : 'webm'}`, { type: b.type || (o.url.includes('.mp4') ? 'video/mp4' : 'video/webm') });
  }
  function download(o) {
    const a = document.createElement('a');
    if (o.blob) { a.href = URL.createObjectURL(o.blob); a.download = `obzor.${o.blob.type.includes('mp4') ? 'mp4' : 'webm'}`; }
    else a.href = o.dl;   // ссылка ?download= — хранилище отдаёт файл вложением
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function sysShare(o) {
    try {
      const file = await fileOf(o);
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: o.caption() }); } catch { /* отмена */ } return true; }
    } catch { /* нет сети — ниже скачивание */ }
    return false;
  }
  async function onSend(e) {
    const box = e.target.closest('.vid-send')?.parentElement, o = box && sendCtx.get(box);
    if (!o || e.target.closest('[data-login]')) return;
    if (e.target.closest('[data-sys]')) { if (!(await sysShare(o))) { download(o); H.toast('Этот браузер не умеет «Поделиться» файлом — ролик скачан', 5000); } return; }
    if (e.target.closest('[data-dl]')) { download(o); return H.toast('Ролик скачивается — он в папке «Загрузки»'); }
    if (e.target.closest('[data-cap]')) return H.copy(o.caption(), 'Описание скопировано');
    const t = TO.find(x => x.id === e.target.closest('[data-to]')?.dataset.to);
    if (!t) return;
    const cap = t.id === 'yt' || t.id === 'rt' ? `${o.title()}\n\n${o.caption()}`.trim() : o.caption();
    if (H.mobile() && await sysShare(o)) return;   // телефон: системное окно — там выбрать WhatsApp, MAX, Telegram…
    const w = window.open(t.href, '_blank', 'noopener');
    download(o);
    await H.copy(cap, `Ролик скачан, описание скопировано — в открытой вкладке ${t.name}: ${t.how}`);
    if (!w) H.toast(`Разрешите сайту открывать вкладки или откройте ${t.href}`, 6000);
  }
  // «Мои ролики за 12 часов»
  async function mine(box = el.querySelector('#v-mine')) {
    if (!box) return;
    let r; try { r = await H.call('vid_list'); } catch (er) { box.innerHTML = `<p class="err">${esc(er.message)}</p>`; return; }
    if (!r.items.length) { box.innerHTML = '<p class="muted">Пока пусто. Готовые ролики хранятся здесь 12 часов.</p>'; return; }
    box.innerHTML = `<div class="vid-list">${r.items.map(j => `<div class="vid-item"><video src="${esc(j.url)}#t=0.6" preload="metadata" controls playsinline></video>
      <small class="muted">№ ${esc((j.nums ?? []).join(', №'))} · удалится в ${esc(until(j.expires_at))}</small><div data-mine="${j.id}"></div></div>`).join('')}</div>`;
    for (const j of r.items) sendBlock(box.querySelector(`[data-mine="${j.id}"]`), { url: j.url, dl: j.dl, caption: () => j.caption ?? '', title: () => (j.caption ?? '').split('\n')[0], mp4: j.url.includes('.mp4') });
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
  // ---------- v5.42B: до 9 фото на объект, свой объект (фото остаются в браузере), эксклюзив по номеру ----------
  function photoMove(i, d) {
    const s = scenes[i], same = scenes.map((x, k) => [x, k]).filter(([x]) => x.num === s.num).map(([, k]) => k), j = same.indexOf(i), k2 = same[j + d];
    if (k2 == null) return;
    [scenes[i], scenes[k2]] = [scenes[k2], scenes[i]];
    scenes.forEach(x => { if (x.num === s.num) x.own = false; }); retitle(); redraw();
  }
  function photoDel(i) {
    const s = scenes[i];
    if (scenes.filter(x => x.num === s.num).length < 2) return H.toast('У объекта должно остаться хотя бы одно фото — или уберите объект целиком');
    scenes.splice(i, 1); if (cov >= scenes.length || cov === i) cov = 0; retitle(); redraw();
  }
  async function addPhotos(num, files) {
    const have = scenes.filter(s => s.num === num).length, room = Math.max(0, 9 - have), list = [...files].filter(f => /^image\//.test(f.type)).slice(0, room);
    if (!list.length) return H.toast(room ? 'Выберите фото (JPG, PNG, HEIC — как снимает телефон)' : 'У объекта уже 9 фото — удалите лишние');
    let at = scenes.map(s => s.num).lastIndexOf(num) + 1;
    for (const f of list) scenes.splice(at++, 0, { u: URL.createObjectURL(f), num, k: -1, on: true, title: '', sub: '', fx: null, local: true });
    if (files.length > room) H.toast(`Добавлено ${list.length} — больше 9 фото на объект нельзя`);
    retitle(); redraw();
  }
  let ownN = 0;
  function ownForm(first = false) {
    const box = document.createElement('div'); box.className = 'vid-ownf';
    box.innerHTML = `<div class="vid-ownc" role="dialog" aria-label="Свой объект"><h3>📷 Свой объект</h3><p class="hint">Фото и описание остаются только в вашем браузере — в базу объявлений ничего не попадает.</p>
      <div class="vid-grid"><label class="field">Что это<select id="o-kind"><option value="квартира">Квартира</option><option value="апартаменты">Апартаменты</option><option value="дом">Дом</option><option value="участок">Участок</option><option value="коммерция">Коммерция</option></select></label>
        <label class="field">Комнат<select id="o-rooms"><option value="">—</option><option value="0">Студия</option><option>1</option><option>2</option><option>3</option><option>4</option></select></label>
        <label class="field">Площадь, м²<input id="o-area" inputmode="decimal" maxlength="7"></label><label class="field">Этаж<input id="o-floor" inputmode="numeric" maxlength="3"></label>
        <label class="field">Район или ЖК<input id="o-place" maxlength="60" placeholder="Адлер, ЖК Сочи-Парк"></label><label class="field">Цена, млн ₽<input id="o-price" inputmode="decimal" maxlength="7"></label>
        <label class="field" style="grid-column:1/-1">Описание (пойдёт в пост)<textarea id="o-descr" rows="3" maxlength="300"></textarea></label></div>
      <label class="btn primary vid-add-big">📷 Выбрать фото (до 9)<input type="file" accept="image/*" multiple id="o-files" hidden></label> <span class="muted" id="o-n">не выбрано</span>
      <p class="hub-actions"><button type="button" class="btn primary" data-o-ok>Добавить в ролик</button><button type="button" class="btn ghost" data-o-no>Отмена</button></p></div>`;
    document.body.append(box);
    const q = s => box.querySelector(s); let files = [];
    q('#o-files').onchange = e => { files = [...e.target.files].filter(f => /^image\//.test(f.type)).slice(0, 9); q('#o-n').textContent = files.length ? `выбрано фото: ${files.length}` : 'не выбрано'; };
    box.onclick = e => {
      if (e.target === box || e.target.closest('[data-o-no]')) { box.remove(); if (first && !prep.items.length) empty(); return; }
      if (!e.target.closest('[data-o-ok]')) return;
      if (!files.length) return H.toast('Выберите хотя бы одно фото');
      const kind = q('#o-kind').value, rooms = q('#o-rooms').value, num = -(++ownN), place = q('#o-place').value.trim(), a = parseFloat(q('#o-area').value.replace(',', '.'));
      const zk = /жк/i.test(place) ? place.replace(/^.*?(жк)/i, 'ЖК') : '';
      prep.items.push({ num, own: true, kind, rooms: rooms === '' ? '' : rooms === '0' ? 'Студия' : `${rooms}-комн.`, area: a > 0 ? a : null, floor: +q('#o-floor').value || null, floors: null,
        place: zk ? place.replace(/,?\s*ЖК.*$/i, '').trim() : place, zk, district: '', sea_m: null, finish: '', price: (parseFloat(q('#o-price').value.replace(',', '.')) || 0) * 1e6 || null, new: false, photos: files.length, fishka: '',
        descr_own: q('#o-descr').value.trim() });
      for (const f of files) scenes.push({ u: URL.createObjectURL(f), num, k: -1, on: true, title: '', sub: '', fx: null, local: true });
      box.remove(); retitle(); prep.short ||= q('#o-descr').value.trim().slice(0, 200); if (first) draw(); else redraw();
    };
  }
  async function ownStart() {
    el.innerHTML = '<p class="muted">Готовлю…</p>';
    try { prep = await H.call('vid_prepare', { nums: [], own: true }); } catch (e) { el.innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    blob = null; job = null; aiPlan = null; cov = 0; prep.skipped = []; scenes = [];
    opt = { tpl: prep.tpl === 'classic' ? 'classic' : 'motion', acc: 'gold', style: -1 };
    el.innerHTML = '<h2>🎬 Видеообзор своего объекта</h2><p class="muted">Заполните окно «Свой объект» — фото с телефона и пару слов об объекте.</p>';
    ownForm(true);
  }
  async function exclAdd() {
    const v = prompt('Номер эксклюзива (6 цифр, начинается с 9):', ''); const n = +String(v ?? '').replace(/\D/g, '');
    if (!n) return; if (n < 900001) return H.toast('У эксклюзивов номера с 900001 — объявления базы добавляйте галочкой на главной');
    if (prep.items.some(x => x.num === n)) return H.toast('Этот объект уже в ролике');
    try {
      const r = await H.call('vid_prepare', { nums: [n] });
      if (!r.items.length) return H.toast('Эксклюзив не найден или снят');
      if (!r.pick.length) return H.toast('У этого эксклюзива нет фото');
      prep.items.push(...r.items); scenes.push(...r.pick.map(p => ({ u: p.u ?? url(p.num, p.k, p.v), num: p.num, k: p.k, on: true, title: '', sub: '', fx: null })));
      retitle(); redraw(); H.toast('Эксклюзив добавлен в ролик');
    } catch (er) { H.toast(er.message, 5000); }
  }
  async function onClick(e) {
    if (e.target.closest('[data-make]')) return make();
    if (e.target.closest('[data-preview]')) return cover();
    if (e.target.closest('[data-ai]')) return aiText(e.target.closest('[data-ai]'));
    if (e.target.closest('[data-plan]')) return aiDirector(e.target.closest('[data-plan]'));
    if (e.target.closest('[data-restyle]')) { opt.style = (opt.style + 1 + Math.floor(Math.random() * 3)) % 4; post(); return H.toast('Другой вариант описания'); }
    const mv = e.target.closest('[data-mv]'); if (mv) { const [o, d] = mv.dataset.mv.split(':').map(Number); return move(o, d); }
    // v5.42B: фото объекта — порядок, удалить; объект — убрать; ＋ свой объект, ＋ эксклюзив
    const pm = e.target.closest('[data-pm]'); if (pm) { e.preventDefault(); const [i, d] = pm.dataset.pm.split(':').map(Number); return photoMove(i, d); }
    const pd = e.target.closest('[data-pdel]'); if (pd) { e.preventDefault(); return photoDel(+pd.dataset.pdel); }
    const od = e.target.closest('[data-odel]'); if (od) { const x = prep.items[+od.dataset.odel]; if (!x || !confirm('Убрать этот объект из ролика?')) return; prep.items = prep.items.filter(y => y !== x); scenes = scenes.filter(s => s.num !== x.num); cov = 0; retitle(); return redraw(); }
    if (e.target.closest('[data-own-add]')) return ownForm();
    if (e.target.closest('[data-x-add]')) return exclAdd();
    if (e.target.closest('[data-copy-cap]')) return H.copy(el.querySelector('#v-cap').value, 'Описание скопировано');
    if (e.target.closest('[data-copy-title]')) return H.copy(el.querySelector('#v-title').value, 'Заголовок скопирован');
    onSend(e);
  }
  async function show(id) {
    try {
      const r = await H.call('vid_get', { id });
      el.innerHTML = `<h2>🎬 Ролик</h2><div class="vid-two"><video src="${esc(r.url)}" controls playsinline class="vid-cv"></video>
        <section class="hub-sec vid-step"><h3>Куда отправить</h3><p class="hub-warn">⏳ Хранится до ${esc(until(r.expires_at))}.</p><div id="v-send"></div>
        <p><a class="btn soft" href="#video">Все мои ролики</a></p></section></div>`;
      el.onclick = onSend;
      sendBlock(el.querySelector('#v-send'), { url: r.url, dl: r.dl, caption: () => r.caption ?? '', title: () => (r.caption ?? '').split('\n')[0], mp4: r.url.includes('.mp4') });
    } catch (er) { el.innerHTML = `<p class="err">${esc(er.message)}</p><a class="btn primary" href="#video">Мои ролики и новый ролик</a>`; }
  }
  window.SEC = window.SEC || {};
  window.SEC.video = { title: 'Видеообзор', open };
})();

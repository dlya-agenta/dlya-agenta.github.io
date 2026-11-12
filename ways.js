// v5.69 (требование Алексея 12.11): «сначала свой компьютер». Везде, где функции нужен вход в чужой сервис (мессенджеры, «Реклама», Авито, Циан,
// чаты ЖК), сначала ищем вход на компьютере агента (расширение «Для Агента» в его Chrome). Компьютер выключен — предлагаем включить с инструкцией;
// сервер сервиса («облако») — только если агент сам поставил галочку и понимает разницу. ✋ Вручную — всегда.
// window.WAYS:
//   box(el, svc | [svc…], {action, mass, onChange}) — блок «💻 Ваш компьютер / ☁️ галочка облака / ✋ вручную» (возвращает состояние);
//   pick(svc, {action, mass}) → 'ext' | 'srv' | 'off' — перед отправкой; 'off' — окно «Включите компьютер», молча не отправляем;
//   state(svc, force) — состояние; setCloud(svc, on) — галочка облака; isNeedPc(err) / needPc(svc, err) — ответ сервера 409 need_pc.
// Сервер: функция auto — auth_way {svc} и auth_pref {svc, cloud}. Пока их нет на сервере — заглушка по own_ways / own_ext_state / conn_init
// (галочка облака тогда хранится в этом браузере).
window.WAYS = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // ДомКлик агентам не называем — «Реклама» (кабинет партнёра); Авито и Циан — только админ и Main (сервер проверяет сам)
  const SV = { wa: 'WhatsApp', tg: 'Telegram', max: 'MAX', dc: 'кабинет рекламы', av: 'Авито', cian: 'Циан', tgzk: 'Чаты ЖК (Telegram)' };
  const HOST = { wa: 'web.whatsapp.com', tg: 'web.telegram.org', max: 'web.max.ru', dc: 'кабинет рекламы', av: 'avito.ru', cian: 'cian.ru', tgzk: 'web.telegram.org' };
  const MSG = new Set(['wa', 'tg', 'max']);
  const name = svc => SV[svc] ?? svc;
  const login = svc => svc === 'dc' ? 'в кабинет рекламы' : `в веб-версию ${name(svc === 'tgzk' ? 'tg' : svc)} (${HOST[svc]})`;
  const tok = () => { try { return JSON.parse(localStorage.getItem('token') || 'null'); } catch { return null; } };
  const AUTO = () => String(window.API || '').replace(/\/web$/, '/auto');
  async function auto(action, extra = {}) {
    const r = await fetch(AUTO(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, auth: { token: tok() }, ...extra }) });
    const j = await r.json().catch(() => ({ error: 'server', message: `Сервер не ответил (HTTP ${r.status})` }));
    if (!r.ok || j.error) throw Object.assign(new Error(j.message || j.error || 'Не получилось'), { code: j.error, status: r.status, data: j });
    return j;
  }
  const PK = svc => `ways:cloud:${svc}`;
  const prefLocal = svc => { try { return JSON.parse(localStorage.getItem(PK(svc)) || 'false') === true; } catch { return false; } };
  const howtoOf = svc => [
    'Включите компьютер, на котором стоит расширение «Для Агента».',
    'Откройте на нём Chrome (или Яндекс Браузер) — расширение работает, пока браузер открыт. В других вкладках и программах можно работать.',
    'Расширения ещё нет — <a href="ext.html" target="_blank" rel="noopener">установите его</a> (2 минуты).',
    `Войдите ${esc(login(svc))} в этом браузере — один раз.`,
    'Нажмите «Проверить снова».'];
  // ---------- состояние: сначала сервер (auth_way), иначе — заглушка по прежним действиям ----------
  const C = new Map(); let noApi = false;
  const decide = s => s.local.on && s.local.login !== 'auth' ? 'ext' : s.cloud.allowed && s.cloud.ok && s.cloud.alive !== false ? 'srv' : 'off';
  async function stub(svc) {
    const base = svc === 'tgzk' ? 'tg' : svc;
    let ext = null, srvOk = false, alive = true;
    if (MSG.has(base)) {
      const w = window.MSGAPP?.ways ? await window.MSGAPP.ways() : await auto('own_ways').catch(() => null);
      const W = w?.svcs?.[base];
      ext = W?.ext ?? null; srvOk = !!W?.srv?.ok; alive = !(w?.srv_seen_h > 48);
    } else {
      ext = (await auto('own_ext_state').catch(() => null))?.ext ?? null;
      const ci = await auto('conn_init').catch(() => null);
      srvOk = ci?.items?.find(x => x.id === base)?.status === 'ok'; alive = !!ci?.online;
      if (ext) ext = { ...ext, login: ext.svcs?.[base] ?? null };
    }
    const s = {
      svc, stub: true,
      local: { on: !!ext?.on, seen_s: ext?.seen_at ? Math.round((Date.now() - Date.parse(ext.seen_at)) / 1e3) : null, ver: ext?.ver ?? null, login: ext ? (ext.login ?? ext.svcs?.[base] ?? null) : null, has: !!ext },
      cloud: { allowed: prefLocal(svc), ok: srvOk, alive },
      why: '', howto: null,
    };
    s.pick = decide(s);
    return s;
  }
  async function state(svc, force = false, mass = false) {
    if (!tok() || !window.API) return null;
    const key = `${svc}|${mass ? 1 : 0}`, c = C.get(key);
    if (!force && c && Date.now() - c.t < 45e3) return c.v;
    let v = null;
    if (!noApi) {
      try { v = await auto('auth_way', { svc, ...(mass ? { mass: true } : {}) }); v.local ??= {}; v.cloud ??= {}; v.local.has = v.local.installed ?? (v.local.seen_s != null || !!v.local.on); }
      catch (e) { if (e.status === 400 || /неизвестн|unknown/i.test(e.message)) noApi = true; else if (e.status === 401 || e.status === 403) return null; }
    }
    if (!v) v = await stub(svc).catch(() => null);
    if (v && !v.pick) v.pick = decide(v);
    C.set(key, { t: Date.now(), v });
    return v;
  }
  async function setCloud(svc, on) {
    // единственный источник — сервер (web_users.cloud_ok); localStorage — только для заглушки, если auth_pref на сервере ещё нет
    if (!noApi) { try { await auto('auth_pref', { svc, cloud: !!on }); } catch (e) { if (e.status === 400 || /неизвестн|unknown/i.test(e.message)) noApi = true; else throw e; } }
    if (noApi) { try { localStorage.setItem(PK(svc), JSON.stringify(!!on)); } catch { /* приватный режим */ } }
    for (const k of [...C.keys()]) if (k.startsWith(`${svc}|`)) C.delete(k);
  }
  const forget = svc => { for (const k of [...C.keys()]) if (k.startsWith(`${svc}|`)) C.delete(k); };
  // ---------- вид ----------
  const ago = s => s == null ? '' : s < 120 ? 'только что' : s < 3600 ? `${Math.round(s / 60)} мин назад` : s < 86400 ? `${Math.round(s / 3600)} ч назад` : `${Math.round(s / 86400)} дн. назад`;
  function localTxt(s, svc) {
    const L = s.local;
    if (L.on && L.login === 'ok') return [true, `включён, расширение на связи, вход ${esc(name(svc))} есть`];
    if (L.on && L.login === 'auth') return [false, `включён, но нет входа — откройте ${esc(HOST[svc])} в браузере с расширением и войдите`];
    if (L.on) return [true, `включён, расширение на связи · вход ${esc(name(svc))} проверю при отправке`];
    if (L.has || L.seen_s != null) return [false, `выключен или Chrome закрыт (был на связи ${ago(L.seen_s)})`];
    return [false, `нет расширения «Для Агента» — <a href="ext.html" target="_blank" rel="noopener">установить</a>`];
  }
  function cloudTxt(s, svc, mass) {
    const K = s.cloud;
    if (mass && svc === 'max') return [false, 'в MAX сервер всем сразу не пишет — только ваш компьютер'];
    if (!K.ok && K.alive !== false) return [false, `вход ${esc(name(svc))} на сервере не подключён — <a href="hub.html#msg" target="_blank" rel="noopener">«🔌 Подключения»</a>`];
    if (K.alive === false) return [false, '⚠️ сервер сейчас не работает — пока через ваш компьютер или вручную'];
    return [true, 'вход на сервере подключён'];
  }
  const DIFF = `<details class="wy-diff"><summary>В чём разница</summary><div class="wy-cols">
    <div><b>💻 Свой компьютер</b><ul><li>вход остаётся у вас, сервису он не передаётся;</li><li>пишет ваш аккаунт — как будто вы сами;</li>
      <li>компьютер должен быть включён и Chrome открыт — в других вкладках и программах работать можно.</li></ul></div>
    <div><b>☁️ Сервер сервиса</b><ul><li>работает, даже когда компьютер выключен;</li><li>вход хранится у сервиса (в зашифрованном виде);</li>
      <li>MAX всем сразу не пишет.</li></ul></div></div></details>`;
  function html(list, S, o = {}) {
    const one = list.length === 1, svc0 = list[0], s0 = S[0];
    const loc = list.map((svc, i) => [svc, localTxt(S[i], svc)]);
    const cl = list.map((svc, i) => [svc, cloudTxt(S[i], svc, o.mass)]);
    const allowed = S.every(s => s.cloud.allowed), picks = S.map(s => s.pick);
    const bad = picks.every(p => p === 'off');
    const row = (ok, t, k = '') => `<li class="${ok ? 'ok' : 'no'}"${k}><i aria-hidden="true">${ok ? '✓' : '✗'}</i><span>${t}</span></li>`;
    const head = o.title ?? (one ? (s0.pick === 'ext' ? `Уйдёт с вашего компьютера` : s0.pick === 'srv' ? 'Уйдёт через сервер сервиса' : 'Сейчас автоматически не уйдёт') : bad ? 'Сейчас автоматически не уйдёт' : 'Как уйдёт');
    const why = list.map((_, i) => S[i].why).filter(Boolean);
    return `<div class="wy${bad ? ' bad' : ''}" role="note" data-wy="${esc(list.join(','))}"><b class="wy-t">${head}${o.action && !o.title && !o.inWin ? ` · ${esc(o.action)}` : ''}</b>
      <ol>
        ${one ? row(loc[0][1][0], `💻 Ваш компьютер: ${loc[0][1][1]}`) : !s0.local.on ? row(false, `💻 Ваш компьютер: ${loc[0][1][1]}`)
          : `<li class="wy-g ok"><i aria-hidden="true">✓</i><span>💻 Ваш компьютер включён, расширение на связи:</span></li><ul class="wy-sub">${list.map((svc, i) => { const g = S[i].local.login;
            return row(g !== 'auth', `${esc(name(svc))} — ${g === 'ok' ? 'вход есть' : g === 'auth' ? `нет входа: откройте ${esc(HOST[svc])} в этом Chrome и войдите` : 'вход проверю при отправке'}`); }).join('')}</ul>`}
        ${one && o.mass && svc0 === 'max' ? row(false, '☁️ MAX всем сразу — только с вашего компьютера: сервер находит людей в MAX по номеру ненадёжно') : `<li class="wy-cl"><label><input type="checkbox" data-wy-cloud${allowed ? ' checked' : ''}> ☁️ Можно через сервер сервиса, когда компьютер выключен</label>
          ${!allowed && S.some(x => x.cloud.alive === false) ? `<ul class="wy-sub">${row(false, '⚠️ сервер сейчас не работает — пока через ваш компьютер или вручную')}</ul>` : ''}
          ${allowed ? `<ul class="wy-sub">${cl.map(([svc, [ok, t]]) => row(ok, `${one ? '' : `${esc(name(svc))} — `}${t}`)).join('')}</ul>` : ''}</li>`}
        ${o.manual === false ? '' : row(true, '✋ Вручную — всегда: не ушло автоматически — пришлю список с готовым текстом и кнопкой «Открыть»')}
      </ol>
      ${one && bad && why.length ? `<small class="wy-why">${why.map(esc).join(' · ')}</small>` : ''}
      ${bad ? `<details class="wy-how"${o.openHow ? ' open' : ''}><summary>Как включить свой компьютер</summary><ol>${(s0.howto?.length ? s0.howto.map(t => esc(t).replace(/(dlya-agenta\.github\.io\/)?ext\.html/, '<a href="ext.html" target="_blank" rel="noopener">$&</a>')) : howtoOf(svc0)).map(t => `<li>${t}</li>`).join('')}</ol>
        <button type="button" class="btn soft sm" data-wy-re>⟳ Проверить снова</button></details>` : ''}
      ${DIFF}</div>`;
  }
  async function box(el, svcs, o = {}) {
    if (!el) return null;
    const list = (Array.isArray(svcs) ? svcs : [svcs]).filter(Boolean);
    if (!list.length) { el.innerHTML = ''; return null; }
    if (!el.innerHTML.trim()) el.innerHTML = '<p class="muted wy-load">Проверяю ваш компьютер…</p>';
    const S = await Promise.all(list.map(s => state(s, o.force, o.mass)));
    if (S.some(s => !s)) { el.innerHTML = ''; return null; }
    el.innerHTML = html(list, S, o);
    if (!el._wy) {
      el._wy = 1;
      el.addEventListener('change', async e => {
        const c = e.target.closest?.('[data-wy-cloud]'); if (!c) return;
        c.disabled = true;
        try { for (const s of el._wyList) await setCloud(s, c.checked); } catch (er) { toast(er.message); }
        const v = await box(el, el._wyList, { ...el._wyO, force: true }); el._wyO.onChange?.(v);
      });
      el.addEventListener('click', async e => {
        if (!e.target.closest?.('[data-wy-re]')) return;
        const v = await box(el, el._wyList, { ...el._wyO, force: true, openHow: true }); el._wyO.onChange?.(v);
      });
    }
    el._wyList = list; el._wyO = o;
    return list.length === 1 ? S[0] : S;
  }
  // ---------- перед отправкой ----------
  async function pick(svc, o = {}) {
    let s = await state(svc, true, o.mass);
    if (!s) return 'off';
    let p = o.mass && svc === 'max' && s.pick === 'srv' ? 'off' : s.pick;
    if (p !== 'off') return p;
    return offWin(svc, o);
  }
  // окно «Включите компьютер»: инструкция, галочка облака, «Проверить снова». Возвращает 'ext' | 'srv' (если стало можно) или 'off' (Отмена)
  function offWin(svc, o = {}, err = null) {
    return new Promise(done => {
      const d = document.createElement('div');
      d.className = 'sheet wy-sheet';
      d.innerHTML = `<div class="sheet-box wy-boxw" role="dialog" aria-modal="true" aria-label="Включите компьютер">
        <b class="wy-h">💻 Включите компьютер</b>
        <p class="wy-p">${esc(err?.message || `Чтобы ${o.action || 'отправить'} через ${name(svc)}, нужен ваш компьютер: Chrome с расширением «Для Агента» и вход в ${name(svc)} в нём. Сейчас так не получится — ниже, что исправить.`)}</p>
        ${(err?.howto ?? err?.data?.howto)?.length ? `<ol class="wy-ho">${(err.howto ?? err.data.howto).map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
        <div class="wy-slot"></div>
        <div class="wy-btns"><button type="button" class="btn primary" data-go disabled>Отправить</button><button type="button" class="btn ghost" data-x>Отмена</button></div></div>`;
      document.body.appendChild(d);
      const slot = d.querySelector('.wy-slot'), go = d.querySelector('[data-go]');
      let cur = 'off';
      const sync = s => { const one = Array.isArray(s) ? s[0] : s; cur = one ? (o.mass && svc === 'max' && one.pick === 'srv' ? 'off' : one.pick) : 'off';
        go.disabled = cur === 'off'; go.textContent = cur === 'ext' ? '💻 Отправить с компьютера' : cur === 'srv' ? '☁️ Отправить через сервер' : 'Отправить'; };
      box(slot, svc, { ...o, inWin: true, openHow: true, force: true, onChange: sync }).then(sync);
      const end = v => { d.remove(); done(v); };
      d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-x]')) return end('off'); if (e.target.closest('[data-go]') && cur !== 'off') end(cur); });
    });
  }
  const isNeedPc = e => (e?.code ?? e?.data?.error) === 'need_pc';
  // ответ сервера 409 need_pc → окно; вернёт выбранный способ (если стало можно — повторите отправку с ним) или 'off'
  function needPc(svc, e, o = {}) { forget(svc); return offWin(svc, o, e); }
  function toast(t) { (window.HUB?.toast ?? window.toast ?? (x => alert(x)))(t, 5000); }
  // стили — здесь же (файл подключается на всех страницах со своими CSS)
  const st = document.createElement('style');
  st.textContent = `.wy{margin:10px 0 0;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#d8dee6);font-size:13px;line-height:1.4;background:var(--card,#fff);color:var(--text,#1f2a33)}
.wy.bad{border-color:color-mix(in srgb,var(--warn,#9a5b00) 55%,transparent);background:color-mix(in srgb,var(--warn,#9a5b00) 7%,var(--card,#fff))}
.wy-t{display:block;font-size:14px}.wy ol{list-style:none;margin:6px 0 4px;padding:0;display:grid;gap:5px}.wy li{display:flex;gap:7px;align-items:flex-start}
.wy li i{font-style:normal;font-weight:700;width:14px;flex:none}.wy li.ok>i{color:var(--ok,#15803d)}.wy li.no>i{color:var(--bad,#c2410c)}.wy li.no>span{opacity:.88}
.wy-g{font-weight:600}.wy-g.ok>i{color:var(--ok,#15803d)}.wy>ol>.wy-sub{margin-top:-2px}.wy-cl{display:block!important}.wy-cl label{display:flex;gap:8px;align-items:flex-start;cursor:pointer}.wy-cl input{margin:2px 0 0;width:16px;height:16px;flex:none}
.wy-sub{list-style:none;margin:4px 0 0 24px;padding:0;display:grid;gap:3px}.wy a{color:var(--accent,#2563eb)}.wy-why{display:block;opacity:.8;margin-top:4px}
.wy details{margin-top:6px}.wy summary{cursor:pointer;color:var(--accent,#2563eb);font-size:12.5px}.wy-how ol{list-style:decimal;padding-left:20px;display:block}.wy-how li{display:list-item;margin:3px 0}
.wy-how .btn{margin-top:6px}.wy-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px}.wy-cols ul{margin:4px 0 0;padding-left:18px}.wy-cols li{display:list-item}
@media (max-width:560px){.wy-cols{grid-template-columns:1fr}}
.wy-sheet{position:fixed;inset:0;z-index:5100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,16,24,.45)}
.wy-boxw{background:var(--card,#fff);color:var(--text,#1f2a33);border-radius:16px;padding:16px;max-width:520px;width:100%;max-height:calc(100vh - 32px);overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)}
.wy-h{display:block;font-size:16px}.wy-ho{margin:8px 0 0;padding-left:20px;font-size:13.5px;line-height:1.45}.wy-p{margin:6px 0 0;font-size:14px;line-height:1.4}.wy-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}`;
  document.head.appendChild(st);
    // поле via для запросов отправки: сервер решает сам; 'srv' — только когда агент сам разрешил облако галочкой и компьютер выключен
  const via = p => p === 'srv' ? { via: 'srv' } : {};
  return { box, pick, state, setCloud, isNeedPc, needPc, via, name, howto: howtoOf, _decide: decide };
})();

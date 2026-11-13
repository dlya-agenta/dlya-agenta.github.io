// Keep only opaque intent hashes/IDs locally. Recovery never starts new work.
(() => {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => [k, canonical(v[k])])) : v;
  const hash = async v => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)))].map(x => x.toString(16).padStart(2, '0')).join('');
  const memory = new Map();
  globalThis.SELECTION_REQUEST = {
  createForUser(call, options = {}) {
    return this.create({...options, scope: async () => {
      const owner = await call('sel_request_owner');
      if (typeof owner?.login !== 'string' || !owner.login) throw new Error('Не удалось подтвердить вход. Войдите на сайт ещё раз.');
      return owner.login;
    }});
  },
  create({scope, storage}) {
    if (!storage) try { storage = globalThis.localStorage; } catch { /* private mode */ }
    const key = Promise.resolve().then(() => typeof scope === 'function' ? scope() : scope).then(value => {
      if (typeof value !== 'string' || !value) throw new Error('Не удалось подтвердить пользователя');
      return hash('selection-request:' + value);
    }).then(v => 'sel_requests_v1_' + v);
    const read = async () => {
      const k = await key;
      try { const v = JSON.parse(storage?.getItem(k) || 'null'); if (Array.isArray(v)) return v.filter(x => /^[a-f0-9]{64}$/.test(x.hash) && /^[a-f0-9-]{36}$/.test(x.id) && Number.isFinite(x.at)); } catch { /* private mode */ }
      return memory.get(k) || [];
    };
    const write = async rows => { const k = await key; memory.set(k, rows); try { storage?.setItem(k, JSON.stringify(rows)); } catch { /* retry within this page */ } };
    const complete = async id => write((await read()).filter(x => x.id !== id));
    // Serialize this page's clicks before awaiting storage/hash. Server handles tabs.
    let queue = Promise.resolve();
    const intent = (body, action) => {
      const task = queue.then(async () => {
        const {auth, request_id, ...input} = body, h = await hash(JSON.stringify([action, canonical(input)])), rows = await read();
        let row = rows.find(x => x.hash === h);
        if (!row) { row = {hash: h, id: crypto.randomUUID(), at: Date.now()}; rows.push(row); await write(rows); }
        return row.id;
      }); queue = task.catch(() => {}); return task;
    };
    const api = {
      pending: read,
      async send(call, body, action = 'sel_create') {
        const id = await intent(body, action);
        try {
          const result = await call(action, {...body, request_id: id});
          if (result?.ok) await complete(id);
          return result;
        } catch (e) {
          if (['bad', 'off', 'need_pro', 'forbidden', 'limit'].includes(e.data?.error)) await complete(id);
          throw e;
        }
      },
      async check(call, id) {
        try {
          const result = await call('sel_request', {request_id: id});
          if (result?.ok) await complete(id);
          return result;
        } catch (e) {
          if (['request_missing', 'request_failed'].includes(e.data?.error)) await complete(id);
          throw e;
        }
      },
      async mount(root, call) {
        if (!root || !(await read()).length) return;
        const box = document.createElement('div'); box.className = 'hint'; box.setAttribute('role', 'status');
        const text = document.createElement('p'); text.textContent = 'Есть создание подборки без подтверждённого ответа. Проверьте результат перед новой попыткой.';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'btn soft'; button.textContent = 'Проверить результат';
        box.append(text, button); root.prepend(box);
        button.onclick = async () => {
          button.disabled = true;
          try {
            const rows = await read();
            if (!rows.length) { box.remove(); return; }
            const r = await api.check(call, rows[0].id);
            if (!r?.ok) throw new Error(r?.message || 'Результат пока не подтверждён');
            text.textContent = 'Подборка готова. Результат восстановлен без повторного создания.';
            for (const [value, label] of [[r.link, 'Ссылка клиенту'], [r.url, 'PDF клиенту']]) {
              if (!value) continue;
              const u = new URL(value, location.href); if (u.protocol !== 'https:') continue;
              const a = document.createElement('a'); a.href = u.href; a.target = '_blank'; a.rel = 'noopener'; a.className = 'btn soft'; a.textContent = label; box.append(a);
            }
            button.textContent = (await read()).length ? 'Проверить следующую' : 'Проверено';
            button.disabled = !(await read()).length;
          } catch (e) { text.textContent = e.message || 'Не удалось проверить результат'; button.disabled = !(await read()).length; }
        };
      },
    }; return api;
  }};
})();

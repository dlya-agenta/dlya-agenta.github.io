// A response belongs to the exact selection and commission that requested it.
// Late responses must not replace a newer confirmation quote.
(() => {
  globalThis.SELECTION_QUOTE = { create({read, load, render, delay = 0}) {
    let key, generation = 0, current;
    return { refresh(force = false) {
      const input = read(), next = JSON.stringify(input);
      if (!force && key === next) return current;
      key = next; const turn = ++generation;
      render({pending: true});
      current = (async () => {
        try {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          if (turn !== generation) return;
          const value = await load(input); if (turn === generation) render({value});
        }
        catch (e) { if (turn === generation) render({error: e.message || 'Не удалось рассчитать цены'}); }
      })();
      return current;
    }};
  }};
})();

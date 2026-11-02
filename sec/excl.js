// «Эксклюзивы» (v5.19) переехали на свою страницу excl.html — старые ссылки hub.html#excl, #excl=my, #excl=edit:<id> ведут туда
(() => {
  const to = arg => arg === 'my' || /^actual:/.test(arg ?? '') ? '#my' : /^edit:\d+$/.test(arg ?? '') ? `#edit=${arg.split(':')[1]}` : arg === 'edit' ? '#new' : '';
  window.SEC ??= {};
  window.SEC.excl = { title: 'Эксклюзивы', open(arg) { location.replace(`excl.html${to(arg)}`); return new Promise(() => {}); } };
})();

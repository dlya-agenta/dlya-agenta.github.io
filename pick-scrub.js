// v5.48 H9 (I1): чистка ответа собственника перед «Ответить клиенту» — те же правила, что cleanAnswer на сервере (web/pick.ts): без телефонов, ссылок, ников,
// улицы с номером и «д./дом/кв./квартира N». Сервер чистит ещё раз при сохранении; здесь — чтобы агент видел уже очищенный текст. Проверка: node site/pick.scrub.test.mjs
(function (root) {
  const NICK = /(^|[^\w])@[\w.]{2,}/g;
  const DOMAIN = /(^|[\s(«"])(?:[a-zа-я0-9-]+\.)+(?:ru|рф|su|com|me|org|net|io|ly|link|app|info|biz|pro|online|site|club|chat|to|cc|tv|gg)(?:\/\S*)?/gi;
  const ST_WORDS = ['ул.', 'улица', 'пер.', 'переулок', 'пр-т', 'пр-кт', 'просп.', 'проспект', 'ш.', 'шоссе', 'б-р', 'бульвар', 'наб.', 'набережная', 'проезд', 'тупик'];
  // финальное ревью M3 (как cleanAnswer): слова-типы улиц в любом регистре, название — с заглавной, между названием и номером может быть запятая
  const anyCase = w => [...w].map(c => c === '.' ? '\\.' : c.toLowerCase() !== c.toUpperCase() ? `[${c.toLowerCase()}${c.toUpperCase()}]` : c).join('');
  const STW = '(?:' + ST_WORDS.map(anyCase).join('|') + ')';
  const L = '[а-яёa-z\\d]';
  const NUM = `\\d{1,4}(?:\\s?[а-яa-z](?!${L}))?(?:\\s*[\\/-]\\s*\\d{1,4}(?:\\s?[а-яa-z](?!${L}))?)?(?:\\s*(?:к|корп|корпус|стр|строение|лит|литера)\\.?\\s*\\d+(?:\\s?[а-яa-z](?!${L}))?)?(?!${L})(?!\\s*(?:млн|т\\.?\\s*р|тыс|руб|₽|м²|м2|%|мес|лет|год|сот|мин|км))`;
  const CAP = '[А-ЯЁA-Z][А-ЯЁа-яёA-Za-z-]*';
  const SEP = '(?:\\s*,\\s*|\\s+)';
  const STREET_A = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z])${STW}\\s*(?:${CAP}\\s+){0,2}${CAP}${SEP}${NUM}`, 'g');
  const STREET_B = new RegExp(`(?<![а-яёА-ЯЁa-zA-Z])${CAP}\\s+${STW}(?:\\s*,)?\\s*${NUM}`, 'g');
  const HOUSE = new RegExp(`(?<![а-яёa-z])(?:д|дом|кв|квартира|оф|офис)\\.?\\s*№?\\s*\\d+(?:\\s?[а-яa-z](?!${L}))?(?!${L})`, 'gi');
  function scrub(t) {
    let s = String(t ?? '').replace(/\s+/g, ' ').trim()
      .replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
      .replace(/(?:\+7|8)?[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}(?!\d)/g, '')
      .replace(DOMAIN, '$1').replace(NICK, '$1').replace(STREET_B, '').replace(STREET_A, '').replace(HOUSE, '');
    s = s.replace(/\s+/g, ' ').replace(/\s+([,.!?;])/g, '$1').replace(/([,;])\s*(?=[,;.!?])/g, '').replace(/^[\s,;:]+|[\s,;:]+$/g, '').trim();
    return s.replace(/(^|\s)(звоните|пишите|тел\.?|телефон)[\s:.!]*$/i, '').trim().slice(0, 500);
  }
  root.PICK_SCRUB = scrub;
})(window);

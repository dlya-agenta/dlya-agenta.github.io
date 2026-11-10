// node site/pick.scrub.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const win = {}; vm.runInNewContext(readFileSync(new URL('./pick-scrub.js', import.meta.url), 'utf8'), { window: win });
const scrub = win.PICK_SCRUB;
const a = scrub('Квартира дом 5 кв 12 свободна');
assert.equal(a, 'Квартира свободна');
const b = scrub('ул. Курортная, д. 12, кв. 4 ok');
assert.ok(!/д\.\s*12|кв\.\s*4/.test(b) && /ok/.test(b), b);
assert.ok(!/\d{3}/.test(scrub('Звоните 8 918 111-22-33, торг до 100 тыс.').replace('100', '')));
assert.match(scrub('Цена 14 200 000, торг 100 тыс.'), /14 200 000/);
console.log('ok', JSON.stringify([a, b]));
// финальное ревью M3: запятая между улицей и номером, слова-типы улиц в любом регистре; цены и сроки остаются
for (const t of ['ул. Ленина, 5, торг', 'УЛ. Ленина 5, торг', 'Ул. Ленина,5 торг', 'Лооская ул., 16 торг', 'ПЕР. Тихий 3 торг', 'ул. ЛЕНИНА 5 торг'])
  assert.ok(!/Ленина|ЛЕНИНА|Тихий|Лооская|(^|\s)(5|16|3)(\s|,|$)/.test(scrub(t)), t + ' → ' + scrub(t));
assert.equal(scrub('Я с ул. Ленина скину 5 млн'), 'Я с ул. Ленина скину 5 млн');
assert.equal(scrub('Торг до 5 млн, пер 3 мес'), 'Торг до 5 млн, пер 3 мес');
assert.ok(scrub('ул. Ленина, торг 300 т.р.').includes('300 т.р.'));
assert.ok(scrub('ул. Ленина, 3 мес на выход').includes('3 мес'));
console.log('ok M3');

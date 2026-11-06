import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, textOf, parseAmount, safeLink, rich } from '../shared/content-model.js';
import { migrateContent } from '../scripts/migrate-content.mjs';
import * as legacy from './fixtures/legacy-content.js';
const seed = migrateContent(legacy);
const copy = () => structuredClone(seed);
const valid = value => assert.deepEqual(validateContent(value), []);

test('La migració conserva tots els textos, ítems, preus i preguntes', () => {
  valid(seed);
  assert.deepEqual(Object.keys(seed.home), ['description']);
  assert.equal(textOf(seed.home.description), `${legacy.introduction.greeting}\n\n${legacy.introduction.text}`);
  assert.ok(seed.home.description.some(run => run.text === 'ENHORABONA!' && run.bold));
  for (const category of seed.categories) {
    const original = legacy.sections.find(section => section.id === category.id);
    assert.equal(category.label, original.label);
    assert.equal(textOf(category.description), original.intro);
    assert.equal(category.questions.length, original.questions.length);
    category.questions.forEach((question, index) => {
      assert.equal(textOf(question.question), original.questions[index].q);
      assert.equal(textOf(question.answer), original.questions[index].a);
    });
    category.tables.forEach((table, index) => {
      const source = legacy.tables[original.tableIds[index]];
      assert.equal(table.title, source.title);
      assert.equal(table.items.length, source.rows.length);
      assert.equal(textOf(table.footnote), legacy.pickup.slice(1));
      table.items.forEach((item, rowIndex) => {
        const row = source.rows[rowIndex], nameColumn = source.columns.find(column => column.role === 'name');
        assert.equal(item.name, nameColumn ? row.cells[nameColumn.key].text : source.title);
        assert.equal(textOf(item.description), source.columns.filter(column => column.role === 'detail').map(column => row.cells[column.key].text).join('\n\n'));
        assert.equal(textOf(item.alert), row.note || '');
        const options = source.columns.filter(column => !['name', 'detail'].includes(column.role));
        assert.equal(item.prices.length, options.length);
        item.prices.forEach((price, pi) => {
          const originalPrice = row.cells[options[pi].key].text;
          assert.equal(textOf(price.description), options[pi].label.text);
          assert.equal(price.kind === 'amount' ? `${price.amount / 100}€${price.star ? '*' : ''}` : price.text, originalPrice);
        });
      });
    });
  }
});
test('Els marcadors pendents es conserven durant la migració', () => {
  const source = { ...legacy, tables: structuredClone(legacy.tables) };
  source.tables.classics.rows[0].cells.description.pending = true;
  source.tables.classics.rows[0].cells.two = { text: '', pending: true };
  const migrated = migrateContent(source), item = migrated.categories[0].tables[0].items[0];
  assert.equal(item.pending, true); assert.equal(item.prices[0].pending, true); valid(migrated);
});
test('Decimals, coma, zero i rebuig de símbols o precisió excessiva', () => {
  for (const [input, expected] of [['165',16500],['1,80',180],['1.8',180],['0',0],[' 2,05 ',205],['',null],['3€',null],['-3',null],['1.001',null],['1e2',null],['Infinity',null]]) assert.equal(parseAmount(input), expected);
});
test('L’asterisc obliga a omplir la nota; sense asteriscs pot quedar buida', () => {
  const document = copy(), table = document.categories[0].tables[0]; table.footnote = [];
  assert.ok(validateContent(document).some(error => error.path.endsWith('.footnote')));
  for (const item of table.items) for (const price of item.prices) price.star = false;
  valid(document);
});
test('Es pot afegir, eliminar i ordenar sense canviar les categories fixes', () => {
  const document = copy(), category = document.categories[0];
  category.tables.reverse(); category.tables.push(structuredClone(category.tables[0])); category.tables.shift();
  category.questions.reverse(); category.questions.pop();
  category.tables[0].items.reverse(); category.tables[0].items[0].prices.reverse();
  category.tables[0].items[0].description = []; category.tables[0].items[0].alert = [];
  valid(document); document.categories[0].id = 'arbitrary'; assert.ok(validateContent(document).length);
});
test('Rebutja colors, imports, marques, camps addicionals i contingut estructural invàlid', () => {
  const edits = [
    document => { document.categories[0].tables[0].items[0].color = 'red'; },
    document => { document.categories[0].tables[0].items[0].prices[0].amount = 1.1; },
    document => { document.categories[0].tables[0].items[0].prices[0].amount = -1; },
    document => { document.categories[0].tables[0].items[0].prices[0].text = 'extra'; },
    document => { document.home.description[0].style = 'font-size:100px'; },
    document => { document.home.description[0].href = 'javascript:alert(1)'; },
    document => { document.home.greeting = 'No és un camp separat'; },
    document => { document.categories[0].tables[0].items = []; },
    document => { document.categories[0].questions[0].answer = 'HTML'; },
    document => { document.contacts.email.href = 'https://a.test/\nunsafe'; },
    document => { document.categories = [null, null, null]; },
    document => { document.home.description = [null]; },
  ];
  for (const edit of edits) { const document = copy(); edit(document); assert.ok(validateContent(document).length); }
  assert.ok(validateContent(null).length);
});
test('Només enllaços segurs i text alternatiu curt', () => {
  for (const link of ['https://example.com', 'mailto:test@example.com', 'tel:+34649656652']) assert.equal(safeLink(link), true);
  for (const link of ['http://example.com', '//evil.test', 'data:text/html,bad', 'javascript:alert(1)', 'https://user:password@evil.test', 'https://a.test/\n']) assert.equal(safeLink(link), false);
  const document = copy(); document.categories[0].tables[0].items[0].prices[0] = { kind: 'text', text: 'Contacta’ns', description: rich('Personalitzada'), star: false, bold: false, italic: true }; valid(document);
  document.categories[0].tables[0].items[0].prices[0].text = 'x'.repeat(81); assert.ok(validateContent(document).length);
});
test('La còpia de demostració és publicable', async () => valid(JSON.parse(await readFile(new URL('../sample-content.json', import.meta.url), 'utf8'))));

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, textOf } from '../content-model.js';
import { sectionPath, sectionFromLocation, sectionSlugs } from '../routes.js';
const content = JSON.parse(await readFile(new URL('../content.json', import.meta.url), 'utf8'));
test('El contingut publicable compleix l’esquema', () => { assert.deepEqual(validateContent(content), []); assert.deepEqual(Object.keys(content.home), ['description']); assert.ok(textOf(content.home.description).trim()); });
for (const base of ['/', '/LAFIGUERAEVENTS/']) for (const [id, slug] of Object.entries(sectionSlugs)) {
  test(`Ruta ${id} amb base ${base}`, () => {
    const path = sectionPath(id, base);
    assert.equal(sectionFromLocation({ pathname: path }, base), id);
    if (slug) for (const suffix of ['/', '/index.html']) assert.equal(sectionFromLocation({ pathname: path + suffix }, base), id);
    assert.equal(sectionFromLocation({ pathname: base, hash: `#${id}` }, base), id);
  });
}

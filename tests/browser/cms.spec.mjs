import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const seed = JSON.parse(await readFile(new URL('../../sample-content.json', import.meta.url), 'utf8'));
const SHA = 'a'.repeat(40), NEXT = 'b'.repeat(40), COMMIT = 'c'.repeat(40);
const origin = 'http://127.0.0.1:43179';

async function api(page, options = {}) {
  const calls = [];
  await page.route(/\/config\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: "export const WORKER_URL = 'https://cms-api.test';" }));
  await page.route('https://cms-api.test/content', async route => {
    const request = route.request();
    const headers = { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'GET') return route.fulfill({ headers, body: JSON.stringify({ document: options.document || seed, sha: options.sha || SHA }) });
    calls.push({ body: request.postDataJSON(), authorization: request.headers().authorization });
    if (options.onSave) return options.onSave(route, headers, calls);
    return route.fulfill({ headers, body: JSON.stringify({ sha: NEXT, commit: COMMIT }) });
  });
  return calls;
}
async function editHome(page, text = 'Una descripció nova') {
  await page.getByRole('button', { name: 'Inici', exact: true }).click();
  await page.getByRole('textbox', { name: 'Descripció', exact: true }).fill(text);
}
async function acceptSave(page, password = 'contrasenya à 🔒') {
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByLabel('Contrasenya', { exact: true }).fill(password);
  await page.locator('#password-form').getByRole('button', { name: 'Guardar', exact: true }).click();
}
async function closeResult(page) {
  await expect(page.locator('#result-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Tancar', exact: true }).click();
}

test('Inici té un únic text i la recàrrega descarta els canvis locals', async ({ page }) => {
  const remote = structuredClone(seed);
  await page.addInitScript(() => localStorage.setItem('la-figuera-cms:v1:antic', 'un esborrany antic'));
  await api(page, { document: remote }); await page.goto('/');
  await page.getByRole('button', { name: 'Inici', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveCount(1);
  await expect(page.getByRole('textbox')).toContainText('Primer que res… ENHORABONA!');
  await expect(page.locator('.rich-editor strong')).toHaveText('ENHORABONA!');
  await editHome(page, 'Tot el text nou');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  expect(await page.evaluate(() => Object.values(sessionStorage).join(''))).toBe('');
  remote.home.description = [{ text: 'Versió actual del repositori' }];
  await page.reload();
  await page.getByRole('button', { name: 'Inici', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Versió actual del repositori');
  await expect(page.locator('#save-state')).toHaveText('Sense canvis');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
});

test('Una URL sense https mostra un error clar i no demana HTML al CMS', async ({ page }) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.route(/\/config\.js(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: "export const WORKER_URL = 'la-figuera-events-cms.devkkel.workers.dev';" }));
  await page.goto('/');
  await expect(page.locator('#main .error')).toContainText('ha de començar per https://');
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
  expect(requests.some(url => url.includes('devkkel.workers.dev/content'))).toBe(false);
});

test('Una resposta HTML mostra un missatge clar i permet reintentar', async ({ page }) => {
  await api(page);
  let html = true;
  await page.route('https://cms-api.test/content', route => route.fulfill(html ? { status: 404, contentType: 'text/html', body: '<!DOCTYPE html><html><body>No trobat</body></html>', headers: { 'access-control-allow-origin': origin } } : { json: { document: seed, sha: SHA }, headers: { 'access-control-allow-origin': origin } }));
  await page.goto('/');
  await expect(page.locator('#main .error')).toHaveText('El servei no ha retornat JSON. Revisa que la URL configurada siga la del Worker.');
  html = false;
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('button', { name: 'Inici', exact: true })).toBeVisible();
});

test('Una resposta HTML en guardar conserva l’esborrany i no confirma el canvi', async ({ page }) => {
  await api(page, { onSave: (route, headers) => route.fulfill({ status: 502, headers, body: '<!DOCTYPE html><html><body>Error</body></html>' }) });
  await page.goto('/'); await editHome(page); await acceptSave(page);
  await expect(page.locator('#result-message')).toContainText('El servei no ha retornat JSON.');
  await closeResult(page);
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Una descripció nova');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  await expect(page.locator('#save-state')).not.toHaveText('Canvis guardats. Es publicaran en breu.');
});

test('Guardar demana contrasenya i espera la confirmació; no duplica enviaments', async ({ page }) => {
  let release, received;
  const waiting = new Promise(resolve => { received = resolve; });
  const calls = await api(page, { onSave: async (route, headers) => {
    received(); await new Promise(resolve => { release = resolve; });
    await route.fulfill({ headers, body: JSON.stringify({ sha: NEXT, commit: COMMIT }) });
  } });
  await page.goto('/'); await editHome(page);
  await acceptSave(page); await waiting;
  await expect(page.locator('#save-state')).toHaveText('Guardant…');
  await expect(page.locator('#password-form button[type=submit]')).toBeDisabled();
  release();
  await expect(page.locator('#save-state')).toHaveText('Canvis guardats. Es publicaran en breu.');
  await expect(page.locator('#save-state')).toHaveAttribute('data-commit', COMMIT);
  expect(calls).toHaveLength(1); expect(calls[0].body.sha).toBe(SHA);
  expect(Buffer.from(calls[0].authorization.slice(7), 'base64').toString()).toBe('contrasenya à 🔒');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  await expect(page.locator('#password')).toHaveValue('');
});

test('Una contrasenya incorrecta conserva els canvis i permet reintentar', async ({ page }) => {
  let attempts = 0;
  await api(page, { onSave: (route, headers) => route.fulfill(++attempts === 1 ? { status: 401, headers, body: JSON.stringify({ error: 'La contrasenya no és correcta.' }) } : { headers, body: JSON.stringify({ sha: NEXT, commit: COMMIT }) }) });
  await page.goto('/'); await editHome(page); await acceptSave(page, 'incorrecta');
  await expect(page.locator('#result-message')).toHaveText('La contrasenya no és correcta.');
  await closeResult(page);
  await expect(page.locator('#password')).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Una descripció nova');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  await acceptSave(page, 'correcta');
  await expect(page.locator('#save-state')).toHaveText('Canvis guardats. Es publicaran en breu.');
});

test('Un conflicte conserva l’esborrany i bloqueja la sobreescriptura', async ({ page }) => {
  await api(page, { onSave: (route, headers) => route.fulfill({ status: 409, headers, body: JSON.stringify({ error: 'Hi ha canvis nous en GitHub.' }) }) });
  await page.goto('/'); await editHome(page); await acceptSave(page);
  await closeResult(page);
  await expect(page.getByRole('button', { name: 'Descarregar esborrany' })).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Una descripció nova');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Carregar versió actual' }).click();
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toContainText('Primer que res…');
});

test('Preus, colors, nous elements i notes obligatòries', async ({ page }) => {
  const calls = await api(page); await page.goto('/');
  await page.getByRole('button', { name: 'Tartes nupcials', exact: true }).click();
  const table = page.locator('[data-card-path="categories.0.tables.0"]');
  await table.locator(':scope > summary').press('Enter');
  const item = page.locator('[data-card-path="categories.0.tables.0.items.0"]');
  await item.locator(':scope > summary').press('Enter');
  await expect(item.getByRole('radio')).toHaveCount(3);
  await item.getByRole('radio', { name: 'Verd', exact: true }).check();
  await item.getByRole('textbox', { name: 'Import (€)', exact: true }).first().fill('12,50');
  await table.getByRole('textbox', { name: 'Nota dels asteriscos' }).fill('');
  await page.locator('#save').click();
  await expect(page.getByText('Ompli la nota: hi ha preus amb asterisc.', { exact: true }).first()).toBeVisible();
  await table.getByRole('textbox', { name: 'Nota dels asteriscos' }).fill('Sense IVA.');
  await item.getByRole('button', { name: '+ Afegir preu', exact: true }).click();
  await expect(item.getByRole('group', { name: 'Tipus de preu', exact: true })).toHaveCount(3);
  await item.getByRole('button', { name: 'Text curt', exact: true }).last().click();
  await item.getByRole('textbox', { name: 'Text curt' }).fill('Consulta’ns');
  await acceptSave(page);
  await expect(page.locator('#save-state')).toHaveText('Canvis guardats. Es publicaran en breu.');
  const savedItem = calls[0].body.document.categories[0].tables[0].items[0];
  expect(savedItem.color).toBe('green'); expect(savedItem.prices[0].amount).toBe(1250); expect(savedItem.prices[2].text).toBe('Consulta’ns');
});

test('Format segur: negreta, cursiva, salts i enllaços', async ({ page }) => {
  const calls = await api(page); await page.goto('/'); await editHome(page, 'Text nou');
  const editor = page.getByRole('textbox', { name: 'Descripció', exact: true });
  await editor.focus(); await page.keyboard.press('ControlOrMeta+A');
  await page.getByRole('button', { name: 'Negreta', exact: true }).click();
  await page.getByRole('button', { name: 'Cursiva', exact: true }).click();
  await page.getByRole('button', { name: 'Afegir enllaç', exact: true }).click();
  await page.getByLabel('Adreça', { exact: true }).fill('javascript:alert(1)');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.locator('#link-error')).toBeVisible();
  await page.getByLabel('Adreça', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(editor.locator('a')).toHaveAttribute('href', 'https://example.com');
  await acceptSave(page); await expect(page.locator('#save-state')).toContainText('Canvis guardats');
  expect(calls[0].body.document.home.description).toEqual([{ text: 'Text nou', bold: true, italic: true, href: 'https://example.com' }]);
});

test('Afegir, ordenar i eliminar taules i preguntes', async ({ page }) => {
  await api(page); await page.goto('/'); await page.getByRole('button', { name: 'Taules dolces', exact: true }).click();
  await page.getByRole('button', { name: '+ Afegir taula', exact: true }).click();
  const table = page.locator('[data-card-path="categories.2.tables.1"]'); await table.locator(':scope > summary').press('Enter');
  await table.getByRole('textbox', { name: 'Títol de la taula' }).fill('Nova taula');
  await page.locator('[data-controls-for="categories.2.tables.1"]').getByRole('button', { name: 'Pujar', exact: true }).click();
  await expect(page.locator('[data-card-path="categories.2.tables.0"] > summary').getByRole('textbox', { name: 'Títol de la taula' })).toHaveValue('Nova taula');
  await expect(page.locator('[data-card-path="categories.2.tables.0"]')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: '+ Afegir pregunta', exact: true }).click();
  const question = page.locator('[data-card-path="categories.2.questions.3"]'); await question.locator(':scope > summary').press('Enter');
  await question.getByRole('textbox', { name: 'Pregunta', exact: true }).fill('Pregunta nova?');
  await question.getByRole('textbox', { name: 'Resposta', exact: true }).fill('Resposta nova.');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-controls-for="categories.2.questions.3"]').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.locator('[data-card-path="categories.2.questions.3"]')).toHaveCount(0);
});

test('Mòbil: navegació i camps no desborden la pantalla', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await api(page); await page.goto('/');
  await page.getByRole('button', { name: 'Bufet de tortades', exact: true }).click();
  await page.locator('[data-card-path="categories.1.tables.0"] > summary').press('Enter');
  await page.locator('[data-card-path="categories.1.tables.0.items.0"] > summary').press('Enter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#save')).toBeVisible();
});

test('Restablir esborra l’esborrany i carrega la versió actual; cancel·lar el conserva', async ({ page }) => {
  const remote = structuredClone(seed);
  await api(page, { document: remote }); await page.goto('/'); await editHome(page, 'Esborrany local');
  await expect(page.locator('.brand small')).toHaveText('EVENTS CMS');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Restablir', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Esborrany local');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  remote.home.description = [{ text: 'Contingut actualitzat en la web' }];
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restablir', exact: true }).click();
  await expect(page.locator('#save-state')).toHaveText('Versió actual carregada');
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Contingut actualitzat en la web');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  await expect(page.locator('#save')).toBeDisabled();
  await page.reload(); await page.getByRole('button', { name: 'Inici', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('Contingut actualitzat en la web');
});

test('Si falla la recàrrega, Restablir conserva el treball local', async ({ page }) => {
  await api(page); await page.goto('/'); await editHome(page, 'No perdem este esborrany');
  await page.route('https://cms-api.test/content', route => route.fulfill({ status: 502, json: { error: 'No s’ha pogut carregar el contingut.' }, headers: { 'access-control-allow-origin': origin } }));
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Restablir', exact: true }).click();
  await expect(page.locator('#save-state')).toHaveText('No s’ha pogut carregar el contingut.');
  await expect(page.getByRole('textbox', { name: 'Descripció' })).toHaveText('No perdem este esborrany');
  expect(await page.evaluate(() => Object.values(localStorage).join(''))).toBe('');
  await expect(page.locator('#reset')).toBeEnabled();
});

test('Els controls externs funcionen sense desplegar taules, ítems ni preguntes', async ({ page }) => {
  await api(page); await page.goto('/'); await page.getByRole('button', { name: 'Tartes nupcials', exact: true }).click();
  const table = page.locator('[data-card-path="categories.0.tables.0"]');
  await expect(table).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-controls-for="categories.0.tables.0"]').getByRole('button', { name: 'Baixar', exact: true })).toBeVisible();
  await table.locator(':scope > summary').press('Enter');
  const itemControls = page.locator('[data-controls-for="categories.0.tables.0.items.0"]');
  await expect(itemControls.getByRole('button', { name: 'Eliminar', exact: true })).toBeVisible();
  await itemControls.getByRole('button', { name: 'Baixar', exact: true }).click();
  await expect(page.locator('[data-card-path="categories.0.tables.0.items.1"] > summary').getByRole('textbox', { name: 'Nom de l’ítem' })).toHaveValue('Carrot cake');
  await expect(page.locator('[data-card-path="categories.0.tables.0.items.1"]')).not.toHaveAttribute('open', '');
  const questionControls = page.locator('[data-controls-for="categories.0.questions.0"]');
  await questionControls.getByRole('button', { name: 'Baixar', exact: true }).click();
  await expect(page.locator('[data-card-path="categories.0.questions.1"] > summary').getByRole('textbox', { name: 'Pregunta', exact: true })).toHaveText('Què inclou el preu?');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('[data-controls-for="categories.0.questions.1"]').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.locator('.question-card > summary').filter({ hasText: 'Què inclou el preu?' })).toHaveCount(0);
});

test('El commutador de preus limita els imports i permet text lliure', async ({ page }) => {
  const calls = await api(page); await page.goto('/'); await page.getByRole('button', { name: 'Tartes nupcials', exact: true }).click();
  await page.locator('[data-card-path="categories.0.tables.0"] > summary').press('Enter');
  const item = page.locator('[data-card-path="categories.0.tables.0.items.0"]'); await item.locator(':scope > summary').press('Enter');
  const first = item.locator('.price').first(), second = item.locator('.price').nth(1);
  await expect(first.getByRole('button', { name: 'Import (€)', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(first.getByRole('button', { name: 'Text curt', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const amount = first.getByRole('textbox', { name: 'Import (€)', exact: true });
  await amount.fill('12,30'); await expect(amount).toHaveValue('12,30');
  await amount.press('End'); await amount.pressSequentially('456'); await expect(amount).toHaveValue('12,30');
  await amount.fill('12,345'); await expect(amount).toHaveValue('12,30');
  await amount.press('End'); await amount.pressSequentially('abc'); await expect(amount).toHaveValue('0');
  await amount.fill('no és un número'); await expect(amount).toHaveValue('0');
  await amount.fill('1,2.3'); await expect(amount).toHaveValue('0');
  await amount.fill('12.50');
  await second.getByRole('button', { name: 'Text curt', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Text curt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await second.getByRole('textbox', { name: 'Text curt', exact: true }).fill('Consulta’ns: 12 € / a mida!');
  await acceptSave(page); await expect(page.locator('#save-state')).toContainText('Canvis guardats');
  expect(calls[0].body.document.categories[0].tables[0].items[0].prices[0].amount).toBe(1250);
  expect(calls[0].body.document.categories[0].tables[0].items[0].prices[1].text).toBe('Consulta’ns: 12 € / a mida!');
});

test('Categories numerades i edició directa de capçaleres sense desplegar-les', async ({ page }) => {
  const calls = await api(page); await page.goto('/');
  for (const label of ['1a', '2a', '3a', '4a']) await expect(page.getByRole('textbox', { name: label, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tartes nupcials', exact: true }).click();
  const table = page.locator('[data-card-path="categories.0.tables.0"]');
  await table.getByRole('textbox', { name: 'Títol de la taula', exact: true }).fill('Taula editada directament');
  await expect(table).not.toHaveAttribute('open', '');
  await table.locator(':scope > summary').press('Enter');
  const item = page.locator('[data-card-path="categories.0.tables.0.items.0"]');
  await item.getByRole('textbox', { name: 'Nom de l’ítem', exact: true }).fill('Ítem editat directament');
  await expect(item).not.toHaveAttribute('open', '');
  const question = page.locator('[data-card-path="categories.0.questions.0"]');
  const editor = question.getByRole('textbox', { name: 'Pregunta', exact: true });
  await editor.fill('Pregunta editada directament?');
  await editor.press('ControlOrMeta+A');
  await question.getByRole('button', { name: 'Negreta', exact: true }).first().click();
  await expect(question).not.toHaveAttribute('open', '');
  await acceptSave(page); await expect(page.locator('#result-message')).toContainText('Canvis guardats');
  const category = calls[0].body.document.categories[0];
  expect(category.tables[0].title).toBe('Taula editada directament');
  expect(category.tables[0].items[0].name).toBe('Ítem editat directament');
  expect(category.questions[0].question).toEqual([{ text: 'Pregunta editada directament?', bold: true }]);
});

test('La finestra de resultat es tanca manualment i mostra els KiB exactes mentre es manté polsada', async ({ page }) => {
  const calls = await api(page); await page.goto('/'); await editHome(page, 'Text amb accents: à, è, í i 🔒');
  await acceptSave(page);
  await expect(page.locator('#result-dialog')).toBeVisible();
  await expect(page.locator('#result-message')).toHaveText('Canvis guardats. Es publicaran en breu.');
  const bytes = Buffer.byteLength(JSON.stringify(calls[0].body), 'utf8');
  const size = new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bytes / 1024);
  await page.locator('#result-body').hover(); await page.mouse.down();
  await expect(page.locator('#result-size')).toBeVisible();
  await expect(page.locator('#result-size')).toHaveText(`${size} KiB enviats de màxim 512 KiB`);
  await expect(page.locator('#result-message')).toBeHidden();
  await page.mouse.up(); await expect(page.locator('#result-message')).toBeVisible();
  await expect(page.locator('#result-size')).toBeHidden();
  await expect(page.locator('#result-dialog')).toBeVisible();
  await closeResult(page); await expect(page.locator('#result-dialog')).toBeHidden();
});

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const seed = JSON.parse(await readFile(new URL('../../sample-content.json', import.meta.url), 'utf8'));

test('La web mostra el JSON i conserva les rutes i les recàrregues', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/LAFIGUERAEVENTS/');
  await expect(page.locator('.home-opening')).toContainText('Primer que res… ENHORABONA!');
  await expect(page.locator('.home-greeting')).toHaveCount(0);
  await page.getByRole('link', { name: 'Tartes nupcials', exact: true }).click();
  await expect(page).toHaveURL(/\/LAFIGUERAEVENTS\/nupcials$/);
  await expect(page.locator('#panel-tartes-nupcials .product-item')).toHaveCount(10);
  await expect(page.locator('#panel-tartes-nupcials .amount').first()).toHaveText('165€*');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Tartes nupcials:' })).toBeVisible();
  for (const [slug, heading] of [['bufet', 'Bufet de tortades:'], ['taules', 'Taules dolces:'], ['contacte', 'Contacte:']]) {
    await page.goto(`/LAFIGUERAEVENTS/${slug}`); await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test('Els noms, els contactes, el format i les notes provenen del JSON', async ({ page }) => {
  const document = structuredClone(seed);
  document.home.description = [{ text: 'Una única descripció', bold: true, italic: true }];
  document.categories[0].label = 'Pastissos';
  document.contacts.email = { text: 'Escriu-nos', href: 'mailto:canvi@example.com' };
  const table = document.categories[0].tables[0];
  for (const item of table.items) for (const price of item.prices) price.star = false;
  table.footnote = [{ text: 'Esta nota queda oculta' }];
  table.items[0].description = []; table.items[0].prices[0].description = []; table.items[0].prices[0].bold = false; table.items[0].prices[0].italic = true;
  table.items[0].alert = [{ text: 'Alerta amb format', bold: true }];
  table.items[0].name = '<img src=x onerror=alert(1)>';
  await page.route('**/content.json', route => route.fulfill({ json: document }));
  await page.goto('/LAFIGUERAEVENTS/');
  await expect(page.locator('.home-opening strong em')).toHaveText('Una única descripció');
  await expect(page.locator('.site-footer a[href="mailto:canvi@example.com"]')).toHaveText('Escriu-nos');
  await page.getByRole('link', { name: 'Pastissos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pastissos:' })).toBeVisible();
  await expect(page.getByText('Esta nota queda oculta')).toHaveCount(0);
  const item = page.locator('#panel-tartes-nupcials .product-item').first();
  await expect(item.locator('.product-details')).toHaveCount(0);
  await expect(item.locator('.product-option-label').first()).not.toHaveText('');
  await expect(item.locator('.product-note strong')).toHaveText('Alerta amb format');
  await expect(item.locator('h3')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(item.locator('h3 img')).toHaveCount(0);
  await expect(item.locator('.amount em').first()).toHaveText('165€');
});
test('Error de JSON i reintent, sense renderitzar contingut parcial', async ({ page }) => {
  let fail = true;
  await page.route('**/content.json', route => route.fulfill(fail ? { contentType: 'application/json', body: '{' } : { json: seed }));
  await page.goto('/LAFIGUERAEVENTS/nupcials');
  await expect(page.getByRole('alert')).toContainText('No s’ha pogut carregar el contingut.');
  await expect(page.locator('.product-item')).toHaveCount(0);
  fail = false; await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Tartes nupcials:' })).toBeVisible();
});
test('La web pública en mòbil no desborda', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const slug of ['', 'nupcials', 'bufet', 'taules', 'contacte']) {
    await page.goto(`/LAFIGUERAEVENTS/${slug}`);
    await expect(page.locator('.panel:visible')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertContent } from '../shared/content-model.js';
import { migrateContent } from './migrate-content.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] || resolve(root, '../LAFIGUERAEVENTS'));
if (target === root) throw new Error('La destinació ha de ser el repositori de la web pública.');
await access(resolve(target, 'routes.js'));
await access(resolve(target, '.nojekyll'));
let content;
try { content = assertContent(JSON.parse(await readFile(resolve(target, 'content.json'), 'utf8'))); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const legacy = await import(pathToFileURL(resolve(target, 'content.js')).href);
  content = migrateContent(legacy);
}
await writeFile(resolve(target, 'content.json'), JSON.stringify(content, null, 2) + '\n');
await writeFile(resolve(root, 'sample-content.json'), JSON.stringify(content, null, 2) + '\n');
for (const [source, destination] of [
  ['shared/content-model.js', 'content-model.js'], ['shared/rich-text.js', 'rich-text.js'],
  ['public-site/app.js', 'app.js'], ['public-site/content.js', 'content.js'],
  ['public-site/content-overrides.css', 'content-overrides.css'],
  ['public-site/check.mjs', 'scripts/check.mjs'], ['public-site/site.test.mjs', 'tests/content.test.mjs'],
]) {
  await mkdir(dirname(resolve(target, destination)), { recursive: true });
  await copyFile(resolve(root, source), resolve(target, destination));
}
for (const section of ['', 'nupcials/', 'bufet/', 'taules/', 'contacte/']) {
  const path = resolve(target, section, 'index.html');
  let html = await readFile(path, 'utf8');
  if (!html.includes('content-overrides.css')) html = html.replace(/(<link rel="stylesheet" href="([^"]*)styles\.css">)/, '$1\n    <link rel="stylesheet" href="$2content-overrides.css">');
  html = html.replace(/(<footer\b[^>]*>)[\s\S]*?<\/footer>/, '$1</footer>');
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '<noscript><p class="no-script">Activa JavaScript per consultar la carta i els contactes.</p></noscript>');
  await writeFile(path, html);
}
let manifest;
try { manifest = JSON.parse(await readFile(resolve(target, 'package.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; manifest = { name: 'la-figuera-events', private: true, type: 'module' }; }
manifest.scripts = { ...manifest.scripts, check: 'node scripts/check.mjs', test: 'node --test tests/*.test.mjs' };
await writeFile(resolve(target, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Web preparada en ${target}. No s’ha fet cap commit ni publicació.`);

import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { assertContent } from '../shared/content-model.js';
const roots = ['app.js', 'config.js', 'shared', 'worker/index.js', 'scripts', 'public-site', 'tests'];
async function inspect(path) {
  if (/\.(m?js)$/.test(path)) {
    const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    if (check.status) throw new Error(check.stderr);
  } else for (const entry of await readdir(path, { withFileTypes: true })) if (entry.isDirectory() || /\.(m?js)$/.test(entry.name)) await inspect(`${path}/${entry.name}`);
}
for (const path of roots) await inspect(path);
assertContent(JSON.parse(await readFile('sample-content.json', 'utf8')));
// If the sibling checkout exists, ensure browser and Worker enforce the same schema.
try {
  const actual = await readFile(resolve('../LAFIGUERAEVENTS/content-model.js'), 'utf8');
  if (actual !== await readFile('shared/content-model.js', 'utf8')) throw new Error('Cal sincronitzar content-model.js amb la web pública.');
} catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log('Sintaxi, contingut i esquema compartit correctes.');

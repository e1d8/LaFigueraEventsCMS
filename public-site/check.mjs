import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { assertContent } from '../content-model.js';
for (const file of ['app.js', 'content.js', 'routes.js', 'content-model.js', 'rich-text.js']) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) throw new Error(result.stderr);
}
assertContent(JSON.parse(await readFile('content.json', 'utf8')));
for (const path of ['index.html', 'nupcials/index.html', 'bufet/index.html', 'taules/index.html', 'contacte/index.html']) {
  const html = await readFile(path, 'utf8');
  if (!html.includes('content-overrides.css') || !html.includes('app.js') || !html.includes('base href=')) throw new Error(`Entrada incompleta: ${path}`);
}
console.log('Sintaxi, JSON i entrades de les rutes correctes.');

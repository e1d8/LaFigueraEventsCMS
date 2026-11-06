import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { readLimited } from '../worker/index.js';
const seed = JSON.parse(await readFile(new URL('../sample-content.json', import.meta.url), 'utf8'));
const SHA = 'a'.repeat(40), NEXT = 'b'.repeat(40), COMMIT = 'c'.repeat(40);
const origin = 'https://e1d8.github.io';
const password = 'una contrasenya llarga amb à i 🔒';
const encodedPassword = Buffer.from(password).toString('base64');
function env() { return { ALLOWED_ORIGIN: origin, CMS_PASSWORD: password, GITHUB_TOKEN: 'private-github-token', READ_LIMITER: { limit: async () => ({ success: true }) }, WRITE_LIMITER: { limit: async () => ({ success: true }) } }; }
function document() { const value = structuredClone(seed); value.home.description.push({ text: '\nUna descripció nova.' }); return value; }
function request(method = 'GET', body, extra = {}) {
  return new Request('https://worker.test/content', { method, headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${encodedPassword}`, 'CF-Connecting-IP': '192.0.2.1', ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const githubCurrent = (value = seed, sha = SHA) => Response.json({ sha, content: Buffer.from(JSON.stringify(value)).toString('base64') });

test('GET retorna el JSON i el SHA amb CORS exacte i sense memòria cau', async context => {
  context.mock.method(globalThis, 'fetch', async url => { assert.equal(url, 'https://api.github.com/repos/e1d8/LAFIGUERAEVENTS/contents/content.json?ref=main'); return githubCurrent(); });
  const response = await worker.fetch(request(), env());
  assert.equal(response.status, 200); assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { document: seed, sha: SHA });
});
test('POST confirma només després del commit, amb UTF-8 i destinació fixa', async context => {
  const calls = [], value = document();
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return githubCurrent();
    const body = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')), value);
    assert.equal(body.sha, SHA); assert.equal(body.branch, 'main');
    assert.equal(options.headers.Authorization, 'Bearer private-github-token');
    return Response.json({ content: { sha: NEXT }, commit: { sha: COMMIT } });
  });
  const response = await worker.fetch(request('POST', { document: value, sha: SHA }), env());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { sha: NEXT, commit: COMMIT });
  assert.equal(calls.length, 2); assert.equal(calls[1].url, 'https://api.github.com/repos/e1d8/LAFIGUERAEVENTS/contents/content.json'); assert.equal(calls[1].options.method, 'PUT');
});
test('Origen, contrasenya, límit, configuració i dades invàlides no arriben a GitHub', async context => {
  const mock = context.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected GitHub call'); });
  const badPassword = request('POST', { document: document(), sha: SHA }, { Authorization: 'Bearer invalid' });
  assert.equal((await worker.fetch(badPassword, env())).status, 401);
  assert.equal((await worker.fetch(request('GET', undefined, { Origin: 'https://evil.test' }), env())).status, 403);
  const missing = env(); delete missing.CMS_PASSWORD; assert.equal((await worker.fetch(request(), missing)).status, 503);
  const limited = env(); limited.WRITE_LIMITER.limit = async () => ({ success: false });
  const rate = await worker.fetch(request('POST', { document: document(), sha: SHA }), limited); assert.equal(rate.status, 429); assert.equal(rate.headers.get('Retry-After'), '60');
  const invalid = document(); invalid.home.description[0].href = 'javascript:alert(1)';
  assert.equal((await worker.fetch(request('POST', { document: invalid, sha: SHA }), env())).status, 422);
  assert.equal((await worker.fetch(request('POST', { document: document(), sha: SHA, path: 'app.js' }), env())).status, 400);
  assert.equal(mock.mock.callCount(), 0);
});
test('El SHA antic produeix conflicte; un reintent ja guardat és idempotent', async context => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => { calls++; return githubCurrent(seed, NEXT); });
  assert.equal((await worker.fetch(request('POST', { document: document(), sha: SHA }), env())).status, 409);
  const repeated = await worker.fetch(request('POST', { document: seed, sha: SHA }), env());
  assert.equal(repeated.status, 200); assert.deepEqual(await repeated.json(), { sha: NEXT, commit: null, unchanged: true }); assert.equal(calls, 2);
});
test('Un conflicte entre la lectura i l’escriptura també es conserva', async context => {
  let count = 0;
  context.mock.method(globalThis, 'fetch', async () => ++count === 1 ? githubCurrent() : Response.json({ message: 'conflict' }, { status: 409 }));
  assert.equal((await worker.fetch(request('POST', { document: document(), sha: SHA }), env())).status, 409);
});
test('Els errors de GitHub no exposen secrets ni confirmen guardats', async context => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'sensitive internal error' }, { status: 403 }));
  const response = await worker.fetch(request('POST', { document: document(), sha: SHA }), env());
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('sensitive'));
});
test('Una resposta incompleta de GitHub no confirma cap commit', async context => {
  let count = 0; context.mock.method(globalThis, 'fetch', async () => ++count === 1 ? githubCurrent() : Response.json({}));
  assert.equal((await worker.fetch(request('POST', { document: document(), sha: SHA }), env())).status, 502);
});
test('Preflight, mètodes i rutes no creen operacions', async () => {
  assert.equal((await worker.fetch(request('OPTIONS'), env())).status, 204);
  assert.equal((await worker.fetch(request('DELETE'), env())).status, 405);
  assert.equal((await worker.fetch(new Request('https://worker.test/arbitrary', { headers: { Origin: origin } }), env())).status, 404);
});
test('Limita el cos real, inclús sense Content-Length, i rebutja JSON trencat', async () => {
  const large = new Request('https://worker.test/content', { method: 'POST', body: 'x'.repeat(512 * 1024 + 1) });
  await assert.rejects(readLimited(large), error => error.status === 413);
  await assert.rejects(readLimited(new Request('https://worker.test/content', { method: 'POST', body: '{' })), error => error.status === 400);
});

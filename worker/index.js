import { validateContent, MAX_BODY_BYTES } from '../shared/content-model.js';

// Deliberately not configurable from the browser or request body.
const FILE_URL = 'https://api.github.com/repos/e1d8/LAFIGUERAEVENTS/contents/content.json';
const BRANCH = 'main';

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}

export async function readLimited(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw new HttpError(413, 'El contingut és massa gran.');
  if (!request.body) throw new HttpError(400, 'Falta el contingut.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) { await reader.cancel(); throw new HttpError(413, 'El contingut és massa gran.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new HttpError(400, 'El JSON no és vàlid.'); }
}

async function passwordMatches(supplied, expected) {
  if (!supplied || supplied.length > 1024) return false;
  const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [a, b] = await Promise.all([digest(supplied), digest(expected)]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

function encode(document) {
  const bytes = new TextEncoder().encode(JSON.stringify(document, null, 2) + '\n');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decode(content) {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(content.replace(/\s/g, '')), char => char.charCodeAt(0))));
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
    const respond = (body, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status, headers });
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return respond({ error: 'Origen no permés.' }, 403);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    if (new URL(request.url).pathname !== '/content') return respond({ error: 'Ruta no disponible.' }, 404);
    if (request.method === 'OPTIONS') return respond(null, 204);
    if (!['GET', 'POST'].includes(request.method)) { headers.set('Allow', 'GET, POST, OPTIONS'); return respond({ error: 'Mètode no permés.' }, 405); }
    try {
      if (!env.GITHUB_TOKEN || !env.CMS_PASSWORD || !env.READ_LIMITER || !env.WRITE_LIMITER) throw new HttpError(503, 'El servei encara no està configurat.');
      const limiter = request.method === 'POST' ? env.WRITE_LIMITER : env.READ_LIMITER;
      const { success } = await limiter.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' });
      if (!success) { headers.set('Retry-After', '60'); throw new HttpError(429, 'Massa intents. Espera un minut i torna-ho a provar.'); }
      if (request.method === 'POST') {
        const authorization = request.headers.get('Authorization') || '';
        let password;
        try {
          password = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(authorization.slice(7)), char => char.charCodeAt(0)));
        } catch { password = ''; }
        if (!authorization.startsWith('Bearer ') || !await passwordMatches(password, env.CMS_PASSWORD)) throw new HttpError(401, 'La contrasenya no és correcta.');
        if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new HttpError(415, 'Cal enviar JSON.');
      }
      const github = async (url, options = {}) => {
        const response = await fetch(url, {
          ...options,
          headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'LaFigueraEventsCMS', 'X-GitHub-Api-Version': '2026-03-10', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 409 || response.status === 422 && options.method === 'PUT') throw new HttpError(409, 'Hi ha canvis nous en GitHub. Conserva l’esborrany i carrega la versió actual.');
        if (!response.ok) throw new HttpError(502, 'GitHub no ha pogut completar l’operació. Torna-ho a provar.');
        return response.json();
      };
      let body;
      if (request.method === 'POST') {
        body = await readLimited(request);
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['document', 'sha'].includes(key)) || typeof body.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(body.sha)) throw new HttpError(400, 'La petició no és vàlida.');
        const errors = validateContent(body.document);
        if (errors.length) throw new HttpError(422, 'Revisa els camps indicats.', errors);
      }
      const current = await github(`${FILE_URL}?ref=${BRANCH}`);
      const document = decode(current.content);
      if (!current.sha || validateContent(document).length) throw new HttpError(502, 'El contingut de GitHub no té un format compatible.');
      if (request.method === 'GET') return respond({ document, sha: current.sha });
      if (JSON.stringify(document) === JSON.stringify(body.document)) return respond({ sha: current.sha, commit: null, unchanged: true });
      if (body.sha !== current.sha) throw new HttpError(409, 'Hi ha canvis nous en GitHub. Conserva l’esborrany i carrega la versió actual.');
      const saved = await github(FILE_URL, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Actualitza el contingut des del CMS', content: encode(body.document), sha: body.sha, branch: BRANCH }),
      });
      if (!saved.content?.sha || !saved.commit?.sha) throw new HttpError(502, 'No s’ha pogut confirmar el guardat. Torna-ho a provar.');
      return respond({ sha: saved.content.sha, commit: saved.commit.sha });
    } catch (error) {
      if (error instanceof HttpError) return respond({ error: error.message, ...(error.details ? { errors: error.details } : {}) }, error.status);
      // Never log credentials, request bodies or upstream errors.
      return respond({ error: 'No s’ha pogut confirmar l’operació. Conserva l’esborrany i torna-ho a provar.' }, 502);
    }
  },
};

import { assertContent, MAX_BODY_BYTES } from './content-model.js';

export async function loadContent() {
  const response = await fetch(new URL('./content.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('No s’ha pogut carregar el contingut.');
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('El contingut és massa gran.');
  return assertContent(JSON.parse(text));
}

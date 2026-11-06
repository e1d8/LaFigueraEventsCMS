# La figuera · Editor de contingut

CMS estàtic per a la web [La Figuera Events](https://e1d8.github.io/LAFIGUERAEVENTS/). Les dues webs funcionen en GitHub Pages. Cloudflare executa únicament l’API de lectura i guardat.

En inici hi ha **una única descripció amb format**: la salutació també forma part d’este text.

## Configuració inicial, pas a pas

Necessites accés al compte de GitHub `e1d8`, un compte de Cloudflare i Node.js 22 o posterior instal·lat. Les ordres següents es poden copiar al Terminal. No escrigues el token ni la contrasenya dins del codi, dels fitxers del repositori o de les ordres.

### 1. Publicar l’adaptació de la web pública

Els canvis ja estan preparats en `/Users/Fenikkel/Documents/Github/LAFIGUERAEVENTS`. En GitHub Desktop:

1. Selecciona el repositori `LAFIGUERAEVENTS`.
2. Revisa els canvis, crea un commit i polsa **Push origin**.
3. En GitHub, entra en **Settings → Pages**. Mantín **Deploy from a branch → main → /(root)**.
4. Espera que es publique. Comprova que pots obrir `https://e1d8.github.io/LAFIGUERAEVENTS/content.json` i visitar la carta.

No cal afegir cap workflow ni compilar la web. El fitxer `.nojekyll` ha de continuar en l’arrel. [Configuració oficial de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

### 2. Crear el repositori del CMS i activar Pages

1. En GitHub Desktop, afig la carpeta `/Users/Fenikkel/Documents/Github/LaFigueraEventsCMS` com a repositori local.
2. Crea el primer commit i publica’l en el compte `e1d8`, amb el nom **LaFigueraEventsCMS**. Si ja existeix, utilitza el repositori existent.
3. En GitHub, obri el repositori del CMS i ves a **Settings → Pages**.
4. Selecciona **Deploy from a branch**, branca **main**, carpeta **/(root)** i polsa **Save**.
5. GitHub et mostrarà la URL del CMS. Si has utilitzat eixe nom, serà `https://e1d8.github.io/LaFigueraEventsCMS/`.

Si el teu pla de GitHub no permet Pages en repositoris privats, el repositori del CMS ha de ser públic. El codi no conté secrets. El botó de guardat només funcionarà quan completes els passos següents.

### 3. Crear el token de GitHub

1. En el teu perfil de GitHub, ves a **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Polsa **Generate new token** i posa-li un nom, per exemple `La Figuera CMS`.
3. Tria `e1d8` com a **Resource owner** i una data de caducitat que pugues recordar per renovar-lo.
4. En **Repository access**, selecciona **Only select repositories** i marca únicament **LAFIGUERAEVENTS**.
5. En **Repository permissions**, afig **Contents: Read and write**. El permís de lectura de Metadata apareixerà automàticament. No cal donar permisos d’Administration, Actions ni Pages.
6. Genera el token i copia’l temporalment per al pas 5. GitHub només el mostra una vegada.

El token permet al Worker fer commits en el repositori indicat. El codi del Worker només utilitza eixe accés per modificar `content.json`. [Guia oficial dels tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

### 4. Preparar Cloudflare

Obri el Terminal i executa:

```sh
cd /Users/Fenikkel/Documents/Github/LaFigueraEventsCMS
npm ci
npx wrangler login
```

S’obrirà el navegador perquè autoritzes Wrangler en el teu compte de Cloudflare. Si tens diversos comptes, tria el correcte quan se’t demane.

En `worker/wrangler.jsonc` ja està configurat:

```json
"ALLOWED_ORIGIN": "https://e1d8.github.io"
```

És només l’origen: **no** poses `/LaFigueraEventsCMS/` al final. Si utilitzes un domini propi per al CMS, substituïx-lo pel seu origen HTTPS, sense ruta ni barra final. El nom del repositori dins de GitHub Pages no canvia este valor.

### 5. Crear el Worker i afegir els secrets

Executa:

```sh
npm run worker:deploy
```

Esta primera publicació crea el Worker. Encara no acceptarà operacions, perquè falten els secrets.

Afig el token:

```sh
npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.jsonc
```

Quan ho demane, apega el token de GitHub i polsa Intro. L’entrada estarà oculta.

Afig la contrasenya que utilitzarà la persona que edite la web:

```sh
npx wrangler secret put CMS_PASSWORD --config worker/wrangler.jsonc
```

Escriu una contrasenya llarga i exclusiva, i polsa Intro. Pot contindre accents. No és la contrasenya de GitHub ni la de Cloudflare. Els secrets es guarden en Cloudflare i no formen part dels repositoris. [Secrets de Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

Wrangler també configura automàticament els límits de peticions: lectura i intents de guardat. No cal crear bases de dades, KV, cues ni cap domini propi.

### 6. Connectar el CMS amb el Worker

Cloudflare mostrarà una adreça semblant a:

```text
https://la-figuera-events-cms.el-teu-subdomini.workers.dev
```

La trobaràs també en **Cloudflare → Workers & Pages → la-figuera-events-cms**.

Obri `config.js` del CMS i substituïx el valor buit per **la teua URL real**, sense `/content` al final:

```js
export const WORKER_URL = 'https://la-figuera-events-cms.el-teu-subdomini.workers.dev';
```

Guarda el fitxer. En GitHub Desktop, fes commit i push dels canvis del CMS. Espera que GitHub Pages els publique i recarrega el CMS.

### 7. Provar el guardat

1. Obri el CMS i entra en **Inici**.
2. Fes un canvi menut en la descripció.
3. Polsa **Guardar**, introduïx la contrasenya del CMS i confirma.
4. Has de veure **«Canvis guardats. Es publicaran en breu.»**.
5. En `LAFIGUERAEVENTS` apareixerà un commit amb el missatge **«Actualitza el contingut des del CMS»** que modifica únicament `content.json`.
6. Espera la publicació de GitHub Pages i recarrega la web pública. La confirmació del CMS acredita el commit; no comprova que Pages ja l’haja publicat.

## Ús quotidià

- Selecciona una secció i edita els camps. Els grups de taules, ítems i preguntes es poden desplegar.
- Els botons **↑ / ↓** canvien l’ordre dins del grup. En taules, ítems i preguntes estan a la dreta, fora del desplegable. **×** elimina l’element després de demanar confirmació.
- En un text, selecciona les paraules i polsa **B**, **I** o **Enllaç**. Per separar línies, polsa Intro. El text apegat entra sense format extern.
- El commutador de cada preu permet triar **Import (€)** o **Text curt**. Els imports només accepten dígits i un separador decimal, coma o punt; una entrada no vàlida queda a zero. El símbol € s’afegix automàticament. En **Text curt** pots escriure lliurement. Cada preu té la seua descripció i el seu asterisc.
- Si hi ha un asterisc, ompli la nota de la taula. Sense asteriscs, la nota no es mostra.
- Les modificacions es conserven localment en eixe navegador fins a guardar. La contrasenya només s’utilitza per a l’enviament i es buida després.
- **Restablir** descarta l’esborrany local després de confirmar i torna a carregar el contingut actual de GitHub. Si falla la connexió, conserva l’esborrany perquè no perdes el treball. No modifica la web ni demana contrasenya.
- Si una altra persona ha guardat abans, el CMS bloqueja el guardat. Descarrega l’esborrany, carrega la versió actual i torna a aplicar els canvis necessaris. La descàrrega és una còpia de consulta, no una importació automàtica.

## Manteniment

### Canviar la contrasenya

Des de la carpeta del CMS:

```sh
npx wrangler secret put CMS_PASSWORD --config worker/wrangler.jsonc
```

Introduïx la nova contrasenya. No cal modificar ni tornar a publicar el CMS.

### Renovar el token

Genera un nou token amb els permisos del pas 3 i executa:

```sh
npx wrangler secret put GITHUB_TOKEN --config worker/wrangler.jsonc
```

Comprova un guardat i revoca el token anterior en GitHub.

### Recuperar una versió anterior del contingut

1. En GitHub, obri `LAFIGUERAEVENTS → content.json → History`.
2. Busca l’última versió correcta i obri el seu fitxer.
3. Copia el contingut complet d’eixa versió.
4. Torna a `content.json` en la branca `main`, polsa el llapis i substituïx el contingut pel que has copiat.
5. Crea el commit. Pages publicarà eixa versió.
6. Recarrega el CMS. Si hi havia un esborrany pendent, conserva’l i utilitza **Carregar versió actual** quan es detecte el conflicte.

### Problemes habituals

| Missatge o símptoma | Què revisar |
| --- | --- |
| El guardat encara no està disponible | Falta posar la URL del Worker en `config.js` i publicar el canvi. |
| Revisa la URL del Worker / El servei no ha retornat JSON | La URL ha d’incloure `https://`, per exemple `https://la-figuera-events-cms.el-teu-subdomini.workers.dev`, sense `/content` al final. |
| Encara apareix `Unexpected token '<'` després d’actualitzar | Comprova que obris la URL correcta del CMS. Publica també `index.html` i `app.js`, que forcen la renovació de l’aplicació i la configuració; espera la publicació i prova en una finestra privada. |
| No es pot carregar el contingut | Comprova URL del Worker, secrets, `ALLOWED_ORIGIN` i que el JSON ja estiga publicat en `main`. |
| La contrasenya no és correcta | Utilitza la de `CMS_PASSWORD`, no la de GitHub. |
| Massa intents | Espera un minut abans de tornar a guardar. El límit és per IP i ubicació de Cloudflare. |
| GitHub no ha pogut completar l’operació | Revisa la caducitat i els permisos del token, l’accés al repositori i possibles regles que impedisquen commits directes en `main`. |
| Hi ha una versió més recent | Descarrega l’esborrany i carrega la versió actual abans de tornar a editar. |
| Guardat confirmat però la web encara mostra el text anterior | Espera la publicació de Pages i recarrega; pots comprovar-la en GitHub → Actions. |

## Desenvolupament i comprovacions

El CMS i la web pública no necessiten compilació. Node i les dependències de desenvolupament s’utilitzen per a les proves i per desplegar el Worker.

```sh
npm ci
npm run check
npm test
npm run test:browser
```

Les proves de navegador utilitzen Chrome si està instal·lat en la ruta habitual de macOS. També pots definir `CHROME_PATH` o instal·lar Chromium amb `npx playwright install chromium`.

Per veure el CMS localment:

```sh
npm run dev
```

Obri `http://127.0.0.1:4174`. Amb `WORKER_URL` buit es mostra una còpia de demostració i es pot editar, però no guardar en GitHub. El servidor també exposa el repositori germà de la web en `http://127.0.0.1:4174/LAFIGUERAEVENTS/`.

Per provar amb un Worker local, posa `GITHUB_TOKEN` i `CMS_PASSWORD` en `worker/.dev.vars` —fitxer ignorat per Git— i executa:

```sh
npm run worker:dev -- --var ALLOWED_ORIGIN:http://127.0.0.1:4174
```

Temporalment, utilitza la URL HTTP local que mostre Wrangler com a `WORKER_URL`; restaura la URL HTTPS abans de publicar el CMS. Un guardat contra este Worker local també crea un commit real si utilitzes un token real. Les proves automàtiques simulen GitHub i no creen commits.

`shared/content-model.js` és la font de les regles compartides. `public-site/` conté els fitxers que s’instal·len directament en l’arrel de la web pública. Després d’un canvi en estos mòduls, sincronitza’ls:

```sh
npm run sync:site -- /Users/Fenikkel/Documents/Github/LAFIGUERAEVENTS
```

La sincronització conserva el JSON existent si ja està migrat i valida que siga compatible. No fa commits ni push. Actualitza també la còpia de demostració del CMS. En la web pública, executa igualment `npm run check` i `npm test` abans de publicar els canvis de codi.

### Contracte de l’API

- `GET /content`: retorna `{ document, sha }` amb el contingut de `main` i el SHA del fitxer.
- `POST /content`: rep `{ document, sha }`. La capçalera és `Authorization: Bearer <contrasenya codificada en Base64 UTF-8>`. Base64 és només el transport; HTTPS protegeix la petició.
- Un guardat confirmat retorna `{ sha, commit }`. Un reintent amb contingut ja guardat retorna `{ sha, commit: null, unchanged: true }` i no crea un altre commit.
- Errors: `401` contrasenya, `403` origen, `409` conflicte, `413` cos massa gran, `422` validació, `429` límit d’intents, `502` error de GitHub o de confirmació, `503` configuració incompleta.
- El límit del cos és 512 KiB. La contrasenya i el token mai s’inclouen en el JSON ni es registren en logs de l’aplicació.

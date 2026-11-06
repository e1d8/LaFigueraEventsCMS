import { WORKER_URL } from './config.js';
import { validateContent, COLORS, rich, textOf, parseAmount, safeLink, CONTACT_IDS } from './shared/content-model.js';
import { appendRich, readRich } from './shared/rich-text.js';

const main = document.querySelector('#main');
const navigation = document.querySelector('#navigation');
const saveButton = document.querySelector('#save');
const status = document.querySelector('#save-state');
const passwordDialog = document.querySelector('#password-dialog');
const passwordForm = document.querySelector('#password-form');
const passwordInput = document.querySelector('#password');
const passwordError = document.querySelector('#password-error');
const linkDialog = document.querySelector('#link-dialog');
const draftKey = `la-figuera-cms:v1:${WORKER_URL || 'local'}`;
const contactLabels = { whatsapp: 'WhatsApp', email: 'Correu', instagram: 'Instagram' };
let content, base, sha, latest;
let currentSection = 'general', dirty = false, busy = false, conflicted = false;
let localWarning = '', fieldSequence = 0, linkSelection;
let fields = new Map();
const expandedCards = new WeakSet();
const clone = value => structuredClone(value);
const el = (tag, className = '', text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function button(text, action, className = '') {
  const control = el('button', className, text); control.type = 'button';
  control.addEventListener('click', action); return control;
}
function setStatus(message) { status.textContent = message; }
function updateSave() { saveButton.disabled = !content || !dirty || busy || conflicted || !WORKER_URL; }

function persistDraft() {
  try {
    if (dirty) localStorage.setItem(draftKey, JSON.stringify({ document: content, base, sha, section: currentSection }));
    else localStorage.removeItem(draftKey);
    localWarning = '';
  } catch {
    localWarning = 'No es pot conservar l’esborrany en este navegador. Mantín esta pestanya oberta fins a guardar.';
    setStatus(localWarning);
  }
}
function changed() {
  dirty = JSON.stringify(content) !== JSON.stringify(base);
  persistDraft(); updateSave();
  if (!localWarning) setStatus(dirty ? 'Canvis sense guardar' : 'Sense canvis');
}

function field(label, path, control) {
  const wrapper = el('div', 'field'); wrapper.dataset.path = path;
  const id = `field-${++fieldSequence}`;
  const caption = el('label', '', label); caption.htmlFor = id;
  control.id = id;
  const error = el('p', 'field-error'); error.id = `${id}-error`; error.hidden = true;
  control.setAttribute('aria-describedby', error.id);
  wrapper.append(caption, control, error);
  fields.set(path, { wrapper, control, error });
  control.addEventListener('input', () => {
    wrapper.classList.remove('has-error'); error.hidden = true;
    (wrapper.querySelector('[contenteditable]') || control).removeAttribute('aria-invalid');
  });
  return wrapper;
}
function textField(label, value, path, update, maxLength = 200) {
  const control = el('input'); control.type = 'text'; control.value = value; control.maxLength = maxLength;
  control.addEventListener('input', () => { update(control.value); changed(); });
  return field(label, path, control);
}
function checkbox(label, checked, update) {
  const wrapper = el('label', 'check-label');
  const control = el('input'); control.type = 'checkbox'; control.checked = checked;
  control.addEventListener('change', () => { update(control.checked); changed(); });
  wrapper.append(control, document.createTextNode(label)); return wrapper;
}
function openLink(editor) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed || !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    setStatus('Selecciona el text que vols convertir en enllaç.'); return;
  }
  linkSelection = { range: selection.getRangeAt(0).cloneRange(), editor };
  const anchor = selection.anchorNode?.parentElement?.closest('a');
  document.querySelector('#link-url').value = anchor?.getAttribute('href') || 'https://';
  document.querySelector('#link-error').textContent = '';
  linkDialog.showModal(); document.querySelector('#link-url').focus();
}
function richField(label, value, path, update) {
  const shell = el('div', 'editor-wrap');
  const toolbar = el('div', 'toolbar'); toolbar.setAttribute('role', 'group'); toolbar.setAttribute('aria-label', `Format de ${label.toLowerCase()}`);
  const editor = el('div', 'rich-editor'); editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true'); editor.dataset.placeholder = 'Escriu ací…';
  appendRich(editor, value);
  const command = name => { editor.focus(); document.execCommand('styleWithCSS', false, false); document.execCommand(name); editor.dispatchEvent(new Event('input', { bubbles: true })); };
  for (const [name, text, title] of [['bold', 'B', 'Negreta'], ['italic', 'I', 'Cursiva'], ['link', 'Enllaç', 'Afegir enllaç'], ['unlink', 'Llevar enllaç', 'Llevar enllaç']]) {
    const control = button(text, () => name === 'link' ? openLink(editor) : command(name));
    control.setAttribute('aria-label', title); control.title = title;
    if (name === 'bold') control.style.fontWeight = '600';
    if (name === 'italic') control.style.fontStyle = 'italic';
    control.addEventListener('mousedown', event => event.preventDefault()); toolbar.append(control);
  }
  editor.addEventListener('beforeinput', event => {
    if (event.inputType === 'insertParagraph') { event.preventDefault(); document.execCommand('insertLineBreak'); }
  });
  editor.addEventListener('paste', event => {
    event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });
  editor.addEventListener('drop', event => event.preventDefault());
  editor.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openLink(editor); }
  });
  editor.addEventListener('input', () => { update(readRich(editor)); changed(); });
  shell.append(toolbar, editor);
  const wrapper = field(label, path, shell);
  const caption = wrapper.querySelector('label'); caption.htmlFor = `${shell.id}-editor`; editor.id = caption.htmlFor;
  editor.setAttribute('aria-labelledby', `${shell.id}-label`); caption.id = `${shell.id}-label`;
  editor.setAttribute('aria-describedby', `${shell.id}-error`);
  fields.get(path).control = editor;
  return wrapper;
}

document.querySelector('#link-form').addEventListener('submit', event => {
  event.preventDefault(); const href = document.querySelector('#link-url').value.trim();
  if (!safeLink(href)) { document.querySelector('#link-error').textContent = 'Utilitza un enllaç https:, mailto: o tel:.'; return; }
  linkDialog.close();
  const { range, editor } = linkSelection;
  editor.focus(); window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
  document.execCommand('createLink', false, href);
  editor.dispatchEvent(new Event('input', { bubbles: true })); linkSelection = null;
});
document.querySelector('#cancel-link').addEventListener('click', () => linkDialog.close());

function renderNavigation() {
  navigation.replaceChildren();
  for (const [id, label] of [['general', 'General'], ['home', 'Inici'], ...content.categories.map(category => [category.id, category.label]), ['contact', content.contact.label]]) {
    const control = button(label, () => { currentSection = id; render(); if (dirty) persistDraft(); });
    if (currentSection === id) control.setAttribute('aria-current', 'page');
    navigation.append(control);
  }
}
function moveControls(list, index, removeLabel) {
  const tools = el('div', 'card-tools');
  const move = delta => {
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    changed(); render();
  };
  const up = button('↑', () => move(-1)); up.disabled = index === 0; up.setAttribute('aria-label', 'Pujar');
  const down = button('↓', () => move(1)); down.disabled = index === list.length - 1; down.setAttribute('aria-label', 'Baixar');
  const remove = button('Eliminar', () => {
    if (!window.confirm(removeLabel)) return;
    list.splice(index, 1); changed(); render();
  }, 'delete');
  tools.append(up, down, remove); return tools;
}
function card(title, list, index, kind, path) {
  const node = el('details', `card ${kind}-card`); node.dataset.cardPath = path;
  node.contentEntry = list[index]; node.open = expandedCards.has(node.contentEntry);
  const summary = el('summary', '', title || 'Sense títol');
  const body = el('div', 'card-body');
  body.append(moveControls(list, index, kind === 'table' ? 'Vols eliminar esta taula i tots els seus ítems?' : 'Vols eliminar este element?'));
  node.append(summary, body);
  return { node, body, summary };
}
const emptyPrice = () => ({ kind: 'amount', amount: 0, description: [], star: false, bold: true, italic: false });
const emptyItem = () => ({ name: '', color: 'mustard', description: [], alert: [], prices: [emptyPrice()] });
function pendingControl(value) {
  if (!value.pending) return null;
  const block = el('div', 'pending'); block.append(checkbox('Informació pendent', true, checked => { value.pending = checked; })); return block;
}
function renderPrices(item, path) {
  const container = el('div');
  item.prices.forEach((price, index) => {
    const pp = `${path}.${index}`, block = el('div', 'price'); block.dataset.pricePath = pp;
    const heading = el('h3', '', `Preu ${index + 1}`); block.append(heading, moveControls(item.prices, index, 'Vols eliminar este preu?'));
    const grid = el('div', 'price-grid');
    const select = el('select');
    for (const [value, label] of [['amount', 'Import'], ['text', 'Text']]) { const option = el('option', '', label); option.value = value; select.append(option); }
    select.value = price.kind;
    select.addEventListener('change', () => {
      price.kind = select.value;
      if (price.kind === 'amount') { price.amount = 0; delete price.text; }
      else { price.text = ''; delete price.amount; }
      changed(); render();
    });
    grid.append(field('Tipus', `${pp}.kind`, select));
    if (price.kind === 'amount') {
      const display = typeof price.amount === 'number' ? String(price.amount / 100).replace('.', ',') : price.amount;
      const amount = textField('Import (€)', display ?? '', `${pp}.amount`, value => { price.amount = parseAmount(value) ?? value; }, 10);
      amount.querySelector('input').inputMode = 'decimal'; grid.append(amount);
    } else grid.append(textField('Text curt', price.text, `${pp}.text`, value => { price.text = value; }, 80));
    block.append(grid);
    const controls = el('div', 'price-controls');
    controls.append(checkbox('Asterisc', price.star, value => { price.star = value; refreshFootnoteHint(); }), checkbox('Negreta', price.bold, value => { price.bold = value; }), checkbox('Cursiva', price.italic, value => { price.italic = value; }));
    block.append(controls, richField('Descripció del preu (opcional)', price.description, `${pp}.description`, value => { price.description = value; }));
    const pending = pendingControl(price); if (pending) block.append(pending);
    container.append(block);
  });
  container.append(button('+ Afegir preu', () => { item.prices.push(emptyPrice()); changed(); render(); }, 'add'));
  return container;
}
function refreshFootnoteHint() {
  document.querySelectorAll('[data-footnote-hint]').forEach(hint => {
    const [ci, ti] = hint.dataset.footnoteHint.split(':').map(Number);
    const hasStar = content.categories[ci].tables[ti].items.some(item => item.prices.some(price => price.star));
    hint.textContent = hasStar ? 'Obligatòria: hi ha preus amb asterisc.' : 'Només apareixerà si algun preu té asterisc.';
  });
}
function renderTables(category, ci) {
  const container = el('div', 'collection');
  category.tables.forEach((table, ti) => {
    const tp = `categories.${ci}.tables.${ti}`;
    const { node, body, summary } = card(table.title, category.tables, ti, 'table', tp);
    body.append(textField('Títol de la taula', table.title, `${tp}.title`, value => { table.title = value; summary.lastChild.textContent = value || 'Sense títol'; }));
    const items = el('div', 'collection');
    table.items.forEach((item, ii) => {
      const ip = `${tp}.items.${ii}`;
      const entry = card(item.name, table.items, ii, 'item', ip);
      const swatch = el('span', 'swatch'); swatch.style.background = COLORS[item.color]; entry.summary.prepend(swatch);
      entry.body.append(textField('Nom de l’ítem', item.name, `${ip}.name`, value => { item.name = value; entry.summary.lastChild.textContent = value || 'Sense títol'; }));
      const colorField = el('div', 'field'); colorField.append(el('span', 'field-label', 'Color del subratllat'));
      const colors = el('div', 'colors'); colors.setAttribute('role', 'group'); colors.setAttribute('aria-label', 'Color del subratllat');
      for (const [color, name] of [['mustard', 'Mostassa'], ['purple', 'Lila'], ['green', 'Verd']]) {
        const label = el('label', 'color-option'), input = el('input'); input.type = 'radio'; input.name = `${ip}.color`; input.value = color; input.checked = color === item.color;
        input.addEventListener('change', () => { item.color = color; swatch.style.background = COLORS[color]; changed(); });
        const sample = el('span', '', name); sample.style.background = COLORS[color]; label.append(input, sample); colors.append(label);
      }
      colorField.append(colors);
      entry.body.append(colorField, richField('Descripció (opcional)', item.description, `${ip}.description`, value => { item.description = value; }), richField('Alerta (opcional)', item.alert, `${ip}.alert`, value => { item.alert = value; }), renderPrices(item, `${ip}.prices`));
      const pending = pendingControl(item); if (pending) entry.body.prepend(pending);
      items.append(entry.node);
    });
    body.append(items, button('+ Afegir ítem', () => { table.items.push(emptyItem()); changed(); render(); }, 'add'));
    const footnote = richField('Nota dels asteriscos', table.footnote, `${tp}.footnote`, value => { table.footnote = value; });
    footnote.classList.add('section-divider');
    const hint = el('p', 'footnote-hint'); hint.dataset.footnoteHint = `${ci}:${ti}`;
    body.append(footnote, hint); container.append(node);
  });
  container.append(button('+ Afegir taula', () => { category.tables.push({ title: '', footnote: [], items: [emptyItem()] }); changed(); render(); }, 'add'));
  return container;
}
function renderQuestions(category, ci) {
  const container = el('div', 'collection');
  category.questions.forEach((question, qi) => {
    const qp = `categories.${ci}.questions.${qi}`;
    const { node, body, summary } = card(textOf(question.question), category.questions, qi, 'question', qp);
    body.append(richField('Pregunta', question.question, `${qp}.question`, value => { question.question = value; summary.lastChild.textContent = textOf(value) || 'Sense títol'; }), richField('Resposta', question.answer, `${qp}.answer`, value => { question.answer = value; }));
    const pending = pendingControl(question); if (pending) body.prepend(pending);
    container.append(node);
  });
  container.append(button('+ Afegir pregunta', () => { category.questions.push({ question: [], answer: [] }); changed(); render(); }, 'add'));
  return container;
}

function downloadDraft() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
  const link = el('a'); link.href = url; link.download = 'esborrany-la-figuera.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function reloadCurrent() {
  if (dirty && !confirm('Vols descartar els canvis locals i carregar la versió actual? Pots descarregar abans l’esborrany.')) return;
  try {
    const result = await requestContent();
    latest = result; content = clone(result.document); base = clone(result.document); sha = result.sha;
    conflicted = false; dirty = false; persistDraft(); render(); setStatus('Versió actual carregada');
  } catch (error) { setStatus(error.message); }
}
function notices() {
  if (!WORKER_URL) { const notice = el('div', 'notice'); notice.append(el('p', '', 'El guardat encara no està disponible. Pots provar l’edició.')); main.append(notice); }
  if (localWarning) main.append(el('p', 'notice', localWarning));
  if (conflicted) {
    const notice = el('div', 'notice'); notice.setAttribute('role', 'alert');
    notice.append(el('p', '', 'Hi ha una versió més recent. Conserva l’esborrany abans de carregar-la.'));
    const actions = el('div', 'actions'); actions.append(button('Descarregar esborrany', downloadDraft), button('Carregar versió actual', reloadCurrent));
    notice.append(actions); main.append(notice);
  }
}
function render() {
  // Preserve expanded groups when a local action changes their contents.
  for (const node of main.querySelectorAll('details')) {
    if (node.open) expandedCards.add(node.contentEntry); else expandedCards.delete(node.contentEntry);
  }
  main.replaceChildren(); fields = new Map(); renderNavigation(); notices();
  if (currentSection === 'general') {
    main.append(el('h1', '', 'General'), el('h2', '', 'Categories'));
    content.categories.forEach((category, ci) => main.append(textField('Nom de la categoria', category.label, `categories.${ci}.label`, value => { category.label = value; renderNavigation(); })));
    main.append(textField('Nom de contacte', content.contact.label, 'contact.label', value => { content.contact.label = value; renderNavigation(); }), el('h2', '', 'Contactes'));
    for (const id of CONTACT_IDS) {
      const contact = content.contacts[id], group = el('section', 'contact-group');
      group.append(el('h3', '', contactLabels[id]), textField('Text visible', contact.text, `contacts.${id}.text`, value => { contact.text = value; }), textField('Enllaç', contact.href, `contacts.${id}.href`, value => { contact.href = value; }, 2048)); main.append(group);
    }
  } else if (currentSection === 'home' || currentSection === 'contact') {
    const entry = content[currentSection];
    main.append(el('h1', '', currentSection === 'home' ? 'Inici' : entry.label), richField('Descripció', entry.description, `${currentSection}.description`, value => { entry.description = value; }));
  } else {
    const ci = content.categories.findIndex(category => category.id === currentSection);
    if (ci < 0) { currentSection = 'general'; render(); return; }
    const category = content.categories[ci];
    main.append(el('h1', '', category.label), richField('Descripció', category.description, `categories.${ci}.description`, value => { category.description = value; }), el('h2', '', 'Taules'), renderTables(category, ci), el('h2', '', 'Preguntes freqüents'), renderQuestions(category, ci));
  }
  refreshFootnoteHint(); updateSave();
}
function showErrors(errors) {
  const first = errors[0];
  if (first.path.startsWith('categories.')) {
    const index = Number(first.path.split('.')[1]);
    currentSection = first.path.endsWith('.label') ? 'general' : content.categories[index]?.id || 'general';
  } else currentSection = first.path.startsWith('contacts.') || first.path === 'contact.label' ? 'general' : first.path.split('.')[0];
  render();
  for (const error of errors) {
    // Collection-level validation (e.g. no prices) is attached to the nearest card.
    const entry = fields.get(error.path);
    if (!entry) {
      const cardPath = error.path.replace(/\.(prices|items)$/, '');
      const node = [...main.querySelectorAll('details')].find(node => node.dataset.cardPath === cardPath);
      if (node) { node.open = true; node.querySelector('.card-body').prepend(el('p', 'error', error.message)); }
      continue;
    }
    entry.wrapper.classList.add('has-error'); entry.control.setAttribute('aria-invalid', 'true'); entry.error.textContent = error.message; entry.error.hidden = false;
    let ancestor = entry.wrapper.parentElement;
    while (ancestor) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
  }
  setStatus(first.message);
  const entry = fields.get(first.path);
  if (entry) { entry.control.focus(); entry.wrapper.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

async function requestContent() {
  const url = WORKER_URL ? `${WORKER_URL.replace(/\/$/, '')}/content` : './sample-content.json';
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No s’ha pogut carregar el contingut.');
  const loaded = WORKER_URL ? result : { document: result, sha: null };
  if (validateContent(loaded.document).length || WORKER_URL && !/^[a-f0-9]{40,64}$/.test(loaded.sha)) throw new Error('El contingut no té un format compatible.');
  return loaded;
}
async function load() {
  saveButton.disabled = true;
  try {
    latest = await requestContent();
    content = clone(latest.document); base = clone(latest.document); sha = latest.sha;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
      if (draft && draft.document?.schemaVersion === 1 && !validateContent(draft.base).length) {
        // Rendering is defensive below; malformed local storage never affects GitHub.
        content = draft.document; base = draft.base; sha = draft.sha;
        currentSection = draft.section || 'general'; dirty = JSON.stringify(content) !== JSON.stringify(base);
        conflicted = dirty && sha !== latest.sha;
      }
    } catch { localWarning = 'No s’ha pogut recuperar l’esborrany local.'; }
    try { render(); } catch {
      content = clone(latest.document); base = clone(latest.document); sha = latest.sha; currentSection = 'general'; dirty = false; conflicted = false;
      localWarning = 'L’esborrany local no és compatible. S’ha carregat el contingut actual.'; render();
    }
    setStatus(dirty ? 'Esborrany recuperat' : 'Sense canvis');
  } catch (error) {
    main.replaceChildren(el('h1', '', 'Contingut'), el('p', 'error', error.message), button('Reintentar', load));
  }
}

saveButton.addEventListener('click', () => {
  const errors = validateContent(content);
  if (errors.length) { showErrors(errors); return; }
  passwordForm.reset(); passwordError.textContent = ''; passwordDialog.showModal(); passwordInput.focus();
});
function closePassword() { if (busy) return; passwordDialog.close(); passwordForm.reset(); }
document.querySelector('#cancel-save').addEventListener('click', closePassword);
passwordDialog.addEventListener('cancel', event => { event.preventDefault(); closePassword(); });
passwordForm.addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !WORKER_URL || !dirty || conflicted) return;
  busy = true; updateSave(); passwordError.textContent = '';
  document.querySelector('.layout').inert = true;
  const controls = [...passwordForm.querySelectorAll('button, input')]; controls.forEach(control => { control.disabled = true; });
  setStatus('Guardant…');
  try {
    const password = btoa(Array.from(new TextEncoder().encode(passwordInput.value), byte => String.fromCharCode(byte)).join('')); passwordInput.value = '';
    const response = await fetch(`${WORKER_URL.replace(/\/$/, '')}/content`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
      body: JSON.stringify({ document: content, sha }), signal: AbortSignal.timeout(40000),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409) { conflicted = true; passwordDialog.close(); render(); }
      if (result.errors) { passwordDialog.close(); showErrors(result.errors); }
      throw new Error(result.error || 'No s’ha pogut confirmar el guardat.');
    }
    if (typeof result.sha !== 'string' || (!result.commit && !result.unchanged)) throw new Error('No s’ha pogut confirmar el guardat. Torna-ho a provar.');
    sha = result.sha; base = clone(content); latest = { document: clone(content), sha }; dirty = false; conflicted = false;
    persistDraft(); passwordDialog.close();
    status.dataset.commit = result.commit || '';
    setStatus(result.unchanged ? 'El contingut ja està guardat.' : 'Canvis guardats. Es publicaran en breu.');
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'TypeError' ? 'No s’ha pogut confirmar el guardat. Conservem l’esborrany; torna-ho a provar.' : error.message;
    passwordError.textContent = message; setStatus(message);
  } finally {
    busy = false; document.querySelector('.layout').inert = false; controls.forEach(control => { control.disabled = false; }); passwordInput.value = ''; updateSave();
    if (passwordDialog.open) passwordInput.focus();
  }
});
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('storage', event => {
  if (event.key === draftKey && dirty) { localWarning = 'Hi ha una altra pestanya editant el contingut. Conserva els canvis abans de continuar.'; setStatus(localWarning); }
});
load();

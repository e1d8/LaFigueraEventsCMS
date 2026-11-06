import { validateContent, COLORS, rich, textOf, parseAmount, safeLink, CONTACT_IDS, MAX_BODY_BYTES } from './shared/content-model.js';
import { appendRich, readRich } from './shared/rich-text.js';

// Always reload deployment configuration, even if an earlier URL is still in the browser cache.
const { WORKER_URL } = await import(`./config.js?v=${Date.now()}`);

const main = document.querySelector('#main');
const navigation = document.querySelector('#navigation');
const saveButton = document.querySelector('#save');
const resetButton = document.querySelector('#reset');
const status = document.querySelector('#save-state');
const passwordDialog = document.querySelector('#password-dialog');
const passwordForm = document.querySelector('#password-form');
const passwordInput = document.querySelector('#password');
const passwordError = document.querySelector('#password-error');
const linkDialog = document.querySelector('#link-dialog');
const resultDialog = document.querySelector('#result-dialog');
const resultMessage = document.querySelector('#result-message');
const resultSize = document.querySelector('#result-size');
const contactLabels = { whatsapp: 'WhatsApp', email: 'Correu', instagram: 'Instagram' };
let content, base, sha, latest;
let currentSection = 'general', dirty = false, busy = false, conflicted = false;
let fieldSequence = 0, linkSelection;
let fields = new Map();
let activeColorPicker;
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
function updateSave() {
  saveButton.disabled = !content || !dirty || busy || conflicted || !WORKER_URL;
  resetButton.disabled = !content || busy;
}

// Remove drafts left by previous versions. New edits only live in memory.
for (const storageName of ['localStorage', 'sessionStorage']) try {
  const storage = window[storageName];
  for (const key of Object.keys(storage)) if (key.startsWith('la-figuera-cms:v1:')) storage.removeItem(key);
} catch { /* Storage is optional; no content is ever persisted. */ }
function changed() {
  dirty = JSON.stringify(content) !== JSON.stringify(base);
  updateSave(); setStatus(dirty ? 'Canvis sense guardar' : 'Sense canvis');
}

function field(label, path, control, inline = false) {
  const wrapper = el(inline ? 'span' : 'div', 'field'); wrapper.dataset.path = path;
  const id = `field-${++fieldSequence}`;
  const caption = el('label', '', label); caption.htmlFor = id;
  control.id = id;
  const error = el(inline ? 'span' : 'p', 'field-error'); error.id = `${id}-error`; error.hidden = true;
  control.setAttribute('aria-describedby', error.id);
  wrapper.append(caption, control, error);
  if (inline) {
    wrapper.classList.add('inline-title-field'); caption.classList.add('visually-hidden');
    wrapper.addEventListener('click', event => event.stopPropagation());
    wrapper.addEventListener('keydown', event => event.stopPropagation());
  }
  fields.set(path, { wrapper, control, error });
  control.addEventListener('input', () => {
    wrapper.classList.remove('has-error'); error.hidden = true;
    (wrapper.querySelector('[contenteditable]') || control).removeAttribute('aria-invalid');
  });
  return wrapper;
}
function textField(label, value, path, update, maxLength = 200, inline = false) {
  const control = el('input'); control.type = 'text'; control.value = value; control.maxLength = maxLength;
  if (inline) control.placeholder = 'Sense títol';
  control.addEventListener('input', () => { update(control.value); changed(); });
  return field(label, path, control, inline);
}
function checkbox(label, checked, update) {
  const wrapper = el('label', 'check-label');
  const control = el('input'); control.type = 'checkbox'; control.checked = checked;
  control.addEventListener('change', () => { update(control.checked); changed(); });
  wrapper.append(control, document.createTextNode(label)); return wrapper;
}
function closeColorPicker() {
  if (!activeColorPicker) return;
  activeColorPicker.options.hidden = true;
  activeColorPicker.trigger.setAttribute('aria-expanded', 'false');
  activeColorPicker = undefined;
}
function colorPicker(item) {
  const selector = el('span', 'color-selector');
  const trigger = button('', () => {
    const wasOpen = activeColorPicker?.selector === selector;
    closeColorPicker();
    if (!wasOpen) {
      options.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      activeColorPicker = { selector, trigger, options };
      options.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }, 'swatch-button');
  const swatch = el('span', 'swatch'); swatch.setAttribute('aria-hidden', 'true'); trigger.append(swatch);
  trigger.setAttribute('aria-expanded', 'false');
  const options = el('span', 'color-options'); options.hidden = true;
  options.id = `color-options-${++fieldSequence}`; trigger.setAttribute('aria-controls', options.id);
  options.setAttribute('role', 'group'); options.setAttribute('aria-label', 'Color del subratllat');
  const labels = { mustard: 'Mostassa', purple: 'Lila', green: 'Verd' };
  const update = () => {
    swatch.style.background = COLORS[item.color];
    trigger.setAttribute('aria-label', `Color del subratllat: ${labels[item.color]}`);
    trigger.title = `Color del subratllat: ${labels[item.color]}`;
    for (const option of options.children) {
      const selected = option.dataset.color === item.color;
      option.setAttribute('aria-pressed', String(selected)); option.textContent = selected ? '✓' : '';
    }
  };
  for (const [color, label] of Object.entries(labels)) {
    const option = button('', () => {
      item.color = color; update(); changed(); closeColorPicker(); trigger.focus();
    }, 'color-choice');
    option.dataset.color = color; option.style.background = COLORS[color];
    option.setAttribute('aria-label', label); option.title = label; options.append(option);
  }
  selector.addEventListener('click', event => event.stopPropagation());
  selector.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeColorPicker(); trigger.focus(); }
    if (!options.hidden && ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const choices = [...options.children], current = choices.indexOf(document.activeElement);
      const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
      choices[(current + step + choices.length) % choices.length].focus();
    }
  });
  update(); selector.append(trigger, options); return selector;
}
function dismissColorPicker(event) {
  if (activeColorPicker && !activeColorPicker.selector.contains(event.target)) closeColorPicker();
}
document.addEventListener('pointerdown', dismissColorPicker);
document.addEventListener('focusin', dismissColorPicker);
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeColorPicker(); });
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
function richField(label, value, path, update, inline = false) {
  const tag = inline ? 'span' : 'div';
  const shell = el(tag, 'editor-wrap');
  const editor = el(tag, 'rich-editor'); editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-multiline', 'true'); editor.dataset.placeholder = 'Escriu ací…';
  editor.setAttribute('aria-keyshortcuts', 'Control+B Meta+B Control+I Meta+I Control+K Meta+K');
  appendRich(editor, value);
  const command = name => { editor.focus(); document.execCommand('styleWithCSS', false, false); document.execCommand(name); editor.dispatchEvent(new Event('input', { bubbles: true })); };
  editor.addEventListener('beforeinput', event => {
    if (event.inputType === 'insertParagraph') { event.preventDefault(); document.execCommand('insertLineBreak'); }
  });
  editor.addEventListener('paste', event => {
    event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });
  editor.addEventListener('drop', event => event.preventDefault());
  editor.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'b' || key === 'i') { event.preventDefault(); command(key === 'b' ? 'bold' : 'italic'); }
    if (key === 'k') { event.preventDefault(); if (event.shiftKey) command('unlink'); else openLink(editor); }
  });
  editor.addEventListener('input', () => { update(readRich(editor)); changed(); });
  shell.append(editor);
  const wrapper = field(label, path, shell, inline);
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
    const control = button(label, () => { currentSection = id; render(); });
    if (currentSection === id) control.setAttribute('aria-current', 'page');
    navigation.append(control);
  }
}
function moveControls(list, index, removeLabel, compact = false) {
  const tools = el('div', 'card-tools');
  const move = delta => {
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    changed(); render();
  };
  const up = button('↑', () => move(-1)); up.disabled = index === 0; up.setAttribute('aria-label', 'Pujar');
  const down = button('↓', () => move(1)); down.disabled = index === list.length - 1; down.setAttribute('aria-label', 'Baixar');
  const remove = button(compact ? '×' : 'Eliminar', () => {
    if (!window.confirm(removeLabel)) return;
    list.splice(index, 1); changed(); render();
  }, 'delete');
  remove.setAttribute('aria-label', 'Eliminar'); remove.title = 'Eliminar';
  up.title = 'Pujar'; down.title = 'Baixar';
  tools.append(up, down, remove); return tools;
}
function card(list, index, kind, path) {
  const row = el('div', 'card-row');
  const node = el('details', `card ${kind}-card`); node.dataset.cardPath = path;
  node.contentEntry = list[index]; node.open = expandedCards.has(node.contentEntry);
  const summary = el('summary');
  const body = el('div', 'card-body');
  const controls = moveControls(list, index, kind === 'table' ? 'Vols eliminar esta taula i tots els seus ítems?' : 'Vols eliminar este element?', true);
  controls.dataset.controlsFor = path;
  node.append(summary, body);
  row.append(node, controls);
  return { node, body, summary, row };
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
    const header = el('div', 'price-heading');
    header.append(el('h3', '', `Preu ${index + 1}`), moveControls(item.prices, index, 'Vols eliminar este preu?', true));
    block.append(header, richField('Descripció (opcional)', price.description, `${pp}.description`, value => { price.description = value; }));
    const toggle = el('div', 'price-type-toggle');
    toggle.setAttribute('role', 'group'); toggle.setAttribute('aria-label', 'Tipus de preu');
    for (const [kind, label] of [['amount', 'Import (€)'], ['text', 'Text curt']]) {
      const option = button(label, () => {
        if (price.kind === kind) return;
        price.kind = kind;
        if (kind === 'amount') { price.amount = 0; delete price.text; }
        else { price.text = ''; price.star = false; delete price.amount; }
        changed(); render();
      });
      option.setAttribute('aria-pressed', String(price.kind === kind)); toggle.append(option);
    }
    const valueOptions = el('div', 'price-value-options'); valueOptions.append(toggle);
    if (price.kind === 'amount') {
      const star = button('', () => {
        price.star = !price.star; star.setAttribute('aria-pressed', String(price.star)); changed(); refreshFootnoteHint();
      }, 'asterisk-toggle');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
      const strokes = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      strokes.setAttribute('d', 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9');
      strokes.setAttribute('fill', 'none'); strokes.setAttribute('stroke', 'currentColor');
      strokes.setAttribute('stroke-width', '2'); strokes.setAttribute('stroke-linecap', 'round');
      icon.append(strokes); star.append(icon);
      star.setAttribute('aria-label', 'Asterisc'); star.title = 'Asterisc'; star.setAttribute('aria-pressed', String(price.star));
      valueOptions.append(star);
    }
    let valueField;
    if (price.kind === 'amount') {
      const display = typeof price.amount === 'number' ? String(price.amount / 100).replace('.', ',') : price.amount;
      const input = el('input'); input.type = 'text'; input.inputMode = 'decimal'; input.maxLength = 10;
      input.value = display ?? '0';
      const validInput = value => /^\d{0,7}(?:[.,]\d{0,2})?$/.test(value);
      let acceptedValue = validInput(input.value) ? input.value : '0';
      input.value = acceptedValue;
      input.addEventListener('beforeinput', event => {
        if (event.isComposing || event.inputType !== 'insertText' || event.data === null) return;
        const candidate = input.value.slice(0, input.selectionStart) + event.data + input.value.slice(input.selectionEnd);
        if (/^\d*(?:[.,]\d{3,})$/.test(candidate)) event.preventDefault();
      });
      input.addEventListener('input', () => {
        if (/^\d*(?:[.,]\d{3,})$/.test(input.value)) { input.value = acceptedValue; return; }
        if (!validInput(input.value)) input.value = '0';
        acceptedValue = input.value;
        let number = input.value.replace(/[.,]$/, '');
        if (/^[.,]/.test(number)) number = `0${number}`;
        price.amount = parseAmount(number) ?? 0;
        changed();
      });
      input.addEventListener('blur', () => { input.value = String(price.amount / 100).replace('.', ','); acceptedValue = input.value; });
      valueField = field('Import (€)', `${pp}.amount`, input);
    } else valueField = textField('Text curt', price.text, `${pp}.text`, value => { price.text = value; }, 80);
    valueField.querySelector('label').classList.add('visually-hidden');
    valueField.classList.add('price-value-field'); valueField.prepend(valueOptions); block.append(valueField);
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
    const { row, body, summary } = card(category.tables, ti, 'table', tp);
    summary.append(textField('Títol de la taula', table.title, `${tp}.title`, value => { table.title = value; }, 200, true));
    const items = el('div', 'collection');
    table.items.forEach((item, ii) => {
      const ip = `${tp}.items.${ii}`;
      const entry = card(table.items, ii, 'item', ip);
      entry.summary.prepend(colorPicker(item));
      entry.summary.append(textField('Nom de l’ítem', item.name, `${ip}.name`, value => { item.name = value; }, 200, true));
      entry.body.append(richField('Descripció (opcional)', item.description, `${ip}.description`, value => { item.description = value; }), richField('Alerta (opcional)', item.alert, `${ip}.alert`, value => { item.alert = value; }), renderPrices(item, `${ip}.prices`));
      const pending = pendingControl(item); if (pending) entry.body.prepend(pending);
      items.append(entry.row);
    });
    body.append(items, button('+ Afegir ítem', () => { table.items.push(emptyItem()); changed(); render(); }, 'add'));
    const footnote = richField('Nota dels asteriscos', table.footnote, `${tp}.footnote`, value => { table.footnote = value; });
    footnote.classList.add('section-divider');
    const hint = el('p', 'footnote-hint'); hint.dataset.footnoteHint = `${ci}:${ti}`;
    body.append(footnote, hint); container.append(row);
  });
  container.append(button('+ Afegir taula', () => { category.tables.push({ title: '', footnote: [], items: [emptyItem()] }); changed(); render(); }, 'add'));
  return container;
}
function renderQuestions(category, ci) {
  const container = el('div', 'collection');
  category.questions.forEach((question, qi) => {
    const qp = `categories.${ci}.questions.${qi}`;
    const { row, body, summary } = card(category.questions, qi, 'question', qp);
    summary.append(textField('Pregunta', textOf(question.question), `${qp}.question`, value => { question.question = rich(value); }, 20000, true));
    body.append(richField('Resposta', question.answer, `${qp}.answer`, value => { question.answer = value; }));
    const pending = pendingControl(question); if (pending) body.prepend(pending);
    container.append(row);
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
  if (busy) return;
  if (dirty && !confirm('Vols esborrar l’esborrany i carregar el contingut actual? Els canvis sense guardar es perdran.')) return;
  busy = true; updateSave(); document.querySelector('.layout').inert = true; setStatus('Carregant la versió actual…');
  try {
    const result = await requestContent();
    latest = result; content = clone(result.document); base = clone(result.document); sha = result.sha;
    conflicted = false; dirty = false; render(); setStatus('Versió actual carregada');
  } catch (error) { setStatus(error.message); }
  finally { busy = false; document.querySelector('.layout').inert = false; updateSave(); }
}
resetButton.addEventListener('click', reloadCurrent);
function notices() {
  if (!WORKER_URL) { const notice = el('div', 'notice'); notice.append(el('p', '', 'El guardat encara no està disponible. Pots provar l’edició.')); main.append(notice); }
  if (conflicted) {
    const notice = el('div', 'notice'); notice.setAttribute('role', 'alert');
    notice.append(el('p', '', 'Hi ha una versió més recent. Conserva l’esborrany abans de carregar-la.'));
    const actions = el('div', 'actions'); actions.append(button('Descarregar esborrany', downloadDraft), button('Carregar versió actual', reloadCurrent));
    notice.append(actions); main.append(notice);
  }
}
function render() {
  closeColorPicker();
  // Preserve expanded groups when a local action changes their contents.
  for (const node of main.querySelectorAll('details')) {
    if (node.open) expandedCards.add(node.contentEntry); else expandedCards.delete(node.contentEntry);
  }
  main.replaceChildren(); fields = new Map(); renderNavigation(); notices();
  if (currentSection === 'general') {
    main.append(el('h1', '', 'General'), el('h2', '', 'Categories'));
    content.categories.forEach((category, ci) => main.append(textField(`${ci + 1}a`, category.label, `categories.${ci}.label`, value => { category.label = value; renderNavigation(); })));
    main.append(textField('4a', content.contact.label, 'contact.label', value => { content.contact.label = value; renderNavigation(); }), el('h2', '', 'Contactes'));
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

function contentEndpoint() {
  let url;
  try { url = new URL(WORKER_URL); } catch { /* Report configuration errors before fetching a relative HTML page. */ }
  if (!url || !['https:', 'http:'].includes(url.protocol) || url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    throw new Error('Revisa la URL del Worker: ha de començar per https:// i no portar /content al final.');
  }
  return `${url.origin}/content`;
}

async function readResponse(response) {
  let result;
  try { result = await response.json(); }
  catch { throw new Error('El servei no ha retornat JSON. Revisa que la URL configurada siga la del Worker.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('El servei ha retornat una resposta no compatible.');
  return result;
}

async function requestContent() {
  const url = WORKER_URL ? contentEndpoint() : './sample-content.json';
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  const result = await readResponse(response);
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
    currentSection = 'general'; dirty = false; conflicted = false;
    render(); setStatus('Sense canvis');
  } catch (error) {
    main.replaceChildren(el('h1', '', 'Contingut'), el('p', 'error', error.message), button('Reintentar', load));
  }
}

function showResult(success, message, bodyBytes) {
  document.querySelector('#result-title').textContent = success ? 'Canvis guardats' : 'No s’ha pogut guardar';
  resultMessage.textContent = message; resultMessage.classList.toggle('error', !success);
  const kib = new Intl.NumberFormat('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bodyBytes / 1024);
  resultSize.textContent = `${kib} KiB enviats de màxim ${MAX_BODY_BYTES / 1024} KiB`;
  resultMessage.hidden = false; resultSize.hidden = true;
  resultDialog.showModal(); document.querySelector('#result-body').focus();
}
function revealSize(reveal) { resultMessage.hidden = reveal; resultSize.hidden = !reveal; }
resultDialog.addEventListener('pointerdown', event => {
  if (event.target.closest('button') || event.button !== 0) return;
  event.preventDefault(); resultDialog.setPointerCapture(event.pointerId); revealSize(true);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) resultDialog.addEventListener(type, () => revealSize(false));
document.querySelector('#result-body').addEventListener('keydown', event => {
  if (event.key === ' ') { event.preventDefault(); revealSize(true); }
});
document.querySelector('#result-body').addEventListener('keyup', event => { if (event.key === ' ') revealSize(false); });
document.querySelector('#result-body').addEventListener('blur', () => revealSize(false));
resultDialog.addEventListener('close', () => revealSize(false));
document.querySelector('#close-result').addEventListener('click', () => resultDialog.close());

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
  const body = JSON.stringify({ document: content, sha });
  const bodyBytes = new TextEncoder().encode(body).byteLength;
  let outcome;
  try {
    const password = btoa(Array.from(new TextEncoder().encode(passwordInput.value), byte => String.fromCharCode(byte)).join('')); passwordInput.value = '';
    const response = await fetch(contentEndpoint(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${password}` },
      body, signal: AbortSignal.timeout(40000),
    });
    const result = await readResponse(response);
    if (!response.ok) {
      if (response.status === 409) { conflicted = true; passwordDialog.close(); render(); }
      if (result.errors) { passwordDialog.close(); showErrors(result.errors); }
      throw new Error(result.error || 'No s’ha pogut confirmar el guardat.');
    }
    if (typeof result.sha !== 'string' || (!result.commit && !result.unchanged)) throw new Error('No s’ha pogut confirmar el guardat. Torna-ho a provar.');
    sha = result.sha; base = clone(content); latest = { document: clone(content), sha }; dirty = false; conflicted = false;
    status.dataset.commit = result.commit || '';
    const message = result.unchanged ? 'El contingut ja està guardat.' : 'Canvis guardats. Es publicaran en breu.';
    setStatus(message); outcome = { success: true, message };
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'TypeError' ? 'No s’ha pogut confirmar el guardat. Els canvis es mantenen en esta pestanya; torna-ho a provar.' : error.message;
    setStatus(message); outcome = { success: false, message };
  } finally {
    busy = false; document.querySelector('.layout').inert = false; controls.forEach(control => { control.disabled = false; }); passwordInput.value = ''; updateSave();
    passwordDialog.close();
    if (outcome) showResult(outcome.success, outcome.message, bodyBytes);
  }
});
load();

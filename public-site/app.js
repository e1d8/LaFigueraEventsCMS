import { loadContent } from './content.js';
import { COLORS, formatAmount, textOf } from './content-model.js';
import { appendRich } from './rich-text.js';
import { sectionPath, sectionFromLocation } from './routes.js';

const appRoot = new URL('./', import.meta.url);
const resourceBase = document.querySelector('base') || document.head.insertBefore(document.createElement('base'), document.head.firstChild);
resourceBase.href = appRoot.href;
const routePath = id => sectionPath(id, appRoot.pathname);
document.querySelector('.brand').href = routePath('la-carta');
const main = document.querySelector('#main'), navigation = document.querySelector('#navigation');
const sectionImages = { 'tartes-nupcials': 'nupcial-painted.png', 'bufet-de-tortades': 'torta-painted.png', 'taules-dolces': 'galetes-painted.png', contacte: 'contacte-painted.png' };
const contactInfo = {
  whatsapp: { label: 'WhatsApp', image: 'contact-whatsapp-painted.png' },
  email: { label: 'Correu', image: 'contacte-painted.png' },
  instagram: { label: 'Instagram', image: 'contact-instagram-painted.png' },
};
const el = (tag, className = '', text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const paragraph = (runs, className = '') => appendRich(el('p', className), runs);
const pendingBadge = () => el('span', 'pending-badge', 'Informació pendent');
const hasText = runs => Boolean(textOf(runs).trim());
function externalLink(href, className = '') {
  const node = el('a', className); node.href = href;
  if (href.startsWith('https:')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
  return node;
}
function image(file, className, width, height) {
  const node = el('img', className); node.src = `./assets/${file}`; node.alt = ''; node.width = width; node.height = height; return node;
}

export function renderCatalogue(table) {
  const list = el('div', 'product-list');
  table.items.forEach((data, index) => {
    const item = el('article', 'product-item'); item.style.setProperty('--name-highlight', COLORS[data.color]);
    const heading = el('div', 'product-heading');
    const name = el('h3', 'product-name');
    const marker = el('span', 'product-name-text marker-text', data.name); marker.dataset.underline = index % 4;
    name.append(marker); if (data.pending) name.append(pendingBadge()); heading.append(name);
    if (hasText(data.alert)) {
      const note = el('small', 'product-note'); note.append(image('alerta.png', 'product-note-icon', 64, 64)); appendRich(note, data.alert); heading.append(note);
    }
    item.append(heading);
    if (hasText(data.description)) {
      const details = el('div', 'product-details'); details.append(appendRich(el('div', 'product-detail'), data.description)); item.append(details);
    }
    const options = el('div', 'product-options');
    data.prices.forEach(price => {
      const option = el('span', 'product-option');
      if (hasText(price.description)) option.append(appendRich(el('span', 'product-option-label'), price.description));
      const value = el('span', 'product-option-value');
      const amount = el('span', price.kind === 'amount' ? 'amount' : '');
      appendRich(amount, [{ text: (price.kind === 'amount' ? `${formatAmount(price.amount)}€` : price.text) + (price.star ? '*' : ''), bold: price.bold, italic: price.italic }]);
      value.append(amount); if (price.pending) value.append(pendingBadge()); option.append(value); options.append(option);
    });
    item.append(options); list.append(item);
  });
  return list;
}

function catalogueBlock(table) {
  const block = el('section', 'catalogue-block');
  block.append(el('h2', 'catalogue-heading', table.title), renderCatalogue(table));
  if (table.items.some(item => item.prices.some(price => price.star))) {
    const note = el('p', 'pickup-note'); note.append(document.createTextNode('*')); appendRich(note, table.footnote); block.append(note);
  }
  return block;
}
function questionsBlock(questions) {
  const block = el('section', 'faq-block'), heading = el('div', 'faq-heading'), list = el('div', 'faq-list');
  heading.append(el('h2', '', 'Preguntes freqüents'));
  questions.forEach(question => {
    const details = el('details', 'faq-item'), summary = el('summary'), answer = el('div', 'faq-answer');
    summary.append(appendRich(el('span'), question.question), el('span', 'faq-toggle', '+'));
    answer.append(paragraph(question.answer)); if (question.pending) answer.append(pendingBadge());
    details.append(summary, answer);
    details.addEventListener('toggle', () => { if (details.open) list.querySelectorAll('details').forEach(other => { if (other !== details) other.open = false; }); });
    list.append(details);
  });
  block.append(heading, list); return block;
}
function sectionLead(section, illustrated = true) {
  const lead = el('div', `section-lead${illustrated ? '' : ' section-lead-text'}`), heading = el('div', 'panel-heading');
  heading.append(el('h1', '', `${section.label}:`));
  const copy = el('div', 'section-lead-copy'); copy.append(heading, paragraph(section.description, 'section-intro')); lead.append(copy);
  if (illustrated) lead.append(image(sectionImages[section.id], 'section-illustration', 240, 180));
  return lead;
}
function home(content, sections) {
  const container = el('div', 'home-content'), choices = el('nav', 'home-choices');
  container.append(el('h1', 'visually-hidden', 'La Figuera Events'), paragraph(content.home.description, 'home-opening'));
  choices.setAttribute('aria-label', 'Seccions de La Figuera Events');
  sections.filter(section => section.id !== 'la-carta').forEach((section, index) => {
    const link = el('a', 'home-choice'); link.href = routePath(section.id); link.dataset.section = section.id;
    const title = el('span', 'home-choice-title marker-text', section.label); title.dataset.underline = index;
    link.append(image(sectionImages[section.id], 'home-choice-image', 240, 180), title); choices.append(link);
  });
  container.append(choices); return container;
}
function contactContent(content, section) {
  const container = el('div', 'contact-content'), list = el('ul', 'contact-list');
  container.append(sectionLead(section, false));
  for (const id of ['whatsapp', 'email', 'instagram']) {
    const contact = content.contacts[id], info = contactInfo[id], row = el('li', 'contact-row'), link = externalLink(contact.href, 'contact-link'), details = el('div', 'contact-details');
    details.append(el('span', 'contact-label', info.label), el('span', 'contact-value', contact.text));
    link.append(image(info.image, 'contact-illustration', 100, 100), details); row.append(link); list.append(row);
  }
  container.append(list); return container;
}
function catalogue(category) {
  const container = el('div', 'catalogue-content'); container.append(sectionLead(category));
  category.tables.forEach(table => container.append(catalogueBlock(table)));
  if (category.questions.length) container.append(questionsBlock(category.questions));
  return container;
}
function renderFooter(content) {
  const container = el('span');
  for (const [index, id] of ['instagram', 'whatsapp', 'email'].entries()) {
    if (index) { const separator = el('span', 'footer-separator', '·'); separator.setAttribute('aria-hidden', 'true'); container.append(separator); }
    const contact = content.contacts[id], link = externalLink(contact.href); link.textContent = contact.text; container.append(link);
  }
  document.querySelector('.site-footer').replaceChildren(container);
}

let sections = [], selected;
function selectSection({ scroll = true } = {}) {
  if (!sections.length) return;
  const requested = sectionFromLocation(location, appRoot.pathname), section = sections.find(item => item.id === requested) || sections[0];
  const changed = selected !== section.id;
  if (changed) main.querySelectorAll('details[open]').forEach(details => { details.open = false; });
  const canonicalURL = routePath(section.id) + location.search;
  if (location.pathname + location.search + location.hash !== canonicalURL) history.replaceState(null, '', canonicalURL);
  const isHome = section.id === 'la-carta'; document.body.classList.toggle('is-home', isHome); navigation.hidden = isHome;
  document.querySelectorAll('.panel').forEach(panel => { panel.hidden = panel.id !== `panel-${section.id}`; });
  document.querySelectorAll('.site-header a[data-section]').forEach(link => {
    const active = link.dataset.section === section.id; link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  document.title = isHome ? 'La Figuera Events' : `La Figuera Events · ${section.label}`; selected = section.id;
  if (scroll && changed) window.scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-section]');
  if (!link || !sections.length || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || link.target && link.target !== '_self') return;
  event.preventDefault(); const target = routePath(link.dataset.section);
  if (location.pathname + location.search + location.hash !== target) history.pushState(null, '', target);
  selectSection();
});
window.addEventListener('popstate', () => selectSection()); window.addEventListener('hashchange', () => selectSection());

async function start() {
  main.replaceChildren(el('p', 'loading-message', 'Carregant…'));
  try {
    const content = await loadContent();
    sections = [{ id: 'la-carta', label: 'Inici' }, ...content.categories, { id: 'contacte', ...content.contact }];
    main.replaceChildren(); navigation.replaceChildren(); renderFooter(content);
    sections.forEach(section => {
      if (section.id !== 'la-carta') {
        const link = el('a', 'nav-tab'), label = el('span', 'nav-label marker-text', section.label); label.dataset.underline = navigation.children.length;
        link.href = routePath(section.id); link.dataset.section = section.id; link.append(label); navigation.append(link);
      }
      const panel = el('section', 'panel'); panel.id = `panel-${section.id}`; panel.hidden = true;
      panel.append(section.id === 'la-carta' ? home(content, sections) : section.id === 'contacte' ? contactContent(content, section) : catalogue(section)); main.append(panel);
    });
    selectSection({ scroll: false });
  } catch {
    sections = []; navigation.replaceChildren();
    const block = el('div', 'load-error'); block.setAttribute('role', 'alert');
    const retry = el('button', '', 'Reintentar'); retry.type = 'button'; retry.addEventListener('click', start);
    block.append(el('p', '', 'No s’ha pogut carregar el contingut.'), retry); main.replaceChildren(block);
  }
}
start();

// Canonical schema. scripts/sync-public-site.mjs copies this module to the public site.
export const CATEGORY_IDS = Object.freeze(['tartes-nupcials', 'bufet-de-tortades', 'taules-dolces']);
export const CONTACT_IDS = Object.freeze(['whatsapp', 'email', 'instagram']);
export const COLORS = Object.freeze({ mustard: '#ddc17c', purple: '#cca8c5', green: '#a8ccc3' });
export const MAX_BODY_BYTES = 512 * 1024;
export const textOf = runs => runs.map(run => run.text).join('');
export const rich = text => text ? [{ text }] : [];

export function safeLink(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'mailto:', 'tel:'].includes(url.protocol) &&
      (url.protocol !== 'https:' || Boolean(url.hostname) && !url.username && !url.password);
  } catch { return false; }
}

export function parseAmount(input) {
  const value = String(input).trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function formatAmount(cents) {
  return new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 2 }).format(cents / 100);
}

export function validateContent(document) {
  const errors = [];
  const fail = (path, message) => { if (errors.length < 30) errors.push({ path, message }); };
  function object(value, keys, path, required = keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail(path, 'Ha de ser un objecte.'); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(path, `Camp no permés: ${key}.`);
    for (const key of required) if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, 'Falta este camp.');
    return true;
  }
  function string(value, path, max = 200, required = true) {
    if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail(path, `Cal un text${required ? ' no buit' : ''} de fins a ${max} caràcters.`);
  }
  function array(value, path, max, min = 0) {
    if (!Array.isArray(value) || value.length > max || value.length < min) { fail(path, `Cal una llista d’entre ${min} i ${max} elements.`); return false; }
    return true;
  }
  function boolean(value, path) { if (typeof value !== 'boolean') fail(path, 'Ha de ser sí o no.'); }
  function formatted(value, path, required = false) {
    if (!array(value, path, 2000)) return;
    let length = 0;
    for (const [i, run] of value.entries()) {
      const at = `${path}.${i}`;
      if (!object(run, ['text', 'bold', 'italic', 'href'], at, ['text'])) continue;
      string(run.text, at, 20000, false);
      if (typeof run.text === 'string') length += run.text.length;
      for (const key of ['bold', 'italic']) if (Object.hasOwn(run, key)) boolean(run[key], `${at}.${key}`);
      if (Object.hasOwn(run, 'href') && !safeLink(run.href)) fail(at, 'L’enllaç ha de començar per https:, mailto: o tel:.');
    }
    if (length > 20000) fail(path, 'El text és massa llarg.');
    if (required && !value.some(run => typeof run?.text === 'string' && run.text.trim())) fail(path, 'Ompli este text.');
  }
  function pending(value, path) { if (Object.hasOwn(value, 'pending')) boolean(value.pending, `${path}.pending`); }
  if (!object(document, ['schemaVersion', 'home', 'contact', 'contacts', 'categories'], 'contingut')) return errors;
  if (document.schemaVersion !== 1) fail('schemaVersion', 'Versió de contingut no compatible.');
  if (object(document.home, ['description'], 'home')) formatted(document.home.description, 'home.description', true);
  if (object(document.contact, ['label', 'description'], 'contact')) {
    string(document.contact.label, 'contact.label');
    formatted(document.contact.description, 'contact.description', true);
  }
  if (object(document.contacts, CONTACT_IDS, 'contacts')) for (const id of CONTACT_IDS) {
    const value = document.contacts[id];
    if (!object(value, ['text', 'href'], `contacts.${id}`)) continue;
    string(value.text, `contacts.${id}.text`);
    if (!safeLink(value.href)) fail(`contacts.${id}.href`, 'Enllaç no vàlid. Utilitza https:, mailto: o tel:.');
  }
  if (array(document.categories, 'categories', 3, 3)) {
    const ids = document.categories.map(category => category?.id);
    if (new Set(ids).size !== 3 || CATEGORY_IDS.some(id => !ids.includes(id))) fail('categories', 'Les tres categories són fixes.');
    document.categories.forEach((category, ci) => {
      const cp = `categories.${ci}`;
      if (!object(category, ['id', 'label', 'description', 'tables', 'questions'], cp)) return;
      string(category.label, `${cp}.label`);
      formatted(category.description, `${cp}.description`, true);
      if (array(category.questions, `${cp}.questions`, 100)) category.questions.forEach((question, qi) => {
        const qp = `${cp}.questions.${qi}`;
        if (!object(question, ['question', 'answer', 'pending'], qp, ['question', 'answer'])) return;
        formatted(question.question, `${qp}.question`, true);
        formatted(question.answer, `${qp}.answer`, !question.pending);
        pending(question, qp);
      });
      if (array(category.tables, `${cp}.tables`, 50)) category.tables.forEach((table, ti) => {
        const tp = `${cp}.tables.${ti}`;
        if (!object(table, ['title', 'footnote', 'items'], tp)) return;
        string(table.title, `${tp}.title`);
        formatted(table.footnote, `${tp}.footnote`);
        if (!array(table.items, `${tp}.items`, 200, 1)) return;
        let hasStar = false;
        table.items.forEach((item, ii) => {
          const ip = `${tp}.items.${ii}`;
          if (!object(item, ['name', 'color', 'description', 'alert', 'prices', 'pending'], ip, ['name', 'color', 'description', 'alert', 'prices'])) return;
          string(item.name, `${ip}.name`, 200, !item.pending);
          if (!Object.hasOwn(COLORS, item.color)) fail(`${ip}.color`, 'Tria un dels tres colors.');
          formatted(item.description, `${ip}.description`);
          formatted(item.alert, `${ip}.alert`);
          pending(item, ip);
          if (array(item.prices, `${ip}.prices`, 30, 1)) item.prices.forEach((price, pi) => {
            const pp = `${ip}.prices.${pi}`;
            if (!object(price, ['kind', 'amount', 'text', 'description', 'star', 'bold', 'italic', 'pending'], pp, ['kind', 'description', 'star', 'bold', 'italic'])) return;
            formatted(price.description, `${pp}.description`);
            for (const key of ['star', 'bold', 'italic']) boolean(price[key], `${pp}.${key}`);
            pending(price, pp);
            if (price.kind === 'amount') {
              if (!Number.isSafeInteger(price.amount) || price.amount < 0 || price.amount > 999999999) fail(`${pp}.amount`, 'Introduïx un import vàlid amb un màxim de dos decimals.');
              if (Object.hasOwn(price, 'text')) fail(pp, 'Un import no pot contindre un text alternatiu.');
            } else if (price.kind === 'text') {
              string(price.text, `${pp}.text`, 80, !price.pending);
              if (Object.hasOwn(price, 'amount')) fail(pp, 'Un text alternatiu no pot contindre un import.');
            } else fail(`${pp}.kind`, 'Tria Import o Text.');
            if (price.star) hasStar = true;
          });
        });
        if (hasStar && (!Array.isArray(table.footnote) || !table.footnote.some(run => typeof run?.text === 'string' && run.text.trim()))) fail(`${tp}.footnote`, 'Ompli la nota: hi ha preus amb asterisc.');
      });
    });
  }
  return errors;
}

export function assertContent(document) {
  const errors = validateContent(document);
  if (errors.length) throw new Error(`${errors[0].path}: ${errors[0].message}`);
  return document;
}

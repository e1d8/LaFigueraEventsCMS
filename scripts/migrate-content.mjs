import { rich, CATEGORY_IDS, assertContent } from '../shared/content-model.js';

const emphasis = ['100% artesanals', 'proximitat i de temporada', 'flors i fruita fresca', 'NO AGAFEM MÉS D’UN EVENT PER DATA', 'formatge blau', 'parmesà', 'raïm', 'café d’especialitat', 'xocolate 85%', 'crema de pistatxo casolana', 'ENHORABONA!'];
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function migrateContent(legacy) {
  const { sections, tables, introduction, pickup, contact } = legacy;
  const contacts = {
    whatsapp: { text: contact.phone, href: `https://wa.me/34${contact.phone}` },
    email: { text: contact.email, href: `mailto:${contact.email}` },
    instagram: { text: contact.handle, href: 'https://www.instagram.com/lafigueravlc/' },
  };
  const contactLinks = new Map(Object.values(contacts).map(value => [value.text, value.href]));
  const pattern = new RegExp(`(${[...contactLinks.keys(), ...emphasis].map(escape).join('|')}|\\d+(?:[,.]\\d+)?€)`, 'g');
  function formatted(text = '') {
    return text.split(pattern).filter(Boolean).map(text => ({ text, ...(contactLinks.has(text) ? { href: contactLinks.get(text) } : emphasis.includes(text) || /^\d+(?:[,.]\d+)?€$/.test(text) ? { bold: true } : {}) }));
  }
  const result = {
    schemaVersion: 1,
    home: { description: formatted(`${introduction.greeting}\n\n${introduction.text}`) },
    contact: { label: sections.find(section => section.id === 'contacte').label, description: formatted(sections.find(section => section.id === 'contacte').intro) },
    contacts,
    categories: CATEGORY_IDS.map(id => {
      const section = sections.find(section => section.id === id);
      let colorIndex = 0;
      return {
        id, label: section.label, description: formatted(section.intro),
        tables: section.tableIds.map(tableId => {
          const table = tables[tableId];
          if (table.fragments?.length) throw new Error('Cal migrar explícitament els fragments pendents abans de continuar.');
          const nameColumn = table.columns.find(column => column.role === 'name');
          const detailColumns = table.columns.filter(column => column.role === 'detail');
          const options = table.columns.filter(column => !['name', 'detail'].includes(column.role));
          return {
            title: table.title, footnote: rich(pickup.replace(/^\*/, '')),
            items: table.rows.map(row => ({
              name: nameColumn ? row.cells[nameColumn.key]?.text || '' : table.title,
              color: ['mustard', 'purple', 'green'][colorIndex++ % 3],
              description: formatted(detailColumns.map(column => row.cells[column.key]?.text || '').join('\n\n')),
              alert: formatted(row.note || ''),
              ...(nameColumn && (!row.cells[nameColumn.key] || row.cells[nameColumn.key].pending) || detailColumns.some(column => !row.cells[column.key] || row.cells[column.key].pending) ? { pending: true } : {}),
              prices: options.map(column => {
                const cell = row.cells[column.key], text = cell?.text || '';
                const match = /^(\d+)(?:[.,](\d{1,2}))?€(\*)?$/.exec(text);
                return {
                  kind: match ? 'amount' : 'text',
                  ...(match ? { amount: Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0')) } : { text: text.replace(/\*$/, '') }),
                  description: formatted(column.label.text), star: text.endsWith('*'), bold: Boolean(match), italic: false,
                  ...(!cell || cell.pending || column.label.pending ? { pending: true } : {}),
                };
              }),
            })),
          };
        }),
        questions: (section.questions || []).map(question => ({ question: formatted(question.q), answer: formatted(question.a), ...(question.pending ? { pending: true } : {}) })),
      };
    }),
  };
  return assertContent(result);
}

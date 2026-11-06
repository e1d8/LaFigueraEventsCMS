import { safeLink } from './content-model.js';

export function appendRich(parent, runs) {
  for (const run of runs) {
    let node = document.createDocumentFragment();
    run.text.split('\n').forEach((line, index) => {
      if (index) node.append(document.createElement('br'));
      node.append(document.createTextNode(line));
    });
    if (run.italic) { const wrapper = document.createElement('em'); wrapper.append(node); node = wrapper; }
    if (run.bold) { const wrapper = document.createElement('strong'); wrapper.append(node); node = wrapper; }
    if (run.href && safeLink(run.href)) {
      const wrapper = document.createElement('a');
      wrapper.href = run.href;
      if (run.href.startsWith('https:')) { wrapper.target = '_blank'; wrapper.rel = 'noopener noreferrer'; }
      wrapper.append(node); node = wrapper;
    }
    parent.append(node);
  }
  return parent;
}

// Only extract text and the explicitly supported marks. Pasted DOM never becomes saved HTML.
export function readRich(root) {
  const runs = [];
  const push = (text, marks) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last && last.bold === marks.bold && last.italic === marks.italic && last.href === marks.href) last.text += text;
    else runs.push({ text, ...marks });
  };
  const walk = (node, marks = {}) => {
    if (node.nodeType === 3) { push(node.textContent.replace(/\u00a0/g, ' '), marks); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'IMG'].includes(tag)) return;
    if (tag === 'BR') { push('\n', marks); return; }
    const next = { ...marks };
    if (['STRONG', 'B'].includes(tag)) next.bold = true;
    if (['EM', 'I'].includes(tag)) next.italic = true;
    if (tag === 'A' && safeLink(node.getAttribute('href'))) next.href = node.getAttribute('href');
    const block = ['DIV', 'P'].includes(tag);
    if (block && runs.length && !runs.at(-1).text.endsWith('\n')) push('\n', marks);
    for (const child of node.childNodes) walk(child, next);
    if (block && node.nextSibling && !runs.at(-1)?.text.endsWith('\n')) push('\n', marks);
  };
  for (const child of root.childNodes) walk(child);
  // A single browser-generated <br> in an empty editor is a placeholder.
  if (runs.length === 1 && runs[0].text === '\n' && root.textContent === '') return [];
  return runs;
}

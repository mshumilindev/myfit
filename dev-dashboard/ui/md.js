import { h } from './dom.js';

/** Inline: `code`, **bold**; everything else is plain text (never markup, never a live link: the data is untrusted). */
function inline(text) {
  const out = [];
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? h('code', null, m[1]) : h('strong', null, m[2]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

/** A small, safe Markdown renderer for the doc viewer: headings, lists, fenced code, tables, quotes, paragraphs. */
export function renderMd(src) {
  const lines = String(src).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(h('pre', { class: 'md-pre' }, buf.join('\n')));
    } else if (/^#{1,6}\s/.test(line)) {
      const lvl = Math.min(4, /^#+/.exec(line)[0].length);
      out.push(h(`h${lvl + 1}`, { class: 'md-h' }, inline(line.replace(/^#+\s+/, ''))));
      i++;
    } else if (/^\s*\|/.test(line) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        h(
          'div',
          { class: 'md-tbl' },
          h(
            'table',
            null,
            h(
              'thead',
              null,
              h(
                'tr',
                null,
                head.map((c) => h('th', null, inline(c))),
              ),
            ),
            h(
              'tbody',
              null,
              rows.map((r) =>
                h(
                  'tr',
                  null,
                  r.map((c) => h('td', null, inline(c))),
                ),
              ),
            ),
          ),
        ),
      );
    } else if (/^\s*([-*]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i]))
        items.push(h('li', null, inline(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))));
      out.push(h(ordered ? 'ol' : 'ul', { class: 'md-l' }, items));
    } else if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(h('blockquote', { class: 'md-q' }, inline(buf.join(' '))));
    } else if (!line.trim()) {
      i++;
    } else {
      const buf = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(```|#{1,6}\s|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])
      )
        buf.push(lines[i++]);
      out.push(h('p', { class: 'md-p' }, inline(buf.join(' '))));
    }
  }
  return out;
}

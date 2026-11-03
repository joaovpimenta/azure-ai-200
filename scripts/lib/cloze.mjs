/**
 * scripts/lib/cloze.mjs
 * Marked extension and helper functions for Active Recall ==cloze== blanks.
 */

/**
 * Escapes HTML characters for safe attribute and DOM insertion.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Creates Marked inline extension for ==cloze== syntax.
 * @returns {import('marked').MarkedExtension}
 */
export function clozeExtension() {
  return {
    extensions: [{
      name: 'cloze',
      level: 'inline',
      start(src) {
        return src.indexOf('==');
      },
      tokenizer(src) {
        const match = /^==([^=\r\n]+)==/.exec(src);
        if (match) {
          const text = match[1].trim();
          if (!text) {
            return {
              type: 'text',
              raw: match[0],
              text: match[0]
            };
          }
          return {
            type: 'cloze',
            raw: match[0],
            text
          };
        }
      },
      renderer(token) {
        const escaped = escapeHtml(token.text);
        return `<span class="cloze" tabindex="0" role="button" aria-label="Revelar resposta" data-answer="${escaped}"><span class="cloze-content">${escaped}</span></span>`;
      }
    }]
  };
}

/**
 * Extracts all cloze answer terms from markdown string.
 * @param {string} text
 * @returns {string[]}
 */
export function extractClozes(text) {
  if (!text) return [];
  const clozes = [];
  const regex = /==([^=\r\n]+)==/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const term = match[1].trim();
    if (term) clozes.push(term);
  }
  return clozes;
}

/**
 * Strips ==cloze== delimiters, returning unmasked plain text.
 * @param {string} text
 * @returns {string}
 */
export function stripClozes(text) {
  if (!text) return '';
  return text.replace(/==([^=\r\n]+)==/g, '$1');
}

/**
 * Alias for backward compatibility.
 */
export const stripCloze = stripClozes;

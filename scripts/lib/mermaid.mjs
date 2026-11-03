/**
 * scripts/lib/mermaid.mjs
 * Handles ```mermaid fenced blocks, converting them to accessible HTML containers with noscript fallbacks.
 */
import { escapeHtml } from './cloze.mjs';

const VALID_MERMAID_TYPES = [
  'flowchart',
  'sequencediagram',
  'classdiagram',
  'statediagram',
  'erdiagram',
  'gantt',
  'pie',
  'gitgraph',
  'journey',
  'mindmap',
  'timeline',
  'quadrantchart',
  'graph',
  'c4context',
  'architecture'
];

/**
 * Validates syntax basics of a Mermaid diagram block.
 * @param {string} code
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMermaid(code) {
  const errors = [];
  if (!code || typeof code !== 'string' || !code.trim()) {
    return { valid: false, errors: ['Mermaid code block is empty'] };
  }

  const clean = code.trim().replace(/^%%[^\n]*\n+/g, '').trim();
  const firstWord = clean.split(/[\s\n(]/)[0].toLowerCase();

  if (!VALID_MERMAID_TYPES.includes(firstWord)) {
    errors.push(`Unrecognized Mermaid diagram type '${firstWord}'. Expected one of: ${VALID_MERMAID_TYPES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Wraps clean mermaid code into a container with noscript fallback.
 * @param {string} code
 * @returns {string}
 */
export function renderMermaidBlock(code) {
  const cleanCode = escapeHtml((code || '').trim());
  return `<figure class="mermaid-figure mermaid-container" data-mermaid>
  <div class="mermaid" data-mermaid="true"><pre class="mermaid-source">${cleanCode}</pre></div>
  <noscript>
    <pre class="mermaid-fallback"><code>${cleanCode}</code></pre>
  </noscript>
</figure>\n`;
}

/**
 * Creates Marked extension to render Mermaid diagrams.
 * @returns {import('marked').MarkedExtension}
 */
export function mermaidExtension() {
  return {
    renderer: {
      code(token) {
        if (token.lang && token.lang.trim().toLowerCase() === 'mermaid') {
          return renderMermaidBlock(token.text);
        }
        return false; // Delegate to default code renderer
      }
    }
  };
}

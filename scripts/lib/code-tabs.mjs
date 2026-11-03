/**
 * scripts/lib/code-tabs.mjs
 * Bundles adjacent Python and C# code blocks into synchronized accessible tabs.
 */
import { escapeHtml } from './cloze.mjs';

let tabIdCounter = 0;

/**
 * Resets the tab counter.
 */
export function resetTabCounter() {
  tabIdCounter = 0;
}

/**
 * Normalizes language identifier to canonical 'python' or 'csharp'.
 * @param {string} lang
 * @returns {'python' | 'csharp' | null}
 */
export function normalizeLanguage(lang) {
  if (!lang) return null;
  const l = lang.trim().toLowerCase();
  if (l === 'python' || l === 'py') return 'python';
  if (l === 'csharp' || l === 'c#' || l === 'cs') return 'csharp';
  return null;
}

/**
 * Groups adjacent python/csharp code tokens in a token array (skipping space tokens).
 * @param {Array<any>} tokens
 * @returns {Array<any>}
 */
export function groupAdjacentCodeTabs(tokens) {
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    if (cur.type === 'code') {
      const lang1 = normalizeLanguage(cur.lang);
      if (lang1) {
        // Find next non-space token
        let j = i + 1;
        while (j < tokens.length && tokens[j].type === 'space') {
          j++;
        }
        if (j < tokens.length && tokens[j].type === 'code') {
          const next = tokens[j];
          const lang2 = normalizeLanguage(next.lang);
          if (lang2 && lang1 !== lang2) {
            // Found a Python + C# pair
            const pyToken = lang1 === 'python' ? cur : next;
            const csToken = lang1 === 'python' ? next : cur;

            const id = ++tabIdCounter;
            const pyTabId = `tab-${id}-python`;
            const csTabId = `tab-${id}-csharp`;
            const pyPanelId = `panel-${id}-python`;
            const csPanelId = `panel-${id}-csharp`;

            const pyEscaped = escapeHtml((pyToken.text || '').replace(/\n$/, ''));
            const csEscaped = escapeHtml((csToken.text || '').replace(/\n$/, ''));

            result.push({
              type: 'html',
              block: true,
              raw: cur.raw + next.raw,
              text: `<div class="code-tabs" data-code-tabs>
  <div class="code-tabs-header" role="tablist" aria-label="Linguagem do SDK">
    <button class="code-tab-btn active" role="tab" aria-selected="true" aria-controls="${pyPanelId}" id="${pyTabId}" data-lang="python">Python SDK</button>
    <button class="code-tab-btn" role="tab" aria-selected="false" aria-controls="${csPanelId}" id="${csTabId}" data-lang="csharp" tabindex="-1">C# (.NET) SDK</button>
  </div>
  <div class="code-tab-panel active" role="tabpanel" id="${pyPanelId}" aria-labelledby="${pyTabId}">
    <pre><code class="language-python">${pyEscaped}</code></pre>
  </div>
  <div class="code-tab-panel" role="tabpanel" id="${csPanelId}" aria-labelledby="${csTabId}" hidden>
    <pre><code class="language-csharp">${csEscaped}</code></pre>
  </div>
</div>\n`
            });
            i = j; // Advance past the paired block
            continue;
          }
        }
      }
    }
    result.push(cur);
  }
  return result;
}

/**
 * Creates Marked extension and hook for synchronized Python/C# code tabs.
 * @returns {import('marked').MarkedExtension}
 */
export function codeTabsExtension() {
  return {
    hooks: {
      processAllTokens(tokens) {
        return groupAdjacentCodeTabs(tokens);
      }
    }
  };
}

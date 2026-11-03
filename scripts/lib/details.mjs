/**
 * scripts/lib/details.mjs
 * Formats HTML <details> blocks into Active Recall self-check cards and validates <summary>.
 */

/**
 * Validates that all <details> elements in markdown or HTML contain a non-empty <summary>.
 * @param {string} content
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDetails(content) {
  const errors = [];
  if (!content) return { valid: true, errors: [] };

  const detailsRegex = /<\s*details\b([^>]*)>([\s\S]*?)<\s*\/\s*details\s*>/gi;
  let match;
  let count = 0;

  while ((match = detailsRegex.exec(content)) !== null) {
    count++;
    const inside = match[2];
    const summaryMatch = /<\s*summary\b[^>]*>([\s\S]*?)<\s*\/\s*summary\s*>/i.exec(inside);
    if (!summaryMatch || !summaryMatch[1].trim()) {
      errors.push(`Check card #${count} (<details>) is missing mandatory <summary> element`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formats <details> blocks into accessible active recall check cards with CSS classes.
 * @param {string} html
 * @returns {string}
 */
export function formatDetails(html) {
  if (!html) return '';

  return html.replace(/<\s*details\b([^>]*)>([\s\S]*?)<\s*\/\s*details\s*>/gi, (match, attrs, content) => {
    const summaryMatch = /<\s*summary\b([^>]*)>([\s\S]*?)<\s*\/\s*summary\s*>/i.exec(content);
    if (!summaryMatch) {
      throw new Error('Found <details> block without mandatory <summary>');
    }

    const summaryAttrs = summaryMatch[1];
    const summaryText = summaryMatch[2].trim();
    const bodyContent = content.replace(summaryMatch[0], '').trim();

    let newAttrs = attrs || '';
    if (/class=["']/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/class=["']([^"']*)["']/i, 'class="$1 check-card"');
    } else {
      newAttrs = ` class="check-card" data-check-card${newAttrs}`;
    }

    return `<details${newAttrs}>
  <summary class="check-card-summary"${summaryAttrs}>
    <span class="check-card-icon" aria-hidden="true">💡</span>
    <span class="check-card-title">${summaryText}</span>
  </summary>
  <div class="check-card-body">
    ${bodyContent}
  </div>
</details>`;
  });
}

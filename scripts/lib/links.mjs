/**
 * scripts/lib/links.mjs
 * Extracts and validates internal links, route anchors, and detects security violations.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function createResult(errors) {
  errors.valid = errors.length === 0;
  errors.errors = errors;
  return errors;
}

/**
 * Extracts all Markdown and HTML links from text with line numbers.
 * @param {string} content
 * @returns {Array<{ type: 'markdown'|'html', text: string, url: string, line: number, isExternal: boolean, isAnchor: boolean, isDangerous: boolean }>}
 */
export function extractLinks(content) {
  if (!content) return [];
  const links = [];
  const lines = content.split(/\r?\n/);

  // Markdown links [text](url) including linked image badges [![alt](img)](url) - ignore standalone images ![alt](url)
  const mdLinkRegex = /(?<!!)\[((?:!\[[^\]]*\]\([^)]*\)|[^!\]\r\n]|!(?!\[))*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const htmlLinkRegex = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];

    // Markdown links
    mdLinkRegex.lastIndex = 0;
    let match;
    while ((match = mdLinkRegex.exec(line)) !== null) {
      const text = match[1];
      const url = match[2].trim();
      links.push({
        type: 'markdown',
        text,
        url,
        line: lineNum,
        isExternal: /^https?:\/\/|^mailto:|^tel:/i.test(url),
        isAnchor: url.startsWith('#'),
        isDangerous: /^javascript:/i.test(url)
      });
    }

    // HTML links
    htmlLinkRegex.lastIndex = 0;
    while ((match = htmlLinkRegex.exec(line)) !== null) {
      const url = match[1].trim();
      const text = match[2];
      links.push({
        type: 'html',
        text,
        url,
        line: lineNum,
        isExternal: /^https?:\/\/|^mailto:|^tel:/i.test(url),
        isAnchor: url.startsWith('#'),
        isDangerous: /^javascript:/i.test(url)
      });
    }
  }

  return links;
}

/**
 * Validates a single link against a set of valid routes.
 * @param {string} url
 * @param {Set<string>} validRoutesSet
 * @returns {{ valid: boolean, reason?: string, external?: boolean, anchor?: boolean }}
 */
export function validateLink(url, validRoutesSet) {
  if (!url) return { valid: false, reason: 'Empty link URL' };

  if (/^javascript:/i.test(url.trim())) {
    return { valid: false, reason: 'Security violation: dangerous javascript: pseudo-protocol URL' };
  }

  if (/^(https?:|mailto:|tel:)/i.test(url)) {
    return { valid: true, external: true };
  }

  if (url.startsWith('#')) {
    return { valid: true, anchor: true };
  }

  const cleanPath = url.split('#')[0].split('?')[0].replace(/\\/g, '/').trim();
  if (!cleanPath || cleanPath === '.' || cleanPath === './') {
    return { valid: true };
  }

  // If validRoutesSet is empty or null, accept internal paths (during partial build)
  if (!validRoutesSet || validRoutesSet.size === 0) {
    return { valid: true };
  }

  const normalized = cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath;
  const withTrailing = normalized.endsWith('/') ? normalized : normalized + '/';
  const withoutTrailing = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;

  // Also check without .md
  const withoutMd = normalized.replace(/\.md$/, '');
  const slugMatch = normalized.match(/([a-z0-9-]+)(?:\.md|\/)?$/);
  const targetSlug = slugMatch ? slugMatch[1] : normalized;
  const repoRel = normalized.replace(/^(?:\.\.?\/)+/, '');

  if (
    validRoutesSet.has(normalized) ||
    validRoutesSet.has(withTrailing) ||
    validRoutesSet.has(withoutTrailing) ||
    validRoutesSet.has(withoutMd) ||
    validRoutesSet.has(targetSlug) ||
    validRoutesSet.has(`chapters/${targetSlug}`) ||
    validRoutesSet.has(`comparisons/${targetSlug}`) ||
    (repoRel && existsSync(resolve(process.cwd(), repoRel)))
  ) {
    return { valid: true };
  }

  return { valid: false, reason: `Target route '${url}' not found in known routes` };
}

/**
 * Validates links array against context.
 * @param {Array<any>} links
 * @param {{ existingRoutes?: Set<string>, filePath?: string }} context
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateLinks(links, context = {}) {
  const errors = [];
  const routes = context.existingRoutes || new Set();

  links.forEach(link => {
    const res = validateLink(link.url, routes);
    if (!res.valid) {
      errors.push(`Broken link on line ${link.line || '?'}: '${link.url}' (${res.reason})`);
    }
  });

  return createResult(errors);
}

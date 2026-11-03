/**
 * scripts/lib/markdown.mjs
 * Central compiler configuring Marked with active recall, code tabs, mermaid, safe HTML, and metadata.
 */
import { Marked, marked } from 'marked';
import { clozeExtension, stripClozes } from './cloze.mjs';
import { codeTabsExtension, resetTabCounter, groupAdjacentCodeTabs } from './code-tabs.mjs';
import { mermaidExtension, renderMermaidBlock } from './mermaid.mjs';
import { formatDetails } from './details.mjs';

/**
 * Slugs text removing accents (Unicode NFD) and converting non-alphanumeric chars to hyphens.
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Checks markdown and rendered HTML for security violations (XSS, scripts, event handlers, javascript:).
 * Strips code blocks first to prevent false positives on documentation and code samples.
 * @param {string} mdContent
 * @returns {string[]}
 */
export function sanitizeCheck(mdContent) {
  const violations = [];
  if (!mdContent || typeof mdContent !== 'string') return violations;

  // Phase 1: Inspect stripped markdown (exclude fenced and inline code blocks)
  const stripped = mdContent
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*?`/g, '');

  // 1. Script & executable tags
  if (/<\s*(?:script|iframe|object|embed)[\s>]/i.test(stripped)) {
    violations.push('Disallowed executable/embedding tag (<script>, <iframe>, <object>, <embed>) detected');
  }

  // 2. Inline on* event handlers (e.g. onclick=, onerror=, onload=)
  if (/<\s*[a-z0-9-]+[^>]*\s+on[a-z]+\s*=/i.test(stripped)) {
    violations.push("Disallowed inline 'on*=' event handler detected");
  }

  // 3. Dangerous pseudo-protocols in links or attributes
  if (
    /<\s*[a-z0-9-]+[^>]*\s+(?:href|src|action)\s*=\s*['"]?\s*(?:javascript:|vbscript:|data:\s*text\/html)/i.test(stripped) ||
    /\[[^\]]*\]\(\s*(?:javascript:|vbscript:|data:\s*text\/html)/i.test(stripped)
  ) {
    violations.push('Disallowed dangerous pseudo-protocol (javascript:, vbscript:, data:text/html) detected');
  }

  // Phase 2: Defense-in-depth on rendered HTML (with <pre> and <code> stripped)
  try {
    const rawRender = marked.parse(mdContent);
    const htmlStripped = String(rawRender)
      .replace(/<pre[\s\S]*?<\/pre>/gi, '')
      .replace(/<code[\s\S]*?<\/code>/gi, '');

    if (/<(?:script|iframe|object|embed)[\s>]/i.test(htmlStripped)) {
      violations.push('Disallowed rendered executable element detected');
    }
    if (/<[a-z0-9-]+[^>]*\s+on[a-z]+\s*=/i.test(htmlStripped)) {
      violations.push('Disallowed rendered inline event handler detected');
    }
    if (/<[a-z0-9-]+[^>]*\s+(?:href|src|action)\s*=\s*['"]?\s*(?:javascript:|vbscript:|data:\s*text\/html)/i.test(htmlStripped)) {
      violations.push('Disallowed rendered dangerous pseudo-protocol link detected');
    }
  } catch {
    // If parse fails, Phase 1 already reported or parser threw syntax error
  }

  return Array.from(new Set(violations));
}

/**
 * Sanitizes HTML string, removing or escaping forbidden tags and attributes.
 * @param {string} html
 * @param {{ strict?: boolean }} [options={}]
 * @returns {string}
 */
export function sanitizeSafeHtml(html, options = {}) {
  const SCRIPT_TAG_REGEX = /<\s*script\b[^>]*>/gi;
  const ON_HANDLER_REGEX = /\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi;
  const JS_URL_REGEX = /\b(href|src)\s*=\s*['"]\s*javascript:[^'"]*['"]/gi;

  if (options.strict) {
    if (SCRIPT_TAG_REGEX.test(html)) throw new Error('Security violation: inline <script> tag detected in HTML');
    if (ON_HANDLER_REGEX.test(html)) throw new Error('Security violation: inline on* event handler detected in HTML');
    if (JS_URL_REGEX.test(html)) throw new Error('Security violation: javascript: URL detected in HTML');
  }

  return html
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(SCRIPT_TAG_REGEX, '')
    .replace(ON_HANDLER_REGEX, '')
    .replace(JS_URL_REGEX, '$1="#"');
}

/**
 * Extracts plain narration prose from markdown, stripping code blocks, diagrams, and tables.
 * @param {string} markdown
 * @returns {string}
 */
export function extractNarrationText(markdown) {
  if (!markdown) return '';
  return stripClozes(markdown)
    .replace(/```[\s\S]*?```/g, ' ') // Strip code and mermaid blocks
    .replace(/`[^`]+`/g, ' ')         // Strip inline code
    .replace(/<\s*summary\b[^>]*>([\s\S]*?)<\s*\/\s*summary\s*>/gi, ' Pergunta de autoavaliação: $1. ')
    .replace(/<\/?[^>]+>/g, ' ')      // Strip remaining HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) -> text
    .replace(/^#+\s+(.*)$/gm, '$1. ') // Headings
    .replace(/\|[^\n]+\|/g, ' ')      // Tables
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts ## Pegadinhas de Prova section from markdown.
 * @param {string} content
 * @returns {{ found: boolean, raw: string, html: string }}
 */
export function extractPegadinhas(content) {
  const match = /(?:^|\n)##\s+Pegadinhas\s+de\s+Prova\r?\n([\s\S]*?)(?=(?:\r?\n##\s+)|\s*$)/i.exec(content);
  if (!match) return { found: false, raw: '', html: '' };
  const raw = match[1].trim();
  const compiler = createMarkdownCompiler();
  const html = compiler.parse(raw);
  return { found: true, raw, html };
}

/**
 * Creates and configures Marked compiler instance.
 * @param {{ headingAnchor?: boolean }} [opts={}]
 * @returns {Marked}
 */
export function createMarkdownCompiler(opts = {}) {
  const instance = new Marked({ gfm: true });

  instance.use(clozeExtension());
  instance.use(codeTabsExtension());
  instance.use(mermaidExtension());

  return instance;
}

/**
 * Compiles markdown content to accessible HTML and extracts metadata.
 * @param {string} content
 * @param {{ strict?: boolean, rootRel?: string }} [options={}]
 * @returns {{ html: string, metadata: { title: string, headings: Array<any>, pegadinhas: string, clozeCount: number, hasCodeTabs: boolean, hasMermaid: boolean, narrationText: string }, pegadinhas: { found: boolean, raw: string, html: string } }}
 */
export function compileMarkdown(content, options = {}) {
  resetTabCounter();

  // Security check on raw content
  const violations = sanitizeCheck(content);
  if (violations.length > 0 && options.strict !== false) {
    throw new Error(`Security Violation in Markdown: ${violations.join('; ')}`);
  }

  const headings = [];
  const headingCounts = {};

  const instance = new Marked({ gfm: true });

  instance.use({
    renderer: {
      heading(token) {
        const text = token.text;
        const depth = token.depth;
        const baseSlug = slugify(text) || 'section';
        headingCounts[baseSlug] = (headingCounts[baseSlug] || 0) + 1;
        const slug = headingCounts[baseSlug] === 1 ? baseSlug : `${baseSlug}-${headingCounts[baseSlug]}`;

        headings.push({ depth, text, slug });

        return `<h${depth} id="${slug}">${text}</h${depth}>\n`;
      }
    }
  });

  instance.use(clozeExtension());
  instance.use(codeTabsExtension());
  instance.use(mermaidExtension());

  // Extract Pegadinhas de Prova section
  const pegadinhas = extractPegadinhas(content);

  // Parse markdown with tokens
  const rawTokens = instance.lexer(content);
  const groupedTokens = groupAdjacentCodeTabs(rawTokens);
  let rawHtml = instance.parser(groupedTokens);

  // Format <details> check cards
  let formattedHtml = formatDetails(rawHtml);

  // Sanitize final HTML
  let finalHtml = sanitizeSafeHtml(formattedHtml, { strict: options.strict ?? true });

  // Compute counts and metadata
  const clozeMatches = content.match(/==([^=\r\n]+)==/g) || [];
  const hasCodeTabs = /<div class="code-tabs"/i.test(finalHtml);
  const hasMermaid = /<figure class="mermaid-container"|<div class="mermaid"/i.test(finalHtml);
  const title = headings.find(h => h.depth === 1)?.text || '';
  const narrationText = extractNarrationText(content);

  return {
    html: finalHtml,
    metadata: {
      title,
      headings,
      pegadinhas: pegadinhas.raw,
      clozeCount: clozeMatches.length,
      hasCodeTabs,
      hasMermaid,
      narrationText
    },
    pegadinhas
  };
}

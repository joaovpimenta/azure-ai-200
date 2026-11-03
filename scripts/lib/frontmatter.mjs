/**
 * scripts/lib/frontmatter.mjs
 * Robust frontmatter extraction and serialization using 'yaml'.
 */
import YAML from 'yaml';

/**
 * Extracts YAML frontmatter and markdown body from raw file content.
 * @param {string} rawContent
 * @param {string} [filePath='unknown']
 * @returns {{ data: Record<string, any>, content: string, rawFrontmatter?: string }}
 */
export function extractFrontmatter(rawContent, filePath = 'unknown') {
  if (typeof rawContent !== 'string') {
    return { data: {}, content: '', rawFrontmatter: '' };
  }

  // Handle UTF-8 Byte Order Mark (BOM)
  let text = rawContent;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  if (!text.trim()) {
    return { data: {}, content: '', rawFrontmatter: '' };
  }

  // Check if content begins with frontmatter delimiter
  if (!/^---[ \t]*\r?\n/.test(text)) {
    return { data: {}, content: text, rawFrontmatter: '' };
  }

  const lines = text.split(/\r?\n/);
  let closeIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closeIndex = i;
      break;
    }
  }

  if (closeIndex === -1) {
    throw new Error(`Unclosed frontmatter delimiter '---' in file: ${filePath}`);
  }

  const yamlLines = lines.slice(1, closeIndex);
  const bodyLines = lines.slice(closeIndex + 1);

  const yamlStr = yamlLines.join('\n');
  const bodyContent = bodyLines.join('\n');

  if (!yamlStr.trim()) {
    return { data: {}, content: bodyContent, rawFrontmatter: '' };
  }

  try {
    const parsed = YAML.parse(yamlStr);
    const data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    return { data, content: bodyContent, rawFrontmatter: yamlStr };
  } catch (err) {
    throw new Error(`YAML syntax error in frontmatter (${filePath}): ${err.message}`);
  }
}

/**
 * Serializes data object and markdown body into standard frontmatter format.
 * @param {Record<string, any>} data
 * @param {string} [bodyContent='']
 * @returns {string}
 */
export function serializeFrontmatter(data, bodyContent = '') {
  if (!data || Object.keys(data).length === 0) {
    return bodyContent.trim();
  }
  const yamlStr = YAML.stringify(data).trim();
  const body = bodyContent ? `\n\n${bodyContent.trim()}\n` : '\n';
  return `---\n${yamlStr}\n---${body}`;
}

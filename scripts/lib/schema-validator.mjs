/**
 * scripts/lib/schema-validator.mjs
 * Authoritative schema validation for frontmatter, tags, blueprints, and the 5 quiz formats.
 */
import { existsSync, readFileSync } from 'node:fs';

export const VALID_DOMAINS = [
  'containerized-solutions',
  'data-management',
  'connect-and-consume',
  'secure-monitor-troubleshoot'
];

export const VALID_DIFFICULTIES = ['introductory', 'intermediate', 'advanced'];

export const VALID_QUESTION_TYPES = [
  'single-choice',
  'multiple-choice',
  'code-completion',
  'ordering',
  'case-study'
];

export const MANDATORY_CASE_STUDY_TABS = [
  'Visão Geral',
  'Arquitetura Atual',
  'Requisitos Técnicos',
  'Requisitos de Segurança'
];

export const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function createResultArray(errors) {
  Object.defineProperty(errors, 'valid', { value: errors.length === 0, enumerable: false, configurable: true });
  Object.defineProperty(errors, 'errors', { value: errors, enumerable: false, configurable: true });
  return errors;
}

/**
 * Validates concept frontmatter data.
 * @param {Record<string, any>} data
 * @param {string | { expectedSlug?: string, expectedChapter?: string, canonicalTags?: Iterable<string>, filePath?: string }} [options='']
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateFrontmatter(data, options = '') {
  const errors = [];
  const opts = typeof options === 'string' ? { filePath: options } : (options || {});
  const fileRef = opts.filePath ? ` (in ${opts.filePath})` : '';

  if (!data || typeof data !== 'object') {
    errors.push(`Frontmatter must be a non-null object${fileRef}`);
    return createResultArray(errors);
  }

  // title
  if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
    errors.push(`Missing or invalid field 'title'${fileRef}`);
  }

  // slug
  if (!data.slug || typeof data.slug !== 'string' || !SLUG_REGEX.test(data.slug)) {
    errors.push(`'slug' must be non-empty kebab-case ASCII (^[a-z0-9]+(-[a-z0-9]+)*$): '${data.slug}'${fileRef}`);
  } else if (opts.expectedSlug && data.slug !== opts.expectedSlug) {
    errors.push(`Frontmatter slug '${data.slug}' does not match expected '${opts.expectedSlug}'${fileRef}`);
  }

  // chapter
  if (!data.chapter || typeof data.chapter !== 'string' || !data.chapter.trim()) {
    errors.push(`Missing or invalid field 'chapter'${fileRef}`);
  } else if (opts.expectedChapter && data.chapter !== opts.expectedChapter) {
    errors.push(`Frontmatter chapter '${data.chapter}' does not match directory '${opts.expectedChapter}'${fileRef}`);
  }

  // exam_domain
  if (!VALID_DOMAINS.includes(data.exam_domain)) {
    errors.push(`Invalid 'exam_domain': '${data.exam_domain}'. Must be one of: ${VALID_DOMAINS.join(', ')}${fileRef}`);
  }

  // tags
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    errors.push(`Field 'tags' must be a non-empty array of strings${fileRef}`);
  } else {
    const tagRes = validateTags(data.tags, opts.canonicalTags || []);
    if (!tagRes.valid) {
      tagRes.forEach(e => errors.push(`${e}${fileRef}`));
    }
  }

  // difficulty (optional / recommended)
  if (data.difficulty !== undefined && !VALID_DIFFICULTIES.includes(data.difficulty)) {
    errors.push(`Invalid 'difficulty': '${data.difficulty}'. Must be one of: ${VALID_DIFFICULTIES.join(', ')}${fileRef}`);
  }

  // tldr
  if (!data.tldr || typeof data.tldr !== 'string' || !data.tldr.trim()) {
    errors.push(`Missing or invalid field 'tldr' summary string${fileRef}`);
  }

  // related_links (optional array)
  if (data.related_links !== undefined) {
    if (!Array.isArray(data.related_links)) {
      errors.push(`Field 'related_links' must be an array${fileRef}`);
    } else {
      data.related_links.forEach((link, idx) => {
        if (!link || typeof link !== 'object') {
          errors.push(`related_links[${idx}] must be an object${fileRef}`);
        } else {
          if (!link.label || typeof link.label !== 'string' || !link.label.trim()) errors.push(`related_links[${idx}] missing 'label'${fileRef}`);
          if (!link.url || typeof link.url !== 'string' || !link.url.trim()) errors.push(`related_links[${idx}] missing 'url'${fileRef}`);
        }
      });
    }
  }

  return createResultArray(errors);
}

/**
 * Loads canonical taxonomy from tags.json.
 * @param {string} taxonomyPath
 * @returns {Set<string>}
 */
export function loadCanonicalTaxonomy(taxonomyPath) {
  if (!existsSync(taxonomyPath)) {
    throw new Error(`Taxonomy file not found at ${taxonomyPath}`);
  }
  const raw = JSON.parse(readFileSync(taxonomyPath, 'utf-8'));
  const list = Array.isArray(raw) ? raw : (raw.tags || []);
  return new Set(list);
}

/**
 * Validates tags against the canonical taxonomy.
 * @param {string[]} tags
 * @param {Iterable<string>} canonicalTags
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateTags(tags, canonicalTags) {
  const errors = [];
  const tagSet = canonicalTags instanceof Set ? canonicalTags : new Set(canonicalTags || []);

  if (!Array.isArray(tags) || tags.length === 0) {
    errors.push('Tags must be a non-empty array');
    return createResultArray(errors);
  }

  tags.forEach(tag => {
    if (typeof tag !== 'string' || !tag.trim()) {
      errors.push(`Invalid tag value: ${JSON.stringify(tag)}`);
    } else if (tagSet.size > 0 && !tagSet.has(tag)) {
      errors.push(`Unregistered tag '${tag}'. Must exist in generation/taxonomy/tags.json`);
    }
  });

  return createResultArray(errors);
}

/**
 * Validates a single question against the 5 official quiz schemas.
 * @param {Record<string, any>} q
 * @param {string} [sourceRef='question']
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateQuestion(q, sourceRef = 'question') {
  const errors = [];
  if (!q || typeof q !== 'object') {
    errors.push(`Question must be a non-null object in ${sourceRef}`);
    return createResultArray(errors);
  }

  const qId = q.id || 'unknown';
  if (!q.id || typeof q.id !== 'string') errors.push(`Question missing 'id' in ${sourceRef}`);
  if (!q.type || !VALID_QUESTION_TYPES.includes(q.type)) {
    errors.push(`Question '${qId}' has invalid or missing 'type': '${q.type}' in ${sourceRef}`);
  }
  if (!q.title || typeof q.title !== 'string') errors.push(`Question '${qId}' missing 'title' in ${sourceRef}`);

  const stem = q.stem || q.prompt;
  if (!stem || typeof stem !== 'string' || !stem.trim()) {
    errors.push(`Question '${qId}' must have 'stem' or 'prompt' in ${sourceRef}`);
  }

  if (!q.exam_domain || !VALID_DOMAINS.includes(q.exam_domain)) {
    errors.push(`Question '${qId}' has invalid 'exam_domain': '${q.exam_domain}' in ${sourceRef}`);
  }

  switch (q.type) {
    case 'single-choice': {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`'single-choice' question '${qId}' requires at least 2 options`);
        break;
      }
      const correctOptions = q.options.filter(o => o.correct === true);
      if (correctOptions.length !== 1) {
        errors.push(`'single-choice' question '${qId}' must have exactly 1 correct option (found ${correctOptions.length})`);
      }
      q.options.forEach((opt, idx) => {
        if (!opt.text) errors.push(`Question '${qId}' option[${idx}] missing 'text'`);
        if (!opt.rationale) errors.push(`Question '${qId}' option[${idx}] missing 'rationale'`);
      });
      break;
    }
    case 'multiple-choice': {
      const selectCount = q.select_count ?? q.selectCount;
      if (typeof selectCount !== 'number' || selectCount < 2) {
        errors.push(`'multiple-choice' question '${qId}' must specify 'select_count' >= 2`);
      }
      if (!Array.isArray(q.options) || q.options.length <= (selectCount || 1)) {
        errors.push(`'multiple-choice' question '${qId}' options count must exceed 'select_count'`);
        break;
      }
      const correctOptions = q.options.filter(o => o.correct === true);
      if (correctOptions.length !== selectCount) {
        errors.push(`'multiple-choice' question '${qId}' has ${correctOptions.length} correct options, expected select_count=${selectCount}`);
      }
      q.options.forEach((opt, idx) => {
        if (!opt.text) errors.push(`Question '${qId}' option[${idx}] missing 'text'`);
        if (!opt.rationale) errors.push(`Question '${qId}' option[${idx}] missing 'rationale'`);
      });
      break;
    }
    case 'code-completion': {
      if (!q.code_template || typeof q.code_template !== 'string') {
        errors.push(`'code-completion' question '${qId}' missing 'code_template'`);
      }
      if (!Array.isArray(q.slots) || q.slots.length === 0) {
        errors.push(`'code-completion' question '${qId}' must define non-empty 'slots' array`);
        break;
      }
      const placeholders = (q.code_template.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g) || []).map(p => p.slice(2, -2));
      const slotIds = q.slots.map(s => s.id);
      placeholders.forEach(ph => {
        if (!slotIds.includes(ph)) {
          errors.push(`Question '${qId}' template has placeholder '{{${ph}}}' with no matching slot`);
        }
      });
      slotIds.forEach(sid => {
        if (!placeholders.includes(sid)) {
          errors.push(`Question '${qId}' slot '${sid}' has no matching placeholder in code_template`);
        }
      });
      q.slots.forEach(slot => {
        if (!Array.isArray(slot.options) || slot.options.length < 2) {
          errors.push(`Question '${qId}' slot '${slot.id}' must have at least 2 options`);
        } else {
          const correct = slot.options.filter(o => o.correct === true);
          if (correct.length !== 1) {
            errors.push(`Question '${qId}' slot '${slot.id}' must have exactly 1 correct option`);
          }
          slot.options.forEach((opt, idx) => {
            if (!opt.text) errors.push(`Question '${qId}' slot '${slot.id}' option[${idx}] missing text`);
            if (!opt.rationale) errors.push(`Question '${qId}' slot '${slot.id}' option[${idx}] missing rationale`);
          });
        }
      });
      break;
    }
    case 'ordering': {
      if (!Array.isArray(q.items) || q.items.length < 2) {
        errors.push(`'ordering' question '${qId}' requires at least 2 items`);
        break;
      }
      const orders = q.items.map(it => it.order).sort((a, b) => a - b);
      const expected = Array.from({ length: q.items.length }, (_, i) => i + 1);
      if (JSON.stringify(orders) !== JSON.stringify(expected)) {
        errors.push(`'ordering' question '${qId}' orders must be consecutive integers 1..${q.items.length}. Found: [${orders.join(', ')}]`);
      }
      q.items.forEach((it, idx) => {
        if (!it.text) errors.push(`Question '${qId}' item[${idx}] missing 'text'`);
      });
      break;
    }
    case 'case-study': {
      if (!Array.isArray(q.tabs) || q.tabs.length < 4) {
        errors.push(`'case-study' question '${qId}' requires at least 4 tabs`);
      } else {
        const tabTitles = q.tabs.map(t => (t.title || '').trim().toLowerCase());
        for (const reqTab of MANDATORY_CASE_STUDY_TABS) {
          if (!tabTitles.includes(reqTab.toLowerCase())) {
            errors.push(`'case-study' question '${qId}' missing mandatory tab '${reqTab}'`);
          }
        }
      }
      if (!Array.isArray(q.questions) || q.questions.length === 0) {
        errors.push(`'case-study' question '${qId}' must contain child questions`);
      } else {
        q.questions.forEach((childQ, idx) => {
          const childErrors = validateQuestion(childQ, `${sourceRef} -> child[${idx}]`);
          errors.push(...childErrors);
        });
      }
      break;
    }
    default:
      // handled above
      break;
  }

  return createResultArray(errors);
}

/**
 * Validates an array of questions.
 * @param {Record<string, any>[]} questions
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateQuestions(questions) {
  const errors = [];
  if (!Array.isArray(questions)) {
    errors.push('Questions must be an array');
    return createResultArray(errors);
  }
  const idSet = new Set();
  questions.forEach((q, idx) => {
    if (q?.id) {
      if (idSet.has(q.id)) errors.push(`Duplicate question id '${q.id}'`);
      idSet.add(q.id);
    }
    const qErrors = validateQuestion(q, `question[${idx}]`);
    errors.push(...qErrors);
  });
  return createResultArray(errors);
}

/**
 * Validates blueprint slugs and structural integrity.
 * @param {Record<string, any>} blueprint
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateBlueprintSlugs(blueprint) {
  const errors = [];
  const slugRegex = /^[a-z0-9-]+$/;

  if (!blueprint || typeof blueprint !== 'object') {
    errors.push('Blueprint must be an object');
    return createResultArray(errors);
  }

  for (const chapter of blueprint.chapters || []) {
    if (!slugRegex.test(chapter.id)) {
      errors.push(`Chapter ID '${chapter.id}' must match ^[a-z0-9-]+$`);
    }
    for (const concept of chapter.concepts || []) {
      if (!slugRegex.test(concept.slug)) {
        errors.push(`Concept slug '${concept.slug}' in chapter '${chapter.id}' contains invalid characters (accents or uppercase). Must match ^[a-z0-9-]+$`);
      }
    }
  }

  return createResultArray(errors);
}

/**
 * Full blueprint validation.
 * @param {Record<string, any>} blueprint
 * @returns {Array<string> & { valid: boolean, errors: string[] }}
 */
export function validateBlueprint(blueprint) {
  const errors = [];
  if (!blueprint || typeof blueprint !== 'object') {
    errors.push('Blueprint must be an object');
    return createResultArray(errors);
  }

  if (!Array.isArray(blueprint.domains) || blueprint.domains.length !== 4) {
    errors.push(`Blueprint must contain exactly 4 domains, found ${blueprint.domains?.length || 0}`);
  } else {
    let minSum = 0;
    let maxSum = 0;
    for (const d of blueprint.domains) {
      if (!VALID_DOMAINS.includes(d.id)) {
        errors.push(`Unrecognized domain ID in blueprint: '${d.id}'`);
      }
      if (d.weight) {
        minSum += d.weight.min;
        maxSum += d.weight.max;
      }
    }
    if (minSum > 100 || maxSum < 100) {
      errors.push(`Domain weight ranges must span 100% (min sum ${minSum} <= 100 <= max sum ${maxSum})`);
    }
  }

  const slugErrors = validateBlueprintSlugs(blueprint);
  errors.push(...slugErrors);

  return createResultArray(errors);
}

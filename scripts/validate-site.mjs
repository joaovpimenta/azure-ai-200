/**
 * scripts/validate-site.mjs
 * Authoritative deterministic quality and security validation gate for Azure AI-200 Study Hub.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { extractFrontmatter } from './lib/frontmatter.mjs';
import {
  validateFrontmatter,
  validateQuestion,
  validateTags,
  validateBlueprint,
  loadCanonicalTaxonomy,
  VALID_DOMAINS
} from './lib/schema-validator.mjs';
import { extractLinks, validateLink } from './lib/links.mjs';
import { sanitizeCheck } from './lib/markdown.mjs';

const ROOT_DIR = resolve(process.cwd());
const CHAPTERS_DIR = join(ROOT_DIR, 'chapters');
const COMPARISONS_DIR = join(ROOT_DIR, 'comparisons');
const EXAMS_DIR = join(ROOT_DIR, 'exams');
const SYLLABUS_FILE = join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json');
const TAXONOMY_FILE = join(ROOT_DIR, 'generation', 'taxonomy', 'tags.json');

const args = process.argv.slice(2);
const requirePilot = args.includes('--require-pilot');

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

console.log('\n🛡️ Running Deterministic Site Validation Gate...\n');

// 1. Verify Blueprint & Accented Slug Check
if (!existsSync(SYLLABUS_FILE)) {
  fail(`Missing blueprint: ${SYLLABUS_FILE}`);
} else {
  try {
    const raw = readFileSync(SYLLABUS_FILE, 'utf-8');
    const bp = JSON.parse(raw);
    const bpErrors = validateBlueprint(bp);
    bpErrors.forEach(fail);

    // Extra check specifically for the old accented slug
    for (const ch of bp.chapters || []) {
      for (const concept of ch.concepts || []) {
        if (concept.slug === 'app-service-contêineres-configuracao') {
          fail(`Accented slug detected in chapter '${ch.id}': 'app-service-contêineres-configuracao'. Must be normalized to 'app-service-conteineres-configuracao'.`);
        }
      }
    }
  } catch (err) {
    fail(`Failed to parse blueprint JSON: ${err.message}`);
  }
}

// 2. Load Canonical Tags Taxonomy
let canonicalTags = null;
if (!existsSync(TAXONOMY_FILE)) {
  fail(`Missing taxonomy file: ${TAXONOMY_FILE}`);
} else {
  try {
    canonicalTags = loadCanonicalTaxonomy(TAXONOMY_FILE);
  } catch (err) {
    fail(`Malformed taxonomy file: ${err.message}`);
  }
}

// 3. Scan & Validate Markdown Content (Chapters and Comparisons)
const existingRoutes = new Set([
  'index.html', 'cram/', 'simulator/', 'mastery/'
]);

const markdownFiles = [];

if (existsSync(CHAPTERS_DIR)) {
  for (const ch of readdirSync(CHAPTERS_DIR, { withFileTypes: true }).filter(d => d.isDirectory())) {
    const chPath = join(CHAPTERS_DIR, ch.name);
    for (const file of readdirSync(chPath).filter(f => f.endsWith('.md'))) {
      const isReadme = file.toLowerCase() === 'readme.md';
      markdownFiles.push({
        path: join(chPath, file),
        type: isReadme ? 'readme' : 'concept',
        chapter: ch.name
      });
      if (!isReadme) {
        const slug = file.replace(/\.md$/, '');
        existingRoutes.add(`chapters/${ch.name}/${slug}/`);
        existingRoutes.add(`chapters/${ch.name}/${slug}/index.html`);
        existingRoutes.add(slug);
      }
    }
  }
}

if (existsSync(COMPARISONS_DIR)) {
  for (const file of readdirSync(COMPARISONS_DIR).filter(f => f.endsWith('.md'))) {
    markdownFiles.push({
      path: join(COMPARISONS_DIR, file),
      type: 'comparison',
      chapter: null
    });
    const slug = file.replace(/\.md$/, '');
    existingRoutes.add(`comparisons/${slug}/`);
    existingRoutes.add(`comparisons/${slug}/index.html`);
    existingRoutes.add(slug);
  }
}

const conceptCount = markdownFiles.filter(m => m.type === 'concept').length;
const comparisonCount = markdownFiles.filter(m => m.type === 'comparison').length;
console.log(`Discovered ${conceptCount} concept(s) and ${comparisonCount} comparison matrix(es).`);

if (requirePilot) {
  const pilotCount = markdownFiles.filter(m => m.type === 'concept' && m.chapter === '04-cosmos-db-nosql').length;
  if (pilotCount < 5) {
    fail(`--require-pilot flag specified: expected 5 pilot concepts in 04-cosmos-db-nosql, found ${pilotCount}`);
  }
  if (comparisonCount < 1) {
    fail(`--require-pilot flag specified: expected at least 1 comparison matrix, found ${comparisonCount}`);
  }
}

// Validation loop for markdown files
for (const item of markdownFiles) {
  const content = readFileSync(item.path, 'utf-8');
  const filename = basename(item.path);

  // Security Check: Absolute ban on inline scripts, on* handlers, and javascript: URLs
  const securityViolations = sanitizeCheck(content);
  if (securityViolations.length > 0) {
    securityViolations.forEach(v => fail(`Security Violation in ${item.path}: ${v}`));
  }

  // Skip frontmatter and section checks on chapter README.md files
  if (item.type === 'readme') continue;

  let fmData = null;
  try {
    const extracted = extractFrontmatter(content, item.path);
    fmData = extracted.data;
  } catch (err) {
    fail(err.message);
    continue;
  }

  // Validate Frontmatter schema
  const expectedSlug = filename.replace(/\.md$/, '');
  const fmErrors = validateFrontmatter(fmData, {
    expectedSlug,
    expectedChapter: item.chapter || undefined,
    canonicalTags,
    filePath: item.path
  });
  fmErrors.forEach(fail);

  // Validate mandatory section: ## Pegadinhas de Prova (for concepts)
  if (item.type === 'concept') {
    const pegadinhasMatch = /(?:^|\n)##\s+Pegadinhas\s+de\s+Prova\r?\n([\s\S]*?)(?=(?:\r?\n##\s+)|\s*$)/i.exec(content);
    if (!pegadinhasMatch || !pegadinhasMatch[1].trim()) {
      fail(`Missing or empty mandatory section '## Pegadinhas de Prova' in ${item.path}`);
    }
  }

  // Code Tab Parity Check: Check for Python SDK without C# counterpart
  const pyMatches = [...content.matchAll(/```(?:python|py)\b([\s\S]*?)```/gi)];
  const csMatches = [...content.matchAll(/```(?:csharp|c#)\b([\s\S]*?)```/gi)];
  if (pyMatches.length > 0 && csMatches.length === 0) {
    warn(`Code Tab Parity: ${item.path} has ${pyMatches.length} Python code block(s) but no C# code block`);
  }

  // Link integrity validation
  const links = extractLinks(content);
  for (const l of links) {
    const res = validateLink(l.url, existingRoutes);
    if (!res.valid) {
      fail(`Broken link in ${item.path}: '${l.url}' (${res.reason})`);
    }
  }

  // Validate concept-embedded questions if present
  if (Array.isArray(fmData.questions)) {
    fmData.questions.forEach((q, idx) => {
      const qErrors = validateQuestion(q, `${item.path} -> questions[${idx}]`);
      qErrors.forEach(fail);
    });
  }
}

// 4. Validate Question Bank Files (scenarios and case-studies)
if (existsSync(EXAMS_DIR)) {
  const scenariosDir = join(EXAMS_DIR, 'scenarios');
  if (existsSync(scenariosDir)) {
    for (const f of readdirSync(scenariosDir).filter(x => x.endsWith('.json'))) {
      const fPath = join(scenariosDir, f);
      try {
        const raw = JSON.parse(readFileSync(fPath, 'utf-8'));
        const list = Array.isArray(raw) ? raw : [raw];
        list.forEach((q, idx) => {
          const qErrors = validateQuestion(q, `${f} [${idx}]`);
          qErrors.forEach(fail);
        });
      } catch (err) {
        fail(`JSON parse error in ${fPath}: ${err.message}`);
      }
    }
  }
  const caseStudiesDir = join(EXAMS_DIR, 'case-studies');
  if (existsSync(caseStudiesDir)) {
    for (const f of readdirSync(caseStudiesDir).filter(x => x.endsWith('.json'))) {
      const fPath = join(caseStudiesDir, f);
      try {
        const raw = JSON.parse(readFileSync(fPath, 'utf-8'));
        const qErrors = validateQuestion(raw, f);
        qErrors.forEach(fail);
      } catch (err) {
        fail(`JSON parse error in ${fPath}: ${err.message}`);
      }
    }
  }
}

// 5. Output Results and Exit
console.log('--------------------------------------------------');
if (warnings.length > 0) {
  console.log(`\x1b[33mWarnings (${warnings.length}):\x1b[0m`);
  warnings.forEach(w => console.log(`  ! ${w}`));
}

if (errors.length > 0) {
  console.log(`\x1b[31mValidation Errors (${errors.length}):\x1b[0m`);
  errors.forEach(e => console.log(`  ✗ ${e}`));
  console.log('\n❌ Site validation failed. Please address the errors above.\n');
  process.exit(1);
} else {
  console.log(`\x1b[32m✓ Validation passed successfully! (0 errors, ${warnings.length} warnings)\x1b[0m\n`);
  process.exit(0);
}

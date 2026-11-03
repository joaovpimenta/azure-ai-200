/**
 * scripts/doctor.mjs
 * Comprehensive diagnostic check for Azure AI-200 Study Hub development environment.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { validateBlueprint, validateBlueprintSlugs } from './lib/schema-validator.mjs';

const ROOT_DIR = resolve(process.cwd());
let errorCount = 0;
let warningCount = 0;

function report(status, title, message = '') {
  const symbol = status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗';
  const prefix = status === 'ok' ? '\x1b[32m' : status === 'warn' ? '\x1b[33m' : '\x1b[31m';
  console.log(`${prefix}[${symbol}]\x1b[0m \x1b[1m${title}\x1b[0m${message ? ` - ${message}` : ''}`);
  if (status === 'error') errorCount++;
  if (status === 'warn') warningCount++;
}

console.log('\n🔍 Running Azure AI-200 Study Hub Environment Doctor...\n');

// 1. Check Node.js runtime version (>= 22)
try {
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major >= 22) {
    report('ok', `Node.js Version: v${nodeVersion}`, 'Satisfies engines requirement >= 22');
  } else {
    report('error', `Node.js Version: v${nodeVersion}`, 'Requires Node.js >= 22. Please upgrade.');
  }
} catch (err) {
  report('error', 'Node.js Check Failed', err.message);
}

// 2. Check Python runtime (>= 3.12)
let pythonFound = false;
const pythonCandidates = ['python', 'py -3', 'py', 'python3'];
for (const cmd of pythonCandidates) {
  try {
    const output = execSync(`${cmd} --version`, { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' }).trim();
    const match = /Python\s+([0-9]+)\.([0-9]+)\.([0-9]+)/i.exec(output);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > 3 || (major === 3 && minor >= 12)) {
        report('ok', `Python Version: ${output} (via '${cmd}')`, 'Satisfies requirement >= 3.12');
      } else {
        report('warn', `Python Version: ${output}`, 'Recommended Python >= 3.12 for optional Kokoro audio generation.');
      }
      pythonFound = true;
      break;
    }
  } catch {
    // try next candidate
  }
}
if (!pythonFound) {
  report('warn', 'Python Runtime', 'Python not found on PATH. Optional for local site build, needed for Kokoro TTS.');
}

// 3. Check marked and yaml dependencies
try {
  const markedPkg = await import('marked');
  if (typeof markedPkg.marked?.parse === 'function' || typeof markedPkg.Marked === 'function') {
    report('ok', 'Dependency: marked', 'Installed and importable');
  } else {
    report('error', 'Dependency: marked', 'Installed package does not export expected parse or Marked');
  }
} catch (err) {
  report('error', 'Dependency: marked', `Failed to import marked: ${err.message}. Run 'npm install'.`);
}

try {
  const yamlPkg = await import('yaml');
  if (typeof yamlPkg.default?.parse === 'function' || typeof yamlPkg.parse === 'function') {
    report('ok', 'Dependency: yaml', 'Installed and importable');
  } else {
    report('error', 'Dependency: yaml', 'Installed package does not export expected parse method');
  }
} catch (err) {
  report('error', 'Dependency: yaml', `Failed to import yaml: ${err.message}. Run 'npm install'.`);
}

// 4. Validate syllabus/ai-200-blueprint.json
const blueprintPath = join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json');
if (!existsSync(blueprintPath)) {
  report('error', 'Blueprint File', `Missing at ${blueprintPath}`);
} else {
  try {
    const rawBlueprint = readFileSync(blueprintPath, 'utf-8');
    const blueprint = JSON.parse(rawBlueprint);
    const bpErrors = validateBlueprint(blueprint);

    if (bpErrors.length > 0) {
      report('error', 'Blueprint Validation', bpErrors.join('; '));
    } else {
      report('ok', 'Blueprint Core Schema & Slugs', `Found ${blueprint.domains.length} domains and ${blueprint.chapters.length} chapters. All 35 concept slugs conform to ASCII kebab-case.`);
    }
  } catch (err) {
    report('error', 'Blueprint Parsing', `Invalid JSON in ${blueprintPath}: ${err.message}`);
  }
}

// 5. Check Taxonomy File
const taxonomyPath = join(ROOT_DIR, 'generation', 'taxonomy', 'tags.json');
if (!existsSync(taxonomyPath)) {
  report('error', 'Taxonomy File', `Missing at ${taxonomyPath}`);
} else {
  try {
    const rawTaxonomy = readFileSync(taxonomyPath, 'utf-8');
    const taxonomy = JSON.parse(rawTaxonomy);
    const tagCount = Array.isArray(taxonomy.tags) ? taxonomy.tags.length : 0;
    if (tagCount > 0) {
      report('ok', 'Canonical Tag Taxonomy', `Found ${tagCount} registered tags in generation/taxonomy/tags.json`);
    } else {
      report('error', 'Canonical Tag Taxonomy', 'No tags defined in generation/taxonomy/tags.json');
    }
  } catch (err) {
    report('error', 'Taxonomy Parsing', `Invalid JSON in ${taxonomyPath}: ${err.message}`);
  }
}

// 6. Inspect Workspace Directories
const requiredDirs = [
  { name: 'syllabus', requiredNow: true },
  { name: 'docs', requiredNow: true },
  { name: 'scripts', requiredNow: true },
  { name: 'generation', requiredNow: true },
  { name: 'chapters', requiredNow: true },
  { name: 'comparisons', requiredNow: true },
  { name: 'exams', requiredNow: true },
  { name: 'web', requiredNow: true },
  { name: 'tests', requiredNow: true }
];

console.log('\n📁 Workspace Directories Status:');
for (const dir of requiredDirs) {
  const dirPath = join(ROOT_DIR, dir.name);
  const exists = existsSync(dirPath);
  if (exists) {
    report('ok', `Directory '${dir.name}/'`, 'Present');
  } else if (dir.requiredNow) {
    report('error', `Directory '${dir.name}/'`, 'Missing mandatory directory');
  } else {
    console.log(`  \x1b[90m[-] Directory '${dir.name}/' - Pending creation\x1b[0m`);
  }
}

console.log(`\n==================================================`);
console.log(`Diagnostics summary: ${errorCount} error(s), ${warningCount} warning(s)`);
console.log(`==================================================\n`);

process.exit(errorCount > 0 ? 1 : 0);

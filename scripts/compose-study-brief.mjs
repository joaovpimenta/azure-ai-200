/**
 * scripts/compose-study-brief.mjs
 * Authoring assistant that creates structured generation briefs from the syllabus blueprint.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const BLUEPRINT_PATH = join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json');

const args = process.argv.slice(2);
const slugFlagIdx = args.indexOf('--slug');
const query = slugFlagIdx !== -1 && args[slugFlagIdx + 1]
  ? args[slugFlagIdx + 1]
  : args.find(a => !a.startsWith('-'));

if (!existsSync(BLUEPRINT_PATH)) {
  console.error(`Blueprint file not found at ${BLUEPRINT_PATH}`);
  process.exit(1);
}

const blueprint = JSON.parse(readFileSync(BLUEPRINT_PATH, 'utf-8'));

if (!query || args.includes('--help') || args.includes('-h') || args.includes('--list')) {
  console.log(`
Usage:
  node scripts/compose-study-brief.mjs <concept-slug-or-keyword> [--out <path>]

Available Chapters and Concepts:
`);
  for (const ch of blueprint.chapters) {
    console.log(`\n📚 [Chapter ${ch.order}] ${ch.id} — ${ch.title}`);
    for (const c of ch.concepts) {
      console.log(`   - ${c.slug}: ${c.title}`);
    }
  }
  process.exit(0);
}

// Search for concept by exact slug, partial slug, or title match
let foundConcept = null;
let foundChapter = null;

for (const ch of blueprint.chapters) {
  for (const c of ch.concepts) {
    if (c.slug === query || c.slug.includes(query) || c.title.toLowerCase().includes(query.toLowerCase())) {
      foundConcept = c;
      foundChapter = ch;
      break;
    }
  }
  if (foundConcept) break;
}

if (!foundConcept) {
  console.error(`Concept matching '${query}' not found in syllabus.`);
  process.exit(1);
}

// Resolve domain and relevant skills
const domain = blueprint.domains.find(d => foundChapter.domains.includes(d.id));
const relevantSkills = (domain?.skills || []).filter(s => (foundConcept.skills || []).includes(s.id));

const briefMarkdown = `# Authoring Brief: ${foundConcept.title}

## Metadata
- **Slug**: \`${foundConcept.slug}\`
- **Target File**: \`chapters/${foundChapter.id}/${foundConcept.slug}.md\`
- **Chapter**: \`${foundChapter.id}\` (${foundChapter.title})
- **Exam Domain**: \`${domain?.id || foundChapter.domains[0]}\` (${domain?.title || ''})
- **Domain Weight**: ${domain?.weight?.min || 20}%–${domain?.weight?.max || 25}%
- **Skills Covered**: ${(foundConcept.skills || []).join(', ')}

## Syllabus Skills & Bullets
${relevantSkills.map(s => `### ${s.title}\n${s.bullets.map(b => `- ${b}`).join('\n')}`).join('\n\n')}

## Authoring Directives
1. **Frontmatter**: Must include \`title\`, \`slug\`, \`chapter\`, \`exam_domain\`, \`tags\`, \`difficulty\`, \`tldr\`, and \`related_links\`.
2. **Active Recall**:
   - Use inline cloze blanks \`==termo técnico==\` for core keywords, metrics, CLI flags, and API methods.
   - Include \`<details><summary>Checagem Rápida</summary>...\` check cards before complex diagrams.
3. **Dual SDK Parity**:
   - Every SDK example must provide consecutive \`\`\`python and \`\`\`csharp code blocks.
4. **Mandatory Exam Traps**:
   - Must contain a dedicated \`## Pegadinhas de Prova\` section highlighting tricky subtleties, default settings, and frequent distractor choices.
5. **Review Questions**:
   - Include at least 2 questions in the frontmatter \`questions\` array (e.g. \`single-choice\` and \`code-completion\`).
`;

const outIdx = args.indexOf('--out');
if (outIdx !== -1 && args[outIdx + 1]) {
  const outPath = resolve(args[outIdx + 1]);
  writeFileSync(outPath, briefMarkdown, 'utf-8');
  console.log(`✓ Brief written to: ${outPath}`);
} else {
  console.log(briefMarkdown);
}

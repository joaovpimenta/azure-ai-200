import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { getStudySequenceProgress, renderNextStudyLink, renderStudyCasePrompt, renderStudyGuide, renderStudySequenceNav } from '../web/study-guide.js';

test('the full sequence visits each blueprint article exactly once and leads to exam preparation', () => {
  const blueprint = JSON.parse(readFileSync('syllabus/ai-200-blueprint.json', 'utf8'));
  const expected = blueprint.chapters.flatMap(chapter => chapter.concepts.map(concept => `chapters/${chapter.id}/${concept.slug}/index.html`));
  const html = renderStudyGuide('../../');
  const outline = html.match(/<details class="study-outline">([\s\S]*?)<\/details>/)[1];
  const links = [...outline.matchAll(/href="\.\.\/\.\.\/(chapters\/[^"#]+)"/g)].map(([, link]) => link);
  assert.equal(links.length, expected.length);
  assert.deepEqual(new Set(links), new Set(expected));
  assert.match(links[0], /identidade-gerenciada-defaultazurecredential/);
  assert.ok(html.includes(`class="study-start" href="../../${links[0]}"`));

  for (const [index, link] of links.entries()) {
    const source = link.replace(/\/index.html$/, '.md');
    const { data } = extractFrontmatter(readFileSync(source, 'utf8'), source);
    assert.ok(data.questions?.length > 0, source);
    const next = links[index + 1] || 'preparacao/index.html';
    assert.ok(renderNextStudyLink('../', data.slug).includes(`href="../${next}"`));
    assert.match(renderStudySequenceNav('../../../', data.slug), new RegExp(`Artigo ${index + 1} de ${links.length}`));
  }
});

test('every guided decision links to an article with practice and leads to the next decision', () => {
  const caseList = renderStudyGuide().match(/<ol class="study-case-steps"[^>]*>([\s\S]*?)<\/ol>/)[1];
  const links = [...caseList.matchAll(/href="\.\/(chapters\/[^"#]+)"/g)].map(([, link]) => link);
  assert.equal(links.length, 4);
  assert.equal(new Set(links).size, links.length);

  for (const [index, link] of links.entries()) {
    const source = link.replace(/\/index.html$/, '.md');
    const { data } = extractFrontmatter(readFileSync(source, 'utf8'), source);
    assert.ok(data.questions?.length > 0, source);
    assert.match(renderStudyCasePrompt('../../../', data.slug), new RegExp(`Decisão ${index + 1} de 4`));
    const next = links[index + 1];
    if (next) assert.ok(renderNextStudyLink('../', data.slug).includes(`href="../${next}"`));
  }

  assert.equal(renderStudyCasePrompt('./', 'outro-conceito'), '');
  assert.equal(renderNextStudyLink('./', 'outro-conceito'), '');
});

test('resuming skips completed practice and picks the first remaining lesson', () => {
  const timestamp = '2026-11-18T14:00:00.000Z';
  const { completed, total, next } = getStudySequenceProgress({
    'identidade-gerenciada-defaultazurecredential': { practiceCompletedAt: timestamp },
    'cosmos-db-busca-vetorial': { practiceCompletedAt: timestamp },
    'aca-ambientes-e-implantacao': { state: 'mastered' }
  });
  assert.equal(completed, 2);
  assert.equal(total, 35);
  assert.equal(next.slug, 'aca-ambientes-e-implantacao');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateQuizScore } from '../web/quiz-core.js';

const data = file => JSON.parse(readFileSync(`dist/data/${file}.json`, 'utf8'));

function solve(question) {
  switch (question.type) {
    case 'single-choice': return question.options.findIndex(option => option.correct);
    case 'multiple-choice': return question.options.flatMap((option, index) => option.correct ? [index] : []);
    case 'code-completion': return Object.fromEntries(question.slots.map(slot => [slot.id, slot.options.findIndex(option => option.correct)]));
    case 'ordering': return [...question.items].sort((a, b) => a.order - b.order).map(item => item.id);
    case 'case-study': return Object.fromEntries(question.questions.map(item => [item.id, solve(item)]));
  }
}

test('the built timed mock has distinct questions, five formats and official domain proportions', () => {
  const { questions } = data('mock-exam');
  const blueprint = data('blueprint');
  const studyIds = new Set(data('questions').map(question => question.id));
  assert.equal(blueprint.exam.durationMinutes, 120);
  assert.equal(questions.length, 40);
  assert.equal(new Set(questions.map(question => question.id)).size, 40);
  assert.ok(questions.every(question => !studyIds.has(question.id)));
  assert.equal(new Set(questions.map(question => question.type)).size, 5);
  const answers = Object.fromEntries(questions.map(question => [question.id, solve(question)]));
  const result = calculateQuizScore(questions, answers);
  assert.equal(result.correct, 40);
  assert.equal(result.percentage, 100);
  for (const domain of blueprint.domains) {
    const share = result.domainScores[domain.id].total * 100 / result.total;
    assert.ok(share >= domain.weight.min && share <= domain.weight.max, domain.id);
  }
});

test('the preparation page links to practice, official videos, labs and audio', () => {
  const html = readFileSync('dist/preparacao/index.html', 'utf8');
  assert.match(html, /\.\.\/simulator\/index\.html#simulator\?mode=exam/);
  assert.match(html, /aka\.ms\/AI200-ExamPrep/);
  assert.match(html, /microsoftlearning\.github\.io\/mslearn-azure-ai/);
  assert.match(html, /Episode513\.mp3/);
  assert.match(html, /Practice Assessment/);
});

/**
 * tests/quiz-core.test.mjs
 * Unit test suite for web/quiz-core.js using native node:test.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSingleChoice,
  evaluateMultipleChoice,
  evaluateCodeCompletion,
  evaluateOrdering,
  evaluateCaseStudy,
  evaluateAnswer,
  filterQuestions,
  calculateQuizScore,
  extractMistakes,
  shuffleArray
} from '../web/quiz-core.js';

describe('Quiz Core Engine (web/quiz-core.js)', () => {
  describe('evaluateSingleChoice', () => {
    const qSingle = {
      id: 'q-single-1',
      type: 'single-choice',
      options: [
        { text: '10 GB', correct: false, rationale: 'Limite legado' },
        { text: '20 GB', correct: true, rationale: 'Limite oficial da partição lógica.' },
        { text: '50 GB', correct: false, rationale: 'Inexistente' }
      ]
    };

    test('marks correct option index as correct with score 1', () => {
      const res = evaluateSingleChoice(qSingle, 1);
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
      assert.match(res.rationale, /Limite oficial/);
      assert.equal(res.details.isAnswered, true);
      assert.equal(res.details.selectedIndex, 1);
      assert.equal(res.details.correctIndex, 1);
    });

    test('handles numeric string index gracefully', () => {
      const res = evaluateSingleChoice(qSingle, '1');
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
    });

    test('marks incorrect option as incorrect with score 0', () => {
      const res = evaluateSingleChoice(qSingle, 0);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
      assert.match(res.rationale, /Limite legado/);
    });

    test('handles unanswered null and undefined gracefully', () => {
      const res1 = evaluateSingleChoice(qSingle, null);
      assert.equal(res1.isCorrect, false);
      assert.equal(res1.score, 0);
      assert.equal(res1.details.isAnswered, false);

      const res2 = evaluateSingleChoice(qSingle, undefined);
      assert.equal(res2.isCorrect, false);
      assert.equal(res2.details.isAnswered, false);
    });

    test('handles out of bounds index', () => {
      const res = evaluateSingleChoice(qSingle, 99);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
      assert.equal(res.details.isAnswered, false);
    });
  });

  describe('evaluateMultipleChoice', () => {
    const qMulti = {
      id: 'q-multi-1',
      type: 'multiple-choice',
      select_count: 2,
      options: [
        { text: 'ACR Tasks', correct: true, rationale: 'Build automatizado' },
        { text: 'Blob Storage', correct: false, rationale: 'Não suporta build' },
        { text: 'Managed Identity', correct: true, rationale: 'Autenticação sem credenciais' },
        { text: 'Static IP', correct: false, rationale: 'Desnecessário' }
      ]
    };

    test('marks fully correct selection as correct with score 1', () => {
      const res = evaluateMultipleChoice(qMulti, [0, 2]);
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
      assert.equal(res.details.matchedIndices.length, 2);
      assert.equal(res.details.falsePositiveIndices.length, 0);
    });

    test('marks partially correct selection as isCorrect: false', () => {
      const res = evaluateMultipleChoice(qMulti, [0, 1]);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
      assert.equal(res.details.matchedIndices.length, 1);
      assert.equal(res.details.falsePositiveIndices.length, 1);
      assert.equal(res.details.partialScore, 0); // 1 match - 1 false pos = 0
    });

    test('fails if user selects fewer options than select_count', () => {
      const res = evaluateMultipleChoice(qMulti, [0]);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
    });

    test('fails if user selects more options than select_count', () => {
      const res = evaluateMultipleChoice(qMulti, [0, 1, 2]);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
    });
  });

  describe('evaluateCodeCompletion', () => {
    const qCode = {
      id: 'q-code-1',
      type: 'code-completion',
      code_template: 'client = CosmosClient(url, {{slot_1}})\ndb = client.{{slot_2}}(id="test")',
      slots: [
        {
          id: 'slot_1',
          options: [
            { text: 'credential=DefaultAzureCredential()', correct: true, rationale: 'Entra ID seguro' },
            { text: 'key="123"', correct: false, rationale: 'Chave insegura' }
          ]
        },
        {
          id: 'slot_2',
          options: [
            { text: 'create_database_if_not_exists', correct: true, rationale: 'Método idempotente' },
            { text: 'get_database', correct: false, rationale: 'Falha se não existir' }
          ]
        }
      ]
    };

    test('evaluates slots with numeric indices', () => {
      const res = evaluateCodeCompletion(qCode, { slot_1: 0, slot_2: 0 });
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
      assert.match(res.details.userRenderedCode, /DefaultAzureCredential/);
      assert.match(res.details.userRenderedCode, /create_database_if_not_exists/);
    });

    test('evaluates slots with exact text strings', () => {
      const res = evaluateCodeCompletion(qCode, {
        slot_1: 'credential=DefaultAzureCredential()',
        slot_2: 'create_database_if_not_exists'
      });
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
    });

    test('reports partial credit in details when 1 of 2 slots correct', () => {
      const res = evaluateCodeCompletion(qCode, { slot_1: 0, slot_2: 1 });
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
      assert.equal(res.details.correctSlotsCount, 1);
      assert.equal(res.details.partialScore, 0.5);
    });
  });

  describe('evaluateOrdering', () => {
    const qOrder = {
      id: 'q-order-1',
      type: 'ordering',
      items: [
        { id: 'step_build', text: 'Build ACR', order: 1 },
        { id: 'step_env', text: 'Criar ACA Environment', order: 2 },
        { id: 'step_deploy', text: 'Deploy Container App', order: 3 }
      ]
    };

    test('evaluates perfectly ordered sequence of IDs', () => {
      const res = evaluateOrdering(qOrder, ['step_build', 'step_env', 'step_deploy']);
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
      assert.equal(res.details.correctPositionsCount, 3);
    });

    test('evaluates inverted order as incorrect', () => {
      const res = evaluateOrdering(qOrder, ['step_deploy', 'step_env', 'step_build']);
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0);
      assert.equal(res.details.correctPositionsCount, 1); // step_env at index 1 matches
      assert.equal(res.details.partialScore, 0.33);
    });

    test('supports original numeric indices', () => {
      const res = evaluateOrdering(qOrder, [0, 1, 2]);
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
    });
  });

  describe('evaluateCaseStudy', () => {
    const qCase = {
      id: 'cs-1',
      type: 'case-study',
      tabs: [
        { title: 'Visão Geral', content: 'Contoso cenário' },
        { title: 'Arquitetura Atual', content: 'On-premise' },
        { title: 'Requisitos Técnicos', content: 'p99 < 10ms' },
        { title: 'Requisitos de Segurança', content: 'Zero Trust' }
      ],
      questions: [
        {
          id: 'cs-q1',
          type: 'single-choice',
          options: [
            { text: 'Cosmos DB', correct: true, rationale: 'Sub-10ms garantido' },
            { text: 'Storage Blob', correct: false, rationale: 'Não é banco' }
          ]
        },
        {
          id: 'cs-q2',
          type: 'single-choice',
          options: [
            { text: 'Entra ID Managed Identity', correct: true, rationale: 'Sem segredos' },
            { text: 'Hardcoded Key', correct: false, rationale: 'Inseguro' }
          ]
        }
      ]
    };

    test('evaluates case study with all child answers correct', () => {
      const res = evaluateCaseStudy(qCase, {
        'cs-q1': 0,
        'cs-q2': 0
      });
      assert.equal(res.isCorrect, true);
      assert.equal(res.score, 1);
      assert.equal(res.details.correctChildrenCount, 2);
    });

    test('evaluates case study with partial child answers', () => {
      const res = evaluateCaseStudy(qCase, {
        'cs-q1': 0,
        'cs-q2': 1
      });
      assert.equal(res.isCorrect, false);
      assert.equal(res.score, 0.5);
      assert.equal(res.details.correctChildrenCount, 1);
    });
  });

  describe('filterQuestions', () => {
    const sampleQuestions = [
      { id: 'q1', language: 'python', exam_domain: 'data-management', chapter: '04-cosmos-db-nosql', tags: ['cosmos-db', 'rag'] },
      { id: 'q2', language: 'csharp', exam_domain: 'data-management', chapter: '04-cosmos-db-nosql', tags: ['cosmos-db'] },
      { id: 'q3', language: 'agnostic', exam_domain: 'containerized-solutions', chapter: '01-container-hosting', tags: ['acr'] },
      { id: 'q4', language: 'agnostic', exam_domain: 'data-management', chapter: '05-postgresql-pgvector', tags: ['pgvector', 'rag'] }
    ];

    test('filters by language: python includes python + agnostic', () => {
      const filtered = filterQuestions(sampleQuestions, { language: 'python' });
      assert.deepEqual(filtered.map(q => q.id), ['q1', 'q3', 'q4']);
    });

    test('filters by language: csharp includes csharp + agnostic', () => {
      const filtered = filterQuestions(sampleQuestions, { language: 'csharp' });
      assert.deepEqual(filtered.map(q => q.id), ['q2', 'q3', 'q4']);
    });

    test('filters by language: agnostic includes only agnostic', () => {
      const filtered = filterQuestions(sampleQuestions, { language: 'agnostic' });
      assert.deepEqual(filtered.map(q => q.id), ['q3', 'q4']);
    });

    test('filters by language: case-insensitive input (PYTHON, CSharp)', () => {
      const filteredPy = filterQuestions(sampleQuestions, { language: 'PYTHON' });
      assert.deepEqual(filteredPy.map(q => q.id), ['q1', 'q3', 'q4']);

      const filteredCs = filterQuestions(sampleQuestions, { language: 'CSharp' });
      assert.deepEqual(filteredCs.map(q => q.id), ['q2', 'q3', 'q4']);
    });

    test('filters by domain and chapter', () => {
      const filtered = filterQuestions(sampleQuestions, {
        domain: 'data-management',
        chapter: '04-cosmos-db-nosql'
      });
      assert.deepEqual(filtered.map(q => q.id), ['q1', 'q2']);
    });

    test('filters by tags', () => {
      const filtered = filterQuestions(sampleQuestions, { tags: ['rag'] });
      assert.deepEqual(filtered.map(q => q.id), ['q1', 'q4']);
    });

    test('filters by Caderno de Erros (onlyMistakes)', () => {
      const filtered = filterQuestions(sampleQuestions, {
        onlyMistakes: true,
        mistakesList: ['q2', 'q4']
      });
      assert.deepEqual(filtered.map(q => q.id), ['q2', 'q4']);
    });
  });

  describe('calculateQuizScore', () => {
    const questions = [
      {
        id: 'q1',
        type: 'single-choice',
        exam_domain: 'data-management',
        options: [{ text: 'A', correct: true }, { text: 'B', correct: false }]
      },
      {
        id: 'q2',
        type: 'single-choice',
        exam_domain: 'data-management',
        options: [{ text: 'A', correct: false }, { text: 'B', correct: true }]
      },
      {
        id: 'q3',
        type: 'single-choice',
        exam_domain: 'containerized-solutions',
        options: [{ text: 'A', correct: true }, { text: 'B', correct: false }]
      }
    ];

    test('calculates totals, percentage, and domain breakdowns', () => {
      const answers = { q1: 0, q2: 0, q3: 0 }; // q1 correct, q2 wrong, q3 correct
      const score = calculateQuizScore(questions, answers, { passingScore: 60 });
      assert.equal(score.total, 3);
      assert.equal(score.answered, 3);
      assert.equal(score.correct, 2);
      assert.equal(score.incorrect, 1);
      assert.equal(score.percentage, 66.7);
      assert.equal(score.isPassing, true);

      assert.equal(score.domainScores['data-management'].percentage, 50);
      assert.equal(score.domainScores['containerized-solutions'].percentage, 100);
    });

    test('handles empty questions list without crashing', () => {
      const score = calculateQuizScore([], {});
      assert.equal(score.total, 0);
      assert.equal(score.percentage, 0);
      assert.equal(score.isPassing, false);
    });

    test('extractMistakes extracts incorrect items', () => {
      const score = calculateQuizScore(questions, { q1: 0, q2: 0, q3: 0 });
      const mistakes = extractMistakes(score);
      assert.equal(mistakes.length, 1);
      assert.equal(mistakes[0].questionId, 'q2');
    });
  });

  describe('shuffleArray helper', () => {
    test('returns new array with same elements', () => {
      const orig = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(orig);
      assert.equal(shuffled.length, 5);
      assert.notEqual(orig, shuffled); // Not same instance
      assert.deepEqual([...shuffled].sort(), orig);
    });
  });
});

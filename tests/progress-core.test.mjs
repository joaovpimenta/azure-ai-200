/**
 * tests/progress-core.test.mjs
 * Unit test suite for web/progress-core.js using native node:test.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  OFFICIAL_DOMAIN_WEIGHTS,
  PROGRESSION_RANKS,
  PROGRESSION_WEIGHTS,
  createDefaultProgress,
  validateProgressSchema,
  calculateReadiness,
  mergeProgress,
  exportProgressJson,
  importProgressJson
} from '../web/progress-core.js';

describe('Progress Core Engine (web/progress-core.js)', () => {
  test('constants and schema defaults conform to specifications', () => {
    assert.equal(STORAGE_KEY, 'azure_ai_200_progress_v1');
    assert.equal(SCHEMA_VERSION, 1);

    // Official AI-200 Domain Weights (Study Guide 2026-10-30)
    assert.equal(OFFICIAL_DOMAIN_WEIGHTS['containerized-solutions'], 0.225);
    assert.equal(OFFICIAL_DOMAIN_WEIGHTS['data-management'], 0.275);
    assert.equal(OFFICIAL_DOMAIN_WEIGHTS['connect-and-consume'], 0.225);
    assert.equal(OFFICIAL_DOMAIN_WEIGHTS['secure-monitor-troubleshoot'], 0.225);

    const weightSum = Object.values(OFFICIAL_DOMAIN_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.equal(Math.round(weightSum * 1000) / 1000, 0.95);

    // Progression Ranks: mastered (3) > review (2) > studying (1) > not_started (0)
    assert.equal(PROGRESSION_RANKS['mastered'], 3);
    assert.equal(PROGRESSION_RANKS['review'], 2);
    assert.equal(PROGRESSION_RANKS['studying'], 1);
    assert.equal(PROGRESSION_RANKS['not_started'], 0);
  });

  describe('validateProgressSchema', () => {
    test('passes pristine default progress state', () => {
      const state = createDefaultProgress();
      const res = validateProgressSchema(state);
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);
    });

    test('fails on unsupported schemaVersion', () => {
      const state = { ...createDefaultProgress(), schemaVersion: 2 };
      const res = validateProgressSchema(state);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('expected 1')));
    });

    test('fails when required sub-objects are null or missing', () => {
      const state = { schemaVersion: 1, conceptProgress: null };
      const res = validateProgressSchema(state);
      assert.equal(res.valid, false);
      assert.ok(res.errors.some(e => e.includes('conceptProgress')));
    });
  });

  describe('calculateReadiness', () => {
    const mockBlueprint = {
      exam: { passingScore: 700 },
      domains: [
        { id: 'containerized-solutions', title: 'Container' },
        { id: 'data-management', title: 'Data' },
        { id: 'connect-and-consume', title: 'Connect' },
        { id: 'secure-monitor-troubleshoot', title: 'Secure' }
      ],
      chapters: [
        {
          id: '01-container-hosting',
          exam_domain: 'containerized-solutions',
          concepts: [{ slug: 'c-acr' }]
        },
        {
          id: '04-cosmos-db-nosql',
          exam_domain: 'data-management',
          concepts: [{ slug: 'c-cosmos' }]
        },
        {
          id: '07-backend-integration',
          exam_domain: 'connect-and-consume',
          concepts: [{ slug: 'c-bus' }]
        },
        {
          id: '08-secrets-and-config',
          exam_domain: 'secure-monitor-troubleshoot',
          concepts: [{ slug: 'c-kv' }]
        }
      ]
    };

    test('calculates 0% readiness when no concepts started', () => {
      const state = createDefaultProgress();
      const readiness = calculateReadiness(state, mockBlueprint);
      assert.equal(readiness.overallPercentage, 0);
      assert.equal(readiness.examScaledScore, 0);
      assert.equal(readiness.isPassing, false);
    });

    test('calculates 100% readiness when all concepts are mastered', () => {
      const state = createDefaultProgress();
      state.conceptProgress['c-acr'] = { state: 'mastered' };
      state.conceptProgress['c-cosmos'] = { state: 'mastered' };
      state.conceptProgress['c-bus'] = { state: 'mastered' };
      state.conceptProgress['c-kv'] = { state: 'mastered' };

      const readiness = calculateReadiness(state, mockBlueprint);
      assert.equal(readiness.overallPercentage, 100);
      assert.equal(readiness.examScaledScore, 1000);
      assert.equal(readiness.isPassing, true);
    });

    test('calculates exact weighted domain average', () => {
      const state = createDefaultProgress();
      // data-management (weight 0.275): 100% mastered
      state.conceptProgress['c-cosmos'] = { state: 'mastered' };
      // containerized-solutions (weight 0.225): studying (0.33)
      state.conceptProgress['c-acr'] = { state: 'studying' };

      const readiness = calculateReadiness(state, mockBlueprint);
      assert.equal(readiness.domainReadiness['data-management'].percentage, 100);
      assert.equal(readiness.domainReadiness['containerized-solutions'].percentage, 33);

      // Weighted average: ((1.0 * 0.275) + (0.33 * 0.225)) / 0.95 = 0.34925 / 0.95 = 0.3676 -> 36.8%
      assert.equal(readiness.overallPercentage, 36.8);
      assert.equal(readiness.examScaledScore, 368);
      assert.equal(readiness.isPassing, false);
    });

    test('incorporates domain quiz history verification', () => {
      const state = createDefaultProgress();
      state.conceptProgress['c-cosmos'] = { state: 'mastered' }; // concept = 1.0
      state.quizHistory.push({
        domainScores: {
          'data-management': { total: 10, correct: 8 } // quiz accuracy = 0.8
        }
      });

      const readiness = calculateReadiness(state, mockBlueprint);
      // Blended: 0.6 * 1.0 + 0.4 * 0.8 = 0.6 + 0.32 = 0.92 -> 92%
      assert.equal(readiness.domainReadiness['data-management'].percentage, 92);
    });
  });

  describe('mergeProgress conflict resolution', () => {
    test('progression lattice: higher progression rank always wins over timestamp', () => {
      const local = createDefaultProgress();
      local.conceptProgress['c1'] = { state: 'mastered', lastModified: '2026-11-01T10:00:00Z' };

      const remote = createDefaultProgress();
      remote.conceptProgress['c1'] = { state: 'studying', lastModified: '2026-11-03T10:00:00Z' };

      const merged = mergeProgress(local, remote);
      assert.equal(merged.conceptProgress['c1'].state, 'mastered');
    });

    test('equal progression rank: newer timestamp wins', () => {
      const local = createDefaultProgress();
      local.conceptProgress['c1'] = { state: 'studying', lastModified: '2026-11-01T10:00:00Z', note: 'old' };

      const remote = createDefaultProgress();
      remote.conceptProgress['c1'] = { state: 'studying', lastModified: '2026-11-03T10:00:00Z', note: 'new' };

      const merged = mergeProgress(local, remote);
      assert.equal(merged.conceptProgress['c1'].note, 'new');
    });

    test('union of quiz history de-duplicates by ID and sorts descending', () => {
      const local = createDefaultProgress();
      local.quizHistory.push({ id: 'att-1', timestamp: '2026-11-01T10:00:00Z', percentage: 80 });

      const remote = createDefaultProgress();
      remote.quizHistory.push({ id: 'att-2', timestamp: '2026-11-02T10:00:00Z', percentage: 90 });
      remote.quizHistory.push({ id: 'att-1', timestamp: '2026-11-01T10:00:00Z', percentage: 80 }); // duplicate

      const merged = mergeProgress(local, remote);
      assert.equal(merged.quizHistory.length, 2);
      assert.equal(merged.quizHistory[0].id, 'att-2');
      assert.equal(merged.quizHistory[1].id, 'att-1');
    });

    test('error notebook merge combines failCount and keeps flags', () => {
      const local = createDefaultProgress();
      local.errorNotebook['q1'] = { failCount: 1, flagged: false, lastModified: '2026-11-01T10:00:00Z' };

      const remote = createDefaultProgress();
      remote.errorNotebook['q1'] = { failCount: 4, flagged: true, lastModified: '2026-11-02T10:00:00Z' };

      const merged = mergeProgress(local, remote);
      assert.equal(merged.errorNotebook['q1'].failCount, 4);
      assert.equal(merged.errorNotebook['q1'].flagged, true);
    });

    test('scalar settings: highest lastModified wins', () => {
      const local = createDefaultProgress();
      local.settings = {
        preferredLanguage: 'python',
        theme: 'dark',
        lastModified: '2026-11-01T10:00:00Z'
      };

      const remote = createDefaultProgress();
      remote.settings = {
        preferredLanguage: 'csharp',
        theme: 'light',
        lastModified: '2026-11-03T10:00:00Z'
      };

      const merged = mergeProgress(local, remote);
      assert.equal(merged.settings.preferredLanguage, 'csharp');
      assert.equal(merged.settings.theme, 'light');
    });
  });

  describe('exportProgressJson and importProgressJson', () => {
    test('exports formatted JSON string', () => {
      const state = createDefaultProgress();
      state.conceptProgress['c1'] = { state: 'mastered' };
      const str = exportProgressJson(state);
      assert.equal(typeof str, 'string');
      assert.ok(str.includes('"schemaVersion": 1'));
    });

    test('imports valid JSON and optionally merges with current state', () => {
      const current = createDefaultProgress();
      current.conceptProgress['c1'] = { state: 'studying' };

      const incoming = createDefaultProgress();
      incoming.conceptProgress['c1'] = { state: 'mastered' };
      const incomingJson = exportProgressJson(incoming);

      const merged = importProgressJson(incomingJson, current);
      assert.equal(merged.conceptProgress['c1'].state, 'mastered');
    });

    test('throws error on corrupted JSON or invalid schema', () => {
      assert.throws(() => importProgressJson('{ bad json'), /Failed to parse/);
      assert.throws(() => importProgressJson('{"schemaVersion": 99}'), /Invalid progress schema/);
    });
  });
});

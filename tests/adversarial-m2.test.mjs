/**
 * tests/adversarial-m2.test.mjs
 * Adversarial challenger stress-test harness for Milestone 2 deliverables:
 * - Finding F-01 CSP & Safe HTML regression testing across dist/
 * - Service Worker & PWA manifest specification & asset audit
 * - AudioPlayer, silent WAV keep-alive, Media Session API & chunkNarrationText stress-testing
 * - Pure ES Core Engines resilience (quiz-core, progress-core)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chunkNarrationText, AudioPlayer } from '../web/audio-player.js';
import {
  evaluateSingleChoice,
  evaluateMultipleChoice,
  evaluateCodeCompletion,
  evaluateOrdering,
  evaluateCaseStudy,
  calculateQuizScore,
  filterQuestions
} from '../web/quiz-core.js';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  OFFICIAL_DOMAIN_WEIGHTS,
  PROGRESSION_RANKS,
  validateProgressSchema,
  calculateReadiness,
  mergeProgress,
  createDefaultProgress
} from '../web/progress-core.js';

const ROOT_DIR = resolve(process.cwd());

/**
 * Helper: Recursively gathers all files from a directory
 */
function getAllFiles(dir) {
  let results = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// =========================================================================
// 1. Finding F-01 & HTML Security Verification
// =========================================================================
describe('Finding F-01 Regression & HTML Security Scan (dist/)', () => {
  const distDir = join(ROOT_DIR, 'dist');
  const allDistFiles = getAllFiles(distDir);
  const htmlFiles = allDistFiles.filter(f => f.endsWith('.html'));

  test('dist/ contains pre-rendered HTML files', () => {
    assert.ok(htmlFiles.length >= 4, `Expected at least 4 HTML files in dist, found ${htmlFiles.length}`);
  });

  test('F-01: Zero <script> tags without src attribute across ALL HTML files in dist/', () => {
    const inlineScriptRegex = /<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi;
    const violations = [];

    for (const filePath of htmlFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.match(inlineScriptRegex);
      if (matches) {
        violations.push({ filePath, matches });
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found inline <script> tags without src in dist: ${JSON.stringify(violations, null, 2)}`
    );
  });

  test('F-01: No <script id="page-metadata"> in dist/ (must use <template id="page-metadata">)', () => {
    for (const filePath of htmlFiles) {
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        !content.includes('<script id="page-metadata"'),
        `Forbidden <script id="page-metadata"> found in ${filePath}`
      );
      assert.ok(
        content.includes('<template id="page-metadata">'),
        `Missing compliant <template id="page-metadata"> in ${filePath}`
      );
    }
  });

  test('Zero inline event handlers (on*) in dist/ HTML files', () => {
    const onHandlerRegex = /<[^>]+\bon[a-z]+\s*=[^>]*>/gi;
    const violations = [];

    for (const filePath of htmlFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.match(onHandlerRegex);
      if (matches) {
        violations.push({ filePath, matches });
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found inline event handlers in dist: ${JSON.stringify(violations, null, 2)}`
    );
  });

  test('Zero javascript: or vbscript: pseudo-protocol links in dist/ HTML files', () => {
    const dangerousProtoRegex = /(?:href|src)\s*=\s*['"]?\s*(?:javascript|vbscript):/gi;
    const violations = [];

    for (const filePath of htmlFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.match(dangerousProtoRegex);
      if (matches) {
        violations.push({ filePath, matches });
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found dangerous pseudo-protocols in dist: ${JSON.stringify(violations, null, 2)}`
    );
  });
});

// =========================================================================
// 2. Service Worker & PWA Manifest Stress-Testing
// =========================================================================
describe('Service Worker & PWA Manifest Conformance (web/sw.js & web/manifest.webmanifest)', () => {
  const manifestPath = join(ROOT_DIR, 'web', 'manifest.webmanifest');
  const swPath = join(ROOT_DIR, 'web', 'sw.js');

  test('manifest: valid JSON and satisfies PWA installability requirements', () => {
    assert.ok(existsSync(manifestPath), 'manifest.webmanifest must exist');
    const raw = readFileSync(manifestPath, 'utf-8');
    const m = JSON.parse(raw);

    assert.equal(m.name, 'Azure AI-200 Study Hub');
    assert.equal(m.short_name, 'AI-200');
    assert.equal(m.start_url, './index.html');
    assert.equal(m.scope, './');
    assert.equal(m.display, 'standalone');
    assert.equal(m.lang, 'pt-BR');
    assert.equal(m.dir, 'ltr');
    assert.ok(Array.isArray(m.icons) && m.icons.length >= 2, 'Manifest must declare at least 2 icons');

    const sizes = m.icons.map(i => i.sizes);
    assert.ok(sizes.includes('192x192'), 'Must include 192x192 icon');
    assert.ok(sizes.includes('512x512'), 'Must include 512x512 icon');
  });

  test('sw.js: cache versioning, routing strategies, and network bypass rules', () => {
    assert.ok(existsSync(swPath), 'web/sw.js must exist');
    const code = readFileSync(swPath, 'utf-8');

    assert.match(code, /const CACHE_NAME = 'azure-ai-200-cache-v\d+';/, 'Must use versioned cache key');

    const expectedModules = [
      './',
      './index.html',
      './styles.css',
      './app.js',
      './reader.js',
      './audio-player.js',
      './quiz-core.js',
      './progress-core.js',
      './cram.js',
      './simulator.js',
      './mastery.js',
      './manifest.webmanifest'
    ];
    for (const mod of expectedModules) {
      assert.ok(code.includes(`'${mod}'`), `sw.js precache must include ${mod}`);
    }

    assert.ok(code.includes("request.method !== 'GET'"), 'sw.js must bypass non-GET requests');
    assert.ok(code.includes("api.github.com"), 'sw.js must bypass api.github.com');
    assert.ok(code.includes("/gists"), 'sw.js must bypass /gists');
    assert.ok(code.includes('networkFirstHtml'), 'sw.js must define networkFirstHtml');
    assert.ok(code.includes('503'), 'sw.js networkFirstHtml must return 503 response if cache miss while offline');
    assert.ok(code.includes('staleWhileRevalidate'), 'sw.js must define staleWhileRevalidate');
  });

  test('Finding F-02 regression: every precached asset and manifest icon exists in dist/', () => {
    const swCode = readFileSync(swPath, 'utf-8');
    const precacheMatch = swCode.match(/const PRECACHE_ASSETS = \[([\s\S]*?)\];/);
    assert.ok(precacheMatch, 'PRECACHE_ASSETS array must be present');

    const assets = precacheMatch[1]
      .split(',')
      .map(s => s.trim().replace(/['"]/g, ''))
      .filter(Boolean);

    const distDir = join(ROOT_DIR, 'dist');
    const missingAssets = [];

    for (const asset of assets) {
      const clean = asset.replace(/^\.\//, '');
      const target = clean === '' ? join(distDir, 'index.html') : join(distDir, clean);
      if (!existsSync(target)) {
        missingAssets.push({ asset, target });
      }
    }

    // A deployment must not ship dangling asset URLs.
    assert.deepEqual(missingAssets, [], 'All precache assets must exist in the built site');

    // Audit manifest icon files on disk
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const missingIcons = manifest.icons.filter(i => !existsSync(join(distDir, i.src.replace(/^\.\//, ''))));
    assert.deepEqual(missingIcons, [], 'All manifest icons must be present in the built site');
  });
});

// =========================================================================
// 3. AudioPlayer & Narration Chunking Stress-Testing
// =========================================================================
describe('AudioPlayer & Narration Chunking Stress-Testing', () => {
  test('SILENT_WAV_DATA_URI: verifies binary RIFF WAVE audio header', () => {
    const SILENT_WAV_DATA_URI =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';

    assert.ok(SILENT_WAV_DATA_URI.startsWith('data:audio/wav;base64,'));
    const base64Payload = SILENT_WAV_DATA_URI.split(',')[1];
    const buffer = Buffer.from(base64Payload, 'base64');

    assert.equal(buffer.toString('ascii', 0, 4), 'RIFF');
    assert.equal(buffer.toString('ascii', 8, 12), 'WAVE');
    assert.equal(buffer.toString('ascii', 12, 16), 'fmt ');
    assert.equal(buffer.readUInt32LE(16), 16);
    assert.equal(buffer.readUInt16LE(20), 1);
    assert.equal(buffer.readUInt16LE(22), 1);
    assert.equal(buffer.readUInt32LE(24), 44100);
    assert.equal(buffer.readUInt16LE(34), 16);
    assert.equal(buffer.toString('ascii', 36, 40), 'data');
    assert.equal(buffer.readUInt32LE(40), 4);
  });

  test('AudioPlayer: constructor options, speed clamping, and continuous mode', () => {
    const player = new AudioPlayer({ defaultSpeed: 1.25 });
    assert.equal(player.playbackRate, 1.25);
    assert.equal(player.continuousMode, true);

    player.setPlaybackRate(0.1);
    assert.equal(player.playbackRate, 0.75);

    player.setPlaybackRate(5.0);
    assert.equal(player.playbackRate, 2.0);

    player.setPlaybackRate('invalid');
    assert.equal(player.playbackRate, 1.0);
  });

  test('AudioPlayer: empty playlist and single track bounds safety', () => {
    const player = new AudioPlayer();
    player.setPlaylist([]);
    assert.equal(player.playlist.length, 0);
    assert.equal(player.currentTrack, null);

    player.next();
    assert.equal(player.state, 'idle');
    player.prev();
    assert.equal(player.state, 'idle');

    player.setPlaylist([{ slug: 'single-track', title: 'Single' }]);
    assert.equal(player.playlist.length, 1);
    assert.equal(player.currentTrack.slug, 'single-track');
    player.next();
    assert.equal(player.state, 'idle');
  });

  describe('chunkNarrationText: adversarial stress tests & empirical bug reproduction', () => {
    test('handles empty, null, undefined, and non-string inputs safely', () => {
      assert.deepEqual(chunkNarrationText(''), []);
      assert.deepEqual(chunkNarrationText(null), []);
      assert.deepEqual(chunkNarrationText(undefined), []);
      assert.deepEqual(chunkNarrationText(12345), []);
      assert.deepEqual(chunkNarrationText({}), []);
    });

    test('Fix B-02 verified: whitespace-only returns [] consistent with empty string', () => {
      const res = chunkNarrationText('     \n\t  ');
      assert.deepEqual(
        res,
        [],
        'Hardened chunkNarrationText returns [] for whitespace-only strings'
      );
    });

    test('preserves Unicode accents and emojis without corrupting surrogate pairs', () => {
      const emojiText = '🚀 O Azure Cosmos DB suporta índices vetoriais. 🧠 Modelos de IA utilizam embeddings. 🇧🇷 Disponível na região Brazil South.';
      const chunks = chunkNarrationText(emojiText, 60);
      assert.ok(chunks.length >= 2);
      for (const chunk of chunks) {
        assert.ok(chunk.length <= 70);
      }
      assert.ok(chunks.some(c => c.includes('🚀')));
      assert.ok(chunks.some(c => c.includes('🧠')));
      assert.ok(chunks.some(c => c.includes('🇧🇷')));
    });

    test('Fix B-01 verified: retains trailing sentence even if missing terminating punctuation when text > maxChars', () => {
      // Total text length = 98 chars. Set maxChars = 50.
      const sentence1 = 'O Azure Cosmos DB for NoSQL oferece busca vetorial nativa.';
      const sentence2 = 'O índice diskANN é recomendado para alta escala sem ponto';
      const text = `${sentence1} ${sentence2}`;

      const chunks = chunkNarrationText(text, 50);

      // Sentence 2 must be retained and not dropped
      const containsSentence2 = chunks.some(c => c.includes('diskANN'));
      assert.equal(
        containsSentence2,
        true,
        'Hardened chunkNarrationText retained trailing sentence without terminal punctuation'
      );
      assert.ok(chunks.length >= 2, `Expected at least 2 chunks, got ${chunks.length}`);
    });

    test('Fix B-03 verified: unpunctuated text exceeding maxChars falls back to whitespace splitting', () => {
      // 100 words without any punctuation
      const unpunctuated = 'palavra '.repeat(100).trim(); // 799 chars
      const chunks = chunkNarrationText(unpunctuated, 100);

      assert.ok(chunks.length > 1, `Expected multiple chunks via whitespace fallback, got ${chunks.length}`);
      for (const c of chunks) {
        assert.ok(c.length <= 100, `Chunk length ${c.length} exceeds maxChars 100`);
      }
    });

    test('stress test: 5,000 character technical document executes in under 20ms', () => {
      const paragraph = 'O particionamento lógico no Cosmos DB distribui os dados por hash da Partition Key. Cada partição lógica tem limite estrito de 20 GB. Para cargas analíticas, utilize o Synapse Link com Azure Cosmos DB Analytical Store sem consumir RUs operacionais. ';
      const largeDoc = paragraph.repeat(20);

      const t0 = performance.now();
      const chunks = chunkNarrationText(largeDoc, 160);
      const elapsed = performance.now() - t0;

      assert.ok(elapsed < 20, `Execution took ${elapsed.toFixed(2)}ms (expected < 20ms)`);
      assert.ok(chunks.length >= 20, `Expected at least 20 chunks, got ${chunks.length}`);
    });
  });
});

// =========================================================================
// 4. Pure Core Engines (quiz-core.js & progress-core.js) Stress-Testing
// =========================================================================
describe('Pure Core Engines Stress-Testing (quiz-core & progress-core)', () => {
  describe('quiz-core: malformed and boundary inputs', () => {
    test('evaluateSingleChoice: handles negative indices, out of bounds, and non-array options', () => {
      const q = { id: 'q1', type: 'single-choice', options: [{ text: 'A', correct: true }] };

      const resNeg = evaluateSingleChoice(q, -1);
      assert.equal(resNeg.isCorrect, false);
      assert.equal(resNeg.score, 0);

      const resOob = evaluateSingleChoice(q, 999);
      assert.equal(resOob.isCorrect, false);

      const resNullOptions = evaluateSingleChoice({ id: 'q2', type: 'single-choice', options: null }, 0);
      assert.equal(resNullOptions.isCorrect, false);
    });

    test('evaluateMultipleChoice: handles empty selections and mismatched select_count', () => {
      const q = {
        id: 'q-multi',
        type: 'multiple-choice',
        select_count: 2,
        options: [
          { text: 'Opt 1', correct: true },
          { text: 'Opt 2', correct: true },
          { text: 'Opt 3', correct: false }
        ]
      };

      const resEmpty = evaluateMultipleChoice(q, []);
      assert.equal(resEmpty.isCorrect, false);
      assert.equal(resEmpty.score, 0);

      const resThree = evaluateMultipleChoice(q, [0, 1, 2]);
      assert.equal(resThree.isCorrect, false);
    });

    test('evaluateCodeCompletion: handles null answers and missing slots with partialScore in details', () => {
      const q = {
        id: 'q-code',
        type: 'code-completion',
        slots: [
          { id: 's1', options: [{ text: 'A', correct: true }, { text: 'B', correct: false }] },
          { id: 's2', options: [{ text: 'C', correct: false }, { text: 'D', correct: true }] }
        ]
      };

      const resNull = evaluateCodeCompletion(q, null);
      assert.equal(resNull.isCorrect, false);
      assert.equal(resNull.score, 0);

      // Only slot s1 answered correctly (index 0)
      const resPartial = evaluateCodeCompletion(q, { s1: 0 });
      assert.equal(resPartial.isCorrect, false);
      assert.equal(resPartial.score, 0); // Strict score is 0 unless all slots are correct
      assert.equal(resPartial.details.partialScore, 0.5); // Partial credit reported in details
    });

    test('calculateQuizScore: survives empty and corrupted questions array', () => {
      const res = calculateQuizScore([], {});
      assert.equal(res.total, 0);
      assert.equal(res.correct, 0);
      assert.equal(res.percentage, 0);

      const resNull = calculateQuizScore(null, null);
      assert.equal(resNull.total, 0);
    });
  });

  describe('progress-core: schema corruption and CRDT monotonic progression', () => {
    test('validateProgressSchema: rejects corrupted objects and non-version-1', () => {
      assert.equal(validateProgressSchema(null).valid, false);
      assert.equal(validateProgressSchema('not-an-object').valid, false);
      assert.equal(validateProgressSchema({ schemaVersion: 99 }).valid, false);
      assert.equal(validateProgressSchema({ schemaVersion: 1, conceptProgress: 'bad' }).valid, false);
    });

    test('CRDT monotonic progression: mastered concept CANNOT be downgraded by stale or future timestamps', () => {
      const baseState = createDefaultProgress();
      baseState.conceptProgress['cosmos-db-partitioning'] = {
        state: 'mastered',
        lastModified: '2026-01-01T00:00:00.000Z'
      };

      // Remote attempts to overwrite with 'studying' using a FUTURE timestamp (2099)
      const attackerRemoteState = createDefaultProgress();
      attackerRemoteState.conceptProgress['cosmos-db-partitioning'] = {
        state: 'studying',
        lastModified: '2099-12-31T23:59:59.999Z'
      };

      const merged = mergeProgress(baseState, attackerRemoteState);

      // Monotonic lattice guarantee: rank('mastered') = 3 > rank('studying') = 1
      assert.equal(
        merged.conceptProgress['cosmos-db-partitioning'].state,
        'mastered',
        'LATTICE INVARIANT PRESERVED: Mastered state was not demoted by future studying state'
      );
    });

    test('readiness calculation: handles empty blueprint gracefully', () => {
      const state = createDefaultProgress();
      const emptyBlueprint = { chapters: [] };
      const readiness = calculateReadiness(state, emptyBlueprint);
      assert.equal(readiness.overallScore, 0);
      assert.equal(readiness.isPassing, false);
    });
  });
});

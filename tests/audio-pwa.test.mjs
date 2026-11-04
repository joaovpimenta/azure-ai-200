/**
 * tests/audio-pwa.test.mjs
 * Unit test suite for Audio Player, PWA Manifest, Service Worker, and Finding F-01.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chunkNarrationText, AudioPlayer } from '../web/audio-player.js';
import { renderHtmlShell } from '../scripts/build-site.mjs';

const ROOT_DIR = resolve(process.cwd());

describe('Audio Player & Narration Chunking (web/audio-player.js)', () => {
  test('chunkNarrationText: splits long sentences on punctuation boundaries', () => {
    const longText = 'O Azure Cosmos DB for NoSQL oferece suporte a busca vetorial nativa. O índice diskANN é recomendado para alta escala com baixa latência. A função VectorDistance calcula a similaridade entre vetores na consulta SQL.';
    const chunks = chunkNarrationText(longText, 90);
    assert.ok(chunks.length >= 2, `Expected multiple chunks, got ${chunks.length}`);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 110, `Chunk exceeds reasonable limit: ${chunk.length} chars`);
    }
  });

  test('chunkNarrationText: handles empty, single-word, and short inputs', () => {
    assert.deepEqual(chunkNarrationText(''), []);
    assert.deepEqual(chunkNarrationText(null), []);
    assert.deepEqual(chunkNarrationText('Conceito curto.'), ['Conceito curto.']);
  });

  test('AudioPlayer: playlist navigation and track bounds clamping', () => {
    const player = new AudioPlayer();
    const mockTracks = [
      { slug: 'concept-1', title: 'Conceito 1', chapter: '04-cosmos-db' },
      { slug: 'concept-2', title: 'Conceito 2', chapter: '04-cosmos-db' },
      { slug: 'concept-3', title: 'Conceito 3', chapter: '04-cosmos-db' }
    ];

    player.setPlaylist(mockTracks, 0);
    assert.equal(player.playlist.length, 3);
    assert.equal(player.currentIndex, 0);
    assert.equal(player.currentTrack.slug, 'concept-1');

    player.next();
    assert.equal(player.currentIndex, 1);
    assert.equal(player.currentTrack.slug, 'concept-2');

    player.next();
    assert.equal(player.currentIndex, 2);
    assert.equal(player.currentTrack.slug, 'concept-3');

    // Bounds checking
    player.setPlaybackRate(3.5); // Should clamp to 2.0
    assert.equal(player.playbackRate, 2.0);

    player.setPlaybackRate(0.2); // Should clamp to 0.75
    assert.equal(player.playbackRate, 0.75);
  });
});

describe('PWA Manifest Specification (web/manifest.webmanifest)', () => {
  const manifestPath = join(ROOT_DIR, 'web', 'manifest.webmanifest');

  test('manifest exists and is valid JSON', () => {
    assert.ok(existsSync(manifestPath), 'manifest.webmanifest must exist');
    const raw = readFileSync(manifestPath, 'utf-8');
    const json = JSON.parse(raw);
    assert.ok(json, 'Must parse as JSON');
  });

  test('manifest contains required PWA fields and relative paths', () => {
    const json = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.equal(json.name, 'Azure AI-200 Study Hub');
    assert.equal(json.short_name, 'AI-200');
    assert.equal(json.display, 'standalone');
    assert.equal(json.start_url, './index.html');
    assert.equal(json.scope, './');
    assert.equal(json.theme_color, '#277d69');
    assert.equal(json.background_color, '#f8f6f0');
    assert.ok(Array.isArray(json.icons) && json.icons.length > 0, 'Must declare icons');
  });
});

describe('Service Worker Strategy (web/sw.js)', () => {
  const swPath = join(ROOT_DIR, 'web', 'sw.js');

  test('sw.js declares versioned cache and precache assets', () => {
    assert.ok(existsSync(swPath), 'web/sw.js must exist');
    const code = readFileSync(swPath, 'utf-8');
    assert.match(code, /azure-ai-200-cache-v\d+/, 'Must use a versioned cache key');
    assert.ok(code.includes('PRECACHE_ASSETS'), 'Must define precache assets');
    assert.ok(code.includes('staleWhileRevalidate'), 'Must define Stale-While-Revalidate strategy');
    assert.ok(code.includes('networkFirstHtml'), 'Must define Network-First HTML strategy');
    assert.ok(code.includes('api.github.com'), 'Must bypass cache for GitHub API calls');
  });
});

describe('Security Gate Finding F-01 Verification', () => {
  test('renderHtmlShell outputs <template id="page-metadata"> and ZERO inline scripts without src', () => {
    const html = renderHtmlShell({
      title: 'Cosmos DB Indexing',
      description: 'Understanding RUs',
      content: '<article>Content</article>',
      rootRel: '../../',
      currentRoute: 'chapter/04/concept',
      metadata: { slug: 'cosmos-db-indexing', tldr: 'RUs & Partitioning' }
    });

    // 1. Must contain <template id="page-metadata">
    assert.ok(html.includes('<template id="page-metadata">'), 'Must use <template id="page-metadata">');

    // 2. Must NOT contain <script id="page-metadata">
    assert.ok(!html.includes('<script id="page-metadata"'), 'Must NOT use <script id="page-metadata">');

    // 3. Any <script> tag must have a src attribute
    const scriptMatches = [...html.matchAll(/<script\b([^>]*)>/gi)];
    for (const match of scriptMatches) {
      const attrs = match[1];
      assert.ok(/\bsrc\s*=/i.test(attrs), `Found <script> tag without src attribute: ${match[0]}`);
    }
  });
});

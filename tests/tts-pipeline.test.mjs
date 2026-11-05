import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('audio verification rejects a prepared plan without a synthesized MP3', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai200-tts-'));
  try {
    const catalog = join(dir, 'catalog.json');
    writeFileSync(catalog, JSON.stringify([{ slug: 'exemplo', title: 'Exemplo', narrationText: 'Texto para ouvir.' }]));
    const run = command => spawnSync('python', ['tools/tts/kokoro_release.py', command,
      '--catalog', catalog, '--output-dir', dir], { encoding: 'utf8' });
    assert.equal(run('prepare').status, 0);
    const result = run('verify');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing synthesized audio/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

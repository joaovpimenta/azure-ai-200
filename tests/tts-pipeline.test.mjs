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

test('parallel synthesis partitions the entire catalog exactly once, including comparisons', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai200-tts-shards-'));
  try {
    const catalog = join(dir, 'catalog.json');
    const slugs = ['primeiro', 'segundo', 'terceiro', 'quarto', 'vector-stores-azure'];
    writeFileSync(catalog, JSON.stringify(slugs.map(slug => ({ slug, narrationText: 'Texto.' }))));
    const result = spawnSync('python', ['-c', `
import sys, json
from types import SimpleNamespace
sys.path.insert(0, 'tools/tts')
from kokoro_release import selected_entries
args = SimpleNamespace(catalog=sys.argv[1], slug='all', shard_count=3, shard_index=0)
groups = []
for index in range(3):
    args.shard_index = index
    groups.append([e['slug'] for e in selected_entries(args)])
args.slug = 'vector-stores-azure'
args.shard_count = 1
args.shard_index = 0
assert [e['slug'] for e in selected_entries(args)] == ['vector-stores-azure']
args.shard_index = 1
try:
    selected_entries(args)
    raise AssertionError('Invalid shard accepted')
except ValueError:
    pass
print(json.dumps(groups))
`, catalog], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const groups = JSON.parse(result.stdout);
    assert.deepEqual(groups.map(group => group.length), [2, 2, 1]);
    assert.deepEqual(groups.flat().sort(), [...slugs].sort());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

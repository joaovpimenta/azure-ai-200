/**
 * tests/workflows-m4.test.mjs
 * Milestone 4 verification: GitHub Actions workflows (validate.yml, pages.yml, kokoro-audio.yml),
 * Kokoro narration preparation script (tools/tts/kokoro_release.py), and root README.md.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import YAML from 'yaml';

const ROOT_DIR = resolve(process.cwd());
const WORKFLOWS_DIR = join(ROOT_DIR, '.github', 'workflows');

describe('Milestone 4: CI/CD Workflows & Decoupled Audio Pipeline', () => {
  test('validate.yml exists, is valid YAML, and runs doctor, validate, build, and test', () => {
    const filePath = join(WORKFLOWS_DIR, 'validate.yml');
    assert.ok(existsSync(filePath), 'Missing .github/workflows/validate.yml');

    const raw = readFileSync(filePath, 'utf-8');
    const doc = YAML.parse(raw);
    assert.ok(doc.on?.pull_request, 'validate.yml must trigger on pull_request');
    assert.ok(doc.on?.push, 'validate.yml must trigger on push');

    const steps = doc.jobs?.validate?.steps || [];
    const runCmds = steps.map(s => s.run || '').join('\n');
    assert.ok(runCmds.includes('npm ci'), 'validate.yml must run npm ci');
    assert.ok(runCmds.includes('npm run validate'), 'validate.yml must run npm run validate');
    assert.ok(runCmds.includes('npm run build'), 'validate.yml must run npm run build');
    assert.ok(runCmds.includes('npm test'), 'validate.yml must run npm test');
  });

  test('pages.yml exists, uses upload-pages-artifact@v3 and deploy-pages@v4, and validates before deploy', () => {
    const filePath = join(WORKFLOWS_DIR, 'pages.yml');
    assert.ok(existsSync(filePath), 'Missing .github/workflows/pages.yml');

    const raw = readFileSync(filePath, 'utf-8');
    const doc = YAML.parse(raw);
    assert.ok(doc.on?.push?.branches?.includes('main'), 'pages.yml must trigger on push to main');
    assert.ok('workflow_dispatch' in (doc.on || {}), 'pages.yml must support workflow_dispatch');

    const buildJob = doc.jobs?.['validate-and-build'];
    assert.ok(buildJob, 'pages.yml must define validate-and-build job');
    const usesList = (buildJob.steps || []).map(s => s.uses || '');
    assert.ok(
      usesList.some(u => u.startsWith('actions/upload-pages-artifact@v3')),
      'pages.yml must use actions/upload-pages-artifact@v3'
    );

    const deployJob = doc.jobs?.deploy;
    assert.ok(deployJob, 'pages.yml must define deploy job');
    assert.equal(deployJob.permissions?.pages, 'write', 'deploy job requires pages: write permission');
    assert.equal(deployJob.permissions?.['id-token'], 'write', 'deploy job requires id-token: write permission');
    const deployUses = (deployJob.steps || []).map(s => s.uses || '');
    assert.ok(
      deployUses.some(u => u.startsWith('actions/deploy-pages@v4')),
      'pages.yml must use actions/deploy-pages@v4'
    );
  });

  test('Kokoro generates real audio on PRs and Pages requires it before uploading', () => {
    const filePath = join(WORKFLOWS_DIR, 'kokoro-audio.yml');
    assert.ok(existsSync(filePath), 'Missing .github/workflows/kokoro-audio.yml');

    const raw = readFileSync(filePath, 'utf-8');
    const doc = YAML.parse(raw);
    assert.ok(doc.on?.workflow_dispatch, 'kokoro-audio.yml must trigger via workflow_dispatch');
    assert.ok(!doc.on?.push, 'Pages calls this workflow on push; avoid duplicate synthesis runs');
    assert.ok(doc.on?.pull_request);
    assert.ok(doc.on?.workflow_call);
    assert.equal(doc.on.workflow_call.inputs.slug.default, 'all');
    const commands = doc.jobs.synthesize.steps.map(step => step.run || '').join('\n');
    assert.match(commands, /kokoro_release.py synthesize/);
    assert.match(commands, /kokoro_release.py verify/);
    const assemble = doc.jobs.assemble;
    assert.equal(assemble.needs, 'synthesize');
    assert.ok(assemble.steps.some(step => step.uses?.startsWith('actions/download-artifact@') && step.with['merge-multiple']));
    const finalVerify = assemble.steps.find(step => step.run?.includes('kokoro_release.py verify'));
    assert.ok(finalVerify);
    assert.doesNotMatch(finalVerify.run, /--shard-/, 'Final verification must cover the whole requested catalog');
    assert.ok(assemble.steps.some(step => step.uses?.startsWith('actions/upload-artifact@') && step.with.name === 'narration-audio'));
    const pages = YAML.parse(readFileSync(join(WORKFLOWS_DIR, 'pages.yml'), 'utf8'));
    assert.equal(pages.jobs['generate-audio'].uses, './.github/workflows/kokoro-audio.yml');
    const build = pages.jobs['validate-and-build'];
    assert.equal(build.needs, 'generate-audio');
    const steps = build.steps;
    const download = steps.findIndex(step => step.uses?.startsWith('actions/download-artifact@'));
    const verify = steps.findIndex(step => step.run?.includes('kokoro_release.py verify'));
    const upload = steps.findIndex(step => step.uses?.startsWith('actions/upload-pages-artifact@'));
    assert.ok(download > steps.findIndex(step => step.run === 'npm test'), 'Tests rebuild dist; audio must be downloaded afterwards');
    assert.equal(steps[download].with.path, 'dist/audio');
    assert.ok(download < verify && verify < upload, 'Coverage verification must gate publication');
    assert.equal(
      doc.on.workflow_dispatch.inputs?.voice?.default,
      'pf_dora',
      'Default Kokoro voice must be pf_dora'
    );
  });

  test('tools/tts/kokoro_release.py prepares sentence chapters (schema v2) from dist/data/catalog.json', () => {
    const scriptPath = join(ROOT_DIR, 'tools', 'tts', 'kokoro_release.py');
    assert.ok(existsSync(scriptPath), 'Missing tools/tts/kokoro_release.py');

    const outDir = join(ROOT_DIR, '.tmp', 'tts-test-output');
    rmSync(outDir, { recursive: true, force: true });

    const res = spawnSync(
      'python',
      [
        scriptPath,
        'prepare',
        '--catalog',
        join(ROOT_DIR, 'dist', 'data', 'catalog.json'),
        '--slug',
        'cosmos-db-busca-vetorial',
        '--output-dir',
        outDir
      ],
      { encoding: 'utf-8' }
    );

    assert.equal(res.status, 0, `kokoro_release.py failed: ${res.stderr}`);
    const chaptersFile = join(outDir, 'cosmos-db-busca-vetorial', 'chapters.json');
    assert.ok(existsSync(chaptersFile), 'chapters.json must be generated for target slug');

    const plan = JSON.parse(readFileSync(chaptersFile, 'utf-8'));
    assert.equal(plan.version, 2, 'chapters.json must use schema version 2');
    assert.equal(plan.voice, 'pf_dora', 'chapters.json must record pf_dora voice');
    assert.ok(Array.isArray(plan.chapters) && plan.chapters.length > 0, 'chapters array must be non-empty');

    rmSync(join(ROOT_DIR, '.tmp'), { recursive: true, force: true });
  });

  test('Root README.md documents all 9 chapters, pilot concepts, and CLI commands', () => {
    const readmePath = join(ROOT_DIR, 'README.md');
    assert.ok(existsSync(readmePath), 'Missing root README.md');
    const content = readFileSync(readmePath, 'utf-8');

    for (const ch of [
      '01-container-hosting',
      '02-container-apps',
      '03-aks',
      '04-cosmos-db-nosql',
      '05-postgresql-pgvector',
      '06-managed-redis',
      '07-backend-integration',
      '08-secrets-and-config',
      '09-observe-and-troubleshoot'
    ]) {
      assert.ok(content.includes(ch), `Root README.md must reference chapter ${ch}`);
    }

    assert.ok(content.includes('npm run validate'));
    assert.ok(content.includes('npm run build'));
    assert.ok(content.includes('npm test'));
  });
});

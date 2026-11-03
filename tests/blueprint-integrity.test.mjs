import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { validateBlueprint, validateBlueprintSlugs, loadCanonicalTaxonomy } from '../scripts/lib/schema-validator.mjs';

const ROOT_DIR = resolve(process.cwd());

describe('Blueprint & Taxonomy Integrity', () => {
  test('syllabus/ai-200-blueprint.json passes full blueprint validation', () => {
    const raw = readFileSync(join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json'), 'utf-8');
    const blueprint = JSON.parse(raw);
    const errors = validateBlueprint(blueprint);
    assert.deepEqual(errors, [], `Blueprint errors: ${errors.join(', ')}`);
  });

  test('all 35 concepts have pure ASCII kebab-case slugs', () => {
    const raw = readFileSync(join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json'), 'utf-8');
    const blueprint = JSON.parse(raw);
    const slugErrors = validateBlueprintSlugs(blueprint);
    assert.deepEqual(slugErrors, []);
    
    // Specifically test that the fixed slug is present
    const ch1 = blueprint.chapters.find(c => c.id === '01-container-hosting');
    const concept = ch1.concepts.find(c => c.slug === 'app-service-conteineres-configuracao');
    assert.ok(concept, 'Fixed slug app-service-conteineres-configuracao must exist in chapter 01');
  });

  test('generation/taxonomy/tags.json loads and contains at least 200 canonical tags', () => {
    const tags = loadCanonicalTaxonomy(join(ROOT_DIR, 'generation', 'taxonomy', 'tags.json'));
    assert.ok(tags.size >= 200, `Expected at least 200 tags, found ${tags.size}`);
    assert.ok(tags.has('cosmos-db'));
    assert.ok(tags.has('vector-search'));
    assert.ok(tags.has('diskann'));
    assert.ok(tags.has('pgvector'));
  });
});

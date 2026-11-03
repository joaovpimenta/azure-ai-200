/**
 * tests/adversarial-m3.test.mjs
 * Adversarial Challenger Stress-Test Harness for Milestone 3 Content & Toolchain:
 *
 * 1. Frontmatter Validation Stress-Testing (5 concepts + comparisons/vector-stores-azure.md)
 *    - Schema fuzzing (missing fields, invalid tags, malformed difficulties, unlisted exam domains)
 *    - Pilot content canonical conformance & file-slug parity
 * 2. Cloze Gap Syntax (==gap==) Edge Cases
 *    - Empty delimiters (====), whitespace blanks, nested clozes, multiline clozes
 *    - Security escaping within cloze text (XSS vectors, HTML tags, special characters)
 *    - Parser state desynchronization bug reproduction (B-01)
 * 3. <details> Self-Check Cards Edge Cases
 *    - Missing <summary>, empty <summary>, whitespace-only <summary>
 *    - Exception contracts in formatDetails() vs soft validation in validateDetails()
 * 4. Code Tabs Grouping & Synchronization
 *    - Normalization of language annotations (py, python, cs, c#, csharp)
 *    - Order invariance (Python then C# vs C# then Python)
 *    - Whitespace variations and preservation of separation when prose intervenes
 * 5. Security Sanitizer Adversarial Bypass Attempts
 *    - Mixed-case protocols (JaVaScRiPt:, VbScRiPt:, dAtA:TeXt/HtMl)
 *    - Base64 data:text/html pseudo-protocols
 *    - Inline event handlers (onload, onerror, onclick, ontoggle) across varied tags
 *    - Strict negative controls on safe technical markdown, mathematical symbols, code fences
 * 6. Link Integrity & Structural Validation
 *    - Pilot concepts (04-cosmos-db-nosql), comparisons, and chapter READMEs
 *    - External URL protocol validity, intra-document anchors, and relative file targets
 *    - Markdown image badge target link extraction bug reproduction (B-02)
 * 7. Question Bank Schema Fuzzing (5 formats)
 *    - single-choice, multiple-choice, code-completion, ordering, case-study
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

import {
  validateFrontmatter,
  validateTags,
  validateQuestion,
  validateQuestions,
  loadCanonicalTaxonomy,
  VALID_DOMAINS,
  VALID_DIFFICULTIES
} from '../scripts/lib/schema-validator.mjs';

import {
  clozeExtension,
  extractClozes,
  stripClozes,
  escapeHtml
} from '../scripts/lib/cloze.mjs';

import {
  validateDetails,
  formatDetails
} from '../scripts/lib/details.mjs';

import {
  normalizeLanguage,
  groupAdjacentCodeTabs,
  resetTabCounter
} from '../scripts/lib/code-tabs.mjs';

import {
  sanitizeCheck,
  sanitizeSafeHtml,
  createMarkdownCompiler,
  compileMarkdown
} from '../scripts/lib/markdown.mjs';

import {
  extractLinks,
  validateLink,
  validateLinks
} from '../scripts/lib/links.mjs';

import { extractFrontmatter } from '../scripts/lib/frontmatter.mjs';

const ROOT_DIR = resolve(process.cwd());
const TAXONOMY_PATH = join(ROOT_DIR, 'generation', 'taxonomy', 'tags.json');
const PILOT_DIR = join(ROOT_DIR, 'chapters', '04-cosmos-db-nosql');
const COMPARISONS_DIR = join(ROOT_DIR, 'comparisons');
const CHAPTERS_DIR = join(ROOT_DIR, 'chapters');

const canonicalTags = loadCanonicalTaxonomy(TAXONOMY_PATH);

// =========================================================================
// 1. Frontmatter Validation Stress-Testing & Pilot Conformance
// =========================================================================
describe('1. Frontmatter Validation & Schema Stress-Testing', () => {
  const pilotFiles = [
    'cosmos-db-modelo-de-recursos-e-particionamento.md',
    'cosmos-db-sdk-conexao-e-consultas.md',
    'cosmos-db-indexacao-consistencia-rus.md',
    'cosmos-db-busca-vetorial.md',
    'cosmos-db-change-feed-processor.md'
  ];

  test('All 5 pilot concept files exist and satisfy schema validation with canonical tags', () => {
    for (const file of pilotFiles) {
      const fullPath = join(PILOT_DIR, file);
      assert.ok(existsSync(fullPath), `Pilot file not found: ${fullPath}`);

      const raw = readFileSync(fullPath, 'utf-8');
      const { data } = extractFrontmatter(raw, fullPath);
      const expectedSlug = file.replace(/\.md$/, '');

      const res = validateFrontmatter(data, {
        expectedSlug,
        expectedChapter: '04-cosmos-db-nosql',
        canonicalTags,
        filePath: fullPath
      });

      assert.equal(res.valid, true, `Frontmatter validation failed for ${file}: ${res.join('; ')}`);
      assert.equal(data.slug, expectedSlug, `Slug mismatch in ${file}`);
      assert.equal(data.chapter, '04-cosmos-db-nosql', `Chapter mismatch in ${file}`);
      assert.ok(VALID_DOMAINS.includes(data.exam_domain), `Invalid domain in ${file}: ${data.exam_domain}`);
      assert.ok(VALID_DIFFICULTIES.includes(data.difficulty), `Invalid difficulty in ${file}: ${data.difficulty}`);
      assert.ok(data.tags.length >= 3, `Expected at least 3 tags in ${file}, found ${data.tags.length}`);
    }
  });

  test('comparisons/vector-stores-azure.md satisfies schema validation with canonical tags', () => {
    const compPath = join(COMPARISONS_DIR, 'vector-stores-azure.md');
    assert.ok(existsSync(compPath), `Comparison file not found: ${compPath}`);

    const raw = readFileSync(compPath, 'utf-8');
    const { data } = extractFrontmatter(raw, compPath);

    const res = validateFrontmatter(data, {
      expectedSlug: 'vector-stores-azure',
      expectedChapter: 'comparisons',
      canonicalTags,
      filePath: compPath
    });

    assert.equal(res.valid, true, `Frontmatter validation failed for vector-stores-azure.md: ${res.join('; ')}`);
    assert.equal(data.slug, 'vector-stores-azure');
    assert.equal(data.chapter, 'comparisons');
    assert.equal(data.exam_domain, 'data-management');
    assert.equal(data.difficulty, 'advanced');
  });

  describe('Adversarial Schema Fuzzing on validateFrontmatter()', () => {
    const baseValid = {
      title: 'Valid Concept Title',
      slug: 'valid-concept-slug',
      chapter: '04-cosmos-db-nosql',
      exam_domain: 'data-management',
      tags: ['cosmos-db', 'nosql', 'python'],
      difficulty: 'intermediate',
      tldr: 'Valid technical TLDR description.'
    };

    test('rejects non-object or null input', () => {
      assert.equal(validateFrontmatter(null).valid, false);
      assert.equal(validateFrontmatter(undefined).valid, false);
      assert.equal(validateFrontmatter('string-data').valid, false);
      assert.equal(validateFrontmatter([]).valid, false);
    });

    test('rejects missing or empty mandatory fields', () => {
      const fields = ['title', 'slug', 'chapter', 'exam_domain', 'tags', 'tldr'];
      for (const field of fields) {
        const mutated = { ...baseValid };
        delete mutated[field];
        const res = validateFrontmatter(mutated);
        assert.equal(res.valid, false, `Should reject missing field: ${field}`);
        assert.ok(res.some(e => e.includes(field)), `Error message must mention missing '${field}'`);
      }
    });

    test('rejects whitespace-only title or tldr', () => {
      const resTitle = validateFrontmatter({ ...baseValid, title: '   ' });
      assert.equal(resTitle.valid, false);
      assert.ok(resTitle.some(e => e.includes('title')));

      const resTldr = validateFrontmatter({ ...baseValid, tldr: '\t \n' });
      assert.equal(resTldr.valid, false);
      assert.ok(resTldr.some(e => e.includes('tldr')));
    });

    test('rejects malformed slugs: uppercase, accents, underscores, spaces, leading/trailing hyphens', () => {
      const malformedSlugs = [
        'Cosmos-DB-Concept',
        'cosmos_db_concept',
        'cosmos db concept',
        'app-service-contêineres',
        '-leading-hyphen',
        'trailing-hyphen-',
        'double--hyphen'
      ];

      for (const badSlug of malformedSlugs) {
        const res = validateFrontmatter({ ...baseValid, slug: badSlug });
        assert.equal(res.valid, false, `Should reject invalid slug: ${badSlug}`);
      }
    });

    test('rejects slug mismatch when expectedSlug option is supplied', () => {
      const res = validateFrontmatter(baseValid, { expectedSlug: 'different-expected-slug' });
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('does not match expected')));
    });

    test('rejects chapter mismatch when expectedChapter option is supplied', () => {
      const res = validateFrontmatter(baseValid, { expectedChapter: '01-container-hosting' });
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('does not match directory')));
    });

    test('rejects unlisted or fabricated exam_domains', () => {
      const badDomains = [
        'data',
        'security',
        'ai-200',
        'machine-learning',
        'containerized_solutions',
        'DATA-MANAGEMENT'
      ];

      for (const badDomain of badDomains) {
        const res = validateFrontmatter({ ...baseValid, exam_domain: badDomain });
        assert.equal(res.valid, false, `Should reject unknown domain: ${badDomain}`);
        assert.ok(res.some(e => e.includes("Invalid 'exam_domain'")));
      }
    });

    test('rejects non-canonical string difficulty levels', () => {
      const badDifficulties = ['easy', 'hard', 'beginner', 'expert', 'basic', 'unknown'];
      for (const badDiff of badDifficulties) {
        const res = validateFrontmatter({ ...baseValid, difficulty: badDiff });
        assert.equal(res.valid, false, `Should reject invalid difficulty: ${badDiff}`);
      }
    });

    test('B-03 Reproduction: falsy non-undefined difficulty values (null, empty string) bypass validation', () => {
      // Demonstrates B-03 weakness: 'if (data.difficulty)' evaluates to false for falsy values, allowing null and "" to slip through
      const resNull = validateFrontmatter({ ...baseValid, difficulty: null });
      assert.equal(resNull.valid, false, 'Bug B-03: Frontmatter with difficulty: null must be flagged as invalid');

      const resEmpty = validateFrontmatter({ ...baseValid, difficulty: '' });
      assert.equal(resEmpty.valid, false, 'Bug B-03: Frontmatter with difficulty: "" must be flagged as invalid');
    });

    test('rejects empty, non-array, or unregistered tags when canonicalTags provided', () => {
      // Empty array
      assert.equal(validateFrontmatter({ ...baseValid, tags: [] }).valid, false);

      // Non-array
      assert.equal(validateFrontmatter({ ...baseValid, tags: 'cosmos-db' }).valid, false);

      // Array with non-canonical fake tag
      const resFake = validateFrontmatter(
        { ...baseValid, tags: ['cosmos-db', 'completely-fabricated-tag-xyz'] },
        { canonicalTags }
      );
      assert.equal(resFake.valid, false);
      assert.ok(resFake.some(e => e.includes('Unregistered tag')));

      // Array with empty or blank string tag
      const resBlank = validateFrontmatter(
        { ...baseValid, tags: ['cosmos-db', '   '] },
        { canonicalTags }
      );
      assert.equal(resBlank.valid, false);
    });

    test('rejects malformed related_links structures', () => {
      // Non-array related_links
      const resStr = validateFrontmatter({ ...baseValid, related_links: 'https://learn.microsoft.com' });
      assert.equal(resStr.valid, false);

      // Missing url
      const resNoUrl = validateFrontmatter({
        ...baseValid,
        related_links: [{ label: 'Some Doc' }]
      });
      assert.equal(resNoUrl.valid, false);
      assert.ok(resNoUrl.some(e => e.includes("missing 'url'")));

      // Missing label
      const resNoLabel = validateFrontmatter({
        ...baseValid,
        related_links: [{ url: 'https://learn.microsoft.com' }]
      });
      assert.equal(resNoLabel.valid, false);
      assert.ok(resNoLabel.some(e => e.includes("missing 'label'")));
    });
  });
});

// =========================================================================
// 2. Cloze Gap Syntax (==gap==) Edge Cases
// =========================================================================
describe('2. Cloze Gap Syntax (==gap==) Parsing & Edge Cases', () => {
  const compiler = createMarkdownCompiler();

  test('All 5 pilot concept files contain Active Recall clozes with non-empty terms', () => {
    const pilotFiles = readdirSync(PILOT_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
    for (const file of pilotFiles) {
      const content = readFileSync(join(PILOT_DIR, file), 'utf-8');
      const clozes = extractClozes(content);
      assert.ok(clozes.length >= 2, `Expected at least 2 clozes in ${file}, found ${clozes.length}`);
      for (const term of clozes) {
        assert.ok(term.trim().length > 0, `Cloze term cannot be empty in ${file}`);
        assert.ok(!term.includes('\n'), `Cloze term cannot contain newlines in ${file}`);
      }
    }
  });

  test('empty delimiters (====) do NOT produce a cloze', () => {
    const raw = 'The result is ====.';
    const extracted = extractClozes(raw);
    assert.deepEqual(extracted, []);

    const html = compiler.parse(raw);
    assert.ok(!html.includes('class="cloze"'), 'Should not render cloze element for empty delimiter');
    assert.ok(html.includes('===='), 'Should render literal ==== characters');
  });

  test('multiline syntax (==line1\\nline2==) does NOT span lines or crash', () => {
    const raw = 'Line 1 ==start\nend== Line 2';
    const extracted = extractClozes(raw);
    assert.deepEqual(extracted, []);

    const html = compiler.parse(raw);
    assert.ok(!html.includes('class="cloze"'), 'Cloze must not span line boundaries');
    assert.ok(html.includes('==start'), 'Unmatched delimiters render as plain text');
  });

  test('consecutive clozes on the same line are cleanly isolated', () => {
    const raw = 'Values are ==Alpha====Beta==.';
    const extracted = extractClozes(raw);
    assert.deepEqual(extracted, ['Alpha', 'Beta']);

    const html = compiler.parse(raw);
    assert.ok(html.includes('data-answer="Alpha"'));
    assert.ok(html.includes('data-answer="Beta"'));
  });

  test('nested cloze syntax (==outer ==inner== outer==) handles gracefully', () => {
    const raw = 'Test ==outer ==inner== outer== test.';
    const extracted = extractClozes(raw);
    assert.ok(Array.isArray(extracted));
    assert.ok(extracted.length > 0);

    const html = compiler.parse(raw);
    assert.ok(typeof html === 'string');
    assert.ok(html.includes('class="cloze"'));
  });

  test('HTML special characters and entities inside cloze are escaped', () => {
    const raw = 'Compare ==<Item & "Value">==.';
    const extracted = extractClozes(raw);
    assert.deepEqual(extracted, ['<Item & "Value">']);

    const html = compiler.parse(raw);
    assert.ok(html.includes('data-answer="&lt;Item &amp; &quot;Value&quot;&gt;"'));
    assert.ok(html.includes('&lt;Item &amp; &quot;Value&quot;&gt;'));
    assert.ok(!html.includes('<Item & "Value">'), 'Raw unescaped HTML characters must not exist in output');
  });

  test('XSS script injection inside cloze is caught by compileMarkdown security gate', () => {
    const malicious = 'Cloze with script: ==<script>alert(1)</script>==';
    assert.throws(
      () => compileMarkdown(malicious),
      /Security Violation in Markdown/i,
      'compileMarkdown must reject cloze containing executable script'
    );
  });

  test('stripClozes() strips delimiters while preserving exact answer text', () => {
    const input = 'O Azure Cosmos DB usa ==Request Units== para mensurar throughput e ==DiskANN== para vetores.';
    const stripped = stripClozes(input);
    assert.equal(
      stripped,
      'O Azure Cosmos DB usa Request Units para mensurar throughput e DiskANN para vetores.'
    );
  });

  test('B-01 Reproduction: whitespace cloze ==   == followed by text and cloze desynchronizes parser', () => {
    const raw = '==   == O Azure Cosmos DB usa ==Request Units==';
    const html = compiler.parse(raw);

    // Bug B-01: When tokenizer returns undefined on whitespace delimiter, Marked advances 1 char
    // and re-matches the closing delimiter with the opening delimiter of the next cloze, turning
    // "O Azure Cosmos DB usa" into an accidental cloze answer and corrupting "Request Units==".
    assert.ok(
      !html.includes('data-answer="O Azure Cosmos DB usa"'),
      'Bug B-01: Whitespace blank desynchronized parser and converted regular prose into cloze answer'
    );
    assert.ok(
      html.includes('data-answer="Request Units"'),
      'Bug B-01: Real cloze "Request Units" must be preserved even if preceded by whitespace delimiter'
    );
  });
});

// =========================================================================
// 3. Active Recall <details> Self-Checks
// =========================================================================
describe('3. Active Recall <details> Self-Checks & Summary Validation', () => {
  test('All <details> blocks in pilot concepts and comparisons have non-empty <summary>', () => {
    const pilotFiles = readdirSync(PILOT_DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
    for (const file of pilotFiles) {
      const content = readFileSync(join(PILOT_DIR, file), 'utf-8');
      const res = validateDetails(content);
      assert.equal(res.valid, true, `Details validation failed in ${file}: ${res.errors.join('; ')}`);
    }

    const compContent = readFileSync(join(COMPARISONS_DIR, 'vector-stores-azure.md'), 'utf-8');
    const compRes = validateDetails(compContent);
    assert.equal(compRes.valid, true, `Details validation failed in vector-stores-azure.md: ${compRes.errors.join('; ')}`);
  });

  describe('Adversarial Edge Cases on validateDetails()', () => {
    test('detects <details> tag missing <summary>', () => {
      const input = '<details>\n  <p>Answer content without summary</p>\n</details>';
      const res = validateDetails(input);
      assert.equal(res.valid, false);
      assert.equal(res.errors.length, 1);
      assert.ok(res.errors[0].includes('missing mandatory <summary>'));
    });

    test('detects <details> tag with empty <summary></summary>', () => {
      const input = '<details><summary></summary><div>Body</div></details>';
      const res = validateDetails(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors[0].includes('missing mandatory <summary>'));
    });

    test('detects <details> tag with whitespace-only <summary>', () => {
      const input = '<details>\n<summary>   \n\t  </summary>\n<div>Body</div>\n</details>';
      const res = validateDetails(input);
      assert.equal(res.valid, false);
      assert.ok(res.errors[0].includes('missing mandatory <summary>'));
    });

    test('identifies exact index of offending <details> in a multi-card document', () => {
      const input = `
<details>
  <summary>Valid Question 1</summary>
  <p>Answer 1</p>
</details>

<details>
  <p>Missing summary here</p>
</details>

<details>
  <summary>Valid Question 3</summary>
  <p>Answer 3</p>
</details>
`;
      const res = validateDetails(input);
      assert.equal(res.valid, false);
      assert.equal(res.errors.length, 1);
      assert.ok(res.errors[0].includes('Check card #2'));
    });

    test('formatDetails() throws an Error when summary is missing', () => {
      const input = '<details><p>No summary</p></details>';
      assert.throws(
        () => formatDetails(input),
        /Found <details> block without mandatory <summary>/
      );
    });

    test('formatDetails() transforms valid <details> into accessible check-card markup', () => {
      const input = '<details><summary>O que e uma Partition Key?</summary><p>Chave de particao logica.</p></details>';
      const formatted = formatDetails(input);
      assert.ok(formatted.includes('class="check-card"'));
      assert.ok(formatted.includes('class="check-card-summary"'));
      assert.ok(formatted.includes('class="check-card-title">O que e uma Partition Key?</span>'));
      assert.ok(formatted.includes('class="check-card-body"'));
    });
  });
});

// =========================================================================
// 4. Code Tabs Grouping & Synchronization
// =========================================================================
describe('4. Code Tabs Grouping & Language Parity', () => {
  const compiler = createMarkdownCompiler();

  test('normalizeLanguage() handles aliases and whitespace variations', () => {
    // Python variants
    assert.equal(normalizeLanguage('python'), 'python');
    assert.equal(normalizeLanguage('py'), 'python');
    assert.equal(normalizeLanguage('PYTHON'), 'python');
    assert.equal(normalizeLanguage('  Py  '), 'python');

    // C# variants
    assert.equal(normalizeLanguage('csharp'), 'csharp');
    assert.equal(normalizeLanguage('c#'), 'csharp');
    assert.equal(normalizeLanguage('cs'), 'csharp');
    assert.equal(normalizeLanguage('CSHARP'), 'csharp');
    assert.equal(normalizeLanguage('  C#  '), 'csharp');

    // Non-SDK languages
    assert.equal(normalizeLanguage('json'), null);
    assert.equal(normalizeLanguage('sql'), null);
    assert.equal(normalizeLanguage('bash'), null);
    assert.equal(normalizeLanguage(null), null);
    assert.equal(normalizeLanguage(''), null);
  });

  test('groups adjacent Python and C# blocks (Python first)', () => {
    resetTabCounter();
    const md = '```python\nprint("hello")\n```\n\n```csharp\nConsole.WriteLine("hello");\n```';
    const html = compiler.parse(md);

    assert.ok(html.includes('class="code-tabs"'), 'Must generate code-tabs container');
    assert.ok(html.includes('role="tablist"'), 'Must include role="tablist"');
    assert.ok(html.includes('data-lang="python"'), 'Must include python tab button');
    assert.ok(html.includes('data-lang="csharp"'), 'Must include csharp tab button');
    assert.ok(html.includes('class="language-python"'), 'Must render python code block');
    assert.ok(html.includes('class="language-csharp"'), 'Must render csharp code block');
  });

  test('groups adjacent C# and Python blocks (C# first) into normalized tab order', () => {
    resetTabCounter();
    const md = '```c#\nConsole.WriteLine("inverted");\n```\n\n```py\nprint("inverted")\n```';
    const html = compiler.parse(md);

    assert.ok(html.includes('class="code-tabs"'), 'Must group even when C# is written first');
    assert.ok(html.includes('data-lang="python"'));
    assert.ok(html.includes('data-lang="csharp"'));
    assert.ok(html.includes('id="tab-1-python"'));
  });

  test('survives varied whitespace and blank lines between code blocks', () => {
    resetTabCounter();
    const md = '```python\nval = 1\n```\n\n\n\n\n\n```csharp\nvar val = 1;\n```';
    const html = compiler.parse(md);
    assert.ok(html.includes('class="code-tabs"'), 'Must group across multiple blank lines');
  });

  test('does NOT group code blocks when prose paragraph intervenes', () => {
    const md = '```python\nval = 1\n```\n\nNote: here is explanation text between blocks.\n\n```csharp\nvar val = 1;\n```';
    const html = compiler.parse(md);
    assert.ok(!html.includes('class="code-tabs"'), 'Intervening paragraph must prevent grouping');
    assert.ok(html.includes('<p>Note: here is explanation text'));
  });

  test('does NOT group two consecutive blocks of the same language', () => {
    const md = '```python\ndef step1(): pass\n```\n\n```python\ndef step2(): pass\n```';
    const html = compiler.parse(md);
    assert.ok(!html.includes('class="code-tabs"'), 'Same-language consecutive blocks must not group');
  });

  test('Pilot concept with SDK code contains code-tabs in compiled output', () => {
    const sdkConceptPath = join(PILOT_DIR, 'cosmos-db-sdk-conexao-e-consultas.md');
    const content = readFileSync(sdkConceptPath, 'utf-8');
    const { html, metadata } = compileMarkdown(content);

    assert.equal(metadata.hasCodeTabs, true, 'cosmos-db-sdk-conexao-e-consultas.md must compile code-tabs');
    assert.ok(html.includes('class="code-tabs"'));
    assert.ok(html.includes('Python SDK'));
    assert.ok(html.includes('C# (.NET) SDK'));
  });
});

// =========================================================================
// 5. Security Sanitizer Adversarial Bypass Attempts
// =========================================================================
describe('5. Security Sanitizer Adversarial Bypass Stress-Testing', () => {
  describe('Bypass vectors that MUST be detected and rejected', () => {
    const dangerousSamples = [
      // Mixed-case javascript: pseudo-protocols
      { name: 'mixed-case JaVaScRiPt: link', md: '[Click me](JaVaScRiPt:alert(1))' },
      { name: 'mixed-case VbScRiPt: link', md: '[Click me](VbScRiPt:msgbox(1))' },
      { name: 'HTML anchor with JAVASCRIPT: href', md: '<a href="JAVASCRIPT:alert(document.cookie)">link</a>' },
      { name: 'leading whitespace in javascript: href', md: '<a href="   javascript:alert(1)">link</a>' },

      // data:text/html pseudo-protocols
      { name: 'data:text/html markdown link', md: '[XSS](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)' },
      { name: 'mixed-case DaTa:TeXt/HtMl link', md: '[XSS](DaTa:TeXt/HtMl;base64,PHNjcmlwdD4=)' },
      { name: 'HTML iframe with data:text/html', md: '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>' },

      // Inline event handlers across tags
      { name: 'img onerror with mixed case ONERROR', md: '<img src="x" ONERROR="alert(1)">' },
      { name: 'svg onload handler', md: '<svg onload="alert(1)"><circle r="10"/></svg>' },
      { name: 'body onload handler', md: '<body onload="alert(document.domain)">' },
      { name: 'details ontoggle handler', md: '<details ontoggle="fetch(\'http://attacker.com\')"><summary>Q</summary>A</details>' },
      { name: 'input onfocus autofocus', md: '<input type="text" onfocus="alert(1)" autofocus>' },
      { name: 'button onclick with whitespace', md: '<button onclick = "alert(1)">Click</button>' },

      // Dangerous embedding tags
      { name: 'raw script tag', md: '<script>console.log("pwned")</script>' },
      { name: 'script with external src', md: '<script src="https://evil.com/xss.js"></script>' },
      { name: 'iframe embedding', md: '<iframe src="https://evil.com"></iframe>' },
      { name: 'object embedding', md: '<object data="exploit.swf"></object>' },
      { name: 'embed tag', md: '<embed src="exploit.pdf"></embed>' }
    ];

    for (const sample of dangerousSamples) {
      test(`rejects ${sample.name}`, () => {
        const violations = sanitizeCheck(sample.md);
        assert.ok(
          violations.length > 0,
          `sanitizeCheck() failed to catch violation in: ${sample.md}`
        );

        assert.throws(
          () => compileMarkdown(sample.md),
          /Security Violation in Markdown/i,
          `compileMarkdown() should have thrown for: ${sample.md}`
        );
      });
    }
  });

  describe('Strict Negative Controls (Safe technical content MUST NOT be flagged)', () => {
    const safeSamples = [
      {
        name: 'fenced python code with on_event function name',
        md: '```python\ndef on_startup(app):\n    print("Starting")\n\ndef on_error(err):\n    pass\n```'
      },
      {
        name: 'fenced js code assigning onclick',
        md: '```javascript\nbutton.onclick = function() {\n  console.log("Clicked");\n};\n```'
      },
      {
        name: 'fenced HTML code example displaying <script>',
        md: '```html\n<script src="bundle.js"></script>\n```'
      },
      {
        name: 'inline code backtick mentioning <script>',
        md: 'No App Service, nunca inclua `<script>` inline diretamente.'
      },
      {
        name: 'inline code backtick mentioning onclick',
        md: 'O manipulador `onclick` nao deve ser usado diretamente no DOM.'
      },
      {
        name: 'shell command path mentioning scripts directory',
        md: 'Execute `node scripts/validate-site.mjs` no terminal PowerShell.'
      },
      {
        name: 'mathematical comparison symbols < and > in prose',
        md: 'O volume deve ser > 1000 itens e < 50000 itens para compensar a quantização.'
      },
      {
        name: 'legitimate external HTTPS documentation link',
        md: '[Microsoft Docs](https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search)'
      },
      {
        name: 'legitimate internal relative route',
        md: '[Ver Particionamento](./cosmos-db-modelo-de-recursos-e-particionamento.md)'
      },
      {
        name: 'valid <details> check card',
        md: '<details>\n  <summary>O que e RTT?</summary>\n  <p>Round Trip Time de rede.</p>\n</details>'
      }
    ];

    for (const sample of safeSamples) {
      test(`accepts safe sample: ${sample.name}`, () => {
        const violations = sanitizeCheck(sample.md);
        assert.deepEqual(
          violations,
          [],
          `False positive detected in safe sample: ${sample.name} -> ${violations.join(', ')}`
        );

        assert.doesNotThrow(
          () => compileMarkdown(sample.md),
          `compileMarkdown() threw false positive for: ${sample.name}`
        );
      });
    }
  });

  test('All 5 pilot concept files and comparisons have ZERO security violations', () => {
    const pilotFiles = readdirSync(PILOT_DIR).filter(f => f.endsWith('.md'));
    for (const file of pilotFiles) {
      const fullPath = join(PILOT_DIR, file);
      const content = readFileSync(fullPath, 'utf-8');
      const violations = sanitizeCheck(content);
      assert.deepEqual(
        violations,
        [],
        `Security violation detected in pilot file ${file}: ${violations.join('; ')}`
      );
    }

    const compPath = join(COMPARISONS_DIR, 'vector-stores-azure.md');
    const compContent = readFileSync(compPath, 'utf-8');
    const compViolations = sanitizeCheck(compContent);
    assert.deepEqual(
      compViolations,
      [],
      `Security violation in vector-stores-azure.md: ${compViolations.join('; ')}`
    );
  });
});

// =========================================================================
// 6. Link Integrity & Structural Validation
// =========================================================================
describe('6. Link Integrity & Structural Validation', () => {
  const existingRoutes = new Set([
    'index.html',
    'cram/',
    'simulator/',
    'mastery/',
    'cosmos-db-modelo-de-recursos-e-particionamento',
    'cosmos-db-sdk-conexao-e-consultas',
    'cosmos-db-indexacao-consistencia-rus',
    'cosmos-db-busca-vetorial',
    'cosmos-db-change-feed-processor',
    'vector-stores-azure',
    'chapters/04-cosmos-db-nosql/cosmos-db-modelo-de-recursos-e-particionamento/',
    'chapters/04-cosmos-db-nosql/cosmos-db-sdk-conexao-e-consultas/',
    'chapters/04-cosmos-db-nosql/cosmos-db-indexacao-consistencia-rus/',
    'chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial/',
    'chapters/04-cosmos-db-nosql/cosmos-db-change-feed-processor/',
    'comparisons/vector-stores-azure/'
  ]);

  test('validateLink() properly classifies external, internal, anchor, and dangerous URLs', () => {
    // External HTTPS
    assert.deepEqual(validateLink('https://learn.microsoft.com', existingRoutes), { valid: true, external: true });
    assert.deepEqual(validateLink('http://example.com', existingRoutes), { valid: true, external: true });

    // Anchor links
    assert.deepEqual(validateLink('#section-heading', existingRoutes), { valid: true, anchor: true });

    // Internal known routes
    assert.equal(validateLink('./cosmos-db-busca-vetorial.md', existingRoutes).valid, true);
    assert.equal(validateLink('cosmos-db-busca-vetorial', existingRoutes).valid, true);
    assert.equal(validateLink('/vector-stores-azure', existingRoutes).valid, true);

    // Broken internal route
    const broken = validateLink('./non-existent-concept.md', existingRoutes);
    assert.equal(broken.valid, false);
    assert.ok(broken.reason.includes('not found in known routes'));

    // Dangerous javascript:
    const dangerous = validateLink('javascript:alert(1)', existingRoutes);
    assert.equal(dangerous.valid, false);
    assert.ok(dangerous.reason.includes('Security violation'));
  });

  test('All links in 5 pilot concepts and vector-stores-azure.md are valid and sound', () => {
    const filesToTest = [
      ...readdirSync(PILOT_DIR).filter(f => f.endsWith('.md')).map(f => join(PILOT_DIR, f)),
      join(COMPARISONS_DIR, 'vector-stores-azure.md')
    ];

    for (const filePath of filesToTest) {
      const content = readFileSync(filePath, 'utf-8');
      const links = extractLinks(content);

      for (const link of links) {
        assert.equal(link.isDangerous, false, `Dangerous link detected in ${filePath}: ${link.url}`);

        const res = validateLink(link.url, existingRoutes);
        assert.equal(
          res.valid,
          true,
          `Invalid link in ${basename(filePath)} (line ${link.line}): '${link.url}' -> ${res.reason}`
        );
      }
    }
  });

  test('Chapter 04 README.md pilot concept links resolve to existing files on disk', () => {
    const readmePath = join(PILOT_DIR, 'README.md');
    const content = readFileSync(readmePath, 'utf-8');
    const links = extractLinks(content);

    const conceptLinks = links.filter(l => l.url.startsWith('./cosmos-db-') && l.url.endsWith('.md'));
    assert.equal(conceptLinks.length, 5, `Expected 5 concept links in 04-cosmos-db-nosql/README.md, found ${conceptLinks.length}`);

    for (const link of conceptLinks) {
      const targetFile = resolve(PILOT_DIR, link.url);
      assert.ok(
        existsSync(targetFile),
        `Concept link '${link.url}' in README.md does not exist on disk: ${targetFile}`
      );
    }
  });

  test('B-02 Reproduction: extractLinks() fails to extract target URL from markdown image badges [![alt](img)](target)', () => {
    const badgeSample = '[![Domínio](https://img.shields.io/badge/Dom%C3%ADnio-0078D4)](../../syllabus/ai-200-blueprint.json)';
    const links = extractLinks(badgeSample);
    const targetLink = links.find(l => l.url.includes('blueprint.json'));

    // Bug B-02: mdLinkRegex stops at first ']' inside '[![alt](img)](target)', capturing img URL as link
    // and completely dropping the target hyperlink (../../syllabus/ai-200-blueprint.json).
    assert.ok(
      targetLink,
      'Bug B-02: extractLinks must extract the outer hyperlink destination from linked image badges'
    );
  });
});

// =========================================================================
// 7. Question Bank Schema Fuzzing (5 Quiz Formats)
// =========================================================================
describe('7. Question Bank Schema Fuzzing (5 Quiz Formats)', () => {
  describe('single-choice validation', () => {
    const baseSC = {
      id: 'sc-01',
      type: 'single-choice',
      title: 'Title',
      exam_domain: 'data-management',
      stem: 'Prompt question?',
      options: [
        { id: 'a', text: 'Option A', correct: true, rationale: 'Reason A' },
        { id: 'b', text: 'Option B', correct: false, rationale: 'Reason B' }
      ]
    };

    test('accepts valid single-choice question', () => {
      assert.equal(validateQuestion(baseSC).valid, true);
    });

    test('rejects single-choice with 0 correct options', () => {
      const q = {
        ...baseSC,
        options: [
          { id: 'a', text: 'Option A', correct: false, rationale: 'R' },
          { id: 'b', text: 'Option B', correct: false, rationale: 'R' }
        ]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('exactly 1 correct option')));
    });

    test('rejects single-choice with 2 correct options', () => {
      const q = {
        ...baseSC,
        options: [
          { id: 'a', text: 'Option A', correct: true, rationale: 'R' },
          { id: 'b', text: 'Option B', correct: true, rationale: 'R' }
        ]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('exactly 1 correct option')));
    });

    test('rejects single-choice with fewer than 2 options', () => {
      const q = {
        ...baseSC,
        options: [{ id: 'a', text: 'Only option', correct: true, rationale: 'R' }]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('requires at least 2 options')));
    });
  });

  describe('multiple-choice validation', () => {
    const baseMC = {
      id: 'mc-01',
      type: 'multiple-choice',
      title: 'MC Title',
      exam_domain: 'data-management',
      stem: 'Select two options:',
      select_count: 2,
      options: [
        { id: 'a', text: 'Opt A', correct: true, rationale: 'R1' },
        { id: 'b', text: 'Opt B', correct: true, rationale: 'R2' },
        { id: 'c', text: 'Opt C', correct: false, rationale: 'R3' },
        { id: 'd', text: 'Opt D', correct: false, rationale: 'R4' }
      ]
    };

    test('accepts valid multiple-choice question', () => {
      assert.equal(validateQuestion(baseMC).valid, true);
    });

    test('rejects multiple-choice where select_count < 2', () => {
      const q = { ...baseMC, select_count: 1 };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes("must specify 'select_count' >= 2")));
    });

    test('rejects multiple-choice where correct options count !== select_count', () => {
      const q = {
        ...baseMC,
        select_count: 3 // only 2 correct in options
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('expected select_count=3')));
    });
  });

  describe('code-completion validation', () => {
    const baseCC = {
      id: 'cc-01',
      type: 'code-completion',
      title: 'CC Title',
      exam_domain: 'data-management',
      stem: 'Complete code:',
      code_template: 'const client = new CosmosClient({{conn}}, {{mode}});',
      slots: [
        {
          id: 'conn',
          options: [
            { text: 'connStr', correct: true, rationale: 'R' },
            { text: 'fakeStr', correct: false, rationale: 'R' }
          ]
        },
        {
          id: 'mode',
          options: [
            { text: 'ConnectionMode.Direct', correct: true, rationale: 'R' },
            { text: 'ConnectionMode.Gateway', correct: false, rationale: 'R' }
          ]
        }
      ]
    };

    test('accepts valid code-completion question', () => {
      assert.equal(validateQuestion(baseCC).valid, true);
    });

    test('rejects code-completion with missing placeholder in slots', () => {
      const q = {
        ...baseCC,
        code_template: 'const x = {{unmatched_placeholder}};'
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('with no matching slot')));
    });

    test('rejects code-completion with slot not present in code_template', () => {
      const q = {
        ...baseCC,
        slots: [
          ...baseCC.slots,
          {
            id: 'extra_slot',
            options: [
              { text: '1', correct: true, rationale: 'R' },
              { text: '2', correct: false, rationale: 'R' }
            ]
          }
        ]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('has no matching placeholder in code_template')));
    });
  });

  describe('ordering validation', () => {
    const baseOrd = {
      id: 'ord-01',
      type: 'ordering',
      title: 'Ordering Title',
      exam_domain: 'data-management',
      stem: 'Put steps in order:',
      items: [
        { id: 'step-1', text: 'First step', order: 1 },
        { id: 'step-2', text: 'Second step', order: 2 },
        { id: 'step-3', text: 'Third step', order: 3 }
      ]
    };

    test('accepts valid ordering question', () => {
      assert.equal(validateQuestion(baseOrd).valid, true);
    });

    test('rejects ordering question with non-consecutive or duplicate orders', () => {
      const q = {
        ...baseOrd,
        items: [
          { id: 'step-1', text: 'First', order: 1 },
          { id: 'step-2', text: 'Second', order: 3 },
          { id: 'step-3', text: 'Third', order: 3 }
        ]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('must be consecutive integers 1..3')));
    });
  });

  describe('case-study validation', () => {
    const baseCS = {
      id: 'cs-01',
      type: 'case-study',
      title: 'Case Study Title',
      exam_domain: 'data-management',
      stem: 'Case Study Scenario',
      tabs: [
        { title: 'Visão Geral', content: 'Overview' },
        { title: 'Arquitetura Atual', content: 'Architecture' },
        { title: 'Requisitos Técnicos', content: 'Technical' },
        { title: 'Requisitos de Segurança', content: 'Security' }
      ],
      questions: [
        {
          id: 'cs-child-01',
          type: 'single-choice',
          title: 'Child Q1',
          exam_domain: 'data-management',
          stem: 'Child question prompt?',
          options: [
            { id: 'a', text: 'Opt A', correct: true, rationale: 'R' },
            { id: 'b', text: 'Opt B', correct: false, rationale: 'R' }
          ]
        }
      ]
    };

    test('accepts valid case-study question with mandatory 4 tabs', () => {
      assert.equal(validateQuestion(baseCS).valid, true);
    });

    test('rejects case-study with missing mandatory tab', () => {
      const q = {
        ...baseCS,
        tabs: [
          { title: 'Visão Geral', content: 'Overview' },
          { title: 'Arquitetura Atual', content: 'Architecture' },
          { title: 'Requisitos Técnicos', content: 'Technical' },
          { title: 'Custom Non-Standard Tab', content: 'Something' }
        ]
      };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes("missing mandatory tab 'Requisitos de Segurança'")));
    });

    test('rejects case-study with empty questions array', () => {
      const q = { ...baseCS, questions: [] };
      const res = validateQuestion(q);
      assert.equal(res.valid, false);
      assert.ok(res.some(e => e.includes('must contain child questions')));
    });
  });
});

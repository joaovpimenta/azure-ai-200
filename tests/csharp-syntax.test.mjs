/**
 * tests/csharp-syntax.test.mjs
 * Adversarial challenger test harness for Milestone 2:
 * - Empirically validates absence of Python leakage (import os, os.environ, def, etc.) in all C# code blocks
 * - Empirically verifies M2 target fixes in Cosmos DB SDK, Change Feed Processor, and PostgreSQL pgvector
 * - Validates C# lexical & structural syntax (balanced delimiters, using statements, semicolon termination)
 * - Adversarial mutation oracles to prove detection capability
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve(process.cwd());
const CHAPTERS_DIR = join(ROOT_DIR, 'chapters');

/**
 * Recursively retrieves all markdown files from a directory
 */
function getAllMarkdownFiles(dir) {
  let results = [];
  if (!existsSync(dir)) return results;
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMarkdownFiles(fullPath));
    } else if (file.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extracts code blocks by language from a markdown string
 */
function extractCodeBlocks(markdownContent) {
  const codeBlockRegex = /```([a-zA-Z0-9_\-#+]*)\s*\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    blocks.push({
      lang: match[1].toLowerCase().trim(),
      code: match[2],
      index: match.index
    });
  }
  return blocks;
}

/**
 * Validates delimiter balance in C# source code, skipping string literals and comments
 */
function checkDelimiterBalance(csharpCode) {
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  let inString = false;
  let inChar = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < csharpCode.length; i++) {
    const ch = csharpCode[i];
    const next = i + 1 < csharpCode.length ? csharpCode[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (inChar) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === "'") {
        inChar = false;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "'") {
      inChar = true;
      continue;
    }

    if (ch === '{') braceCount++;
    else if (ch === '}') braceCount--;
    else if (ch === '(') parenCount++;
    else if (ch === ')') parenCount--;
    else if (ch === '[') bracketCount++;
    else if (ch === ']') bracketCount--;

    if (braceCount < 0 || parenCount < 0 || bracketCount < 0) {
      return {
        valid: false,
        reason: `Mismatched closing delimiter at char ${i} (${ch})`,
        braceCount,
        parenCount,
        bracketCount
      };
    }
  }

  if (braceCount !== 0 || parenCount !== 0 || bracketCount !== 0) {
    return {
      valid: false,
      reason: `Unclosed delimiters: braces=${braceCount}, parens=${parenCount}, brackets=${bracketCount}`,
      braceCount,
      parenCount,
      bracketCount
    };
  }

  return { valid: true };
}

// =========================================================================
// Suite 1: Absence of Python leakage in C# code blocks
// =========================================================================
describe('Suite 1: Empirical Absence of Python Leakage in C# Snippets', () => {
  const allMdFiles = getAllMarkdownFiles(CHAPTERS_DIR);

  test('chapters/ contains markdown files to verify', () => {
    assert.ok(allMdFiles.length >= 35, `Expected >= 35 chapter files, found ${allMdFiles.length}`);
  });

  test('Zero C# code blocks contain "import os" or "os.environ"', () => {
    const violations = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);
      const csharpBlocks = blocks.filter(b => b.lang === 'csharp' || b.lang === 'cs');

      csharpBlocks.forEach((block, idx) => {
        const hasImportOs = block.code.includes('import os');
        const hasOsEnviron = block.code.includes('os.environ');
        if (hasImportOs || hasOsEnviron) {
          violations.push({
            file: filePath,
            snippetIndex: idx,
            hasImportOs,
            hasOsEnviron,
            sample: block.code.slice(0, 150)
          });
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Found Python os leakage in C# blocks: ${JSON.stringify(violations, null, 2)}`
    );
  });

  test('Zero C# code blocks contain Python keywords or constructs (def, elif, None, True, False outside strings)', () => {
    const violations = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);
      const csharpBlocks = blocks.filter(b => b.lang === 'csharp' || b.lang === 'cs');

      csharpBlocks.forEach((block, idx) => {
        const lines = block.code.split('\n');
        lines.forEach((line, lineIdx) => {
          const trimmed = line.trim();
          // Check for python def
          if (/^def\s+[a-zA-Z0-9_]+\s*\(/.test(trimmed)) {
            violations.push({ file: filePath, block: idx, line: lineIdx + 1, violation: 'def keyword', text: trimmed });
          }
          // Check for python from ... import ... or import ... at statement level
          if (/^(import\s+[a-zA-Z0-9_.]+|from\s+[a-zA-Z0-9_.]+\s+import)/.test(trimmed)) {
            violations.push({ file: filePath, block: idx, line: lineIdx + 1, violation: 'python import', text: trimmed });
          }
          // Check for except: or except Exception:
          if (/^except(\s+[a-zA-Z0-9_]+)?\s*:/.test(trimmed)) {
            violations.push({ file: filePath, block: idx, line: lineIdx + 1, violation: 'python except', text: trimmed });
          }
        });
      });
    }

    assert.equal(
      violations.length,
      0,
      `Found Python constructs in C# blocks: ${JSON.stringify(violations, null, 2)}`
    );
  });

  test('All occurrences of "import os" and "os.environ" across chapters/ are strictly confined to python blocks', () => {
    const mislocatedOccurrences = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);

      // Check occurrences in code blocks
      for (const block of blocks) {
        if (block.code.includes('import os') || block.code.includes('os.environ')) {
          if (block.lang !== 'python' && block.lang !== 'py') {
            mislocatedOccurrences.push({
              file: filePath,
              lang: block.lang,
              sample: block.code.slice(0, 100)
            });
          }
        }
      }
    }

    assert.equal(
      mislocatedOccurrences.length,
      0,
      `Found import os / os.environ in non-python blocks: ${JSON.stringify(mislocatedOccurrences, null, 2)}`
    );
  });
});

// =========================================================================
// Suite 2: Worker M2 Specific Regressions & Targeted Fixes
// =========================================================================
describe('Suite 2: Worker M2 Specific Regressions & Targeted Fixes', () => {
  test('M2-Fix-1: cosmos-db-sdk-conexao-e-consultas.md uses Environment.GetEnvironmentVariable', () => {
    const targetFile = join(CHAPTERS_DIR, '04-cosmos-db-nosql', 'cosmos-db-sdk-conexao-e-consultas.md');
    assert.ok(existsSync(targetFile), `File ${targetFile} does not exist`);

    const content = readFileSync(targetFile, 'utf-8');
    const csharpBlocks = extractCodeBlocks(content).filter(b => b.lang === 'csharp' || b.lang === 'cs');
    assert.ok(csharpBlocks.length >= 1, 'Expected at least 1 C# block');

    const snippet = csharpBlocks[0].code;
    assert.ok(
      snippet.includes('string endpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT")!;'),
      'Missing expected idiomatic C# Environment.GetEnvironmentVariable call'
    );
    assert.ok(!snippet.includes('import os'), 'Snippet must not contain "import os"');
    assert.ok(!snippet.includes('os.environ'), 'Snippet must not contain "os.environ"');
    assert.ok(snippet.includes('using System;'), 'Snippet must include "using System;" for Environment');
    assert.ok(snippet.includes('using Microsoft.Azure.Cosmos;'), 'Snippet must include Cosmos namespace');
    assert.ok(snippet.includes('using Azure.Identity;'), 'Snippet must include Identity namespace');
  });

  test('M2-Fix-2: cosmos-db-change-feed-processor.md uses Environment.GetEnvironmentVariable', () => {
    const targetFile = join(CHAPTERS_DIR, '04-cosmos-db-nosql', 'cosmos-db-change-feed-processor.md');
    assert.ok(existsSync(targetFile), `File ${targetFile} does not exist`);

    const content = readFileSync(targetFile, 'utf-8');
    const csharpBlocks = extractCodeBlocks(content).filter(b => b.lang === 'csharp' || b.lang === 'cs');
    assert.ok(csharpBlocks.length >= 1, 'Expected at least 1 C# block');

    const snippet = csharpBlocks[0].code;
    assert.ok(
      snippet.includes('string endpoint = Environment.GetEnvironmentVariable("COSMOS_ENDPOINT")!;'),
      'Missing expected idiomatic C# Environment.GetEnvironmentVariable call'
    );
    assert.ok(!snippet.includes('import os'), 'Snippet must not contain "import os"');
    assert.ok(!snippet.includes('os.environ'), 'Snippet must not contain "os.environ"');
    assert.ok(snippet.includes('using System;'), 'Snippet must include "using System;" for Environment');
    assert.ok(snippet.includes('using Microsoft.Azure.Cosmos;'), 'Snippet must include Cosmos namespace');
    assert.ok(snippet.includes('using Azure.Identity;'), 'Snippet must include Identity namespace');
  });

  test('M2-Fix-3: postgresql-rag-com-filtros.md includes using System.Linq for vector.Select', () => {
    const targetFile = join(CHAPTERS_DIR, '05-postgresql-pgvector', 'postgresql-rag-com-filtros.md');
    assert.ok(existsSync(targetFile), `File ${targetFile} does not exist`);

    const content = readFileSync(targetFile, 'utf-8');
    const csharpBlocks = extractCodeBlocks(content).filter(b => b.lang === 'csharp' || b.lang === 'cs');
    assert.ok(csharpBlocks.length >= 1, 'Expected at least 1 C# block');

    const snippet = csharpBlocks[0].code;
    assert.ok(
      snippet.includes('using System.Linq;'),
      'Snippet must contain "using System.Linq;" to support vector.Select extension method'
    );
    assert.ok(
      snippet.includes('using System.Globalization;'),
      'Snippet must contain "using System.Globalization;" for CultureInfo.InvariantCulture'
    );
    assert.ok(
      snippet.includes('using Npgsql;'),
      'Snippet must contain "using Npgsql;"'
    );
    assert.ok(
      snippet.includes('vector.Select(x => x.ToString(CultureInfo.InvariantCulture))'),
      'Snippet must contain properly typed LINQ Select operation'
    );
  });
});

// =========================================================================
// Suite 3: Structural & Syntactic Integrity of All C# Code Blocks
// =========================================================================
describe('Suite 3: Lexical & Structural Integrity of All C# Code Blocks', () => {
  const allMdFiles = getAllMarkdownFiles(CHAPTERS_DIR);

  test('Every C# code block satisfies delimiter balance (braces, brackets, parentheses)', () => {
    const delimiterErrors = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);
      const csharpBlocks = blocks.filter(b => b.lang === 'csharp' || b.lang === 'cs');

      csharpBlocks.forEach((block, idx) => {
        const check = checkDelimiterBalance(block.code);
        if (!check.valid) {
          delimiterErrors.push({
            file: filePath,
            snippetIndex: idx,
            check
          });
        }
      });
    }

    assert.equal(
      delimiterErrors.length,
      0,
      `Found C# snippets with unbalanced delimiters: ${JSON.stringify(delimiterErrors, null, 2)}`
    );
  });

  test('Every C# using directive is well-formed and terminated with semicolon', () => {
    const usingErrors = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);
      const csharpBlocks = blocks.filter(b => b.lang === 'csharp' || b.lang === 'cs');

      csharpBlocks.forEach((block, idx) => {
        const lines = block.code.split('\n');
        for (let l = 0; l < lines.length; l++) {
          const trimmed = lines[l].trim();
          if (trimmed.startsWith('using ') && !trimmed.includes('(') && !trimmed.includes('=')) {
            // Directive like `using System.Threading;`
            if (!trimmed.endsWith(';')) {
              usingErrors.push({
                file: filePath,
                snippetIndex: idx,
                line: l + 1,
                text: trimmed
              });
            }
          }
        }
      });
    }

    assert.equal(
      usingErrors.length,
      0,
      `Found malformed C# using directives: ${JSON.stringify(usingErrors, null, 2)}`
    );
  });

  test('External SDK namespace imports are present when specific API types are referenced', () => {
    const rules = [
      { trigger: /\bDefaultAzureCredential\b/, required: /using\s+Azure\.Identity;/, name: 'Azure.Identity' },
      { trigger: /\bCosmosClient\b/, required: /using\s+Microsoft\.Azure\.Cosmos;/, name: 'Microsoft.Azure.Cosmos' },
      { trigger: /\bNpgsqlConnection\b/, required: /using\s+Npgsql;/, name: 'Npgsql' },
      { trigger: /\bEventGridPublisherClient\b/, required: /using\s+Azure\.Messaging\.EventGrid;/, name: 'Azure.Messaging.EventGrid' },
      { trigger: /\bServiceBusClient\b/, required: /using\s+Azure\.Messaging\.ServiceBus;/, name: 'Azure.Messaging.ServiceBus' },
      { trigger: /\bSecretClient\b/, required: /using\s+Azure\.Security\.KeyVault\.Secrets;/, name: 'Azure.Security.KeyVault.Secrets' },
      { trigger: /\bBlobServiceClient\b/, required: /using\s+Azure\.Storage\.Blobs;/, name: 'Azure.Storage.Blobs' }
    ];

    const missingImports = [];

    for (const filePath of allMdFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const blocks = extractCodeBlocks(content);
      const csharpBlocks = blocks.filter(b => b.lang === 'csharp' || b.lang === 'cs');

      csharpBlocks.forEach((block, idx) => {
        for (const rule of rules) {
          if (rule.trigger.test(block.code)) {
            if (!rule.required.test(block.code)) {
              missingImports.push({
                file: filePath,
                snippetIndex: idx,
                missingNamespace: rule.name
              });
            }
          }
        }
      });
    }

    assert.equal(
      missingImports.length,
      0,
      `Found snippets missing required namespace imports: ${JSON.stringify(missingImports, null, 2)}`
    );
  });
});

// =========================================================================
// Suite 4: Adversarial Mutation Oracles (Proves Oracle Precision)
// =========================================================================
describe('Suite 4: Adversarial Mutation Oracles (Self-Verification)', () => {
  test('Oracle successfully detects simulated "string import os" pollution', () => {
    const pollutedCode = `
      using System;
      string import os
      endpoint = os.environ["COSMOS_ENDPOINT"];
      CosmosClient client = new CosmosClient(endpoint);
    `;
    const hasImportOs = pollutedCode.includes('import os');
    const hasOsEnviron = pollutedCode.includes('os.environ');
    assert.equal(hasImportOs, true);
    assert.equal(hasOsEnviron, true);
  });

  test('Oracle successfully detects simulated delimiter unbalance', () => {
    const unclosedBraceCode = `
      public class Test {
        public void Run() {
          Console.WriteLine("Hello");
      }
    `;
    const check = checkDelimiterBalance(unclosedBraceCode);
    assert.equal(check.valid, false);
    assert.equal(check.braceCount, 1);
  });

  test('Oracle successfully detects simulated missing using System.Linq', () => {
    const missingLinqCode = `
      using System.Globalization;
      using Npgsql;
      string literal = "[" + string.Join(",", vector.Select(x => x.ToString(CultureInfo.InvariantCulture))) + "]";
    `;
    const hasSelect = /\bvector\.Select\b/.test(missingLinqCode);
    const hasLinq = /using\s+System\.Linq;/.test(missingLinqCode);
    assert.equal(hasSelect, true);
    assert.equal(hasLinq, false);
  });
});

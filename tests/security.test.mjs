import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCheck } from '../scripts/lib/markdown.mjs';

describe('Security Verification: Markdown XSS & Injection Detection', () => {
  describe('Direct <script> tag injections (MUST FAIL)', () => {
    test('detects lowercase inline <script>', () => {
      const violations = sanitizeCheck('<p>Exploit</p><script>alert(1)</script>');
      assert.ok(violations.length > 0, 'Should detect <script>');
      assert.ok(violations.some(v => v.includes('<script>')));
    });

    test('detects uppercase <SCRIPT> with src', () => {
      const violations = sanitizeCheck('<SCRIPT SRC="https://evil.com/xss.js"></SCRIPT>');
      assert.ok(violations.length > 0, 'Should detect uppercase <SCRIPT>');
    });

    test('detects multiline <script> tag', () => {
      const violations = sanitizeCheck('<script\n  type="text/javascript">\nalert(1)\n</script>');
      assert.ok(violations.length > 0, 'Should detect multiline <script>');
    });

    test('detects <iframe> tag injection', () => {
      const violations = sanitizeCheck('<iframe src="https://attacker.com"></iframe>');
      assert.ok(violations.length > 0, 'Should detect <iframe>');
    });
  });

  describe('Inline event handlers on* (MUST FAIL)', () => {
    test('detects img onerror', () => {
      const violations = sanitizeCheck('![image](x)<img src=x onerror=alert(1)>');
      assert.ok(violations.length > 0, 'Should detect onerror');
    });

    test('detects button onclick with whitespace and quotes', () => {
      const violations = sanitizeCheck('<button onclick = "stealTokens()">Click me</button>');
      assert.ok(violations.length > 0, 'Should detect onclick');
    });

    test('detects svg onload', () => {
      const violations = sanitizeCheck('<svg onload="alert(1)"></svg>');
      assert.ok(violations.length > 0, 'Should detect svg onload');
    });

    test('detects details ontoggle', () => {
      const violations = sanitizeCheck('<details ontoggle="alert(1)"><summary>Open</summary></details>');
      assert.ok(violations.length > 0, 'Should detect ontoggle');
    });
  });

  describe('Dangerous pseudo-protocols (MUST FAIL)', () => {
    test('detects javascript: in Markdown link', () => {
      const violations = sanitizeCheck('[Clique aqui](javascript:alert(1))');
      assert.ok(violations.length > 0, 'Should detect javascript: in markdown link');
    });

    test('detects javascript: in HTML anchor href', () => {
      const violations = sanitizeCheck('<a href="javascript:alert(document.cookie)">Clique</a>');
      assert.ok(violations.length > 0, 'Should detect javascript: in HTML href');
    });

    test('detects javascript: with leading whitespace in href', () => {
      const violations = sanitizeCheck('<a href="   javascript:alert(1)">Clique</a>');
      assert.ok(violations.length > 0, 'Should detect spaced javascript:');
    });

    test('detects JAVASCRIPT: with uppercase letters in href', () => {
      const violations = sanitizeCheck('<a href="JAVASCRIPT:alert(1)">Clique</a>');
      assert.ok(violations.length > 0, 'Should detect uppercase JAVASCRIPT:');
    });

    test('detects vbscript: link', () => {
      const violations = sanitizeCheck('<a href="vbscript:msgbox(1)">Clique</a>');
      assert.ok(violations.length > 0, 'Should detect vbscript:');
    });

    test('detects data:text/html dangerous pseudo-protocol', () => {
      const violations1 = sanitizeCheck('[Malicious](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
      assert.ok(violations1.length > 0, 'Should detect data:text/html in markdown link');

      const violations2 = sanitizeCheck('<a href="data: text/html,<script>alert(1)</script>">Payload</a>');
      assert.ok(violations2.length > 0, 'Should detect data: text/html with space in HTML link');
    });
  });

  describe('Negative Controls (Safe Technical Markdown MUST PASS)', () => {
    test('passes standard technical prose', () => {
      const violations = sanitizeCheck('O Azure Cosmos DB suporta índices vetoriais como DiskANN e Flat.');
      assert.deepEqual(violations, []);
    });

    test('passes mathematical comparisons (< and >)', () => {
      const violations = sanitizeCheck('A latência p99 deve ser < 10ms e o consumo > 500 RUs.');
      assert.deepEqual(violations, []);
    });

    test('passes inline backtick mentioning <script>', () => {
      const violations = sanitizeCheck('Nunca utilize a tag `<script>` diretamente em arquivos Markdown.');
      assert.deepEqual(violations, []);
    });

    test('passes fenced bash code block referencing scripts directory', () => {
      const md = '```bash\nnode scripts/build-site.mjs\nnode scripts/validate-site.mjs\n```';
      const violations = sanitizeCheck(md);
      assert.deepEqual(violations, []);
    });

    test('passes fenced JS code block assigning onclick property', () => {
      const md = '```javascript\nbutton.onclick = () => console.log("clicked");\n```';
      const violations = sanitizeCheck(md);
      assert.deepEqual(violations, []);
    });

    test('passes fenced Python code block with on_event function', () => {
      const md = '```python\ndef on_event():\n    return "ok"\n```';
      const violations = sanitizeCheck(md);
      assert.deepEqual(violations, []);
    });

    test('passes standard valid <details> check card', () => {
      const md = '<details>\n<summary>Qual a função vetorial do Cosmos DB?</summary>\nVectorDistance()\n</details>';
      const violations = sanitizeCheck(md);
      assert.deepEqual(violations, []);
    });

    test('passes legitimate external and internal links', () => {
      const md = '[MS Learn](https://learn.microsoft.com/pt-br/azure/) e [Capítulo 04](/chapters/04-cosmos-db-nosql/)';
      const violations = sanitizeCheck(md);
      assert.deepEqual(violations, []);
    });
  });
});

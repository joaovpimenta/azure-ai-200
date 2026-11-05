import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractFrontmatter, serializeFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { extractClozes, stripClozes, clozeExtension } from '../scripts/lib/cloze.mjs';
import { groupAdjacentCodeTabs, resetTabCounter } from '../scripts/lib/code-tabs.mjs';
import { formatDetails, validateDetails } from '../scripts/lib/details.mjs';
import { validateMermaid, renderMermaidBlock } from '../scripts/lib/mermaid.mjs';
import { compileMarkdown, slugify, extractPegadinhas, extractNarrationText } from '../scripts/lib/markdown.mjs';

describe('Modular Compiler Libraries (scripts/lib/*)', () => {
  describe('frontmatter.mjs', () => {
    test('extracts standard YAML frontmatter', () => {
      const text = '---\ntitle: "Teste"\nslug: "teste-slug"\n---\n# Corpo';
      const { data, content } = extractFrontmatter(text);
      assert.equal(data.title, 'Teste');
      assert.equal(data.slug, 'teste-slug');
      assert.equal(content.trim(), '# Corpo');
    });

    test('handles UTF-8 BOM characters gracefully', () => {
      const text = '\uFEFF---\ntitle: "BOM Test"\n---\nConteudo';
      const { data, content } = extractFrontmatter(text);
      assert.equal(data.title, 'BOM Test');
      assert.equal(content.trim(), 'Conteudo');
    });

    test('throws on unclosed frontmatter delimiter', () => {
      const text = '---\ntitle: "Unclosed"\nConteudo sem fim';
      assert.throws(() => extractFrontmatter(text), /Unclosed frontmatter/);
    });

    test('returns empty data when no frontmatter present', () => {
      const text = '# Apenas Markdown';
      const { data, content } = extractFrontmatter(text);
      assert.deepEqual(data, {});
      assert.equal(content, '# Apenas Markdown');
    });

    test('serializes frontmatter and body correctly', () => {
      const data = { title: 'Serializado', slug: 'teste' };
      const out = serializeFrontmatter(data, 'Corpo de texto');
      assert.ok(out.startsWith('---\n'));
      assert.ok(out.includes('title: Serializado'));
      assert.ok(out.includes('Corpo de texto'));
    });
  });

  describe('cloze.mjs', () => {
    test('extracts cloze terms accurately', () => {
      const md = 'O Azure Cosmos DB usa ==particionamento horizontal== e ==Request Units==.';
      const clozes = extractClozes(md);
      assert.deepEqual(clozes, ['particionamento horizontal', 'Request Units']);
    });

    test('strips cloze markers for narration', () => {
      const md = 'Consumo de ==500 RUs== com latência ==sub-10ms==.';
      const clean = stripClozes(md);
      assert.equal(clean, 'Consumo de 500 RUs com latência sub-10ms.');
    });
  });

  describe('code-tabs.mjs', () => {
    test('bundles adjacent Python and C# code tokens separated by space', () => {
      resetTabCounter();
      const tokens = [
        { type: 'code', lang: 'python', text: 'client = CosmosClient()' },
        { type: 'space', raw: '\n\n' },
        { type: 'code', lang: 'csharp', text: 'CosmosClient client = new();' }
      ];
      const grouped = groupAdjacentCodeTabs(tokens);
      assert.equal(grouped.length, 1);
      assert.equal(grouped[0].type, 'html');
      assert.ok(grouped[0].text.includes('class="code-tabs"'));
      assert.ok(grouped[0].text.includes('data-lang="python"'));
      assert.ok(grouped[0].text.includes('data-lang="csharp"'));
      assert.ok(grouped[0].text.includes('client = CosmosClient()'));
      assert.ok(grouped[0].text.includes('CosmosClient client = new();'));
    });

    test('leaves non-paired code blocks unchanged', () => {
      const tokens = [
        { type: 'code', lang: 'bash', text: 'npm run test' }
      ];
      const grouped = groupAdjacentCodeTabs(tokens);
      assert.equal(grouped.length, 1);
      assert.equal(grouped[0].lang, 'bash');
    });
  });

  describe('details.mjs', () => {
    test('formats details with summary into check-card', () => {
      const html = '<details><summary>Pergunta?</summary><p>Resposta</p></details>';
      const formatted = formatDetails(html);
      assert.ok(formatted.includes('class="check-card"'));
      assert.ok(formatted.includes('class="check-card-summary"'));
      assert.ok(formatted.includes('Pergunta?'));
      assert.ok(formatted.includes('Resposta'));
    });

    test('validates missing summary in details block', () => {
      const html = '<details><p>Sem summary</p></details>';
      const res = validateDetails(html);
      assert.equal(res.valid, false);
      assert.ok(res.errors[0].includes('missing mandatory <summary>'));
    });
  });

  describe('mermaid.mjs', () => {
    test('validates valid and invalid mermaid diagrams', () => {
      const valid = validateMermaid('flowchart TD\n  A --> B');
      assert.equal(valid.valid, true);

      const invalid = validateMermaid('randomWord TD\n  A --> B');
      assert.equal(invalid.valid, false);
    });

    test('renders mermaid figure with noscript fallback', () => {
      const out = renderMermaidBlock('graph TD\n A --> B');
      assert.ok(out.includes('class="mermaid"'));
      assert.ok(out.includes('<noscript>'));
      assert.ok(out.includes('mermaid-fallback'));
    });
  });

  describe('markdown.mjs', () => {
    test('slugifies text stripping Portuguese accents and punctuation', () => {
      assert.equal(slugify('Configuração e Particionamento no Cosmos DB'), 'configuracao-e-particionamento-no-cosmos-db');
      assert.equal(slugify('Contêineres & Funções: Teste'), 'conteineres-funcoes-teste');
    });

    test('extracts Pegadinhas de Prova section', () => {
      const md = '# Título\n\nTexto.\n\n## Pegadinhas de Prova\n- Cuidado com chave de partição.\n\n## Outra Seção';
      const peg = extractPegadinhas(md);
      assert.equal(peg.found, true);
      assert.ok(peg.raw.includes('Cuidado com chave de partição.'));
    });

    test('extracts clean narration prose', () => {
      const md = '# Título\n\nTexto com ==termo importante==.\n```python\ncode()\n```\nMais texto.';
      const narr = extractNarrationText(md);
      assert.ok(narr.includes('Título'));
      assert.ok(narr.includes('termo importante'));
      assert.ok(!narr.includes('code()'));
    });

    test('narration preserves technical terms and explains table cells with headers', () => {
      const narr = extractNarrationText('Use `az acr build` para construir.\n\n| Serviço | Índice |\n|---|---|\n| Cosmos DB | `diskANN` |\n| PostgreSQL | **HNSW** |\n');
      assert.match(narr, /Use az acr build para construir/);
      assert.match(narr, /Serviço: Cosmos DB\. Índice: diskANN\./);
      assert.match(narr, /Serviço: PostgreSQL\. Índice: HNSW\./);
      assert.doesNotMatch(narr, /[|`*]/);
    });

    test('compiles full concept markdown with cloze, code-tabs, details, and headings', () => {
      const md = `# Cosmos DB

Definição de ==partição==.

<details>
<summary>O que é RU?</summary>
Request Unit.
</details>

\`\`\`python
client = CosmosClient()
\`\`\`

\`\`\`csharp
CosmosClient client = new();
\`\`\`

## Pegadinhas de Prova
- Não altere a partition key.
`;
      const result = compileMarkdown(md);
      assert.ok(result.html.includes('class="cloze"'));
      assert.ok(result.html.includes('class="check-card"'));
      assert.ok(result.html.includes('class="code-tabs"'));
      assert.ok(result.html.includes('id="cosmos-db"'));
      assert.equal(result.metadata.title, 'Cosmos DB');
      assert.equal(result.metadata.clozeCount, 1);
      assert.equal(result.metadata.hasCodeTabs, true);
      assert.ok(result.metadata.pegadinhas.includes('Não altere a partition key.'));
    });
  });
});

# Plano de Melhorias: Experiência da Home e Correções do Leitor de Artigos (Azure AI-200)

## 1. Problemas Identificados

### 1.1 Símbolo `#` em todos os títulos de seção
- **Causa**: O compilador Markdown (`scripts/lib/markdown.mjs`) injetava `<a href="#${slug}" class="heading-anchor">#</a>` dentro de cada tag `<h${depth}>`.
- **Impacto**: Usuário reportou que parecia erro de parsing de Markdown para HTML.
- **Solução**: Remover a injeção do link textual `#`, mantendo o `id="${slug}"` para ancoragem de links diretos e fragmentos da URL.

### 1.2 Ícone de lâmpada (`💡`) nos cartões de autoavaliação
- **Causa**: `scripts/lib/details.mjs` inseria `<span class="check-card-icon">💡</span>` antes do título de `<summary>`.
- **Impacto**: Usuário avaliou o emoji de lâmpada como desnecessário/pouco interessante.
- **Solução**: Remover o elemento `💡`, adotando estilização editorial limpa com chevron nativo/elegante no padrão Tech Topics.

### 1.3 Diagrama Mermaid quebrado (exibindo código em texto puro)
- **Causa**:
  1. Caractere `<` em `(<50k itens)` e `Latência < 5ms` interpretado pelo tokenizer do Mermaid em modo strict como abertura de tag HTML inválida (`<50k`), disparando exceção no parse.
  2. Uso de `\n` literal ao invés de `<br/>` em rótulos de nós do Mermaid.
  3. Formato de ID do Mermaid com underscores.
- **Solução**:
  1. Corrigir as fontes markdown nos capítulos para usar `<br/>` e substituir `<50k` por `até 50.000 itens` e `< 5ms` por `menor que 5ms`.
  2. Atualizar `web/mermaid-theme.js` para usar a versão 12.0.0 do Mermaid e sanitizar o texto antes do render.

### 1.4 Reestruturação da Home: Agrupamento por Capítulo e Filtros por Assunto/Tags
- **Solicitação do Usuário**:
  - Separar na home por capítulo, cada um em sua própria linha/seção ordenada logicamente (Capítulos 01 a 09 + Matrizes Comparativas).
  - Agregar tags por assunto e por capítulo para permitir filtragem rápida.
- **Solução**:
  - Adicionar na interface da home seções organizadas por capítulo (`.chapter-section`, `.chapter-heading`, `.chapter-grid`).
  - Expandir os filtros da barra (`#archive-filters`) com tags agregadas por assunto (ex: `Busca Vetorial`, `Change Feed`, `Indexação`, `SDK`, etc.) e por capítulo (`Cap. 04 · Cosmos DB`, `Matrizes Comparativas`).
  - Ordenar os capítulos na ordem canônica da ementa oficial.

---

## 2. Etapas de Execução

1. **Correções no Compilador Markdown & Details**:
   - `scripts/lib/markdown.mjs`: Remover `<a class="heading-anchor">#</a>`.
   - `scripts/lib/details.mjs`: Remover `<span class="check-card-icon">💡</span>`.
2. **Correção dos Diagramas Mermaid nos Capítulos**:
   - `chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial.md`: Atualizar para `flowchart TD`, trocar `\n` por `<br/>`, trocar `<50k` por `até 50.000 itens`.
   - `chapters/04-cosmos-db-nosql/cosmos-db-modelo-de-recursos-e-particionamento.md`: Trocar `< 5ms` por `menor que 5ms`.
   - `web/mermaid-theme.js`: Alinhar com `tech-topics` (Mermaid 12.0.0, IDs alfanuméricos limpos).
3. **Reestruturação da Home e Filtros**:
   - `web/app.js`: Implementar agrupamento por capítulo em linhas/seções ordenadas (`renderChapterSections()`), agregar tags por assunto e permitir filtros dinâmicos por capítulo ou assunto.
   - `web/styles.css`: Estilos para as seções de capítulo na home (`.chapter-section`, `.chapter-header`, `.chapter-meta`, `.tag-pill`), e polimento do `<details>` sem a lâmpada.
4. **Validação e Testes**:
   - Executar `npm run build`
   - Executar `npm run validate`
   - Executar `npm test` (garantir 218/218 testes passando)

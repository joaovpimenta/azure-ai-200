# Azure AI-200 Study Hub

Plataforma estática de estudo ativo, revisão de véspera e simulados para a certificação **Microsoft Certified: Azure AI Cloud Developer Associate (Exame AI-200 / Curso AI-200T00)**, construída sob a mesma engenharia determinística de compilação, validação e publicação no GitHub Pages do `joaovpimenta/tech-topics`.

---

## Principais Recursos de Estudo e Retenção

- **9 Trilhas Oficiais (`chapters/01..09`) + 4 Domínios de Peso da Prova**: organização em diretórios alinhada ao curso oficial [AI-200T00](https://learn.microsoft.com/pt-br/training/courses/ai-200t00#study-guide) e cruzada via frontmatter (`exam_domain`) com os pesos do Guia de Estudo do Exame AI-200.
- **Active Recall na Leitura**:
  - Lacunas interativas `==cloze==` (legíveis no GitHub puro e ocultáveis no leitor da página com atalho `Alt+R` ou `Espaço`/`Enter`).
  - Cartões de autoavaliação `<details><summary>...</summary>...</details>`.
  - Abas de código sincronizadas **Python SDK | C# (.NET) SDK** geradas automaticamente a partir de blocos consecutivos de código.
- **Cram Sheet & Matrizes Comparativas (`comparisons/`)**: visão consolidada de alta densidade reunindo automaticamente os `tldr` e as seções obrigatórias `## Pegadinhas de Prova` de todos os conceitos, além de tabelas comparativas de decisão arquitetural.
- **Simulador de Exame AI-200 (`exams/` + blocos `quiz`)**:
  - 5 formatos interativos: `single-choice`, `multiple-choice`, `code-completion` (Python, C#, Azure CLI, YAML, KQL), `ordering` e `case-study` (com 4 abas obrigatórias de contexto: *Visão Geral*, *Arquitetura Atual*, *Requisitos Técnicos* e *Requisitos de Segurança*).
  - **Modo Estudo** (feedback imediato com justificativa individual por alternativa) e **Modo Exame Cronometrado** (100 minutos, corte de 70%).
  - **Caderno de Erros** automático e filtro por trilha de linguagem (`Python`, `C#` ou `Agnóstico`).
- **Mapa de Cobertura e Prontidão (`syllabus/ai-200-blueprint.json`)**:
  - Acompanha o percentual de cobertura editorial da ementa oficial e o score pessoal ponderado pelos pesos oficiais dos 4 domínios (20–25%, 25–30%, 20–25%, 20–25%).
  - Persistência **offline-first** em `localStorage` (`schemaVersion: 1`), **Exportar/Importar JSON** e **Sincronização opcional com GitHub Gist privado**.
- **PWA Instalável Offline & Revisão em Áudio**:
  - `manifest.webmanifest` e Service Worker (`sw.js`) com cache versionado para estudo offline no computador ou celular.
  - Player de áudio com **Media Session API**, playlist sequencial por capítulo, suporte a MP3 gerados pelo pipeline desacoplado **Kokoro ONNX (`pf_dora`)** em GitHub Releases e fallback instantâneo via **Web Speech API**.

---

## Estrutura de Capítulos (Trilhas AI-200T00)

| Trilha | Diretório | Domínio Oficial AI-200 | Peso no Exame |
| :--- | :--- | :--- | :--- |
| **01** | [`chapters/01-container-hosting/`](chapters/01-container-hosting/README.md) | `containerized-solutions` | 20–25% |
| **02** | [`chapters/02-container-apps/`](chapters/02-container-apps/README.md) | `containerized-solutions` | 20–25% |
| **03** | [`chapters/03-aks/`](chapters/03-aks/README.md) | `containerized-solutions` | 20–25% |
| **04** | [`chapters/04-cosmos-db-nosql/`](chapters/04-cosmos-db-nosql/README.md) | `data-management` | **25–30%** |
| **05** | [`chapters/05-postgresql-pgvector/`](chapters/05-postgresql-pgvector/README.md) | `data-management` | **25–30%** |
| **06** | [`chapters/06-managed-redis/`](chapters/06-managed-redis/README.md) | `data-management` | **25–30%** |
| **07** | [`chapters/07-backend-integration/`](chapters/07-backend-integration/README.md) | `connect-and-consume` | 20–25% |
| **08** | [`chapters/08-secrets-and-config/`](chapters/08-secrets-and-config/README.md) | `secure-monitor-troubleshoot` | 20–25% |
| **09** | [`chapters/09-observe-and-troubleshoot/`](chapters/09-observe-and-troubleshoot/README.md) | `secure-monitor-troubleshoot` | 20–25% |

### Cobertura editorial completa

Todos os **35 artigos previstos no blueprint** estão implementados nas nove trilhas: 3 de hospedagem, 5 de Container Apps, 3 de AKS, 5 de Cosmos DB, 6 de PostgreSQL, 2 de Redis, 5 de integração de back-end, 3 de segredos/configuração e 3 de observabilidade.

Cada novo conceito inclui resumo para revisão, autoavaliação, pegadinhas de prova, referências oficiais e uma questão formativa integrada ao simulado. Exemplos de SDK apresentam Python e C# em blocos consecutivos; tópicos de infraestrutura usam CLI, YAML, SQL ou KQL conforme a operação.

### Capítulo Cosmos DB Completo (`04-cosmos-db-nosql`)

1. [Modelo de recursos, partition key e Request Units](chapters/04-cosmos-db-nosql/cosmos-db-modelo-de-recursos-e-particionamento.md)
2. [SDK: CosmosClient, CRUD, consultas parametrizadas e paginação](chapters/04-cosmos-db-nosql/cosmos-db-sdk-conexao-e-consultas.md)
3. [Políticas de indexação, níveis de consistência e otimização de RUs](chapters/04-cosmos-db-nosql/cosmos-db-indexacao-consistencia-rus.md)
4. [Embeddings, políticas vetoriais e VectorDistance()](chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial.md)
5. [Change feed processor: leases, delegates e reprocessamento](chapters/04-cosmos-db-nosql/cosmos-db-change-feed-processor.md)
- **Matriz Comparativa:** [Bancos de Dados Vetoriais no Azure: Cosmos DB for NoSQL vs PostgreSQL pgvector vs Managed Redis](comparisons/vector-stores-azure.md)

---

## Operação Local e Comandos

```bash
# 1. Instalar dependências
npm ci

# 2. Diagnóstico do ambiente e estrutura
npm run doctor

# 3. Executar gate determinístico de validação (frontmatter, tags, links, quizzes, XSS)
npm run validate

# 4. Compilar o site estático pré-renderizado em dist/
npm run build

# 5. Executar a suíte completa de testes automatizados
npm test

# 6. Gerar brief de autoria para um próximo conceito da ementa
npm run brief -- --chapter 02-container-apps --slug aca-escala-keda

# 7. Servir preview local em http://localhost:4173
npm run preview
```

---

## Publicação no GitHub Pages

1. Em **Settings → Pages** no repositório GitHub, selecione **Source: GitHub Actions**.
2. A cada push na branch `main`, o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) executa `npm run validate`, `npm run build` e `npm test`, publicando o diretório `dist/` automaticamente.
3. Pull Requests passam pelo gate determinístico em [`.github/workflows/validate.yml`](.github/workflows/validate.yml).
4. Para gerar narração em áudio sob demanda, acione manualmente [`.github/workflows/kokoro-audio.yml`](.github/workflows/kokoro-audio.yml) na aba **Actions**.

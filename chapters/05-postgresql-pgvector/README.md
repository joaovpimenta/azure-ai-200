# Capítulo 05: Azure Database for PostgreSQL e pgvector

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Gerenciamento%20de%20Dados%20para%20IA-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-25%20a%2030%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Planejado-orange?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

O **Azure Database for PostgreSQL Flexible Server** enriquecido com a extensão de código aberto **`pgvector`** transforma o motor relacional PostgreSQL em um repositório híbrido corporativo de IA de alta fidelidade. Essa arquitetura viabiliza pipelines de RAG (Retrieval-Augmented Generation) que combinam rigor transacional (ACID), dados estruturados relacionais, documentos JSONB e busca por similaridade vetorial na mesma consulta SQL, dispensando a sincronização complexa entre múltiplos bancos de dados.

No exame **AI-200**, o capítulo de PostgreSQL e `pgvector` é altamente técnico e exige domínio de:
1. **Conectividade SDK e Autenticação Passwordless**: Padrões de conexão usando bibliotecas líderes (`psycopg` em Python e `Npgsql` em .NET C#) integradas à autenticação segura via **Microsoft Entra ID** (antigo Azure AD) com tokens temporários, eliminando credenciais estáticas em arquivos de configuração.
2. **Modelagem de Esquemas e Índices Clássicos**: Criação de tabelas com colunas relacionais, documentos JSONB indexados por **GIN** (Generalized Inverted Index) e tipos escalares otimizados com índices **B-tree** para acelerar filtros de metadados em consultas RAG.
3. **Mecanismo `pgvector` (HNSW vs IVFFlat)**: Diferenciação matemática e operacional entre o algoritmo de grafos hierárquicos **HNSW** (Hierarchical Navigable Small World) e a divisão por células Voronoi **IVFFlat**, adoção do tipo compacto **`halfvec`** (16 bits) e seleção de operadores de distância: Cosseno (`<=>`), Euclidiana L2 (`<->`) e Produto Escalar (`<#>`).
4. **Dimensionamento de Recursos e Ajuste de Memória**: Configuração de vCores (Tiers General Purpose vs Memory Optimized), dimensionamento de IOPS de disco e ajuste fino de parâmetros de memória crítica no PostgreSQL, com destaque para **`maintenance_work_mem`** (essencial para evitar estouro de memória e lentidão extrema na criação de índices HNSW) e `shared_buffers`.
5. **RAG com Filtros de Metadados e Busca Híbrida**: Escrita de consultas SQL avançadas integrando filtros relacionais, operadores JSONB e similaridade vetorial com ordenação ponderada e *iterative index scan*.
6. **Pool de Conexões com PgBouncer**: Mitigação do modelo de conexão "process-per-client" do PostgreSQL através da ativação do pool gerenciado **PgBouncer** integrado, garantindo alta vazão e prevenindo erros de exaustão de conexões causados por frotas de microsserviços ou funções serverless.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Conectar e consultar o Azure Database for PostgreSQL usando SDKs oficiais (Python/C#) com autenticação Microsoft Entra ID.
- Modelar esquemas eficientes para dados de IA e escolher tipos de dados adequados (relacionais, JSONB e vetoriais).
- Implementar estratégias de indexação vetorial, otimizando latência e reduzindo o custo computacional do `pgvector` (HNSW vs IVFFlat).
- Configurar recursos de computação, memória e armazenamento para cargas de trabalho de vetores intensivas.
- Executar busca vetorial, armazenar embeddings e implementar padrões RAG com filtros avançados de metadados.
- Otimizar conexões com PgBouncer para melhorar o throughput e reduzir a latência de microsserviços de IA.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `postgresql-conexao-sdk-e-autenticacao` | Conexão com psycopg/Npgsql e autenticação Microsoft Entra | `postgresql` | Planejado | [Acessar Conceito](./postgresql-conexao-sdk-e-autenticacao.md) |
| 2 | `postgresql-modelagem-e-tipos` | Modelagem de esquemas, tipos de dados e índices B-tree/GIN | `postgresql` | Planejado | [Acessar Conceito](./postgresql-modelagem-e-tipos.md) |
| 3 | `pgvector-indices-hnsw-ivfflat` | pgvector: tipos vector/halfvec e índices HNSW vs IVFFlat | `postgresql` | Planejado | [Acessar Conceito](./pgvector-indices-hnsw-ivfflat.md) |
| 4 | `postgresql-recursos-para-cargas-vetoriais` | Compute, memória (maintenance_work_mem) e storage para vetores | `postgresql` | Planejado | [Acessar Conceito](./postgresql-recursos-para-cargas-vetoriais.md) |
| 5 | `postgresql-rag-com-filtros` | Busca vetorial e RAG com filtros de metadados | `postgresql` | Planejado | [Acessar Conceito](./postgresql-rag-com-filtros.md) |
| 6 | `postgresql-pool-de-conexoes-pgbouncer` | Pool de conexões, PgBouncer e otimização de throughput | `postgresql` | Planejado | [Acessar Conceito](./postgresql-pool-de-conexoes-pgbouncer.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Habilitação da Extensão `vector`**: No Azure Database for PostgreSQL, você DEVE primeiro habilitar a extensão no parâmetro de servidor `azure.extensions` (incluindo `vector` na lista de permissões). Somente após isso você poderá executar com sucesso `CREATE EXTENSION IF NOT EXISTS vector;` no banco de dados.
- **HNSW vs IVFFlat**:
  - Use **HNSW** quando a tabela sofrer inserções contínuas, quando a precisão (recall > 98%) for crítica e houver memória RAM suficiente. HNSW pode ser criado com a tabela vazia.
  - Use **IVFFlat** quando o tempo de compilação do índice e o consumo de memória precisarem ser mínimos. NUNCA crie IVFFlat em tabela vazia — os centroides não representarão a distribuição futura dos dados.
- **Parâmetro `maintenance_work_mem`**: Ao construir índices HNSW em tabelas com centenas de milhares de vetores, aumente temporariamente o parâmetro de sessão `SET maintenance_work_mem = '2GB';`. Caso contrário, a criação do índice pode demorar horas ou falhar por restrição de memória de trabalho.
- **PgBouncer Obrigatório para Serverless**: Em arquiteturas onde Azure Functions ou Container Apps executam consultas curtas com frequência, ative o **PgBouncer** integrado na porta 6432 para reaproveitar conexões existentes e não saturar a CPU do PostgreSQL.

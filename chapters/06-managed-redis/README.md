# Capítulo 06: Azure Managed Redis

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Gerenciamento%20de%20Dados%20para%20IA-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-25%20a%2030%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Completo-brightgreen?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

O **Azure Managed Redis** (evolução de nível corporativo do serviço de cache em memória da Microsoft, baseado na tecnologia Redis Enterprise) atua como acelerador de desempenho in-memory indispensável em soluções de Inteligência Artificial modernas. Operando integralmente na memória DRAM, o Redis entrega latências em escala de **sub-milissegundos** (0.5ms a 2ms no 99º percentil) e suporta centenas de milhares de operações por segundo com alta disponibilidade e replicação ativa.

No exame **AI-200**, o papel do Azure Managed Redis é estruturado em dois pilares cruciais:
1. **Padrão Cache-Aside e Ciclo de Vida de Dados**: Implementação determinística do padrão *Cache-Aside* para desonerar bancos de dados relacionais e NoSQL, controle refinado de expiração com tempo de vida (*Time-To-Live* - TTL), estratégias ativas de invalidação de dados em caso de mutações e configuração de políticas de expulsão de memória (*eviction policies*, como `volatile-lru`, `allkeys-lru` e `noeviction`).
2. **Índices Vetoriais RediSearch e Cache Semântico**: Utilização do módulo integrado RediSearch para criar índices vetoriais via `FT.CREATE` (suportando os algoritmos **HNSW** para grafos rápidos e **FLAT** para busca exata) e implementação do padrão de **Cache Semântico**. O cache semântico calcula a distância vetorial entre o embedding da nova pergunta do usuário e o histórico de perguntas armazenadas; se a distância for inferior a um limiar estabelecido, a resposta do LLM pré-computada é devolvida instantaneamente, poupando tempo de inferência e custos de tokens no Azure OpenAI.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Implementar operações fundamentais de dados em memória: cache-aside, definição e renovação de TTL, estratégias de invalidação e políticas de expulsão (*eviction*).
- Implementar indexação e busca vetorial com RediSearch para consultas de similaridade e arquitetura de cache semântico de respostas de modelos de linguagem.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `redis-cache-expiracao-invalidacao` | Cache-aside, TTL, políticas de eviction e invalidação | `managed-redis` | Implementado | [Acessar Conceito](./redis-cache-expiracao-invalidacao.md) |
| 2 | `redis-indexacao-vetorial` | Índices vetoriais (FT.CREATE, HNSW/FLAT) e cache semântico | `managed-redis` | Implementado | [Acessar Conceito](./redis-indexacao-vetorial.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Padrão Cache-Aside**:
  - Leitura: A aplicação consulta o Redis primeiro. Em caso de *Cache Hit*, devolve imediatamente. Em caso de *Cache Miss*, lê do banco de dados (Cosmos DB / PostgreSQL), grava o valor no Redis com TTL apropriado e devolve ao cliente.
  - Escrita: A aplicação atualiza o banco de dados principal e em seguida invalida (deleta) ou atualiza a chave correspondente no Redis para evitar leitura de dados obsoletos (*stale data*).
- **Políticas de Eviction Críticas**:
  - `volatile-lru`: Remove as chaves menos recentemente usadas que possuem um TTL configurado (mais segura para caches com dados transitórios).
  - `allkeys-lru`: Remove qualquer chave menos recentemente usada, mesmo que não possua TTL (pode descartar chaves permanentes de configuração).
  - `noeviction`: Retorna erro `OOM command not allowed` para comandos de escrita quando a memória estiver cheia. Perigoso para vetores se não houver monitoramento estrito de memória.
- **Cache Semântico para Modelos de Linguagem**: Ao usar `FT.SEARCH` para cache semântico, utilize a métrica `COSINE` e defina um limiar estrito de distância (ex.: distância cosseno $\le 0.10$, correspondendo a $\ge 90\%$ de similaridade semântica) para garantir que respostas cacheadas sejam contextualmente precisas e não induzam o usuário a erro com perguntas semanticamente distintas.
- **Imutabilidade do Índice `FT.CREATE`**: Uma vez criado o índice com `FT.CREATE`, você não pode alterar a dimensionalidade ou a métrica de distância dos campos vetoriais. Para atualizar, execute `FT.DROPINDEX <index_name> KEEPKEYS` (que exclui o índice mas preserva os dados originais em memória) e recrie o índice com a nova especificação.

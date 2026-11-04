---
title: Compute, memória (maintenance_work_mem) e storage para vetores
slug: postgresql-recursos-para-cargas-vetoriais
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - compute-sizing
  - memory-tuning
  - maintenance-work-mem
  - storage-iops
difficulty: intermediate
tldr: Dimensione vetores considerando dados, índices, memória de construção e concorrência.
  maintenance_work_mem afeta manutenção; não é o orçamento universal de consultas vetoriais.
related_links:
  - label: Ajustar desempenho de pgvector
    url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-optimize-performance-pgvector
    type: learn
  - label: Opções de computação
    url: https://learn.microsoft.com/en-us/azure/postgresql/compute-storage/concepts-compute
    type: learn
questions:
  - id: q-postgresql-recursos-para-cargas-vetoriais-01
    type: single-choice
    title: Compute, memória (maintenance_work_mem) e storage para vetores
    exam_domain: data-management
    stem: A equipe quer ajustar memória de construção do índice HNSW. Qual parâmetro é diretamente
      relevante?
    options:
      - id: opt-3
        text: O TTL de uma chave Redis.
        correct: false
        rationale: Expiração no cache não configura recursos do PostgreSQL.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-optimize-performance-pgvector
      - id: opt-4
        text: A porta do Service Kubernetes.
        correct: false
        rationale: Roteamento não altera memória de manutenção do banco.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-optimize-performance-pgvector
      - id: opt-1
        text: maintenance_work_mem, respeitando o orçamento do servidor.
        correct: true
        rationale: Esse parâmetro participa de operações de manutenção, incluindo construção do índice.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-optimize-performance-pgvector
      - id: opt-2
        text: Somente max_connections sem considerar memória.
        correct: false
        rationale: Mais conexões podem aumentar pressão e não definem memória de construção.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-optimize-performance-pgvector
    tags:
      - postgresql
      - compute-sizing
      - memory-tuning
      - maintenance-work-mem
      - storage-iops
---

# Compute, memória (maintenance_work_mem) e storage para vetores

Uma base vetorial pode ter consultas rápidas em um notebook e sofrer com latência no servidor compartilhado. O custo real combina armazenamento dos vetores, estrutura ANN, filtros relacionais, cache de páginas e consultas simultâneas.

## Estimar e observar

Um vetor de precisão simples tem aproximadamente `4 × dimensão` bytes de componentes, além de cabeçalhos e armazenamento de linhas. Multiplique por quantidade de chunks e considere índices, texto, metadados, versões antigas e folga operacional. O tamanho do vetor sozinho não representa o tamanho do banco.

| Recurso | Sinal de saturação | Decisão |
|---|---|---|
| CPU | Utilização alta e consultas custosas | Otimizar consulta ou aumentar compute |
| Memória | Cache insuficiente, pressão e swap quando observável | Reduzir concorrência, ajustar tipo ou capacidade |
| Storage/IOPS | Leituras e latência de disco elevadas | Índices, cache, tier e provisionamento |
| Conexões | Espera no pool e muitas sessões | Pooling e orçamento por réplica |

Não aumente compute sem confirmar o gargalo: um filtro sem índice ou uma consulta que não usa ANN pode continuar caro.

## Memória de manutenção e consulta

==maintenance_work_mem== limita memória de certas operações de manutenção, incluindo fases de construção do HNSW. Ele não equivale a `work_mem`, que pode ser consumido por operações de sort/hash em várias consultas e processos. Multiplicar valores por operações e concorrência evita um orçamento de RAM irreal.

Exemplo de inspeção e experimento em sessão de laboratório; confirme permissões e limites do servidor:

```sql
SHOW maintenance_work_mem;
SHOW work_mem;
SELECT pg_size_pretty(pg_total_relation_size('chunks'));
SELECT pg_size_pretty(pg_relation_size('chunks_embedding_hnsw'));
SET maintenance_work_mem = '256MB';
ANALYZE chunks;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM chunks
ORDER BY embedding <=> '[0.2,0.1,0.4]'::vector
LIMIT 5;
```

A dimensão do vetor deve corresponder à tabela do laboratório. `SET` afeta a sessão; não altera o servidor inteiro. Ajustes persistentes usam parâmetros do servidor e podem exigir reinício, conforme o parâmetro.

## Benchmark útil

Carregue dados representativos e compare latência p50/p95, recall, CPU e I/O com diferentes concorrências. Teste cache aquecido e cenário de leituras frias. Separe ingestão, construção de índice e consulta: otimizar uma fase pode piorar outra.

<details>
<summary>Checagem Rápida: Aumentar maintenance_work_mem acelera toda consulta SELECT?</summary>

Não. Ele atende operações de manutenção. Para consultas, examine plano, índices, parâmetros ANN, cache e concorrência.

</details>

Aumentos de capacidade precisam respeitar orçamento e limites de serviço. Para reconstruir índices em produção, planeje locks, espaço temporário e impacto sobre escritas; não trate o procedimento de laboratório como operação sem risco.

## Pegadinhas de Prova

- **Pegadinha 1: Mais memória sem limite**: Parâmetros elevados em sessões concorrentes podem esgotar o servidor.
- **Pegadinha 2: Storage é só capacidade**: IOPS e throughput também limitam o workload.
- **Pegadinha 3: Benchmark de uma consulta basta**: Teste concorrência, recall e distribuição real dos filtros.

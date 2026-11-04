---
title: "pgvector: tipos vector/halfvec e índices HNSW vs IVFFlat"
slug: pgvector-indices-hnsw-ivfflat
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - pgvector
  - hnsw
  - ivfflat
  - vector-type
  - halfvec
  - ann
difficulty: intermediate
tldr: pgvector adiciona vetores ao PostgreSQL. HNSW usa um grafo; IVFFlat agrupa
  vetores e deve ser criado com dados representativos. Compare velocidade,
  memória e recall com uma busca exata.
related_links:
  - label: Habilitar pgvector
    url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
    type: learn
questions:
  - id: q-pgvector-indices-hnsw-ivfflat-01
    type: single-choice
    title: "pgvector: tipos vector/halfvec e índices HNSW vs IVFFlat"
    exam_domain: data-management
    stem: Uma consulta usa distância cosseno com <=>. Qual classe de índice vetorial
      corresponde a essa métrica?
    options:
      - id: opt-2
        text: vector_l2_ops.
        correct: false
        rationale: Ela corresponde à distância euclidiana, não ao operador cosseno.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-3
        text: vector_ip_ops.
        correct: false
        rationale: Ela corresponde ao produto interno negativo.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-4
        text: Um GIN JSONB independentemente da coluna.
        correct: false
        rationale: O índice JSONB não implementa a busca ANN do vetor descrito.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-1
        text: vector_cosine_ops.
        correct: true
        rationale: Essa classe de operadores corresponde à distância cosseno para o tipo
          vector.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
    tags:
      - postgresql
      - pgvector
      - hnsw
      - ivfflat
      - vector-type
      - halfvec
      - ann
    learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
---

# pgvector: tipos vector/halfvec e índices HNSW vs IVFFlat

Um embedding é uma lista de números que representa conteúdo. O pgvector permite guardar essas listas no PostgreSQL e procurar vetores próximos. Índices aproximados aceleram a busca, mas podem deixar de encontrar alguns resultados relevantes: essa cobertura é medida pelo recall.

## Habilitar e escolher o tipo

No Azure Database for PostgreSQL, permita a extensão `vector` na configuração `azure.extensions` conforme as políticas do servidor. Depois execute `CREATE EXTENSION` em cada banco necessário. Verifique a versão disponível: recursos e limites de `halfvec` e índices variam com a versão instalada.

`vector(n)` armazena componentes em precisão simples; ==halfvec== usa meia precisão e pode reduzir memória, com possível perda numérica. A dimensão é contrato de dados, não parâmetro arbitrário do índice.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE chunks (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content text NOT NULL,
    embedding vector(3) NOT NULL
);
INSERT INTO chunks (content, embedding)
VALUES ('Manual de instalação', '[0.1,0.2,0.3]');
CREATE INDEX chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops);
SELECT id, content, embedding <=> '[0.2,0.1,0.4]'::vector AS distance
FROM chunks
ORDER BY embedding <=> '[0.2,0.1,0.4]'::vector
LIMIT 5;
```

Três dimensões tornam o exemplo legível; use a dimensão real do modelo. A consulta ordena pela distância crescente. Para cosseno, a similaridade pode ser calculada como `1 - distance`, mas o planejador precisa da forma adequada de `ORDER BY` para usar o índice.

## HNSW versus IVFFlat

| Critério | HNSW | IVFFlat |
|---|---|---|
| Estrutura | Grafo de vizinhança | Listas de vetores agrupados |
| Treinamento inicial | Não exige etapa de clustering | Construir com dados representativos |
| Construção e memória | Geralmente maiores | Geralmente menores |
| Ajuste de consulta | `hnsw.ef_search` | `ivfflat.probes` |
| Compromisso | Mais busca melhora recall e custa trabalho | Mais listas visitadas melhora recall e custa trabalho |

Para testar IVFFlat, substitua o índice HNSW por um índice `USING ivfflat (embedding vector_cosine_ops) WITH (lists = ...)`, escolhendo listas conforme o volume. Não crie ambos automaticamente sem medir o custo e os planos.

Métricas e classes precisam coincidir: `<->` com `vector_l2_ops`, `<=>` com ==vector_cosine_ops== e `<#>` com `vector_ip_ops`. O produto interno usa sinal negativo para permitir ordenação crescente.

<details>
<summary>Checagem Rápida: ANN garante os mesmos vizinhos da busca exata?</summary>

Não. Índices aproximados trocam recall por velocidade. Compare resultados com uma referência exata em um conjunto de avaliação.

</details>

## Pegadinhas de Prova

- **Dimensão resolve compatibilidade**: Mesmo tamanho não torna embeddings de modelos distintos comparáveis.
- **Qualquer ORDER BY usa o índice**: Operador, direção e limite devem permitir o plano vetorial esperado.
- **HNSW é gratuito em memória**: Construção e manutenção podem exigir RAM significativa; meça antes de dimensionar.

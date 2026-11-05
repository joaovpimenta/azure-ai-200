---
title: "Políticas de Indexação, Níveis de Consistência e Otimização de RUs"
slug: "cosmos-db-indexacao-consistencia-rus"
chapter: "04-cosmos-db-nosql"
exam_domain: "data-management"
tags:
  - cosmos-db
  - indexing
  - indexing-policies
  - included-paths
  - excluded-paths
  - composite-indexes
  - consistency
  - consistency-levels
  - strong-consistency
  - bounded-staleness
  - session-consistency
  - eventual-consistency
  - consistent-prefix
  - request-units
  - rus
  - throttling
  - rate-limits
  - 429-too-many-requests
  - nosql
  - python
  - csharp
difficulty: "advanced"
tldr: "Índices aceleram consultas e encarecem escritas. Session preserva leitura
  das próprias escritas com contexto de sessão. Autoscale tem piso; investigue
  partições sobrecarregadas em erros 429."
related_links:
  - label: "Políticas de indexação no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-\
      policy"
    type: "learn"
  - label: "Níveis de consistência no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/consistency-levels"
    type: "learn"
questions:
  - id: q-cosmos-consistency-01
    type: ordering
    title: Níveis de consistência
    exam_domain: data-management
    stem: Ordene os níveis de consistência do Cosmos DB do mais forte ao mais fraco.
      Compare as garantias de leitura, não uma promessa de latência.
    items:
      - text: "Strong: leitura da gravação confirmada mais recente"
        order: 1
      - text: "Bounded Staleness: atraso limitado por versões ou tempo"
        order: 2
      - text: "Session: leitura das próprias escritas com contexto de sessão"
        order: 3
      - text: "Consistent Prefix: leituras preservam a ordem das gravações"
        order: 4
      - text: "Eventual: convergência sem garantia imediata de ordem"
        order: 5
    tags:
      - cosmos-db
      - consistency
      - consistency-levels
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
    rationale: Strong lê a versão confirmada mais recente; Bounded Staleness admite
      atraso limitado; Session preserva garantias dentro da sessão. Consistent
      Prefix preserva ordem; Eventual garante convergência, sem ordem imediata.
  - id: q-cosmos-indexing-02
    type: single-choice
    title: Reduzir indexação desnecessária
    exam_domain: data-management
    stem: O contêiner guarda texto e embeddings de 1.536 dimensões. O índice
      vetorial já existe, mas o índice comum também inclui cada componente do
      vetor. Como reduzir trabalho nas escritas e manter os índices dos outros
      campos?
    options:
      - id: opt-a
        text: Adicionar /embedding/* a excludedPaths e manter vectorIndexes.
        correct: true
        rationale: Isso remove os componentes do índice comum sem remover o índice
          vetorial. A economia depende dos dados e da carga.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
      - id: opt-b
        text: Definir indexingMode como none.
        correct: false
        rationale: Isso remove os índices comuns de todos os campos; consultas podem
          exigir varredura e ficam sem a aceleração necessária.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
      - id: opt-c
        text: Mudar a consistência de Session para Eventual.
        correct: false
        rationale: Essa mudança não remove o trabalho de indexar cada componente do vetor.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
      - id: opt-d
        text: Criar índice composto de /id e /embedding.
        correct: false
        rationale: Índice composto não substitui índice vetorial nem elimina entradas
          desnecessárias do índice comum.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
    tags:
      - cosmos-db
      - indexing
      - indexing-policies
      - request-units
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-indexing-policy
---

# Indexação, consistência e RUs

Índices ajudam a localizar dados, mas também custam armazenamento e trabalho nas escritas. Consistência define quais versões uma leitura pode observar. RUs medem o custo dessas operações: ajuste os três conforme a aplicação.

## Indexar o que será consultado

Por padrão, a política inclui `/*`. Para busca vetorial, configure o índice vetorial separadamente e exclua os componentes do vetor do índice comum quando apropriado. Isso evita indexação escalar desnecessária; não remove o índice vetorial.

```json
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [{"path": "/*"}],
  "excludedPaths": [{"path": "/embedding/*"}],
  "compositeIndexes": [[
    {"path": "/tenantId", "order": "ascending"},
    {"path": "/createdAt", "order": "descending"}
  ]]
}
```

Esse trecho é uma política de indexação comum, não uma configuração completa de busca vetorial. Veja a [política e consulta vetoriais](./cosmos-db-busca-vetorial.md).

Um ==índice composto== atende ordenação por vários campos, como `ORDER BY c.tenantId ASC, c.createdAt DESC`. Ele também pode reduzir custo de filtros combinados; não é obrigatório para qualquer combinação de igualdade e intervalo. Meça o consumo real, sem assumir uma economia fixa.

## Escolher a consistência

| Nível | Garantia principal |
|---|---|
| Strong | Lê a gravação confirmada mais recente |
| Bounded Staleness | Limita o atraso por versões ou tempo |
| Session | Preserva leitura das próprias escritas na sessão |
| Consistent Prefix | Não mostra gravações fora de ordem |
| Eventual | Réplicas convergem, sem garantia imediata de ordem |

Strong e Bounded Staleness custam o dobro de RUs de leitura dos outros três níveis para a mesma operação. Não confunda essa regra com um tempo de resposta garantido.

Em ==Session==, o SDK acompanha tokens de sessão. Se uma escrita ocorre no serviço A e a leitura no B, propague o token quando precisar preservar essa garantia entre clientes.

<details>
<summary>Checagem Rápida: Aumentar consistência reduz o custo de uma busca vetorial?</summary>

Não. Consistência trata da versão dos dados, não do algoritmo de busca. Revise índices, filtros e escopo da consulta para reduzir custo.

</details>

## Capacidade e HTTP 429

No modo manual, você provisiona RU/s. No autoscale, define um teto; um exemplo de 4.000 RU/s opera entre 400 e 4.000 RU/s. Autoscale não significa escala a zero nem capacidade ilimitada.

HTTP 429 indica limitação de taxa. Respeite `x-ms-retry-after-ms`, verifique as retentativas já feitas pelo SDK e investigue consultas caras ou partições sobrecarregadas. Filas podem amortecer picos; aumentar capacidade só ajuda se esse for o gargalo.

## Pegadinhas de Prova

- **Excluir vetor não exclui índice vetorial:** `excludedPaths` e `vectorIndexes` têm funções diferentes.
- **Índice composto tem direção:** a sequência deve atender ao `ORDER BY`; inverter todas as direções também pode reutilizar o índice.
- **Session não é garantia global:** clientes independentes precisam do contexto de sessão para preservar leitura das próprias escritas.
- **Autoscale mantém um piso:** considere capacidade mínima e regras de cobrança; tráfego zero não significa custo zero.

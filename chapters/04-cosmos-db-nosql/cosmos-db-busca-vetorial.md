---
title: "Embeddings, Políticas Vetoriais e VectorDistance()"
slug: "cosmos-db-busca-vetorial"
chapter: "04-cosmos-db-nosql"
exam_domain: "data-management"
tags:
  - cosmos-db
  - vector-search
  - embeddings
  - vectordistance
  - diskann
  - vector-embedding-policy
  - flat-index
  - quantized-flat
  - rag
  - distance-metrics
  - cosine-similarity
  - ann
  - nosql
  - python
  - csharp
difficulty: "advanced"
tldr: "Configure a política do vetor e seu índice. Flat é exato e limitado a 505
  dimensões; quantizedFlat e DiskANN chegam a 4.096. Use VectorDistance no ORDER
  BY e filtre documentos autorizados."
related_links:
  - label: "Busca vetorial no Azure Cosmos DB for NoSQL"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search"
    type: "learn"
  - label: "Índice vetorial DiskANN no Azure Cosmos DB"
    url: "https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/vector-search#vector-indexing-policies"
    type: "learn"
questions:
  - id: q-cosmos-vector-01
    type: multiple-choice
    title: Configurar DiskANN
    exam_domain: data-management
    stem: Você escolheu DiskANN para buscar em 2 milhões de embeddings de 1.536
      dimensões no Cosmos DB. Quais DUAS configurações devem declarar o vetor e
      seu índice?
    select_count: 2
    options:
      - id: opt-a
        text: Definir vectorEmbeddingPolicy com caminho, tipo, dimensão e métrica.
        correct: true
        rationale: A política descreve como interpretar o vetor armazenado.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
      - id: opt-b
        text: Adicionar o índice diskANN em vectorIndexes.
        correct: true
        rationale: O índice fornece a estrutura de busca aproximada escolhida no cenário.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
      - id: opt-c
        text: Adicionar o vetor a spatialIndexes.
        correct: false
        rationale: Índices espaciais atendem dados geográficos, como pontos e polígonos.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
      - id: opt-d
        text: Usar /embedding como chave de partição.
        correct: false
        rationale: A chave distribui documentos; não substitui política ou índice
          vetorial.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
    tags:
      - cosmos-db
      - vector-search
      - diskann
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
  - id: q-cosmos-vector-02
    type: code-completion
    title: Busca vetorial com filtro
    exam_domain: data-management
    stem: Complete a consulta que filtra por categoria e retorna os cinco vetores
      mais próximos. A política usa distância cosseno.
    code_template: |-
      SELECT TOP 5 c.id, c.title, {{slot_func}} AS distance
      FROM c
      WHERE c.category = @category
      ORDER BY {{slot_order}}
    slots:
      - id: slot_func
        options:
          - text: VectorDistance(c.embedding, @queryVector)
            correct: true
            rationale: VectorDistance calcula a distância conforme a política. Com cosseno,
              valores menores indicam maior proximidade.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
          - text: CosineSimilarity(c.embedding, @queryVector)
            correct: false
            rationale: CosineSimilarity não é uma função nativa de sistema no SQL API do
              Cosmos DB; a função canônica é VectorDistance.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
      - id: slot_order
        options:
          - text: VectorDistance(c.embedding, @queryVector)
            correct: true
            rationale: No Cosmos DB, a função VectorDistance() deve constar na cláusula
              ORDER BY para que o otimizador utilize o índice vetorial
              subjacente (DiskANN/Flat).
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
          - text: c.id ASC
            correct: false
            rationale: Ordenar por c.id não retornará os vizinhos mais próximos e impedirá o
              uso do índice vetorial.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
    tags:
      - cosmos-db
      - vector-search
      - vectordistance
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search
---

# Embeddings, política vetorial e VectorDistance()

Um embedding é uma lista de números que representa conteúdo. Cosmos DB pode guardar texto, metadados e esse vetor no mesmo documento. A busca vetorial encontra documentos próximos da pergunta; no RAG, eles servem de contexto para o modelo responder.

## Duas configurações diferentes

A ==vectorEmbeddingPolicy== define caminho, tipo, dimensão e métrica. ==vectorIndexes== define como acelerar a busca nesse caminho. Modelo e dimensão devem ser compatíveis nos documentos e nas perguntas.

```json
{
  "vectorEmbeddingPolicy": {
    "vectorEmbeddings": [{
      "path": "/embedding",
      "dataType": "float32",
      "dimensions": 1536,
      "distanceFunction": "cosine"
    }]
  },
  "indexingPolicy": {
    "indexingMode": "consistent",
    "automatic": true,
    "includedPaths": [{"path": "/*"}],
    "excludedPaths": [{"path": "/embedding/*"}],
    "vectorIndexes": [{"path": "/embedding", "type": "diskANN"}]
  }
}
```

Esse fragmento configura os vetores; o contêiner ainda precisa de nome e chave, como `/tenantId`. Excluir `/embedding/*` do índice comum evita indexar cada componente como número isolado. O índice vetorial continua configurado em `vectorIndexes`.

## Qual índice usar?

| Tipo | Como busca | Dimensão máxima |
|---|---|---|
| `flat` | Comparação exata | 505 |
| `quantizedFlat` | Compara vetores comprimidos; pode perder precisão | 4.096 |
| `diskANN` | Busca aproximada por grafo, indicada para maior escala | 4.096 |

Recall mede quantos vizinhos esperados a busca encontra. Índices aproximados não garantem recall fixo nem latência fixa. `quantizedFlat` e `diskANN` precisam de pelo menos 1.000 vetores indexados; abaixo disso, a busca pode usar varredura completa.

## Consulta com Python e C#

Pré-requisitos: contêiner `KnowledgeBase/DocumentEmbeddings` configurado como acima, dados com vetores de 1.536 dimensões e identidade com `Cosmos DB Built-in Data Reader`. Instale `azure-cosmos` e `azure-identity`, ou `Microsoft.Azure.Cosmos` e `Azure.Identity` em .NET 8. Defina `COSMOS_ENDPOINT` e salve o embedding real da pergunta como array JSON em `query-vector.json`.

```python
import json
import os
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

with open("query-vector.json", encoding="utf-8") as file:
    vector: list[float] = json.load(file)
if len(vector) != 1536:
    raise ValueError("Esperado embedding com 1536 dimensões")
with CosmosClient(os.environ["COSMOS_ENDPOINT"], DefaultAzureCredential()) as client:
    container = client.get_database_client("KnowledgeBase").get_container_client("DocumentEmbeddings")
    items = container.query_items(
        query="""SELECT TOP 5 c.id, c.text,
                 VectorDistance(c.embedding, @vector) AS distance
                 FROM c WHERE c.tenantId = @tenant
                 ORDER BY VectorDistance(c.embedding, @vector)""",
        parameters=[{"name": "@vector", "value": vector},
                    {"name": "@tenant", "value": "tenant-contoso"}],
        partition_key="tenant-contoso",
    )
    for item in items:
        print(item["id"], item["distance"])
```

```csharp
using System.Text.Json;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

float[] vector = JsonSerializer.Deserialize<float[]>(
    await File.ReadAllTextAsync("query-vector.json"))!;
if (vector.Length != 1536) throw new ArgumentException("Esperadas 1536 dimensões");
using var client = new CosmosClient(
    Environment.GetEnvironmentVariable("COSMOS_ENDPOINT")!, new DefaultAzureCredential());
var container = client.GetContainer("KnowledgeBase", "DocumentEmbeddings");
var query = new QueryDefinition(
    "SELECT TOP 5 c.id, c.text, VectorDistance(c.embedding, @vector) AS distance " +
    "FROM c WHERE c.tenantId = @tenant ORDER BY VectorDistance(c.embedding, @vector)")
    .WithParameter("@vector", vector).WithParameter("@tenant", "tenant-contoso");
using var iterator = container.GetItemQueryIterator<dynamic>(query,
    requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey("tenant-contoso") });
while (iterator.HasMoreResults)
    foreach (var item in await iterator.ReadNextAsync())
        Console.WriteLine($"{item.id}: {item.distance}");
```

O cliente fixo é didático; em produção, derive `tenantId` da autorização. Com distância cosseno, menor valor significa maior proximidade. `WHERE` restringe documentos elegíveis; não presuma uma ordem física fixa de execução dos filtros.

<details>
<summary>Checagem Rápida: Vetor com filtro de categoria já é busca híbrida?</summary>

Não. Isso é busca vetorial com filtro. Busca híbrida combina relevância textual e vetorial, normalmente com um método de fusão das classificações.

</details>

## Pegadinhas de Prova

- **Dimensão importa:** um vetor de três números não substitui um embedding de 1.536 dimensões. Valide os dados antes de gravar e consultar.
- **Flat tem limite:** não atende vetores de 1.536 dimensões, mesmo em uma coleção pequena.
- **Política não é índice:** configure ambos; use `VectorDistance` no `ORDER BY` para a busca ordenada por proximidade.
- **Alterações de política exigem planejamento:** a documentação atual permite adicionar/remover caminhos. Para mudar uma configuração existente, remova e recrie a política/índice correspondente; planeje reindexação e impacto antes de aplicar.

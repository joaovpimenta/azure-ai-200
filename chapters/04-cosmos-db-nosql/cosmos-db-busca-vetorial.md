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
tldr: "A busca vetorial no Azure Cosmos DB for NoSQL utiliza a função SQL VectorDistance() integrada a índices vetoriais especializados: Flat (exato), QuantizedFlat (quantização escalar) e DiskANN (baseado em grafo para larga escala). Vetores devem ser configurados em vectorEmbeddingPolicy e indexados em vectorIndexes."
related_links:
  - label: "Busca vetorial no Azure Cosmos DB for NoSQL"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search"
    type: "learn"
  - label: "Índice vetorial DiskANN no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/vector-indexing#diskann"
    type: "learn"
questions:
  - id: "q-cosmos-vector-01"
    type: "multiple-choice"
    title: "Requisitos de Configuração para Busca Vetorial de Alta Escala com DiskANN"
    exam_domain: "data-management"
    stem: "Você precisa habilitar busca vetorial aproximada (ANN) para uma base com mais de 2 milhões de embeddings de 1536 dimensões no Azure Cosmos DB for NoSQL com menor latência e consumo equilibrado de memória. Quais DUAS configurações são mandatórias na definição do contêiner?"
    select_count: 2
    options:
      - id: "opt-a"
        text: "Definir um vectorEmbeddingPolicy no contêiner especificando o caminho, tipo de dado (float32), dimensões e métrica de distância."
        correct: true
        rationale: "O vectorEmbeddingPolicy registra formalmente a presença do campo vetorial, suas dimensões e a função de distância esperada."
      - id: "opt-b"
        text: "Configurar um índice do tipo 'diskANN' dentro da seção vectorIndexes da política de indexação."
        correct: true
        rationale: "O DiskANN é o algoritmo de índice baseado em grafo desenvolvido pela Microsoft Research, ideal para coleções com milhões de vetores de alta dimensionalidade."
      - id: "opt-c"
        text: "Adicionar o caminho do vetor na cláusula spatialIndexes da política de indexação."
        correct: false
        rationale: "spatialIndexes é usado para dados geoespaciais (Point, Polygon, LineString), e não para embeddings de IA."
      - id: "opt-d"
        text: "Configurar a chave de partição do contêiner obrigatoriamente como /embedding."
        correct: false
        rationale: "Um vetor de alta dimensionalidade jamais deve ser usado como chave de partição; ela deve permanecer em um identificador lógico como /tenantId."
    tags:
      - cosmos-db
      - vector-search
      - diskann
  - id: "q-cosmos-vector-02"
    type: "code-completion"
    title: "Sintaxe SQL para Consulta Vetorial Híbrida com VectorDistance"
    exam_domain: "data-management"
    stem: "Complete a instrução SQL parametrizada para executar uma busca híbrida no Azure Cosmos DB for NoSQL, filtrando por categoria de documento e ordenando pelos 5 vetores mais similares usando a função nativa de distância vetorial."
    code_template: "SELECT TOP 5 c.id, c.title, {{slot_func}} AS SimilarityScore\nFROM c\nWHERE c.category = @category\nORDER BY {{slot_order}}"
    slots:
      - id: "slot_func"
        options:
          - text: "VectorDistance(c.embedding, @queryVector)"
            correct: true
            rationale: "VectorDistance é a função interna do Cosmos DB que calcula a similaridade entre o vetor gravado e o vetor da consulta."
          - text: "CosineSimilarity(c.embedding, @queryVector)"
            correct: false
            rationale: "CosineSimilarity não é uma função nativa de sistema no SQL API do Cosmos DB; a função canônica é VectorDistance."
      - id: "slot_order"
        options:
          - text: "VectorDistance(c.embedding, @queryVector)"
            correct: true
            rationale: "No Cosmos DB, a função VectorDistance() deve constar na cláusula ORDER BY para que o otimizador utilize o índice vetorial subjacente (DiskANN/Flat)."
          - text: "c.id ASC"
            correct: false
            rationale: "Ordenar por c.id não retornará os vizinhos mais próximos e impedirá o uso do índice vetorial."
    tags:
      - cosmos-db
      - vector-search
      - vectordistance
---

# Embeddings, Políticas Vetoriais e VectorDistance()

A integração de recursos de **Busca Vetorial Nativa** no **Azure Cosmos DB for NoSQL** transforma a base de dados transacional em um repositório unificado para arquiteturas RAG (Retrieval-Augmented Generation). Ao armazenar metadados, conteúdo textual e embeddings no mesmo documento JSON, a solução elimina a latência, a complexidade de sincronização e os custos adicionais decorrentes de manter bancos de dados relacionais e bancos vetoriais isolados.

---

## 1. Arquitetura de Embeddings no Cosmos DB NoSQL

Diferente de bancos de dados relacionais que exigem tipos de dados binários rígidos ou extensões como `pgvector`, o Cosmos DB manipula vetores como **arrays numéricos padrão no JSON**:
- Vetores de 1536 dimensões (`text-embedding-3-small`, `ada-002`) ou 3072 dimensões (`text-embedding-3-large`).
- Armazenamento co-localizado com propriedades de controle de acesso (`tenantId`, `userId`, `roles`) e metadados (`timestamp`, `tags`).

---

## 2. Configuração do Contêiner: `vectorEmbeddingPolicy`

Para que o Cosmos DB reconheça um array numérico como um embedding e aplique aceleração por hardware, é obrigatório registrar a política de embeddings na criação do contêiner:

A estrutura `vectorEmbeddingPolicy` requer quatro propriedades fundamentais:
1. `path`: Caminho JSON da propriedade vetorial (ex: `"/embedding"`).
2. `dataType`: Tipo primitivo numérico do vetor. Os tipos suportados são:
   - ==`float32`== (padrão e mais utilizado para modelos OpenAI).
   - `float16`, `int8`, `uint8` (para modelos com quantização prévia).
3. `dimensions`: Número inteiro que expressa o tamanho do espaço vetorial (até ==4096 dimensões==).
4. `distanceFunction`: Métrica matemática de distância espacial:
   - `cosine`: Similaridade de cosseno. Padrão ouro para busca semântica em textos (avalia o ângulo entre vetores, ignorando magnitude).
   - `dotproduct`: Produto escalar. Recomendado para vetores normalizados na norma $L_2$ por sua alta velocidade de computação.
   - `euclidean`: Distância Euclidiana ($L_2$). Avalia a distância linear absoluta no espaço vetorial.

---

## 3. Tipos de Índices Vetoriais: Flat, QuantizedFlat e DiskANN

Dentro da `indexingPolicy`, a seção `vectorIndexes` define o algoritmo de busca:

```mermaid
flowchart TD
    V["Índices Vetoriais no Cosmos DB"] --> Flat["Flat · Exato k-NN"]
    V --> QFlat["QuantizedFlat · ANN com Compressão"]
    V --> DiskANN["DiskANN · ANN em Grafo / Larga Escala"]

    Flat --> F_Desc["100% Recall / Força bruta<br/>Até 505 dimensões recomendadas<br/>Pequenos volumes (até 50.000 itens)"]
    QFlat --> Q_Desc["Quantização escalar em RAM<br/>Até 4096 dimensões<br/>Excelente equilíbrio RU/Latência"]
    DiskANN --> D_Desc["Baseado em Grafo (MSR)<br/>Armazena vetores compactados em disco SSD<br/>Escala para bilhões de vetores"]
```

| Tipo de Índice | Mecanismo | Dimensões Máximas | Recall | Escala Recomendada |
|---|---|---|---|---|
| **Flat** | Força bruta (k-Nearest Neighbors exato). Compara a query contra cada item da partição. | Até 505 dimensões | ==100% (Exato)== | Coleções pequenas (< 50.000 itens) |
| **QuantizedFlat** | Comprime os vetores usando quantização escalar, mantendo os códigos quantizados na memória. | Até ==4096 dimensões== | ~95% (Aproximado) | Volumes médios; excelente relação de RUs |
| **DiskANN** | Algoritmo baseado em grafos desenvolvido pela Microsoft Research. Armazena o grafo em SSD. | Até ==4096 dimensões== | > 95% (Aproximado) | ==Larga escala (milhões a bilhões de vetores)== |

> **Atenção**: Para que os índices `quantizedFlat` e `diskANN` funcionem, a propriedade de vetor **deve ser obrigatoriamente excluída** de `excludedPaths` do índice invertido padrão.

---

## 4. Consultas com a Função SQL `VectorDistance()`

A função do sistema `VectorDistance()` calcula a similaridade espacial entre dois vetores dentro de consultas SQL:

$$\text{VectorDistance}(c.\text{embedding}, \quad @\text{queryVector})$$

### Sintaxe SQL Canônica para Busca Semântica
```sql
SELECT TOP 5
    c.id,
    c.text,
    c.category,
    VectorDistance(c.embedding, @queryVector) AS SimilarityScore
FROM c
WHERE c.category = @filterCategory AND c.tenantId = @tenantId
ORDER BY VectorDistance(c.embedding, @queryVector)
```

### Busca Híbrida e Filtragem Pré-Vetorial (Pre-Filtering)
O motor de consulta do Cosmos DB executa a filtragem de forma integrada:
1. Os filtros relacionais escalares na cláusula `WHERE` (como `c.category = @filterCategory`) são avaliados primeiro utilizando os **índices invertidos tradicionais**.
2. O subconjunto de documentos qualificados é então submetido ao grafo vetorial (**DiskANN**), que seleciona os $K$ vizinhos mais próximos.
3. Isso garante que permissões de segurança por tenant ou categoria sejam aplicadas antes da ordenação por relevância semântica.

<details>
<summary>Checagem Rápida: O que acontece se utilizarmos VectorDistance() apenas na cláusula WHERE sem ORDER BY?</summary>

Se você tentar executar `SELECT * FROM c WHERE VectorDistance(c.embedding, @vector) < 0.2`, o Cosmos DB **não utilizará o índice vetorial**. Ele será forçado a executar uma varredura completa da tabela (Full Table Scan), calculando a distância de cada item individualmente em tempo de execução, o que resultará em alto consumo de RUs e lentidão. O índice vetorial é ativado quando `VectorDistance()` é colocado na cláusula `ORDER BY`.
</details>

---

## 5. Implementação Prática Dual SDK (Python e C#)

Abaixo, a criação de um contêiner configurando a política vetorial com métrica `cosine`, índice `diskANN` e execução de busca vetorial parametrizada:

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

endpoint = "https://ai200-cosmos-nosql.documents.azure.com:443/"
client = CosmosClient(url=endpoint, credential=DefaultAzureCredential())
database = client.get_database_client("KnowledgeBase")

# 1. Definição da Vector Embedding Policy
vector_embedding_policy = {
    "vectorEmbeddings": [
        {
            "path": "/embedding",
            "dataType": "float32",
            "dimensions": 1536,
            "distanceFunction": "cosine"
        }
    ]
}

# 2. Definição da Indexing Policy com DiskANN
indexing_policy = {
    "indexingMode": "consistent",
    "automatic": True,
    "includedPaths": [{"path": "/*"}],
    "excludedPaths": [{"path": "/embedding/*"}], # Exclui do índice invertido
    "vectorIndexes": [
        {
            "path": "/embedding",
            "type": "diskANN"
        }
    ]
}

container = database.create_container_if_not_exists(
    id="DocumentEmbeddings",
    partition_key={"paths": ["/tenantId"], "kind": "Hash"},
    indexing_policy=indexing_policy,
    vector_embedding_policy=vector_embedding_policy
)

# 3. Execução de Busca Vetorial com Parâmetro
query_vector = [0.0152, -0.0231, 0.0891] # Vetor de 1536 dimensões (resumido)
query_sql = """
SELECT TOP 3 c.id, c.text, VectorDistance(c.embedding, @vector) AS Score
FROM c
WHERE c.tenantId = @tenant
ORDER BY VectorDistance(c.embedding, @vector)
"""

results = container.query_items(
    query=query_sql,
    parameters=[
        {"name": "@vector", "value": query_vector},
        {"name": "@tenant", "value": "tenant-contoso"}
    ],
    partition_key="tenant-contoso"
)

for doc in results:
    print(f"ID: {doc['id']} | Similaridade: {doc['Score']}")
```

```csharp
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

string endpoint = "https://ai200-cosmos-nosql.documents.azure.com:443/";
CosmosClient client = new CosmosClient(endpoint, new DefaultAzureCredential());
Database database = client.GetDatabase("KnowledgeBase");

// 1. Configuração de ContainerProperties com política de embedding
ContainerProperties containerProperties = new ContainerProperties("DocumentEmbeddings", "/tenantId");

containerProperties.VectorEmbeddingPolicy = new VectorEmbeddingPolicy(
    new Collection<Embedding>
    {
        new Embedding
        {
            Path = "/embedding",
            DataType = VectorDataType.Float32,
            Dimensions = 1536,
            DistanceFunction = DistanceFunction.Cosine
        }
    }
);

// 2. Política de indexação vetorial com DiskANN
containerProperties.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/embedding/*" });
containerProperties.IndexingPolicy.VectorIndexes.Add(
    new VectorIndexPath
    {
        Path = "/embedding",
        Type = VectorIndexType.DiskANN
    }
);

Container container = await database.CreateContainerIfNotExistsAsync(containerProperties);

// 3. Consulta vetorial com VectorDistance() e parâmetros
float[] queryVector = new float[] { 0.0152f, -0.0231f, 0.0891f }; // Representação conceitual

QueryDefinition queryDefinition = new QueryDefinition(
    @"SELECT TOP 3 c.id, c.text, VectorDistance(c.embedding, @vector) AS Score
      FROM c
      WHERE c.tenantId = @tenant
      ORDER BY VectorDistance(c.embedding, @vector)")
    .WithParameter("@vector", queryVector)
    .WithParameter("@tenant", "tenant-contoso");

using FeedIterator<dynamic> iterator = container.GetItemQueryIterator<dynamic>(
    queryDefinition,
    requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey("tenant-contoso") }
);

while (iterator.HasMoreResults)
{
    FeedResponse<dynamic> response = await iterator.ReadNextAsync();
    foreach (var item in response)
    {
        Console.WriteLine($"ID: {item.id} - Score: {item.Score}");
    }
}
```

---

## Pegadinhas de Prova

- **Imutabilidade da Vector Policy**: As políticas de vetores (`vectorEmbeddingPolicy`) e seus índices associados só podem ser definidos **no momento da criação do contêiner**. Você não pode habilitar busca vetorial em um contêiner existente sem recriá-lo e migrar os dados.
- **VectorDistance() obrigatório no ORDER BY**: Para utilizar o índice vetorial (DiskANN ou Flat), a função `VectorDistance()` deve estar presente no `ORDER BY`. Se você ordenar por outra coluna (ex: `ORDER BY c.createdAt`), o índice vetorial será ignorado e a consulta incorrerá em custo catastrófico de RUs.
- **Tipos de Dados dos Vetores**: O Cosmos DB valida estritamente a dimensionalidade do array no momento da gravação. Se a política especificar 1536 dimensões e você enviar um array com 1535 ou 1537 elementos, a operação de escrita será rejeitada com erro de validação de esquema (`HTTP 400 Bad Request`).
- **DiskANN vs Flat**: Em questões que descrevem catálogos pequenos (< 30.000 itens) ou que exigem garantia absoluta de precisão exata (100% recall), a resposta correta é o índice **Flat**. Quando a questão menciona milhões de itens, larga escala ou alta taxa de transferência, a resposta correta é **DiskANN**.

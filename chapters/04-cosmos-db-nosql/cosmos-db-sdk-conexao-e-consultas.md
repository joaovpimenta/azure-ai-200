---
title: "SDK: CosmosClient, CRUD, Consultas Parametrizadas e Paginação"
slug: "cosmos-db-sdk-conexao-e-consultas"
chapter: "04-cosmos-db-nosql"
exam_domain: "data-management"
tags:
  - cosmos-db
  - cosmosclient
  - crud
  - sql-queries
  - parameterized-queries
  - pagination
  - continuation-token
  - sdk
  - python
  - csharp
  - nosql
difficulty: "intermediate"
tldr: "Reutilize CosmosClient. Com id e chave completa, prefira leitura pontual.
  Python usa Gateway; .NET também oferece Direct. MaxItemCount limita cada
  página, não o total da consulta."
related_links:
  - label: "Melhores práticas de desempenho para o SDK do Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips"
    type: "learn"
  - label: "Conectar ao Azure Cosmos DB com Direct Mode"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/sdk-connection-modes"
    type: "learn"
questions:
  - id: q-cosmos-sdk-01
    type: code-completion
    title: Reutilizar o cliente .NET
    exam_domain: data-management
    stem: Complete o registro de um CosmosClient compartilhado em C#. Use Direct e,
      neste exercício, até nove retentativas para HTTP 429. A rede já permite
      esse modo.
    code_template: >-
      services.AddSingleton<CosmosClient>(sp => {
          CosmosClientOptions options = new CosmosClientOptions
          {
              ConnectionMode = {{slot_mode}},
              MaxRetryAttemptsOnRateLimitedRequests = {{slot_retries}},
              MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(30)
          };
          return new CosmosClient(endpoint, new DefaultAzureCredential(), {{slot_options}});
      });
    slots:
      - id: slot_mode
        options:
          - text: ConnectionMode.Direct
            correct: true
            rationale: Direct acessa as réplicas por TCP e atende ao modo solicitado.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
          - text: ConnectionMode.Gateway
            correct: false
            rationale: Gateway é válido, mas não é o modo pedido neste exercício.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
      - id: slot_retries
        options:
          - text: "9"
            correct: true
            rationale: Nove tentativas é o limite solicitado; em produção, ajuste ao
              orçamento de tempo.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
          - text: "0"
            correct: false
            rationale: Zero desativa essas retentativas e não atende ao exercício.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
      - id: slot_options
        options:
          - text: options
            correct: true
            rationale: Passe o objeto configurado ao construtor.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
          - text: "null"
            correct: false
            rationale: Null deixa de aplicar as opções explícitas deste exemplo.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
    tags:
      - cosmos-db
      - cosmosclient
      - csharp
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
  - id: q-cosmos-sdk-02
    type: single-choice
    title: Ler um item conhecido
    exam_domain: data-management
    stem: A aplicação usa consistência Session e conhece id e chave completa do
      item. Qual operação evita o trabalho de uma consulta SQL para recuperar
      esse único documento?
    options:
      - id: opt-a
        text: Usar read_item / ReadItemAsync com id e chave completa.
        correct: true
        rationale: A leitura pontual dispensa o processamento SQL. Com Session, um item
          de 1 KB custa 1 RU; itens maiores custam mais.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
      - id: opt-b
        text: Adicionar TOP 1 à consulta SQL.
        correct: false
        rationale: Limita o resultado, mas continua sendo uma consulta SQL.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
      - id: opt-c
        text: Mudar apenas para consistência Eventual.
        correct: false
        rationale: Não transforma a consulta em leitura pontual; Session já oferece o
          mesmo custo-base de leitura pontual.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
      - id: opt-d
        text: Criar índice composto de id e tenantId.
        correct: false
        rationale: O índice não elimina o processamento SQL; a chave completa e o id já
          permitem localizar o item diretamente.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
    tags:
      - cosmos-db
      - crud
      - request-units
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/performance-tips
---

# CosmosClient, leitura pontual, consultas e paginação

O SDK é a biblioteca usada pela aplicação para acessar Cosmos DB. Reutilize um `CosmosClient` por conta e configuração durante a vida do processo: ele mantém conexões e informações de roteamento. Criar um cliente a cada requisição desperdiça esse trabalho.

## Direct e Gateway

| Modo | SDKs e conexão | Quando considerar |
|---|---|---|
| Direct | .NET/Java; TCP para dados e HTTPS para metadados | Acesso direto às réplicas, com rede compatível |
| Gateway | Todos; HTTPS 443 para NoSQL | Python ou rede que só permite HTTPS |

==Direct== é o padrão do SDK .NET; Python usa ==Gateway==. Direct usa portas TCP 10000–20000 com endpoints públicos/de serviço; com private endpoints, pode usar toda a faixa 0–65535. Consulte as regras de rede antes de escolher. Gateway resolve a restrição de transporte, mas não garante uma meta de latência.

## Leitura pontual ou consulta?

Se conhece `id` e chave de partição completa, use `read_item`/`ReadItemAsync`: é uma **leitura pontual**. Um item de 1 KB custa 1 RU com consistência Session. O custo cresce com tamanho e pode mudar com consistência.

Use SQL para localizar itens por outros critérios. Passe valores como parâmetros `@nome`, sem concatenar entrada do usuário. Incluir a chave no filtro ou nas opções pode restringir as partições; consulta SQL não tem uma faixa fixa de custo universal.

## Exemplos nos dois SDKs

Instale `azure-cosmos` e `azure-identity`, ou `Microsoft.Azure.Cosmos` e `Azure.Identity` em .NET 8. Defina `COSMOS_ENDPOINT` e conceda `Cosmos DB Built-in Data Reader`. Este exemplo usa `KnowledgeBase/AgentMemories` com chave simples `/tenantId`, diferente do contêiner hierárquico do artigo anterior. Prepare o item `mem-1001` no tenant `tenant-alpha`.

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

import os
endpoint = os.environ["COSMOS_ENDPOINT"]
credential = DefaultAzureCredential()

# CosmosClient instanciado como singleton
client = CosmosClient(url=endpoint, credential=credential)
container = client.get_database_client("KnowledgeBase").get_container_client("AgentMemories")

# 1. Point Read (Operação mais eficiente: ~1 RU)
item_id = "mem-1001"
pk_value = "tenant-alpha"
point_read_item = container.read_item(item=item_id, partition_key=pk_value)
print("Point Read com sucesso:", point_read_item["id"])

# 2. Consulta Parametrizada In-Partition com Paginação
query = "SELECT c.id, c.sessionSummary FROM c WHERE c.userId = @userId"
params = [{"name": "@userId", "value": "usr-42"}]

# max_item_count limita o tamanho de cada página
query_iterable = container.query_items(
    query=query,
    parameters=params,
    partition_key=pk_value, # Força in-partition query (elimina cross-partition fan-out)
    max_item_count=10
)

# Percorre os resultados; o SDK busca páginas conforme necessário
for item in query_iterable:
    print("Item recuperado:", item["id"])
```

```csharp
using System;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

string import os
endpoint = os.environ["COSMOS_ENDPOINT"];

// Configuração do cliente em Direct Mode (Padrão no C#)
CosmosClientOptions options = new CosmosClientOptions
{
    ConnectionMode = ConnectionMode.Direct,
    MaxRetryAttemptsOnRateLimitedRequests = 9,
    MaxRetryWaitTimeOnRateLimitedRequests = TimeSpan.FromSeconds(30)
};

// Instância única (Singleton)
CosmosClient client = new CosmosClient(endpoint, new DefaultAzureCredential(), options);
Container container = client.GetContainer("KnowledgeBase", "AgentMemories");

// 1. Point Read: observe o custo real na resposta
string itemId = "mem-1001";
PartitionKey partitionKey = new PartitionKey("tenant-alpha");

ItemResponse<dynamic> response = await container.ReadItemAsync<dynamic>(itemId, partitionKey);
Console.WriteLine($"Point Read concluído. RU consumida: {response.RequestCharge}");

// 2. Consulta Parametrizada com FeedIterator e Continuation Token
QueryDefinition queryDefinition = new QueryDefinition("SELECT c.id, c.sessionSummary FROM c WHERE c.userId = @userId")
    .WithParameter("@userId", "usr-42");

QueryRequestOptions queryOptions = new QueryRequestOptions
{
    PartitionKey = partitionKey, // In-partition query
    MaxItemCount = 10
};

using (FeedIterator<dynamic> feedIterator = container.GetItemQueryIterator<dynamic>(queryDefinition, requestOptions: queryOptions))
{
    while (feedIterator.HasMoreResults)
    {
        FeedResponse<dynamic> page = await feedIterator.ReadNextAsync();
        Console.WriteLine($"Página retornada com {page.Count} itens. Custo: {page.RequestCharge} RU");

        string continuationToken = page.ContinuationToken; // Token para próxima página stateless
        foreach (var item in page)
        {
            Console.WriteLine($"Item ID: {item.id}");
        }
    }
}
```

## Paginação

`MaxItemCount`/`max_item_count` limita itens por página, não o total da consulta. Pode haver páginas menores ou vazias. Continue enquanto o SDK indicar mais resultados.

O ==continuation token== registra a posição de leitura. Uma API pode retorná-lo ao cliente e recebê-lo na chamada seguinte; trate-o como opaco, mantendo consulta e contexto de autorização. No Python, confira as limitações de tokens para consultas de partição única. O exemplo percorre resultados, sem implementar uma API de paginação.

<details>
<summary>Checagem Rápida: max_item_count=10 limita a consulta inteira a dez itens?</summary>

Não. Limita a página solicitada. Para limitar o resultado total, use a consulta apropriada, como `TOP 10`.

</details>

## Pegadinhas de Prova

- **Python não usa Direct:** não copie opções de transporte do .NET para Python.
- **Leitura pontual exige a chave:** `id` sozinho não identifica o item em todo contêiner.
- **Parâmetro de página não é limite total:** o iterador pode buscar várias páginas.
- **Retentativas têm orçamento:** os valores do exemplo .NET são uma configuração, não uma recomendação universal para toda aplicação.

---
title: "Modelo de Recursos, Partition Key e Request Units"
slug: "cosmos-db-modelo-de-recursos-e-particionamento"
chapter: "04-cosmos-db-nosql"
exam_domain: "data-management"
tags:
  - cosmos-db
  - resource-model
  - partition-key
  - partitioning
  - logical-partitions
  - physical-partitions
  - request-units
  - rus
  - throughput
  - nosql
  - python
  - csharp
difficulty: "intermediate"
tldr: "A chave distribui documentos e tráfego. A combinação completa define a
  partição lógica, com limite padrão de 20 GB. Chaves hierárquicas permitem
  dividir um cliente em vários grupos."
related_links:
  - label: "Particionamento e escala horizontal no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/partitioning-overview"
    type: "learn"
  - label: "Chaves de partição hierárquicas no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/hierarchical-partition-keys"
    type: "learn"
questions:
  - id: q-cosmos-partitioning-01
    type: single-choice
    title: Dividir dados por cliente e usuário
    exam_domain: data-management
    stem: Um contêiner deve atender vários clientes. Alguns passam de 45 GB, mas
      cada usuário fica abaixo de 20 GB. As consultas filtram por cliente e
      usuário. Qual chave evita uma única partição lógica por cliente e
      aproveita esses filtros?
    options:
      - id: opt-a
        text: Usar somente /tenantId.
        correct: false
        rationale: Cada cliente ficaria em uma partição lógica; os maiores
          ultrapassariam o limite padrão de 20 GB.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
      - id: opt-b
        text: Usar [/tenantId, /userId].
        correct: true
        rationale: Cada combinação cliente/usuário define uma partição lógica. O cenário
          limita cada usuário a menos de 20 GB e consulta pelo prefixo da chave.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
      - id: opt-c
        text: Usar somente /id.
        correct: false
        rationale: Distribui itens, mas consultas por cliente e usuário não aproveitam
          esse prefixo de partição.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
      - id: opt-d
        text: Usar somente /status.
        correct: false
        rationale: Poucos valores de status tendem a concentrar dados e tráfego, sem
          atender ao padrão de consulta.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
    tags:
      - cosmos-db
      - partition-key
      - logical-partitions
    learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
  - id: q-cosmos-partitioning-02
    type: code-completion
    title: Configurar chave hierárquica
    exam_domain: data-management
    stem: "Complete apenas a configuração do contêiner: chave hierárquica de três
      níveis e autoscale de até 4.000 RU/s. PartitionKey e ThroughputProperties
      já foram importados, e database já foi obtido por um cliente autorizado a
      criar recursos. Permissão apenas de leitura não basta."
    code_template: |-
      container = database.create_container_if_not_exists(
          id='UserSessions',
          partition_key=PartitionKey(path={{slot_hpk}}, kind={{slot_kind}}),
          offer_throughput={{slot_throughput}}
      )
    slots:
      - id: slot_hpk
        options:
          - text: "['/tenantId', '/userId', '/sessionId']"
            correct: true
            rationale: Chaves hierárquicas recebem uma lista com 2 ou 3 caminhos de
              atributos.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
          - text: "'/tenantId/userId/sessionId'"
            correct: false
            rationale: Caminhos hierárquicos não são concatenados em uma única string de
              caminho.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
      - id: slot_kind
        options:
          - text: "'MultiHash'"
            correct: true
            rationale: O tipo de partição para chaves hierárquicas é 'MultiHash' (no SDK
              Python) ou PartitionKeyKind.MultiHash (no SDK .NET).
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
          - text: "'Hash'"
            correct: false
            rationale: "'Hash' é usado exclusivamente para chaves de partição simples de
              nível único."
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
      - id: slot_throughput
        options:
          - text: ThroughputProperties(auto_scale_max_throughput=4000)
            correct: true
            rationale: Para configurar Autoscale no SDK Python, utiliza-se
              ThroughputProperties com auto_scale_max_throughput.
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
          - text: "4000"
            correct: false
            rationale: Passar um valor inteiro configura throughput manual fixo, não
              escalabilidade automática (Autoscale).
            learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
    tags:
      - cosmos-db
      - partition-key
      - throughput
    learn_url: https://learn.microsoft.com/azure/cosmos-db/partitioning-overview
---

# Modelo de recursos, chave de partição e RUs

Cosmos DB for NoSQL guarda documentos JSON. Para distribuir dados e tráfego, agrupa documentos pela chave de partição. Uma boa chave evita concentrar trabalho em poucos grupos.

## Do recurso ao documento

| Recurso | O que define |
|---|---|
| Conta | Regiões, endpoint e regras de acesso |
| Banco | Agrupamento de contêineres; pode compartilhar capacidade |
| Contêiner de dados | Chave de partição, índices e documentos |
| Item | Documento JSON com `id` |

Aqui, contêiner é um agrupamento de documentos no banco; não é um contêiner Docker. `tenantId` identifica um cliente da aplicação.

Uma ==RU== (Request Unit) mede o custo de uma operação. RU/s mede capacidade por segundo. Uma leitura pontual de um item de 1 KB custa 1 RU com consistência Session; consultas e escritas têm outros custos.

## Partição lógica e física

- **Lógica:** documentos com o mesmo valor completo da chave. O limite padrão é ==20 GB==. Transações em lote e stored procedures abrangem uma partição lógica.
- **Física:** infraestrutura gerenciada pelo Azure que reúne partições lógicas. Suporta até 50 GB e 10.000 RU/s; o serviço faz divisões conforme necessário.

Escolha uma chave com muitos valores distintos, distribuição de tráfego e presença nos filtros mais usados. Muitos valores, sozinhos, não bastam: um cliente muito ativo ainda pode causar uma *hot partition*, isto é, concentração de carga. Isso pode gerar HTTP 429 mesmo com capacidade disponível em outras partições.

## Chave hierárquica

A chave `[/tenantId, /userId, /sessionId]` tem três níveis: cliente, usuário e sessão. O limite lógico se aplica à combinação completa, permitindo que um cliente ocupe várias partições.

| Filtro | Roteamento |
|---|---|
| `tenantId` | Partições desse cliente; pode haver mais de uma |
| `tenantId` + `userId` | Subconjunto mais restrito |
| Os três valores | Uma partição lógica |
| Só `userId` | Não aproveita o prefixo da hierarquia |

<details>
<summary>Checagem Rápida: Filtrar por tenantId sempre custa 1 RU?</summary>

Não. O filtro reduz o escopo, mas o custo depende da operação e dos dados. Uma consulta não se torna leitura pontual por ter filtro de partição.

</details>

## Conferir a configuração com os SDKs

No portal, crie `KnowledgeBase/AgentMemoriesHierarchical` com os três caminhos acima. Para os exemplos, instale `azure-cosmos` e `azure-identity` em Python, ou `Microsoft.Azure.Cosmos` e `Azure.Identity` em .NET 8. Defina `COSMOS_ENDPOINT` e conceda à identidade o papel de dados `Cosmos DB Built-in Data Reader`. Criação de banco/contêiner usa o plano de gerenciamento (portal, CLI ou infraestrutura como código); esse papel de dados não a autoriza.

```python
import os
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

with CosmosClient(os.environ["COSMOS_ENDPOINT"], DefaultAzureCredential()) as client:
    container = client.get_database_client("KnowledgeBase").get_container_client("AgentMemoriesHierarchical")
    print(container.read()["partitionKey"]["paths"])
```

```csharp
using Azure.Identity;
using Microsoft.Azure.Cosmos;

using var client = new CosmosClient(
    Environment.GetEnvironmentVariable("COSMOS_ENDPOINT")!, new DefaultAzureCredential());
var container = client.GetContainer("KnowledgeBase", "AgentMemoriesHierarchical");
var properties = (await container.ReadContainerAsync()).Resource;
Console.WriteLine(string.Join(", ", properties.PartitionKeyPaths));
```

## Pegadinhas de Prova

- **Chave não se altera no lugar:** mudar os caminhos exige novo contêiner e migração.
- **Unicidade:** a combinação `id` + chave completa é única; `id` pode se repetir em partições distintas.
- **Mais RU/s não corrige toda concentração:** examine a distribuição antes de aumentar capacidade.
- **Hierarquia tem ordem:** filtrar pelo prefixo ajuda no roteamento; omitir o primeiro nível perde essa vantagem.

---
title: "Change Feed Processor: Leases, Delegates e Reprocessamento"
slug: "cosmos-db-change-feed-processor"
chapter: "04-cosmos-db-nosql"
exam_domain: "data-management"
tags:
  - cosmos-db
  - change-feed
  - change-feed-processor
  - leases
  - delegates
  - nosql
  - python
  - csharp
  - rag
  - reactive-programming
difficulty: "advanced"
tldr: "Change Feed permite processar alterações depois da gravação. O CFP usa
  leases para coordenar instâncias e checkpoints. Latest Version não entrega
  exclusões físicas nem todas as versões; tolere reprocessamento."
related_links:
  - label: "Visão geral do Change Feed do Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor"
    type: "learn"
  - label: "Modos do Change Feed no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-modes"
    type: "learn"
questions:
  - id: q-cosmos-changefeed-01
    type: single-choice
    title: Comunicar exclusões
    exam_domain: data-management
    stem: O Change Feed em modo Latest Version atualiza um índice de busca, mas não
      avisa quando um documento é excluído. Como comunicar a exclusão sem mudar
      de modo?
    options:
      - id: opt-a
        text: "Marcar isDeleted: true, processar a remoção no índice e só depois excluir
          o original."
        correct: true
        rationale: Latest Version entrega a atualização da marca, não a exclusão física.
          Se usar TTL para limpeza, a janela deve cobrir atraso e recuperação do
          consumidor.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
      - id: opt-b
        text: Aumentar o throughput provisionado no contêiner de leases.
        correct: false
        rationale: Mais capacidade para os leases ajuda a registrar progresso, mas não
          faz Latest Version entregar exclusões físicas.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
      - id: opt-c
        text: Configurar o ChangeFeedProcessor com StartTime apontando para
          DateTime.MinValue.
        correct: false
        rationale: StartTime escolhe de onde começar a leitura; não muda os tipos de
          alteração disponíveis.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
      - id: opt-d
        text: Criar uma stored procedure para executar as deleções de forma síncrona.
        correct: false
        rationale: Excluir por stored procedure continua sendo exclusão física, que esse
          modo não entrega.
        learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
    tags:
      - cosmos-db
      - change-feed
      - change-feed-processor
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
  - id: q-cosmos-changefeed-02
    type: ordering
    title: Ciclo de vida do CFP
    exam_domain: data-management
    stem: "Os contêineres de dados e de leases já existem. Ordene o fluxo: preparar
      a leitura, configurar o processamento, iniciar e encerrar o CFP em .NET."
    items:
      - text: Obter os contêineres de dados e de leases (/id) para configurar a leitura
        order: 1
      - text: Definir o delegate que processa os lotes, sem duplicar efeitos
        order: 2
      - text: Construir o processador com delegate, nome de instância e contêiner de
          leases
        order: 3
      - text: Chamar StartAsync para iniciar a leitura distribuída
        order: 4
      - text: No encerramento da aplicação, chamar StopAsync
        order: 5
    tags:
      - cosmos-db
      - change-feed
      - change-feed-processor
      - csharp
    learn_url: https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor
    rationale: Prepare as referências e a função que trata os lotes antes de
      construir o processador. StartAsync inicia a leitura; StopAsync encerra o
      processamento quando a aplicação termina.
---

# Change Feed Processor: alterações, leases e reprocessamento

Change Feed permite ler mudanças nos documentos sem consultar repetidamente a tabela inteira. Um worker pode gerar embeddings após a gravação, deixando a chamada do usuário mais curta. A leitura do feed e o controle do progresso também consomem RUs.

## Como o processador trabalha

O ==Change Feed Processor== (CFP) distribui a leitura entre instâncias e registra progresso:

| Componente | Função |
|---|---|
| Contêiner monitorado | Origem das alterações |
| Contêiner de leases | Coordenação e checkpoints (posição já processada) |
| Instância | Processo que recebe parte do trabalho |
| Delegate | Função chamada para tratar um lote |

Use chave ==/id== no contêiner de leases particionado. Instâncias da mesma implantação compartilham nome de processador e contêiner de leases, mas têm nomes de instância distintos. O paralelismo depende das faixas de leitura disponíveis, não só do número de workers.

## Modos de leitura

| Modo | O que entrega | Limite importante |
|---|---|---|
| Latest Version | Criações e atualizações mais recentes | Não preserva todas as versões nem exclusões físicas |
| All Versions and Deletes | Alterações e exclusões com metadados | Exige backup contínuo e respeita sua janela de retenção |

A ordem é por partição lógica, não global. No modo Latest Version, um item criado e atualizado antes da leitura pode aparecer apenas na versão atualizada. Depois da exclusão, ele deixa de estar disponível nesse feed.

<details>
<summary>Checagem Rápida: Como avisar a exclusão no modo Latest Version?</summary>

Marque o item com `isDeleted: true` e deixe o consumidor remover o dado derivado. Só exclua o original depois de garantir o processamento; se usar TTL, escolha uma janela que cubra atrasos e recuperação.

</details>

## Exemplos de consumo

Provisione `KnowledgeBase/Documents` e `KnowledgeBase/leases` (chave `/id`). Instale `azure-cosmos` e `azure-identity`, ou `Microsoft.Azure.Cosmos` e `Azure.Identity` em .NET 8. Defina `COSMOS_ENDPOINT`; autorize leitura do feed e acesso de escrita aos leases para o processador.

Python abaixo faz uma leitura pelo modelo pull: não cria um CFP distribuído nem mantém monitoramento contínuo. Para um serviço, implemente repetição e checkpoints ou use um trigger de Cosmos DB em Functions. O exemplo C# usa CFP; os dois apenas demonstram recebimento, sem chamar um modelo de IA.

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

import os
endpoint = os.environ["COSMOS_ENDPOINT"]
client = CosmosClient(url=endpoint, credential=DefaultAzureCredential())

database = client.get_database_client("KnowledgeBase")
container = database.get_container_client("Documents")

# Consumo do Change Feed via Pull Model em Python
# query_items_change_feed monitora alterações a partir do início ou de um token prévio
change_feed_iterator = container.query_items_change_feed(
    partition_key_range_id=None, # Sem restringir a uma faixa específica
    is_start_from_beginning=True
)

print("Iniciando escuta do Change Feed (Python Pull Model)...")
for item in change_feed_iterator:
    # Dispara geração de embedding para novo documento
    doc_id = item.get("id")
    content = item.get("content", "")
    print(f"Documento a processar: {doc_id}")
```

```csharp
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

string import os
endpoint = os.environ["COSMOS_ENDPOINT"];
CosmosClient client = new CosmosClient(endpoint, new DefaultAzureCredential());

Container monitoredContainer = client.GetContainer("KnowledgeBase", "Documents");
Container leasesContainer = client.GetContainer("KnowledgeBase", "leases");

// 1. Definição do Delegate Handler assíncrono
async Task ProcessChangesAsync(
    ChangeFeedProcessorContext context,
    IReadOnlyCollection<dynamic> changes,
    CancellationToken cancellationToken)
{
    Console.WriteLine($"Lote recebido com {changes.Count} alterações. Lease: {context.LeaseToken}");
    foreach (var item in changes)
    {
        string id = item.id;
        string text = item.content;
        // Chamada assíncrona ao modelo de embeddings do Azure OpenAI
        Console.WriteLine($"Gerando embeddings para documento {id}...");
    }
    await Task.CompletedTask;
}

// 2. Construção do ChangeFeedProcessor com suporte a auto-balancing
ChangeFeedProcessor processor = monitoredContainer
    .GetChangeFeedProcessorBuilder<dynamic>(processorName: "EmbeddingSyncPipeline", onChangesDelegate: ProcessChangesAsync)
    .WithInstanceName("Worker-Node-01") // Identificador único da réplica/pod atual
    .WithLeaseContainer(leasesContainer)
    .WithStartTime(DateTime.UtcNow.AddHours(-1)) // Inicia a escuta a partir de 1 hora atrás
    .Build();

// 3. Inicialização e execução contínua
await processor.StartAsync();
Console.WriteLine("Change Feed Processor ativo e consumindo alterações...");

// Exemplo de console interativo; em um serviço, use o cancelamento do host.
Console.ReadLine();
await processor.StopAsync();
```

## Falhas e retomada

O CFP oferece processamento pelo menos uma vez. Faça o destino tolerar repetição usando documento e versão como identificadores. O checkpoint avança depois do processamento bem-sucedido do lote; não capture uma exceção e retorne sucesso se o trabalho foi perdido.

Para falha persistente, grave o item em um destino durável de recuperação antes de avançar. Para reprocessar, use uma implantação independente com novo nome/prefixo de leases e ponto inicial apropriado. Um checkpoint existente tem precedência sobre a configuração inicial.

## Pegadinhas de Prova

- **Latest Version não é histórico completo:** não use esse modo como auditoria de todas as versões e exclusões.
- **Assíncrono não significa gratuito:** reserve capacidade para ler o feed, gravar leases e atualizar o destino.
- **Mais workers nem sempre ajudam:** o número de faixas e a capacidade das dependências limitam o paralelismo.
- **Reprocessar pode duplicar efeitos:** use idempotência e evite ciclos ao gravar novamente no contêiner monitorado.

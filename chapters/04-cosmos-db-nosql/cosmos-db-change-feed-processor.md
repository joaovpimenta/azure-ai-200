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
tldr: "O Change Feed Processor (CFP) consome alterações em ordem cronológica por partição lógica utilizando um contêiner de leases para coordenar instâncias e registrar checkpoints. Modos Latest Version (padrão) e All Versions and Deletes atendem pipelines assíncronos de geração de embeddings e sincronização RAG."
related_links:
  - label: "Visão geral do Change Feed do Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-processor"
    type: "learn"
  - label: "Modos do Change Feed no Azure Cosmos DB"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/change-feed-modes"
    type: "learn"
questions:
  - id: "q-cosmos-changefeed-01"
    type: "single-choice"
    title: "Detecção de Exclusões no Change Feed em Modo Latest Version"
    exam_domain: "data-management"
    stem: "Uma solução RAG no Azure utiliza o Change Feed do Cosmos DB para sincronizar documentos com o Azure AI Search. O contêiner de dados opera no modo padrão 'Latest Version'. A equipe de suporte notou que quando um item é excluído do Cosmos DB, o índice de busca não remove o documento correspondente. Qual arquitetura resolve o problema no modo Latest Version?"
    options:
      - id: "opt-a"
        text: "Implementar o padrão Soft Delete, gravando um atributo 'isDeleted: true' com TTL configurado para limpeza posterior."
        correct: true
        rationale: "No modo Latest Version, o Change Feed captura apenas inserções e atualizações. As deleções físicas não geram eventos no feed. A solução recomendada é atualizar o item com uma flag lógica (Soft Delete), permitindo que o CFP processe a exclusão antes que o Time-to-Live (TTL) purgue o item fisicamente."
      - id: "opt-b"
        text: "Aumentar o throughput provisionado no contêiner de leases."
        correct: false
        rationale: "O throughput do contêiner de leases controla o registro de checkpoints, não tendo relação com os tipos de eventos emitidos pelo contêiner monitorado."
      - id: "opt-c"
        text: "Configurar o ChangeFeedProcessor com StartTime apontando para DateTime.MinValue."
        correct: false
        rationale: "StartTime define o ponto histórico inicial de leitura das alterações, mas o log de Latest Version continuará omitindo eventos de deleção física."
      - id: "opt-d"
        text: "Criar uma stored procedure para executar as deleções de forma síncrona."
        correct: false
        rationale: "Stored procedures alteram itens no escopo da partição, mas deleções físicas continuam invisíveis no modo Latest Version."
    tags:
      - cosmos-db
      - change-feed
      - change-feed-processor
  - id: "q-cosmos-changefeed-02"
    type: "ordering"
    title: "Sequência de Configuração e Execução do Change Feed Processor"
    exam_domain: "data-management"
    stem: "Ordene as etapas necessárias para instanciar, inicializar e processar eventos de forma resiliente utilizando a biblioteca Change Feed Processor (.NET SDK) conectada a uma fila de geração de embeddings de IA."
    items:
      - text: "Obter referências aos contêineres: contêiner monitorado (dados) e contêiner de leases (particionado por /id)"
        order: 1
      - text: "Definir a função Delegate assíncrona que receberá o lote de documentos e acionará o pipeline de embeddings"
        order: 2
      - text: "Construir o processador com ChangeFeedProcessorBuilder definindo nome do workflow, instância e contêiner de leases"
        order: 3
      - text: "Iniciar o processamento chamando StartAsync() para adquirir leases de partições físicas e iniciar a escuta contínua"
        order: 4
      - text: "Executar StopAsync() no desligamento gracioso da aplicação para liberar leases e gravar o último checkpoint"
        order: 5
    tags:
      - cosmos-db
      - change-feed
      - change-feed-processor
      - csharp
---

# Change Feed Processor: Leases, Delegates e Reprocessamento

O **Azure Cosmos DB Change Feed** é um mecanismo orientado a eventos que escuta e emite alterações efetuadas em contêineres do Cosmos DB em ordem estrita de ocorrência. Em soluções modernas de Inteligência Artificial e RAG (Retrieval-Augmented Generation), o Change Feed atua como a espinha dorsal assíncrona responsável por disparar a vetorização de novos documentos, atualizar caches semânticos no **Azure Managed Redis** e manter índices externos (como o **Azure AI Search**) sincronizados em tempo quase real.

---

## 1. Arquitetura e Princípios de Funcionamento

O Change Feed é um log persistente e somente de acréscimo (append-only) que opera nativamente sobre as partições físicas e lógicas do contêiner monitorado:
- **Ordem Garantida**: As alterações são garantidas em ordem cronológica estrita **dentro de cada partição lógica**. Não há garantia de ordenação global entre partições lógicas distintas.
- **Disponibilidade Imediata**: As alterações persistem imediatamente após a confirmação da transação de escrita (commit).
- **Consumo Desacoplado**: Múltiplos sistemas downstream independentes podem ler o mesmo Change Feed no seu próprio ritmo sem impactar o desempenho do banco transacional.

```mermaid
flowchart LR
    subgraph DataContainer["Contêiner Monitorado (Documentos)"]
        W1[Inserção / Atualização] --> Log[Log de Alterações do Cosmos DB]
    end

    subgraph CFP["Change Feed Processor (Multi-Instância)"]
        LeaseC["Contêiner de Leases (/id)\nArmazena Checkpoints"]
        H1["Host Instância A (Consome Partições 1 e 2)"]
        H2["Host Instância B (Consome Partições 3 e 4)"]
        Delegate["Delegate Handler"]
    end

    subgraph AIWorkload["Pipeline de IA Downstream"]
        AOAI[Azure OpenAI Embeddings]
        Search[Azure AI Search Index]
    end

    Log --> H1
    Log --> H2
    H1 <--> LeaseC
    H2 <--> LeaseC
    H1 --> Delegate
    H2 --> Delegate
    Delegate --> AOAI
    Delegate --> Search
```

---

## 2. Componentes da Biblioteca Change Feed Processor (CFP)

A biblioteca oficial **Change Feed Processor (CFP)** é a camada recomendada para consumo distribuído e tolerante a falhas do Change Feed. Ela é composta por quatro elementos essenciais:

1. **Contêiner Monitorado (Monitored Container)**: O contêiner de dados que gera os eventos de escrita.
2. **Contêiner de Leases (Leases Container)**: Um contêiner auxiliar do Cosmos DB que atua como coordenador de estado distribuído. Ele armazena um "lease" (contrato de concessão) para cada partição física, registrando o identificador do host proprietário e o **continuation token** (checkpoint) do último item processado com sucesso.
   - **Regra Mandatória**: O contêiner de leases deve ser configurado com chave de partição definida como ==`/id`==.
3. **Host de Computação (Host Instance)**: A instância de aplicação que executa o processador (ex: um pod no AKS, um contêiner no Azure Container Apps ou uma WebJob). Se múltiplos hosts compartilharem o mesmo nome de processador, o CFP distribui as partições físicas automaticamente entre eles (**auto-balancing**).
4. **Delegate**: O manipulador de código (callback assíncrono) que recebe o lote de documentos alterados (`IReadOnlyCollection<T>`) e executa a lógica de negócio.

---

## 3. Modos do Change Feed: Latest Version vs All Versions and Deletes

O Cosmos DB disponibiliza dois modos operacionais para leitura de alterações:

| Característica | Latest Version Mode (Padrão) | All Versions and Deletes Mode (AVD) |
|---|---|---|
| **Eventos Capturados** | Inserções e Atualizações | Inserções, Atualizações e ==Exclusões Físicas== |
| **Representação de Dados** | Retorna o estado atual consolidado do item | Retorna a imagem anterior e a versão modificada |
| **Captura de Deletes** | ==Não captura deleções físicas== (Exige padrão Soft Delete) | Captura nativamente com metadados de exclusão |
| **Janela de Retenção** | Histórico completo permanente desde a criação do contêiner | Retenção contínua baseada em janela temporal (ex: 7 dias) |
| **Configuração** | Habilitado por padrão em todas as contas | Requer ativação explícita no contêiner e conta |

<details>
<summary>Checagem Rápida: Como capturar remoções de documentos no modo Latest Version sem perder integridade no RAG?</summary>

Adote o padrão **Soft Delete**: em vez de invocar a exclusão física do item (`DeleteItem`), atualize o documento inserindo a flag `isDeleted: true` e configure um `ttl` (Time to Live) de alguns dias. O Change Feed emitirá a atualização com `isDeleted: true`, permitindo que o delegate remova o vetor do Azure AI Search. Após o TTL expirar, o Cosmos DB purgará o documento automaticamente sem custos adicionais de RU.
</details>

---

## 4. Casos de Uso em Inteligência Artificial e RAG

O Change Feed é o componente chave para sincronização de estados em IA:
- **Geração Assíncrona de Embeddings**: Ao salvar documentos brutos no Cosmos DB, o delegate do CFP extrai o texto, chama a API de Embeddings do Azure OpenAI e salva o vetor de volta no contêiner vetorial. Isso desacopla a latência da API do OpenAI da transação do usuário.
- **Invalidação de Cache Semântico**: Quando um produto ou documento de FAQ tem seu preço ou conteúdo alterado, o Change Feed notifica o serviço para purgar as chaves correspondentes no **Azure Managed Redis**.
- **Reprocessamento Histórico**: Ao atualizar para um modelo de embedding superior (ex: migrando de `text-embedding-ada-002` para `text-embedding-3-large`), você pode inicializar um novo CFP apontando o parâmetro `StartTime = DateTime.MinValue` para reprocessar toda a base desde o início.

---

## 5. Implementação Prática Dual SDK (Python e C#)

Abaixo, a implementação completa do Change Feed Processor com balanceamento distribuído em C# e o consumo via Pull Model Iterator em Python:

```python
from azure.identity import DefaultAzureCredential
from azure.cosmos import CosmosClient

endpoint = "https://ai200-cosmos-nosql.documents.azure.com:443/"
client = CosmosClient(url=endpoint, credential=DefaultAzureCredential())

database = client.get_database_client("KnowledgeBase")
container = database.get_container_client("Documents")

# Consumo do Change Feed via Pull Model em Python
# query_items_change_feed monitora alterações a partir do início ou de um token prévio
change_feed_iterator = container.query_items_change_feed(
    partition_key_range_id=None, # Escuta em todas as partições lógicas da partição física
    is_start_from_beginning=True
)

print("Iniciando escuta do Change Feed (Python Pull Model)...")
for item in change_feed_iterator:
    # Dispara geração de embedding para novo documento
    doc_id = item.get("id")
    content = item.get("content", "")
    print(f"Documento alterado detectado: {doc_id}. Disparando embedding para: {content[:30]}...")
```

```csharp
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Azure.Identity;
using Microsoft.Azure.Cosmos;

string endpoint = "https://ai200-cosmos-nosql.documents.azure.com:443/";
CosmosClient client = new CosmosClient(endpoint, new DefaultAzureCredential());

Container monitoredContainer = client.GetContainer("KnowledgeBase", "Documents");
Container leasesContainer = client.GetContainer("KnowledgeBase", "leases");

// 1. Definição do Delegate Handler assíncrono
async Task ProcessChangesAsync(
    ChangeFeedProcessorContext context,
    IReadOnlyCollection<dynamic> changes,
    CancellationToken cancellationToken)
{
    Console.WriteLine($"Lote recebido com {changes.Count} alterações. Partição física: {context.LeaseToken}");
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

// Aguarda sinal de encerramento gracioso
// await processor.StopAsync();
```

---

## Pegadinhas de Prova

- **Deleções no modo Latest Version**: Em testes práticos e exames oficiais, uma pergunta recorrente afirma que o Change Feed padrão notifica quando um documento é excluído via `DELETE`. **Isto é FALSO!** No modo padrão (`Latest Version`), deleções físicas são completamente ignoradas. Para registrar deleções sem ativar o modo AVD, adote o padrão **Soft Delete** (`isDeleted = true`).
- **Chave de Partição do Contêiner de Leases**: O contêiner de leases **deve obrigatoriamente** ter sua chave de partição definida como `/id`. Definir qualquer outro caminho (como `/leaseId` ou `/partitionKey`) causará exceção na inicialização do `ChangeFeedProcessorBuilder`.
- **Tratamento de Exceções no Delegate**: Se o delegate do Change Feed Processor lançar uma exceção não tratada (`Unhandled Exception`), o processador **não avançará o checkpoint** daquela partição. Ele repetirá o mesmo lote de alterações indefinidamente, travando o pipeline daquela partição física (veneno de fila). É indispensável envolver a lógica do delegate em blocos `try/catch` e enviar mensagens com falha persistente para uma Dead-Letter Queue (como Azure Service Bus).
- **Escalabilidade e Partições Físicas**: Se o contêiner monitorado possui 4 partições físicas e você sobe 10 instâncias de trabalhadores (pods) com o mesmo nome de processador, apenas 4 instâncias receberão leases ativos e trabalharão simultaneamente; as outras 6 ficarão em standby ocioso. Não é possível ter mais trabalhadores ativos simultâneos do que o número de partições físicas do contêiner.

---
title: "Event Grid: tópicos, eventos personalizados, filtros e retry/dead-letter"
slug: event-grid-eventos-filtros-retentativas
chapter: 07-backend-integration
exam_domain: connect-and-consume
tags:
  - event-grid
  - custom-events
  - event-filters
  - event-retries
  - dead-lettering
difficulty: intermediate
tldr: Event Grid distribui notificações de fatos ocorridos, com filtros e entrega pelo menos uma
  vez. Trate duplicados, valide o endpoint e configure dead-letter para eventos não entregues.
related_links:
  - label: Conceitos do Event Grid
    url: https://learn.microsoft.com/en-us/azure/event-grid/concepts
    type: learn
  - label: Entrega e retry
    url: https://learn.microsoft.com/en-us/azure/event-grid/delivery-and-retry
    type: learn
  - label: Filtragem
    url: https://learn.microsoft.com/en-us/azure/event-grid/event-filtering
    type: learn
questions:
  - id: q-event-grid-eventos-filtros-retentativas-01
    type: single-choice
    title: "Event Grid: tópicos, eventos personalizados, filtros e retry/dead-letter"
    exam_domain: connect-and-consume
    stem: O assinante recebe um evento repetido e depois um evento de versão anterior. Como deve
      processá-los?
    options:
      - id: opt-2
        text: Aplicar sempre a última mensagem recebida como estado mais recente.
        correct: false
        rationale: Ordem de chegada não garante ordem de versões.
        learn_url: https://learn.microsoft.com/en-us/azure/event-grid/concepts
      - id: opt-3
        text: Rejeitar todos os eventos após o primeiro do tópico.
        correct: false
        rationale: Isso descartaria alterações válidas de outros documentos e versões.
        learn_url: https://learn.microsoft.com/en-us/azure/event-grid/concepts
      - id: opt-4
        text: Assumir que dead-letter corrige o estado automaticamente.
        correct: false
        rationale: Dead-letter exige diagnóstico e recuperação da aplicação.
        learn_url: https://learn.microsoft.com/en-us/azure/event-grid/concepts
      - id: opt-1
        text: Usar idempotência e comparar versão ou estado atual.
        correct: true
        rationale: A entrega pode se repetir e não há garantia de ordem global.
        learn_url: https://learn.microsoft.com/en-us/azure/event-grid/concepts
    tags:
      - event-grid
      - custom-events
      - event-filters
      - event-retries
      - dead-lettering
---

# Event Grid: tópicos, eventos personalizados, filtros e retry/dead-letter

Quando um arquivo chega ao armazenamento, Event Grid pode notificar a função que inicia a ingestão. O evento comunica um fato, como documento criado; uma fila de trabalho pode ser adicionada para controlar processamento demorado e backlog.

## Publicação, assinatura e filtro

Um tópico recebe eventos e uma assinatura define o destino e os filtros. Escolha esquema compatível entre produtor e consumidor, como CloudEvents 1.0 ou Event Grid schema. Não confunda a assinatura de eventos com a assinatura Azure de faturamento.

Filtros básicos podem usar tipo de evento e prefixo/sufixo de `subject`; filtros avançados avaliam campos e operadores suportados. Use metadados estáveis para reduzir notificações irrelevantes.

## Publicar um evento personalizado

Para um custom topic compatível com Event Grid schema, defina `EVENTGRID_ENDPOINT` e conceda `EventGrid Data Sender` à identidade. Instale `azure-eventgrid` e `azure-identity`; no .NET, `Azure.Messaging.EventGrid` e `Azure.Identity`.

```python
import os
import uuid
from azure.identity import DefaultAzureCredential
from azure.eventgrid import EventGridPublisherClient, EventGridEvent

with DefaultAzureCredential() as credential:
    with EventGridPublisherClient(os.environ["EVENTGRID_ENDPOINT"], credential) as client:
        event = EventGridEvent(
            id=str(uuid.uuid4()), subject="documents/tenant-a/doc-123",
            event_type="Ai200.DocumentReady", data_version="1.0",
            data={"document_id": "doc-123", "version": 1},
        )
        client.send([event])
```

```csharp
using Azure.Identity;
using Azure.Messaging.EventGrid;

var client = new EventGridPublisherClient(
    new Uri(Environment.GetEnvironmentVariable("EVENTGRID_ENDPOINT")!),
    new DefaultAzureCredential());
var notification = new EventGridEvent(
    "documents/tenant-a/doc-123", "Ai200.DocumentReady", "1.0",
    new { document_id = "doc-123", version = 1 });
await client.SendEventAsync(notification);
```

O corpo deve conter identificadores e informações suficientes para buscar o recurso, sem expor segredos. Confirme que o schema configurado no tópico corresponde ao objeto publicado.

## Entrega, validação e recuperação

Event Grid oferece entrega ==at-least-once==; duplicação e ordem diferente são possíveis. O handler deve reconhecer eventos já tratados e tolerar a chegada de uma versão antiga. Um evento aceito pelo publicador não comprova conclusão do trabalho no assinante.

Para webhooks, implemente o handshake de validação do esquema/protocolo utilizado. Configure política de retry e ==dead-letter== em Blob Storage, com autorização para gravar no destino. Retentativas dependem do erro retornado e dos limites de tentativas/TTL; nem todo HTTP 4xx recebe o mesmo tratamento.

<details>
<summary>Checagem Rápida: Event Grid entrega todos os eventos em ordem de publicação?</summary>

Não. Faça o consumidor comparar versão ou estado atual e mantenha idempotência para eventos repetidos.

</details>

Para trabalho longo, grave ou enfileire de forma durável antes de reconhecer a notificação; evite manter a conexão aberta durante toda a geração de embeddings. Monitore falhas de entrega e destino de dead-letter.

## Pegadinhas de Prova

- **Pegadinha 1: Evento é comando com conclusão garantida**: A notificação desacopla produtor e consumidor; conclusão requer rastreamento próprio.
- **Pegadinha 2: Retry é infinito**: Tentativas e TTL limitam a entrega; prepare recuperação.
- **Pegadinha 3: Dead-letter existe sem configurar**: É necessário definir e autorizar o armazenamento de destino.

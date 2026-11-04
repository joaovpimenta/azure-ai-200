---
title: "Service Bus: filas, tópicos, assinaturas e filtros"
slug: service-bus-filas-topicos-assinaturas
chapter: 07-backend-integration
exam_domain: connect-and-consume
tags:
  - service-bus
  - queues
  - topics
  - subscriptions
  - correlation-filters
  - sql-filters
  - messaging
difficulty: intermediate
tldr: Filas distribuem trabalho entre consumidores; tópicos entregam cópias a assinaturas
  independentes. Filtros de assinatura avaliam propriedades da mensagem, não fazem consultas
  arbitrárias ao corpo.
related_links:
  - label: Filas, tópicos e assinaturas
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
    type: learn
  - label: Filtros de tópicos
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/topic-filters
    type: learn
questions:
  - id: q-service-bus-filas-topicos-assinaturas-01
    type: single-choice
    title: "Service Bus: filas, tópicos, assinaturas e filtros"
    exam_domain: connect-and-consume
    stem: Auditoria e vetorização precisam receber cada uma todos os documentos. Qual topologia é
      adequada?
    options:
      - id: opt-4
        text: Um filtro SQL que consulta livremente o corpo do documento.
        correct: false
        rationale: Filtros do Service Bus avaliam propriedades suportadas da mensagem, não consultas
          arbitrárias ao corpo.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
      - id: opt-1
        text: Um tópico com assinaturas independentes para os dois fluxos.
        correct: true
        rationale: Cada assinatura mantém sua cópia elegível e pode processar em ritmo próprio.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
      - id: opt-2
        text: Uma fila com os dois consumidores concorrentes.
        correct: false
        rationale: Eles dividiriam trabalho, sem garantir cópia para ambos.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
      - id: opt-3
        text: Dois consumidores na mesma assinatura para duplicar a entrega.
        correct: false
        rationale: Consumidores da mesma assinatura competem pelas mensagens.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions
    tags:
      - service-bus
      - queues
      - topics
      - subscriptions
      - correlation-filters
      - sql-filters
      - messaging
---

# Service Bus: filas, tópicos, assinaturas e filtros

Um documento recebido pode precisar de vetorização e auditoria. Use uma fila quando consumidores competem pelo mesmo trabalho; use tópico com assinaturas quando cada fluxo precisa de sua própria cópia e ritmo de processamento.

## Roteamento e contrato

Um tópico recebe publicações; cada ==subscription== mantém mensagens elegíveis para seus consumidores. Consumidores dentro de uma mesma fila ou assinatura competem entre si. Tópicos e assinaturas exigem tier com suporte, como Standard ou Premium.

| Recurso | Decisão |
|---|---|
| Fila | Uma unidade de trabalho entre consumidores concorrentes |
| Tópico | Publicação para vários fluxos independentes |
| Assinatura | Buffer e regras próprios para cada fluxo |
| Correlation filter | Correspondência eficiente por propriedades específicas |
| SQL filter | Expressões sobre propriedades, com maior flexibilidade |

Os filtros avaliam metadados e application properties. Não examinam livremente um JSON dentro do corpo. Inclua propriedades de roteamento com tipos consistentes. Quando uma assinatura é criada com regra padrão que aceita tudo, remova ou altere essa regra se desejar filtragem restritiva; regras se combinam e a regra ampla pode manter todas as mensagens elegíveis.

## Publicar com os SDKs

Pré-requisitos: namespace, tópico `documentos` e assinaturas previamente criados. Instale `azure-servicebus` e `azure-identity`; no .NET, `Azure.Messaging.ServiceBus` e `Azure.Identity`. A identidade precisa de `Azure Service Bus Data Sender` no escopo apropriado.

```python
import os
import json
from azure.identity import DefaultAzureCredential
from azure.servicebus import ServiceBusClient, ServiceBusMessage

namespace: str = os.environ["SERVICEBUS_NAMESPACE"]  # nome.servicebus.windows.net
with DefaultAzureCredential() as credential:
    with ServiceBusClient(namespace, credential) as client:
        with client.get_topic_sender(topic_name="documentos") as sender:
            message = ServiceBusMessage(
                json.dumps({"document_id": "doc-123"}),
                message_id="doc-123:v1", content_type="application/json",
                application_properties={"tipo": "manual"},
            )
            sender.send_messages(message)
```

```csharp
using Azure.Identity;
using Azure.Messaging.ServiceBus;

await using var client = new ServiceBusClient(
    Environment.GetEnvironmentVariable("SERVICEBUS_NAMESPACE"), new DefaultAzureCredential());
await using var sender = client.CreateSender("documentos");
var message = new ServiceBusMessage(BinaryData.FromObjectAsJson(new { document_id = "doc-123" })) {
    MessageId = "doc-123:v1", ContentType = "application/json"
};
message.ApplicationProperties["tipo"] = "manual";
await sender.SendMessageAsync(message);
```

Uma assinatura com filtro de correlação `tipo = manual` pode receber essa mensagem. Outros consumidores acessam sua própria assinatura; eles não leem diretamente o tópico como se fosse uma fila.

## Entrega e idempotência

Use `MessageId` estável para rastrear o trabalho. Detecção de duplicados, quando habilitada, atua dentro da janela configurada e não substitui idempotência do consumidor. Dimensione retenção, tamanho de mensagem e backlog conforme o serviço; envie referência ao documento em Blob Storage em vez de conteúdo grande quando apropriado.

<details>
<summary>Checagem Rápida: Dois consumidores na mesma assinatura recebem ambos uma cópia de cada mensagem?</summary>

Não. Eles competem pelas mensagens da assinatura. Para cópias independentes, crie assinaturas distintas.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: SQL filter consulta o corpo JSON**: Ele opera sobre propriedades suportadas da mensagem.
- **Pegadinha 2: Nova regra remove a padrão**: Confira a regra que aceita tudo para não invalidar a restrição esperada.
- **Pegadinha 3: Sender também pode receber**: Os papéis de dados de envio e recebimento são distintos.

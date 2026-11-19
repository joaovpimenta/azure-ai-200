---
title: Peek-lock, dead-letter queue, sessões e retentativas
slug: service-bus-dead-letter-e-processamento
chapter: 07-backend-integration
exam_domain: connect-and-consume
tags:
  - service-bus
  - peek-lock
  - dead-letter-queue
  - message-sessions
  - retries
  - poison-messages
difficulty: intermediate
tldr: PeekLock reserva a mensagem até a confirmação. Grave o resultado antes de
  Complete e tolere reentregas. A DLQ guarda mensagens com falha para análise e
  recuperação; não as reprocessa sozinha.
related_links:
  - label: Locks e confirmação
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
    type: learn
  - label: Dead-letter queues
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues
    type: learn
  - label: Sessões
    url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-sessions
    type: learn
questions:
  - id: q-service-bus-dead-letter-e-processamento-01
    type: single-choice
    title: Peek-lock, dead-letter queue, sessões e retentativas
    exam_domain: connect-and-consume
    stem: Um worker grava o resultado, perde o lock antes de Complete e recebe a
      mesma mensagem novamente. Como evitar efeitos duplicados?
    options:
      - id: opt-1
        text: Persistir de forma idempotente usando identificador estável da operação.
        correct: true
        rationale: Reentregas podem ocorrer após perda de lock; o efeito precisa tolerar
          repetição.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
      - id: opt-2
        text: Executar Complete antes de persistir qualquer resultado.
        correct: false
        rationale: Uma falha posterior poderia perder trabalho definitivamente.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
      - id: opt-3
        text: Assumir exatamente uma entrega por mensagem.
        correct: false
        rationale: PeekLock não elimina reentregas.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
      - id: opt-4
        text: Apagar a DLQ sem examinar os motivos.
        correct: false
        rationale: Isso não resolve duplicação e elimina dados úteis de recuperação.
        learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
    tags:
      - service-bus
      - peek-lock
      - dead-letter-queue
      - message-sessions
      - retries
      - poison-messages
    learn_url: https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-transfers-locks-settlement
---

# Peek-lock, dead-letter queue, sessões e retentativas

O indexador grava o embedding e perde a conexão antes de confirmar a mensagem. O Service Bus pode entregá-la novamente. O indexador precisa reconhecer que aquele documento e versão já foram processados. Essa propriedade se chama idempotência.

## Settlement e lock

| Operação | Efeito |
|---|---|
| `Complete` | Confirma sucesso e remove a mensagem |
| `Abandon` | Libera para outra tentativa |
| `DeadLetter` | Move para a subfila de mensagens problemáticas |
| Expiração do lock | Pode permitir reentrega; confirmação tardia falha |
| `ReceiveAndDelete` | Remove ao entregar, sem confirmação posterior |

Em ==PeekLock==, renove locks para trabalhos demorados, observando o limite configurado pelo cliente e pela aplicação. Persistir resultado de forma idempotente antes de `Complete` evita perder trabalho; confirmar antes da persistência cria janela de perda.

## Receber explicitamente

Crie a fila `embeddings-lab` para testar confirmação e rejeição sem consumir trabalho real. Conceda `Azure Service Bus Data Receiver` à identidade do exemplo e instale os mesmos pacotes do artigo de filas. Use `SERVICEBUS_NAMESPACE` com o nome DNS do namespace.

```python
import os
import json
from azure.identity import DefaultAzureCredential
from azure.servicebus import ServiceBusClient, ServiceBusReceiveMode

with DefaultAzureCredential() as credential:
    with ServiceBusClient(os.environ["SERVICEBUS_NAMESPACE"], credential) as client:
        with client.get_queue_receiver(
            queue_name="embeddings-lab", receive_mode=ServiceBusReceiveMode.PEEK_LOCK,
        ) as receiver:
            for message in receiver.receive_messages(max_message_count=1, max_wait_time=5):
                try:
                    payload = json.loads(str(message))
                    document_id = payload["document_id"]
                    if not isinstance(document_id, str) or not document_id.strip():
                        raise ValueError("document_id deve ser string não vazia")
                except (ValueError, KeyError, TypeError):
                    receiver.dead_letter_message(message, reason="InvalidPayload")
                    continue
                print(f"Mensagem de laboratório validada: {document_id}")
                receiver.complete_message(message)
```

```csharp
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using System.Text.Json;

await using var client = new ServiceBusClient(
    Environment.GetEnvironmentVariable("SERVICEBUS_NAMESPACE"), new DefaultAzureCredential());
await using var receiver = client.CreateReceiver("embeddings-lab",
    new ServiceBusReceiverOptions { ReceiveMode = ServiceBusReceiveMode.PeekLock });
ServiceBusReceivedMessage? message = await receiver.ReceiveMessageAsync(TimeSpan.FromSeconds(5));
if (message is not null) {
    try {
        using var payload = JsonDocument.Parse(message.Body.ToString());
        if (payload.RootElement.ValueKind != JsonValueKind.Object ||
            !payload.RootElement.TryGetProperty("document_id", out var field) ||
            field.ValueKind != JsonValueKind.String ||
            string.IsNullOrWhiteSpace(field.GetString()))
            throw new JsonException("document_id deve ser string não vazia");
        Console.WriteLine($"Mensagem de laboratório validada: {field.GetString()}");
        await receiver.CompleteMessageAsync(message);
    } catch (JsonException) {
        await receiver.DeadLetterMessageAsync(message, "InvalidPayload");
    }
}
```

Envie `{"document_id":"manual-1"}` e `{}` à fila de laboratório. Execute o consumidor uma vez por mensagem. A válida deve ser confirmada; a inválida deve aparecer na DLQ com motivo `InvalidPayload`. No indexador real, confirme só após persistir o resultado de forma idempotente. Trate falhas transitórias separadamente e renove o lock quando o trabalho for longo.

## DLQ, sessões e recuperação

Mensagens podem ir para ==DLQ== por limite de entregas ou por decisão explícita. Monitore tamanho e motivos; a DLQ não se drena sozinha. Corrija a causa e reenvie com rastreabilidade, evitando ciclos infinitos de replay.

Sessões agrupam mensagens por `SessionId` e fornecem processamento ordenado por sessão com lock exclusivo. Não há ordem global entre sessões; use consumidores compatíveis com entidades que exigem sessão.

<details>
<summary>Checagem Rápida: Detecção de duplicados garante efeito exatamente uma vez?</summary>

Não. Ela reduz duplicação de envios dentro de uma janela. Reentrega após perda do lock ainda exige consumidor idempotente.

</details>

## Pegadinhas de Prova

- **Complete no início melhora confiabilidade**: Isso pode perder trabalho se o processo falhar antes de persistir.
- **DLQ exclui definitivamente**: A mensagem continua disponível para inspeção e recuperação.
- **Sessões ordenam a fila inteira**: A garantia é por sessão, com processamento e concorrência adequados.

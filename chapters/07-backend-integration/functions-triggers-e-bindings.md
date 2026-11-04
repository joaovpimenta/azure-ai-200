---
title: "Functions: triggers, bindings e modelo de programação"
slug: functions-triggers-e-bindings
chapter: 07-backend-integration
exam_domain: connect-and-consume
tags:
  - azure-functions
  - triggers
  - input-bindings
  - output-bindings
  - serverless
  - python
  - csharp
difficulty: intermediate
tldr: Cada função tem um trigger e pode ter vários bindings. Trigger inicia a
  execução; bindings leem ou enviam dados. Permissões, validação e tratamento de
  falhas continuam necessários.
related_links:
  - label: Triggers e bindings
    url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
    type: learn
  - label: Python developer guide
    url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-reference-python
    type: learn
  - label: Output binding para Azure Queue Storage
    url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-storage-queue-output
    type: learn
  - label: .NET isolated
    url: https://learn.microsoft.com/en-us/azure/azure-functions/dotnet-isolated-process-guide
    type: learn
questions:
  - id: q-functions-triggers-e-bindings-01
    type: single-choice
    title: "Functions: triggers, bindings e modelo de programação"
    exam_domain: connect-and-consume
    stem: Uma função deve responder a HTTP e a Service Bus usando a mesma lógica.
      Como estruturar os acionadores?
    options:
      - id: opt-3
        text: Transformar o trigger HTTP em um ConfigMap.
        correct: false
        rationale: ConfigMap não é um acionador de Azure Functions.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
      - id: opt-4
        text: Remover a identidade porque bindings concedem acesso.
        correct: false
        rationale: Bindings ainda dependem de conexão e autorização válidas.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
      - id: opt-1
        text: Criar duas funções com um trigger cada e compartilhar a lógica de negócio.
        correct: true
        rationale: Cada função tem um trigger, e a lógica pode ser reutilizada em um
          módulo comum.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
      - id: opt-2
        text: Adicionar dois triggers à mesma função.
        correct: false
        rationale: O modelo exige um trigger por função.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
    tags:
      - azure-functions
      - triggers
      - input-bindings
      - output-bindings
      - serverless
      - python
      - csharp
    learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-triggers-bindings
---

# Functions: triggers, bindings e modelo de programação

Azure Functions executa código em resposta a um evento. O trigger é o gatilho, como uma chamada HTTP ou mensagem na fila. Bindings são integrações de entrada ou saída que reduzem o código necessário para ler ou gravar dados.

## Modelo de execução

Uma função possui exatamente um ==trigger==. Pode ter múltiplos bindings de entrada e saída, desde que suportados pela extensão e linguagem. Um binding não transforma automaticamente a chamada em transação distribuída entre o broker e o banco.

| Elemento | Responsabilidade |
|---|---|
| Trigger | Acionar execução e fornecer contexto |
| Input binding | Disponibilizar dados adicionais |
| Output binding | Encaminhar o resultado ao destino |
| SDK explícito | Dar controle fino sobre operações e tratamento de falhas |

Use Python programming model v2 com decorators ou C# ==isolated worker==. Não misture atributos e pacotes do modelo in-process com o isolated.

## Endpoint HTTP equivalente

Os trechos pertencem a projetos Functions v4 criados com Core Tools. Python usa `azure-functions`; C# usa o template .NET 8 isolated e as extensões HTTP do worker. Cada exemplo implementa um endpoint GET `health`.

```python
import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="health", methods=["GET"])
def health(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        '{"status":"ok"}', status_code=200, mimetype="application/json",
    )
```

```csharp
using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public class HealthFunction
{
    [Function("Health")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "health")]
        HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { status = "ok" });
        return response;
    }
}
```

O host, `host.json` e dependências vêm do projeto gerado; um arquivo isolado não configura todo o runtime. Localmente, Core Tools pode não exigir a chave como no Azure. Não conclua que o endpoint publicado está anônimo só porque funcionou sem chave no laboratório.

## API HTTP com output binding para fila

Este segundo exemplo demonstra uma API que aceita um trabalho e produz uma mensagem no Azure Queue Storage. Ele pode coexistir com o endpoint `health`. Use a extensão de Storage Queues no .NET (`Microsoft.Azure.Functions.Worker.Extensions.Storage.Queues`) e um extension bundle compatível no projeto Python. Provisione a fila `jobs` e configure o prefixo de conexão `StorageConnection`.

No Azure, uma conexão baseada em identidade pode usar a configuração `StorageConnection__queueServiceUri=https://<conta>.queue.core.windows.net`, com a managed identity autorizada por `Storage Queue Data Contributor` no escopo necessário. A conexão do binding é distinta de `AzureWebJobsStorage`, usada pelo host. Para laboratório local com Azurite, configure `StorageConnection=UseDevelopmentStorage=true` no arquivo local, sem publicar essa configuração como credencial de produção.

```python
import json
import uuid
import azure.functions as func

# Reutiliza a instância app = func.FunctionApp(...) definida no projeto.
@app.route(route="jobs", methods=["POST"], auth_level=func.AuthLevel.FUNCTION)
@app.queue_output(arg_name="message", queue_name="jobs", connection="StorageConnection")
def enqueue(req: func.HttpRequest, message: func.Out[str]) -> func.HttpResponse:
    job_id: str = str(uuid.uuid4())
    message.set(json.dumps({"job_id": job_id, "operation": "reindex"}))
    return func.HttpResponse(
        json.dumps({"job_id": job_id}), status_code=202, mimetype="application/json",
    )
```

```csharp
using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

public class EnqueueOutput
{
    [QueueOutput("jobs", Connection = "StorageConnection")]
    public string QueueMessage { get; set; } = "";
    public HttpResponseData HttpResponse { get; set; } = null!;
}

public class EnqueueFunction
{
    [Function("Enqueue")]
    public async Task<EnqueueOutput> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "jobs")]
        HttpRequestData req)
    {
        string jobId = Guid.NewGuid().ToString();
        var response = req.CreateResponse(HttpStatusCode.Accepted);
        await response.WriteAsJsonAsync(new { job_id = jobId }, HttpStatusCode.Accepted);
        return new EnqueueOutput {
            HttpResponse = response,
            QueueMessage = JsonSerializer.Serialize(new { job_id = jobId, operation = "reindex" })
        };
    }
}
```

O trigger recebe HTTP; o binding de saída grava a mensagem ao concluir a execução. Teste o POST e confira a mensagem na fila para validar configuração e autorização. O retorno 202 significa aceitação, não conclusão da reindexação. O consumidor deve persistir status e processar de forma idempotente; uma repetição do POST pode criar outro trabalho. Se a API precisar controlar diretamente erros de envio ou deduplicação por chave do cliente, considere o SDK explícito.

## Integração com mensagens

Para um Service Bus trigger, configure entidade e conexão, instale a extensão apropriada e prefira conexão baseada em identidade quando suportada. Um output binding pode enviar a próxima etapa do pipeline. Se precisar inspecionar erros de envio durante a execução ou controlar settlement, avalie o SDK explícito e as opções do trigger.

Não faça processamento pesado antes de validar entrada. Aumentar concorrência do host sem considerar conexões, memória e quotas do modelo pode aumentar falhas e throttling.

<details>
<summary>Checagem Rápida: AuthorizationLevel.Function identifica o usuário final?</summary>

Não. Uma function key é um segredo compartilhado de acesso ao endpoint, não autenticação individual. Use autenticação de aplicação/API apropriada para usuários e serviços.

</details>

## Pegadinhas de Prova

- **Dois triggers na mesma função**: Divida em funções distintas e compartilhe a lógica de negócio.
- **Binding concede acesso**: A conexão e sua identidade precisam de autorização no recurso.
- **Entrega sem duplicados**: Triggers de mensagens podem reexecutar; preserve idempotência.

---
title: "OpenTelemetry e Azure Monitor Distro: traces, métricas e logs"
slug: opentelemetry-azure-monitor
chapter: 09-observe-and-troubleshoot
exam_domain: secure-monitor-troubleshoot
tags:
  - opentelemetry
  - azure-monitor
  - application-insights
  - distributed-tracing
  - traces
  - metrics
  - telemetry
difficulty: intermediate
tldr: Traces mostram o caminho de uma operação; spans, suas etapas. Métricas
  resumem comportamento e logs registram eventos. Propague o contexto e
  configure instrumentação e exportação para Azure Monitor.
related_links:
  - label: Azure Monitor OpenTelemetry
    url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
    type: learn
  - label: Adicionar telemetria
    url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-add-modify
    type: learn
questions:
  - id: q-opentelemetry-azure-monitor-01
    type: single-choice
    title: "OpenTelemetry e Azure Monitor Distro: traces, métricas e logs"
    exam_domain: secure-monitor-troubleshoot
    stem: Um ActivitySource personalizado não produz spans exportados no .NET. Qual
      configuração deve ser verificada?
    options:
      - id: opt-4
        text: Adicionar outro exporter idêntico sem revisar a configuração.
        correct: false
        rationale: Isso pode duplicar dados e não garante captura da origem.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
      - id: opt-1
        text: Registrar a origem correspondente com AddSource na configuração de
          tracing.
        correct: true
        rationale: O provider precisa escutar a origem para capturar as activities.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
      - id: opt-2
        text: Somente renomear todas as operações para o mesmo nome.
        correct: false
        rationale: Nome igual não registra origem nem propaga contexto.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
      - id: opt-3
        text: Gravar bearer tokens como atributos para depuração.
        correct: false
        rationale: Isso expõe credenciais e não corrige a instrumentação.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
    tags:
      - opentelemetry
      - azure-monitor
      - application-insights
      - distributed-tracing
      - traces
      - metrics
      - telemetry
    learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
---

# OpenTelemetry e Azure Monitor Distro: traces, métricas e logs

O assistente começou a demorar. A duração total confirma o problema, mas ainda falta saber se o tempo foi gasto na busca de manuais ou na geração da resposta. Com OpenTelemetry, um ==trace== agrupa o caminho da requisição. Cada ==span== registra uma etapa com início, fim e contexto. Abra o trace de uma resposta lenta e compare a duração dos spans.

## Sinais e propagação

==TraceId== identifica o fluxo; `SpanId` identifica uma etapa; o contexto parental liga etapas. Propague o contexto W3C nos protocolos e clientes suportados. Um header arbitrário chamado `requestId` ajuda na busca, mas não substitui propagação de tracing.

| Sinal | Pergunta que responde |
|---|---|
| Trace/span | Os 900 ms dessa requisição vieram principalmente da busca ou da geração? |
| Métrica | O p95 de latência subiu depois da implantação? |
| Log | Qual erro a busca registrou nessa requisição? |

Instrumentação automática cobre bibliotecas suportadas, não toda função da aplicação. Spans personalizados ajudam a separar recuperação, reranking e geração. Evite criar spans por token ou atributos com muitos valores distintos (alta cardinalidade) sem necessidade.

## Exportar para Application Insights

Defina `APPLICATIONINSIGHTS_CONNECTION_STRING` por configuração do ambiente. Python requer `azure-monitor-opentelemetry`; .NET 8 requer `Azure.Monitor.OpenTelemetry.AspNetCore` e um projeto ASP.NET Core. Não configure dois exporters equivalentes para a mesma instrumentação sem intenção, pois isso pode duplicar dados.

```python
import logging
from azure.monitor.opentelemetry import configure_azure_monitor
from opentelemetry import trace

configure_azure_monitor(logger_name="ai200.worker")
logger = logging.getLogger("ai200.worker")
logger.setLevel(logging.INFO)
tracer = trace.get_tracer("ai200.worker")
with tracer.start_as_current_span("rag.retrieve") as span:
    span.set_attribute("rag.top_k", 5)
    # Execute a recuperação usando um cliente instrumentado.
    logger.info("Recuperação iniciada")
```

```csharp
using System.Diagnostics;
using Azure.Monitor.OpenTelemetry.AspNetCore;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource("Ai200.Api"))
    .UseAzureMonitor();
var app = builder.Build();
using var source = new ActivitySource("Ai200.Api");
app.MapGet("/health", () => {
    using var activity = source.StartActivity("rag.check", ActivityKind.Internal);
    activity?.SetTag("rag.top_k", 5);
    return Results.Ok(new { status = "ok" });
});
app.Run();
```

Execute o script Python ou inicie a API .NET e chame `/health` na URL local que ela anunciar. Procure `rag.retrieve` ou `rag.check` no Application Insights. No .NET, localize `rag.check` dentro da transação de `/health`. Se a requisição chegou mas o span personalizado sumiu, compare o nome em `AddSource` com o nome em `ActivitySource` e confira a amostragem. Em um worker persistente, mantenha o provedor ativo e encerre-o de forma graciosa para enviar a telemetria pendente.

## Qualidade e privacidade dos dados

==Sampling== (amostragem) reduz volume e custo, mas altera a interpretação de contagens. Confira pesos de amostragem e preserve correlação entre serviços. Logs sem contexto ativo podem não aparecer ligados ao trace esperado.

Não grave credenciais, tokens, documentos ou prompts completos como atributos por padrão. Use nomes estáveis para operações e tags de baixa cardinalidade, como versão de deploy e tipo de operação. A telemetria também precisa de política de acesso e retenção.

<details>
<summary>Checagem rápida · Duas APIs mostram o nome rag.retrieve, mas aparecem em traces separados. O que falta conferir?</summary>

Confira se as duas etapas têm o mesmo `TraceId` e se o contexto chegou à segunda API. Usar o mesmo nome para um span ajuda nas buscas, mas a relação entre as etapas depende da propagação do contexto.

</details>

## Pegadinhas de Prova

- **Exporter instrumenta toda lógica**: Configure bibliotecas e spans que representam as etapas relevantes.
- **Mesmo nome de operação cria correlação**: A relação depende de contexto propagado.
- **Mais atributos sempre ajudam**: Dados sensíveis e alta cardinalidade aumentam risco, volume e custo.

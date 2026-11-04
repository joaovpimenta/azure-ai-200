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
tldr: OpenTelemetry correlaciona spans de uma operação distribuída. Azure Monitor Distro exporta
  telemetria para Application Insights; configure instrumentação, propagação e sampling sem expor
  prompts ou segredos.
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
    stem: Um ActivitySource personalizado não produz spans exportados no .NET. Qual configuração deve
      ser verificada?
    options:
      - id: opt-4
        text: Adicionar outro exporter idêntico sem revisar a configuração.
        correct: false
        rationale: Isso pode duplicar dados e não garante captura da origem.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable
      - id: opt-1
        text: Registrar a origem correspondente com AddSource na configuração de tracing.
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
---

# OpenTelemetry e Azure Monitor Distro: traces, métricas e logs

Uma chamada de chat atravessa API, broker, worker, banco e modelo. Registrar apenas o tempo total não mostra qual dependência consumiu a latência. OpenTelemetry organiza o caminho por trace e spans, permitindo correlacionar os componentes.

## Sinais e propagação

==TraceId== identifica o fluxo; `SpanId` identifica uma etapa; o contexto parental liga etapas. Propague o contexto W3C nos protocolos e clientes suportados. Um header arbitrário chamado `requestId` ajuda na busca, mas não substitui propagação de tracing.

| Sinal | Pergunta que responde |
|---|---|
| Trace/span | Onde uma operação gastou tempo e falhou? |
| Métrica | Qual o comportamento agregado ao longo do tempo? |
| Log | Qual evento e contexto específico ocorreu? |

Instrumentação automática cobre bibliotecas suportadas, não toda função da aplicação. Spans personalizados ajudam a separar recuperação, reranking e geração. Evite criar spans por token ou atributos de alta cardinalidade sem necessidade.

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

O worker Python do exemplo é pontual; um serviço persistente deve deixar o provider ativo e encerrá-lo de forma graciosa para exportar lotes pendentes. No .NET, a origem personalizada precisa estar registrada com `AddSource` para gerar spans exportáveis.

## Qualidade e privacidade dos dados

==Sampling== reduz volume e custo, mas altera a interpretação de contagens. Confira pesos de amostragem e preserve correlação entre serviços. Logs sem contexto ativo podem não aparecer ligados ao trace esperado.

Não grave credenciais, tokens, documentos ou prompts completos como atributos por padrão. Use nomes estáveis para operações e tags de baixa cardinalidade, como versão de deploy e tipo de operação. A telemetria também precisa de política de acesso e retenção.

<details>
<summary>Checagem Rápida: Um span aparece só porque ActivitySource foi instanciado?</summary>

Não. A origem precisa ser ouvida pela configuração OpenTelemetry. Sem listener compatível, `StartActivity` pode retornar null.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Exporter instrumenta toda lógica**: Configure bibliotecas e spans que representam as etapas relevantes.
- **Pegadinha 2: Mesmo nome de operação cria correlação**: A relação depende de contexto propagado.
- **Pegadinha 3: Mais atributos sempre ajudam**: Dados sensíveis e alta cardinalidade aumentam risco, volume e custo.

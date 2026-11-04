---
title: "KQL: where, summarize, bin, join e render"
slug: kql-consultas-logs-metricas
chapter: 09-observe-and-troubleshoot
exam_domain: secure-monitor-troubleshoot
tags:
  - kql
  - log-analytics
  - summarize
  - bin
  - joins
  - kql-render
  - application-insights
difficulty: intermediate
tldr: Em KQL, where filtra, summarize agrega, bin agrupa em intervalos e join
  combina tabelas. Confira esquema e amostragem. Várias dependências por
  requisição podem multiplicar linhas no join.
related_links:
  - label: Visão geral de KQL
    url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
    type: learn
  - label: Esquema Application Insights
    url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete
    type: learn
questions:
  - id: q-kql-consultas-logs-metricas-01
    type: single-choice
    title: "KQL: where, summarize, bin, join e render"
    exam_domain: secure-monitor-troubleshoot
    stem: Um join entre AppRequests e AppDependencies aumenta a contagem de
      requisições. Qual é uma correção adequada para uma linha por requisição?
    options:
      - id: opt-1
        text: Agregar dependências por OperationId antes do join.
        correct: true
        rationale: Isso evita multiplicar linhas pela quantidade de dependências da
          operação no escopo consultado.
        learn_url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
      - id: opt-2
        text: Usar render timechart para remover duplicação lógica.
        correct: false
        rationale: Render altera a visualização, não a cardinalidade do join.
        learn_url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
      - id: opt-3
        text: Contar todas as linhas resultantes como novas requisições.
        correct: false
        rationale: Cada linha pode representar uma dependência da mesma requisição.
        learn_url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
      - id: opt-4
        text: Trocar DurationMs por um campo de outro esquema sem adaptação.
        correct: false
        rationale: Misturar esquemas não resolve a cardinalidade e pode quebrar a
          consulta.
        learn_url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
    tags:
      - kql
      - log-analytics
      - summarize
      - bin
      - joins
      - kql-render
      - application-insights
    learn_url: https://learn.microsoft.com/en-us/kusto/query/?view=azure-monitor
---

# KQL: where, summarize, bin, join e render

KQL é a linguagem usada para consultar logs no Azure Monitor. Você pode filtrar um período, contar falhas e comparar tempos de resposta. O p95 é o tempo abaixo do qual ficaram 95% das medições; ele ajuda a enxergar lentidão que a média esconde.

## Contexto e esquema

Os exemplos usam tabelas de workspace: `AppRequests`, `AppDependencies` e campos como `TimeGenerated`, `OperationId` e `DurationMs`. No contexto Application Insights clássico, podem existir `requests`, `dependencies`, `timestamp`, `operation_Id` e `duration`. Não misture os dois esquemas na mesma consulta sem adaptar os campos.

A sequência `where`, `project`, ==summarize== e `order by` forma uma pipeline. Filtre cedo por tempo e serviço para reduzir dados processados. `bin` agrupa instantes em janelas; não inventa linhas para intervalos sem eventos.

## Volume, falhas e latência por janela

```kql
AppRequests
| where TimeGenerated > ago(1h)
| summarize Samples=count(),
    EstimatedRequests=sum(ItemCount),
    FailedSamples=countif(Success == false),
    P95Ms=percentile(DurationMs, 95)
    by bin(TimeGenerated, 5m), AppRoleName
| order by TimeGenerated asc
| render timechart
```

`Samples` e `FailedSamples` contam linhas observadas. `EstimatedRequests` usa peso de amostragem. O p95 acima é dos registros presentes; se precisar de percentil ponderado, escolha agregação compatível com o peso. Não apresente métricas amostradas como contagem exata de todas as requisições.

## Correlacionar dependências sem duplicar requisições

Uma requisição pode ter várias dependências. Agregue o lado de dependências antes do join quando quiser uma linha por requisição. Execute no escopo da aplicação desejada; se consultar vários recursos juntos, inclua também a identificação do recurso na correlação.

```kql
let DependenciesByOperation = AppDependencies
| where TimeGenerated > ago(1h)
| summarize DependencyCalls=count(),
    DependencyFailures=countif(Success == false)
    by OperationId;
AppRequests
| where TimeGenerated > ago(1h)
| project TimeGenerated, OperationId, Name, DurationMs, Success
| join kind=leftouter DependenciesByOperation on OperationId
| project TimeGenerated, Name, DurationMs, Success,
    DependencyCalls, DependencyFailures, OperationId
| order by DurationMs desc
| take 20
```

A soma das durações de dependências pode exceder o tempo da requisição quando há paralelismo. Não some essas durações e trate o resultado como latência percebida pelo usuário.

## Ler e interpretar

`count()` conta linhas; `dcount()` estima valores distintos. `join kind=inner` descarta requisições sem correspondência; `leftouter` preserva o lado esquerdo. Um gráfico vazio pode indicar contexto, intervalo ou nome de tabela incorreto, além de ausência real de tráfego.

<details>
<summary>Checagem Rápida: Um join direto entre requisições e dependências preserva a contagem de requests?</summary>

Não necessariamente. Várias dependências por operação podem multiplicar linhas. Agregue conforme a unidade de análise antes de contar.

</details>

## Pegadinhas de Prova

- **DurationMs e duration são intercambiáveis**: Confirme tipo e esquema no contexto de consulta.
- **Média revela cauda**: Use percentis e volume para investigar usuários mais lentos.
- **Render muda a agregação**: Ele escolhe a visualização do resultado; a semântica vem das etapas anteriores.

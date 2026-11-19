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
    stem: Uma requisição tem três dependências filhas diretas. Você quer
      exibir os totais sem transformar a requisição em três linhas. Como fazer?
    options:
      - id: opt-1
        text: Agregar dependências por OperationId e ParentId e ligar ParentId ao Id da requisição.
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

O assistente ficou mais lento após uma implantação. Use KQL para descobrir quando mudou, quantas requisições foram afetadas e quais dependências falharam. O p95 é o tempo abaixo do qual ficaram 95% das medições. Compare-o ao volume para distinguir um pico isolado de um problema que atinge muitos usuários.

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
| project TimeGenerated, AppRoleName, P95Ms
| render timechart
```

O gráfico mostra p95 em milissegundos. Remova `project` e `render` para ver os volumes. `Samples` e `FailedSamples` contam linhas observadas, e `EstimatedRequests` soma os pesos `ItemCount` da amostragem. Use agregação ponderada para incorporar esses pesos ao percentil.

## Correlacionar dependências sem duplicar requisições

Várias requisições em serviços diferentes podem compartilhar `OperationId` em um trace. Para contar só as dependências filhas diretas de cada requisição, agrupe pelo `ParentId` e associe-o ao `Id` da requisição dentro da mesma operação.

```kql
let DependenciesByRequest = AppDependencies
| where TimeGenerated > ago(1h) and isnotempty(ParentId)
| summarize DependencyCalls=count(),
    DependencyFailures=countif(Success == false)
    by OperationId, ParentId;
AppRequests
| where TimeGenerated > ago(1h)
| project TimeGenerated, OperationId, Id, Name, DurationMs, Success
| join kind=leftouter DependenciesByRequest on OperationId, $left.Id == $right.ParentId
| project TimeGenerated, Name, DurationMs, Success,
    DependencyCalls, DependencyFailures, OperationId
| order by DurationMs desc
| take 20
```

Se uma requisição fez três chamadas diretas, espere uma linha com `DependencyCalls = 3`. Uma requisição sem correspondência permanece com as colunas da dependência vazias. Spans aninhados podem ter outro pai. Para investigar toda a árvore, abra o trace. Chamadas em paralelo podem se sobrepor, por isso a duração percebida pelo usuário vem da requisição.

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

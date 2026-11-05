---
title: Diagnóstico de latência, falhas e throttling em aplicações de IA
slug: troubleshooting-latencia-e-falhas-ia
chapter: 09-observe-and-troubleshoot
exam_domain: secure-monitor-troubleshoot
tags:
  - troubleshooting
  - latency-analysis
  - throttling
  - 429-too-many-requests
  - failure-diagnostics
difficulty: intermediate
tldr: "Localize a etapa lenta antes de escalar. Em 429, respeite Retry-After e
  limite tentativas e concorrência. Timeout não prova que a operação falhou:
  confirme o estado antes de repetir efeitos."
related_links:
  - label: Diagnóstico de Application Insights
    url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
    type: learn
  - label: Limites do Azure OpenAI
    url: https://learn.microsoft.com/en-us/azure/foundry/openai/quotas-limits
    type: learn
  - label: Padrão Retry
    url: https://learn.microsoft.com/en-us/azure/architecture/patterns/retry
    type: learn
questions:
  - id: q-troubleshooting-latencia-e-falhas-ia-01
    type: single-choice
    title: Diagnóstico de latência, falhas e throttling em aplicações de IA
    exam_domain: secure-monitor-troubleshoot
    stem: Uma API recebe 429 do modelo e a aplicação tem retentativas em várias
      camadas. Qual mitigação é coerente?
    options:
      - id: opt-2
        text: Repetir imediatamente sem limite em cada camada.
        correct: false
        rationale: As tentativas multiplicam carga e podem prolongar a saturação.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
      - id: opt-3
        text: Aumentar réplicas sem verificar a quota do modelo.
        correct: false
        rationale: Mais workers podem aumentar chamadas contra o mesmo limite.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
      - id: opt-4
        text: Tratar timeout como prova de que nenhum efeito ocorreu.
        correct: false
        rationale: Uma operação pode ter sido concluída antes de a resposta se perder.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
      - id: opt-1
        text: Respeitar Retry-After, limitar concorrência e aplicar orçamento total de
          retentativas.
        correct: true
        rationale: Isso reduz amplificação e respeita a capacidade do serviço dependente.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
    tags:
      - troubleshooting
      - latency-analysis
      - throttling
      - 429-too-many-requests
      - failure-diagnostics
    learn_url: https://learn.microsoft.com/en-us/azure/azure-monitor/app/failures-performance-transactions
---

# Diagnóstico de latência, falhas e throttling em aplicações de IA

Quando uma API de IA fica lenta, separe o tempo gasto na fila, no banco e no modelo. Limitação de taxa (throttling) acontece quando um serviço restringe chamadas, muitas vezes com HTTP 429. Mais réplicas podem piorar a situação se todas disputarem a mesma quota.

## Separar etapas e classes de falha

Meça fila, recuperação, reordenação dos resultados (reranking), chamada ao modelo e gravação. Use trace para uma requisição concreta e métricas agregadas para estimar abrangência. Em geração com streaming, tempo até o primeiro token e duração total são medidas diferentes.

| Sinal | Hipótese | Próxima verificação |
|---|---|---|
| 401 | Credencial/token inválido | Audience, expiração e identidade utilizada |
| 403 | Autorização ou política/rede | Papel, escopo e diagnóstico do serviço |
| 429 | Limite de taxa, capacidade ou throughput | Código específico, quota e Retry-After |
| Timeout | Espera, rede ou dependência lenta | Spans, DNS, pool e orçamento de tempo |
| 5xx | Falha transitória ou interna | Estado do serviço, trace e correlação com deploy |

Um 429 do Cosmos DB e um 429 do provedor de modelo não significam a mesma métrica de capacidade. Leia o código e os headers do serviço antes de alterar recursos.

## Localizar dependências com erro

No contexto de workspace Application Insights:

```kql
AppDependencies
| where TimeGenerated > ago(1h)
| where Success == false or ResultCode == "429"
| summarize FailedSamples=count(), P95Ms=percentile(DurationMs, 95)
    by Target, Name, ResultCode, bin(TimeGenerated, 5m)
| order by FailedSamples desc
```

A consulta conta registros observados, sujeitos a sampling. Use uma operação afetada para abrir o trace e verificar tentativas repetidas, espera entre elas e o serviço que retornou o erro. Redija hipóteses testáveis, como “a espera no pool cresce com as réplicas”, em vez de concluir que “o banco está lento” apenas pela duração total.

## Retentativas com orçamento

Respeite ==Retry-After== quando fornecido e aumente progressivamente a espera entre tentativas (backoff), com pequena variação aleatória (jitter) e limite total de tempo. SDKs podem já repetir certas operações: outra camada de retries multiplica a carga. Não repita automaticamente erros permanentes de validação ou autorização.

Timeout não prova que a operação não foi executada. Para mensagens, gravações ou chamadas com efeitos externos, use idempotency keys e verificação de estado. Um circuit breaker pode evitar insistência durante falha prolongada; uma fila pode absorver picos sem aumentar imediatamente chamadas ao modelo.

## Mitigar e validar

Reduza concorrência, limite taxa de entrada ou faça rollback de uma revisão rsaída de redeiva conforme a evidência. Aumentar réplicas ajuda somente quando o gargalo pode escalar e as dependências têm capacidade. Compare p95, taxa de falha e throughput após a alteração, usando janelas e volumes comparáveis.

<details>
<summary>Checagem Rápida: Um retry imediato é sempre a melhor resposta a 429?</summary>

Não. Ele pode repetir a pressão sobre a mesma quota. Aguarde a orientação do serviço, reduza concorrência e imponha orçamento total.

</details>

## Pegadinhas de Prova

- **Todas as falhas são transitórias**: Permissões e conteúdo inválido da mensagem exigem correção, não insistência.
- **Timeout significa nenhum efeito**: A resposta pode ter se perdido após o servidor executar a operação.
- **Escalar elimina quota**: Mais workers podem aumentar throttling em um serviço com limite compartilhado.

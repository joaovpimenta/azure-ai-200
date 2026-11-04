# Capítulo 09: Observabilidade e Troubleshooting

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Seguran%C3%A7a%2C%20Monitoramento%20e%20Solu%C3%A7%C3%A3o%20de%20Problemas-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Completo-brightgreen?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

Aplicações de Inteligência Artificial generativa, pipelines RAG e orquestrações de múltiplos agentes autônomos introduzem desafios inéditos de observabilidade e confiabilidade: chamadas a modelos de linguagem (LLMs) são inerentemente não determinísticas, possuem latências variáveis (streaming de tokens com centenas de milissegundos a segundos) e estão sujeitas a limites estritos de taxa (*rate limits* e *throttling*).

O **Capítulo 09** cobre as disciplinas essenciais de diagnóstico, instrumentação e auditoria contínua de soluções de IA no Azure:
1. **Instrumentação com OpenTelemetry e Azure Monitor Distro**: Padrão aberto da CNCF para rastreamento distribuído (*distributed tracing*), métricas de performance e logs centralizados. Utilização das distribuições oficiais do Azure Monitor para Python (`azure-monitor-opentelemetry`) e .NET (`Azure.Monitor.OpenTelemetry.AspNetCore`) para correlacionar spans de ponta a ponta desde a requisição do usuário no frontend até a geração de embeddings, consultas a bancos vetoriais e inferência no Azure OpenAI Service.
2. **Consultas Analíticas em KQL (Kusto Query Language)**: Escrita de consultas avançadas sobre repositórios do **Log Analytics** e **Application Insights**, empregando operadores determinísticos como `where`, `summarize`, `bin()` para agrupamento temporal de métricas, `join` entre tabelas de requisições e dependências, e `render` para visualização imediata de anomalias.
3. **Diagnóstico Especializado de Latência, Falhas e Throttling em IA**: Identificação da causa-raiz de gargalos de desempenho em pipelines de IA, análise de falhas HTTP 429 (*Too Many Requests / Request rate is large*), estouro de Request Units (RUs) no Cosmos DB, contenção de pools de conexão em bancos relacionais e estratégias de retentativa exponencial com jitter para garantir resiliência operacional.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Rastrear e instrumentar fluxos distribuídos de aplicações de IA utilizando os SDKs e distribuições oficiais do **OpenTelemetry** conectados ao Azure Monitor e Application Insights.
- Escrever consultas **KQL** precisas para analisar logs de dependências, taxas de requisições, métricas de hardware e telemetria de exceções no Log Analytics.
- Diagnosticar e solucionar problemas críticos de latência, saturação de recursos computacionais, falhas em dependências externas e erros de *throttling* (HTTP 429) em cargas de trabalho de IA.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `opentelemetry-azure-monitor` | OpenTelemetry e Azure Monitor Distro: traces, métricas e logs | `monitor-troubleshoot` | Implementado | [Acessar Conceito](./opentelemetry-azure-monitor.md) |
| 2 | `kql-consultas-logs-metricas` | KQL: where, summarize, bin, join e render | `monitor-troubleshoot` | Implementado | [Acessar Conceito](./kql-consultas-logs-metricas.md) |
| 3 | `troubleshooting-latencia-e-falhas-ia` | Diagnóstico de latência, falhas e throttling em aplicações de IA | `monitor-troubleshoot` | Implementado | [Acessar Conceito](./troubleshooting-latencia-e-falhas-ia.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Instrumentação Zero-Code vs SDK OpenTelemetry**:
  - Para App Service e Container Apps, é possível habilitar a instrumentação automática (Java, .NET, Node.js) sem alterar o código.
  - No entanto, para rastrear detalhes internos de fluxos de IA em Python (como tokens consumidos, prompts intermediários de agentes e spans de busca vetorial), a recomendação oficial é utilizar o pacote `azure-monitor-opentelemetry` com `configure_azure_monitor()` configurando a string de conexão (`APPLICATIONINSIGHTS_CONNECTION_STRING`).
- **Padrões de Consulta KQL Recorrentes**:
  - Agrupamento temporal com `bin()`:
    ```kql
    requests
    | where timestamp > ago(24h)
    | summarize ReqCount = count(), P95_Latency = percentile(duration, 95) by bin(timestamp, 1h), resultCode
    | render timechart
    ```
  - Detecção de Throttling (HTTP 429) no Azure OpenAI e Cosmos DB:
    ```kql
    dependencies
    | where timestamp > ago(4h) and resultCode == "429"
    | summarize ThrottledCalls = count() by target, bin(timestamp, 15m)
    ```
- **Diferença entre `requests` e `dependencies` no Application Insights**:
  - A tabela `requests` registra chamadas HTTP recebidas pela sua aplicação (tempo de resposta percebido pelo cliente).
  - A tabela `dependencies` registra chamadas de saída feitas pela sua aplicação para outros serviços (Azure OpenAI, Cosmos DB, Key Vault, Redis, APIs externas). Ao investigar lentidão em agentes de IA, o gargalo invariavelmente está isolado na tabela `dependencies`.
- **Tratamento de HTTP 429 (*Too Many Requests*)**: Quando o Azure OpenAI Service ou o Cosmos DB retorna 429, a resposta contém o cabeçalho `Retry-After` (ou no Cosmos DB a propriedade `x-ms-retry-after-ms`). O cliente SDK deve respeitar rigorosamente esse intervalo e aplicar o padrão de *Exponential Backoff with Jitter* para evitar amplificação da tempestade de requisições (*retry storm*).

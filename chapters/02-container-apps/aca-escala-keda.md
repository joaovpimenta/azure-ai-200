---
title: Regras de escala HTTP, TCP e KEDA (scale to zero)
slug: aca-escala-keda
chapter: 02-container-apps
exam_domain: containerized-solutions
tags:
  - container-apps
  - keda
  - autoscaling
  - scale-to-zero
  - service-bus
difficulty: intermediate
tldr: HTTP/TCP escalam por carga de entrada; KEDA pode escalar por mensagens na
  fila. Para voltar de zero réplicas, use um sinal externo com autorização
  válida. Respeite a capacidade das dependências.
related_links:
  - label: Escala no Container Apps
    url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
    type: learn
questions:
  - id: q-aca-escala-keda-01
    type: single-choice
    title: Regras de escala HTTP, TCP e KEDA (scale to zero)
    exam_domain: containerized-solutions
    stem: Um worker deve escalar a zero quando ocioso e acordar quando chegam
      mensagens. Qual sinal é adequado?
    options:
      - id: opt-3
        text: Somente maxReplicas maior que zero.
        correct: false
        rationale: O teto não define o gatilho que inicia réplicas.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
      - id: opt-4
        text: Um endpoint HTTP desabilitado sem regra externa.
        correct: false
        rationale: Sem um sinal capaz de ativar a aplicação, novas mensagens não
          determinam escala.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
      - id: opt-1
        text: Uma regra KEDA de fila com autenticação e permissões válidas.
        correct: true
        rationale: O escalador consulta a métrica externa mesmo sem réplicas ativas.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
      - id: opt-2
        text: Apenas CPU do próprio worker.
        correct: false
        rationale: Sem réplicas não há CPU de worker para sinalizar a reativação.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
    tags:
      - container-apps
      - keda
      - autoscaling
      - scale-to-zero
      - service-bus
    learn_url: https://learn.microsoft.com/en-us/azure/container-apps/scale-app
---

# Regras de escala HTTP, TCP e KEDA (scale to zero)

Escalar significa aumentar ou reduzir o número de cópias da aplicação, chamadas réplicas. O Container Apps usa ==KEDA== para reagir a sinais externos, como mensagens pendentes. Para um worker que espera chamadas de IA, o tamanho da fila costuma ser mais útil que o uso de CPU.

## Escolher o sinal

| Regra | Sinal | Uso típico |
|---|---|---|
| HTTP | Requisições concorrentes | API de inferência |
| TCP | Conexões concorrentes | Serviço de protocolo TCP |
| Custom KEDA | Métrica de serviço externo | Worker de fila |
| CPU/memória | Utilização das réplicas | Ajuste de capacidade já ativa |

`minReplicas` estabelece o piso; `maxReplicas` limita o teto. Uma aplicação em zero não produz métricas próprias de CPU para acordar. Para ==scale-to-zero==, configure um gatilho externo suportado e sua autenticação. Não atribua valores universais de réplicas ou intervalos: limites dependem do serviço, perfil e configuração.

## Regra de fila com identidade

Trecho de `properties.template.scale` para um worker; pressupõe identidade gerenciada atribuída ao app e papel `Azure Service Bus Data Receiver` no escopo necessário. Substitua o resource ID. Use uma versão da API/CLI que suporte identidade na regra.

```yaml
minReplicas: 0
maxReplicas: 10
rules:
  - name: fila-embeddings
    custom:
      type: azure-servicebus
      identity: /subscriptions/SUB/resourceGroups/rg-ai200/providers/Microsoft.ManagedIdentity/userAssignedIdentities/worker-id
      metadata:
        namespace: meu-servicebus
        queueName: embeddings
        messageCount: "5"
```

`messageCount` é uma meta do escalador, não o número máximo de mensagens que o SDK pode receber. Para HTTP, a CLI permite definir a meta de concorrência:

```bash
az containerapp update --name api-ai200 --resource-group rg-ai200 \
  --min-replicas 1 --max-replicas 5 \
  --scale-rule-name http --scale-rule-type http \
  --scale-rule-http-concurrency 20
```

## Dimensionar sem transferir o gargalo

Relacione duração por mensagem, concorrência por worker e quota do modelo. Aumentar réplicas pode saturar o banco, o pool de conexões ou o limite de tokens do provedor de IA. Defina limites de espera, operações que tolerem repetição (idempotência) e tratamento de 429 antes de elevar o teto.

Cold start é o tempo para iniciar uma réplica: alocar recursos, baixar a imagem e carregar o modelo. Use piso maior que zero quando a primeira resposta tem requisito de latência; isso mantém consumo mesmo sem requisições. O piso também não elimina indisponibilidade durante falhas.

<details>
<summary>Checagem Rápida: Uma regra correta com credencial expirada consegue acordar um worker?</summary>

Não. O escalador precisa consultar a origem da métrica. Valide autorização e logs do sistema, além do código do worker.

</details>

## Pegadinhas de Prova

- **CPU acorda réplicas inexistentes**: Use um sinal externo para reativação a partir de zero.
- **Dez réplicas garantem dez vezes mais throughput**: Dependências e quotas podem impedir o ganho.
- **Escala é configuração global sem revisão**: As regras estão no template; alterá-las gera revisão.

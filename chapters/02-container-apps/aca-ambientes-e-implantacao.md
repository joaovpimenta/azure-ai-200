---
title: Ambientes e implantação no Container Apps (CLI e YAML)
slug: aca-ambientes-e-implantacao
chapter: 02-container-apps
exam_domain: containerized-solutions
tags:
  - container-apps
  - environments
  - ingress
  - azure-cli
  - yaml
difficulty: intermediate
tldr: O ambiente do Container Apps fornece a fronteira compartilhada de rede e operação; cada
  aplicação define imagem, recursos, ingress e escala. Configure explicitamente exposição externa e
  targetPort.
related_links:
  - label: Ambientes do Container Apps
    url: https://learn.microsoft.com/en-us/azure/container-apps/environment
    type: learn
  - label: Ingress
    url: https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview
    type: learn
questions:
  - id: q-aca-ambientes-e-implantacao-01
    type: single-choice
    title: Ambientes e implantação no Container Apps (CLI e YAML)
    exam_domain: containerized-solutions
    stem: Um worker do Container Apps consome Service Bus e não recebe chamadas HTTP. Qual configuração
      é adequada?
    options:
      - id: opt-4
        text: Remover as permissões do Service Bus porque o app está no Azure.
        correct: false
        rationale: Acesso ao broker continua exigindo autorização.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
      - id: opt-1
        text: Operar sem ingress, com saída de rede, identidade e regra de escala apropriadas.
        correct: true
        rationale: Workers podem consumir recursos externos sem expor um endpoint de entrada.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
      - id: opt-2
        text: Habilitar ingress público obrigatoriamente.
        correct: false
        rationale: Ingress HTTP não é requisito para um consumidor de fila.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
      - id: opt-3
        text: Criar um ambiente novo para cada mensagem.
        correct: false
        rationale: O ambiente é infraestrutura compartilhada, não uma unidade de trabalho.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
    tags:
      - container-apps
      - environments
      - ingress
      - azure-cli
      - yaml
---

# Ambientes e implantação no Container Apps (CLI e YAML)

Uma solução de IA pode ter uma API pública e workers internos no mesmo ambiente do Container Apps. O ==managed environment== agrupa aplicações e integra rede, observabilidade e perfis de carga; ele não é uma imagem nem uma revisão.

## Fronteiras e conectividade

Diferencie três decisões: ambiente integrado à VNet, ambiente interno ou externo e ingress de cada aplicação. Uma aplicação com ingress interno não se torna pública apenas porque outra aplicação no ambiente aceita tráfego externo. Resolução de nomes, rotas e acesso aos serviços de dados continuam necessários.

| Configuração | Escopo | Consequência |
|---|---|---|
| VNet e perfis de carga | Ambiente | Planejar endereçamento e capacidade |
| Ingress e secrets | Aplicação | Definir exposição e referências |
| Imagem, CPU, memória e escala | Template da revisão | Produzir nova versão executável |

## Implantar com CLI

Pré-requisitos: assinatura selecionada, provedores registrados e CLI com a extensão `containerapp`. Os nomes de recursos devem ser únicos quando exigido. A imagem pública abaixo é apenas um teste de conectividade; substitua-a pela imagem da aplicação.

```bash
az group create --name rg-ai200 --location eastus
az containerapp env create --name env-ai200 --resource-group rg-ai200 \
  --location eastus
az containerapp create --name api-ai200 --resource-group rg-ai200 \
  --environment env-ai200 --image mcr.microsoft.com/k8se/quickstart:latest \
  --ingress external --target-port 80 --min-replicas 1 --max-replicas 3
az containerapp show --name api-ai200 --resource-group rg-ai200 \
  --query properties.configuration.ingress.fqdn -o tsv
```

Para uma API real, fixe a imagem por versão ou digest, configure probes e ajuste CPU/memória conforme o perfil de carga. O processo precisa escutar na interface e porta corretas. Workers de fila podem operar sem ingress.

## Template declarativo

Este trecho representa partes de um YAML de aplicação, não um documento completo. Preserve `environmentId`, identidade e demais campos ao usar `az containerapp update --yaml`.

```yaml
properties:
  configuration:
    ingress:
      external: false
      targetPort: 8000
      transport: auto
  template:
    containers:
      - name: api
        image: meuregistro.azurecr.io/api:2026.11.04-1
        resources:
          cpu: 0.5
          memory: 1Gi
    scale:
      minReplicas: 1
      maxReplicas: 5
```

<details>
<summary>Checagem Rápida: Um worker sem ingress consegue consumir mensagens?</summary>

Sim, desde que tenha saída de rede, autorização no broker e regra de escala adequada. Ingress controla conexões recebidas; não é requisito para todo processamento.

</details>

Confira estado de provisionamento, readiness, FQDN e logs antes de considerar o deploy concluído. Limpe o grupo de laboratório quando terminar para evitar cobranças.

## Pegadinhas de Prova

- **Pegadinha 1: Ambiente é a aplicação**: O ambiente fornece infraestrutura compartilhada; cada app mantém configuração e ciclo de revisões próprios.
- **Pegadinha 2: TargetPort corrige o processo**: O roteamento não altera a porta real de escuta da aplicação.
- **Pegadinha 3: Sem ingress significa sem rede**: Um worker pode acessar recursos externos, conforme DNS, rotas e políticas de saída.

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
tldr: O ambiente reúne aplicações e compartilha rede. Cada app define imagem,
  recursos e escala. Ingress controla conexões recebidas; workers de fila podem
  operar sem ele.
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
    stem: Um worker do Container Apps consome Service Bus e não recebe chamadas
      HTTP. Qual configuração é adequada?
    options:
      - id: opt-4
        text: Remover as permissões do Service Bus porque o app está no Azure.
        correct: false
        rationale: Acesso ao broker continua exigindo autorização.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
      - id: opt-1
        text: Operar sem ingress, com saída de rede, identidade e regra de escala
          apropriadas.
        correct: true
        rationale: Workers podem consumir recursos externos sem expor um endpoint de
          entrada.
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
    learn_url: https://learn.microsoft.com/en-us/azure/container-apps/environment
---

# Ambientes e implantação no Container Apps (CLI e YAML)

O assistente tem dois processos. A API recebe perguntas por HTTP. O indexador trabalha em segundo plano, consultando a fila de manuais novos. Os dois podem rodar no mesmo ==managed environment==, que fornece infraestrutura de rede e operação. Cada aplicação mantém sua imagem, configuração e escala.

## Fronteiras e conectividade

Comece pelas setas do fluxo. As chamadas **para** a API dependem do ==ingress== configurado nela. As chamadas **do** indexador para o Service Bus dependem de DNS, rota de saída e autorização no broker. No nível do ambiente, a integração com a VNet e o tipo de ambiente determinam quais caminhos podem existir.

| Configuração | Escopo | Consequência |
|---|---|---|
| VNet e perfis de carga | Ambiente | Planejar endereçamento e capacidade |
| Ingress e secrets | Aplicação | Definir exposição e referências |
| Imagem, CPU, memória e escala | Template da revisão | Produzir nova versão executável |

| Processo | Entrada | Sinal de escala |
|---|---|---|
| API de perguntas | Ingress HTTP, com exposição adequada ao cliente | Requisições HTTP simultâneas |
| Indexador | Ingress desabilitado, com saída para a fila | Fila do Service Bus |

## Implantar com CLI

Use uma assinatura de laboratório, com os provedores registrados e a extensão `containerapp` na CLI. Este exercício sobe uma API de teste pública para verificar o caminho de entrada. O indexador precisa da própria imagem e de uma fila configurada.

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

Abra em HTTPS o endereço retornado e confirme que a página de demonstração carrega. Se o endereço existir mas a API falhar, confira se o processo escuta na porta indicada por `targetPort` e se a revisão está pronta. Para uma API real, fixe a imagem por versão ou digest e configure sondas de saúde e recursos.

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
<summary>Checagem rápida · O indexador está saudável, mas o Service Bus rejeita a conexão. Habilitar ingress ajuda?</summary>

Inspecione a direção da chamada. O indexador inicia uma conexão de saída ao broker. Confira DNS, regras de rede e a permissão de recebimento da identidade do indexador.

</details>

Confira estado de provisionamento, readiness, FQDN e logs antes de considerar o deploy concluído. Limpe o grupo de laboratório quando terminar para evitar cobranças.

## Pegadinhas de Prova

- **Ambiente é a aplicação**: O ambiente fornece infraestrutura compartilhada; cada app mantém configuração e ciclo de revisões próprios.
- **TargetPort corrige o processo**: O roteamento não altera a porta real de escuta da aplicação.
- **Sem ingress significa sem rede**: Um worker pode acessar recursos externos, conforme DNS, rotas e políticas de saída.

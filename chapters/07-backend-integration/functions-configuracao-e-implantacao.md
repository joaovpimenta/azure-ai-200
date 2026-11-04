---
title: Planos de hospedagem, configuração e implantação de function apps
slug: functions-configuracao-e-implantacao
chapter: 07-backend-integration
exam_domain: connect-and-consume
tags:
  - azure-functions
  - hosting-plans
  - flex-consumption
  - function-apps
  - deployment
difficulty: intermediate
tldr: O plano de hospedagem determina escala, rede, latência e limites. Implante dependências e
  configuração junto ao código e valide bindings, identidade, storage e logs no ambiente Azure.
related_links:
  - label: Planos de hospedagem
    url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
    type: learn
  - label: Flex Consumption
    url: https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan
    type: learn
  - label: Implantação
    url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies
    type: learn
questions:
  - id: q-functions-configuracao-e-implantacao-01
    type: single-choice
    title: Planos de hospedagem, configuração e implantação de function apps
    exam_domain: connect-and-consume
    stem: O deploy terminou, mas uma função de fila não executa no Azure. Qual verificação é necessária?
    options:
      - id: opt-4
        text: Trocar de plano sem coletar evidência.
        correct: false
        rationale: O problema pode estar no binding ou autorização, e não no plano.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
      - id: opt-1
        text: Conferir descoberta da função, configurações de conexão, identidade e logs do host.
        correct: true
        rationale: Publicar arquivos não comprova que o trigger inicializou e está autorizado.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
      - id: opt-2
        text: Assumir que local.settings.json foi publicado com todos os segredos.
        correct: false
        rationale: Configuração local não substitui a configuração explícita no Azure.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
      - id: opt-3
        text: Aumentar apenas o timeout HTTP.
        correct: false
        rationale: Uma função de fila pode estar falhando antes de executar, sem relação com HTTP.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-functions/functions-scale
    tags:
      - azure-functions
      - hosting-plans
      - flex-consumption
      - function-apps
      - deployment
---

# Planos de hospedagem, configuração e implantação de function apps

Escolher Functions não define sozinho o comportamento operacional. Uma API com primeira resposta rápida, um worker de mensagens e uma tarefa longa podem precisar de planos diferentes, mesmo quando compartilham a mesma linguagem.

## Comparar planos

| Plano | Uso e característica | Atenção |
|---|---|---|
| Flex Consumption | Escala serverless com opções de rede e instâncias always ready | Conferir regiões, runtime e recursos suportados |
| Premium | Instâncias preparadas e escala para cargas exigentes | Custo de capacidade mínima |
| Dedicated/App Service | Capacidade provisionada em plano App Service | Configurar Always On quando aplicável |
| Consumption clássico | Modelo serverless tradicional | Limites e disponibilidade variam por plataforma |

==Cold start== depende do plano, linguagem e inicialização. Always ready ou instâncias preparadas reduzem esse impacto, mas não tornam uma chamada externa instantânea. Tempo máximo de execução, timeout HTTP e período de desligamento são limites diferentes; consulte a tabela vigente para o plano.

## Projeto e configuração

A Function App agrupa funções e compartilha runtime, configurações e identidade. `local.settings.json` contém configurações locais e não deve carregar segredos para o Git. `host.json` controla comportamento do host; variáveis específicas de ambiente pertencem à configuração da aplicação.

Exemplo mínimo de `host.json`:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": { "isEnabled": true }
    }
  }
}
```

Habilitar sampling pode alterar quantidades observadas em consultas de telemetria; não compare contagens amostradas como se fossem toda a carga.

## Publicar uma aplicação existente

Pré-requisitos: Function App criada com plano, sistema operacional e runtime compatíveis, Core Tools v4 e identidade de deploy autorizada. A configuração de build deve corresponder à linguagem.

```bash
# Execute na raiz do projeto Functions.
func start
func azure functionapp publish minha-function-app
az functionapp function list --name minha-function-app \
  --resource-group rg-ai200 -o table
```

A tecnologia de deploy varia pelo plano; por exemplo, Flex Consumption usa One Deploy. Prefira o fluxo suportado pelo Core Tools/pipeline para o destino, em vez de copiar opções de zip deploy de outro plano. Publique lockfiles e requisitos de runtime quando aplicáveis.

Configure storage requerido pelo host, conexões de triggers/bindings, identidade e Application Insights. Para conexões baseadas em identidade, use os nomes de configuração documentados pela extensão; uma variável genérica não cria essa integração automaticamente.

## Validar após publicar

Faça uma chamada real ou publique uma mensagem de teste. Confirme descoberta das funções, autorização no recurso dependente, logs e resultado persistido. Deploy concluído não prova que um trigger conseguiu iniciar. Para operações HTTP demoradas, prefira aceitação assíncrona e consulta de status ou Durable Functions conforme o caso.

<details>
<summary>Checagem Rápida: Aumentar functionTimeout remove todo limite de uma requisição HTTP?</summary>

Não. Há limites do caminho HTTP e da infraestrutura, além dos limites do plano e das dependências.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: local.settings.json é configuração publicada**: O ambiente Azure precisa de suas próprias configurações e identidades.
- **Pegadinha 2: Todo plano suporta os mesmos recursos**: Confira rede, slots, runtime e método de deploy por plano.
- **Pegadinha 3: Deploy verde significa trigger funcionando**: Verifique inicialização e execução ponta a ponta.

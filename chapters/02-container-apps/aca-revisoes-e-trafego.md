---
title: Revisões, modos de revisão e divisão de tráfego
slug: aca-revisoes-e-trafego
chapter: 02-container-apps
exam_domain: containerized-solutions
tags:
  - container-apps
  - revisions
  - traffic-splitting
  - blue-green
difficulty: intermediate
tldr: Revisões são snapshots imutáveis do template. O modo multiple permite distribuir tráfego entre
  versões; o modo single mantém a versão anterior atendendo até a nova ficar pronta.
related_links:
  - label: Revisões
    url: https://learn.microsoft.com/en-us/azure/container-apps/revisions
    type: learn
  - label: Divisão de tráfego
    url: https://learn.microsoft.com/en-us/azure/container-apps/traffic-splitting
    type: learn
questions:
  - id: q-aca-revisoes-e-trafego-01
    type: single-choice
    title: Revisões, modos de revisão e divisão de tráfego
    exam_domain: containerized-solutions
    stem: A equipe quer enviar 10% do tráfego à candidata e 90% à versão estável. Qual preparação é
      necessária?
    options:
      - id: opt-1
        text: Usar modo multiple e pesos explícitos para as revisões prontas.
        correct: true
        rationale: Múltiplas revisões ativas permitem dividir tráfego entre versões.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/revisions
      - id: opt-2
        text: Manter modo single e definir duas tags na mesma imagem.
        correct: false
        rationale: Tags no registro não criam divisão de tráfego entre revisões.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/revisions
      - id: opt-3
        text: Alterar um secret para gerar automaticamente a revisão canary.
        correct: false
        rationale: Secrets pertencem ao escopo da aplicação e sua alteração não cria revisão por si só.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/revisions
      - id: opt-4
        text: Desativar a revisão estável antes de testar a candidata.
        correct: false
        rationale: Isso remove a versão necessária para receber os 90% e para rollback.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/revisions
    tags:
      - container-apps
      - revisions
      - traffic-splitting
      - blue-green
---

# Revisões, modos de revisão e divisão de tráfego

Uma atualização de modelo pode aumentar erros mesmo quando o contêiner inicia corretamente. Revisões permitem validar uma candidata, direcionar uma fração do tráfego e voltar à versão estável sem reconstruir a imagem.

## Revisão e configuração da aplicação

Uma ==revision== registra o template, incluindo imagem, recursos, variáveis de ambiente e regras de escala. Ela é imutável: editar o template cria outra revisão. Configurações no nível da aplicação, como secrets e distribuição de tráfego, não produzem necessariamente uma nova revisão.

| Modo | Uso | Comportamento |
|---|---|---|
| `single` | Atualização simples | A revisão anterior atende até a candidata ficar pronta |
| `multiple` | Canary, blue-green e rollback controlado | Várias revisões podem permanecer ativas |

No modo single, uma candidata com falha de readiness não deve substituir imediatamente uma revisão saudável. No modo multiple, estar ativa e receber tráfego pelo endpoint principal são estados diferentes.

## Implantar e promover

Com app existente e imagens publicadas, habilite múltiplas revisões, crie a candidata e consulte os nomes reais retornados. Os nomes usados no comando final são ilustrativos e devem ser substituídos.

```bash
az containerapp revision set-mode --name api-ai200 --resource-group rg-ai200 \
  --mode multiple
az containerapp update --name api-ai200 --resource-group rg-ai200 \
  --image meuregistro.azurecr.io/api:2026.11.04-2 --revision-suffix candidato
az containerapp revision list --name api-ai200 --resource-group rg-ai200 -o table
az containerapp ingress traffic set --name api-ai200 --resource-group rg-ai200 \
  --revision-weight api-ai200--estavel=90 api-ai200--candidato=10
```

As porcentagens devem somar ==100==. Uma regra que aponta para `latestRevision` acompanha futuras candidatas; nomes explícitos dão controle sobre quais versões recebem tráfego. Labels oferecem URLs estáveis para testar uma revisão específica sem alterar a divisão principal.

## Critérios de decisão

Compare taxa de falhas, p95, custo por operação e qualidade das respostas. Um retorno HTTP 200 não comprova qualidade do modelo. Se houver regressão, direcione 100% à revisão estável e confirme a recuperação antes de desativar a candidata. Retenha imagens e configurações necessárias ao rollback.

<details>
<summary>Checagem Rápida: Atualizar o valor de um secret reinicia todas as revisões?</summary>

Não. A alteração fica no escopo da aplicação. Reinicie ou implante uma revisão que consuma o novo valor conforme o mecanismo de referência utilizado.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Single troca imediatamente**: A plataforma verifica a prontidão da nova revisão antes da troca de tráfego.
- **Pegadinha 2: Ativa significa tráfego principal**: Uma revisão pode estar ativa com peso zero e continuar acessível para validação específica.
- **Pegadinha 3: Rollback de código desfaz dados**: Migrações e alterações externas exigem compatibilidade e recuperação próprias.

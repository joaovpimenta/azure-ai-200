---
title: Segredos, variáveis de ambiente e autenticação em registro privado
slug: aca-segredos-e-registro-privado
chapter: 02-container-apps
exam_domain: containerized-solutions
tags:
  - container-apps
  - secrets-orchestration
  - private-registry
  - managed-identity
  - key-vault
difficulty: intermediate
tldr: Use identidade gerenciada para pull do ACR e referências a secrets para variáveis sensíveis. A
  identidade precisa de permissões específicas em cada recurso, e alterar um secret não cria nova
  revisão.
related_links:
  - label: Identidade gerenciada com ACR
    url: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
    type: learn
  - label: Secrets no Container Apps
    url: https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
    type: learn
questions:
  - id: q-aca-segredos-e-registro-privado-01
    type: single-choice
    title: Segredos, variáveis de ambiente e autenticação em registro privado
    exam_domain: containerized-solutions
    stem: Uma identidade baixa a imagem do ACR, mas a referência ao Key Vault falha com acesso negado. O
      que deve ser verificado?
    options:
      - id: opt-2
        text: Somente o papel AcrPull.
        correct: false
        rationale: Esse papel atende leitura de imagens, não secrets do cofre.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
      - id: opt-3
        text: Somente o nome da revisão.
        correct: false
        rationale: O nome da revisão não autoriza a referência ao Key Vault.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
      - id: opt-4
        text: A presença do segredo em texto no Dockerfile.
        correct: false
        rationale: Incluir o segredo na imagem expõe credenciais e não corrige a autorização da referência.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
      - id: opt-1
        text: Permissão de leitura de secrets no cofre para a identidade da referência.
        correct: true
        rationale: A autorização no ACR não concede acesso aos valores do Key Vault.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/managed-identity-image-pull
    tags:
      - container-apps
      - secrets-orchestration
      - private-registry
      - managed-identity
      - key-vault
---

# Segredos, variáveis de ambiente e autenticação em registro privado

Uma aplicação pode precisar baixar uma imagem privada e ler um segredo no Key Vault antes de atender. Esses acessos usam identidades e permissões independentes; sucesso no ACR não comprova autorização no cofre.

## Identidade, registro e segredo

A ==user-assigned managed identity== tem ciclo de vida independente e pode ser preparada antes da criação do app. A identidade system-assigned acompanha o recurso. Escolha conforme reutilização, isolamento e ordem de provisionamento.

No ACR com RBAC tradicional, conceda ==AcrPull== no registro à identidade de execução. Se o ACR usa permissões de repositório com ABAC, use o papel de leitura correspondente ao modo habilitado. A configuração de `registries` deve apontar para a identidade correta, não para uma senha de administrador.

## Configurar aplicação existente

Defina `IDENTITY_ID` como o resource ID da identidade atribuída ao usuário. Ela já deve estar anexada ao app e autorizada no registro; a atribuição RBAC pode levar tempo para se propagar.

```bash
az containerapp registry set --name api-ai200 --resource-group rg-ai200 \
  --server meuregistro.azurecr.io --identity "$IDENTITY_ID"
az containerapp secret set --name api-ai200 --resource-group rg-ai200 \
  --secrets "api-key=keyvaultref:https://meucofre.vault.azure.net/secrets/api-key,identityref:$IDENTITY_ID"
az containerapp update --name api-ai200 --resource-group rg-ai200 \
  --set-env-vars API_KEY=secretref:api-key
```

A identidade indicada na referência precisa de `Key Vault Secrets User` ou autorização equivalente para ler secrets. Confira também rede e DNS do cofre. O valor sensível não deve aparecer no YAML versionado, histórico de terminal ou logs.

Em um template, o vínculo entre variável e secret é explícito:

```yaml
env:
  - name: API_KEY
    secretRef: api-key
  - name: LOG_LEVEL
    value: Information
```

O trecho é parte de um contêiner, não um manifesto completo. Configurações não sensíveis podem usar `value`; valores sensíveis usam `secretRef`.

## Rotação e diagnóstico

Secrets pertencem à aplicação, não a uma revisão específica. Atualizar um secret não produz automaticamente nova revisão. Para secrets inseridos diretamente, reinicie revisões consumidoras ou publique nova revisão. Referências ao Key Vault sem versão têm comportamento de atualização gerenciado; valide o prazo documentado e a renovação das réplicas antes de revogar a versão anterior.

<details>
<summary>Checagem Rápida: A mesma identidade pode acessar ACR e Key Vault?</summary>

Sim, mas precisa de duas atribuições apropriadas. A existência da identidade não concede nenhuma dessas permissões automaticamente.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Secret é variável de ambiente automática**: É necessário referenciá-lo no template do contêiner.
- **Pegadinha 2: Alteração cria revisão**: Atualizar secrets é uma mudança no escopo da aplicação.
- **Pegadinha 3: Identidade resolve firewall**: Autorização não abre conectividade de rede nem corrige DNS privado.

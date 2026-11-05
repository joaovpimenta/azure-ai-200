---
title: "Contêineres no App Service: porta, startup, app settings e Key Vault
  references"
slug: app-service-conteineres-configuracao
chapter: 01-container-hosting
exam_domain: containerized-solutions
tags:
  - app-service
  - custom-containers
  - port-mapping
  - startup-command
  - app-settings
  - key-vault-references
difficulty: intermediate
tldr: O servidor deve escutar em 0.0.0.0 na porta configurada. Use WEBSITES_PORT
  no modelo clássico e targetPort com sidecars. Acesso ao ACR e ao Key Vault
  exige permissões próprias.
related_links:
  - label: Contêiner personalizado no App Service
    url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
    type: learn
  - label: Referências ao Key Vault
    url: https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references
    type: learn
questions:
  - id: q-app-service-conteineres-configuracao-01
    type: single-choice
    title: "Contêineres no App Service: porta, startup, app settings e Key Vault
      references"
    exam_domain: containerized-solutions
    stem: Um App Service Linux no modelo clássico roteia para 8000, mas o servidor
      escuta apenas em localhost:8000. O que deve ser corrigido?
    options:
      - id: opt-3
        text: Dar Key Vault Contributor à aplicação.
        correct: false
        rationale: A permissão no cofre não corrige o endereço de escuta HTTP.
        learn_url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
      - id: opt-4
        text: Trocar a tag da imagem para latest.
        correct: false
        rationale: O nome da tag não modifica o endereço de escuta do servidor.
        learn_url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
      - id: opt-1
        text: Iniciar o servidor em 0.0.0.0:8000.
        correct: true
        rationale: A plataforma precisa alcançar o processo pela interface do contêiner,
          além da porta correta.
        learn_url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
      - id: opt-2
        text: Adicionar somente EXPOSE 8000 ao Dockerfile.
        correct: false
        rationale: EXPOSE não altera o endereço de escuta do processo.
        learn_url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
    tags:
      - app-service
      - custom-containers
      - port-mapping
      - startup-command
      - app-settings
      - key-vault-references
    learn_url: https://learn.microsoft.com/en-us/azure/app-service/configure-custom-container
---

# Contêineres no App Service: porta, startup, app settings e Key Vault references

O App Service executa aplicações web em contêiner sem exigir administração de Kubernetes. A imagem precisa iniciar um servidor HTTP que a plataforma consiga alcançar. Os primeiros pontos a conferir são endereço de escuta, porta e comando de inicialização.

## Porta, processo e modelo de configuração

O processo deve escutar em `0.0.0.0`, e não somente em `localhost`. No modelo clássico de contêiner Linux, ==WEBSITES_PORT== informa a porta interna para o roteamento; isso não faz a aplicação mudar de porta automaticamente. No modelo com sidecars, configure o `targetPort` do contêiner principal em `sitecontainers`; não dependa de `WEBSITES_PORT`.

O startup command pode substituir o comando de inicialização da imagem. Confira `ENTRYPOINT`, `CMD`, diretório de trabalho e logs antes de alterar esse campo. Um contêiner que termina imediatamente ou executa apenas uma tarefa batch não atende ao contrato de uma aplicação web persistente.

<details>
<summary>Checagem Rápida: Definir WEBSITES_PORT=8000 faz o servidor escutar em 8000?</summary>

Não. Esse ajuste informa o roteamento no modelo clássico. O servidor também precisa iniciar em `0.0.0.0:8000`, por exemplo pela configuração do Uvicorn ou ASP.NET Core.

</details>

## Configuração de aplicação existente

Exemplo para um App Service Linux no modelo clássico, cujo servidor já escuta em 8000:

```bash
RG="rg-ai200"
APP="minha-api-ia"
az webapp config appsettings set --resource-group "$RG" --name "$APP" \
  --settings WEBSITES_PORT=8000 APP_ENV=production
az webapp identity assign --resource-group "$RG" --name "$APP"
az webapp config set --resource-group "$RG" --name "$APP" \
  --generic-configurations '{"acrUseManagedIdentityCreds":true}'
```

Conceda à identidade da aplicação acesso de pull no ACR conforme seu modo de autorização. A referência à imagem e ao servidor de registro deve ser configurada separadamente. Valide a inicialização com logs de contêiner e uma requisição a um endpoint de saúde.

## Segredos e implantação segura

Uma configuração pode conter uma ==Key Vault reference== em vez do segredo:

```text
@Microsoft.KeyVault(SecretUri=https://meucofre.vault.azure.net/secrets/api-key/)
```

A referência sem versão pode acompanhar novas versões, mas a resolução tem cache; não assuma atualização instantânea. A identidade precisa ler o segredo, normalmente via `Key Vault Secrets User`, e alcançar o endpoint do cofre. Private endpoints exigem DNS e rede corretamente configurados. Identidade de pull do ACR e autorização no Key Vault atendem a recursos diferentes.

Use slots, quando disponíveis no plano, para validar a nova imagem antes do swap. Marque configurações específicas de ambiente como configurações de slot. Não grave estado durável no filesystem efêmero do contêiner; use armazenamento externo ou persistência explicitamente configurada.

## Pegadinhas de Prova

- **EXPOSE configura o servidor**: A instrução documenta a porta; não inicia processo nem corrige o endereço de escuta.
- **Contributor lê segredos**: Acesso ao plano de gerenciamento não concede leitura do valor no Key Vault.
- **Mesmo ajuste para sidecars**: `WEBSITES_PORT` pertence ao fluxo clássico; no modelo com sidecars confira `targetPort`.

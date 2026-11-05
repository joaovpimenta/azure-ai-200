---
title: "Azure Container Registry: registro, repositórios, tags e versionamento"
slug: acr-registro-imagens-versionamento
chapter: 01-container-hosting
exam_domain: containerized-solutions
tags:
  - acr
  - container-registry
  - image-versioning
  - managed-identity
difficulty: intermediate
tldr: ACR guarda imagens. A tag é um nome que pode mudar; o digest identifica o
  conteúdo. Implante pelo digest aprovado e separe permissões de publicar e
  baixar.
related_links:
  - label: Imagens, tags e manifests
    url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
    type: learn
  - label: Autenticação no ACR
    url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication
    type: learn
questions:
  - id: q-acr-registro-imagens-versionamento-01
    type: single-choice
    title: "Azure Container Registry: registro, repositórios, tags e versionamento"
    exam_domain: containerized-solutions
    stem: O pipeline aprovou uma imagem, mas uma tag foi sobrescrita antes do
      deploy. Como garantir a implantação da imagem aprovada?
    options:
      - id: opt-1
        text: Implantar pela referência com digest.
        correct: true
        rationale: O digest identifica o conteúdo da imagem aprovada, independentemente
          de uma tag ser movida.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
      - id: opt-2
        text: Reutilizar latest em todos os ambientes.
        correct: false
        rationale: latest é uma referência mutável e pode apontar para outro artefato.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
      - id: opt-3
        text: Renomear a tag para production sem controles adicionais.
        correct: false
        rationale: O nome da tag não impede sua sobrescrita.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
      - id: opt-4
        text: Conceder Contributor à aplicação.
        correct: false
        rationale: Permissões de gerenciamento não fixam a identidade do artefato.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
    tags:
      - acr
      - container-registry
      - image-versioning
      - managed-identity
    learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts
---

# Azure Container Registry: registro, repositórios, tags e versionamento

O Azure Container Registry (ACR) guarda imagens de contêiner: pacotes com a aplicação e suas dependências. O pipeline publica a imagem; a aplicação a baixa para executar. Para repetir uma implantação, identifique o conteúdo aprovado, não apenas seu nome.

## Identidade da imagem e rastreabilidade

A referência `registro.azurecr.io/inferencia:2026.11.04` contém servidor, repositório e tag. Uma ==tag== pode ser movida para outro manifest; o ==digest== SHA-256 identifica seu conteúdo. Usar `latest` em produção dificulta provar qual versão está implantada e reverter uma falha.

| Elemento | Função | Decisão operacional |
|---|---|---|
| Registry | Recurso Azure e endpoint de autenticação | Separar ambientes conforme governança |
| Repository | Coleção de imagens relacionadas | Um nome por aplicação ou componente |
| Tag | Nome legível para um manifest | Usar commit ou versão de release |
| Digest | Identificador por conteúdo | Fixar o artefato aprovado no deploy |

Tags diferentes podem apontar para o mesmo manifest. Excluir somente uma tag não implica recuperar todo o armazenamento: camadas podem ser compartilhadas e manifests podem permanecer referenciados.

<details>
<summary>Checagem Rápida: Reimplantar a tag latest garante executar a mesma imagem?</summary>

Não. A tag pode ter sido atualizada. Registre o digest produzido pelo build e use a referência por digest para reproduzir a implantação.

</details>

## Publicar e inspecionar

Pré-requisitos: Azure CLI autenticada, Docker em execução, ACR existente e permissão de push. Defina as variáveis com os valores do seu ambiente; `VERSION` deve corresponder ao commit ou release.

```bash
ACR_NAME="meuregistro"
VERSION="2026.11.04-1"
LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
az acr login --name "$ACR_NAME"
docker build -t "$LOGIN_SERVER/inferencia:$VERSION" .
docker push "$LOGIN_SERVER/inferencia:$VERSION"
az acr repository show --name "$ACR_NAME" \
  --image "inferencia:$VERSION" --query digest -o tsv
```

A identidade do pipeline precisa publicar; a identidade da aplicação precisa apenas baixar. No modo RBAC tradicional, use `AcrPush` e ==AcrPull== respectivamente. Em registros habilitados para permissões de repositório com ABAC, selecione os papéis de repositório correspondentes, como `Container Registry Repository Reader`, conforme o modo do registro. Não habilite a conta de administrador para contornar uma atribuição ausente.

## Verificação e recuperação

Registre tag, digest e commit no release. Confirme o digest em execução, teste autenticação de pull com a identidade real e retenha a versão anterior durante a janela de rollback. Falhas `unauthorized` exigem conferir identidade e escopo RBAC; timeouts exigem examinar DNS, firewall e private endpoint.

## Pegadinhas de Prova

- **Tag imutável**: Um nome de versão não bloqueia sobrescrita por si só. Use controles de escrita e fixe o digest.
- **Contributor concede pull**: Gerenciar o recurso não substitui permissões de dados para baixar imagens.
- **Excluir todas as tags antigas**: Retenção agressiva pode apagar o artefato necessário ao rollback; avalie referências e política antes da limpeza.

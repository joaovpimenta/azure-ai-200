---
title: "ACR Tasks: builds rápidos, multi-step e gatilhos"
slug: acr-tasks-build-na-nuvem
chapter: 01-container-hosting
exam_domain: containerized-solutions
tags:
  - acr
  - acr-tasks
  - cloud-build
  - image-versioning
difficulty: intermediate
tldr: ACR Tasks constrói imagens sem Docker local e automatiza etapas por commit, agenda ou
  atualização de imagem base. Separe o build da promoção para produção e preserve a identidade do
  artefato.
related_links:
  - label: ACR Tasks
    url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
    type: learn
  - label: Tarefas de múltiplas etapas
    url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-multi-step
    type: learn
questions:
  - id: q-acr-tasks-build-na-nuvem-01
    type: single-choice
    title: "ACR Tasks: builds rápidos, multi-step e gatilhos"
    exam_domain: containerized-solutions
    stem: Uma equipe tem Dockerfile e código local, mas não pode instalar Docker na estação. Qual
      comando permite construir e publicar a imagem no ACR?
    options:
      - id: opt-2
        text: Executar docker build sem daemon local.
        correct: false
        rationale: O build local depende de um backend Docker disponível.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
      - id: opt-3
        text: Executar az acr login como única etapa.
        correct: false
        rationale: Login autentica acesso, mas não constrói a imagem.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
      - id: opt-4
        text: Criar uma revisão no Container Apps sem fornecer imagem.
        correct: false
        rationale: Uma revisão não substitui a etapa de construção do artefato.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
      - id: opt-1
        text: Executar az acr build com o contexto e o nome da imagem.
        correct: true
        rationale: O quick build executa a construção remotamente no ACR.
        learn_url: https://learn.microsoft.com/en-us/azure/container-registry/container-registry-tasks-overview
    tags:
      - acr
      - acr-tasks
      - cloud-build
      - image-versioning
---

# ACR Tasks: builds rápidos, multi-step e gatilhos

O pipeline de uma aplicação RAG precisa atualizar bibliotecas e imagens base sem depender da estação do desenvolvedor. ACR Tasks executa builds e workflows no Azure, mantendo o Dockerfile e a definição da tarefa versionados junto à aplicação.

## Build rápido e tarefa persistente

Um ==quick task==, iniciado com `az acr build`, envia o contexto e executa um build pontual. Uma tarefa persistente tem configuração reutilizável e gatilhos. Use a primeira para validação e automação explícita; use a segunda quando o serviço deve reagir a mudanças.

| Gatilho | Quando usar | Cuidado |
|---|---|---|
| Commit no repositório | Integrar alterações de código | Autorizar somente o repositório necessário |
| Atualização de imagem base | Recompilar dependências rastreadas | Reconstrução ainda exige testes |
| Timer | Validação periódica | Evitar execuções redundantes |
| Manual | Diagnóstico e promoção controlada | Registrar quem iniciou e o resultado |

O gatilho de imagem base depende do rastreamento de dependências e das capacidades dos registros envolvidos; ele não inspeciona arbitrariamente todas as bibliotecas instaladas por `pip` ou NuGet.

<details>
<summary>Checagem Rápida: Uma atualização da imagem base já publica a nova versão no App Service?</summary>

Não. A tarefa pode reconstruir e publicar a imagem no registro. Implantar a aplicação é outra etapa, que deve usar o artefato testado e seus próprios controles de promoção.

</details>

## Executar na nuvem

Com ACR existente, CLI autenticada e Dockerfile no diretório atual:

```bash
az acr build --registry meuregistro \
  --image inferencia:2026.11.04-1 --file Dockerfile .
```

Não é necessário executar o daemon Docker local para esse build. Um `.dockerignore` deve excluir segredos, ambientes virtuais, diretórios de saída e arquivos desnecessários antes do envio do contexto.

Uma tarefa multi-step pode compilar e depois publicar. Salve o trecho como `task.yaml`; as variáveis entre chaves são substituídas pelo ACR Tasks.

```yaml
version: v1.1.0
steps:
  - build: -t {{.Run.Registry}}/inferencia:{{.Run.ID}} .
  - push:
      - "{{.Run.Registry}}/inferencia:{{.Run.ID}}"
```

```bash
az acr run --registry meuregistro --file task.yaml .
az acr task list-runs --registry meuregistro -o table
```

Acrescente testes antes do push ou antes da promoção. Para dependências de etapas, use IDs e `when` conforme o esquema de tarefas. Inspecione os logs por run ID; não reutilize uma tag fixa como único registro do resultado.

## Segurança e operação

A identidade que dispara a tarefa precisa das permissões de execução; acesso a registros privados e recursos usados durante o build exige autorização própria. Não passe tokens secretos como argumentos que fiquem gravados em camadas ou logs. Use mecanismos de segredo da tarefa e credenciais com escopo mínimo.

## Pegadinhas de Prova

- **Pegadinha 1: Build remoto exige Docker local**: A execução ocorre no ACR; o contexto e o Dockerfile são suficientes para o quick build.
- **Pegadinha 2: Novo build significa aplicação atualizada**: Registro de imagem e implantação são operações distintas.
- **Pegadinha 3: Gatilho substitui validação**: Uma imagem base corrigida pode introduzir incompatibilidades. Teste antes de promover.

---
title: Managed identities, RBAC e DefaultAzureCredential
slug: identidade-gerenciada-defaultazurecredential
chapter: 08-secrets-and-config
exam_domain: secure-monitor-troubleshoot
tags:
  - managed-identity
  - user-assigned
  - system-assigned
  - defaultazurecredential
  - azure-identity
  - rbac
difficulty: intermediate
tldr: "Identidade gerenciada evita senhas no código. DefaultAzureCredential
  tenta as credenciais disponíveis. Conceda papéis de dados ao principal
  correto: identidade habilitada não significa acesso autorizado."
related_links:
  - label: Managed identities
    url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
    type: learn
  - label: Autenticação com Azure Identity
    url: https://learn.microsoft.com/en-us/azure/developer/python/sdk/authentication/overview
    type: learn
questions:
  - id: q-identidade-gerenciada-defaultazurecredential-01
    type: single-choice
    title: Managed identities, RBAC e DefaultAzureCredential
    exam_domain: secure-monitor-troubleshoot
    stem: A leitura de Blob funciona com az login local e falha no Azure com a
      identidade gerenciada. O que deve ser comparado?
    options:
      - id: opt-1
        text: A identidade efetivamente usada e seus papéis de dados no escopo do
          Storage.
        correct: true
        rationale: O desenvolvedor local e a identidade da aplicação podem ter
          autorizações diferentes.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-2
        text: Somente o nome do arquivo de código.
        correct: false
        rationale: O nome do arquivo não define o principal autenticado.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-3
        text: A existência de uma tag latest no ACR.
        correct: false
        rationale: Versionamento de imagens não concede leitura de blobs.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-4
        text: A função Contributor como prova de acesso a todos os blobs.
        correct: false
        rationale: Gerenciamento do recurso não substitui permissões de dados.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
    tags:
      - managed-identity
      - user-assigned
      - system-assigned
      - defaultazurecredential
      - azure-identity
      - rbac
    learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
---

# Managed identities, RBAC e DefaultAzureCredential

Identidade gerenciada permite que uma aplicação no Azure obtenha tokens sem guardar uma senha. Autenticação responde “quem é a aplicação?”; autorização responde “o que ela pode fazer?”. RBAC é o controle de acesso por papéis e escopos.

## Ciclo de vida e autorização

| Identidade | Ciclo de vida | Escolha típica |
|---|---|---|
| System-assigned | Associada ao recurso; removida com ele | Isolar uma aplicação |
| User-assigned | Recurso independente e reutilizável | Preparar permissões antes do deploy |

Compartilhar uma user-assigned identity também compartilha sua fronteira de permissões. Use identidades distintas quando houver requisitos diferentes de acesso. Não confunda client ID, principal/object ID e resource ID: selecionar a identidade e atribuir um papel usam identificadores com finalidades distintas.

==DefaultAzureCredential== testa uma cadeia de credenciais adequada ao SDK e à versão, incluindo opções de desenvolvimento e identidade gerenciada. No notebook, pode usar a sessão da CLI; no Azure, pode usar a identidade atribuída ao recurso. Para produção com seleção estrita, configure explicitamente a identidade ou use `ManagedIdentityCredential` quando apropriado.

## Ler dados sem connection string secreta

Instale `azure-storage-blob` e `azure-identity`; no .NET, `Azure.Storage.Blobs` e `Azure.Identity`. Defina a URL do Blob Service e crie previamente container `documentos` e blob `manual.txt`. A identidade precisa de `Storage Blob Data Reader` e conectividade ao endpoint.

```python
import os
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

with DefaultAzureCredential() as credential:
    with BlobServiceClient(os.environ["BLOB_SERVICE_URL"], credential=credential) as service:
        blob = service.get_blob_client("documentos", "manual.txt")
        properties = blob.get_blob_properties()
        print(properties.size)
```

```csharp
using Azure.Identity;
using Azure.Storage.Blobs;

var credential = new DefaultAzureCredential();
var service = new BlobServiceClient(
    new Uri(Environment.GetEnvironmentVariable("BLOB_SERVICE_URL")!), credential);
var blob = service.GetBlobContainerClient("documentos").GetBlobClient("manual.txt");
var properties = await blob.GetPropertiesAsync();
Console.WriteLine(properties.Value.ContentLength);
```

Para user-assigned identity, configure o client ID na opção suportada pela versão do Azure Identity, como `managed_identity_client_id` no Python. O papel deve ser atribuído ao principal real utilizado, com o menor escopo necessário.

## Diagnóstico

Se o token não pode ser obtido, examine configuração e cadeia de credenciais. Se há 403, confira identidade, papel, escopo, políticas e rede do serviço. Aguarde propagação de atribuições antes de concluir que o papel está incorreto. Não registre bearer tokens para investigar.

<details>
<summary>Checagem Rápida: O código funcionar com az login comprova as permissões da aplicação no Azure?</summary>

Não. A CLI pode autenticar o desenvolvedor, que tem permissões diferentes da managed identity da aplicação.

</details>

## Pegadinhas de Prova

- **Identidade habilitada já tem acesso**: É necessário autorizar cada recurso de destino.
- **Contributor lê todos os dados**: Papéis de gerenciamento e dados têm capacidades distintas.
- **RBAC corrige DNS**: Autenticação, autorização e conectividade são camadas separadas.

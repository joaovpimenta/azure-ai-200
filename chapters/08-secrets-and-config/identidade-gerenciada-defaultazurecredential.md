---
title: Identidade gerenciada e acesso aos dados no Azure
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
tldr: "Descubra qual identidade seu código usa no computador e no Azure. Depois,
  conceda a essa identidade só a permissão necessária para ler os documentos."
related_links:
  - label: Managed identities
    url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
    type: learn
  - label: Cadeia de credenciais no SDK Python
    url: https://learn.microsoft.com/en-us/azure/developer/python/sdk/authentication/credential-chains
    type: learn
  - label: Cadeia de credenciais no SDK .NET
    url: https://learn.microsoft.com/en-us/dotnet/azure/sdk/authentication/credential-chains
    type: learn
  - label: Diagnosticar erros 403 no Blob Storage
    url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-storage/blobs/authentication/storage-troubleshoot-403-errors
    type: learn
questions:
  - id: q-identidade-gerenciada-defaultazurecredential-01
    type: single-choice
    title: Identidade gerenciada e acesso aos manuais
    exam_domain: secure-monitor-troubleshoot
    stem: O indexador lê manual.txt no seu computador. No Azure, ele obtém um
      token com a identidade gerenciada do Container App, mas o Blob Storage
      devolve 403 com AuthorizationPermissionMismatch. Qual é a primeira verificação?
    options:
      - id: opt-1
        text: Conferir se a identidade usada pelo indexador tem Storage Blob Data
          Reader no contêiner de destino ou em um escopo que o inclui.
        correct: true
        rationale: O token indica quem fez o pedido. O Storage avalia se esse
          principal tem permissão para a operação de leitura no recurso solicitado.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-2
        text: Conceder Storage Blob Data Reader à conta de quem executou az login.
        correct: false
        rationale: A conta humana já consegue ler o arquivo. Uma atribuição a ela
          não altera as permissões da identidade gerenciada do Container App.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-3
        text: Trocar DefaultAzureCredential por ManagedIdentityCredential e manter
          as atribuições atuais.
        correct: false
        rationale: A troca pode fixar a credencial usada. No cenário, a aplicação
          já obteve o token da identidade esperada e precisa de autorização de leitura.
        learn_url: https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/overview
      - id: opt-4
        text: Verificar apenas se o papel Contributor foi atribuído no recurso Storage.
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

# Identidade gerenciada e acesso aos dados no Azure

O indexador do assistente precisa ler um manual no Blob Storage. No seu computador, o pedido pode usar a sua conta. Depois da implantação, o mesmo código pode pedir um token usando a ==identidade gerenciada== do Container App. O Azure administra a credencial dessa identidade, então o código pode acessar o serviço sem guardar uma senha.

Pense no acesso em duas etapas. A **autenticação** identifica quem faz a chamada. A **autorização** decide se essa identidade pode ler o arquivo. Com ==Azure RBAC==, você atribui um papel (quais operações) a uma identidade (quem) em um escopo (onde).

## Ciclo de vida e autorização

| Identidade | Ciclo de vida | Escolha típica |
|---|---|---|
| System-assigned | Associada ao recurso; removida com ele | Isolar uma aplicação |
| User-assigned | Recurso independente e reutilizável | Preparar permissões antes do deploy |

Para o indexador, uma identidade do tipo *system-assigned* vincula o acesso ao aplicativo. Uma *user-assigned* permite configurar o acesso antes da implantação. Aplicativos que usam a mesma identidade compartilham suas permissões.

- **Client ID** seleciona uma identidade *user-assigned* no SDK.
- **Principal ID** identifica essa identidade no Microsoft Entra para a atribuição do papel.
- **Resource ID** é o caminho do recurso de identidade no Azure.

==DefaultAzureCredential== usa uma cadeia de credenciais. Em desenvolvimento, pode chegar à sessão criada por `az login`. No Azure, pode usar a identidade atribuída ao recurso. A ordem e as opções dependem do SDK e da versão. Em produção, quando o aplicativo deve usar uma identidade conhecida, selecione-a explicitamente com `ManagedIdentityCredential`.

## Teste a leitura nos dois ambientes

1. Em uma conta de armazenamento à qual você tenha acesso, crie o contêiner Blob `documentos` e envie um arquivo `manual.txt` com conteúdo de teste. Anote o tamanho do arquivo em bytes.
2. Defina `BLOB_SERVICE_URL` no ambiente do processo como a URL do serviço, por exemplo `https://minhaconta.blob.core.windows.net`. Instale `azure-storage-blob` e `azure-identity` em Python ou `Azure.Storage.Blobs` e `Azure.Identity` em um aplicativo de console .NET.
3. Use `az login` para disponibilizar a sessão da CLI ao SDK. A identidade efetivamente usada precisa de ==Storage Blob Data Reader== no contêiner ou em um escopo que o inclui, além de conectividade ao endpoint.

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
using System;

var credential = new DefaultAzureCredential();
var service = new BlobServiceClient(
    new Uri(Environment.GetEnvironmentVariable("BLOB_SERVICE_URL")!), credential);
var blob = service.GetBlobContainerClient("documentos").GetBlobClient("manual.txt");
var properties = await blob.GetPropertiesAsync();
Console.WriteLine(properties.Value.ContentLength);
```

Os exemplos exibem o tamanho do blob em bytes. Compare com o valor anotado. Ao repetir no Container App, habilite ou associe a identidade gerenciada e atribua o papel de leitura a ela. Para uma identidade *user-assigned*, o `DefaultAzureCredential` aceita o client ID em `managed_identity_client_id` no Python ou em `DefaultAzureCredentialOptions.ManagedIdentityClientId` no .NET.

## Diagnóstico

| O que você observou | O que conferir |
|---|---|
| O SDK não conseguiu obter um token | Verifique a sessão local ou a identidade associada ao Container App. Use os logs da cadeia de credenciais para descobrir qual credencial foi selecionada. |
| O serviço respondeu `403 AuthorizationPermissionMismatch` | Confira quem obteve o token, o papel de dados desse principal e o escopo da atribuição. Atribuições novas podem levar um tempo para propagar. |
| A conexão expirou ou a URL não resolveu | Confira a URL, a resolução DNS e o caminho de rede. Quando houver resposta 403, use também o código de erro do Storage para distinguir autorização de uma possível restrição de rede. |

Registre o código de erro e o identificador da requisição para investigar sem registrar o token de acesso.

<details>
<summary>Checagem rápida · O Container App foi recriado com identidade system-assigned. Por que a leitura pode voltar a falhar?</summary>

A nova instância tem outro principal. Atribua o papel de leitura à nova identidade, no escopo do contêiner de documentos.

</details>

## Pegadinhas de Prova

- **Identidade habilitada já tem acesso**: É necessário autorizar cada recurso de destino.
- **Contributor lê todos os dados**: Papéis de gerenciamento e dados têm capacidades distintas.
- **RBAC corrige DNS**: Autenticação, autorização e conectividade são camadas separadas.

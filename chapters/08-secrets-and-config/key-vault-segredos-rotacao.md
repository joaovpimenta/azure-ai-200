---
title: "Key Vault: segredos, versões, rotação e soft delete"
slug: key-vault-segredos-rotacao
chapter: 08-secrets-and-config
exam_domain: secure-monitor-troubleshoot
tags:
  - key-vault
  - secrets
  - secret-rotation
  - soft-delete
  - purge-protection
difficulty: intermediate
tldr: Key Vault controla acesso e versões de segredos. Rotacione na origem,
  atualize consumidores e só então revogue a versão antiga. Soft delete permite
  recuperação; purge protection impede exclusão definitiva antecipada.
related_links:
  - label: Segredos no Key Vault
    url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
    type: learn
  - label: Soft delete
    url: https://learn.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview
    type: learn
  - label: Rotação de segredos
    url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/tutorial-rotation
    type: learn
questions:
  - id: q-key-vault-segredos-rotacao-01
    type: single-choice
    title: "Key Vault: segredos, versões, rotação e soft delete"
    exam_domain: secure-monitor-troubleshoot
    stem: Uma nova versão de secret foi criada no cofre, mas clientes ainda usam a
      credencial anterior. Qual ação integra uma rotação completa?
    options:
      - id: opt-2
        text: Excluir o secret como forma de revogar automaticamente a senha no banco.
        correct: false
        rationale: Excluir no cofre não altera a credencial aceita pelo banco.
        learn_url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
      - id: opt-3
        text: Assumir que referências com versão fixa mudaram sozinhas.
        correct: false
        rationale: Uma referência fixa continua apontando para aquela versão.
        learn_url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
      - id: opt-4
        text: Desabilitar purge protection para acelerar a atualização dos clientes.
        correct: false
        rationale: Purge protection não controla refresh e não pode ser desligada após
          habilitação.
        learn_url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
      - id: opt-1
        text: Renovar os consumidores, testar a nova credencial e só depois revogar a
          antiga na origem.
        correct: true
        rationale: Rotação envolve origem, distribuição e consumo; criar versão não
          atualiza todos os caches.
        learn_url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
    tags:
      - key-vault
      - secrets
      - secret-rotation
      - soft-delete
      - purge-protection
    learn_url: https://learn.microsoft.com/en-us/azure/key-vault/secrets/about-secrets
---

# Key Vault: segredos, versões, rotação e soft delete

Key Vault guarda segredos, como credenciais de serviços externos. A aplicação pode carregar uma nova versão sem reconstruir sua imagem. Rotacionar uma credencial exige atualizar tanto o serviço que a aceita quanto os consumidores que a utilizam.

## Versões e permissões

Gravar um novo valor com o mesmo nome cria uma versão. Uma leitura sem versão seleciona a versão mais recente conforme o contrato do serviço; apontar explicitamente para uma versão fixa o valor utilizado. Não presuma fallback automático para uma versão anterior se a mais recente estiver desabilitada ou expirada.

No modelo Azure RBAC, ==Key Vault Secrets User== permite leitura de valores; `Key Vault Secrets Officer` atende operações de gerenciamento de secrets. `Key Vault Contributor` gerencia o recurso, sem conceder leitura de valores por si só. Políticas de acesso legadas constituem outro modelo: confirme qual está ativo.

## Consumir com os SDKs

Instale `azure-keyvault-secrets` e `azure-identity`; no .NET, `Azure.Security.KeyVault.Secrets` e `Azure.Identity`. Defina `KEY_VAULT_URL`, provisione o secret `api-key` e autorize a identidade. O exemplo verifica a obtenção sem imprimir o valor.

```python
import os
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

with DefaultAzureCredential() as credential:
    with SecretClient(os.environ["KEY_VAULT_URL"], credential) as client:
        secret = client.get_secret("api-key")
        # Entregue secret.value ao cliente dependente; não registre o conteúdo.
        print(f"Versão carregada: {secret.properties.version}")
```

```csharp
using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

var client = new SecretClient(
    new Uri(Environment.GetEnvironmentVariable("KEY_VAULT_URL")!),
    new DefaultAzureCredential());
KeyVaultSecret secret = (await client.GetSecretAsync("api-key")).Value;
// Entregue secret.Value ao cliente dependente; não registre o conteúdo.
Console.WriteLine($"Versão carregada: {secret.Properties.Version}");
```

Cache local reduz latência e chamadas ao cofre, mas precisa de expiração e estratégia de renovação. Não consulte o cofre repetidamente para cada token gerado pelo modelo.

## Rotacionar e recuperar

Rotação exige criar ou atualizar a credencial no sistema de origem, publicar a nova versão, renovar consumidores, testar o acesso e só então revogar a antiga. Uma nova versão no cofre não altera magicamente a senha do serviço externo. Automação pode usar eventos e Functions; a política automática de rotação de keys não equivale à rotação genérica de qualquer secret.

==Soft delete== mantém um recurso excluído recuperável durante a retenção configurada. Purge protection, uma vez habilitada, impede purga antecipada até o fim desse período, inclusive por administradores. Planeje nomes e recuperação, pois recursos excluídos podem continuar reservando nomes.

<details>
<summary>Checagem Rápida: Excluir um secret revoga a credencial no banco?</summary>

Não. O banco continua aceitando a credencial até que ela seja revogada no próprio sistema de origem.

</details>

## Pegadinhas de Prova

- **Nova versão atualiza todos os clientes**: Referências fixas e caches precisam ser renovados.
- **Purge protection pode ser desligada para limpar**: Ela bloqueia purga antes da retenção e não pode ser desabilitada após habilitação.
- **Rotação é apenas gravar no cofre**: Atualize origem, consumidores e revogação de forma coordenada.

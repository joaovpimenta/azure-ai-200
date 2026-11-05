---
title: "App Configuration: chaves, rótulos, refresh e feature flags"
slug: app-configuration-chaves-rotulos-feature-flags
chapter: 08-secrets-and-config
exam_domain: secure-monitor-troubleshoot
tags:
  - app-configuration
  - key-values
  - labels
  - dynamic-refresh
  - feature-flags
  - sentinel-key
difficulty: intermediate
tldr: Chave e label identificam uma configuração. Feature flags controlam
  recursos. Atualização dinâmica exige integração no cliente; mudar o portal não
  atualiza todos os processos imediatamente.
related_links:
  - label: Chaves e valores
    url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
    type: learn
  - label: Configuração dinâmica
    url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/enable-dynamic-configuration-python
    type: learn
  - label: Feature management
    url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-feature-management
    type: learn
questions:
  - id: q-app-configuration-chaves-rotulos-feature-flags-01
    type: single-choice
    title: "App Configuration: chaves, rótulos, refresh e feature flags"
    exam_domain: secure-monitor-troubleshoot
    stem: A equipe alterou uma chave sentinela, mas um processo em segundo plano
      (worker) não atualiza os parâmetros em memória. O que falta verificar?
    options:
      - id: opt-3
        text: Se o portal reconstruiu a imagem da aplicação.
        correct: false
        rationale: Refresh de configuração não depende de reconstruir a imagem.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
      - id: opt-4
        text: Se Data Reader no App Configuration concede acesso a qualquer cofre.
        correct: false
        rationale: Referências ao Key Vault requerem autorização separada.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
      - id: opt-1
        text: Se o cliente monitora a chave sentinela e se o processo solicita refresh.
        correct: true
        rationale: O sinal só tem efeito quando o cliente integra o mecanismo de
          atualização.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
      - id: opt-2
        text: Se a label foi usada como papel RBAC.
        correct: false
        rationale: Labels selecionam variantes; não são papéis de acesso.
        learn_url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
    tags:
      - app-configuration
      - key-values
      - labels
      - dynamic-refresh
      - feature-flags
      - sentinel-key
    learn_url: https://learn.microsoft.com/en-us/azure/azure-app-configuration/concept-key-value
---

# App Configuration: chaves, rótulos, refresh e feature flags

App Configuration centraliza parâmetros da aplicação, como quantos documentos buscar. Feature flags permitem ativar recursos sem publicar outra imagem. Use Key Vault para segredos e configure como cada processo deve buscar atualizações.

## Chaves, labels e flags

Uma configuração é identificada por ==key e label==: chave e rótulo. `rag:topK` com label `prod` e a mesma chave com label `test` são entradas diferentes. Label não é inferida automaticamente pelo ambiente: a aplicação deve selecionar a variante correta.

| Recurso | Uso | Limite |
|---|---|---|
| Key-value | Parâmetro de aplicação | Não é cofre de segredos |
| Label | Ambiente, região ou variante | Não representa permissão de acesso |
| Feature flag | Ativação com filtros e condições | Exige biblioteca de avaliação |
| Sentinel key (chave sentinela) | Sinalizar conjunto de mudanças | Exige configuração de refresh |

Uma flag pode usar filtros temporais, percentuais ou targeting quando suportados pelo cliente. Ler uma string chamada `enabled` não implementa automaticamente essas regras. Para parâmetros que precisam mudar juntos, publique primeiro os valores e atualize a sentinel por último; use snapshots quando a necessidade exigir uma versão imutável de configuração.

## Leitura explícita com os SDKs

Instale `azure-appconfiguration` e `azure-identity`; no .NET, `Azure.Data.AppConfiguration` e `Azure.Identity`. Defina `APP_CONFIG_ENDPOINT`, crie `rag:topK` com label `prod` e conceda `App Configuration Data Reader` à identidade.

```python
import os
from azure.identity import DefaultAzureCredential
from azure.appconfiguration import AzureAppConfigurationClient

with DefaultAzureCredential() as credential:
    with AzureAppConfigurationClient(os.environ["APP_CONFIG_ENDPOINT"], credential) as client:
        setting = client.get_configuration_setting(key="rag:topK", label="prod")
        top_k: int = int(setting.value or "5")
        if not 1 <= top_k <= 50:
            raise ValueError("topK fora do intervalo permitido")
        print(top_k)
```

```csharp
using Azure.Identity;
using Azure.Data.AppConfiguration;

var client = new ConfigurationClient(
    new Uri(Environment.GetEnvironmentVariable("APP_CONFIG_ENDPOINT")!),
    new DefaultAzureCredential());
ConfigurationSetting setting = (await client.GetConfigurationSettingAsync("rag:topK", "prod")).Value;
int topK = int.Parse(setting.Value ?? "5");
if (topK is < 1 or > 50) throw new InvalidOperationException("topK fora do intervalo permitido");
Console.WriteLine(topK);
```

Esses clientes fazem leitura pontual: eles não ativam atualização dinâmica por si só. Para isso, integre o provider apropriado à linguagem e ao host.

## Atualização e falhas

Configure quais chaves ou sentinel serão monitoradas, intervalo mínimo e mecanismo que solicita refresh. Em aplicações web, ele pode ocorrer durante requisições; em workers, invoque o mecanismo periodicamente. O intervalo não implica um push instantâneo para todos os processos.

Uma referência ao Key Vault é uma referência, não o valor secreto. A resolução requer provider compatível e permissão tanto no App Configuration quanto no cofre. Defina política para falha de carregamento inicial e para manutenção da última configuração válida durante indisponibilidade.

<details>
<summary>Checagem Rápida: Alterar uma feature flag no portal muda toda instância imediatamente?</summary>

Não. Cada cliente precisa buscar a atualização e avaliar a flag. O comportamento depende do refresh e do cache configurados.

</details>

## Pegadinhas de Prova

- **Label protege produção**: Label seleciona valores; RBAC e desenho de recursos controlam acesso.
- **Sentinel cria transação automaticamente**: Ela coordena refresh quando o cliente foi configurado para observá-la.
- **Data Reader lê também o Key Vault**: Cada serviço exige sua própria autorização.

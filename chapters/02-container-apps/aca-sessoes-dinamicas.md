---
title: Sessões dinâmicas para executar código gerado por IA
slug: aca-sessoes-dinamicas
chapter: 02-container-apps
exam_domain: containerized-solutions
tags:
  - dynamic-sessions
  - ai-code-interpreter
  - container-apps
  - security
difficulty: intermediate
tldr: Dynamic Sessions oferece execução isolada de código por sessão, com pools e expiração.
  Autentique a chamada ao endpoint do pool, isole identificadores por usuário e controle saída de
  rede e dados fornecidos.
related_links:
  - label: Dynamic Sessions
    url: https://learn.microsoft.com/en-us/azure/container-apps/sessions
    type: learn
  - label: Executar código em sessões
    url: https://learn.microsoft.com/en-us/azure/container-apps/sessions-code-interpreter
    type: learn
questions:
  - id: q-aca-sessoes-dinamicas-01
    type: single-choice
    title: Sessões dinâmicas para executar código gerado por IA
    exam_domain: containerized-solutions
    stem: Um agente atende vários tenants e executa código gerado por IA. Como isolar o estado entre
      usuários?
    options:
      - id: opt-4
        text: Tratar arquivos da sessão como armazenamento permanente.
        correct: false
        rationale: O ambiente é efêmero e pode expirar.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/sessions
      - id: opt-1
        text: Mapear identificadores de sessão distintos no backend e autorizar o uso do pool.
        correct: true
        rationale: O identificador delimita o estado e o backend deve proteger a associação com o usuário.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/sessions
      - id: opt-2
        text: Compartilhar uma única sessão para reduzir custo.
        correct: false
        rationale: Isso pode expor arquivos e variáveis entre usuários.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/sessions
      - id: opt-3
        text: Entregar um token amplo do pool a todos os navegadores.
        correct: false
        rationale: Isso transfere acesso desnecessário e enfraquece o controle do backend.
        learn_url: https://learn.microsoft.com/en-us/azure/container-apps/sessions
    tags:
      - dynamic-sessions
      - ai-code-interpreter
      - container-apps
      - security
---

# Sessões dinâmicas para executar código gerado por IA

Um agente pode produzir Python para analisar um CSV. Executar esse código no processo da API expõe credenciais e memória da aplicação. Dynamic Sessions fornece ambientes isolados, alocados por um pool e acessados por uma API de execução.

## Pool, sessão e fronteira de confiança

O ==session pool== configura capacidade, comportamento e ciclo de vida. Um identificador associa chamadas à mesma sessão, permitindo reaproveitar estado durante uma interação. Use identificadores distintos por usuário ou trabalho; não compartilhe uma sessão entre tenants.

Pools de interpretador gerenciado e pools de contêineres personalizados têm contratos e capacidades distintos. O isolamento baseado em Hyper-V não remove a necessidade de validar entradas, controlar dados disponibilizados e restringir ==egress==. Código não confiável ainda pode consumir recursos ou tentar enviar dados para a rede quando permitido.

## Executar com Python e C#

Pré-requisitos: pool de interpretador provisionado, endpoint de gerenciamento de sessões em `SESSION_POOL_ENDPOINT` e identidade com `Azure ContainerApps Session Executor`. A versão de API abaixo deve estar habilitada no pool. Instale `azure-identity` e `requests` no Python; use `Azure.Identity` no .NET 8.

```python
import os
import uuid
import requests
from azure.identity import DefaultAzureCredential

endpoint: str = os.environ["SESSION_POOL_ENDPOINT"].rstrip("/")
session_id: str = str(uuid.uuid4())
credential = DefaultAzureCredential()
token = credential.get_token("https://dynamicsessions.io/.default")
response = requests.post(
    f"{endpoint}/executions",
    params={"api-version": "2025-10-02-preview", "identifier": session_id},
    headers={"Authorization": f"Bearer {token.token}"},
    json={"properties": {"codeInputType": "inline", "executionType": "synchronous",
                         "code": "print(sum([1, 2, 3]))"}},
    timeout=60,
)
response.raise_for_status()
print(response.json())
```

```csharp
using Azure.Core;
using Azure.Identity;
using System.Net.Http.Headers;
using System.Net.Http.Json;

string endpoint = Environment.GetEnvironmentVariable("SESSION_POOL_ENDPOINT")!.TrimEnd('/');
string sessionId = Guid.NewGuid().ToString();
var credential = new DefaultAzureCredential();
AccessToken token = await credential.GetTokenAsync(
    new TokenRequestContext(new[] { "https://dynamicsessions.io/.default" }));
using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
using var response = await http.PostAsJsonAsync(
    $"{endpoint}/executions?api-version=2025-10-02-preview&identifier={sessionId}",
    new { properties = new { codeInputType = "inline", executionType = "synchronous",
        code = "print(sum([1, 2, 3]))" } });
response.EnsureSuccessStatusCode();
Console.WriteLine(await response.Content.ReadAsStringAsync());
```

Em produção, o backend mantém o mapeamento de identificadores e renova tokens; não entrega um token amplo ao navegador. Analise também o resultado de execução retornado: uma resposta HTTP bem-sucedida pode conter erro do código executado.

<details>
<summary>Checagem Rápida: Uma sessão pode armazenar o único exemplar de um relatório?</summary>

Não. O estado é efêmero e sujeito a expiração ou encerramento. Exporte os artefatos necessários para armazenamento durável sob controle da aplicação.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Sandbox permite qualquer segredo**: Não injete credenciais de produção no ambiente de código não confiável.
- **Pegadinha 2: Identificador é autorização**: O endpoint exige autenticação e autorização; o backend deve proteger o vínculo entre usuário e sessão.
- **Pegadinha 3: Estado permanente**: O pool gerencia expiração e capacidade; persistência precisa ser externa.

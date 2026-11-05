---
title: Cache-aside, TTL, políticas de eviction e invalidação
slug: redis-cache-expiracao-invalidacao
chapter: 06-managed-redis
exam_domain: data-management
tags:
  - managed-redis
  - azure-managed-redis
  - cache-aside
  - ttl
  - eviction-policies
  - cache-invalidation
difficulty: intermediate
tldr: Cache-aside consulta o cache antes da fonte. TTL limita a validade;
  eviction remove por pressão de memória; invalidação acompanha mudanças na
  origem. Inclua cliente e versões na chave.
related_links:
  - label: Padrão Cache-Aside
    url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
    type: learn
  - label: Azure Managed Redis
    url: https://learn.microsoft.com/en-us/azure/redis/overview
    type: learn
questions:
  - id: q-redis-cache-expiracao-invalidacao-01
    type: single-choice
    title: Cache-aside, TTL, políticas de eviction e invalidação
    exam_domain: data-management
    stem: Uma chave com TTL de cinco minutos desaparece antes desse prazo durante
      pressão de memória. Qual explicação é possível?
    options:
      - id: opt-2
        text: TTL garante permanência até o último segundo.
        correct: false
        rationale: TTL limita validade; não garante presença.
        learn_url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
      - id: opt-3
        text: Somente exclusão no banco poderia remover o cache.
        correct: false
        rationale: O cache pode remover chaves por causas próprias.
        learn_url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
      - id: opt-4
        text: Cache-aside desabilita eviction automaticamente.
        correct: false
        rationale: O padrão de acesso não substitui a política configurada no Redis.
        learn_url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
      - id: opt-1
        text: A política de eviction pode removê-la antes da expiração.
        correct: true
        rationale: TTL não reserva memória e não impede remoção por políticas de eviction.
        learn_url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
    tags:
      - managed-redis
      - azure-managed-redis
      - cache-aside
      - ttl
      - eviction-policies
      - cache-invalidation
    learn_url: https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside
---

# Cache-aside, TTL, políticas de eviction e invalidação

Cache guarda resultados para evitar repetir consultas ou chamadas caras ao modelo. No padrão cache-aside, a aplicação consulta Redis primeiro e busca a fonte original se não encontrar a chave. Mantenha uma fonte durável para os dados que não podem ser perdidos.

## Fluxo cache-aside

A aplicação procura a chave no Redis. Se a chave não existe (cache miss), lê a fonte, calcula a resposta e grava com ==TTL==, o prazo de validade. Em uma atualização, confirma primeiro a gravação na fonte original e então invalida ou atualiza o cache conforme a estratégia de consistência.

| Mecanismo | Causa | Efeito |
|---|---|---|
| Expiração | TTL atingido | A chave deixa de ser válida |
| Eviction | Pressão de memória e política configurada | Chaves podem ser removidas antes do TTL |
| Invalidação | Mudança conhecida na fonte | Aplicação remove ou substitui resultado |

Nem todo miss significa expiração. Monitore hit rate, uso de memória, evictions e erros. Políticas `allkeys-*` podem escolher qualquer chave; `volatile-*` consideram chaves com expiração; `noeviction` rejeita certas escritas quando não há memória disponível. Confira a política suportada e configurada no serviço.

## Gravação atômica com expiração

Instale `redis` no Python e `StackExchange.Redis` no .NET. Defina host e porta reais do Azure Managed Redis; não copie a porta de outro produto Redis. Os segredos devem ser injetados por configuração protegida. Os exemplos usam uma credencial do serviço; para Entra, use integração capaz de renovar tokens.

```python
import os
import redis

client = redis.Redis(
    host=os.environ["REDIS_HOST"], port=int(os.environ["REDIS_PORT"]),
    password=os.environ["REDIS_PASSWORD"], ssl=True,
    decode_responses=True, socket_timeout=5,
)
key: str = "tenant-a:resposta:modelo-v1:documento-v3:pergunta-123"
value = client.get(key)
if value is None:
    value = "Resultado obtido da fonte autoritativa"
    client.set(key, value, ex=300)
print(value)
```

```csharp
using StackExchange.Redis;

var options = new ConfigurationOptions {
    Ssl = true, Password = Environment.GetEnvironmentVariable("REDIS_PASSWORD"),
    AbortOnConnectFail = false
};
options.EndPoints.Add(Environment.GetEnvironmentVariable("REDIS_HOST")!,
    int.Parse(Environment.GetEnvironmentVariable("REDIS_PORT")!));
using var connection = await ConnectionMultiplexer.ConnectAsync(options);
IDatabase cache = connection.GetDatabase();
string key = "tenant-a:resposta:modelo-v1:documento-v3:pergunta-123";
RedisValue value = await cache.StringGetAsync(key);
if (value.IsNull) {
    value = "Resultado obtido da fonte autoritativa";
    await cache.StringSetAsync(key, value, TimeSpan.FromMinutes(5));
}
Console.WriteLine(value);
```

Reutilize cliente e multiplexer durante a vida do processo. O exemplo representa uma operação; não abra conexão para cada requisição. `SET` com expiração evita a janela entre gravar e aplicar TTL em comandos separados.

## Concorrência e recuperação

Várias consultas sem resultado em cache podem sobrecarregar a fonte: é o ==cache stampede==. Coordene o recálculo, varie um pouco o TTL e limite a concorrência. Uma leitura concorrente pode repopular um valor antigo após a invalidação; use versões, eventos confiáveis ou estratégia mais forte quando necessário. Em indisponibilidade do cache, o fallback precisa proteger a fonte de uma avalanche.

<details>
<summary>Checagem Rápida: Um TTL de cinco minutos garante cinco minutos de presença?</summary>

Não. Eviction, invalidação ou falha podem remover a chave antes. TTL é limite de validade, não reserva de memória.

</details>

## Pegadinhas de Prova

- **Cache é fonte durável automática**: Projete a fonte original e a recuperação explicitamente.
- **Só a pergunta compõe a chave**: Inclua tenant, modelo, versão dos dados e contexto relevante.
- **TTL resolve atualização imediata**: Ele limita obsolescência; invalidação e concorrência precisam de tratamento próprio.

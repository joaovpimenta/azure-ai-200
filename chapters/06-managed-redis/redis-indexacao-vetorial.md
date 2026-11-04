---
title: Índices vetoriais (FT.CREATE, HNSW/FLAT) e cache semântico
slug: redis-indexacao-vetorial
chapter: 06-managed-redis
exam_domain: data-management
tags:
  - managed-redis
  - redis-vector
  - ft-create
  - hnsw-redis
  - flat-redis
  - semantic-cache
difficulty: intermediate
tldr: FT.CREATE define campos vetoriais, dimensão, tipo e distância; FT.SEARCH consulta vetores
  binários compatíveis. Cache semântico exige limiar validado e isolamento por tenant, modelo e
  versão.
related_links:
  - label: Busca vetorial no Azure Managed Redis
    url: https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity
    type: learn
questions:
  - id: q-redis-indexacao-vetorial-01
    type: single-choice
    title: Índices vetoriais (FT.CREATE, HNSW/FLAT) e cache semântico
    exam_domain: data-management
    stem: FT.CREATE define vetor FLOAT32 com dimensão 3 em hashes. Qual representação deve ser enviada
      no campo vetorial?
    options:
      - id: opt-3
        text: Um vetor de outra dimensão porque KNN ajusta automaticamente.
        correct: false
        rationale: KNN não corrige incompatibilidade de dimensão.
        learn_url: https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity
      - id: opt-4
        text: Somente o ID do tenant no campo embedding.
        correct: false
        rationale: Metadados de tenant e vetor têm funções e campos distintos.
        learn_url: https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity
      - id: opt-1
        text: Um blob binário de três componentes FLOAT32 com representação compatível.
        correct: true
        rationale: Tipo, dimensão e codificação precisam coincidir com o índice.
        learn_url: https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity
      - id: opt-2
        text: Qualquer string com três palavras.
        correct: false
        rationale: Texto arbitrário não representa os componentes binários esperados.
        learn_url: https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity
    tags:
      - managed-redis
      - redis-vector
      - ft-create
      - hnsw-redis
      - flat-redis
      - semantic-cache
---

# Índices vetoriais (FT.CREATE, HNSW/FLAT) e cache semântico

Cache semântico reutiliza uma resposta para uma pergunta próxima em significado. A decisão não é a igualdade de strings: a aplicação gera um embedding, busca vizinhos e aceita um candidato somente quando passa por filtros e por um limiar avaliado.

## Índice e contrato binário

O índice associa metadados e vetores armazenados em hashes ou JSON, conforme a capacidade habilitada no serviço. Para hashes, ==FLOAT32== exige quatro bytes por componente. Dimensão, representação e ordem de bytes devem corresponder ao índice e à arquitetura do cliente.

`FLAT` faz comparação exaustiva; ==HNSW== usa grafo aproximado, normalmente com melhor escala e maior custo de memória. Meça recall e latência antes de escolher.

Com suporte a busca habilitado, crie o índice uma vez, por migração, não a cada requisição. No console Redis:

```text
FT.CREATE semantic-idx ON HASH PREFIX 1 semantic: SCHEMA tenant TAG model TAG answer TEXT embedding VECTOR HNSW 6 TYPE FLOAT32 DIM 3 DISTANCE_METRIC COSINE
```

O número `6` conta os argumentos de configuração do vetor. Três dimensões são apenas didáticas. Em produção, use a dimensão do embedding e não misture versões de modelo.

## Armazenar e consultar

Os trechos pressupõem clientes já autenticados como no artigo de cache e o índice criado acima. Os valores fixos de tenant/modelo demonstram filtros; em produção, derive-os da autorização e escape valores conforme a sintaxe TAG.

```python
import struct
import redis


def search(client: redis.Redis) -> object:
    vector: bytes = struct.pack("<3f", 0.1, 0.2, 0.3)
    client.hset("semantic:tenant-a:1", mapping={
        "tenant": "tenant_a", "model": "v1",
        "answer": "Resposta autorizada", "embedding": vector,
    })
    client.expire("semantic:tenant-a:1", 300)
    return client.execute_command(
        "FT.SEARCH", "semantic-idx",
        "(@tenant:{tenant_a} @model:{v1})=>[KNN 5 @embedding $vec AS distance]",
        "PARAMS", 2, "vec", vector,
        "SORTBY", "distance", "RETURN", 2, "answer", "distance", "DIALECT", 2,
    )
```

```csharp
using System.Buffers.Binary;
using StackExchange.Redis;

static async Task<RedisResult> SearchAsync(IDatabase db)
{
    float[] values = { 0.1f, 0.2f, 0.3f };
    byte[] vector = new byte[values.Length * sizeof(float)];
    for (int i = 0; i < values.Length; i++)
        BinaryPrimitives.WriteSingleLittleEndian(vector.AsSpan(i * 4, 4), values[i]);
    await db.HashSetAsync("semantic:tenant-a:1", new HashEntry[] {
        new("tenant", "tenant_a"), new("model", "v1"),
        new("answer", "Resposta autorizada"), new("embedding", vector)
    });
    await db.KeyExpireAsync("semantic:tenant-a:1", TimeSpan.FromMinutes(5));
    return await db.ExecuteAsync("FT.SEARCH", "semantic-idx",
        "(@tenant:{tenant_a} @model:{v1})=>[KNN 5 @embedding $vec AS distance]",
        "PARAMS", 2, "vec", vector, "SORTBY", "distance",
        "RETURN", 2, "answer", "distance", "DIALECT", 2);
}
```

Use respostas binárias no cliente Python ao lidar com blobs vetoriais. O exemplo usa duas operações para hash e TTL; em produção, coordene-as com transação ou script quando a atomicidade for necessária.

<details>
<summary>Checagem Rápida: O vizinho mais próximo é sempre reutilizável?</summary>

Não. Ele pode estar distante, desatualizado ou corresponder a outro contexto. Aplique filtros, limiar e validade antes de responder.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Lista textual é FLOAT32 binário**: O índice de hash exige bytes com dimensão e tipo compatíveis.
- **Pegadinha 2: Distância maior é melhor**: Com distância cosseno, valores menores indicam maior proximidade.
- **Pegadinha 3: Similaridade autoriza acesso**: Filtre tenant e escopo antes de reutilizar a resposta; mantenha TTL e versão da fonte.

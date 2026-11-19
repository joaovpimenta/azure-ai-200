---
title: Pool de conexões, PgBouncer e otimização de throughput
slug: postgresql-pool-de-conexoes-pgbouncer
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - connection-pooling
  - pgbouncer
  - throughput
difficulty: intermediate
tldr: O pool do cliente reutiliza conexões por processo; PgBouncer compartilha
  conexões do servidor. Some os limites de todas as réplicas. No modo transação,
  não dependa de estado entre transações.
related_links:
  - label: PgBouncer no Azure Database for PostgreSQL
    url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
    type: learn
questions:
  - id: q-postgresql-pool-de-conexoes-pgbouncer-01
    type: single-choice
    title: Pool de conexões, PgBouncer e otimização de throughput
    exam_domain: data-management
    stem: Um serviço usa PgBouncer em modo transaction. Pode depender de SET de
      sessão para operações futuras após o commit?
    options:
      - id: opt-1
        text: Não; outra transação pode usar outro backend.
        correct: true
        rationale: Pooling transacional não garante afinidade de sessão após concluir a
          transação.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
      - id: opt-2
        text: Sim, todas as transações do cliente ficam no mesmo backend.
        correct: false
        rationale: Essa é uma suposição incompatível com o modo transacional.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
      - id: opt-3
        text: Sim, se aumentar o número de réplicas.
        correct: false
        rationale: Mais processos não preservam estado de sessão no backend.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
      - id: opt-4
        text: Sim, porque TLS preserva variáveis SQL.
        correct: false
        rationale: TLS protege transporte; não define o modo de pooling.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
    tags:
      - postgresql
      - connection-pooling
      - pgbouncer
      - throughput
    learn_url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
---

# Pool de conexões, PgBouncer e otimização de throughput

A API do assistente passou de duas para vinte réplicas. O banco agora tem mais conexões, mesmo quando o volume de perguntas está baixo. Um pool reutiliza conexões e evita repetir TLS e autenticação, mas cada processo tem seu próprio limite. Para dimensionar, some os limites de todas as réplicas.

## Dois níveis de pool

O pool do cliente, como `psycopg_pool` ou o pool integrado ao Npgsql, reutiliza conexões dentro do processo. ==PgBouncer== atua como intermediário e compartilha conexões de servidor entre clientes. Eles podem coexistir, mas os limites precisam ser planejados em conjunto.

| Modo de pooling | Associação ao backend | Atenção |
|---|---|---|
| Sessão | Enquanto o cliente permanece conectado | Preserva estado, reutilização menor |
| Transação | Durante a transação | Não presume o mesmo backend depois do commit |
| Statement | Por instrução | Restringe transações com várias instruções |

No pooling transacional, evite depender de `SET` persistente, tabelas temporárias ou locks de sessão entre transações. Compatibilidade de prepared statements depende da versão e configuração do PgBouncer e do cliente: confirme, em vez de assumir suporte ou proibição universal.

## Uso dos clientes

Instale `psycopg[binary,pool]` no Python e `Npgsql` no .NET. Use `PG_CONNECTION_STRING` com a sintaxe do cliente escolhido, TLS verificado e credencial vinda de configuração protegida. Os exemplos limitam o pool do processo a cinco conexões e devem retornar `1`. Para Entra, configure renovação de token na criação das conexões físicas do serviço.

```python
import os
from psycopg_pool import ConnectionPool

# Crie um pool no startup do processo e feche no shutdown.
with ConnectionPool(os.environ["PG_CONNECTION_STRING"], min_size=1, max_size=5) as pool:
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            print(cur.fetchone()[0])
```

```csharp
using Npgsql;

// Mantenha um NpgsqlDataSource por configuração durante a vida do processo.
var settings = new NpgsqlConnectionStringBuilder(
    Environment.GetEnvironmentVariable("PG_CONNECTION_STRING")!)
{
    MaxPoolSize = 5
};
await using var dataSource = NpgsqlDataSource.Create(settings.ConnectionString);
await using (var conn = await dataSource.OpenConnectionAsync())
{
    await using var cmd = new NpgsqlCommand("SELECT 1", conn);
    Console.WriteLine(await cmd.ExecuteScalarAsync());
} // Dispose devolve a conexão ao pool.
```

No serviço real, o escopo do pool envolve a vida do host, não cada requisição. Mantenha transações curtas e não segure uma conexão enquanto aguarda a geração demorada do LLM.

## Orçamento e diagnóstico

Se 20 réplicas têm pool máximo de 10, o teto potencial é 200 conexões de cliente, antes de considerar outros serviços e ferramentas. Reserve capacidade para administração e jobs. Meça tempo de espera do pool, conexões ativas, duração de transações e locks antes de aumentar limites.

O PgBouncer integrado, quando disponível e habilitado no tier, costuma usar porta 6432; acesso direto usa 5432. Confirme a configuração do servidor e as regras de rede.

<details>
<summary>Checagem Rápida: Mais conexões sempre aumentam throughput?</summary>

Não. Concorrência excessiva aumenta contenção e pressão de memória. Um pool limitado pode reduzir latência e melhorar estabilidade.

</details>

## Pegadinhas de Prova

- **Dispose destrói sempre o socket**: Com pooling, a conexão lógica normalmente devolve o recurso ao pool.
- **Pool global entre réplicas**: Cada processo mantém seu próprio pool de cliente.
- **Transação preserva toda sessão**: Após o commit, o próximo trabalho pode usar outro backend.

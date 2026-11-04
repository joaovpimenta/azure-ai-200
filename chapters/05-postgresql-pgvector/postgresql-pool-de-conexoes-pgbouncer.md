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
tldr: Reutilize pools por processo e abra conexões lógicas por operação. PgBouncer reduz conexões
  físicas ao servidor, mas pooling transacional exige cuidado com estado de sessão e limites de
  concorrência.
related_links:
  - label: PgBouncer no Azure Database for PostgreSQL
    url: https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer
    type: learn
questions:
  - id: q-postgresql-pool-de-conexoes-pgbouncer-01
    type: single-choice
    title: Pool de conexões, PgBouncer e otimização de throughput
    exam_domain: data-management
    stem: Um serviço usa PgBouncer em modo transaction. Pode depender de SET de sessão para operações
      futuras após o commit?
    options:
      - id: opt-1
        text: Não; outra transação pode usar outro backend.
        correct: true
        rationale: Pooling transacional não garante afinidade de sessão após concluir a transação.
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
---

# Pool de conexões, PgBouncer e otimização de throughput

Cada nova conexão PostgreSQL exige autenticação, TLS e recursos no servidor. Em APIs e workers com muitas réplicas, criar uma conexão física por requisição aumenta a latência e pode esgotar o limite antes de CPU ou disco saturarem.

## Dois níveis de pool

O pool do cliente, como `psycopg_pool` ou o pool integrado ao Npgsql, reutiliza conexões dentro do processo. ==PgBouncer== atua como intermediário e compartilha conexões de servidor entre clientes. Eles podem coexistir, mas os limites precisam ser planejados em conjunto.

| Modo de pooling | Associação ao backend | Atenção |
|---|---|---|
| Sessão | Enquanto o cliente permanece conectado | Preserva estado, reutilização menor |
| Transação | Durante a transação | Não presume o mesmo backend depois do commit |
| Statement | Por instrução | Restringe transações com várias instruções |

No pooling transacional, evite depender de `SET` persistente, tabelas temporárias ou locks de sessão entre transações. Compatibilidade de prepared statements depende da versão e configuração do PgBouncer e do cliente: confirme, em vez de assumir suporte ou proibição universal.

## Uso dos clientes

Exemplos de ciclo de vida: instale `psycopg_pool` no Python e `Npgsql` no .NET. `PG_CONNECTION_STRING` deve vir de configuração protegida e incluir TLS verificado. Para Entra, configure renovação de token na criação das conexões físicas; não injete um único token em um pool de longa duração.

```python
import os
from psycopg_pool import ConnectionPool

# Crie um pool no startup do processo e feche no shutdown.
with ConnectionPool(os.environ["PG_CONNECTION_STRING"], min_size=1, max_size=5) as pool:
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            print(cur.fetchone())
```

```csharp
using Npgsql;

// Mantenha um NpgsqlDataSource por configuração durante a vida do processo.
await using var dataSource = NpgsqlDataSource.Create(
    Environment.GetEnvironmentVariable("PG_CONNECTION_STRING")!);
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

- **Pegadinha 1: Dispose destrói sempre o socket**: Com pooling, a conexão lógica normalmente devolve o recurso ao pool.
- **Pegadinha 2: Pool global entre réplicas**: Cada processo mantém seu próprio pool de cliente.
- **Pegadinha 3: Transação preserva toda sessão**: Após o commit, o próximo trabalho pode usar outro backend.

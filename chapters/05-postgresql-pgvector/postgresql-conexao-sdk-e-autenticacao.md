---
title: Conexão com psycopg/Npgsql e autenticação Microsoft Entra
slug: postgresql-conexao-sdk-e-autenticacao
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - psycopg
  - npgsql
  - entra-id-auth
  - passwordless
  - sdk
difficulty: intermediate
tldr: Psycopg e Npgsql usam o protocolo PostgreSQL; um token Entra pode ocupar o campo de senha.
  Habilite a autenticação no servidor, provisione o principal no banco e renove tokens em conexões
  novas.
related_links:
  - label: Autenticação Entra no PostgreSQL
    url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts
    type: learn
  - label: Configurar autenticação Entra
    url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-configure
    type: learn
questions:
  - id: q-postgresql-conexao-sdk-e-autenticacao-01
    type: single-choice
    title: Conexão com psycopg/Npgsql e autenticação Microsoft Entra
    exam_domain: data-management
    stem: Uma aplicação obtém token Entra para PostgreSQL, mas não tem permissão de SELECT. Qual etapa
      está faltando?
    options:
      - id: opt-4
        text: Desabilitar a validação TLS.
        correct: false
        rationale: Isso enfraquece a conexão sem conceder permissão SQL.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts
      - id: opt-1
        text: Provisionar o principal no banco e conceder os grants SQL necessários.
        correct: true
        rationale: Autenticação do token não substitui autorização nas tabelas.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts
      - id: opt-2
        text: Conceder apenas Contributor no servidor Azure.
        correct: false
        rationale: Gerenciamento do recurso não equivale a grants SQL.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts
      - id: opt-3
        text: Usar o token como nome de banco.
        correct: false
        rationale: O token é fornecido como credencial no campo de senha.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/security/security-entra-concepts
    tags:
      - postgresql
      - psycopg
      - npgsql
      - entra-id-auth
      - passwordless
      - sdk
---

# Conexão com psycopg/Npgsql e autenticação Microsoft Entra

Uma API de IA pode consultar dados relacionais sem armazenar senha de banco. A autenticação Microsoft Entra permite usar a identidade da aplicação, mas exige configuração tanto no serviço Azure quanto no PostgreSQL.

## Preparar servidor, principal e rede

Habilite autenticação Entra e configure um administrador Entra. Conectado como administrador, provisione o principal da aplicação por meio das funções `pgaadauth` documentadas, conferindo object ID e nome. Conceda apenas acesso às tabelas e operações necessárias. Permissão de gerenciar o servidor no Azure não equivale a permissão SQL.

A credencial solicita token para ==https://ossrdbms-aad.database.windows.net/.default==. O token vai no campo de senha do protocolo PostgreSQL. Firewall, private endpoint, DNS e validação TLS continuam necessários; a identidade não abre a rede.

## Consulta parametrizada em ambos os clientes

Instale `psycopg[binary]` e `azure-identity`; no .NET 8, `Npgsql` e `Azure.Identity`. Defina host, banco, usuário Entra provisionado e caminho do certificado CA confiável. Os exemplos fazem uma conexão e consultam a identidade autenticada.

```python
import os
import psycopg
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
with psycopg.connect(
    host=os.environ["PGHOST"], dbname=os.environ["PGDATABASE"],
    user=os.environ["PGUSER"], password=token.token,
    sslmode="verify-full", sslrootcert=os.environ["PGSSLROOTCERT"],
    connect_timeout=10,
) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT current_user, %s::text", ("conexao-validada",))
        print(cur.fetchone())
```

```csharp
using Azure.Core;
using Azure.Identity;
using Npgsql;

var credential = new DefaultAzureCredential();
var token = await credential.GetTokenAsync(new TokenRequestContext(
    new[] { "https://ossrdbms-aad.database.windows.net/.default" }));
var settings = new NpgsqlConnectionStringBuilder {
    Host = Environment.GetEnvironmentVariable("PGHOST"),
    Database = Environment.GetEnvironmentVariable("PGDATABASE"),
    Username = Environment.GetEnvironmentVariable("PGUSER"), Password = token.Token,
    SslMode = SslMode.VerifyFull,
    RootCertificate = Environment.GetEnvironmentVariable("PGSSLROOTCERT"), Timeout = 10
};
await using var conn = new NpgsqlConnection(settings.ConnectionString);
await conn.OpenAsync();
await using var cmd = new NpgsqlCommand("SELECT current_user, $1::text", conn);
cmd.Parameters.AddWithValue("conexao-validada");
await using var reader = await cmd.ExecuteReaderAsync();
while (await reader.ReadAsync()) Console.WriteLine(reader.GetString(0));
```

O parâmetro ==%s== no psycopg não é interpolação Python. No Npgsql, `$1` referencia o primeiro parâmetro. Nunca concatene entrada do usuário na consulta.

## Tokens e ciclo de vida

Os trechos são testes pontuais. Em serviços persistentes, não guarde um token estático na configuração do pool: renove-o antes de abrir conexões físicas novas. Use callbacks ou provedores periódicos de senha do cliente quando disponíveis. Não registre token nem connection string com senha.

<details>
<summary>Checagem Rápida: Um token válido basta para executar SELECT em qualquer tabela?</summary>

Não. O principal deve existir no banco e ter os grants SQL necessários, além de conseguir chegar ao servidor.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: RBAC Azure substitui GRANT**: Autorização SQL é outra camada.
- **Pegadinha 2: Token nunca expira**: Conexões novas precisam de credencial válida; planeje renovação no pool.
- **Pegadinha 3: Criptografia sem validar host**: Use cadeia CA confiável e validação de nome; não desabilite verificação para corrigir certificados.

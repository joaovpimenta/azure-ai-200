---
title: Busca vetorial e RAG com filtros de metadados
slug: postgresql-rag-com-filtros
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - pgvector
  - metadata-filtering
  - rag
  - hybrid-search
difficulty: intermediate
tldr: Filtre por tenant, versão de modelo e permissões antes de fornecer contexto ao LLM. Em ANN,
  filtros seletivos podem reduzir resultados; avalie planos, recall e mecanismos de varredura
  suportados.
related_links:
  - label: Busca vetorial com pgvector
    url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
    type: learn
questions:
  - id: q-postgresql-rag-com-filtros-01
    type: single-choice
    title: Busca vetorial e RAG com filtros de metadados
    exam_domain: data-management
    stem: Uma solução multi-tenant recupera chunks por ANN. Como proteger o contexto enviado ao LLM?
    options:
      - id: opt-4
        text: Aceitar qualquer modelo de embedding com a mesma dimensão.
        correct: false
        rationale: A dimensão sozinha não torna espaços vetoriais compatíveis.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-1
        text: Aplicar filtros de autorização e versão na recuperação e avaliar recall sob esses filtros.
        correct: true
        rationale: O controle deve ocorrer antes de o conteúdo chegar ao modelo; ANN e filtros exigem
          avaliação conjunta.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-2
        text: Recuperar todos os tenants e pedir ao prompt que ignore os demais.
        correct: false
        rationale: O conteúdo já teria sido exposto ao modelo.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
      - id: opt-3
        text: Usar somente a menor distância, sem tenant.
        correct: false
        rationale: Similaridade não é autorização.
        learn_url: https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector
    tags:
      - postgresql
      - pgvector
      - metadata-filtering
      - rag
      - hybrid-search
---

# Busca vetorial e RAG com filtros de metadados

Um pipeline RAG gera o embedding da pergunta, recupera chunks autorizados e fornece o texto ao modelo com suas fontes. Um vetor próximo não significa documento autorizado nem resposta correta; recuperação e geração precisam de avaliação separada.

## Contrato da recuperação

Armazene texto, tenant, documento de origem, versão do embedding e vetor. Gere a pergunta com o mesmo modelo e dimensão usados no corpus. O tenant vem da identidade autenticada, não de uma escolha livre do cliente. Considere Row Level Security como defesa adicional, com papéis que não contornem as políticas.

A consulta deve combinar ==metadata filtering== e distância. Em índices aproximados, a aplicação de filtros pode reduzir a quantidade retornada depois da busca de candidatos. Versões recentes de pgvector oferecem varreduras iterativas; confirme disponibilidade e configuração antes de depender delas. Para conjuntos muito seletivos, busca exata após filtro pode ser competitiva.

## Consulta em Python e C#

Os trechos pressupõem conexões abertas e autenticadas, tabela `rag_chunks` com `tenant_id uuid`, `model_version text`, `content text` e `embedding vector(3)`. Os vetores pequenos são didáticos. Em produção, serialize somente floats finitos e valide a dimensão antes da consulta.

```python
import uuid
from typing import Any


def retrieve(conn: Any, tenant_id: uuid.UUID, vector: list[float]) -> list[tuple]:
    if len(vector) != 3:
        raise ValueError("Dimensão incompatível")
    literal = "[" + ",".join(str(float(x)) for x in vector) + "]"
    with conn.cursor() as cur:
        cur.execute(
            """SELECT content FROM rag_chunks
               WHERE tenant_id = %s AND model_version = %s
               ORDER BY embedding <=> %s::vector LIMIT %s""",
            (tenant_id, "modelo-v1", literal, 5),
        )
        return cur.fetchall()
```

```csharp
using System.Globalization;
using Npgsql;

static async Task<List<string>> RetrieveAsync(
    NpgsqlConnection conn, Guid tenantId, float[] vector, CancellationToken ct)
{
    if (vector.Length != 3) throw new ArgumentException("Dimensão incompatível");
    string literal = "[" + string.Join(",", vector.Select(x => x.ToString(CultureInfo.InvariantCulture))) + "]";
    await using var cmd = new NpgsqlCommand(
        "SELECT content FROM rag_chunks WHERE tenant_id=$1 AND model_version=$2 " +
        "ORDER BY embedding <=> $3::vector LIMIT $4", conn);
    cmd.Parameters.AddWithValue(tenantId);
    cmd.Parameters.AddWithValue("modelo-v1");
    cmd.Parameters.AddWithValue(literal);
    cmd.Parameters.AddWithValue(5);
    var results = new List<string>();
    await using var reader = await cmd.ExecuteReaderAsync(ct);
    while (await reader.ReadAsync(ct)) results.Add(reader.GetString(0));
    return results;
}
```

O literal vetorial continua sendo um parâmetro, não parte interpolada do SQL. Ajuste o índice ao operador `<=>` e mantenha índice relacional útil para os filtros.

## Qualidade e isolamento

Avalie recall@k com filtros reais e confira se o contexto contém evidência suficiente. Busca híbrida combina sinais textuais e vetoriais; não some scores de escalas diferentes sem normalização ou método de fusão. Nunca recupere todo o corpus e espere que o prompt faça o controle de acesso.

<details>
<summary>Checagem Rápida: LIMIT 5 garante cinco chunks depois de um filtro seletivo com ANN?</summary>

Não. A busca aproximada pode encontrar poucos candidatos elegíveis. Meça o resultado, ajuste a busca e considere plano exato ou varredura iterativa suportada.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Prompt protege tenants**: Autorização precisa ocorrer antes de enviar conteúdo ao modelo.
- **Pegadinha 2: Embeddings são universais**: Modelo, versão e dimensão devem ser compatíveis.
- **Pegadinha 3: Índice ANN preserva recall perfeito**: Valide resultados e latência sob os filtros reais.

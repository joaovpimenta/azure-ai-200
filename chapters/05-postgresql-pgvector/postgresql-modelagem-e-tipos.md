---
title: Modelagem de esquemas, tipos de dados e índices B-tree/GIN
slug: postgresql-modelagem-e-tipos
chapter: 05-postgresql-pgvector
exam_domain: data-management
tags:
  - postgresql
  - schema-modeling
  - data-types
  - btree-index
  - gin-index
difficulty: intermediate
tldr: Modele identificadores, tenants e relações com tipos e constraints explícitos. Use B-tree para
  igualdade, intervalos e ordenação; GIN para estruturas como JSONB e busca textual conforme o
  operador.
related_links:
  - label: Tipos de dados PostgreSQL
    url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
    type: learn
  - label: Índices e desempenho
    url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
    type: learn
questions:
  - id: q-postgresql-modelagem-e-tipos-01
    type: single-choice
    title: Modelagem de esquemas, tipos de dados e índices B-tree/GIN
    exam_domain: data-management
    stem: A consulta filtra por tenant e ordena por updated_at. Qual índice é um candidato inicial
      coerente?
    options:
      - id: opt-1
        text: B-tree em (tenant_id, updated_at).
        correct: true
        rationale: O prefixo por tenant e a segunda coluna podem atender filtro e ordenação desse padrão.
        learn_url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
      - id: opt-2
        text: Somente GIN em um campo JSONB não consultado.
        correct: false
        rationale: Esse índice não atende diretamente as colunas do padrão descrito.
        learn_url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
      - id: opt-3
        text: HNSW sobre uma coluna text.
        correct: false
        rationale: HNSW vetorial não substitui índice relacional para tenant e data.
        learn_url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
      - id: opt-4
        text: Nenhuma constraint e todos os campos como texto.
        correct: false
        rationale: Isso não resolve o acesso e remove integridade de tipos e relações.
        learn_url: https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/
    tags:
      - postgresql
      - schema-modeling
      - data-types
      - btree-index
      - gin-index
---

# Modelagem de esquemas, tipos de dados e índices B-tree/GIN

Um repositório RAG precisa guardar texto, metadados, versões de modelo e relações entre documentos. Um esquema explícito evita que embeddings percam vínculo com a origem ou sejam reutilizados após mudança de versão.

## Escolher tipos e invariantes

Use `uuid` ou outro identificador estável para documentos; `text` para conteúdo variável; `timestamptz` para instantes e `jsonb` para metadados flexíveis consultáveis. Não transforme todos os campos em JSON: tenant, chave externa e versão de modelo normalmente merecem colunas explícitas.

==Constraints== garantem invariantes independentemente da aplicação. `NOT NULL`, `CHECK`, chaves primárias e estrangeiras evitam estados inválidos durante importações e concorrência.

```sql
CREATE TABLE documents (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL,
    content text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    model_version text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id)
);
CREATE INDEX documents_tenant_updated
    ON documents (tenant_id, updated_at DESC);
CREATE INDEX documents_metadata_gin ON documents USING gin (metadata);
```

O esquema permite consultar por tenant e data, além de usar contenção JSONB como `metadata @> '{"category":"manual"}'::jsonb`. O filtro de tenant deve vir de identidade autorizada; um UUID fornecido pelo navegador não prova acesso.

## B-tree e GIN não são intercambiáveis

| Índice | Operações típicas | Compromisso |
|---|---|---|
| B-tree | Igualdade, range, ordenação | Ordem das colunas importa |
| GIN em JSONB | Contenção e operadores suportados | Maior custo de escrita e armazenamento |
| GIN em `tsvector` | Busca textual | Exige configuração linguística apropriada |
| Índice de expressão | Campo extraído do JSON | Consulta deve corresponder à expressão |

No B-tree `(tenant_id, updated_at)`, o prefixo atende bem consultas por tenant. Isso não garante ganho equivalente em consultas que filtram apenas a segunda coluna. Um índice GIN não substitui o índice de ordenação por data.

## Medir antes de adicionar índices

Use `EXPLAIN (ANALYZE, BUFFERS)` em ambiente controlado para observar linhas estimadas, linhas reais e leituras. `ANALYZE` executa a consulta; tenha cuidado com instruções que alteram dados e com custo sobre produção. Mantenha estatísticas atualizadas após cargas grandes.

<details>
<summary>Checagem Rápida: Um índice sempre reduz o custo total da aplicação?</summary>

Não. Ele acelera certos acessos, mas ocupa armazenamento e precisa ser atualizado em escritas. Avalie o workload e o plano real.

</details>

Para evolução do esquema, use migrações compatíveis com versões anterior e nova da aplicação. Adicionar colunas e fazer backfill em etapas costuma permitir rollout mais seguro que remover campos ainda usados.

## Pegadinhas de Prova

- **Pegadinha 1: JSONB elimina modelagem**: Flexibilidade não substitui integridade, autorização nem seleção de índices.
- **Pegadinha 2: B-tree resolve todo operador JSON**: Escolha a classe de índice compatível com os operadores usados.
- **Pegadinha 3: Mais índices sempre é melhor**: Escritas, manutenção e espaço também têm custo.

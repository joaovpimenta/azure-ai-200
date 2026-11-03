---
title: "Matriz Comparativa de Decisão: [Tecnologia A] vs [Tecnologia B] vs [Tecnologia C]"
slug: "comparativo-slug-kebab-case"
chapter: "comparisons"
exam_domain: "data-management"
tags:
  - comparison
  - architecture
  - vector-stores
tldr: "Guia de decisão de alta densidade para escolher a tecnologia correta no exame AI-200 com base em latência, escala, custos e requisitos de negócios."
related_links:
  - label: "Documentação Oficial de Arquitetura de Dados"
    url: "https://learn.microsoft.com/azure/architecture/guide/technology-choices/data-store-overview"
    type: "learn"
---

# Matriz Comparativa de Decisão: [Tecnologia A] vs [Tecnologia B] vs [Tecnologia C]

## Visão Geral e Dilema Arquitetural

Apresentação do dilema de engenharia e das principais forças arquiteturais em conflito no exame AI-200 (ex: latência sub-milissegundo vs conformidade relacional vs escala NoSQL global com particionamento automático).

## Matriz Comparativa Multidimensional

| Dimensão de Análise | Opção A (ex: Azure Cosmos DB) | Opção B (ex: Azure PostgreSQL pgvector) | Opção C (ex: Azure Managed Redis) |
| :--- | :--- | :--- | :--- |
| **Modelo de Dados** | Documentos NoSQL (JSON) | Relacional (Tabelas com colunas vetoriais) | In-Memory Key-Value / Estruturas de dados |
| **Algoritmos Vetoriais** | DiskANN, Quantized Flat, Flat | HNSW, IVFFlat | HNSW, FLAT (RediSearch) |
| **Throughput & Latência** | Sub-10ms em leitura pontual com RUs dedicadas | Latência transacional SQL típica (5-25ms) | Sub-milissegundo (em memória RAM) |
| **Escalabilidade** | Particionamento horizontal ilimitado e multi-região | Escala vertical (computação/storage) ou réplicas de leitura | Escala vertical e sharding de cluster |
| **Filtros de Metadados** | Consultas SQL flexíveis com índices invertidos e vetoriais | Filtros SQL relacionais completos, joins e índices GIN/B-tree | Filtros de tags e campos numéricos via RediSearch |
| **Modelo de Custo** | Request Units (RU/s) provisionadas ou Autoscale | vCores computacionais, RAM e armazenamento em GB | Tier de cache em memória DRAM por hora |
| **Autenticação Segura** | Microsoft Entra ID RBAC + Managed Identities | Microsoft Entra ID / Token Entra + senhas | Microsoft Entra ID / Access Keys |

## Heurísticas e Árvore de Decisão Rápida

- **Escolha a Opção A se:**
  - A aplicação exige distribuição geográfica global com replicação multi-região e SLAs de baixa latência p99 respaldados financeiramente.
  - O volume de dados cresce de forma imprevisível e exige particionamento horizontal elástico sem gerenciamento de infraestrutura.
  - Os documentos já estão modelados em JSON nativo e exigem buscas vetoriais integradas ao catálogo de produtos.

- **Escolha a Opção B se:**
  - A arquitetura já utiliza o ecossistema relacional PostgreSQL e depende de transações ACID complexas, integridade referencial ou junções relacionais (`JOINs`).
  - Há necessidade de algoritmos vetoriais maduros como HNSW em colunas com filtros relacionais compostos.
  - Os desenvolvedores possuem proficiência em ferramentas SQL tradicionais e frameworks ORM (ex: Entity Framework, SQLAlchemy).

- **Escolha a Opção C se:**
  - A latência é o requisito número um absoluto (SLA sub-milissegundo) para atender consultas em tempo real.
  - O objetivo primário é implementar um **Cache Semântico** (Semantic Cache) para evitar chamadas redundantes e caras a modelos LLM externos.
  - O conjunto de dados cabe inteiramente em memória e suporta políticas de expiração (TTL) e desalocação (eviction).

## Pegadinhas de Prova

- **Pegadinha 1: Custo de Busca Vetorial por Força Bruta**: O uso de algoritmos sem índice vetorial adequado (como scan sequencial ou flat em grandes coleções) esgota rapidamente as RUs ou a CPU, gerando erros HTTP 429 ou timeouts na aplicação.
- **Pegadinha 2: Persistência vs Cache**: Azure Managed Redis é primariamente um armazenamento em memória de altíssima velocidade. Não deve ser selecionado como repositório primário de retenção histórica durável quando o requisito da questão exigir durabilidade de longo prazo com recuperação pontual (Point-In-Time Restore).
- **Pegadinha 3: Criação de Índice HNSW em PostgreSQL**: A criação de índices HNSW com `pgvector` exige alocação temporária substancial de memória de manutenção (`maintenance_work_mem`). Se a memória não for ajustada antes da criação do índice em tabelas volumosas, a operação falhará por esgotamento de memória (OOM).

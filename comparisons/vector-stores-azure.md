---
title: "Matriz Comparativa de Decisão: Bancos Vetoriais no Azure"
slug: "vector-stores-azure"
chapter: "comparisons"
exam_domain: "data-management"
tags:
  - comparison
  - architecture
  - vector-stores
  - cosmos-db
  - postgresql
  - pgvector
  - managed-redis
  - redis-vector
  - vector-search
  - hnsw
  - diskann
  - ivfflat
  - rag
  - distance-metrics
  - cosine-similarity
  - metadata-filtering
  - hybrid-search
  - ann
  - throughput
  - rus
  - request-units
difficulty: "advanced"
tldr: "Cosmos DB atende documentos distribuídos; PostgreSQL une vetores e relações SQL; Redis atende cache e busca em memória. Escolha pelos dados e requisitos, depois meça latência, recall e custo."
related_links:
  - label: "Busca Vetorial no Azure Cosmos DB for NoSQL"
    url: "https://learn.microsoft.com/azure/cosmos-db/nosql/vector-search"
    type: "learn"
  - label: "Como usar pgvector no Azure Database for PostgreSQL"
    url: "https://learn.microsoft.com/en-us/azure/postgresql/extensions/how-to-use-pgvector"
    type: "learn"
  - label: "Busca Vetorial no Azure Managed Redis"
    url: "https://learn.microsoft.com/en-us/azure/redis/overview-vector-similarity"
    type: "learn"
---

# Escolher um banco vetorial no Azure

Busca vetorial encontra conteúdo por proximidade entre embeddings, listas de números geradas por um modelo. No RAG, os documentos recuperados ajudam o modelo a responder. A escolha do banco depende dos dados, filtros, escala e custo; o nome do serviço não garante uma latência.

## Comparação rápida

| Necessidade | Candidato | Por quê? |
|---|---|---|
| Documentos JSON distribuídos por regiões | Cosmos DB for NoSQL | Particionamento gerenciado e busca vetorial junto aos documentos |
| Vetores com tabelas, joins e transações relacionais | PostgreSQL com pgvector | SQL, restrições, filtros e vetores no mesmo banco |
| Reutilizar respostas e manter dados temporários | Azure Managed Redis | Cache em memória, expiração e busca por similaridade |

Os serviços podem trabalhar juntos. Por exemplo, PostgreSQL guarda os dados duráveis e Redis guarda respostas que podem ser recalculadas.

## Índices: exatidão, velocidade e memória

Recall é a proporção de vizinhos esperados encontrada pela busca. Um índice aproximado pode ganhar velocidade e perder parte desses resultados. Compare-o com uma busca exata em dados de avaliação.

| Serviço | Opções | O que conferir |
|---|---|---|
| Cosmos DB | `flat`, `quantizedFlat`, `diskANN` | `flat`: até 505 dimensões; os outros: até 4.096 |
| PostgreSQL/pgvector | Busca exata, HNSW, IVFFlat | Tipo (`vector`/`halfvec`), versão, métrica e limites do índice |
| Managed Redis | FLAT, HNSW | Busca habilitada, dimensão, representação binária e memória |

- **HNSW:** grafo de vizinhos; não exige uma etapa inicial de agrupamento, mas pode consumir bastante memória.
- **IVFFlat:** agrupa vetores em listas. Crie com dados representativos e ajuste `lists` e `probes` conforme as medições.
- **DiskANN:** busca aproximada por grafo no Cosmos DB, candidata para volumes maiores. Não implica recall ou tempo de resposta fixos.
- **Meia precisão (`halfvec`):** reduz bytes por componente, com possível perda numérica. Não garante reduzir todo o índice pela metade nem dobrar desempenho.

## Filtros e busca híbrida

**Filtro de metadados** restringe documentos, por exemplo por cliente e data. **Busca híbrida** combina relevância textual e vetorial. Uma consulta vetorial com `WHERE` não é, por isso só, híbrida.

Autorize o usuário antes de escolher os filtros. Uma chave de partição ou prefixo Redis organiza dados, mas não concede nem impede acesso por si só.

| Serviço | Recursos úteis |
|---|---|
| Cosmos DB | Filtros sobre JSON e `VectorDistance` no `ORDER BY` |
| PostgreSQL | Joins, B-tree, GIN, políticas de acesso por linha e distância vetorial |
| Redis | Filtros TAG/NUMERIC/TEXT e busca KNN (vizinhos mais próximos) |

Em busca aproximada, filtros seletivos podem reduzir o número de resultados. Avalie os filtros reais; no pgvector, confira suporte a varreduras iterativas na versão instalada. Para combinar texto e vetor, use um método de fusão de classificações ou normalização adequada, não uma soma arbitrária de pontuações.

## Custo e capacidade

Um milhão de vetores de 1.536 componentes `float32` usa cerca de 6,14 GB **só nos componentes**: `1.000.000 × 1.536 × 4 bytes`. Índices, documentos, metadados, réplicas e folga operacional aumentam esse total.

| Serviço | Principais fatores de custo e operação |
|---|---|
| Cosmos DB | RUs de leitura/escrita, capacidade provisionada ou consumo, armazenamento e regiões |
| PostgreSQL | Computação, memória, armazenamento, I/O, índices e conexões |
| Redis | Capacidade e memória para dados/índices, replicação e política de remoção |

Não use números universais de milissegundos ou consultas por segundo. Teste volume, concorrência, filtros, rede, cache aquecido/frio e qualidade dos resultados. Pool de conexões ajuda PostgreSQL; PgBouncer é uma opção, não uma obrigação para qualquer aplicação.

## Cache semântico com Redis

1. Gere o embedding da pergunta e procure candidatos do cliente autorizado.
2. Confira versão dos dados/modelo, validade e limite de distância definido por avaliação.
3. Reutilize a resposta somente se essas condições forem atendidas.
4. Caso contrário, recupere contexto, chame o modelo e grave o resultado com TTL.

Perguntas parecidas podem precisar de respostas diferentes. Não existe um limiar de similaridade universal, e um acerto no cache ainda pode ter custo de embedding e infraestrutura.

<details>
<summary>Checagem Rápida: Redis é sempre a escolha quando há uma meta de baixa latência?</summary>

Não. Considere também tamanho dos dados, memória, persistência, filtros e custo. Valide a meta com a carga real; nenhum produto a garante apenas por ter sido escolhido.

</details>

## Pegadinhas de Prova

- **Índices não são intercambiáveis:** DiskANN é uma opção do Cosmos DB; IVFFlat, do pgvector.
- **505 não é recomendação:** é o limite de dimensões do índice flat no Cosmos DB.
- **Autorização não é similaridade:** filtre dados permitidos antes de enviá-los ao modelo ou reutilizar respostas.
- **TTL não reserva memória:** Redis pode remover chaves antes por política de eviction.
- **pgvector exige habilitação:** permita `vector` em `azure.extensions` e execute `CREATE EXTENSION vector` no banco.
- **Política vetorial pode evoluir:** consulte o suporte atual para adicionar/remover caminhos e recriar configurações; planeje reindexação.

## Continue o estudo

- [Cosmos DB: política e busca vetorial](../chapters/04-cosmos-db-nosql/cosmos-db-busca-vetorial.md)
- [pgvector: HNSW e IVFFlat](../chapters/05-postgresql-pgvector/pgvector-indices-hnsw-ivfflat.md)
- [Redis: índices e cache semântico](../chapters/06-managed-redis/redis-indexacao-vetorial.md)

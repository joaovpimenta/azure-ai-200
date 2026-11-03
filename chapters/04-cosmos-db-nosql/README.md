# Capítulo 04: Azure Cosmos DB for NoSQL

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Gerenciamento%20de%20Dados%20para%20IA-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-25%20a%2030%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Trilha Piloto](https://img.shields.io/badge/Trilha-Piloto%20Completa-blue?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

O **Azure Cosmos DB for NoSQL** é o banco de dados distribuído globalmente de alta performance e baixa latência (sub-10ms em leitura e escrita no 99º percentil) da Microsoft. No contexto de soluções de Inteligência Artificial e RAG (Retrieval-Augmented Generation), o Cosmos DB atua como repositório central unificado para documentos semi-estruturados JSON, histórico de conversação de agentes, metadados corporativos e vetores de embeddings integrados.

No exame **AI-200**, o Cosmos DB for NoSQL é a trilha com maior profundidade no domínio de dados:
1. **Modelo de Recursos e Particionamento Horizontal**: Hierarquia Conta -> Banco de Dados -> Contêiner -> Itens. Estratégias determinísticas de escolha de **Partition Key** para garantir distribuição uniforme de dados e throughput (Request Units - RUs), evitando *hot partitions*.
2. **Desenvolvimento com SDKs Oficiais (Python e C#)**: Padrões de conexão singleton via `CosmosClient`, execução de operações pontuais de CRUD, consultas SQL com parâmetros para proteção contra injeção e paginação determinística utilizando *continuation tokens*.
3. **Políticas de Indexação e Níveis de Consistência**: Otimização do consumo de RUs por meio de inclusão/exclusão seletiva de caminhos (`includedPaths` e `excludedPaths`), índices compostos para ordenação e seleção do nível adequado de consistência entre os 5 modelos oficiais (*Strong*, *Bounded Staleness*, *Session*, *Consistent Prefix*, *Eventual*).
4. **Busca Vetorial Nativa e RAG**: Definição de políticas de embedding vetorial (`vectorEmbeddingPolicy`) e índices vetoriais (`diskann`, `quantizedFlat`, `flat`), combinadas com a função SQL nativa `VectorDistance()` para recuperação semântica em alta escala.
5. **Change Feed Processor (CFP)**: Padrão arquitetural orientado a eventos para capturar em tempo real inserções e atualizações de documentos, acionando pipelines automáticos de geração e recálculo de embeddings com modelos Azure OpenAI.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Conectar ao Cosmos DB for NoSQL com SDKs oficiais (.NET e Python), gerenciar o ciclo de vida do cliente e executar consultas parametrizadas.
- Otimizar o desempenho de consultas e o consumo de Request Units (RUs) configurando políticas de indexação customizadas e selecionando níveis de consistência adequados.
- Armazenar e recuperar embeddings vetoriais e executar buscas por similaridade vetorial com a função `VectorDistance()`.
- Implementar o Change Feed Processor configurando o contêiner de leases e delegates de processamento para reagir a alterações de dados.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `cosmos-db-modelo-de-recursos-e-particionamento` | Modelo de recursos, partition key e Request Units | `cosmos-db` | Piloto | [Acessar Conceito](./cosmos-db-modelo-de-recursos-e-particionamento.md) |
| 2 | `cosmos-db-sdk-conexao-e-consultas` | SDK: CosmosClient, CRUD, consultas parametrizadas e paginação | `cosmos-db` | Piloto | [Acessar Conceito](./cosmos-db-sdk-conexao-e-consultas.md) |
| 3 | `cosmos-db-indexacao-consistencia-rus` | Políticas de indexação, níveis de consistência e otimização de RUs | `cosmos-db` | Piloto | [Acessar Conceito](./cosmos-db-indexacao-consistencia-rus.md) |
| 4 | `cosmos-db-busca-vetorial` | Embeddings, políticas vetoriais e VectorDistance() | `cosmos-db` | Piloto | [Acessar Conceito](./cosmos-db-busca-vetorial.md) |
| 5 | `cosmos-db-change-feed-processor` | Change feed processor: leases, delegates e reprocessamento | `cosmos-db` | Piloto | [Acessar Conceito](./cosmos-db-change-feed-processor.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Imutabilidade da Chave de Partição e da Política Vetorial**: Nem a chave de partição (`partitionKey`) nem a política de embedding vetorial (`vectorEmbeddingPolicy`) podem ser modificadas após a criação do contêiner. Qualquer mudança de arquitetura exige novo contêiner e migração dos dados.
- **Consultas Ponto a Ponto vs Cross-Partition**: Consultas que incluem a chave de partição no filtro (`WHERE c.tenantId = @tenantId`) são roteadas para uma única partição física (baixo consumo de RUs). Consultas sem a chave de partição são *cross-partition*, executadas em paralelo em todas as partições físicas, consumindo muito mais RUs.
- **Nível de Consistência Padrão**: O nível de consistência padrão da conta é **Session** (garante leitura das próprias escritas e leituras monotônicas dentro da mesma sessão de cliente). É o equilíbrio ideal entre consistência, latência e custo para a maioria das soluções de IA.
- **Contêiner de Leases do Change Feed**: O Change Feed Processor exige um contêiner auxiliar de leases (`/id` como chave de partição recomendada) para rastrear o estado e o checkpoint do processamento entre múltiplas instâncias da aplicação.

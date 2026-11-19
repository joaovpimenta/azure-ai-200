# Preparação para a prova AI-200

Use esta página quando terminar o roteiro ou quiser identificar o que ainda precisa praticar. Para cada área do exame, combine questões, um laboratório e uma explicação em voz alta das decisões que tomou.

## Antes de marcar a prova

1. **Confirme o escopo.** Use o [guia oficial do exame (PT-BR)](https://learn.microsoft.com/pt-br/credentials/certifications/resources/study-guides/ai-200) para conferir as habilidades e os pesos, e o [curso oficial AI-200T00 (PT-BR)](https://learn.microsoft.com/pt-br/training/courses/ai-200t00) para encontrar os módulos correspondentes.
2. **Demonstre a habilidade.** Faça pelo menos um laboratório de cada área. Depois repita o passo principal sem copiar a instrução e registre uma evidência, como uma resposta HTTP, uma mensagem na fila ou um trace. Confira os [pré-requisitos dos laboratórios](https://microsoftlearning.github.io/mslearn-azure-ai/lab-requirements.html), a quota e o custo dos recursos. Remova os recursos do laboratório ao terminar.
3. **Faça o simulado local em uma sessão.** Use os 120 minutos, responda sem consultar o gabarito e reserve tempo para revisar as marcadas. Volte aos temas das respostas erradas e das questões em branco. Na correção, explique por que as outras opções falham no cenário.
4. **Use a avaliação oficial como segunda referência.** Na [página da certificação](https://learn.microsoft.com/pt-br/credentials/certifications/azure-ai-cloud-developer-associate/), entre no AI Skills Navigator e abra o *Practice Assessment*. Abra também o *Exam Sandbox* para praticar a interface. A Microsoft informa 120 minutos para a avaliação e usa uma [escala própria de pontuação](https://learn.microsoft.com/pt-br/credentials/certifications/exam-scoring-reports). O percentual do site serve para orientar a revisão.

Antes de agendar, confira se consegue repetir a tarefa principal de cada laboratório, explicar os erros do simulado e responder a questões novas dentro do tempo. Use os resultados do *Practice Assessment* para decidir quais áreas ainda merecem outra rodada. Repetir o mesmo banco local ajuda a revisar as justificativas.

## Vídeo e áudio

- **YouTube em inglês** · [Série oficial de preparação AI-200, do Microsoft Learn](https://aka.ms/AI200-ExamPrep). São quatro episódios para localizar os tópicos que merecem mais prática, um por área do exame.
- **Vídeo em português** · [Azure Container Apps: visão geral e primeiros passos, do Microsoft Reactor](https://developer.microsoft.com/pt-br/reactor/events/16526/). Use para visualizar ambiente, aplicativo e implantação antes do exercício de contêineres.
- **Vídeo em inglês** · [O que esperar de um exame Microsoft](https://learn.microsoft.com/en-us/shows/exam-readiness-zone/what-to-expect-on-your-microsoft-exam). Veja como funcionam a navegação e os tipos de questão antes de abrir o sandbox.
- **Podcast em inglês** · The Azure Podcast sobre Container Apps ([áudio](https://azpodcast.blob.core.windows.net/episodes/Episode513.mp3) ou [YouTube](https://www.youtube.com/watch?v=nuxBz8O05LU)), [Functions Flex Consumption](https://www.azpodcast.com/post/Episode-509-Azure-Functions-Flex-Consumption/) e [Key Vault](https://www.azpodcast.com/post/Episode-487-Tales-from-the-field-with-Azure-Key-Vault/). Escolha um episódio para ouvir depois da leitura e confirme comandos e limites na documentação atual.

## Contêineres no Azure

**Saiba demonstrar.** Publique uma imagem, implante uma revisão, diferencie falha de pull de erro de ingress e explique por qual sinal um worker volta de zero réplicas.

- [Microsoft Learn · visão geral de Container Apps (PT-BR)](https://learn.microsoft.com/pt-br/azure/container-apps/overview) e [regras de escala](https://learn.microsoft.com/pt-br/azure/container-apps/scale-app).
- [Laboratório · ACR Tasks](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/container-hosting/01-acr-tasks.html), [implantação com identidade](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/azure-container-apps/01-aca-deploy-containers.html) e [manifestos no AKS](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/azure-kubernetes-service/01-aks-deploy-container.html).

## Dados para IA

**Saiba demonstrar.** Execute uma consulta parametrizada por cliente, compare busca vetorial com e sem filtro e explique como custo, recall e tempo de resposta influenciam a escolha do índice.

- [Microsoft Learn · busca vetorial no Cosmos DB (PT-BR)](https://learn.microsoft.com/pt-br/azure/cosmos-db/vector-search) e [Change Feed](https://learn.microsoft.com/pt-br/azure/cosmos-db/change-feed).
- [Laboratório · busca em Cosmos DB](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/cosmosdb/02-build-semantic-search.html), [pgvector em PostgreSQL](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/azure-database-postgresql/02-implement-vector-search.html) e [busca semântica no Redis](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/azure-managed-redis/03-amr-vector-storage.html).

## Integração com serviços

**Saiba demonstrar.** Use um trigger HTTP para enfileirar trabalho, verifique o destino da mensagem e mostre o que acontece quando o consumidor falha antes da confirmação.

- [Microsoft Learn · referência Python de Azure Functions (PT-BR)](https://learn.microsoft.com/pt-br/azure/azure-functions/functions-reference-python) e [confirmação e bloqueios no Service Bus](https://learn.microsoft.com/pt-br/azure/service-bus-messaging/message-transfers-locks-settlement).
- [Laboratório · criar uma função HTTP](https://learn.microsoft.com/pt-br/azure/azure-functions/create-first-function-vs-code-python), [processar mensagens com Service Bus](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/integrate-services/01-svcbus-process-messages.html) e [publicar eventos com Event Grid](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/integrate-services/02-eventgrid-publish-receive-events.html).

## Segurança, monitoramento e diagnóstico

**Saiba demonstrar.** Recupere um segredo com a identidade certa, altere uma configuração sem publicar outra imagem e use um trace ou consulta KQL para localizar uma falha.

- [Microsoft Learn · instrumentar com OpenTelemetry (PT-BR)](https://learn.microsoft.com/pt-br/azure/azure-monitor/app/opentelemetry-enable) e [referência de KQL](https://learn.microsoft.com/pt-br/kusto/query/?view=azure-monitor).
- [Laboratório · Key Vault](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/app-sec-config/01-aks-retrieve-secrets.html), [App Configuration](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/app-sec-config/02-exercise-retrieve-settings.html), [OpenTelemetry](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/instrument-observe/01-instrument-app-opentelemetry.html) e [KQL](https://microsoftlearning.github.io/mslearn-azure-ai/instructions/instrument-observe/02-query-logs-kql.html).

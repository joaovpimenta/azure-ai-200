# Capítulo 07: Integração de Back-end: Mensagens, Eventos e Functions

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Conectar%20e%20consumir%20servi%C3%A7os%20do%20Azure-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Completo-brightgreen?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

A orquestração de soluções complexas de Inteligência Artificial demanda o desacoplamento assíncrono entre a camada de interface (chatbots, aplicações web, dispositivos móveis) e os serviços de processamento pesado de back-end (geração de embeddings, moderação de conteúdo, extração de texto em PDFs, transcrição de áudio e chamada a modelos de linguagem).

O **Capítulo 07** abrange os três blocos construtivos fundamentais de integração assíncrona no Azure:
1. **Azure Service Bus**: Mensageria empresarial com garantias transacionais estritas, ordenação FIFO (First-In-First-Out) via **Message Sessions**, roteamento publicador/assinante com tópicos e assinaturas dotadas de filtros SQL e correlação, e tratamento robusto de mensagens venenosas através de filas de mensagens mortas (**Dead-Letter Queue - DLQ**).
2. **Azure Event Grid**: Barramento de eventos pub/sub reativo e serverless de altíssima escala (milhões de eventos por segundo) com entrega push-to-webhook, roteamento baseado em filtros avançados de schema CloudEvents/EventGridEvent e políticas configuráveis de retentativa com expiração e dead-letter para Azure Blob Storage.
3. **Azure Functions**: Plataforma serverless de computação orientada a eventos para executar microsserviços de IA sob demanda. Permite conectar fontes de dados sem código boiler-plate através do modelo declarativo de **Triggers**, **Input Bindings** e **Output Bindings** (suportando Cosmos DB, Service Bus, Blob Storage), hospedados em planos modernos como o **Flex Consumption**, que combina escalabilidade ultra-rápida baseada em instâncias com integração nativa de rede virtual (VNet).

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Enfileirar e processar operações assíncronas de back-end com o **Azure Service Bus**: gerenciamento de filas, tópicos, assinaturas, filtros SQL/correlação, modo *peek-lock* e tratamento de mensagens em dead-letter.
- Implementar fluxos reativos orientados a eventos com o **Azure Event Grid**: criação de tópicos personalizados, filtros de eventos, tratamento de retentativas e configuração de dead-lettering.
- Desenvolver e implantar **Azure Functions**: criação de APIs serverless implementando triggers e bindings de entrada/saída em Python e C#, e configuração de planos de hospedagem com foco em performance e rede.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `service-bus-filas-topicos-assinaturas` | Service Bus: filas, tópicos, assinaturas e filtros | `messaging-eventing` | Implementado | [Acessar Conceito](./service-bus-filas-topicos-assinaturas.md) |
| 2 | `service-bus-dead-letter-e-processamento` | Peek-lock, dead-letter queue, sessões e retentativas | `messaging-eventing` | Implementado | [Acessar Conceito](./service-bus-dead-letter-e-processamento.md) |
| 3 | `event-grid-eventos-filtros-retentativas` | Event Grid: tópicos, eventos personalizados, filtros e retry/dead-letter | `messaging-eventing` | Implementado | [Acessar Conceito](./event-grid-eventos-filtros-retentativas.md) |
| 4 | `functions-triggers-e-bindings` | Functions: triggers, bindings e modelo de programação | `azure-functions` | Implementado | [Acessar Conceito](./functions-triggers-e-bindings.md) |
| 5 | `functions-configuracao-e-implantacao` | Planos de hospedagem, configuração e implantação de function apps | `azure-functions` | Implementado | [Acessar Conceito](./functions-configuracao-e-implantacao.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Service Bus: Modos de Recebimento `ReceiveAndDelete` vs `PeekLock`**:
  - `ReceiveAndDelete`: A mensagem é deletada do Service Bus no instante em que o consumidor a lê. Se o consumidor falhar durante o processamento de inferência de IA, a mensagem é perdida irreversivelmente.
  - `PeekLock` (Padrão e Recomendado): O Service Bus bloqueia a mensagem por um período (`LockDuration`). Se a função processar com sucesso, chama `CompleteAsync()`. Se falhar, chama `AbandonAsync()` para que outro consumidor tente novamente, ou `DeadLetterAsync()` se a mensagem for considerada irrecuperável.
- **Message Sessions para Ordenação Estrita**: Se for mandatário processar mensagens de um mesmo usuário ou documento na ordem exata de envio (ex.: fragmentos de áudio contínuo ou transações de diálogo de chatbot), habilite **Sessions** na fila/tópico e defina a propriedade `SessionId`. O Service Bus garante que um consumidor bloqueie e processe todos os eventos daquela sessão sequencialmente.
- **Event Grid vs Service Bus**:
  - Use **Service Bus** para *Mensagens* que transportam um comando ou intenção que precisa ser processado com garantias transacionais e controle de duplicatas.
  - Use **Event Grid** para *Eventos* que notificam que algo aconteceu no sistema (ex.: `Microsoft.Storage.BlobCreated`), disparando reações reativas serverless sem acoplamento.
- **Triggers vs Bindings no Azure Functions**:
  - Um Function App pode ter apenas **um único Trigger** por função (o gatilho que inicia a execução).
  - Pode ter **múltiplos Input Bindings** (que carregam dados adicionais automaticamente, ex.: documento do Cosmos DB) e **múltiplos Output Bindings** (que gravam o resultado do processamento em filas ou tabelas sem instanciar clientes SDK manualmente).
- **Plano Flex Consumption**: Nova geração de hospedagem serverless para Azure Functions, com suporte a injeção em rede virtual privada (VNet), escala dinâmica orientada a instâncias e ausência de cobrança quando a aplicação está ociosa.

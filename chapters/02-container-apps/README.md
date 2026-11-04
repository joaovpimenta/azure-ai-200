# Capítulo 02: Azure Container Apps (ACA)

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Desenvolver%20solu%C3%A7%C3%B5es%20em%20cont%C3%AAineres%20no%20Azure-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Completo-brightgreen?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

O **Azure Container Apps (ACA)** é a plataforma serverless de contêineres preferencial da Microsoft para microsserviços modernos e arquiteturas de Inteligência Artificial. Construído sobre o Kubernetes e tecnologias de código aberto como KEDA (Kubernetes Event-driven Autoscaling), Dapr (Distributed Application Runtime) e Envoy Proxy, o ACA abstrai a complexidade do plano de controle do Kubernetes, permitindo que desenvolvedores de IA foquem na lógica de negócio e no ciclo de vida dos modelos.

No escopo do exame **AI-200**, o ACA desempenha funções de alto impacto:
1. **Ambientes Gerenciados e Isolamento de Rede**: Agrupamento lógico de contêineres que compartilham a mesma rede virtual (VNet), configuração de Log Analytics e limites de segurança.
2. **Ciclo de Vida de Revisões e Divisão de Tráfego**: Suporte a múltiplos modos de revisão (`single` vs `multiple`) para implantações *blue-green*, canary releases e testes A/B entre versões de modelos de linguagem e prompts.
3. **Autenticação em Registros Privados e Gestão Segura de Segredos**: Integração com Azure Container Registry (ACR) usando Identidade Gerenciada sem credenciais estáticas, além do mapeamento seguro de segredos em nível de aplicação.
4. **Escala Baseada em Eventos com KEDA (*Scale-to-Zero*)**: Capacidade de escalar instâncias de 0 até centenas de réplicas com base na profundidade de filas do Azure Service Bus, fluxo de mensagens do Event Hub ou requisições HTTP simultâneas, otimizando custos em cargas de inferência intermitentes.
5. **Sessões Dinâmicas (Dynamic Sessions / AI Code Interpreter)**: Ambientes de execução *sandbox* efêmeros e hiper-isolados baseados em microVMs Hyper-V, projetados especificamente para permitir que agentes de IA executem código Python não confiável gerado dinamicamente em tempo de execução com total segurança contra ataques de escape de contêiner.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Implantar aplicações no Azure Container Apps, incluindo configuração de ambientes gerenciados e controle declarativo via manifestos YAML e Azure CLI.
- Gerenciar revisões ativas e configurar regras avançadas de divisão e migração de tráfego de entrada (*traffic splitting*).
- Configurar autenticação para registros privados (ACR) e injetar segredos com segurança em contêineres e variáveis de ambiente.
- Implementar escala orientada a eventos usando escaladores KEDA no Container Apps (incluindo escala até zero réplicas).
- Configurar e consumir **Sessões Dinâmicas** para execução de código gerado por agentes de IA e análise de dados em ambientes isolados.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `aca-ambientes-e-implantacao` | Ambientes e implantação no Container Apps (CLI e YAML) | `container-orchestration` | Implementado | [Acessar Conceito](./aca-ambientes-e-implantacao.md) |
| 2 | `aca-revisoes-e-trafego` | Revisões, modos de revisão e divisão de tráfego | `container-orchestration` | Implementado | [Acessar Conceito](./aca-revisoes-e-trafego.md) |
| 3 | `aca-segredos-e-registro-privado` | Segredos, variáveis de ambiente e autenticação em registro privado | `container-orchestration`, `secure-solutions` | Implementado | [Acessar Conceito](./aca-segredos-e-registro-privado.md) |
| 4 | `aca-escala-keda` | Regras de escala HTTP, TCP e KEDA (scale to zero) | `container-orchestration` | Implementado | [Acessar Conceito](./aca-escala-keda.md) |
| 5 | `aca-sessoes-dinamicas` | Sessões dinâmicas para executar código gerado por IA | `container-orchestration` | Implementado | [Acessar Conceito](./aca-sessoes-dinamicas.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Modos de Revisão (`single` vs `multiple`)**: No modo `single`, a revisão anterior continua atendendo até a nova estar pronta; então a plataforma transfere o tráfego e desativa a anterior. No modo `multiple`, várias revisões permanecem ativas simultaneamente, permitindo atribuir porcentagens específicas de tráfego (ex.: 80% para a revisão estável e 20% para a revisão candidata de um novo modelo de IA) ou usar revisões nomeadas para validação interna.
- **KEDA Scale-to-Zero e Min/Max Replicas**: Se a regra de escala tiver `minReplicas: 0`, a aplicação escala até zero réplicas quando não houver carga. O benefício é reduzir o consumo de computação ociosa; outros recursos podem continuar gerando cobrança. A desvantagem é o *cold start* na primeira requisição. Para APIs voltadas ao usuário final com SLA estrito de latência, configure um piso de réplicas adequado e meça a latência de inicialização.
- **Puxar Imagens do ACR sem Senha de Administrador**: Nunca habilite a conta de administrador no ACR para produção. Em vez disso, configure uma **Identidade Gerenciada** no Container App, atribua o papel `AcrPull` no ACR e configure o manifesto YAML do ACA apontando `identity: <managed-identity-id>` dentro do bloco `registries`.
- **Sessões Dinâmicas vs Contêiner Convencional**: Sessões Dinâmicas (Dynamic Sessions) NÃO são contêineres convencionais de longa duração. Elas são alocadas dinamicamente via API REST ou SDK para executar scripts Python de agentes LLM em um ambiente descartável com limite de tempo e memória, devendo combinar isolamento por sessão, controle de saída de rede e restrição dos dados e credenciais disponibilizados.

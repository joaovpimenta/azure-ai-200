# Capítulo 03: Azure Kubernetes Service (AKS)

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Desenvolver%20solu%C3%A7%C3%B5es%20em%20cont%C3%AAineres%20no%20Azure-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Planejado-orange?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

O **Azure Kubernetes Service (AKS)** é o orquestrador corporativo gerenciado de contêineres do Azure, projetado para suportar cargas de trabalho complexas, distribuídas e com requisitos avançados de infraestrutura, incluindo nós acelerados por GPU para treinamento e inferência pesada de modelos de IA, controle granular de rede (CNI) e políticas de segurança em nível de Pod.

No exame **AI-200**, o candidato é avaliado em competências práticas de desenvolvedor de aplicações em contêiner no ecossistema Kubernetes e na resolução determinística de falhas em tempo de execução:
1. **Modelagem Declarativa com Manifestos YAML**: Criação e aplicação de recursos nativos do Kubernetes (`Deployment`, `Service`, `ConfigMap`, `Secret`) para gerenciar réplicas de microsserviços de IA, injeção de configurações e isolamento de credenciais.
2. **Topologia de Rede, Services e Controladores de Ingress**: Mapeamento de portas e protocolos através de Services (`ClusterIP`, `NodePort`, `LoadBalancer`) e exposição de rotas HTTP/HTTPS externas por meio de controladores de Ingress (como Application Gateway Ingress Controller - AGIC ou NGINX Ingress Controller), viabilizando roteamento por caminho (`/api/v1/infer`) e terminação TLS.
3. **Diagnóstico e Solução de Problemas (Troubleshooting)**: Técnicas de inspeção profunda de falhas no AKS e no Azure Container Apps usando ferramentas CLI (`kubectl describe`, `kubectl logs`, `kubectl get events`) e análise de fluxos de telemetria no Azure Monitor e Log Analytics para resolver erros clássicos como `CrashLoopBackOff`, `ImagePullBackOff`, `OOMKilled` e falhas de sondas de liveness/readiness.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Implantar e gerenciar aplicações no AKS utilizando arquivos de manifesto declarativos (Deployments, Services, ConfigMaps e Secrets).
- Configurar conectividade e exposição de serviços no AKS através de Services e recursos de Ingress.
- Monitorar e solucionar problemas de execução no AKS e no Container Apps inspecionando logs de contêineres, eventos do cluster e conectividade de rede ponta a ponta.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `aks-manifestos-deployments` | Manifestos Kubernetes: Deployment, Service, ConfigMap e Secret | `container-orchestration` | Planejado | [Acessar Conceito](./aks-manifestos-deployments.md) |
| 2 | `aks-rede-services-ingress` | Services, Ingress e conectividade ponta a ponta | `container-orchestration` | Planejado | [Acessar Conceito](./aks-rede-services-ingress.md) |
| 3 | `aks-aca-troubleshooting-logs-eventos` | Troubleshooting: kubectl logs/describe/events e logs do Container Apps | `container-orchestration`, `monitor-troubleshoot` | Planejado | [Acessar Conceito](./aks-aca-troubleshooting-logs-eventos.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Diagnóstico Sequencial de Erros de Pods**:
  1. Primeiro execute `kubectl get pods`: se o status for `ImagePullBackOff`, verifique permissões no ACR ou erro de digitação na tag da imagem.
  2. Se o status for `CrashLoopBackOff`, a imagem foi baixada com sucesso, mas o processo interno falhou logo após a inicialização. Execute imediatamente `kubectl logs <pod-name> --previous` para ver o erro que causou a saída do processo.
  3. Se o pod estiver em estado `Pending`, execute `kubectl describe pod <pod-name>` e inspecione a seção `Events`: tipicamente indicará falta de CPU/memória no nó (`Insufficient cpu/memory`) ou restrições de afinidade/tolerations não atendidas.
- **Tipos de Service no Kubernetes**:
  - `ClusterIP` (Padrão): Exposição estritamente interna no cluster. Ideal para serviços de apoio (bancos vetoriais internos, orquestradores privados de agentes).
  - `NodePort`: Expõe a porta em cada nó do cluster em uma faixa alta (30000-32767). Raramente usado isoladamente em produção.
  - `LoadBalancer`: Cria um Azure Standard Load Balancer com IP público ou privado dedicado para o serviço.
  - `Ingress`: Camada 7 (HTTP/HTTPS) que unifica o roteamento de múltiplos Services através de regras baseadas em host (`api.contoso.com`) e caminho de URL (`/v1/chat`), suportando terminação SSL.
- **Diferença entre Liveness Probe e Readiness Probe**:
  - *Liveness Probe*: Verifica se a aplicação ainda está viva. Se falhar repetidamente, o kubelet reinicia o contêiner.
  - *Readiness Probe*: Verifica se o contêiner está pronto para receber tráfego de rede (ex.: modelo de IA já foi carregado na memória GPU/RAM). Se falhar, o Pod NÃO é reiniciado; ele é apenas removido dos endpoints do Service até que a sonda volte a ter sucesso.

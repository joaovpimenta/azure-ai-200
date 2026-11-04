---
title: "Troubleshooting: kubectl logs/describe/events e logs do Container Apps"
slug: aks-aca-troubleshooting-logs-eventos
chapter: 03-aks
exam_domain: containerized-solutions
tags:
  - aks
  - kubectl
  - pod-logs
  - k8s-events
  - container-apps
  - troubleshooting
difficulty: intermediate
tldr: Logs explicam o processo; eventos e estado explicam scheduling, pull, probes e reinícios.
  Compare a revisão ou rollout com a última versão saudável e teste conectividade de dentro da
  carga.
related_links:
  - label: Diagnóstico básico de AKS
    url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/welcome-azure-kubernetes
    type: learn
  - label: Logs no Container Apps
    url: https://learn.microsoft.com/en-us/azure/container-apps/log-monitoring
    type: learn
questions:
  - id: q-aks-aca-troubleshooting-logs-eventos-01
    type: single-choice
    title: "Troubleshooting: kubectl logs/describe/events e logs do Container Apps"
    exam_domain: containerized-solutions
    stem: Um Pod reinicia continuamente e os logs atuais não mostram a falha anterior. Qual comando
      ajuda a recuperar essa evidência?
    options:
      - id: opt-3
        text: Excluir o Deployment antes de coletar dados.
        correct: false
        rationale: Excluir recursos pode remover evidências e não explica a falha.
        learn_url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/welcome-azure-kubernetes
      - id: opt-4
        text: Aumentar réplicas imediatamente.
        correct: false
        rationale: Todas podem repetir o mesmo defeito de inicialização.
        learn_url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/welcome-azure-kubernetes
      - id: opt-1
        text: kubectl logs POD -c CONTAINER --previous no namespace correto.
        correct: true
        rationale: O comando consulta logs da instância anterior do contêiner, quando disponíveis.
        learn_url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/welcome-azure-kubernetes
      - id: opt-2
        text: kubectl get namespaces como única investigação.
        correct: false
        rationale: A listagem não mostra a exceção da execução anterior.
        learn_url: https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/welcome-azure-kubernetes
    tags:
      - aks
      - kubectl
      - pod-logs
      - k8s-events
      - container-apps
      - troubleshooting
---

# Troubleshooting: kubectl logs/describe/events e logs do Container Apps

Após publicar uma imagem, a API deixa de responder. Antes de aumentar réplicas, determine se a falha ocorre no provisionamento, no processo ou no caminho da requisição. Logs de aplicação sozinhos não mostram todos os problemas da plataforma.

## Sequência de investigação no AKS

Comece com contexto, namespace, rollout e estado dos Pods. Escolha o Pod e o contêiner afetados; os nomes abaixo são ilustrativos.

```bash
kubectl config current-context
kubectl get deployments,pods -n ai200 -o wide
kubectl rollout status deployment/api -n ai200
kubectl describe pod api-pod -n ai200
kubectl get events -n ai200 --sort-by=.metadata.creationTimestamp
kubectl logs api-pod -n ai200 -c api --tail=100
kubectl logs api-pod -n ai200 -c api --previous --tail=100
kubectl get svc,endpointslices -n ai200
```

`--previous` recupera logs da instância anterior do contêiner, quando disponíveis. Eventos são transitórios; exporte observações relevantes e não trate a listagem atual como histórico permanente.

| Sintoma | Evidência prioritária | Hipótese a testar |
|---|---|---|
| `Pending` | Events e requests | Capacidade, quota, afinidade ou volume |
| `ImagePullBackOff` | Events e referência da imagem | Tag inexistente, autorização ACR ou rede |
| `CrashLoopBackOff` | Logs anteriores e exit code | Startup inválido ou exceção |
| `OOMKilled` | Estado anterior e memória | Limite insuficiente ou vazamento |
| Pod Ready, API inacessível | Service, endpoints e Ingress | Labels, porta, DNS ou política |

Não reinicie antes de coletar evidências: isso pode apagar o estado útil e apenas mascarar o problema temporariamente.

## Logs no Container Apps

Separe logs do sistema de logs do console. Use o nome real da revisão e do contêiner quando houver várias opções.

```bash
az containerapp revision list --name api-ai200 --resource-group rg-ai200 -o table
az containerapp logs show --name api-ai200 --resource-group rg-ai200 \
  --type system --tail 50
az containerapp logs show --name api-ai200 --resource-group rg-ai200 \
  --type console --tail 100
```

Logs de sistema ajudam a explicar provisionamento, pull e escala; logs de console mostram stdout/stderr. Compare a configuração da revisão com a versão saudável: imagem, variáveis, secrets, probes e regras de escala.

## Conectividade e mitigação

Teste DNS, porta e TLS a partir da workload. Diferencie timeout de rede, 401 de autenticação, 403 de autorização e 429 de throttling. Um endpoint acessível do notebook não comprova acesso pela rede do cluster.

<details>
<summary>Checagem Rápida: CrashLoopBackOff identifica a causa raiz?</summary>

Não. É o recuo entre reinícios repetidos. Logs, estado de término e eventos explicam por que o contêiner está encerrando.

</details>

Se a regressão coincide com um deploy, mitigue com rollback ou redirecionamento de tráfego enquanto preserva as evidências. Depois valide pelo caminho real do usuário e acompanhe erros e latência.

## Pegadinhas de Prova

- **Pegadinha 1: Mais réplicas corrigem imagem inválida**: Todas falharão ao baixar ou iniciar a mesma imagem.
- **Pegadinha 2: Só há um contêiner por Pod**: Selecione `-c` para examinar o processo correto.
- **Pegadinha 3: Logs de console mostram tudo**: Falhas anteriores à inicialização aparecem principalmente nos eventos e logs de plataforma.

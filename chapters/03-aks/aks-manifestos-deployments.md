---
title: "Manifestos Kubernetes: Deployment, Service, ConfigMap e Secret"
slug: aks-manifestos-deployments
chapter: 03-aks
exam_domain: containerized-solutions
tags:
  - aks
  - kubernetes
  - deployments
  - services
  - configmaps
  - secrets-k8s
  - yaml
difficulty: intermediate
tldr: Deployment mantém réplicas por meio de ReplicaSets; Service seleciona Pods por labels.
  ConfigMap guarda configuração não sensível e Secret exige proteção adicional, pois base64 não é
  criptografia.
related_links:
  - label: Deployments no AKS
    url: https://learn.microsoft.com/en-us/azure/aks/core-aks-concepts
    type: learn
  - label: Configuração de aplicações no AKS
    url: https://learn.microsoft.com/en-us/azure/aks/concepts-security
    type: learn
questions:
  - id: q-aks-manifestos-deployments-01
    type: single-choice
    title: "Manifestos Kubernetes: Deployment, Service, ConfigMap e Secret"
    exam_domain: containerized-solutions
    stem: Pods estão Ready, mas um Service não tem endpoints. Qual verificação é prioritária?
    options:
      - id: opt-1
        text: Comparar selector do Service, labels dos Pods e namespace.
        correct: true
        rationale: O Service encontra backends por seleção de labels no namespace correspondente.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/core-aks-concepts
      - id: opt-2
        text: Mudar o nome da imagem para latest.
        correct: false
        rationale: Isso não corrige a seleção dos Pods pelo Service.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/core-aks-concepts
      - id: opt-3
        text: Codificar a configuração do Service em base64.
        correct: false
        rationale: Base64 não modifica a relação entre Service e backends.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/core-aks-concepts
      - id: opt-4
        text: Aumentar somente o timeout do Ingress.
        correct: false
        rationale: Esperar mais não cria endpoints ausentes.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/core-aks-concepts
    tags:
      - aks
      - kubernetes
      - deployments
      - services
      - configmaps
      - secrets-k8s
      - yaml
---

# Manifestos Kubernetes: Deployment, Service, ConfigMap e Secret

No AKS, manifestos descrevem o estado desejado. Um controlador reconcilia esse estado com o cluster: se um Pod de inferência falha, o Deployment providencia substituição. Dados duráveis e trabalhos em andamento precisam de mecanismos próprios de recuperação.

## Recursos e responsabilidades

| Recurso | Responsabilidade | Erro comum |
|---|---|---|
| Deployment | Réplicas, rollout e template de Pods | Editar o Pod gerado manualmente |
| Service | Endpoint estável e seleção de backends | Selector não corresponde às labels |
| ConfigMap | Configuração não sensível | Esperar reinício automático por alteração |
| Secret | Valores sensíveis consumidos por Pods | Tratar base64 como criptografia |

O ==selector== do Deployment deve corresponder às labels do template. O Service também precisa selecionar essas labels; nomes semelhantes não criam o vínculo. Readiness controla a participação nos endpoints; liveness reinicia um contêiner que deixou de funcionar. Para inicialização lenta de modelos, avalie uma startup probe.

## Manifesto mínimo verificável

Salve como `api.yaml`, com contexto de um cluster de laboratório selecionado. A imagem pública é apenas uma demonstração HTTP; substitua por sua API e probes compatíveis. O namespace `ai200` deve existir.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
  namespace: ai200
data:
  LOG_LEVEL: Information
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: ai200
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: mcr.microsoft.com/azuredocs/aks-helloworld:v1
          ports:
            - containerPort: 80
          envFrom:
            - configMapRef:
                name: api-config
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /
              port: 80
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: ai200
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

```bash
kubectl create namespace ai200
kubectl apply --dry-run=server -f api.yaml
kubectl apply -f api.yaml
kubectl rollout status deployment/api -n ai200
kubectl get pods,svc,endpointslices -n ai200
```

Use `secretKeyRef` ou volume para consumir um Secret já provisionado de forma segura. Para Key Vault, considere o Secrets Store CSI Driver e identidade da workload. Não versione secrets em texto ou base64. Variáveis de ambiente são capturadas ao iniciar o processo; atualizar um ConfigMap não altera o ambiente de Pods existentes.

<details>
<summary>Checagem Rápida: containerPort expõe a aplicação para a internet?</summary>

Não. Ele descreve a porta do contêiner. Service, Ingress, balanceadores e políticas de rede determinam o caminho de acesso.

</details>

## Pegadinhas de Prova

- **Pegadinha 1: Secret criptografa o manifesto**: Base64 é codificação reversível; proteja armazenamento, RBAC e entrega.
- **Pegadinha 2: Pod Running significa Ready**: O processo pode estar ativo sem conseguir receber tráfego.
- **Pegadinha 3: Requests são limites**: Requests orientam scheduling; limits restringem consumo. Limite de memória pode resultar em OOMKilled.

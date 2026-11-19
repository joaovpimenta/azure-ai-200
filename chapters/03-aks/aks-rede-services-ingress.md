---
title: Services, Ingress e conectividade ponta a ponta
slug: aks-rede-services-ingress
chapter: 03-aks
exam_domain: containerized-solutions
tags:
  - aks
  - services
  - ingress
  - kubernetes
  - architecture
difficulty: intermediate
tldr: Service dá acesso estável aos Pods. Ingress define rotas HTTP/HTTPS e
  precisa de um controlador. Confira DNS, portas, labels e prontidão dos Pods ao
  investigar falhas.
related_links:
  - label: Rede de aplicações no AKS
    url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
    type: learn
questions:
  - id: q-aks-rede-services-ingress-01
    type: single-choice
    title: Services, Ingress e conectividade ponta a ponta
    exam_domain: containerized-solutions
    stem: Um manifesto Ingress foi aplicado em um cluster sem controller compatível.
      Qual afirmação é correta?
    options:
      - id: opt-2
        text: O objeto cria automaticamente um proxy em todo cluster.
        correct: false
        rationale: Não há essa garantia sem controller e configuração apropriados.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
      - id: opt-3
        text: containerPort no Deployment substitui o controller.
        correct: false
        rationale: containerPort não implementa roteamento HTTP externo.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
      - id: opt-4
        text: Um ConfigMap sempre provisiona o balanceador.
        correct: false
        rationale: Um ConfigMap armazena configuração e não cria infraestrutura por si só.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
      - id: opt-1
        text: É necessário um controller que implemente a classe e as regras do Ingress.
        correct: true
        rationale: O objeto é declarativo; o controller fornece o comportamento de
          roteamento.
        learn_url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
    tags:
      - aks
      - services
      - ingress
      - kubernetes
      - architecture
    learn_url: https://learn.microsoft.com/en-us/azure/aks/concepts-network-services
---

# Services, Ingress e conectividade ponta a ponta

Seu navegador chama `api.exemplo.com/chat`. Como a chamada encontra um Pod se ele pode receber outro IP a qualquer momento? No AKS, o Ingress define a rota HTTP por domínio e caminho, e o Service encontra os Pods que podem atender. Um controlador precisa aplicar as regras de entrada.

## Service e Ingress

| Recurso ou tipo | Alcance e função | Uso |
|---|---|---|
| `ClusterIP` | IP estável interno ao cluster | Comunicação entre microsserviços |
| `NodePort` | Porta nos nós | Integrações específicas de infraestrutura |
| `LoadBalancer` | Balanceador provisionado pela integração Azure | Exposição direta; pode ser interno |
| Ingress | Regras HTTP/HTTPS por host e caminho | Compartilhar entrada e terminar TLS |

Um ==Ingress controller== implementa as regras. Criar apenas o objeto Ingress sem controller compatível não estabelece o proxy. Selecione um controller com suporte vigente e uma `IngressClass` existente; não presuma que todos os clusters trazem o mesmo controller instalado.

```mermaid
flowchart LR
    Cliente --> DNS
    DNS --> Entrada[Balanceador e controller]
    Entrada --> Service[Service ClusterIP]
    Service --> Pod[Pod Ready]
    Pod --> Modelo[Endpoint de IA]
```

## Manifesto de rota

O exemplo pressupõe Service `api` na porta 80, controller instalado e classe `minha-classe` configurada. Substitua host, classe e Secret TLS por recursos reais.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: ai200
spec:
  ingressClassName: minha-classe
  tls:
    - hosts:
        - api.exemplo.com
      secretName: api-tls
  rules:
    - host: api.exemplo.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

A porta referenciada é a `port` do Service, que encaminha para `targetPort` do Pod. O selector identifica endpoints prontos. DNS interno normalmente permite acessar `api.ai200.svc.cluster.local` de outros namespaces, respeitadas as políticas.

## Diagnóstico por salto

Comece pelo nome público e pelo certificado. Examine o status do Ingress e os logs do controller, depois o Service e os EndpointSlices. Se você tem o Pod em mãos, `kubectl port-forward` permite testar sua resposta direto, sem passar pelo Ingress. Se só o acesso direto funciona, use o diagrama para procurar o primeiro salto com falha. Faça a verificação final pelo endereço do cliente.

<details>
<summary>Checagem Rápida: Um Service sem endpoints é corrigido aumentando o timeout do Ingress?</summary>

Não. Confira labels, namespace, readiness e `targetPort`. Um proxy não consegue encaminhar para um conjunto vazio de backends.

</details>

## Pegadinhas de Prova

- **LoadBalancer sempre é público**: A configuração pode solicitar balanceador interno.
- **Ingress equivale a controller**: O objeto contém regras; o controller as implementa.
- **Entrada saudável garante saída**: O Pod pode atender HTTP e ainda falhar ao resolver ou acessar o endpoint do modelo.

# Capítulo 01: Hospedagem de Aplicações em Contêiner

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Desenvolver%20solu%C3%A7%C3%B5es%20em%20cont%C3%AAineres%20no%20Azure-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Completo-brightgreen?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

No ecossistema de soluções de IA no Azure, o empacotamento de modelos, APIs de orquestração e agentes autônomos em **contêineres OCI/Docker** constitui a camada fundamental de entrega de software. O **Capítulo 01** cobre a infraestrutura básica de governança de imagens e execução simplificada de contêineres web no Azure:

1. **Azure Container Registry (ACR)**: Atua como repositório central privado de modelos e imagens Docker corporativas, garantindo controle de acesso baseado em função (RBAC), controle de concorrência, replicação geográfica (Geo-replication nos tiers Premium) e retenção de tags imutáveis para rastreabilidade de modelos de machine learning.
2. **ACR Tasks**: Motor de automação e compilação em nuvem de contêineres sem necessidade de instalar o daemon local do Docker. Permite compilar imagens rapidamente (`az acr build`), acionar builds automáticos em resposta a atualizações de código no Git ou patches em imagens base do sistema operacional, além de orquestrar pipelines de múltiplas etapas (*multi-step tasks*).
3. **Azure App Service para Contêineres (Linux Web Apps)**: Plataforma de hospedagem gerenciada (PaaS) para expor APIs de inferência de IA ou interfaces web. Foca no mapeamento correto de portas (`WEBSITES_PORT`), comandos customizados de inicialização (*Startup Command*), injeção segura de segredos via referências nativas ao Azure Key Vault (`@Microsoft.KeyVault(...)`) e identidade gerenciada.

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Criar, armazenar, versionar e gerenciar imagens de contêiner com o **Azure Container Registry**.
- Criar e executar imagens de contêiner de forma automatizada na nuvem com **ACR Tasks**.
- Implantar e configurar contêineres customizados no **Azure App Service**, configurando variáveis de ambiente, portas de escuta e segredos protegidos.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `acr-registro-imagens-versionamento` | Azure Container Registry: registro, repositórios, tags e versionamento | `container-hosting` | Implementado | [Acessar Conceito](./acr-registro-imagens-versionamento.md) |
| 2 | `acr-tasks-build-na-nuvem` | ACR Tasks: builds rápidos, multi-step e gatilhos | `container-hosting` | Implementado | [Acessar Conceito](./acr-tasks-build-na-nuvem.md) |
| 3 | `app-service-conteineres-configuracao` | Contêineres no App Service: porta, startup, app settings e Key Vault references | `container-hosting`, `secure-solutions` | Implementado | [Acessar Conceito](./app-service-conteineres-configuracao.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Variável `WEBSITES_PORT`**: Se o seu contêiner de API de IA (FastAPI, Flask, ASP.NET Core) escuta em uma porta diferente da 80 ou 8080 (por exemplo, porta 8000), o App Service não detectará a porta automaticamente a menos que a app setting `WEBSITES_PORT=8000` seja explicitamente configurada. Sem isso, o container falhará no health check de inicialização com erro de timeout (*container did not start within expected time*).
- **Referências ao Key Vault sem código**: No App Service, para consumir segredos do Key Vault sem importar bibliotecas cliente no código do contêiner, use a sintaxe `@Microsoft.KeyVault(SecretUri=https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>)` ou `@Microsoft.KeyVault(VaultName=...;SecretName=...)` vinculada a uma **Identidade Gerenciada** (System-Assigned ou User-Assigned) com a permissão *Key Vault Secrets User*.
- **ACR Tasks sem Docker Local**: Em cenários onde desenvolvedores ou agentes de build não possuem privilégios administrativos ou daemon Docker local, o comando `az acr build --registry <acr-name> --image <image:tag> .` envia o contexto compactado para compilação remota direta no Azure, retornando os logs de streaming em tempo real.
- **Trigger de Imagem Base**: O ACR Tasks pode monitorar automaticamente atualizações em imagens base (ex.: imagens oficiais de segurança Python ou .NET da Microsoft) e disparar novos builds automáticos para recompor as camadas do contêiner de IA.

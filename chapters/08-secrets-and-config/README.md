# Capítulo 08: Segredos e Configuração

[![Domínio do Exame](https://img.shields.io/badge/Dom%C3%ADnio-Seguran%C3%A7a%2C%20Monitoramento%20e%20Solu%C3%A7%C3%A3o%20de%20Problemas-0078D4?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Peso na Prova](https://img.shields.io/badge/Peso%20no%20Exame-20%20a%2025%25-green?style=flat-square)](../../syllabus/ai-200-blueprint.json)
[![Status da Trilha](https://img.shields.io/badge/Status-Planejado-orange?style=flat-square)](#inventário-de-conceitos)

---

## Visão Geral Arquitetural

Em soluções de Inteligência Artificial que integram serviços cognitivos, modelos de linguagem em nuvem privada, bancos de dados distribuídos e APIs corporativas, a segurança da camada de credenciais e a flexibilidade na alteração de parâmetros operacionais são requisitos não negociáveis. O armazenamento de senhas ou chaves de API estáticas no código-fonte ou em imagens de contêiner é uma grave vulnerabilidade arquitetural.

O **Capítulo 08** estabelece as práticas oficiais de segurança e governança de configurações no Azure:
1. **Identidades Gerenciadas e a Cadeia `DefaultAzureCredential`**: Eliminação de credenciais estáticas por meio de **Managed Identities** do Microsoft Entra ID (System-Assigned acoplada ao ciclo de vida do recurso vs User-Assigned reutilizável entre recursos), atribuindo papéis granulares de RBAC (Role-Based Access Control) e consumindo-as via classe unificada `DefaultAzureCredential` da biblioteca `Azure.Identity`.
2. **Azure Key Vault**: Cofre seguro centralizado com módulo de segurança de hardware (HSM) para guarda de segredos, certificados e chaves criptográficas. Mecanismos de governança e resiliência incluem controle de versões, políticas de expiração, rotação automatizada via Event Grid / Functions e proteção contra exclusão acidental através de **Soft Delete** e **Purge Protection**.
3. **Azure App Configuration**: Repositório centralizado de parâmetros dinâmicos de aplicação, viabilizando padronização de configurações entre microsserviços por meio de chaves e rótulos (*labels* para ambientes dev/staging/prod), atualização dinâmica em tempo de execução sem reinicialização de contêineres (*dynamic refresh* baseado em *sentinel key*) e controle de alternância de funcionalidades (**Feature Flags**).

---

## Habilidades Oficiais Avaliadas no Exame (Study Guide)

De acordo com o blueprint oficial do exame **AI-200**:
- Proteger segredos de soluções de IA com o **Azure Key Vault**, incluindo gerenciamento de versões, configuração de rotação automatizada e mecanismos de recuperação de desastres.
- Armazenar, versionar e recuperar configurações centralizadas com o **Azure App Configuration**, implementando atualização dinâmica e feature management.
- Implementar autenticação moderna sem credenciais (*passwordless*) usando **Identidades Gerenciadas** (System-Assigned e User-Assigned) e a biblioteca de autenticação `DefaultAzureCredential`.

---

## Inventário de Conceitos

| # | Slug | Título do Conceito | Habilidades Mapeadas | Status | Arquivo / Link |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `identidade-gerenciada-defaultazurecredential` | Managed identities, RBAC e DefaultAzureCredential | `secure-solutions` | Planejado | [Acessar Conceito](./identidade-gerenciada-defaultazurecredential.md) |
| 2 | `key-vault-segredos-rotacao` | Key Vault: segredos, versões, rotação e soft delete | `secure-solutions` | Planejado | [Acessar Conceito](./key-vault-segredos-rotacao.md) |
| 3 | `app-configuration-chaves-rotulos-feature-flags` | App Configuration: chaves, rótulos, refresh e feature flags | `secure-solutions` | Planejado | [Acessar Conceito](./app-configuration-chaves-rotulos-feature-flags.md) |

---

## Dicas de Estudo e Pontos de Alta Relevância para o Exame

- **Ordem de Resolução de `DefaultAzureCredential`**:
  - Em ambiente de desenvolvimento local, a cadeia tenta nesta sequência: variáveis de ambiente (`EnvironmentCredential`) -> Identidade de Carga de Trabalho (`WorkloadIdentityCredential`) -> Managed Identity (`ManagedIdentityCredential`) -> Azure CLI (`AzureCliCredential`) -> Azure Developer CLI -> Azure PowerShell -> Interactive Browser.
  - No ambiente de nuvem (App Service, Container Apps, AKS, VM), ela detecta automaticamente a **Managed Identity** provisionada sem qualquer alteração de código!
- **System-Assigned vs User-Assigned Managed Identity**:
  - *System-Assigned*: Vinculada 1:1 a um recurso específico do Azure. Quando o recurso é deletado, a identidade no Entra ID é automaticamente removida.
  - *User-Assigned*: Criada como recurso autônomo do Azure e pode ser atribuída a múltiplos recursos (ex.: 5 Container Apps compartilhando o mesmo conjunto de permissões no Key Vault).
- **Soft Delete e Purge Protection no Key Vault**:
  - *Soft Delete*: Quando um cofre ou segredo é deletado, ele é retido por um período configurável (padrão de 90 dias) e pode ser recuperado. O Soft Delete é obrigatório e habilitado por padrão em todos os Key Vaults.
  - *Purge Protection*: Impede que administradores ou invasores façam a exclusão definitiva imediata (*purge*) do cofre antes do término do período de retenção, garantindo proteção contra ataques de ransomware.
- **Padrão Chave Sentinela (*Sentinel Key*) no App Configuration**: Para recarregar configurações dinamicamente em tempo de execução sem fazer polling em dezenas de chaves individuais (o que esgotaria a cota de requisições do serviço), configure a aplicação para monitorar apenas uma chave sentinela (ex.: `App:Settings:Sentinel`). Quando qualquer configuração for alterada, incremente o valor da sentinela; o middleware detecta a alteração e atualiza todas as variáveis em cache.

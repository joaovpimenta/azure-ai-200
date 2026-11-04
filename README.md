# Azure AI-200 Study Hub

Material de estudo para **Microsoft Certified: Azure AI Cloud Developer Associate (AI-200)**: 35 artigos, questões comentadas e revisão rápida em nove trilhas. Consulte o [curso e guia oficial](https://learn.microsoft.com/pt-br/training/courses/ai-200t00#study-guide) para conferir o escopo vigente.

## Comece por aqui

1. Se estiver começando, leia uma trilha por vez na ordem abaixo. Os artigos explicam o problema antes dos comandos.
2. Tente responder à checagem rápida antes de abrir a resposta. As lacunas ocultáveis ajudam a lembrar termos sem reler tudo.
3. Faça as questões no modo estudo e leia a justificativa de cada alternativa, inclusive das erradas.
4. Volte ao caderno de erros e use **Revisão rápida (Cram)** para revisar resumos e pegadinhas.

Os exemplos de SDK usam abas Python/C#. Prepare os recursos e permissões descritos antes de executar. Trechos de configuração são identificados quando não representam um projeto completo.

## Recursos do site

- Leitura com lacunas interativas, autoavaliações e exemplos de código.
- Simulado com escolha única/múltipla, código, ordenação e estudo de caso.
- Modo estudo com feedback imediato e modo cronometrado. O corte de 70% é uma regra de treino do site, não conversão da pontuação oficial.
- Progresso salvo no navegador, exportação/importação e sincronização opcional com Gist privado.
- Instalação para uso offline e leitura em áudio.
- [Comparação de bancos vetoriais](comparisons/vector-stores-azure.md).

## Estrutura de Capítulos (Trilhas AI-200T00)

| Trilha | Diretório | Domínio Oficial AI-200 | Peso no Exame |
| :--- | :--- | :--- | :--- |
| **01** | [`chapters/01-container-hosting/`](chapters/01-container-hosting/README.md) | `containerized-solutions` | 20–25% |
| **02** | [`chapters/02-container-apps/`](chapters/02-container-apps/README.md) | `containerized-solutions` | 20–25% |
| **03** | [`chapters/03-aks/`](chapters/03-aks/README.md) | `containerized-solutions` | 20–25% |
| **04** | [`chapters/04-cosmos-db-nosql/`](chapters/04-cosmos-db-nosql/README.md) | `data-management` | **25–30%** |
| **05** | [`chapters/05-postgresql-pgvector/`](chapters/05-postgresql-pgvector/README.md) | `data-management` | **25–30%** |
| **06** | [`chapters/06-managed-redis/`](chapters/06-managed-redis/README.md) | `data-management` | **25–30%** |
| **07** | [`chapters/07-backend-integration/`](chapters/07-backend-integration/README.md) | `connect-and-consume` | 20–25% |
| **08** | [`chapters/08-secrets-and-config/`](chapters/08-secrets-and-config/README.md) | `secure-monitor-troubleshoot` | 20–25% |
| **09** | [`chapters/09-observe-and-troubleshoot/`](chapters/09-observe-and-troubleshoot/README.md) | `secure-monitor-troubleshoot` | 20–25% |

### Cobertura editorial completa

Todos os **35 artigos previstos no blueprint** estão implementados nas nove trilhas: 3 de hospedagem, 5 de Container Apps, 3 de AKS, 5 de Cosmos DB, 6 de PostgreSQL, 2 de Redis, 5 de integração de back-end, 3 de segredos/configuração e 3 de observabilidade.

Cada conceito inclui resumo para revisão, autoavaliação, pegadinhas de prova, referências oficiais e uma questão formativa integrada ao simulado. Exemplos de SDK apresentam Python e C# em blocos consecutivos; tópicos de infraestrutura usam CLI, YAML, SQL ou KQL conforme a operação.

## Operação Local e Comandos

```bash
# 1. Instalar dependências
npm ci

# 2. Diagnóstico do ambiente e estrutura
npm run doctor

# 3. Validar conteúdo, links e questões
npm run validate

# 4. Compilar o site estático pré-renderizado em dist/
npm run build

# 5. Executar a suíte completa de testes automatizados
npm test

# 6. Gerar brief de autoria para um próximo conceito da ementa
npm run brief -- --chapter 02-container-apps --slug aca-escala-keda

# 7. Servir preview local em http://localhost:4173
npm run preview
```

---

## Publicação no GitHub Pages

1. Em **Settings → Pages** no repositório GitHub, selecione **Source: GitHub Actions**.
2. A cada push na branch `main`, o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) executa `npm run validate`, `npm run build` e `npm test`, publicando o diretório `dist/` automaticamente.
3. Pull Requests passam pela validação automática em [`.github/workflows/validate.yml`](.github/workflows/validate.yml).
4. Para gerar narração em áudio sob demanda, acione manualmente [`.github/workflows/kokoro-audio.yml`](.github/workflows/kokoro-audio.yml) na aba **Actions**.

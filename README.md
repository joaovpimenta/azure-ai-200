# Azure AI-200 Study Hub

Material de estudo para **Microsoft Certified: Azure AI Cloud Developer Associate (AI-200)** com 35 artigos, questões comentadas e revisão rápida. Confira o escopo vigente no [guia oficial do exame](https://learn.microsoft.com/pt-br/credentials/certifications/resources/study-guides/ai-200).

## Comece por aqui

1. Na home, escolha **Começar pelo primeiro artigo**. As quatro primeiras leituras acompanham um assistente de suporte, do acesso aos manuais ao diagnóstico. **Ver roteiro completo** mostra os 35 artigos na ordem sugerida.
2. Formule uma resposta ao desafio antes da leitura. Durante o artigo, tente responder à checagem rápida antes de abrir a solução.
3. Em **Pratique este conceito**, responda às questões daquele tema e confira as explicações. A leitura e a prática têm um link para o próximo artigo.
4. A home salva as práticas concluídas neste navegador e retoma o primeiro artigo pendente. Ao terminar, abra **Preparação** e faça o simulado cronometrado, os laboratórios por área e a avaliação oficial. Consulte o [guia de preparação e referências](docs/preparacao-ai-200.md).

Os exemplos de SDK usam abas Python/C#. Prepare os recursos e permissões descritos antes de executar. Trechos de configuração são identificados quando não representam um projeto completo.

## Recursos do site

- Leitura com lacunas interativas, autoavaliações e exemplos de código.
- Simulado com escolha única/múltipla, código, ordenação e estudo de caso.
- Modo estudo com feedback imediato e simulado separado com 40 questões, 120 minutos, revisão de marcadas e correção ligada aos artigos.
- Página de preparação com Microsoft Learn, laboratórios, avaliação oficial, sandbox, vídeos e podcasts.
- Progresso salvo no navegador, exportação/importação e sincronização opcional com Gist não listado.
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

# 7. Servir preview local em http://localhost:3000
npm run preview
```

---

## Publicação no GitHub Pages

1. Em **Settings → Pages** no repositório GitHub, selecione **Source: GitHub Actions**.
2. A cada push na branch `main`, o workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) executa `npm run validate`, `npm run build` e `npm test`, publicando o diretório `dist/` automaticamente.
3. Pull Requests passam pela validação automática em [`.github/workflows/validate.yml`](.github/workflows/validate.yml).
4. A publicação gera e verifica áudio para todos os artigos. Para baixar a narração sem publicar o site, acione manualmente [`.github/workflows/kokoro-audio.yml`](.github/workflows/kokoro-audio.yml) na aba **Actions**.

O pipeline TTS e os comandos locais estão em [tools/tts/README.md](tools/tts/README.md).

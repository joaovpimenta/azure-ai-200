/** One study roadmap shared by static HTML and client-side navigation. */
const caseSteps = [
  {
    chapter: '08-secrets-and-config', slug: 'identidade-gerenciada-defaultazurecredential',
    title: 'Acessar os documentos',
    prompt: 'O indexador lê os manuais de suporte no seu computador. Quando vai para o Azure, recebe um erro de autorização do Blob Storage. Qual identidade você investigaria e que acesso ela precisa ter?'
  },
  {
    chapter: '02-container-apps', slug: 'aca-ambientes-e-implantacao',
    title: 'Implantar o indexador',
    prompt: 'Sempre que chega um manual novo, uma mensagem no Service Bus avisa o indexador. O worker só consome essas mensagens. Precisa receber chamadas HTTP? O que ele precisa para se conectar à fila?'
  },
  {
    chapter: '04-cosmos-db-nosql', slug: 'cosmos-db-busca-vetorial',
    title: 'Encontrar trechos relevantes',
    prompt: 'O assistente precisa encontrar cinco trechos semelhantes a uma pergunta, dentro da categoria do chamado. O que você configura ao armazenar os embeddings e o que filtra na consulta?'
  },
  {
    chapter: '09-observe-and-troubleshoot', slug: 'opentelemetry-azure-monitor',
    title: 'Investigar a latência',
    prompt: 'As respostas ficaram mais lentas. A API em .NET tem rastreamento, mas a etapa de busca criada pela equipe não aparece no trace. Onde você verificaria se o trecho foi registrado para exportação?'
  }
];

const lessons = (chapter, entries) => entries.map(([slug, title]) => ({ chapter, slug, title }));

const studyTracks = [
  { title: 'Caso guiado do assistente de suporte', steps: caseSteps },
  {
    title: 'Configure e publique a aplicação',
    steps: [
      ...lessons('08-secrets-and-config', [
        ['key-vault-segredos-rotacao', 'Versões e rotação no Key Vault'],
        ['app-configuration-chaves-rotulos-feature-flags', 'App Configuration e feature flags']
      ]),
      ...lessons('01-container-hosting', [
        ['acr-registro-imagens-versionamento', 'Imagens, tags e digests no ACR'],
        ['acr-tasks-build-na-nuvem', 'Build remoto com ACR Tasks'],
        ['app-service-conteineres-configuracao', 'Hospedagem no App Service']
      ]),
      ...lessons('02-container-apps', [
        ['aca-segredos-e-registro-privado', 'Registros privados e segredos no Container Apps'],
        ['aca-revisoes-e-trafego', 'Revisões e divisão de tráfego'],
        ['aca-escala-keda', 'Escala por eventos com KEDA']
      ])
    ]
  },
  {
    title: 'Modele, consulte e recupere dados',
    steps: [
      ...lessons('04-cosmos-db-nosql', [
        ['cosmos-db-modelo-de-recursos-e-particionamento', 'Documentos e partições no Cosmos DB'],
        ['cosmos-db-sdk-conexao-e-consultas', 'Conexão e consultas no Cosmos DB'],
        ['cosmos-db-indexacao-consistencia-rus', 'Índices, consistência e RUs'],
        ['cosmos-db-change-feed-processor', 'Processamento com Change Feed']
      ]),
      ...lessons('05-postgresql-pgvector', [
        ['postgresql-modelagem-e-tipos', 'Modelagem e tipos no PostgreSQL'],
        ['postgresql-conexao-sdk-e-autenticacao', 'Conexão ao PostgreSQL com Microsoft Entra'],
        ['pgvector-indices-hnsw-ivfflat', 'Índices HNSW e IVFFlat'],
        ['postgresql-rag-com-filtros', 'RAG com filtros de metadados'],
        ['postgresql-pool-de-conexoes-pgbouncer', 'Pooling com PgBouncer'],
        ['postgresql-recursos-para-cargas-vetoriais', 'Capacidade para cargas vetoriais']
      ]),
      ...lessons('06-managed-redis', [
        ['redis-cache-expiracao-invalidacao', 'Cache, expiração e invalidação no Redis'],
        ['redis-indexacao-vetorial', 'Busca vetorial e cache semântico no Redis']
      ])
    ]
  },
  {
    title: 'Conecte serviços e processe eventos',
    steps: lessons('07-backend-integration', [
      ['service-bus-filas-topicos-assinaturas', 'Filas, tópicos e assinaturas no Service Bus'],
      ['service-bus-dead-letter-e-processamento', 'Reentrega e mensagens não processadas'],
      ['event-grid-eventos-filtros-retentativas', 'Eventos e filtros no Event Grid'],
      ['functions-triggers-e-bindings', 'Triggers e bindings de Functions'],
      ['functions-configuracao-e-implantacao', 'Configuração e implantação de Functions']
    ])
  },
  {
    title: 'Aprofunde a hospedagem e o diagnóstico',
    steps: [
      ...lessons('03-aks', [
        ['aks-manifestos-deployments', 'Manifestos e deployments no AKS'],
        ['aks-rede-services-ingress', 'Services e Ingress no AKS'],
        ['aks-aca-troubleshooting-logs-eventos', 'Logs e eventos no AKS e Container Apps']
      ]),
      ...lessons('02-container-apps', [
        ['aca-sessoes-dinamicas', 'Sessões dinâmicas']
      ]),
      ...lessons('09-observe-and-troubleshoot', [
        ['kql-consultas-logs-metricas', 'Consultas KQL para logs e métricas'],
        ['troubleshooting-latencia-e-falhas-ia', 'Diagnóstico de latência e falhas']
      ])
    ]
  }
];
const studySteps = studyTracks.flatMap(track => track.steps);
const articlePath = (base, { chapter, slug }) => `${base}chapters/${chapter}/${slug}/index.html`;

export function getStudySequenceProgress(conceptProgress = {}) {
  const remaining = studySteps.filter(step => !conceptProgress?.[step.slug]?.practiceCompletedAt);
  return { completed: studySteps.length - remaining.length, total: studySteps.length, next: remaining[0] };
}

export function updateStudyGuideProgress(container, base, conceptProgress) {
  const status = container.querySelector('#study-coverage');
  const start = container.querySelector('.study-guide-heading .study-start');
  if (!status || !start) return;
  const { completed, total, next } = getStudySequenceProgress(conceptProgress);
  status.hidden = completed === 0;
  status.textContent = `${completed} de ${total} práticas concluídas`;
  start.href = next ? articlePath(base, next) : `${base}preparacao/index.html`;
  start.textContent = completed === 0 ? 'Começar pelo primeiro artigo →' : next ? 'Retomar o roteiro →' : 'Preparar para a prova →';
}

export function renderStudyCasePrompt(base, slug) {
  const index = caseSteps.findIndex(step => step.slug === slug);
  if (index === -1) return '';
  const { title, prompt } = caseSteps[index];
  return `<aside class="study-case-prompt" aria-labelledby="study-case-prompt-title">
    <a class="article-back" href="${base}index.html#study-guide-title">Assistente de suporte · Decisão ${index + 1} de ${caseSteps.length}</a>
    <h2 id="study-case-prompt-title">${title}</h2>
    <p>${prompt}</p>
    <p>Formule sua resposta, leia o artigo e faça a <a href="#study-practice-heading">prática ao final</a>.</p>
  </aside>`;
}

export function renderNextStudyLink(base, slug) {
  const index = studySteps.findIndex(step => step.slug === slug);
  if (index === -1) return '';
  const next = studySteps[index + 1];
  if (!next) return `<a class="study-start" href="${base}preparacao/index.html">Preparar para a prova →</a>`;
  const label = next.prompt ? 'Próxima decisão' : 'Próximo artigo';
  return `<a class="study-start" href="${articlePath(base, next)}">${label} · ${next.title} →</a>`;
}

export function renderStudySequenceNav(base, slug) {
  const index = studySteps.findIndex(step => step.slug === slug);
  if (index === -1) return '';
  return `<nav class="study-sequence-nav" aria-label="Roteiro de estudo">
    <a class="article-back" href="${base}index.html#study-guide-title">Roteiro · Artigo ${index + 1} de ${studySteps.length}</a>
    ${renderNextStudyLink(base, slug)}
  </nav>`;
}

export function renderStudyGuide(base = './') {
  const renderItems = steps => steps.map(step => `<li><a href="${articlePath(base, step)}">${step.title}</a></li>`).join('\n');
  return `<section class="study-guide" aria-labelledby="study-guide-title">
    <div class="study-guide-heading">
      <div><h2 id="study-guide-title">Comece por aqui</h2>
        <p>Como você colocaria no ar um assistente de suporte que responde com base nos manuais da equipe? Tome quatro decisões no caso guiado e depois siga o roteiro, um artigo por vez.</p>
        <p id="study-coverage" hidden></p>
      </div>
      <a class="study-start" href="${articlePath(base, studySteps[0])}">Começar pelo primeiro artigo →</a>
    </div>
    <ol class="study-case-steps" aria-label="Decisões do caso guiado">
      ${renderItems(caseSteps)}
    </ol>
    <details class="study-outline">
      <summary>Ver roteiro completo · ${studySteps.length} artigos</summary>
      <div class="study-steps">
        ${studyTracks.map(track => `<section>
          <h3>${track.title}</h3>
          <ol>${renderItems(track.steps)}</ol>
        </section>`).join('\n')}
      </div>
      <p><a href="${base}comparisons/vector-stores-azure/index.html">Comparar bancos vetoriais</a> · <a href="${base}preparacao/index.html">Simulado e recursos de preparação</a></p>
    </details>
  </section>`;
}

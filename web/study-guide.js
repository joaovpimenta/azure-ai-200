/** One study roadmap shared by static HTML and client-side navigation. */
export function renderStudyGuide(base = './') {
  const article = (chapter, slug) => `${base}chapters/${chapter}/${slug}/index.html`;
  return `<section class="study-guide" aria-labelledby="study-guide-title">
    <div class="study-guide-heading">
      <div><span class="eyebrow">Seu roteiro de estudo</span>
        <h2 id="study-guide-title">Comece por aqui</h2>
        <p>Não precisa ler tudo de uma vez. Siga a sequência abaixo; os capítulos continuam disponíveis na lista completa.</p>
      </div>
      <a class="study-start nav-link" href="${article('08-secrets-and-config', 'identidade-gerenciada-defaultazurecredential')}">1º artigo: identidade e acesso →</a>
    </div>
    <ol class="study-steps">
      <li><span class="eyebrow">1 · Fundamentos</span><h3>Entenda acesso, imagens e documentos</h3>
        <p>Primeiro, saiba quem acessa os recursos, o que uma imagem contém e como o banco organiza os dados.</p>
        <ul>
          <li><a href="${article('08-secrets-and-config', 'identidade-gerenciada-defaultazurecredential')}">Identidade gerenciada e permissões</a></li>
          <li><a href="${article('01-container-hosting', 'acr-registro-imagens-versionamento')}">Imagens e registro ACR</a></li>
          <li><a href="${article('04-cosmos-db-nosql', 'cosmos-db-modelo-de-recursos-e-particionamento')}">Documentos e partições no Cosmos DB</a></li>
        </ul>
      </li>
      <li><span class="eyebrow">2 · Aplicação funcionando</span><h3>Hospede, configure e conecte</h3>
        <p>Continue hospedagem e Container Apps. Aprenda a guardar configurações e consultar dados antes de estudar busca por vetores.</p>
        <ul>
          <li><a href="${article('01-container-hosting', 'acr-tasks-build-na-nuvem')}">Construção de imagens com ACR Tasks</a></li>
          <li><a href="${article('02-container-apps', 'aca-ambientes-e-implantacao')}">Ambientes do Container Apps</a></li>
          <li><a href="${article('08-secrets-and-config', 'key-vault-segredos-rotacao')}">Segredos e rotação no Key Vault</a></li>
          <li><a href="${article('04-cosmos-db-nosql', 'cosmos-db-sdk-conexao-e-consultas')}">Consultas com Cosmos DB</a></li>
          <li><a href="${article('05-postgresql-pgvector', 'postgresql-modelagem-e-tipos')}">Modelagem e tipos no PostgreSQL</a></li>
        </ul>
      </li>
      <li><span class="eyebrow">3 · Dados e processamento de IA</span><h3>Busque conteúdo e processe eventos</h3>
        <p>Agora conecte embeddings, busca, cache e filas. Faça as questões de cada artigo antes de avançar.</p>
        <ul>
          <li><a href="${article('04-cosmos-db-nosql', 'cosmos-db-busca-vetorial')}">Busca vetorial no Cosmos DB</a></li>
          <li><a href="${article('05-postgresql-pgvector', 'pgvector-indices-hnsw-ivfflat')}">pgvector e recuperação de documentos</a></li>
          <li><a href="${article('06-managed-redis', 'redis-cache-expiracao-invalidacao')}">Cache com Redis</a></li>
          <li><a href="${article('07-backend-integration', 'functions-triggers-e-bindings')}">Gatilhos e bindings de Functions</a></li>
        </ul>
      </li>
      <li><span class="eyebrow">4 · Operação e revisão</span><h3>Diagnostique e aprofunde</h3>
        <p>Estude monitoramento, depois Kubernetes e os tópicos avançados. Use as dúvidas do simulado para escolher o que reler.</p>
        <ul>
          <li><a href="${article('09-observe-and-troubleshoot', 'opentelemetry-azure-monitor')}">Telemetria com OpenTelemetry e Azure Monitor</a></li>
          <li><a href="${article('03-aks', 'aks-manifestos-deployments')}">AKS: manifestos e deployments</a></li>
          <li><a href="${base}comparisons/vector-stores-azure/index.html">Comparar bancos vetoriais</a></li>
          <li><a href="${base}simulator/index.html">Praticar no simulado</a> · <a href="${base}cram/index.html">Revisão rápida</a></li>
        </ul>
      </li>
    </ol>
    <div class="study-later">
      <h3>Deixe para depois da primeira leitura</h3>
      <p><a href="${article('02-container-apps', 'aca-sessoes-dinamicas')}">Sessões dinâmicas</a>,
      <a href="${article('05-postgresql-pgvector', 'postgresql-recursos-para-cargas-vetoriais')}">ajustes de memória para vetores</a>
      e detalhes de Kubernetes ficam mais claros após os fundamentos. Volte a eles na etapa 4: fazem parte do roteiro, não são assuntos para excluir.</p>
      <p><strong>Em cada sessão:</strong> leia um artigo → responda sem consultar → confira a justificativa → marque o que precisa revisar.
      O botão “Ouvir artigo” permite revisar o texto em áudio; acompanhe os exemplos de código na página.</p>
    </div>
  </section>`;
}

/**
 * web/cram.js
 * High-density Cram Sheet view: TL;DRs, aggregated "Pegadinhas de Prova", and comparative decision matrices.
 */

const domainLabels = {
  'containerized-solutions': 'Contêineres',
  'data-management': 'Dados e IA',
  'connect-and-consume': 'Conexão e eventos',
  'secure-monitor-troubleshoot': 'Segurança e monitoramento',
};

export function renderCramView(container, { cramIndex, catalog }) {
  const metaBase = typeof document !== 'undefined' ? document.querySelector('meta[name="site-base"]')?.getAttribute('content') : './';
  const basePrefix = metaBase ? (metaBase.endsWith('/') ? metaBase : `${metaBase}/`) : './';
  container.innerHTML = `
    <header class="concept-header">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1>Revisão rápida (Cram)</h1>
          <p style="color: var(--text-secondary); margin-top: 4px;">
            Leia o resumo, tente explicar o conceito sem olhar e confira os erros comuns. Use o filtro para revisar um domínio por vez.
          </p>
        </div>
        <button id="print-cram-btn" class="recall-toggle-btn">🖨️ Imprimir / Salvar PDF</button>
      </div>
      
      <div style="display: flex; align-items: center; gap: 10px; margin-top: 16px; flex-wrap: wrap;">
        <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Filtrar por Domínio:</span>
        <button class="recall-toggle-btn cram-filter-btn" data-domain="all" data-state="active">Todos</button>
        <button class="recall-toggle-btn cram-filter-btn" data-domain="containerized-solutions">Contêineres</button>
        <button class="recall-toggle-btn cram-filter-btn" data-domain="data-management">Dados & IA</button>
        <button class="recall-toggle-btn cram-filter-btn" data-domain="connect-and-consume">Conexão & Eventos</button>
        <button class="recall-toggle-btn cram-filter-btn" data-domain="secure-monitor-troubleshoot">Segurança & Observabilidade</button>
      </div>
    </header>

    <div id="cram-content-area">
      <!-- Resumos -->
      <section style="margin-bottom: 36px;">
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">
          📌 O essencial de cada conceito
        </h2>
        <div id="cram-tldr-container" class="mastery-grid">
          ${renderTldrItems(cramIndex || [])}
        </div>
      </section>

      <!-- Pegadinhas -->
      <section style="margin-bottom: 36px;">
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          ⚠️ Erros comuns e pegadinhas
        </h2>
        <div id="cram-pegadinhas-container" style="display: flex; flex-direction: column; gap: 16px;">
          ${renderPegadinhasItems(cramIndex || [])}
        </div>
      </section>

      <!-- Comparação -->
      <section>
        <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">
          ⚖️ Comparar serviços
        </h2>
        <div class="domain-readiness-card">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <h3 style="font-size: 16px;">Bancos vetoriais: Cosmos DB, PostgreSQL e Redis</h3>
            <a href="${basePrefix}comparisons/vector-stores-azure/index.html" class="nav-link" style="font-weight: 600;">Ver comparação →</a>
          </div>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin-top: 8px;">
            Considere <strong>Cosmos DB</strong> para documentos JSON distribuídos, <strong>PostgreSQL com pgvector</strong> para vetores com relações SQL e <strong>Redis</strong> para cache em memória. Valide latência, qualidade dos resultados e custo com os dados reais.
          </p>
        </div>
      </section>
    </div>
  `;

  // Attach Print Handler
  document.getElementById('print-cram-btn')?.addEventListener('click', () => {
    window.print();
  });

  // Filter Buttons
  const filterBtns = container.querySelectorAll('.cram-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.dataset.state = 'inactive');
      btn.dataset.state = 'active';
      const domain = btn.dataset.domain;
      filterCramContent(domain, cramIndex || []);
    });
  });
}

function renderPegadinhasItems(items, filterDomain = 'all') {
  const filtered = filterDomain === 'all' ? items : items.filter(it => it.exam_domain === filterDomain);
  if (!filtered || filtered.length === 0) {
    return `<div style="color: var(--text-muted); font-size: 14px;">Nenhuma pegadinha encontrada para este filtro.</div>`;
  }

  return filtered.map(item => `
    <div class="pegadinhas-box" data-domain="${item.exam_domain || ''}">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 13px; font-weight: 700; color: #92400e;">${item.title}</span>
        <span class="badge badge-domain">${domainLabels[item.exam_domain] || 'Geral'}</span>
      </div>
      <div>
        ${item.pegadinhasHtml || item.pegadinhas || 'Consulte o artigo para revisar este conceito.'}
      </div>
    </div>
  `).join('');
}

function renderTldrItems(items, filterDomain = 'all') {
  const filtered = filterDomain === 'all' ? items : items.filter(it => it.exam_domain === filterDomain);
  if (!filtered || filtered.length === 0) {
    return `<div style="color: var(--text-muted); font-size: 14px;">Nenhum resumo encontrado.</div>`;
  }

  return filtered.map(item => `
    <div class="domain-readiness-card" data-domain="${item.exam_domain || ''}">
      <span class="badge badge-domain">${domainLabels[item.exam_domain] || 'Geral'}</span>
      <h3 style="font-size: 15px; margin: 8px 0 4px 0;">${item.title}</h3>
      <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">
        ${item.tldr || 'Resumo em consolidação.'}
      </p>
    </div>
  `).join('');
}

function filterCramContent(domain, cramIndex) {
  const pegContainer = document.getElementById('cram-pegadinhas-container');
  const tldrContainer = document.getElementById('cram-tldr-container');
  if (pegContainer) pegContainer.innerHTML = renderPegadinhasItems(cramIndex, domain);
  if (tldrContainer) tldrContainer.innerHTML = renderTldrItems(cramIndex, domain);
}

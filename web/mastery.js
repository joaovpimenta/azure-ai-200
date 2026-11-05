/**
 * web/mastery.js
 * Domain-weighted readiness dashboard, syllabus coverage matrix, JSON export/import, and GitHub Gist sync.
 */
import {
  STORAGE_KEY,
  calculateReadiness,
  exportProgressJson,
  importProgressJson,
  mergeProgress,
  OFFICIAL_DOMAIN_WEIGHTS
} from './progress-core.js';

export function renderMasteryView(container, { blueprint, catalog }) {
  const metaBase = typeof document !== 'undefined' ? document.querySelector('meta[name="site-base"]')?.getAttribute('content') : './';
  const basePrefix = metaBase ? (metaBase.endsWith('/') ? metaBase : `${metaBase}/`) : './';
  const progressRaw = localStorage.getItem(STORAGE_KEY);
  let progressState = null;
  try {
    if (progressRaw) progressState = JSON.parse(progressRaw);
  } catch {}

  const readiness = calculateReadiness(progressState, blueprint, OFFICIAL_DOMAIN_WEIGHTS);
  const overallPercentage = readiness.overallPercentage;
  const isReady = readiness.isPassing;
  const domainReadiness = readiness.domainReadiness;

  container.innerHTML = `
    <header class="concept-header">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1>Meu progresso</h1>
          <p style="color: var(--text-secondary); margin-top: 4px;">
            Acompanhe os conceitos estudados e os resultados dos exercícios. Este indicador não prevê sua nota no exame oficial.
          </p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="export-json-btn" class="recall-toggle-btn">⬇️ Exportar JSON</button>
          <button id="import-json-btn" class="recall-toggle-btn">⬆️ Importar JSON</button>
          <button id="gist-sync-btn" class="recall-toggle-btn">☁️ Sincronizar Gist</button>
          <input type="file" id="import-file-input" accept=".json" style="display: none;">
        </div>
      </div>
    </header>

    <!-- Overall Readiness Hero -->
    <div class="quiz-card" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px; background: linear-gradient(135deg, var(--surface), var(--bg-secondary));">
      <div>
        <span class="badge ${isReady ? 'badge-domain' : 'badge-diff'}">Progresso geral</span>
        <div style="font-size: 42px; font-weight: 800; color: ${isReady ? 'var(--success)' : 'var(--accent)'}; margin-top: 6px;">
          ${overallPercentage}%
        </div>
        <p style="color: var(--text-muted); font-size: 13.5px;">
          ${isReady ? 'Você atingiu a meta de estudo do site. Revise os erros e pratique os temas menos conhecidos.' : 'Continue pelos conceitos ainda não estudados e revise suas dúvidas.'}
        </p>
      </div>
      <div style="min-width: 220px; flex: 1; max-width: 400px;">
        <div class="progress-bar-track" style="height: 14px;">
          <div class="progress-bar-fill" style="width: ${overallPercentage}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
          <span>0%</span>
          <span>Meta do site: 70%</span>
          <span>100%</span>
        </div>
      </div>
    </div>

    <!-- Domain Breakdown Grid -->
    <h2 style="font-size: 20px; font-weight: 700; margin: 28px 0 16px 0;">Progresso por área do exame</h2>
    <div class="mastery-grid">
      ${Object.entries(domainReadiness).map(([domId, d]) => `
        <div class="domain-readiness-card">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="badge badge-domain">Peso no indicador: ${Math.round(d.weight * 1000) / 10}%</span>
            <span style="font-weight: 700; color: var(--text-primary);">${d.percentage}%</span>
          </div>
          <h3 style="font-size: 15px; margin: 10px 0 6px 0;">${formatDomainName(domId)}</h3>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${d.percentage}%;"></div>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>${d.masteredCount}/${d.conceptCount} dominados</span>
            <span>${d.quizAccuracy > 0 ? `Acertos: ${Math.round(d.quizAccuracy * 100)}%` : 'Sem acertos registrados'}</span>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Syllabus Checklist -->
    <h2 style="font-size: 20px; font-weight: 700; margin: 32px 0 16px 0;">Conceitos e situação do estudo</h2>
    <div class="quiz-card" style="padding: 0; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 600px;">
        <thead style="background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
          <tr>
            <th style="padding: 10px 16px; text-align: left;">Conceito</th>
            <th style="padding: 10px 16px; text-align: left;">Domínio</th>
            <th style="padding: 10px 16px; text-align: left;">Capítulo</th>
            <th style="padding: 10px 16px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${(catalog || []).map(c => {
            const entry = progressState?.conceptProgress?.[c.slug];
            const st = entry?.state || 'not_started';
            return `
              <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 10px 16px;">
                  <a href="${basePrefix}${c.url.replace(/^\//, '')}" style="font-weight: 600;">${c.title}</a>
                </td>
                <td style="padding: 10px 16px; color: var(--text-secondary);">${formatDomainName(c.exam_domain)}</td>
                <td style="padding: 10px 16px; color: var(--text-muted);">${c.chapter || '-'}</td>
                <td style="padding: 10px 16px; text-align: center;">
                  <span class="status-dot ${st}" style="display: inline-block;" title="${formatStatus(st)}"></span>
                  <span style="font-size: 12px; text-transform: capitalize; margin-left: 4px;">${formatStatus(st)}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  setupMasteryPersistenceHandlers(progressState);
}

function formatDomainName(dom) {
  const map = {
    'containerized-solutions': 'Contêineres no Azure (ACR, ACA, AKS)',
    'data-management': 'Dados & IA (Cosmos DB, pgvector, Redis)',
    'connect-and-consume': 'Conexão & Eventos (Service Bus, Functions)',
    'secure-monitor-troubleshoot': 'Segurança & Monitoramento (Vault, KQL)'
  };
  return map[dom] || dom;
}

function formatStatus(st) {
  const map = {
    'not_started': 'Não iniciado',
    'studying': 'Estudando',
    'review': 'Revisão',
    'mastered': 'Dominado'
  };
  return map[st] || st;
}

function setupMasteryPersistenceHandlers(currentState) {
  // Export JSON
  document.getElementById('export-json-btn')?.addEventListener('click', () => {
    const jsonStr = exportProgressJson(currentState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azure_ai_200_progress_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import JSON
  const fileInput = document.getElementById('import-file-input');
  document.getElementById('import-json-btn')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const merged = importProgressJson(evt.target.result, currentState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        alert('Progresso importado neste navegador.');
        window.location.reload();
      } catch (err) {
        alert('Falha ao importar progresso: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // GitHub Gist Sync
  document.getElementById('gist-sync-btn')?.addEventListener('click', async () => {
    const pat = prompt('Insira seu GitHub Personal Access Token (com permissão "gist"):');
    if (!pat) return;

    try {
      const gistId = localStorage.getItem('azure_ai_200_gist_id');
      const filename = 'azure_ai_200_progress_v1.json';

      if (!gistId) {
        // Create new secret gist
        const res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            description: 'Azure AI-200 Study Hub Progress Sync',
            public: false,
            files: {
              [filename]: {
                content: exportProgressJson(currentState)
              }
            }
          })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        localStorage.setItem('azure_ai_200_gist_id', data.id);
        alert(`Gist não listado criado com o progresso! (ID: ${data.id})`);
      } else {
        // Fetch existing gist and merge
        const getRes = await fetch(`https://api.github.com/gists/${gistId}`, {
          headers: {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!getRes.ok) throw new Error(`HTTP ${getRes.status}`);
        const gistData = await getRes.json();
        const remoteContent = gistData.files[filename]?.content;

        let mergedState = currentState;
        if (remoteContent) {
          mergedState = importProgressJson(remoteContent, currentState);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedState));
        }

        // Push merged state back to Gist
        await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${pat}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            files: {
              [filename]: {
                content: exportProgressJson(mergedState)
              }
            }
          })
        });

        alert('Progresso do navegador e do Gist combinado.');
        window.location.reload();
      }
    } catch (err) {
      alert(`Falha na sincronização com Gist: ${err.message}`);
    }
  });
}

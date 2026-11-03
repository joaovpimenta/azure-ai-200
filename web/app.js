/**
 * web/app.js
 * Application bootstrap, hash router, state coordination, search, and keyboard controls.
 */
import { initReader } from './reader.js';
import { renderCramView } from './cram.js';
import { renderSimulatorView } from './simulator.js';
import { renderMasteryView } from './mastery.js';
import { initMermaid } from './mermaid-theme.js';

// 1. Site Base and Asset Resolver
export function getSiteBase() {
  const meta = document.querySelector('meta[name="site-base"]');
  let base = meta ? meta.getAttribute('content') : './';
  if (!base.endsWith('/')) base += '/';
  return base;
}

export function resolveUrl(relPath) {
  if (!relPath) return getSiteBase();
  if (relPath.startsWith('http://') || relPath.startsWith('https://')) return relPath;
  const clean = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${getSiteBase()}${clean}`;
}

// Global cached state
export const appState = {
  catalog: [],
  blueprint: null,
  cramIndex: [],
  questions: [],
  currentRoute: 'home',
  theme: localStorage.getItem('azure_ai_200_theme') || 'system'
};

// 2. Data Fetchers
async function fetchJsonSafely(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`Could not fetch data from ${url}:`, err.message);
    return null;
  }
}

export async function loadAppData() {
  const [cat, bp, cram, qs] = await Promise.all([
    fetchJsonSafely(resolveUrl('data/catalog.json')),
    fetchJsonSafely(resolveUrl('data/blueprint.json')),
    fetchJsonSafely(resolveUrl('data/cram-index.json')),
    fetchJsonSafely(resolveUrl('data/questions.json'))
  ]);

  if (cat) appState.catalog = cat;
  if (bp) appState.blueprint = bp;
  if (cram) appState.cramIndex = cram;
  if (qs) appState.questions = qs;
}

// 3. Theme Toggle Engine
export function applyTheme(theme) {
  appState.theme = theme;
  localStorage.setItem('azure_ai_200_theme', theme);
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? '☀️' : '🌓';
    toggleBtn.setAttribute('aria-label', isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro');
  }
  initMermaid();
}

// 4. Drawer & Navigation Management
export function setupDrawer() {
  const toggle = document.getElementById('drawer-toggle');
  const drawer = document.getElementById('sidebar-drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const closeBtn = document.getElementById('drawer-close');

  function openDrawer() {
    drawer?.classList.add('open');
    backdrop?.classList.add('active');
    drawer?.setAttribute('aria-hidden', 'false');
    toggle?.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    backdrop?.classList.remove('active');
    drawer?.setAttribute('aria-hidden', 'true');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  toggle?.addEventListener('click', openDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  return { openDrawer, closeDrawer };
}

export function renderDrawerContent() {
  const container = document.getElementById('drawer-content');
  if (!container || !appState.blueprint) return;

  const chapters = appState.blueprint.chapters || [];
  const progressRaw = localStorage.getItem('azure_ai_200_progress_v1');
  let progressState = {};
  try {
    if (progressRaw) progressState = JSON.parse(progressRaw);
  } catch {}

  const conceptProgress = progressState.conceptProgress || {};

  let html = '';
  for (const ch of chapters) {
    html += `
      <div class="chapter-nav-item">
        <div class="chapter-title-row">
          <span>📁</span>
          <span>${ch.title}</span>
        </div>
        <div class="chapter-concepts-list">
    `;

    for (const c of ch.concepts || []) {
      const status = conceptProgress[c.slug]?.state || 'not_started';
      const catItem = appState.catalog.find(it => it.slug === c.slug);
      const url = catItem ? resolveUrl(catItem.url) : `#concept/${c.slug}`;

      html += `
        <a href="${url}" class="concept-nav-link" data-slug="${c.slug}">
          <span>${c.title}</span>
          <span class="status-dot ${status}" title="Status: ${status}"></span>
        </a>
      `;
    }

    html += `</div></div>`;
  }

  container.innerHTML = html;
}

// 5. Hash & Pre-rendered Page Router
export function handleRouting() {
  const hash = window.location.hash || '';
  const bodyRoute = document.body?.dataset?.route || 'home';
  const viewport = document.getElementById('app-viewport');
  if (!viewport) return;

  const effectiveRoute = hash && hash !== '#' && hash !== '#/'
    ? hash.slice(1)
    : bodyRoute;

  // Update nav links active class
  document.querySelectorAll('.main-nav .nav-link').forEach(link => {
    const route = link.dataset.route;
    if ((route === 'home' && (effectiveRoute === 'home' || effectiveRoute === '')) ||
        (route && effectiveRoute.startsWith(route))) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Check if we are on a pre-rendered static concept or comparison page
  const preRenderedContent = document.querySelector('.concept-content, .comparison-content');
  if (preRenderedContent && !hash.startsWith('#cram') && !hash.startsWith('#simulator') && !hash.startsWith('#mastery')) {
    initReader();
    initMermaid();
    return;
  }

  // Route Matching (supports both MPA directory URLs and SPA hash URLs)
  if (effectiveRoute === 'cram' || effectiveRoute.startsWith('cram?')) {
    renderCramView(viewport, appState);
  } else if (effectiveRoute === 'simulator' || effectiveRoute.startsWith('simulator?')) {
    const query = (hash.includes('?') ? hash.split('?')[1] : window.location.search.slice(1)) || '';
    const urlParams = new URLSearchParams(query);
    renderSimulatorView(viewport, appState, urlParams);
  } else if (effectiveRoute === 'mastery' || effectiveRoute.startsWith('mastery?')) {
    renderMasteryView(viewport, appState);
  } else if (effectiveRoute.startsWith('concept/')) {
    const slug = effectiveRoute.replace('concept/', '').split('?')[0];
    const catItem = appState.catalog.find(c => c.slug === slug);
    if (catItem) {
      window.location.href = resolveUrl(catItem.url);
    } else {
      viewport.innerHTML = `<div class="quiz-card"><h2>Conceito em elaboração</h2><p>O resumo para <code>${slug}</code> está mapeado na ementa oficial e pode ser gerado via <code>npm run brief -- --slug ${slug}</code>.</p><p style="margin-top:12px;"><a href="${resolveUrl('index.html')}" class="recall-toggle-btn">Voltar para Trilhas</a></p></div>`;
    }
  } else {
    renderHomeView(viewport);
  }

  initMermaid();
}

function renderHomeView(container) {
  if (!appState.blueprint) {
    container.innerHTML = `<div style="padding: 24px;">Carregando trilhas da ementa oficial...</div>`;
    return;
  }

  const domains = appState.blueprint.domains || [];
  let html = `
    <header class="concept-header">
      <h1>Trilhas de Estudo — Exame AI-200</h1>
      <p style="color: var(--text-secondary); margin-top: 6px;">
        Selecione uma área de domínio ou capítulo para iniciar seu estudo com Active Recall e abas sincronizadas de código.
      </p>
    </header>
    <div class="mastery-grid">
  `;

  for (const d of domains) {
    const domainChapters = (appState.blueprint.chapters || []).filter(c => {
      if (Array.isArray(c.domains) && c.domains.includes(d.id)) return true;
      if (c.exam_domain) return c.exam_domain === d.id;
      if (c.domain) return c.domain === d.id;
      return false;
    });

    let conceptCount = 0;
    domainChapters.forEach(ch => conceptCount += (ch.concepts || []).length);

    html += `
      <div class="domain-readiness-card">
        <span class="badge badge-domain">${d.weight?.min ?? 20}% – ${d.weight?.max ?? 25}%</span>
        <h3 style="margin-top: 8px; font-size: 16px;">${d.title}</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin: 6px 0;">${conceptCount} conceitos planejados</p>
        <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
          ${domainChapters.map(ch => `
            <div style="font-size: 13px;">
              <strong>${ch.title}</strong>
              <div style="padding-left: 8px; margin-top: 4px;">
                ${(ch.concepts || []).map(co => {
                  const item = appState.catalog.find(x => x.slug === co.slug);
                  const href = item ? resolveUrl(item.url) : `#concept/${co.slug}`;
                  return `<a href="${href}" style="display:block; padding: 2px 0;">• ${co.title}</a>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// 6. Search Modal Implementation
export function setupSearchModal() {
  const modalBackdrop = document.getElementById('search-modal-backdrop');
  const trigger = document.getElementById('search-trigger');
  const closeBtn = document.getElementById('search-modal-close');
  const input = document.getElementById('global-search-input');
  const resultsContainer = document.getElementById('search-results-list');

  function openSearch() {
    modalBackdrop?.classList.add('open');
    modalBackdrop?.setAttribute('aria-hidden', 'false');
    if (input) {
      input.value = '';
      renderSearchResults('');
      input.focus();
    }
  }

  function closeSearch() {
    modalBackdrop?.classList.remove('open');
    modalBackdrop?.setAttribute('aria-hidden', 'true');
  }

  function renderSearchResults(query) {
    if (!resultsContainer) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      resultsContainer.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">Digite para pesquisar em todos os conceitos e tags...</div>`;
      return;
    }

    const matches = appState.catalog.filter(it => {
      const matchTitle = (it.title || '').toLowerCase().includes(q);
      const matchTags = (it.tags || []).some(t => t.toLowerCase().includes(q));
      const matchTldr = (it.tldr || '').toLowerCase().includes(q);
      return matchTitle || matchTags || matchTldr;
    }).slice(0, 10);

    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">Nenhum conceito encontrado para "${query}".</div>`;
      return;
    }

    resultsContainer.innerHTML = matches.map(m => `
      <a href="${resolveUrl(m.url)}" class="search-result-item">
        <span class="search-result-title">${m.title}</span>
        <span class="search-result-sub">${m.exam_domain || ''} ${m.tags ? `• ${m.tags.slice(0, 3).join(', ')}` : ''}</span>
      </a>
    `).join('');
  }

  trigger?.addEventListener('click', openSearch);
  closeBtn?.addEventListener('click', closeSearch);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeSearch();
  });

  input?.addEventListener('input', (e) => {
    renderSearchResults(e.target.value);
  });

  return { openSearch, closeSearch };
}

// 7. Global Keyboard Shortcuts Setup
export function setupKeyboardShortcuts() {
  const shortcutsModal = document.getElementById('shortcuts-modal-backdrop');
  const shortcutsToggle = document.getElementById('shortcuts-toggle');
  const shortcutsClose = document.getElementById('shortcuts-modal-close');

  function toggleShortcuts() {
    if (!shortcutsModal) return;
    const isOpen = shortcutsModal.classList.contains('open');
    if (isOpen) {
      shortcutsModal.classList.remove('open');
      shortcutsModal.setAttribute('aria-hidden', 'true');
    } else {
      shortcutsModal.classList.add('open');
      shortcutsModal.setAttribute('aria-hidden', 'false');
    }
  }

  shortcutsToggle?.addEventListener('click', toggleShortcuts);
  shortcutsClose?.addEventListener('click', toggleShortcuts);
  shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) toggleShortcuts();
  });

  window.addEventListener('keydown', (e) => {
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.getElementById('search-trigger')?.click();
    } else if (e.key === '?' && !isEditing) {
      e.preventDefault();
      toggleShortcuts();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
      document.getElementById('sidebar-drawer')?.classList.remove('open');
      document.getElementById('drawer-backdrop')?.classList.remove('active');
    } else if (e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    } else if (e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      document.getElementById('recall-switch-btn')?.click();
    } else if (['1', '2', '3', '4', '5'].includes(e.key) && !isEditing) {
      const idx = parseInt(e.key, 10) - 1;
      const opt = document.querySelectorAll('.option-item')[idx];
      if (opt) {
        opt.click();
      }
    }
  });
}

// 8. Service Worker Registration
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(resolveUrl('sw.js'), { scope: getSiteBase() })
        .then((reg) => {
          console.log('[SW] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    });
  }
}

// 9. Bootstrap Initialization
export async function initApp() {
  applyTheme(appState.theme);
  setupDrawer();
  setupSearchModal();
  setupKeyboardShortcuts();
  registerServiceWorker();

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });

  await loadAppData();
  renderDrawerContent();
  handleRouting();

  window.addEventListener('hashchange', handleRouting);
}

// Auto-run on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

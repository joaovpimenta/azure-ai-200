/**
 * web/app.js
 * Application bootstrap, Tech Topics archive cards, quick-actions preview, live search suggestions,
 * GitHub stars counter, and SPA/MPA routing for Azure AI-200.
 */
import { renderStudyGuide } from './study-guide.js';
import { initReader } from './reader.js';
import { renderCramView } from './cram.js';
import { renderSimulatorView } from './simulator.js';
import { renderMasteryView } from './mastery.js';
import { initMermaid } from './mermaid-theme.js';

export const FAVORITES_KEY = 'azure-ai-200:favorites:v1';

// 1. Site Base and Asset Resolver
export function getSiteBase() {
  const meta = document.querySelector('meta[name="site-base"]');
  let base = meta ? meta.getAttribute('content') : './';
  if (!base.endsWith('/')) base += '/';
  return base;
}

export function resolveUrl(relPath) {
  if (!relPath) return getSiteBase();
  if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('#')) return relPath;
  const clean = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  return `${getSiteBase()}${clean}`;
}

export const appState = {
  catalog: [],
  blueprint: null,
  cramIndex: [],
  questions: [],
  currentRoute: 'home',
  activeFilter: 'all',
  theme: 'light'
};

const normalizeText = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

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

// 3. Favorites & Tech Topics Cards / Quick-Actions Engine (forked from tech-topics/cards.js)
export function readFavorites(fallback = []) {
  try {
    const values = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(values) ? values.filter(v => typeof v === 'string') : []);
  } catch {
    return new Set(fallback);
  }
}

export function recommendArticles(records, currentSlug) {
  if (!Array.isArray(records) || !currentSlug) return [];
  const current = records.find(r => r.slug === currentSlug);
  const tags = new Set(Array.isArray(current?.tags) ? current.tags : []);
  const others = records.filter(r => r && r.slug && r.slug !== currentSlug);
  const related = [];
  const fallback = [];
  for (const item of others) {
    const hasSharedTag = Array.isArray(item.tags) && item.tags.some(t => tags.has(t));
    (hasSharedTag ? related : fallback).push(item);
  }
  return [...related, ...fallback].slice(0, 3);
}

export function createCards({ quickActions, shareStatus, lazyImages = false } = {}) {
  const favorites = readFavorites();

  function syncFavorites() {
    const stored = readFavorites(favorites);
    favorites.clear();
    stored.forEach(s => favorites.add(s));
  }

  function toggleFavorite(slug, button) {
    syncFavorites();
    if (favorites.has(slug)) favorites.delete(slug);
    else favorites.add(slug);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    } catch {}
    if (button) {
      const selected = favorites.has(slug);
      button.classList.toggle('is-favorite', selected);
      button.setAttribute('aria-pressed', String(selected));
      const title = button.dataset.articleTitle || slug;
      button.setAttribute('aria-label', (selected ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + title);
      button.title = selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    }
    if (appState.activeFilter === 'favorites') {
      renderArchiveCards();
    }
  }

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function icon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '19');
    svg.setAttribute('height', '19');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      kind === 'heart'
        ? 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z'
        : 'M12 16V3m0 0L7 8m5-5 5 5M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5'
    );
    svg.append(path);
    return svg;
  }

  async function shareArticle(article) {
    const url = new URL(resolveUrl(article.url), document.baseURI).href;
    try {
      if (navigator.share) {
        await navigator.share({ title: article.title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        if (shareStatus) shareStatus.textContent = 'Link do artigo copiado.';
      }
    } catch (err) {
      if (err?.name !== 'AbortError' && shareStatus) {
        shareStatus.textContent = 'Não foi possível compartilhar este artigo.';
      }
    }
  }

  let hoverOpenTimer = null;
  let hoverCloseTimer = null;
  let hoverCard = null;
  let quickMode = null;

  function closeQuickActions() {
    clearTimeout(hoverOpenTimer);
    clearTimeout(hoverCloseTimer);
    hoverOpenTimer = null;
    hoverCloseTimer = null;
    hoverCard = null;
    if (quickActions) {
      quickActions.hidden = true;
      quickActions.replaceChildren();
    }
    quickMode = null;
  }

  function scheduleHoverClose() {
    clearTimeout(hoverCloseTimer);
    hoverCloseTimer = setTimeout(() => {
      if (quickMode !== 'hover' || hoverCard?.matches(':hover') || quickActions?.matches(':hover')) return;
      closeQuickActions();
    }, 180);
  }

  if (quickActions) {
    quickActions.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || quickMode !== 'hover') return;
      clearTimeout(hoverCloseTimer);
      hoverCloseTimer = null;
    });
    quickActions.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && quickMode === 'hover') scheduleHoverClose();
    });
  }

  function openQuickActions(article, favoriteButton, x, y, mode = 'hover', sourceCard = null) {
    if (!quickActions) return;
    syncFavorites();
    closeQuickActions();

    const cover = element('img', 'quick-cover');
    cover.src = resolveUrl(article.image || `assets/covers/${article.slug}.svg`);
    cover.alt = article.alt || article.title;
    cover.loading = 'lazy';
    cover.decoding = 'async';

    const title = element('h2', 'quick-title', article.title);
    title.id = 'quick-preview-title';

    const summary = element('div', 'quick-description');
    const meta = element('p', 'quick-meta', [article.category || article.chapter, article.read || '10 min de leitura'].filter(Boolean).join(' · '));
    const opening = element('p', 'quick-opening', article.opening || article.tldr || article.excerpt || '');
    const hint = element('p', 'quick-hint', mode === 'hover' ? 'Clique em uma ação; afaste o cursor para fechar.' : 'Use Tab para escolher uma ação e Escape para fechar.');
    summary.append(meta, opening, hint);

    const controls = element('div', 'quick-controls');
    const read = element('button', 'quick-read', 'Ler artigo');
    read.type = 'button';
    read.dataset.quickAction = 'read';
    read.addEventListener('click', () => {
      closeQuickActions();
      window.location.assign(resolveUrl(article.url));
    });

    const like = element('button', 'card-icon-button favorite-button quick-icon');
    like.type = 'button';
    like.dataset.articleTitle = article.title;
    const selected = favorites.has(article.slug);
    like.setAttribute('aria-label', (selected ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + article.title);
    like.setAttribute('aria-pressed', String(selected));
    if (selected) like.classList.add('is-favorite');
    like.append(icon('heart'));
    like.addEventListener('click', () => {
      toggleFavorite(article.slug, favoriteButton);
      closeQuickActions();
    });

    const share = element('button', 'card-icon-button quick-icon');
    share.type = 'button';
    share.setAttribute('aria-label', 'Compartilhar ' + article.title);
    share.append(icon('share'));
    share.addEventListener('click', () => {
      closeQuickActions();
      shareArticle(article);
    });

    controls.append(read, like, share);
    quickActions.replaceChildren(cover, title, summary, controls);
    quickActions.hidden = false;
    quickMode = mode;
    hoverCard = sourceCard;

    const viewportW = window.innerWidth || document.documentElement.clientWidth;
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    const popupWidth = quickActions.getBoundingClientRect().width || 360;
    const popupHeight = quickActions.getBoundingClientRect().height || 300;
    const left = Math.min(Math.max(12, x - popupWidth / 2), Math.max(12, viewportW - popupWidth - 12));
    const cardBounds = sourceCard?.getBoundingClientRect();
    let top = y + 12;
    if (cardBounds) {
      const spaceBelow = viewportH - cardBounds.bottom - 20;
      const spaceAbove = cardBounds.top - 20;
      top = spaceBelow >= popupHeight ? cardBounds.bottom + 10 : spaceAbove >= popupHeight ? cardBounds.top - popupHeight - 10 : Math.max(12, viewportH - popupHeight - 12);
    }
    quickActions.style.left = `${left}px`;
    quickActions.style.top = `${top}px`;
    if (mode === 'keyboard') read.focus();
  }

  function articleCard(article, index = 0) {
    syncFavorites();
    const card = element('article', 'recent-item');
    card.tabIndex = 0;
    const href = resolveUrl(article.url);

    const imageLink = element('a', 'recent-image image-link');
    imageLink.href = href;
    imageLink.setAttribute('aria-label', 'Ler ' + article.title);
    const image = element('img');
    image.src = resolveUrl(article.image || `assets/covers/${article.slug}.svg`);
    image.alt = article.alt || article.title;
    image.loading = lazyImages || index >= 2 ? 'lazy' : 'eager';
    image.decoding = 'async';
    imageLink.append(image);

    const copy = element('div', 'recent-copy');
    const category = element('p', 'eyebrow', article.category || article.chapter || 'Azure AI-200');
    const title = element('h3');
    const titleLink = element('a', '', article.title);
    titleLink.href = href;
    title.append(titleLink);

    const excerpt = element('p', 'excerpt', article.excerpt || article.tldr || '');
    const metaLabel = [article.date || 'Intermediário', article.read || '10 min de leitura'].filter(Boolean).join(' · ');
    const postMeta = element('p', 'post-meta', metaLabel);
    copy.append(category, title, excerpt, postMeta);

    if (Array.isArray(article.tags) && article.tags.length > 0) {
      const tagsList = element('div', 'card-tags');
      article.tags.slice(0, 4).forEach(t => {
        const tagBadge = element('button', 'card-tag-pill', `#${t}`);
        tagBadge.type = 'button';
        tagBadge.addEventListener('click', e => {
          e.stopPropagation();
          appState.activeFilter = `tag:${t}`;
          renderFilterPills();
          renderArchiveCards();
        });
        tagsList.append(tagBadge);
      });
      copy.append(tagsList);
    }

    const actions = element('div', 'card-actions');
    const like = element('button', 'card-icon-button favorite-button');
    const selected = favorites.has(article.slug);
    like.type = 'button';
    like.dataset.articleTitle = article.title;
    like.setAttribute('aria-label', (selected ? 'Remover dos favoritos: ' : 'Adicionar aos favoritos: ') + article.title);
    like.setAttribute('aria-pressed', String(selected));
    like.title = selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
    if (selected) like.classList.add('is-favorite');
    like.append(icon('heart'));
    like.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorite(article.slug, like);
    });

    const share = element('button', 'card-icon-button');
    share.type = 'button';
    share.setAttribute('aria-label', 'Compartilhar ' + article.title);
    share.title = 'Compartilhar';
    share.append(icon('share'));
    share.addEventListener('click', e => {
      e.stopPropagation();
      shareArticle(article);
    });

    actions.append(like, share);
    card.append(imageLink, copy, actions);

    card.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
      clearTimeout(hoverCloseTimer);
      clearTimeout(hoverOpenTimer);
      hoverOpenTimer = setTimeout(() => {
        if (!card.matches(':hover')) return;
        const bounds = card.getBoundingClientRect();
        openQuickActions(article, like, bounds.left + bounds.width / 2, bounds.bottom, 'hover', card);
      }, 220);
    });
    card.addEventListener('pointerleave', event => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(hoverOpenTimer);
      hoverOpenTimer = null;
      if (hoverCard === card && quickMode === 'hover') scheduleHoverClose();
    });
    card.addEventListener('keydown', event => {
      if (event.target !== card || (event.key !== ' ' && event.key !== 'Enter')) return;
      event.preventDefault();
      const bounds = card.getBoundingClientRect();
      openQuickActions(article, like, bounds.left + bounds.width / 2, bounds.bottom, 'keyboard', card);
    });

    return card;
  }

  return { articleCard, favorites, closeQuickActions };
}

// 4. GitHub Stars Counter (forked from tech-topics/header.js)
export function loadGitHubStars() {
  if (typeof document === 'undefined') return;
  const starCount = document.querySelector('#github-stars');
  if (!starCount) return;
  const key = 'azure-ai-200:github-stars:v1';
  const render = stars => {
    starCount.textContent = new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(stars);
  };

  async function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && Number.isInteger(saved.stars) && saved.stars >= 0) {
        render(saved.stars);
        if (Date.now() - saved.updated < 6 * 60 * 60 * 1000) return;
      }
    } catch {}
    try {
      const response = await fetch('https://api.github.com/repos/joaovpimenta/azure-ai-200', {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) return;
      const data = await response.json();
      if (!Number.isInteger(data.stargazers_count)) return;
      render(data.stargazers_count);
      try {
        localStorage.setItem(key, JSON.stringify({ stars: data.stargazers_count, updated: Date.now() }));
      } catch {}
    } catch {}
  }

  void load();
}

// 5. Live Search Suggestions Dropdown (forked from tech-topics/search.js)
export function setupSearchSuggestions() {
  if (typeof document === 'undefined') return;
  const input = document.querySelector('#search-input, #article-search-input');
  const panel = document.querySelector('#search-suggestions');
  if (!input || !panel) return;

  const container = input.closest('.top-search');
  const form = input.closest('form');
  const MAX_SUGGESTIONS = 5;
  let opened = false;

  form?.addEventListener('submit', e => {
    const isHome = !document.body.classList.contains('article-page') && (appState.currentRoute === 'home' || !appState.currentRoute);
    if (isHome) {
      e.preventDefault();
      dismiss();
      renderArchiveCards();
    }
  });

  function match(query) {
    const terms = normalizeText(query.trim()).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return appState.catalog
      .map((article, index) => {
        const title = normalizeText(article.title);
        const tags = normalizeText((article.tags || []).join(' '));
        const category = normalizeText(article.category || article.chapter);
        const description = normalizeText([article.excerpt, article.tldr, article.opening].join(' '));
        const searchable = [title, tags, category, description].join(' ');
        if (!terms.every(t => searchable.includes(t))) return null;
        const whole = terms.join(' ');
        const rank = title.startsWith(whole)
          ? 0
          : title.includes(whole)
            ? 1
            : tags.includes(whole)
              ? 2
              : category.includes(whole)
                ? 3
                : 4;
        return { article, index, rank };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.index - b.index);
  }

  function dismiss() {
    opened = false;
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  function place() {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visibleWidth = viewport?.width || window.innerWidth;
    const width = Math.min(500, Math.max(220, visibleWidth - 24));
    const x = Math.max(12, Math.min(rect.left, visibleWidth - width - 12));
    const top = rect.bottom + 8;
    panel.style.width = `${width}px`;
    panel.style.left = `${x}px`;
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(120, (viewport?.height || window.innerHeight) - top - 16)}px`;
  }

  function render() {
    const query = input.value.trim();
    panel.replaceChildren();
    if (!opened || !query || !appState.catalog.length) {
      panel.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    const results = match(query);
    const heading = document.createElement('p');
    heading.className = 'search-suggestions-heading';
    heading.textContent = results.length ? 'Artigos encontrados' : 'Nenhum artigo encontrado';
    panel.append(heading);

    if (results.length) {
      const list = document.createElement('ul');
      list.className = 'search-suggestions-list';
      for (const { article } of results.slice(0, MAX_SUGGESTIONS)) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = resolveUrl(article.url);
        link.className = 'search-suggestion-link';
        const title = document.createElement('strong');
        title.className = 'search-suggestion-title';
        title.textContent = article.title;
        const category = document.createElement('span');
        category.className = 'search-suggestion-category';
        category.textContent = article.category || article.chapter;
        link.append(title, category);
        item.append(link);
        list.append(item);
      }
      panel.append(list);

      const more = document.createElement('a');
      more.className = 'search-suggestions-more';
      more.href = `${resolveUrl('index.html')}?q=${encodeURIComponent(query)}`;
      more.textContent = `Ver todos os ${results.length} resultado${results.length === 1 ? '' : 's'}`;
      panel.append(more);
    }

    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    place();
  }

  input.setAttribute('aria-controls', panel.id);
  input.setAttribute('aria-expanded', 'false');
  input.addEventListener('focus', () => {
    opened = true;
    render();
  });
  input.addEventListener('input', () => {
    opened = true;
    render();
    if (document.querySelector('#recent-list')) {
      renderArchiveCards();
    }
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      dismiss();
      return;
    }
    if (event.key === 'ArrowDown' && !panel.hidden) {
      const first = panel.querySelector('a');
      if (first) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      input.focus();
      dismiss();
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const links = [...panel.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowDown') links[(index + 1) % links.length].focus();
    else if (index === 0) input.focus();
    else links[index - 1].focus();
  });
  container?.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!container.contains(document.activeElement)) dismiss();
    }, 0);
  });
  document.addEventListener('pointerdown', event => {
    if (container && !container.contains(event.target)) dismiss();
  });
  window.addEventListener('resize', () => {
    if (!panel.hidden) place();
  });
  window.addEventListener('scroll', () => {
    if (!panel.hidden) place();
  }, { passive: true });
}

export const CHAPTER_ORDER = [
  { id: '01-container-hosting', num: 1, title: 'Hospedagem de Contêineres (ACR & App Service)', domain: 'Desenvolver soluções em contêineres' },
  { id: '02-container-apps', num: 2, title: 'Azure Container Apps (ACA & KEDA)', domain: 'Desenvolver soluções em contêineres' },
  { id: '03-aks', num: 3, title: 'Azure Kubernetes Service (AKS)', domain: 'Desenvolver soluções em contêineres' },
  { id: '04-cosmos-db-nosql', num: 4, title: 'Azure Cosmos DB for NoSQL', domain: 'Serviços de Gerenciamento de Dados para IA' },
  { id: '05-postgresql-pgvector', num: 5, title: 'PostgreSQL & pgvector', domain: 'Serviços de Gerenciamento de Dados para IA' },
  { id: '06-managed-redis', num: 6, title: 'Azure Managed Redis', domain: 'Serviços de Gerenciamento de Dados para IA' },
  { id: '07-backend-integration', num: 7, title: 'Integração de Back-end (Service Bus, Event Grid & Functions)', domain: 'Conectar e consumir serviços' },
  { id: '08-secrets-and-config', num: 8, title: 'Segredos e Configuração (Key Vault & App Config)', domain: 'Proteger e monitorar soluções' },
  { id: '09-observe-and-troubleshoot', num: 9, title: 'Observabilidade e Diagnóstico (App Insights & KQL)', domain: 'Proteger e monitorar soluções' },
  { id: 'comparisons', num: 10, title: 'Matrizes Comparativas · Arquitetura de Decisão', domain: 'Decisões Arquiteturais no Azure' }
];

// 6. Home / Archive View Renderer (Organized by Chapter Lanes)
function renderArchiveCards() {
  const list = document.querySelector('#recent-list');
  const count = document.querySelector('#article-count');
  const emptyState = document.querySelector('#empty-state');
  const searchInput = document.querySelector('#search-input');
  const quickActions = document.querySelector('#article-quick-actions');
  const shareStatus = document.querySelector('#share-status');
  if (!list || !count) return;

  const query = normalizeText(searchInput?.value?.trim() || '');
  const favorites = readFavorites();
  const { articleCard } = createCards({ quickActions, shareStatus });

  const matching = appState.catalog.filter(article => {
    if (appState.activeFilter === 'favorites' && !favorites.has(article.slug)) return false;
    if (appState.activeFilter === 'comparisons' && article.type !== 'comparison') return false;
    if (appState.activeFilter === 'concepts' && article.type !== 'concept') return false;
    if (appState.activeFilter.startsWith('chapter:') && article.chapter !== appState.activeFilter.slice(8)) return false;
    if (appState.activeFilter.startsWith('tag:') && !(article.tags || []).includes(appState.activeFilter.slice(4))) return false;
    if (!query) return true;
    const searchable = normalizeText([
      article.title,
      article.category,
      article.chapter,
      article.excerpt,
      article.tldr,
      ...(article.tags || [])
    ].join(' '));
    return searchable.includes(query);
  });

  // Group matching articles by chapter
  const chaptersMap = new Map();
  matching.forEach(article => {
    const chKey = article.chapter || (article.type === 'comparison' ? 'comparisons' : 'other');
    if (!chaptersMap.has(chKey)) chaptersMap.set(chKey, []);
    chaptersMap.get(chKey).push(article);
  });

  list.innerHTML = '';
  let globalCardIdx = 0;

  for (const meta of CHAPTER_ORDER) {
    const chapterArticles = chaptersMap.get(meta.id);
    if (!chapterArticles || chapterArticles.length === 0) continue;

    const chapterSection = document.createElement('section');
    chapterSection.className = 'chapter-section';
    chapterSection.dataset.chapter = meta.id;

    const header = document.createElement('header');
    header.className = 'chapter-header-bar';
    const numPrefix = meta.num <= 9 ? `Cap. 0${meta.num} · ` : '';
    header.innerHTML = `
      <div class="chapter-header-left">
        <span class="eyebrow">${meta.domain}</span>
        <h3 class="chapter-lane-title">${numPrefix}${meta.title}</h3>
      </div>
      <span class="chapter-badge-count">${chapterArticles.length} ${chapterArticles.length === 1 ? 'artigo' : 'artigos'}</span>
    `;

    const rowGrid = document.createElement('div');
    rowGrid.className = 'recent-list chapter-cards-grid';

    chapterArticles.forEach(article => {
      rowGrid.append(articleCard(article, globalCardIdx++));
    });

    chapterSection.append(header, rowGrid);
    list.append(chapterSection);
  }

  // Handle any extra chapters/items not in CHAPTER_ORDER
  for (const [chKey, articles] of chaptersMap.entries()) {
    if (CHAPTER_ORDER.some(m => m.id === chKey)) continue;
    const extraSection = document.createElement('section');
    extraSection.className = 'chapter-section';
    const header = document.createElement('header');
    header.className = 'chapter-header-bar';
    header.innerHTML = `<h3 class="chapter-lane-title">${chKey}</h3>`;
    const rowGrid = document.createElement('div');
    rowGrid.className = 'recent-list chapter-cards-grid';
    articles.forEach(article => rowGrid.append(articleCard(article, globalCardIdx++)));
    extraSection.append(header, rowGrid);
    list.append(extraSection);
  }

  list.setAttribute('aria-busy', 'false');

  if (query) {
    count.textContent = `${matching.length} de ${appState.catalog.length} artigos encontrados`;
  } else if (appState.activeFilter === 'favorites') {
    count.textContent = `${matching.length} artigo${matching.length === 1 ? '' : 's'} nos favoritos`;
  } else if (appState.activeFilter.startsWith('tag:')) {
    count.textContent = `${matching.length} artigo${matching.length === 1 ? '' : 's'} com #${appState.activeFilter.slice(4)}`;
  } else if (appState.activeFilter.startsWith('chapter:')) {
    count.textContent = `${matching.length} artigo${matching.length === 1 ? '' : 's'} neste capítulo`;
  } else {
    count.textContent = `${matching.length} artigos publicados organizados por capítulo · 35 conceitos no guia oficial`;
  }

  if (emptyState) {
    emptyState.hidden = matching.length > 0;
  }
}

function renderFilterPills() {
  const container = document.querySelector('#archive-filters');
  if (!container) return;

  // Extract all unique tags across catalog
  const tagCounts = new Map();
  appState.catalog.forEach(item => {
    (item.tags || []).forEach(t => {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    });
  });

  // Top subjects sorted by frequency
  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([t]) => t);

  const mainFilters = [
    { id: 'all', label: 'Todos' },
    { id: 'favorites', label: '★ Favoritos' },
    { id: 'chapter:04-cosmos-db-nosql', label: 'Cap. 04 · Cosmos DB' },
    { id: 'comparisons', label: 'Matrizes Comparativas' }
  ];

  const tagFilters = popularTags.map(t => ({
    id: `tag:${t}`,
    label: `#${t}`
  }));

  container.innerHTML = `
    <div class="filter-pill-group filter-group-main">
      ${mainFilters.map(f => `
        <button type="button" class="archive-filter-btn ${appState.activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
      `).join('')}
    </div>
    <div class="filter-pill-group filter-group-tags">
      <span class="filter-tags-label">Assuntos:</span>
      ${tagFilters.map(f => `
        <button type="button" class="archive-filter-btn tag-filter-btn ${appState.activeFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.archive-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appState.activeFilter = btn.dataset.filter || 'all';
      renderFilterPills();
      renderArchiveCards();
    });
  });
}

function renderBlueprintDomains() {
  const container = document.querySelector('#blueprint-domains-container');
  if (!container || !appState.blueprint) return;

  const domains = appState.blueprint.domains || [];
  let html = '';

  for (const d of domains) {
    const domainChapters = (appState.blueprint.chapters || []).filter(c => {
      if (Array.isArray(c.domains) && c.domains.includes(d.id)) return true;
      if (c.exam_domain) return c.exam_domain === d.id;
      if (c.domain) return c.domain === d.id;
      return false;
    });

    let conceptCount = 0;
    domainChapters.forEach(ch => (conceptCount += (ch.concepts || []).length));

    html += `
      <div class="signal-card">
        <p class="eyebrow" style="margin: 0 0 6px;">Peso no Exame: ${d.weight?.min ?? 20}%–${d.weight?.max ?? 25}% · ${conceptCount} conceitos</p>
        <h3>${d.title}</h3>
        <div class="blueprint-chapter-list">
          ${domainChapters
            .map(
              ch => `
            <div class="blueprint-chapter-block">
              <strong>${ch.title}</strong>
              <div class="blueprint-concept-links">
                ${(ch.concepts || [])
                  .map(co => {
                    const item = appState.catalog.find(x => x.slug === co.slug);
                    const href = item ? resolveUrl(item.url) : `#concept/${co.slug}`;
                    return `<a href="${href}" class="blueprint-concept-link ${item ? 'is-published' : ''}">
                      <span>${co.title}</span>
                      ${item ? '<span class="blueprint-badge-live">Ler artigo →</span>' : '<span style="font-size:11px;">Ementa</span>'}
                    </a>`;
                  })
                  .join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function renderHomeView(container) {
  if (!container) return;

  // Ensure the Tech Topics home shell exists inside #app-viewport
  if (!container.querySelector('#recent-list')) {
    container.innerHTML = `
      <header class="archive-intro">
        <span class="eyebrow">Certificação Microsoft Azure · AI-200</span>
        <h1>Arquitetura de dados e contêineres para IA, um conceito por vez.</h1>
        <p>Artigos para dominar sistemas distribuídos, bancos vetoriais, contêineres e observabilidade no Azure — dos fundamentos à prova de certificação.</p>
      </header>
      ${renderStudyGuide(getSiteBase())}
      <section class="archive-section" id="recent-posts" aria-labelledby="archive-heading">
        <div class="archive-toolbar">
          <div>
            <h2 id="archive-heading">Todos os artigos</h2>
            <p id="article-count" class="post-meta" aria-live="polite">Carregando o arquivo…</p>
          </div>
          <div class="archive-filters" id="archive-filters" role="group" aria-label="Filtrar artigos"></div>
        </div>
        <p id="archive-status" class="archive-status" role="status" hidden></p>
        <div class="recent-list" id="recent-list" aria-busy="false"></div>
        <button id="load-more" class="load-more" type="button" hidden>Carregar mais artigos</button>
        <p class="visually-hidden" id="share-status" role="status" aria-live="polite"></p>
        <p id="empty-state" class="empty-state" hidden>Nenhum artigo encontrado. Tente outro termo.</p>
      </section>
      <section class="blueprint-section" id="blueprint-section" aria-labelledby="blueprint-heading">
        <div class="blueprint-section-header">
          <span class="eyebrow">Guia de Estudo Oficial · AI-200T00</span>
          <h2 id="blueprint-heading">Mapa dos 4 Domínios e 9 Capítulos da Prova</h2>
          <p>Roteiro completo ponderado pelos pesos oficiais do exame Microsoft AI-200.</p>
        </div>
        <div class="signal-grid" id="blueprint-domains-container"></div>
      </section>
    `;
  }

  const initialQuery = new URLSearchParams(window.location.search).get('q');
  const searchInput = document.querySelector('#search-input');
  if (initialQuery && searchInput && !searchInput.value) {
    searchInput.value = initialQuery;
  }

  renderFilterPills();
  renderArchiveCards();
  renderBlueprintDomains();
}

// 7. Hash & Pre-rendered Page Router
export function handleRouting() {
  const hash = window.location.hash || '';
  const bodyRoute = document.body?.dataset?.route || 'home';
  const viewport = document.getElementById('app-viewport');
  if (!viewport) return;

  const effectiveRoute = hash && hash !== '#' && hash !== '#/' ? hash.slice(1) : bodyRoute;
  appState.currentRoute = effectiveRoute;

  document.querySelectorAll('.main-nav .nav-link').forEach(link => {
    const route = link.dataset.route;
    if (
      (route === 'home' && (effectiveRoute === 'home' || effectiveRoute === '' || effectiveRoute.startsWith('chapter/') || effectiveRoute.startsWith('comparison/'))) ||
      (route && route !== 'home' && effectiveRoute.startsWith(route))
    ) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Check if we are on a pre-rendered static concept or comparison article page
  const preRenderedContent = document.querySelector('.concept-content, .comparison-content');
  if (
    preRenderedContent &&
    !hash.startsWith('#cram') &&
    !hash.startsWith('#simulator') &&
    !hash.startsWith('#mastery') &&
    !hash.startsWith('#concept/')
  ) {
    initReader(appState.catalog);
    initMermaid();
    return;
  }

  document.body.classList.remove('article-page');
  viewport.className = 'page-shell';

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
      viewport.innerHTML = `
        <header class="archive-intro">
          <span class="eyebrow">Ementa Oficial AI-200 · Em Elaboração</span>
          <h1>${slug}</h1>
          <p>Este conceito faz parte dos 35 tópicos oficiais mapeados em <code>syllabus/ai-200-blueprint.json</code>.</p>
        </header>
        <div class="signal-card" style="max-width: 720px;">
          <h3>Como compilar este artigo</h3>
          <p>Gere o brief de autoria determinístico executando no terminal:</p>
          <pre class="code-block">node scripts/compose-study-brief.mjs --slug ${slug}</pre>
          <p style="margin-top: 14px;"><a class="article-back" href="${resolveUrl('index.html')}">← Voltar para todos os artigos</a></p>
        </div>
      `;
    }
  } else {
    renderHomeView(viewport);
  }

  initMermaid();
}

// Legacy compatibility exports
export function applyTheme() {}
export function setupDrawer() {
  return { openDrawer() {}, closeDrawer() {} };
}
export function renderDrawerContent() {}
export function setupSearchModal() {
  return {
    openSearch() {
      document.querySelector('#search-input')?.focus();
    },
    closeSearch() {}
  };
}

export function setupKeyboardShortcuts() {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', e => {
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.querySelector('#search-input')?.focus();
    } else if (e.altKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      document.getElementById('recall-switch-btn')?.click();
    } else if (['1', '2', '3', '4', '5'].includes(e.key) && !isEditing) {
      const idx = parseInt(e.key, 10) - 1;
      const opt = document.querySelectorAll('.option-item')[idx];
      if (opt) opt.click();
    }
  });
}

// 8. Offline service worker & accessible install guidance
export function registerServiceWorker() {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator && window.isSecureContext) {
    const register = () => {
      // Resolve an absolute URL: pages deep under /chapters/ must share one SW scope.
      const base = new URL(getSiteBase(), document.baseURI);
      navigator.serviceWorker.register(new URL('sw.js', base).href, { scope: base.href })
        .catch(err => console.warn('[SW] Registration failed:', err));
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }

  const buttons = document.querySelectorAll('[data-install-app]');
  const dialog = document.getElementById('install-help');
  const message = document.getElementById('install-help-message');
  const close = document.getElementById('install-help-close');
  let deferredPrompt = null;

  const installed = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;

  const updateInstallButtons = () => {
    buttons.forEach(button => { button.hidden = installed(); });
  };

  const showInstructions = () => {
    const userAgent = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    const isMacSafari = /Macintosh/i.test(userAgent) && /Safari/i.test(userAgent) &&
      !/Chrome|Chromium|Edg/i.test(userAgent);
    const instructions = isIOS
      ? 'No iPhone ou iPad, abra este site no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.'
      : isAndroid
        ? 'No Chrome para Android, abra o menu de três pontos e escolha Instalar app ou Adicionar à tela inicial.'
        : isMacSafari
          ? 'No Safari para Mac, abra o menu Arquivo e selecione Adicionar ao Dock.'
          : 'No Chrome ou Edge para desktop, abra o menu do navegador e selecione Instalar Azure AI-200, ou use o ícone de instalação na barra de endereços.';
    if (message) message.textContent = instructions;
    if (dialog?.showModal) dialog.showModal();
    else window.alert(instructions);
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (dialog?.open) dialog.close();
    updateInstallButtons();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateInstallButtons();
  });
  close?.addEventListener('click', () => dialog?.close());
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (installed()) return;
    if (!deferredPrompt) return showInstructions();
    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (err) {
      console.warn('[PWA] Install prompt unavailable:', err);
      showInstructions();
    }
    updateInstallButtons();
  }));
  updateInstallButtons();
}

// 9. Bootstrap Initialization
export async function initApp() {
  loadGitHubStars();
  setupSearchSuggestions();
  setupKeyboardShortcuts();
  registerServiceWorker();

  await loadAppData();
  handleRouting();

  window.addEventListener('hashchange', handleRouting);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}

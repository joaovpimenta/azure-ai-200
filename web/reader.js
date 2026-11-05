/**
 * web/reader.js
 * Tech Topics article controls (inline audio transport, floating recording dock,
 * favorites, share, recommendations) + Azure AI-200 Active Recall clozes,
 * synchronized SDK code tabs, and self-check cards.
 */
import { AudioPlayer } from './audio-player.js';
import { FAVORITES_KEY, readFavorites, recommendArticles, createCards } from './app.js';

export function getPageMetadata() {
  if (typeof document === 'undefined') return {};
  const el = document.getElementById('page-metadata');
  if (!el) return {};
  try {
    const raw = el.content ? el.content.textContent : (el.textContent || el.innerHTML);
    return JSON.parse(raw.trim() || '{}');
  } catch (err) {
    console.warn('[Reader] Failed to parse page-metadata template:', err);
    return {};
  }
}

export function initReader(catalog = []) {
  const article = document.querySelector('.concept-content, .comparison-content, article');
  if (!article) return;

  setupActiveRecallToolbar(article);
  setupClozeInteraction(article);
  setupSynchronizedCodeTabs(article);
  setupCheckCardsEvaluation(article);
  setupArticleSocialControls(article);
  setupConceptAudioPlayer(article);
  setupRecommendations(article, catalog);
}

// 1. Active Recall Toolbar & Cloze Counting
export function setupActiveRecallToolbar(article) {
  if (document.getElementById('reader-active-recall-bar')) return;

  const clozes = article.querySelectorAll('.cloze');
  if (clozes.length === 0) return;

  const isRecallActive = localStorage.getItem('azure_ai_200_active_recall') !== 'false';
  document.body.dataset.activeRecall = isRecallActive ? 'true' : 'false';

  const toolbar = document.createElement('div');
  toolbar.id = 'reader-active-recall-bar';
  toolbar.className = 'reader-toolbar';
  toolbar.innerHTML = `
    <div class="toolbar-group">
      <button id="recall-switch-btn" type="button" class="recall-toggle-btn" data-state="${isRecallActive ? 'active' : 'inactive'}">
        Praticar de memória: ${isRecallActive ? 'Ligado' : 'Desligado'}
      </button>
      <span id="cloze-progress-badge" class="cloze-counter-badge">
        0/${clozes.length} lacunas reveladas
      </span>
    </div>
    <p>Tente lembrar o termo oculto; clique nele ou use Enter/Espaço para revelar.</p>
    <div class="toolbar-group">
      <button id="reveal-all-cloze-btn" type="button" class="recall-toggle-btn">Revelar todas</button>
      <button id="hide-all-cloze-btn" type="button" class="recall-toggle-btn">Ocultar todas</button>
    </div>
  `;

  const bodyContainer = article.querySelector('#article-body, .concept-body') || article;
  bodyContainer.parentNode.insertBefore(toolbar, bodyContainer);

  const switchBtn = document.getElementById('recall-switch-btn');
  const revealAllBtn = document.getElementById('reveal-all-cloze-btn');
  const hideAllBtn = document.getElementById('hide-all-cloze-btn');
  const badge = document.getElementById('cloze-progress-badge');

  function updateClozeCount() {
    const revealedCount = article.querySelectorAll('.cloze.revealed').length;
    if (badge) {
      badge.textContent = `${revealedCount}/${clozes.length} lacunas reveladas`;
    }
  }

  switchBtn?.addEventListener('click', () => {
    const active = document.body.dataset.activeRecall === 'true';
    const nextState = !active;
    document.body.dataset.activeRecall = nextState ? 'true' : 'false';
    localStorage.setItem('azure_ai_200_active_recall', nextState ? 'true' : 'false');
    switchBtn.dataset.state = nextState ? 'active' : 'inactive';
    switchBtn.textContent = `Praticar de memória: ${nextState ? 'Ligado' : 'Desligado'}`;
  });

  revealAllBtn?.addEventListener('click', () => {
    clozes.forEach(c => {
      c.classList.add('revealed');
      c.setAttribute('aria-expanded', 'true');
    });
    updateClozeCount();
  });

  hideAllBtn?.addEventListener('click', () => {
    clozes.forEach(c => {
      c.classList.remove('revealed');
      c.setAttribute('aria-expanded', 'false');
    });
    updateClozeCount();
  });

  window.__updateClozeCounter = updateClozeCount;
  updateClozeCount();
}

// 2. Cloze Interactive State Machine
export function setupClozeInteraction(container) {
  const clozes = container.querySelectorAll('.cloze');

  clozes.forEach(cloze => {
    if (cloze.dataset.boundCloze === 'true') return;
    cloze.dataset.boundCloze = 'true';

    function toggleCloze() {
      const isRevealed = cloze.classList.contains('revealed');
      if (isRevealed) {
        cloze.classList.remove('revealed');
        cloze.setAttribute('aria-expanded', 'false');
      } else {
        cloze.classList.add('revealed');
        cloze.setAttribute('aria-expanded', 'true');
      }
      if (typeof window.__updateClozeCounter === 'function') {
        window.__updateClozeCounter();
      }
    }

    cloze.addEventListener('click', toggleCloze);
    cloze.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCloze();
      }
    });
  });
}

// 3. Synchronized Code Tabs Handler
export function setupSynchronizedCodeTabs(container) {
  const codeTabBlocks = container.querySelectorAll('.code-tabs');
  if (codeTabBlocks.length === 0) return;

  const currentLang = localStorage.getItem('azure_ai_200_sdk_lang') || 'python';

  function activateLanguage(lang) {
    localStorage.setItem('azure_ai_200_sdk_lang', lang);

    codeTabBlocks.forEach(block => {
      const buttons = block.querySelectorAll('.code-tab-btn');
      const panels = block.querySelectorAll('.code-tab-panel');

      buttons.forEach(btn => {
        const isMatch = btn.dataset.lang === lang;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        btn.tabIndex = isMatch ? 0 : -1;
      });

      panels.forEach(panel => {
        const panelLang = panel.id.includes('python') ? 'python' : 'csharp';
        const isMatch = panelLang === lang;
        panel.classList.toggle('active', isMatch);
        if (isMatch) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });
    });
  }

  activateLanguage(currentLang);

  codeTabBlocks.forEach(block => {
    const buttons = block.querySelectorAll('.code-tab-btn');
    buttons.forEach(btn => {
      if (btn.dataset.boundTab === 'true') return;
      btn.dataset.boundTab = 'true';

      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (lang) activateLanguage(lang);
      });

      btn.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const targetLang = btn.dataset.lang === 'python' ? 'csharp' : 'python';
          activateLanguage(targetLang);
          block.querySelector(`.code-tab-btn[data-lang="${targetLang}"]`)?.focus();
        }
      });
    });
  });
}

// 4. Details Self-Check Rating Handler
export function setupCheckCardsEvaluation(container) {
  const checkCards = container.querySelectorAll('details.check-card');
  const slug = container.dataset?.slug || window.location.pathname;

  checkCards.forEach((card, idx) => {
    const body = card.querySelector('.check-card-body');
    if (!body || body.querySelector('.check-card-rating')) return;

    const ratingBox = document.createElement('div');
    ratingBox.className = 'check-card-rating';
    ratingBox.innerHTML = `
      <span>Você conseguiu responder antes de abrir?</span>
      <div class="rating-btn-group">
        <button type="button" class="rating-btn" data-rating="easy">Sim, sem ajuda</button>
        <button type="button" class="rating-btn" data-rating="medium">Em parte</button>
        <button type="button" class="rating-btn" data-rating="hard">Preciso revisar</button>
      </div>
    `;

    body.appendChild(ratingBox);

    const buttons = ratingBox.querySelectorAll('.rating-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        buttons.forEach(b => {
          b.style.borderColor = 'var(--line)';
          b.style.backgroundColor = 'var(--paper)';
        });
        btn.style.borderColor = 'var(--accent)';
        btn.style.backgroundColor = '#edf5f1';
        recordConceptCheck(slug, idx, btn.dataset.rating);
      });
    });
  });
}

function recordConceptCheck(conceptSlug, cardIndex, rating) {
  try {
    const key = 'azure_ai_200_progress_v1';
    const current = JSON.parse(localStorage.getItem(key) || '{"schemaVersion":1,"conceptProgress":{}}');
    if (!current.conceptProgress) current.conceptProgress = {};
    if (!current.conceptProgress[conceptSlug]) {
      current.conceptProgress[conceptSlug] = { state: 'studying', checks: {} };
    }
    if (!current.conceptProgress[conceptSlug].checks) {
      current.conceptProgress[conceptSlug].checks = {};
    }
    current.conceptProgress[conceptSlug].checks[cardIndex] = {
      rating,
      timestamp: new Date().toISOString()
    };
    current.conceptProgress[conceptSlug].state = rating === 'easy' ? 'mastered' : 'studying';
    current.conceptProgress[conceptSlug].lastModified = new Date().toISOString();
    current.lastModified = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(current));
  } catch (err) {
    console.warn('Could not save check card progress:', err);
  }
}

// 5. Tech Topics Favorite & Share Controls on Article Header
function setupArticleSocialControls(article) {
  const meta = getPageMetadata();
  const slug = article.dataset?.slug || meta.slug;
  if (!slug) return;

  const favoriteButton = document.getElementById('favorite-article');
  const shareButton = document.getElementById('share-article');
  const shareStatus = document.getElementById('share-status');

  function syncFavoriteButton() {
    if (!favoriteButton) return;
    const selected = readFavorites().has(slug);
    favoriteButton.classList.toggle('is-favorite', selected);
    favoriteButton.setAttribute('aria-pressed', String(selected));
    favoriteButton.setAttribute('aria-label', selected ? 'Remover artigo dos favoritos' : 'Adicionar artigo aos favoritos');
    favoriteButton.title = selected ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
  }

  syncFavoriteButton();

  if (favoriteButton && favoriteButton.dataset.boundFav !== 'true') {
    favoriteButton.dataset.boundFav = 'true';
    favoriteButton.addEventListener('click', () => {
      const updated = readFavorites();
      if (updated.has(slug)) updated.delete(slug);
      else updated.add(slug);
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...updated]));
      } catch {}
      syncFavoriteButton();
    });
  }

  if (shareButton && shareButton.dataset.boundShare !== 'true') {
    shareButton.dataset.boundShare = 'true';
    shareButton.addEventListener('click', async () => {
      if (shareStatus) shareStatus.textContent = '';
      const url = window.location.href;
      try {
        if (navigator.share) {
          await navigator.share({ title: meta.title || document.title, text: meta.tldr || '', url });
          if (shareStatus) shareStatus.textContent = 'Artigo compartilhado.';
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          if (shareStatus) shareStatus.textContent = 'Link copiado.';
        }
      } catch (err) {
        if (err?.name !== 'AbortError' && shareStatus) {
          shareStatus.textContent = 'Não foi possível compartilhar este artigo.';
        }
      }
    });
  }
}

// 6. Tech Topics Inline Audio Transport & Floating Recording Dock Wiring
function setupConceptAudioPlayer(article) {
  const meta = getPageMetadata();
  const slug = article.dataset?.slug || meta.slug;
  if (!slug || window.__audioPlayerBound === slug) return;
  window.__audioPlayerBound = slug;

  const player = new AudioPlayer();
  const track = {
    slug,
    title: meta.title || slug,
    chapter: article.dataset?.chapter || meta.chapter || 'Azure AI-200',
    chapterTitle: meta.category || meta.chapter || 'Azure AI-200',
    mp3Url: meta.mp3Url || `https://github.com/joaovpimenta/azure-ai-200/releases/download/tts-${slug}/${slug}.mp3`,
    narrationText: meta.narrationText || meta.tldr || article.textContent || ''
  };
  player.setPlaylist([track], 0, false);
  window.__audioPlayer = player;

  // Bind Tech Topics inline transport + floating dock controls
  const inlinePlay = document.getElementById('listen-recording');
  const inlinePrev = document.getElementById('inline-recording-previous');
  const inlineNext = document.getElementById('inline-recording-next');
  const inlineRate = document.getElementById('inline-recording-rate');
  const inlineSource = document.getElementById('inline-recording-source');
  const inlineElapsed = document.getElementById('inline-recording-elapsed');
  const dock = document.getElementById('recording-player');
  const dockPlay = document.getElementById('recording-play');
  const dockPrev = document.getElementById('recording-previous');
  const dockNext = document.getElementById('recording-skip');
  const dockRate = document.getElementById('recording-rate');
  const dockClose = document.getElementById('recording-close');
  const dockSource = document.getElementById('recording-source');
  const dockSourceMenu = document.getElementById('recording-source-menu');
  const listenDeviceBtn = document.getElementById('listen-article');
  const rates = [1, 1.25, 1.5, 2, 0.75];

  function updateTransportUi() {
    const isPlaying = player.state === 'playing';
    for (const btn of [inlinePlay, dockPlay]) {
      if (!btn) continue;
      btn.dataset.playing = isPlaying ? 'true' : 'false';
      btn.setAttribute('aria-pressed', String(isPlaying));
      btn.setAttribute('aria-label', isPlaying ? 'Pausar narração' : 'Reproduzir narração');
    }
    const rateLabel = `${player.playbackRate}×`;
    if (inlineRate) inlineRate.textContent = rateLabel;
    if (dockRate) dockRate.textContent = rateLabel;

    const srcName = player.mode === 'mp3' ? 'Kokoro Dora' : 'Voz do dispositivo';
    if (inlineSource) {
      inlineSource.textContent = srcName;
      inlineSource.hidden = player.state === 'idle';
    }
    if (dockSource) {
      dockSource.textContent = srcName;
      dockSource.hidden = player.state === 'idle';
    }
    if (dockSourceMenu) {
      dockSourceMenu.textContent = `Fonte atual: ${srcName}`;
    }
    if (dock && isPlaying) {
      dock.hidden = false;
      document.body.classList.add('recording-open');
    }
    if (inlineElapsed && player.chunks?.length > 0) {
      inlineElapsed.textContent = `${player.currentChunkIndex + 1}/${player.chunks.length}`;
    }
  }

  const origUpdateUi = player.updateWidgetUi.bind(player);
  player.updateWidgetUi = () => {
    origUpdateUi();
    updateTransportUi();
  };

  inlinePlay?.addEventListener('click', () => {
    player.togglePlay();
    updateTransportUi();
  });
  dockPlay?.addEventListener('click', () => {
    player.togglePlay();
    updateTransportUi();
  });

  const skipChunk = delta => {
    if (player.mode === 'webspeech' && player.chunks?.length) {
      player.currentChunkIndex = Math.max(0, Math.min(player.chunks.length - 1, player.currentChunkIndex + delta));
      if (player.state === 'playing' && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        player.speakNextChunk();
      }
      updateTransportUi();
    } else if (player.audioElement) {
      player.audioElement.currentTime = Math.max(0, (player.audioElement.currentTime || 0) + delta * 10);
    }
  };

  inlinePrev?.addEventListener('click', () => skipChunk(-1));
  dockPrev?.addEventListener('click', () => skipChunk(-1));
  inlineNext?.addEventListener('click', () => skipChunk(1));
  dockNext?.addEventListener('click', () => skipChunk(1));

  const cycleRate = () => {
    const idx = rates.indexOf(player.playbackRate);
    const nextRate = rates[(idx + 1) % rates.length];
    player.setPlaybackRate(nextRate);
    updateTransportUi();
  };

  inlineRate?.addEventListener('click', cycleRate);
  dockRate?.addEventListener('click', cycleRate);

  listenDeviceBtn?.addEventListener('click', () => {
    player.fallbackToWebSpeech(track.narrationText);
    updateTransportUi();
  });

  dockClose?.addEventListener('click', () => {
    player.pause();
    if (dock) dock.hidden = true;
    document.body.classList.remove('recording-open');
    updateTransportUi();
  });
}

// 7. Recommendations ("Continue explorando")
function setupRecommendations(article, catalog = []) {
  const recSection = document.getElementById('recommendations');
  const recList = document.getElementById('recommendations-list');
  if (!recSection || !recList || !Array.isArray(catalog) || catalog.length === 0) return;

  const meta = getPageMetadata();
  const slug = article.dataset?.slug || meta.slug;
  const suggestions = recommendArticles(catalog, slug);
  if (!suggestions.length) return;

  const { articleCard } = createCards({
    quickActions: document.getElementById('article-quick-actions'),
    shareStatus: document.getElementById('share-status'),
    lazyImages: true
  });

  recList.replaceChildren(...suggestions.map((item, idx) => articleCard(item, idx)));
  recSection.hidden = false;
}

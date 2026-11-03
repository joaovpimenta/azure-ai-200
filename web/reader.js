/**
 * web/reader.js
 * Active Recall cloze mask/reveal controller, synchronized SDK code tabs, and check-card tracking.
 */
import { AudioPlayer } from './audio-player.js';

/**
 * Reads page metadata from <template id="page-metadata">
 * @returns {Record<string, any>}
 */
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

export function initReader() {
  const article = document.querySelector('.concept-content, .comparison-content, article');
  if (!article) return;

  setupActiveRecallToolbar(article);
  setupClozeInteraction(article);
  setupSynchronizedCodeTabs(article);
  setupCheckCardsEvaluation(article);
  setupConceptAudioPlayer(article);
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
      <button id="recall-switch-btn" class="recall-toggle-btn" data-state="${isRecallActive ? 'active' : 'inactive'}">
        🧠 Active Recall: ${isRecallActive ? 'LIGADO' : 'DESLIGADO'}
      </button>
      <span id="cloze-progress-badge" class="cloze-counter-badge">
        0/${clozes.length} lacunas reveladas
      </span>
    </div>
    <div class="toolbar-group">
      <button id="reveal-all-cloze-btn" class="recall-toggle-btn">👁️ Revelar Todas</button>
      <button id="hide-all-cloze-btn" class="recall-toggle-btn">🔒 Ocultar Todas</button>
    </div>
  `;

  article.parentNode.insertBefore(toolbar, article);

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
    switchBtn.textContent = `🧠 Active Recall: ${nextState ? 'LIGADO' : 'DESLIGADO'}`;
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
    cloze.addEventListener('keydown', (e) => {
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

  // Initial synchronization
  activateLanguage(currentLang);

  // Event binding on all tab buttons
  codeTabBlocks.forEach(block => {
    const buttons = block.querySelectorAll('.code-tab-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.lang;
        if (lang) activateLanguage(lang);
      });

      // Keyboard left/right arrow navigation
      btn.addEventListener('keydown', (e) => {
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
      <span>Avalie seu domínio desta resposta:</span>
      <div class="rating-btn-group">
        <button class="rating-btn" data-rating="easy">Fácil 😄</button>
        <button class="rating-btn" data-rating="medium">Médio 🤔</button>
        <button class="rating-btn" data-rating="hard">Difícil 😓</button>
      </div>
    `;

    body.appendChild(ratingBox);

    const buttons = ratingBox.querySelectorAll('.rating-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        buttons.forEach(b => b.style.borderColor = 'var(--border)');
        btn.style.borderColor = 'var(--accent)';
        btn.style.backgroundColor = 'var(--accent-subtle)';

        // Record check card rating into localStorage
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
    current.conceptProgress[conceptSlug].state = 'studying';
    current.conceptProgress[conceptSlug].lastModified = new Date().toISOString();
    current.lastModified = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(current));
  } catch (err) {
    console.warn('Could not save check card progress:', err);
  }
}

// 5. Concept Audio Player Mount
function setupConceptAudioPlayer(article) {
  const meta = getPageMetadata();
  const slug = article.dataset?.slug || meta.slug;
  if (!slug) return;

  if (document.querySelector('.audio-player-widget')) return;

  const player = new AudioPlayer();
  const track = {
    slug,
    title: meta.title || slug,
    chapter: article.dataset?.chapter || meta.chapter || 'Trilha',
    chapterTitle: meta.chapterTitle || meta.chapter || 'Azure AI-200',
    mp3Url: meta.mp3Url || `https://github.com/joaovpimenta/azure-ai-200/releases/download/tts-${slug}/${slug}.mp3`,
    narrationText: meta.narrationText || meta.tldr || ''
  };

  player.setPlaylist([track], 0, false);
  player.mountWidget(document.body);
  window.__audioPlayer = player;
}

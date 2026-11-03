/**
 * scripts/build-site.mjs
 * Static site pre-renderer and compiler for Azure AI-200 (forked from Tech Topics look & feel).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { extractFrontmatter } from './lib/frontmatter.mjs';
import { compileMarkdown } from './lib/markdown.mjs';
import { escapeHtml } from './lib/cloze.mjs';

const ROOT_DIR = resolve(process.cwd());
const DIST_DIR = join(ROOT_DIR, 'dist');
const WEB_DIR = join(ROOT_DIR, 'web');
const CHAPTERS_DIR = join(ROOT_DIR, 'chapters');
const COMPARISONS_DIR = join(ROOT_DIR, 'comparisons');
const EXAMS_DIR = join(ROOT_DIR, 'exams');
const SYLLABUS_FILE = join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json');

const CHAPTER_LABELS = {
  '01-container-hosting': 'Cap. 01 · Hospedagem de Contêineres',
  '02-container-apps': 'Cap. 02 · Azure Container Apps',
  '03-aks': 'Cap. 03 · Azure Kubernetes Service',
  '04-cosmos-db-nosql': 'Cap. 04 · Azure Cosmos DB for NoSQL',
  '05-postgresql-pgvector': 'Cap. 05 · PostgreSQL & pgvector',
  '06-managed-redis': 'Cap. 06 · Azure Managed Redis',
  '07-backend-integration': 'Cap. 07 · Integração de Back-end',
  '08-secrets-and-config': 'Cap. 08 · Segredos e Configuração',
  '09-observe-and-troubleshoot': 'Cap. 09 · Observabilidade e Diagnóstico',
  comparisons: 'Matriz Comparativa · Arquitetura de Decisão'
};

const DIFFICULTY_LABELS = {
  fundamental: 'Introdutório',
  intermediate: 'Intermediário',
  advanced: 'Avançado'
};

/**
 * Generates an editorial watercolor-on-paper SVG cover matching Tech Topics visual language.
 */
function generateEditorialCoverSvg({ slug, title, category, tags = [], index = 0 }) {
  const palettes = [
    { washA: '#d8eadf', washB: '#f1dfbd', stroke: '#277d69', accent: '#a98135' },
    { washA: '#dce8ed', washB: '#f2e2c6', stroke: '#277d69', accent: '#8b4423' },
    { washA: '#e2ebdc', washB: '#eddcc4', stroke: '#1f6a58', accent: '#9e6b2e' },
    { washA: '#d6e9e1', washB: '#f4e3c1', stroke: '#277d69', accent: '#7d5228' },
    { washA: '#dfeae2', washB: '#f0dec0', stroke: '#216a59', accent: '#a98135' },
    { washA: '#d9eae3', washB: '#efe0c5', stroke: '#277d69', accent: '#8b4423' }
  ];
  const p = palettes[index % palettes.length];
  const tag1 = escapeHtml((tags[0] || 'azure').toUpperCase());
  const tag2 = escapeHtml((tags[1] || 'ai-200').toUpperCase());
  const tag3 = escapeHtml((tags[2] || 'architecture').toUpperCase());
  const safeCat = escapeHtml(category || 'Engenharia de Dados & IA');
  const shortTitle = escapeHtml((title || slug).slice(0, 52));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="${shortTitle}">
  <defs>
    <radialGradient id="wash1-${index}" cx="28%" cy="32%" r="55%">
      <stop offset="0%" stop-color="${p.washA}" stop-opacity="0.92"/>
      <stop offset="70%" stop-color="${p.washA}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#f8f6f0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="wash2-${index}" cx="74%" cy="65%" r="52%">
      <stop offset="0%" stop-color="${p.washB}" stop-opacity="0.88"/>
      <stop offset="68%" stop-color="${p.washB}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#f8f6f0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- Warm textured paper background -->
  <rect width="800" height="450" fill="#f8f6f0"/>
  <rect width="800" height="450" fill="url(#wash1-${index})"/>
  <rect width="800" height="450" fill="url(#wash2-${index})"/>
  <rect x="18" y="18" width="764" height="414" rx="8" fill="none" stroke="#d5ddd8" stroke-width="1.5"/>

  <!-- Architectural watercolor sketch & dashed callout rings (Tech Topics visual style) -->
  <g stroke="${p.stroke}" stroke-width="2" fill="none" opacity="0.85">
    <rect x="88" y="128" width="160" height="190" rx="10" fill="#ffffff" fill-opacity="0.65"/>
    <line x1="112" y1="168" x2="224" y2="168" stroke-width="2.2"/>
    <line x1="112" y1="196" x2="204" y2="196" stroke="#6b6b6b" stroke-width="1.5"/>
    <line x1="112" y1="220" x2="216" y2="220" stroke="#6b6b6b" stroke-width="1.5"/>
    <rect x="112" y="252" width="112" height="42" rx="6" fill="${p.washA}" stroke="${p.stroke}" stroke-dasharray="5 4"/>

    <circle cx="408" cy="224" r="78" fill="#ffffff" fill-opacity="0.68" stroke="${p.stroke}" stroke-width="2.2"/>
    <circle cx="408" cy="224" r="94" stroke="${p.accent}" stroke-width="1.8" stroke-dasharray="7 6"/>
    <circle cx="408" cy="224" r="34" fill="${p.washA}" stroke="${p.stroke}" stroke-width="2"/>
    <circle cx="384" cy="196" r="6" fill="${p.stroke}"/>
    <circle cx="432" cy="212" r="6" fill="${p.accent}"/>
    <circle cx="402" cy="248" r="6" fill="${p.stroke}"/>
    <line x1="384" y1="196" x2="432" y2="212" stroke-width="1.6"/>
    <line x1="432" y1="212" x2="402" y2="248" stroke-width="1.6"/>
    <line x1="402" y1="248" x2="384" y2="196" stroke-width="1.6"/>

    <rect x="556" y="128" width="156" height="190" rx="10" fill="#ffffff" fill-opacity="0.65"/>
    <rect x="580" y="156" width="108" height="36" rx="5" fill="${p.washB}"/>
    <rect x="580" y="206" width="108" height="36" rx="5" fill="${p.washA}"/>
    <rect x="580" y="256" width="108" height="36" rx="5" fill="#ffffff"/>

    <!-- Dashed flow arrows -->
    <path d="M 248 224 C 278 224, 292 224, 326 224" stroke="${p.accent}" stroke-width="2.4" stroke-dasharray="6 5"/>
    <polygon points="326,224 316,218 316,230" fill="${p.accent}" stroke="none"/>
    <path d="M 490 224 C 516 224, 528 224, 552 224" stroke="${p.stroke}" stroke-width="2.4" stroke-dasharray="6 5"/>
    <polygon points="552,224 542,218 542,230" fill="${p.stroke}" stroke="none"/>
  </g>

  <!-- Editorial caption strip -->
  <text x="52" y="64" fill="#277d69" font-family="Cabin, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="1.6">${safeCat.toUpperCase()}</text>
  <text x="52" y="388" fill="#252525" font-family="Lora, Georgia, serif" font-size="22" font-weight="700">${shortTitle}</text>
  <g font-family="Cabin, Arial, sans-serif" font-size="12" font-weight="600" fill="#173b32">
    <rect x="52" y="400" width="96" height="22" rx="11" fill="#d8eadf"/>
    <text x="100" y="415" text-anchor="middle">${tag1}</text>
    <rect x="158" y="400" width="106" height="22" rx="11" fill="#f1dfbd" fill-opacity="0.85"/>
    <text x="211" y="415" text-anchor="middle" fill="#463717">${tag2}</text>
    <rect x="274" y="400" width="124" height="22" rx="11" fill="#e8f0eb"/>
    <text x="336" y="415" text-anchor="middle">${tag3}</text>
  </g>
</svg>`;
}

// Helper for depth-relative root path
export function computeRootRel(targetFilePath, distRoot) {
  const rel = relative(dirname(targetFilePath), distRoot);
  if (!rel || rel === '.' || rel === '') return './';
  let norm = rel.replace(/\\/g, '/');
  if (!norm.endsWith('/')) norm += '/';
  return norm;
}

// Global Shell HTML Generator (Tech Topics exact chrome + F-01 CSP compliance)
export function renderHtmlShell({ title, description, content, rootRel, currentRoute = '', metadata = {} }) {
  const metaJson = JSON.stringify(metadata).replace(/</g, '\\u003c');
  const isArticle = currentRoute.startsWith('chapter/') || currentRoute.startsWith('comparison/');
  const bodyClass = isArticle ? ' class="article-page"' : '';
  const mainClass = isArticle ? 'article-shell' : 'page-shell';
  const skipTarget = isArticle ? '#article-root' : '#recent-posts';
  const skipLabel = isArticle ? 'Ir para o artigo' : 'Ir para os artigos';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="site-base" content="${rootRel}" />
  <meta id="article-description" name="description" content="${escapeHtml(description || 'Tech Topics · Azure AI-200 — arquivo de artigos e estudo ativo sobre arquitetura de dados e contêineres para IA.')}" />
  <title>${title ? `${escapeHtml(title)} — Azure AI-200` : 'Azure AI-200 — Arquivo de artigos e estudo'}</title>
  <meta name="theme-color" content="#277d69" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="Azure AI-200" />
  <link rel="manifest" href="${rootRel}manifest.webmanifest" />
  <link rel="icon" href="${rootRel}favicon.ico" type="image/x-icon" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600;700&family=Lora:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${rootRel}styles.css" />
  <template id="page-metadata">${metaJson}</template>
  <script type="module" src="${rootRel}app.js"></script>
</head>
<body${bodyClass} data-route="${currentRoute}" data-active-recall="true">
  <a class="skip-link" href="${skipTarget}">${skipLabel}</a>
  <header class="site-header">
    <div class="header-inner home-header-inner">
      <a class="brand" href="${rootRel}index.html" aria-label="Azure AI-200 — página inicial">Azure AI-200</a>
      <form class="top-search" action="${rootRel}index.html" method="get" role="search">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>
        <label class="visually-hidden" for="search-input">Buscar artigo</label>
        <input id="search-input" name="q" type="search" placeholder="Buscar artigo" autocomplete="off" enterkeyhint="search" />
        <div id="search-suggestions" class="search-suggestions" role="region" aria-label="Sugestões de artigos" hidden></div>
      </form>
      <div class="header-actions">
        <nav class="main-nav" aria-label="Navegação Principal">
          <a href="${rootRel}index.html" class="header-link nav-link ${currentRoute === 'home' ? 'active' : ''}" data-route="home">Artigos</a>
          <a href="${rootRel}cram/index.html" class="header-link nav-link ${currentRoute === 'cram' ? 'active' : ''}" data-route="cram">Cram</a>
          <a href="${rootRel}simulator/index.html" class="header-link nav-link ${currentRoute === 'simulator' ? 'active' : ''}" data-route="simulator">Simulado</a>
          <a href="${rootRel}mastery/index.html" class="header-link nav-link ${currentRoute === 'mastery' ? 'active' : ''}" data-route="mastery">Prontidão</a>
        </nav>
        <a class="github-stars" href="https://github.com/joaovpimenta/azure-ai-200" target="_blank" rel="noopener noreferrer" aria-label="Ver repositório Azure AI-200 no GitHub" title="Estrelas do repositório no GitHub">
          <svg aria-hidden="true" class="github-mark" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          <span class="github-star-label"><span aria-hidden="true">★</span> <span id="github-stars">—</span></span>
        </a>
      </div>
    </div>
  </header>

  <main id="app-viewport" class="${mainClass}" role="main">
    ${content}
  </main>

  <section class="recording-dock" id="recording-player" aria-label="Player do áudio gravado do artigo" hidden>
    <audio id="article-recording" preload="none"></audio>
    <div class="recording-cover-ring" id="recording-ring">
      <img id="recording-cover" alt="" />
    </div>
    <div class="recording-info">
      <strong id="recording-title" class="recording-title"></strong>
      <span class="recording-subtitle" id="recording-subtitle">Azure AI-200 · Narração</span>
      <div class="recording-progress">
        <span id="recording-elapsed" class="recording-time">0:00</span>
        <input id="recording-seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Posição da narração" disabled />
        <span id="recording-duration" class="recording-time">–:––</span>
      </div>
    </div>
    <div class="recording-actions">
      <button id="recording-rate" class="recording-rate" type="button" aria-label="Velocidade da narração: 1 vez">1×</button>
      <span id="recording-source" class="recording-source-label" hidden></span>
      <button id="recording-previous" class="recording-skip" type="button" aria-label="Frase anterior" title="Frase anterior">
        <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M19 5 10 12l9 7V5Z"/><path d="M6 5v14"/></svg>
      </button>
      <button id="recording-play" class="recording-play" type="button" data-playing="false" aria-label="Reproduzir narração" aria-pressed="false">
        <svg class="recording-icon-play" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5A1 1 0 0 1 7 19.5z"/></svg>
        <svg class="recording-icon-pause" aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>
      </button>
      <button id="recording-skip" class="recording-skip" type="button" aria-label="Próxima frase" title="Próxima frase">
        <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="m5 5 9 7-9 7V5Z"/><path d="M18 5v14"/></svg>
      </button>
      <details class="recording-options">
        <summary aria-label="Outras opções de áudio" title="Outras opções de áudio">···</summary>
        <div class="recording-options-menu">
          <p id="recording-source-menu" class="recording-source-current">Fonte atual: não iniciada</p>
          <button id="listen-article" type="button" aria-pressed="false">Usar voz do dispositivo</button>
          <label class="recording-follow"><input id="recording-follow" type="checkbox" checked /> Acompanhar frase</label>
        </div>
      </details>
      <button id="recording-close" class="recording-close" type="button" aria-label="Fechar player" title="Fechar player">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"><path d="M5 5 19 19M19 5 5 19"/></svg>
      </button>
    </div>
  </section>

  <div class="article-quick-actions" id="article-quick-actions" role="dialog" aria-modal="false" aria-labelledby="quick-preview-title" hidden></div>

  <footer class="site-footer">
    <div class="footer-inner">
      <p>Azure AI-200 · Arquivo de arquitetura de dados e contêineres para IA · Inspirado em Tech Topics</p>
      <button id="install-app" class="header-link install-app" type="button" hidden>Instalar app</button>
    </div>
  </footer>
</body>
</html>`;
}

function buildArticleEnvelope({ slug, chFolder, category, title, dek, metaText, coverRelPath, bodyHtml, relatedLinks = [], rootRel }) {
  // Strip leading <h1> from compiled markdown body so it does not duplicate #article-heading
  const cleanedBody = bodyHtml.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');
  const refsHtml = Array.isArray(relatedLinks) && relatedLinks.length > 0
    ? `<aside class="article-references-box">
        <h3>Referências Oficiais Microsoft Learn</h3>
        <ul class="article-references-list">
          ${relatedLinks.map(l => `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a></li>`).join('\n          ')}
        </ul>
      </aside>`
    : '';

  return `<article class="concept-content" id="article-root" data-slug="${slug}" data-chapter="${chFolder}">
  <header class="article-header">
    <span class="eyebrow" id="article-category">${escapeHtml(category)}</span>
    <h1 id="article-heading">${escapeHtml(title)}</h1>
    <p class="dek" id="article-dek">${escapeHtml(dek)}</p>
    <div class="article-meta" id="article-meta">${escapeHtml(metaText)}</div>
    <div class="article-actions" id="article-actions">
      <div class="inline-recording-anchor" id="inline-recording-anchor">
        <div class="inline-recording" id="inline-recording" role="group" aria-label="Player de áudio do artigo">
          <button class="inline-recording-play recording-trigger" id="listen-recording" type="button" aria-label="Reproduzir narração" aria-pressed="false" data-playing="false">
            <svg class="recording-icon-play" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5A1 1 0 0 1 7 19.5z"/></svg>
            <svg class="recording-icon-pause" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1.5"/><rect x="14" y="4" width="5" height="16" rx="1.5"/></svg>
            <span class="recording-button-label visually-hidden">Ouvir artigo</span>
          </button>
          <button type="button" id="inline-recording-previous" class="inline-recording-skip" aria-label="Trecho anterior" title="Trecho anterior">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m19 5-9 7 9 7V5Z"/><path d="M6 5v14"/></svg>
          </button>
          <button type="button" id="inline-recording-next" class="inline-recording-skip" aria-label="Próximo trecho" title="Próximo trecho">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 5 9 7-9 7V5Z"/><path d="M18 5v14"/></svg>
          </button>
          <div class="inline-recording-timeline" id="inline-recording-timeline">
            <span class="inline-recording-elapsed" id="inline-recording-elapsed">0:00</span>
            <input class="inline-recording-seek" type="range" id="inline-recording-seek" min="0" max="1000" value="0" step="1" aria-label="Posição da narração" />
            <span class="inline-recording-duration" id="inline-recording-duration">–:––</span>
          </div>
          <button type="button" class="inline-recording-rate" id="inline-recording-rate" title="Alterar velocidade" aria-label="Velocidade da narração: 1 vez">1×</button>
          <span id="inline-recording-source" class="recording-source-label" hidden></span>
        </div>
      </div>
      <div class="article-social-actions">
        <button class="article-icon-button favorite-button" id="favorite-article" type="button" aria-label="Adicionar artigo aos favoritos" aria-pressed="false" title="Favoritar">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>
        </button>
        <button class="article-icon-button" id="share-article" type="button" aria-label="Compartilhar artigo" title="Compartilhar">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m0 0L7 8m5-5 5 5M5 13v5a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-5"/></svg>
        </button>
      </div>
      <span class="listen-status" id="listen-status" role="status" aria-live="polite"></span>
      <span class="listen-status" id="recording-status" role="status" aria-live="polite"></span>
      <span class="share-status" id="share-status" role="status" aria-live="polite"></span>
    </div>
  </header>
  <div class="article-hero"><img id="article-image" src="${rootRel}${coverRelPath}" alt="${escapeHtml(title)}" /></div>
  <div class="article-body concept-body fgs-guide" id="article-body">
    ${cleanedBody}
  </div>
  ${refsHtml}
  <section class="recommendations-section" id="recommendations" aria-labelledby="recommendations-heading" hidden>
    <h2 id="recommendations-heading">Continue explorando</h2>
    <div class="recent-list" id="recommendations-list"></div>
  </section>
  <p><a class="article-back" href="${rootRel}index.html#recent-posts">← Todos os artigos</a></p>
</article>`;
}

// Execute build when run as script or imported
console.log('\n🚀 Starting Azure AI-200 Static Site Build...\n');

if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}
mkdirSync(DIST_DIR, { recursive: true });
mkdirSync(join(DIST_DIR, 'data'), { recursive: true });
mkdirSync(join(DIST_DIR, 'assets', 'covers'), { recursive: true });

writeFileSync(join(DIST_DIR, '.nojekyll'), '');

if (!existsSync(SYLLABUS_FILE)) {
  console.error(`❌ Blueprint not found at ${SYLLABUS_FILE}`);
  process.exit(1);
}
const blueprint = JSON.parse(readFileSync(SYLLABUS_FILE, 'utf-8'));
writeFileSync(join(DIST_DIR, 'data', 'blueprint.json'), JSON.stringify(blueprint, null, 2), 'utf-8');

const catalog = [];
const cramIndex = [];
const questionsBank = [];
let coverCounter = 0;

// 3. Compile Chapters and Concepts
if (existsSync(CHAPTERS_DIR)) {
  const chapterFolders = readdirSync(CHAPTERS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const chFolder of chapterFolders) {
    const chPath = join(CHAPTERS_DIR, chFolder);
    const files = readdirSync(chPath).filter(f => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

    for (const file of files) {
      const fullPath = join(chPath, file);
      const rawText = readFileSync(fullPath, 'utf-8');
      const { data, content } = extractFrontmatter(rawText, fullPath);
      const slug = data.slug || file.replace(/\.md$/, '');
      const outDir = join(DIST_DIR, 'chapters', chFolder, slug);
      mkdirSync(outDir, { recursive: true });
      const outFile = join(outDir, 'index.html');
      const rootRel = computeRootRel(outFile, DIST_DIR);

      const compiled = compileMarkdown(content);
      const category = CHAPTER_LABELS[chFolder] || chFolder;
      const diffLabel = DIFFICULTY_LABELS[data.difficulty] || 'Intermediário';
      const readMin = data.estimated_minutes || Math.max(8, Math.round(rawText.split(/\s+/).length / 160));
      const readStr = `${readMin} min de leitura`;
      const metaText = [diffLabel, readStr, `${compiled.metadata?.clozeCount || 0} pontos de recordação ativa`].join(' · ');

      // Generate cover SVG
      const coverRelPath = `assets/covers/${slug}.svg`;
      const svgContent = generateEditorialCoverSvg({
        slug,
        title: data.title || slug,
        category,
        tags: data.tags || [],
        index: coverCounter++
      });
      writeFileSync(join(DIST_DIR, coverRelPath), svgContent, 'utf-8');

      const conceptHtml = buildArticleEnvelope({
        slug,
        chFolder,
        category,
        title: data.title || slug,
        dek: data.tldr || '',
        metaText,
        coverRelPath,
        bodyHtml: compiled.html,
        relatedLinks: data.related_links || [],
        rootRel
      });

      const pageHtml = renderHtmlShell({
        title: data.title,
        description: data.tldr,
        content: conceptHtml,
        rootRel,
        currentRoute: `chapter/${chFolder}/${slug}`,
        metadata: {
          ...data,
          category,
          read: readStr,
          image: coverRelPath,
          narrationText: compiled.metadata?.narrationText || ''
        }
      });

      writeFileSync(outFile, pageHtml, 'utf-8');

      catalog.push({
        id: slug,
        type: 'concept',
        title: data.title,
        slug,
        chapter: chFolder,
        category,
        read: readStr,
        date: diffLabel,
        image: coverRelPath,
        alt: data.title,
        dek: data.tldr,
        excerpt: data.tldr,
        opening: (compiled.metadata?.narrationText || data.tldr || '').slice(0, 320),
        exam_domain: data.exam_domain,
        tags: data.tags || [],
        difficulty: data.difficulty,
        tldr: data.tldr,
        narrationText: compiled.metadata?.narrationText || '',
        url: `chapters/${chFolder}/${slug}/index.html`
      });

      cramIndex.push({
        slug,
        title: data.title,
        chapter: chFolder,
        category,
        exam_domain: data.exam_domain,
        tldr: data.tldr,
        pegadinhas: compiled.pegadinhas.raw,
        pegadinhasHtml: compiled.pegadinhas.html
      });

      if (Array.isArray(data.questions)) {
        questionsBank.push(...data.questions);
      }
    }
  }
}

// 4. Compile Comparisons
if (existsSync(COMPARISONS_DIR)) {
  const cmpFiles = readdirSync(COMPARISONS_DIR).filter(f => f.endsWith('.md'));
  for (const file of cmpFiles) {
    const fullPath = join(COMPARISONS_DIR, file);
    const rawText = readFileSync(fullPath, 'utf-8');
    const { data, content } = extractFrontmatter(rawText, fullPath);
    const slug = data.slug || file.replace(/\.md$/, '');
    const outDir = join(DIST_DIR, 'comparisons', slug);
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'index.html');
    const rootRel = computeRootRel(outFile, DIST_DIR);

    const compiled = compileMarkdown(content);
    const category = CHAPTER_LABELS.comparisons;
    const diffLabel = DIFFICULTY_LABELS[data.difficulty] || 'Avançado';
    const readMin = data.estimated_minutes || 12;
    const readStr = `${readMin} min de leitura`;
    const metaText = [diffLabel, readStr, 'Matriz Comparativa'].join(' · ');

    const coverRelPath = `assets/covers/${slug}.svg`;
    const svgContent = generateEditorialCoverSvg({
      slug,
      title: data.title || slug,
      category,
      tags: data.tags || [],
      index: coverCounter++
    });
    writeFileSync(join(DIST_DIR, coverRelPath), svgContent, 'utf-8');

    const cmpHtml = buildArticleEnvelope({
      slug,
      chFolder: 'comparisons',
      category,
      title: data.title || slug,
      dek: data.tldr || 'Matriz Comparativa de Decisão Arquitetural',
      metaText,
      coverRelPath,
      bodyHtml: compiled.html,
      relatedLinks: data.related_links || [],
      rootRel
    });

    const pageHtml = renderHtmlShell({
      title: data.title,
      description: data.tldr || 'Matriz Comparativa de Decisão',
      content: cmpHtml,
      rootRel,
      currentRoute: `comparison/${slug}`,
      metadata: {
        ...data,
        category,
        read: readStr,
        image: coverRelPath,
        narrationText: compiled.metadata?.narrationText || ''
      }
    });

    writeFileSync(outFile, pageHtml, 'utf-8');

    catalog.push({
      id: slug,
      type: 'comparison',
      title: data.title,
      slug,
      chapter: 'comparisons',
      category,
      read: readStr,
      date: diffLabel,
      image: coverRelPath,
      alt: data.title,
      dek: data.tldr,
      excerpt: data.tldr,
      opening: (compiled.metadata?.narrationText || data.tldr || '').slice(0, 320),
      exam_domain: data.exam_domain || 'data-management',
      tags: data.tags || [],
      difficulty: data.difficulty || 'advanced',
      tldr: data.tldr,
      narrationText: compiled.metadata?.narrationText || '',
      url: `comparisons/${slug}/index.html`
    });
  }
}

// 5. Compile Scenarios & Case Studies
if (existsSync(EXAMS_DIR)) {
  const scenariosDir = join(EXAMS_DIR, 'scenarios');
  if (existsSync(scenariosDir)) {
    for (const f of readdirSync(scenariosDir).filter(x => x.endsWith('.json'))) {
      try {
        const qData = JSON.parse(readFileSync(join(scenariosDir, f), 'utf-8'));
        if (Array.isArray(qData)) questionsBank.push(...qData);
        else questionsBank.push(qData);
      } catch (err) {
        console.warn(`Warning: Could not parse scenario ${f}: ${err.message}`);
      }
    }
  }
  const caseStudiesDir = join(EXAMS_DIR, 'case-studies');
  if (existsSync(caseStudiesDir)) {
    for (const f of readdirSync(caseStudiesDir).filter(x => x.endsWith('.json'))) {
      try {
        const csData = JSON.parse(readFileSync(join(caseStudiesDir, f), 'utf-8'));
        questionsBank.push(csData);
      } catch (err) {
        console.warn(`Warning: Could not parse case-study ${f}: ${err.message}`);
      }
    }
  }
}

// 6. Write JSON datasets
writeFileSync(join(DIST_DIR, 'data', 'catalog.json'), JSON.stringify(catalog, null, 2), 'utf-8');
writeFileSync(join(DIST_DIR, 'data', 'cram-index.json'), JSON.stringify(cramIndex, null, 2), 'utf-8');
writeFileSync(join(DIST_DIR, 'data', 'questions.json'), JSON.stringify(questionsBank, null, 2), 'utf-8');

// 7. Generate Pre-rendered Views (Index, Cram, Simulator, Mastery)
const homeContent = `<header class="archive-intro">
  <span class="eyebrow">Certificação Microsoft Azure · AI-200</span>
  <h1>Arquitetura de dados e contêineres para IA, um conceito por vez.</h1>
  <p>Artigos para dominar sistemas distribuídos, bancos vetoriais, contêineres e observabilidade no Azure — dos fundamentos à prova de certificação.</p>
</header>
<section class="archive-section" id="recent-posts" aria-labelledby="archive-heading">
  <div class="archive-toolbar">
    <div>
      <h2 id="archive-heading">Todos os artigos</h2>
      <p id="article-count" class="post-meta" aria-live="polite">Carregando o arquivo…</p>
    </div>
    <div class="archive-filters" id="archive-filters" role="group" aria-label="Filtrar artigos"></div>
  </div>
  <p id="archive-status" class="archive-status" role="status" hidden></p>
  <div class="recent-list" id="recent-list" aria-busy="true"></div>
  <button id="load-more" class="load-more" type="button" hidden>Carregar mais artigos</button>
  <p class="visually-hidden" id="share-status" role="status" aria-live="polite"></p>
  <p id="empty-state" class="empty-state" hidden>Nenhum artigo encontrado. Tente outro termo.</p>
  <noscript><p>Ative o JavaScript para carregar os artigos deste arquivo.</p></noscript>
</section>
<section class="blueprint-section" id="blueprint-section" aria-labelledby="blueprint-heading">
  <div class="blueprint-section-header">
    <span class="eyebrow">Guia de Estudo Oficial · AI-200T00</span>
    <h2 id="blueprint-heading">Mapa dos 4 Domínios e 9 Capítulos da Prova</h2>
    <p>Roteiro completo ponderado pelos pesos oficiais do exame Microsoft AI-200.</p>
  </div>
  <div class="signal-grid" id="blueprint-domains-container"></div>
</section>`;

const views = [
  { file: 'index.html', title: 'Arquivo de artigos', route: 'home', content: homeContent },
  { file: 'cram/index.html', title: 'Cram Sheet de Alta Densidade', route: 'cram', content: '<div id="cram-view">Carregando resumos de véspera...</div>' },
  { file: 'simulator/index.html', title: 'Simulador de Exame AI-200', route: 'simulator', content: '<div id="simulator-view">Carregando simulador de questões...</div>' },
  { file: 'mastery/index.html', title: 'Mapa de Cobertura e Prontidão', route: 'mastery', content: '<div id="mastery-view">Carregando métricas de prontidão...</div>' }
];

for (const v of views) {
  const destPath = join(DIST_DIR, v.file);
  mkdirSync(dirname(destPath), { recursive: true });
  const rootRel = computeRootRel(destPath, DIST_DIR);
  const html = renderHtmlShell({
    title: v.title,
    content: v.content,
    rootRel,
    currentRoute: v.route
  });
  writeFileSync(destPath, html, 'utf-8');
}

// 8. Copy static web assets
if (existsSync(WEB_DIR)) {
  cpSync(WEB_DIR, DIST_DIR, {
    recursive: true,
    filter: (src) => !src.endsWith('index.html')
  });
  console.log('✓ Copied static assets from web/ to dist/');
}

console.log(`\n🎉 Static build completed successfully!`);
console.log(`   - Concepts compiled: ${catalog.filter(c => c.type === 'concept').length}`);
console.log(`   - Comparisons compiled: ${catalog.filter(c => c.type === 'comparison').length}`);
console.log(`   - Exam questions assembled: ${questionsBank.length}`);
console.log(`   - Output directory: ${DIST_DIR}\n`);

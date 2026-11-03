/**
 * scripts/build-site.mjs
 * Static site pre-renderer and compiler for Azure AI-200 Study Hub.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, readdirSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { extractFrontmatter } from './lib/frontmatter.mjs';
import { compileMarkdown } from './lib/markdown.mjs';

const ROOT_DIR = resolve(process.cwd());
const DIST_DIR = join(ROOT_DIR, 'dist');
const WEB_DIR = join(ROOT_DIR, 'web');
const CHAPTERS_DIR = join(ROOT_DIR, 'chapters');
const COMPARISONS_DIR = join(ROOT_DIR, 'comparisons');
const EXAMS_DIR = join(ROOT_DIR, 'exams');
const SYLLABUS_FILE = join(ROOT_DIR, 'syllabus', 'ai-200-blueprint.json');

console.log('\n🚀 Starting Azure AI-200 Static Site Build...\n');

// 1. Clean and initialize dist/
if (existsSync(DIST_DIR)) {
  rmSync(DIST_DIR, { recursive: true, force: true });
}
mkdirSync(DIST_DIR, { recursive: true });
mkdirSync(join(DIST_DIR, 'data'), { recursive: true });

// GitHub Pages .nojekyll flag
writeFileSync(join(DIST_DIR, '.nojekyll'), '');

// 2. Load Blueprint
if (!existsSync(SYLLABUS_FILE)) {
  console.error(`❌ Blueprint not found at ${SYLLABUS_FILE}`);
  process.exit(1);
}
const blueprint = JSON.parse(readFileSync(SYLLABUS_FILE, 'utf-8'));
writeFileSync(join(DIST_DIR, 'data', 'blueprint.json'), JSON.stringify(blueprint, null, 2), 'utf-8');

// Helper for depth-relative root path
export function computeRootRel(targetFilePath, distRoot) {
  const rel = relative(dirname(targetFilePath), distRoot);
  if (!rel || rel === '.' || rel === '') return './';
  let norm = rel.replace(/\\/g, '/');
  if (!norm.endsWith('/')) norm += '/';
  return norm;
}

// Global Shell HTML Generator
export function renderHtmlShell({ title, description, content, rootRel, currentRoute = '', metadata = {} }) {
  const metaJson = JSON.stringify(metadata).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="site-base" content="${rootRel}">
  <meta name="description" content="${description || 'Plataforma de estudos para o Exame Microsoft AI-200'}">
  <title>${title ? `${title} — Azure AI-200 Study Hub` : 'Azure AI-200 Study Hub'}</title>
  <link rel="stylesheet" href="${rootRel}styles.css">
  <link rel="manifest" href="${rootRel}manifest.webmanifest">
  <link rel="icon" href="${rootRel}favicon.ico" type="image/x-icon">
  <template id="page-metadata">${metaJson}</template>
  <script type="module" src="${rootRel}app.js"></script>
</head>
<body data-route="${currentRoute}" data-active-recall="true">
  <header class="app-header">
    <div class="header-inner">
      <div class="header-left">
        <button id="drawer-toggle" class="drawer-toggle" aria-label="Abrir Ementa" aria-expanded="false">
          ☰
        </button>
        <a href="${rootRel}index.html" class="brand-link">
          <span class="brand-badge">AI-200</span>
          <span class="brand-title">Study Hub</span>
        </a>
      </div>
      <nav class="main-nav" aria-label="Navegação Principal">
        <a href="${rootRel}index.html" class="nav-link ${currentRoute === 'home' ? 'active' : ''}" data-route="home">Trilhas</a>
        <a href="${rootRel}cram/index.html" class="nav-link ${currentRoute === 'cram' ? 'active' : ''}" data-route="cram">Cram Sheet</a>
        <a href="${rootRel}simulator/index.html" class="nav-link ${currentRoute === 'simulator' ? 'active' : ''}" data-route="simulator">Simulado</a>
        <a href="${rootRel}mastery/index.html" class="nav-link ${currentRoute === 'mastery' ? 'active' : ''}" data-route="mastery">Prontidão</a>
      </nav>
      <div class="header-controls">
        <button id="search-trigger" class="search-trigger-btn" aria-label="Buscar conceitos">
          <span>🔍 Buscar</span>
          <kbd class="kbd-shortcut">Ctrl+K</kbd>
        </button>
        <button id="theme-toggle" class="btn-icon" aria-label="Alternar Tema" title="Alternar Tema (Alt+T)">🌓</button>
        <button id="shortcuts-toggle" class="btn-icon" aria-label="Atalhos do Teclado" title="Atalhos (?)">⌨️</button>
      </div>
    </div>
  </header>

  <div id="drawer-backdrop" class="drawer-backdrop" aria-hidden="true"></div>
  <aside id="sidebar-drawer" class="sidebar-drawer" aria-label="Ementa do Exame" aria-hidden="true">
    <div class="drawer-header">
      <span class="drawer-title">Ementa AI-200</span>
      <button id="drawer-close" class="modal-close-btn" aria-label="Fechar Ementa">✕</button>
    </div>
    <div id="drawer-content" class="drawer-content">
      <div style="padding: 16px; color: var(--text-muted); font-size: 13px;">Carregando ementa oficial...</div>
    </div>
  </aside>

  <main id="app-viewport" class="app-main" role="main">
    ${content}
  </main>

  <div id="search-modal-backdrop" class="modal-backdrop" aria-hidden="true">
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="search-modal-title">
      <div class="modal-header">
        <h3 id="search-modal-title">Buscar no Hub de Estudos</h3>
        <button id="search-modal-close" class="modal-close-btn" aria-label="Fechar busca">✕</button>
      </div>
      <div class="modal-body">
        <input type="search" id="global-search-input" class="search-input" placeholder="Digite comandos, tags, conceitos ou serviços Azure..." autocomplete="off">
        <div id="search-results-list" class="search-results-list" role="listbox"></div>
      </div>
    </div>
  </div>

  <div id="shortcuts-modal-backdrop" class="modal-backdrop" aria-hidden="true">
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-modal-title">
      <div class="modal-header">
        <h3 id="shortcuts-modal-title">Atalhos do Teclado</h3>
        <button id="shortcuts-modal-close" class="modal-close-btn" aria-label="Fechar atalhos">✕</button>
      </div>
      <div class="modal-body">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tbody>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">Ctrl+K</kbd> / <kbd class="kbd-shortcut">Cmd+K</kbd></td><td>Abrir busca global</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">Alt+T</kbd></td><td>Alternar Modo Claro / Escuro</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">Alt+R</kbd></td><td>Ligar / Desligar Active Recall</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">1</kbd> .. <kbd class="kbd-shortcut">5</kbd></td><td>Selecionar alternativas no Simulado</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">Space</kbd> / <kbd class="kbd-shortcut">Enter</kbd></td><td>Revelar lacuna selecionada</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">?</kbd></td><td>Exibir esta ajuda de atalhos</td></tr>
            <tr><td style="padding: 8px 0;"><kbd class="kbd-shortcut">Esc</kbd></td><td>Fechar menus e janelas modais</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <footer class="app-footer" style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 12.5px; border-top: 1px solid var(--border);">
    <p>Azure AI-200: Developing AI Cloud Solutions on Azure — Preparatório Oficial com Engenharia Determinística</p>
  </footer>
</body>
</html>`;
}

// 3. Compile Chapters and Concepts
const catalog = [];
const cramIndex = [];
const questionsBank = [];

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

      // Save concept HTML
      const conceptHtml = `<article class="concept-content" data-slug="${slug}" data-chapter="${chFolder}">
  <header class="concept-header">
    <div class="breadcrumb">
      <a href="${rootRel}index.html">Início</a> &gt; <span>${chFolder}</span>
    </div>
    <h1>${data.title || slug}</h1>
    <div class="concept-meta">
      <span class="badge badge-domain">${data.exam_domain || ''}</span>
      <span class="badge badge-diff">${data.difficulty || 'intermediate'}</span>
    </div>
    <div class="tldr-box">
      <strong>TL;DR:</strong> ${data.tldr || ''}
    </div>
  </header>
  <div class="concept-body">
    ${compiled.html}
  </div>
</article>`;

      const pageHtml = renderHtmlShell({
        title: data.title,
        description: data.tldr,
        content: conceptHtml,
        rootRel,
        currentRoute: `chapter/${chFolder}/${slug}`,
        metadata: {
          ...data,
          narrationText: compiled.metadata?.narrationText || ''
        }
      });

      writeFileSync(outFile, pageHtml, 'utf-8');

      // Index for search & cram
      catalog.push({
        id: slug,
        type: 'concept',
        title: data.title,
        slug,
        chapter: chFolder,
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
    const cmpHtml = `<article class="comparison-content">
  <h1>${data.title || slug}</h1>
  <div class="comparison-body">${compiled.html}</div>
</article>`;

    const pageHtml = renderHtmlShell({
      title: data.title,
      description: data.tldr || 'Matriz Comparativa de Decisão',
      content: cmpHtml,
      rootRel,
      currentRoute: `comparison/${slug}`,
      metadata: {
        ...data,
        narrationText: compiled.metadata?.narrationText || ''
      }
    });

    writeFileSync(outFile, pageHtml, 'utf-8');

    catalog.push({
      id: slug,
      type: 'comparison',
      title: data.title,
      slug,
      exam_domain: data.exam_domain || 'data-management',
      tags: data.tags || [],
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
const views = [
  { file: 'index.html', title: 'Trilhas de Estudo', route: 'home', content: '<div id="home-view">Carregando trilhas da ementa...</div>' },
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
    filter: (src) => !src.endsWith('index.html') // Do not overwrite pre-rendered views unless intended
  });
  console.log('✓ Copied static assets from web/ to dist/');
} else {
  console.log('ℹ Web assets folder (web/) does not exist yet; will be populated in M2.');
}

console.log(`\n🎉 Static build completed successfully!`);
console.log(`   - Concepts compiled: ${catalog.filter(c => c.type === 'concept').length}`);
console.log(`   - Comparisons compiled: ${catalog.filter(c => c.type === 'comparison').length}`);
console.log(`   - Exam questions assembled: ${questionsBank.length}`);
console.log(`   - Output directory: ${DIST_DIR}\n`);

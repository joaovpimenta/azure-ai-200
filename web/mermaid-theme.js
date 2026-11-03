/**
 * web/mermaid-theme.js
 * Editorial Tech Topics Mermaid theme and interactive diagram viewport (+, −, fullscreen).
 */

export const TECH_TOPICS_MERMAID_CONFIG = Object.freeze({
  version: '11.4.0',
  moduleUrl: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs',
  config: {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      fontFamily: 'Cabin, Arial, sans-serif',
      fontSize: '16px',
      background: '#f5f8f6',
      primaryColor: '#d8eadf',
      primaryTextColor: '#173b32',
      primaryBorderColor: '#277d69',
      lineColor: '#277d69',
      secondaryColor: '#f1dfbd',
      tertiaryColor: '#c7d8cf',
      edgeLabelBackground: '#f5f8f6',
      actorBkg: '#d8eadf',
      actorBorder: '#277d69',
      actorTextColor: '#173b32',
      noteBkgColor: '#f1dfbd',
      noteBorderColor: '#a98135',
      noteTextColor: '#463717',
      sectionBkgColor: '#c7d8cf',
      altSectionBkgColor: '#f1dfbd',
      clusterBkg: '#e8f0eb',
      clusterBorder: '#277d69'
    }
  }
});

if (typeof window !== 'undefined') {
  window.TechTopicsMermaid = TECH_TOPICS_MERMAID_CONFIG;
}

export function mountDiagramViewport(container, svg) {
  const viewBox = svg.viewBox?.baseVal;
  if (!viewBox || !(viewBox.width > 0 && viewBox.height > 0)) return;
  const viewport = document.createElement('div');
  viewport.className = 'diagram-viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'region');
  viewport.setAttribute('aria-label', (svg.getAttribute('aria-label') || 'Diagrama técnico') + '. Use as setas para rolar o diagrama ampliado.');
  const toolbar = document.createElement('div');
  toolbar.className = 'diagram-toolbar';
  toolbar.setAttribute('data-tts-ignore', '');
  toolbar.setAttribute('role', 'group');
  toolbar.setAttribute('aria-label', 'Tamanho do diagrama');

  function button(text, label, action) {
    const control = document.createElement('button');
    control.type = 'button';
    control.textContent = text;
    control.setAttribute('aria-label', label);
    control.title = label;
    control.addEventListener('click', action);
    toolbar.append(control);
    return control;
  }

  let scale = 1;
  let mode = 'auto';
  let fit = 1;
  let maximum = 3;
  const zoomIn = button('+', 'Ampliar diagrama', () => zoom(scale * 1.25));
  const zoomOut = button('−', 'Reduzir diagrama', () => zoom(scale / 1.25));
  let dialog = null;

  const fullscreen = button('⛶', 'Abrir diagrama em tela cheia', () => {
    if (dialog) {
      dialog.close();
      return;
    }
    const readingPosition = { top: window.scrollY, left: window.scrollX, behavior: 'instant' };
    const placeholder = document.createComment('diagram-position');
    container.before(placeholder);
    dialog = document.createElement('dialog');
    dialog.className = 'diagram-dialog';
    dialog.setAttribute('aria-label', 'Diagrama em tela cheia');
    document.body.append(dialog);
    dialog.append(container);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fullscreen.setAttribute('aria-label', 'Sair da tela cheia');
    fullscreen.title = 'Sair da tela cheia';
    dialog.addEventListener('close', () => {
      placeholder.replaceWith(container);
      dialog.remove();
      dialog = null;
      document.body.style.overflow = previousOverflow;
      fullscreen.setAttribute('aria-label', 'Abrir diagrama em tela cheia');
      fullscreen.title = 'Abrir diagrama em tela cheia';
      update();
      window.scrollTo(readingPosition);
      fullscreen.focus({ preventScroll: true });
    }, { once: true });
    dialog.showModal();
    fullscreen.focus();
    update();
  });

  const status = document.createElement('output');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-label', 'Ampliação do diagrama');
  toolbar.append(status);

  const hint = document.createElement('p');
  hint.className = 'diagram-hint';
  hint.setAttribute('data-tts-ignore', '');
  hint.textContent = 'Deslize dentro do quadro para explorar o diagrama ampliado.';
  viewport.append(svg);
  svg.style.maxWidth = 'none';
  container.replaceChildren(toolbar, viewport, hint);

  const fonts = [...svg.querySelectorAll('text, foreignObject span, foreignObject p')]
    .filter(node => node.textContent.trim())
    .map(node => parseFloat(getComputedStyle(node).fontSize))
    .filter(size => size > 0);

  function update() {
    const width = viewport.clientWidth;
    if (!width) return;
    const minimumFont = Math.max(14, parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.875);
    const readableScale = minimumFont / (fonts.length ? Math.min(...fonts) : 16);
    fit = Math.min(1, width / viewBox.width);
    maximum = Math.max(3, readableScale * 2);
    if (mode === 'auto') scale = Math.max(fit, readableScale);
    else if (mode === 'fit') scale = fit;
    else scale = Math.max(fit, Math.min(maximum, scale));
    svg.style.width = `${viewBox.width * scale}px`;
    svg.style.height = `${viewBox.height * scale}px`;
    zoomIn.disabled = scale >= maximum - 0.001;
    zoomOut.disabled = scale <= fit + 0.001;
    status.value = `${Math.round(scale * 100)}%`;
    hint.hidden = viewport.scrollWidth <= viewport.clientWidth + 1 && viewport.scrollHeight <= viewport.clientHeight + 1;
  }

  function zoom(next) {
    mode = next <= fit + 0.001 ? 'fit' : 'manual';
    scale = Math.max(fit, Math.min(maximum, next));
    update();
  }

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    observer.observe(toolbar);
    observer.observe(container);
  } else {
    window.addEventListener('resize', update);
  }
  update();
}

export async function initMermaid() {
  if (typeof document === 'undefined') return;
  const containers = [...document.querySelectorAll('.mermaid, [data-mermaid="true"]')];
  if (containers.length === 0) return;

  try {
    const module = await import(TECH_TOPICS_MERMAID_CONFIG.moduleUrl);
    const mermaid = module.default;
    mermaid.initialize(TECH_TOPICS_MERMAID_CONFIG.config);

    for (const [index, el] of containers.entries()) {
      if (el.querySelector('svg')) continue;
      const sourceEl = el.querySelector('.mermaid-source') || el;
      const code = (el.dataset.rawCode || sourceEl.textContent || '').trim();
      if (!code) continue;
      el.dataset.rawCode = code;

      try {
        const rendered = await mermaid.render(`techTopicsDiagram_${Date.now()}_${index}`, code);
        const wrapper = document.createElement('div');
        wrapper.innerHTML = rendered.svg;
        const svg = wrapper.querySelector('svg');
        if (!svg) throw new Error('Mermaid did not return SVG');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', el.dataset.mermaidLabel || 'Diagrama técnico');
        el.classList.add('mermaid-diagram');
        el.replaceChildren(svg);
        mountDiagramViewport(el, svg);
      } catch (err) {
        el.classList.add('mermaid-error');
      }
    }
  } catch (err) {
    console.info('[Mermaid] Fallback code view active:', err.message);
  }
}

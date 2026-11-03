/**
 * web/mermaid-theme.js
 * Mermaid theme configuration and initialization for light/dark mode.
 */

export function getMermaidConfig(isDark = false) {
  return {
    startOnLoad: false,
    theme: isDark ? 'dark' : 'neutral',
    themeVariables: isDark ? {
      primaryColor: '#1e293b',
      primaryTextColor: '#f8fafc',
      primaryBorderColor: '#38bdf8',
      lineColor: '#94a3b8',
      secondaryColor: '#111827',
      tertiaryColor: '#0b0f19'
    } : {
      primaryColor: '#e0f2fe',
      primaryTextColor: '#0f172a',
      primaryBorderColor: '#0284c7',
      lineColor: '#64748b',
      secondaryColor: '#f1f5f9',
      tertiaryColor: '#ffffff'
    },
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };
}

export function initMermaid() {
  if (typeof window === 'undefined' || !window.mermaid) return;

  const isDark = document.documentElement.dataset.theme === 'dark';
  window.mermaid.initialize(getMermaidConfig(isDark));

  try {
    window.mermaid.run({
      nodes: document.querySelectorAll('.mermaid')
    });
  } catch (err) {
    console.warn('[Mermaid] Render error:', err);
  }
}

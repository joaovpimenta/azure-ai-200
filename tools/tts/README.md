# Pipeline de Narração (Kokoro `pf_dora` + Web Speech API)

O **Azure AI-200 Study Hub** utiliza uma arquitetura de áudio híbrida e desacoplada para permitir revisão passiva no celular/PWA (inclusive com a tela bloqueada via **Media Session API**), sem bloquear o deploy rápido de novos resumos no GitHub Pages.

## Como funciona

1. **Extração Determinística no Build (`npm run build`)**:
   - O compilador (`scripts/lib/markdown.mjs` + `scripts/build-site.mjs`) extrai automaticamente o roteiro limpo (`narrationText`) de cada conceito, removendo blocos densos de código bruto e delimitadores `==cloze==`.
2. **Reprodução Imediata no Navegador (`web/audio-player.js`)**:
   - Se houver um ativo MP3 publicado em uma GitHub Release `tts-<slug>` (mapeado em `dist/data/audio-manifest.json`), o player reproduz o MP3 da voz `pf_dora` com suporte a controle na tela de bloqueio e fones Bluetooth.
   - Caso o MP3 ainda não tenha sido gerado para aquele conceito, o player faz fallback transparente para a **Web Speech API** (`pt-BR`) segmentada por frases, mantendo controles de velocidade (`0.75x` a `2.0x`) e modo **Playlist de Capítulo**.
3. **Preparação e Síntese com Kokoro (`tools/tts/kokoro_release.py`)**:
   ```bash
   python tools/tts/kokoro_release.py prepare \
     --catalog dist/data/catalog.json \
     --slug all \
     --voice pf_dora \
     --speed 1.0 \
     --output-dir tools/tts/output
   ```
   O comando gera `narration.txt` e `chapters.json` (schema v2) para cada conceito em `tools/tts/output/<slug>/`.

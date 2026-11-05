# Narração de todos os artigos

O comando `prepare` só gera um roteiro. **MP3 é gerado por `synthesize`**, usando Kokoro ONNX com voz `pf_dora`, idioma `pt-br` e FFmpeg. Termos técnicos em crases e tabelas são preservados; tabelas são narradas como cabeçalho e valor. Blocos extensos de código são omitidos do roteiro: acompanhe os exemplos na página.

## GitHub Actions

- **No PR:** alterações nos artigos ou no pipeline executam `kokoro-audio.yml`. O artefato `narration-audio` contém um MP3 e `chapters.json` por artigo, incluindo a comparação de bancos.
- **Na publicação em main:** Pages chama o mesmo workflow, baixa os áudios da própria execução e verifica a cobertura contra o catálogo atual antes de publicar. Um áudio ausente ou antigo impede o deploy.
- **Manual:** execute “Generate Kokoro Narration Audio” com `slug=all` ou o slug de um artigo. Isso gera um artefato para download; não altera o site publicado. Para publicar, execute o workflow de Pages em main.
- Os modelos têm versão e SHA-256 fixos. O cache reaproveita áudios somente quando texto, voz e velocidade coincidem. Mudanças no código de geração invalidam a chave do cache da Action.
- Não há segredo de serviço TTS nem permissão de escrita em Releases. Os arquivos são publicados junto com o site em `audio/<slug>/<slug>.mp3`, evitando depender de Releases e de URLs externas.

## Executar localmente

Requisitos: Python 3.12, Node 22, FFmpeg/FFprobe e espaço para o modelo (~326 MB), vozes (~28 MB) e áudio temporário.

```bash
npm ci
npm run build
python -m venv .venv
. .venv/bin/activate
python -m pip install -r tools/tts/requirements.txt
python tools/tts/download_models.py
python tools/tts/kokoro_release.py synthesize \
  --catalog dist/data/catalog.json --slug all \
  --model .cache/kokoro/kokoro-v1.0.onnx \
  --voices .cache/kokoro/voices-v1.0.bin \
  --output-dir tools/tts/output
python tools/tts/kokoro_release.py verify \
  --catalog dist/data/catalog.json --output-dir tools/tts/output
```

Os marcadores usam a duração real dos trechos sintetizados. `manifest.json` registra cobertura, duração e hash do roteiro. `verify` rejeita arquivos ausentes, roteiros divergentes, marcadores estimados e durações inválidas.

Para pré-visualizar, copie `tools/tts/output` para `dist/audio` **depois do último build/teste** e execute `npm run preview`. O build recria `dist`; alguns testes também executam o build. No site, use “Ouvir artigo”. A voz do navegador fica como alternativa quando o MP3 não está acessível; isso não conta como síntese concluída na Action.

Licenças: biblioteca Kokoro ONNX (MIT) e modelo Kokoro (Apache 2.0), conforme os projetos de origem.

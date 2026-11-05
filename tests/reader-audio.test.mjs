import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupConceptAudioPlayer } from '../web/reader.js';

test('article controls play its MP3, update source, seek, pause and switch to device voice', async t => {
  const globals = ['window', 'document', 'Audio', 'SpeechSynthesisUtterance'];
  const originals = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => {
    globalThis.window?.__audioPlayer?.stop();
    globals.forEach((key, i) => originals[i] ? Object.defineProperty(globalThis, key, originals[i]) : delete globalThis[key]);
  });
  class Button extends EventTarget {
    dataset = {};
    textContent = '';
    setAttribute(name, value) { this[name] = value; }
    click() { this.dispatchEvent(new Event('click')); }
  }
  class FakeAudio extends EventTarget {
    currentTime = 0;
    duration = 100;
    paused = true;
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { delete this[name]; }
    load() { queueMicrotask(() => this.dispatchEvent(new Event('canplay'))); }
  }
  const ids = ['listen-recording', 'recording-play', 'inline-recording-next', 'inline-recording-previous',
    'inline-recording-source', 'inline-recording-rate', 'inline-recording-elapsed', 'listen-article'];
  const elements = Object.fromEntries(ids.map(id => [id, new Button()]));
  elements['page-metadata'] = { textContent: JSON.stringify({ slug: 'exemplo', title: 'Exemplo', narrationText: 'Texto para ouvir.' }) };
  const spoken = [];
  globalThis.window = { speechSynthesis: { getVoices: () => [], cancel() {}, speak: utterance => spoken.push(utterance) } };
  globalThis.document = {
    getElementById: id => elements[id] || null,
    querySelector: () => ({ getAttribute: () => '../../../' }),
    body: { classList: { add() {}, remove() {} } }
  };
  globalThis.Audio = FakeAudio;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };

  setupConceptAudioPlayer({ dataset: { slug: 'exemplo' } });
  elements['listen-recording'].click();
  await new Promise(resolve => setImmediate(resolve));
  const player = window.__audioPlayer;
  assert.equal(player.audioElement.src, '../../../audio/exemplo/exemplo.mp3');
  assert.equal(player.state, 'playing');
  assert.equal(elements['inline-recording-source'].textContent, 'Kokoro Dora');
  elements['inline-recording-next'].click();
  assert.equal(player.audioElement.currentTime, 10);
  elements['inline-recording-rate'].click();
  assert.equal(player.audioElement.playbackRate, 1.25);
  elements['recording-play'].click();
  assert.equal(player.state, 'paused');
  elements['listen-article'].click();
  assert.equal(player.source, 'tts');
  assert.equal(player.audioElement.paused, true);
  assert.equal(elements['inline-recording-source'].textContent, 'Voz do dispositivo');
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, 'Texto para ouvir.');
});

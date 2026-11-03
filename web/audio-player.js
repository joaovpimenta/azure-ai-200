/**
 * web/audio-player.js
 * Production-ready Chapter Audio Player & Playlist Manager for Azure AI-200 Study Hub.
 *
 * Features:
 * 1. Chapter playlist management (continuous track-by-track playback).
 * 2. Media Session API integration (lock-screen controls, metadata, artwork).
 * 3. 3-tier audio source hierarchy:
 *    - Tier 1: Pre-rendered MP3 from GitHub Releases URL.
 *    - Tier 2: Client-side Web Speech API (speechSynthesis) in pt-BR with speed 0.75x..2.0x.
 *    - Tier 3: Mobile background keep-alive via continuous silent audio loop.
 * 4. Utterance chunking (splits long technical prose into ~150-char clauses to eliminate browser timeouts).
 * 5. Built-in accessible floating UI widget with keyboard shortcuts.
 */

// 1-second silent WAV data URI to keep mobile audio session alive during Web Speech
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA';

const DEFAULT_RELEASES_URL =
  'https://github.com/joaovpimenta/azure-ai-200/releases/download';

/**
 * Splits plain text into sentence/clause chunks under maxChars to bypass browser speech limits.
 * @param {string} text
 * @param {number} [maxChars=160]
 * @returns {string[]}
 */
export function chunkNarrationText(text, maxChars = 160) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Primary split by sentence boundary (. ! ? \n ;) or end of text
  const sentenceRegex = /[^.!?;\n]+(?:[.!?;\n]+|$)/g;
  const rawSentences = clean.match(sentenceRegex) || [clean];

  const chunks = [];
  let currentChunk = '';

  for (const sentence of rawSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length > maxChars) {
      // Secondary split by comma, colon, or dash
      const clauses = trimmed.split(/(?<=[,:—])\s+/);
      for (const clause of clauses) {
        const clauseTrimmed = clause.trim();
        if (!clauseTrimmed) continue;

        if (clauseTrimmed.length > maxChars) {
          // Fallback: split by whitespace if clause exceeds maxChars
          const words = clauseTrimmed.split(/\s+/);
          for (const word of words) {
            if (!word) continue;
            if ((currentChunk + ' ' + word).trim().length <= maxChars) {
              currentChunk = (currentChunk + ' ' + word).trim();
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = word;
            }
          }
        } else {
          if ((currentChunk + ' ' + clauseTrimmed).trim().length <= maxChars) {
            currentChunk = (currentChunk + ' ' + clauseTrimmed).trim();
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = clauseTrimmed;
          }
        }
      }
    } else {
      if ((currentChunk + ' ' + trimmed).trim().length <= maxChars) {
        currentChunk = (currentChunk + ' ' + trimmed).trim();
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(c => c.length > 0);
}

export class AudioPlayer {
  constructor(options = {}) {
    this.options = {
      releasesBaseUrl: options.releasesBaseUrl || DEFAULT_RELEASES_URL,
      defaultSpeed: options.defaultSpeed || 1.0,
      autoPlayNext: options.autoPlayNext ?? true,
      siteBase: options.siteBase || './',
      ...options
    };

    // Playlist State
    this.playlist = [];           // Array of Track objects
    this.currentIndex = -1;       // Current track index
    this.state = 'idle';          // 'idle' | 'playing' | 'paused' | 'buffering'
    this.source = 'none';         // 'mp3' | 'tts' | 'none'
    this.playbackRate = this.options.defaultSpeed; // 0.75 to 2.0
    this.continuousMode = true;   // Chapter playlist auto-advance

    // HTML5 Audio (Tier 1: Pre-rendered MP3)
    this.audioElement = null;

    // Web Speech API (Tier 2: Client TTS)
    this.speechSynth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    this.ptVoice = null;
    this.speechChunks = [];
    this.currentChunkIndex = 0;
    this.watchdogTimer = null;

    // Mobile Background Keep-Alive (Tier 3: Silent Audio Loop)
    this.silentAudioElement = null;

    // Event Subscriptions
    this.subscribers = new Set();

    // DOM widget container
    this.widgetElement = null;

    this._initAudioElements();
    this._initVoices();
    this._initMediaSession();
  }

  /**
   * Initializes internal audio elements.
   * @private
   */
  _initAudioElements() {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    // MP3 Player Audio Element
    this.audioElement = new Audio();
    this.audioElement.preload = 'metadata';

    this.audioElement.addEventListener('ended', () => {
      this._onTrackEnded();
    });

    this.audioElement.addEventListener('timeupdate', () => {
      this._emitProgress();
      this._updateMediaSessionPosition();
    });

    this.audioElement.addEventListener('error', (err) => {
      console.warn('[AudioPlayer] MP3 playback error, falling back to Web Speech API:', err);
      this._fallbackToTts();
    });

    // Mobile Background Keep-Alive Silent Audio Element
    this.silentAudioElement = new Audio(SILENT_WAV_DATA_URI);
    this.silentAudioElement.loop = true;
    this.silentAudioElement.volume = 0.01;
  }

  /**
   * Initializes pt-BR voice selection for SpeechSynthesis.
   * @private
   */
  _initVoices() {
    if (!this.speechSynth) return;

    const findVoice = () => {
      const voices = this.speechSynth.getVoices();
      // Prefer exact pt-BR voice
      this.ptVoice =
        voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR') ||
        voices.find(v => v.lang.toLowerCase().startsWith('pt')) ||
        null;
    };

    findVoice();
    if (typeof window !== 'undefined' && 'onvoiceschanged' in this.speechSynth) {
      this.speechSynth.onvoiceschanged = findVoice;
    }
  }

  /**
   * Wires Media Session API action handlers.
   * @private
   */
  _initMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    const actions = [
      ['play', () => this.play()],
      ['pause', () => this.pause()],
      ['stop', () => this.stop()],
      ['previoustrack', () => this.prev()],
      ['nexttrack', () => this.next()],
      ['seekbackward', (details) => this.seekBy(-(details.seekOffset || 10))],
      ['seekforward', (details) => this.seekBy(details.seekOffset || 10)]
    ];

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        // Safe skip for unsupported actions in older browsers
      }
    }
  }

  // ==========================================
  // Public Playlist & Control API
  // ==========================================

  /**
   * Loads an array of concept tracks into the playlist.
   * @param {Array<{slug: string, title: string, chapter: string, chapterTitle?: string, mp3Url?: string, narrationText?: string, url?: string}>} tracks
   * @param {number} [startIndex=0]
   * @param {boolean} [autoPlay=false]
   */
  setPlaylist(tracks, startIndex = 0, autoPlay = false) {
    this.stop();
    this.playlist = Array.isArray(tracks) ? [...tracks] : [];
    this.currentIndex = Math.max(0, Math.min(startIndex, this.playlist.length - 1));
    this._emitStateChange();

    if (autoPlay && this.playlist.length > 0) {
      this.playTrack(this.currentIndex);
    }
  }

  /**
   * Loads all concepts belonging to a chapter from catalog.json into the playlist.
   * @param {string} chapterSlug
   * @param {Array<any>} catalog
   * @param {Object} [blueprint]
   * @param {boolean} [autoPlay=false]
   */
  loadChapter(chapterSlug, catalog, blueprint = null, autoPlay = false) {
    if (!Array.isArray(catalog)) return;

    const concepts = catalog.filter(c => c.type === 'concept' && c.chapter === chapterSlug);
    let chapterTitle = chapterSlug;
    if (blueprint && Array.isArray(blueprint.chapters)) {
      const ch = blueprint.chapters.find(c => c.id === chapterSlug);
      if (ch) chapterTitle = ch.title;
    }

    const tracks = concepts.map(c => ({
      slug: c.slug,
      title: c.title,
      chapter: chapterSlug,
      chapterTitle,
      mp3Url: `${this.options.releasesBaseUrl}/tts-${c.slug}/${c.slug}.mp3`,
      narrationText: c.narrationText || c.tldr || '',
      url: c.url
    }));

    this.setPlaylist(tracks, 0, autoPlay);
  }

  /**
   * Returns current active track.
   * @returns {Object|null}
   */
  get currentTrack() {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      return this.playlist[this.currentIndex];
    }
    return null;
  }

  /**
   * Plays the track at specified index.
   * @param {number} index
   */
  async playTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;

    this.stop();
    this.currentIndex = index;
    const track = this.currentTrack;
    if (!track) return;

    this.state = 'buffering';
    this._emitStateChange();
    this._updateMediaSessionMetadata();

    // Start mobile keep-alive audio loop immediately on user gesture
    this._startSilentKeepAlive();

    const mp3Url = track.mp3Url || `${this.options.releasesBaseUrl}/tts-${track.slug}/${track.slug}.mp3`;

    // Attempt Level 1: Pre-rendered MP3
    try {
      await this._playMp3(mp3Url);
      this.source = 'mp3';
      this.state = 'playing';
      this._updateMediaSessionState();
      this._emitStateChange();
    } catch (err) {
      console.info(`[AudioPlayer] MP3 unavailable for '${track.slug}'. Activating Web Speech API fallback.`);
      this._playTts(track);
    }
  }

  /**
   * Resumes or starts playback.
   */
  play() {
    if (this.state === 'playing') return;

    if (this.state === 'paused') {
      this._startSilentKeepAlive();
      if (this.source === 'mp3' && this.audioElement) {
        this.audioElement.play()
          .then(() => {
            this.state = 'playing';
            this._updateMediaSessionState();
            this._emitStateChange();
          })
          .catch(e => console.warn('[AudioPlayer] Play error:', e));
      } else if (this.source === 'tts') {
        this.state = 'playing';
        this._resumeTts();
        this._updateMediaSessionState();
        this._emitStateChange();
      }
      return;
    }

    if (this.playlist.length > 0) {
      this.playTrack(this.currentIndex >= 0 ? this.currentIndex : 0);
    }
  }

  /**
   * Pauses active playback.
   */
  pause() {
    if (this.state !== 'playing') return;

    this.state = 'paused';
    this._stopSilentKeepAlive();
    this._stopTtsWatchdog();

    if (this.source === 'mp3' && this.audioElement) {
      this.audioElement.pause();
    } else if (this.source === 'tts' && this.speechSynth) {
      this.speechSynth.cancel(); // Cancel active utterance; resumed at current chunk
    }

    this._updateMediaSessionState();
    this._emitStateChange();
  }

  /**
   * Toggles between play and pause.
   */
  togglePlay() {
    if (this.state === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Stops playback and resets progress.
   */
  stop() {
    this.state = 'idle';
    this.source = 'none';
    this._stopSilentKeepAlive();
    this._stopTtsWatchdog();

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement.removeAttribute('src');
    }

    if (this.speechSynth) {
      this.speechSynth.cancel();
    }

    this.speechChunks = [];
    this.currentChunkIndex = 0;

    this._updateMediaSessionState();
    this._emitStateChange();
  }

  /**
   * Advances to next track in playlist.
   */
  next() {
    if (this.currentIndex + 1 < this.playlist.length) {
      this.playTrack(this.currentIndex + 1);
    } else if (this.continuousMode && this.playlist.length > 1) {
      // Loop back to beginning if continuous mode is on
      this.playTrack(0);
    } else {
      this.stop();
    }
  }

  /**
   * Returns to previous track (or restarts current if elapsed > 3s).
   */
  prev() {
    if (this.source === 'mp3' && this.audioElement && this.audioElement.currentTime > 3) {
      this.audioElement.currentTime = 0;
      return;
    }

    if (this.currentIndex > 0) {
      this.playTrack(this.currentIndex - 1);
    } else {
      this.stop();
    }
  }

  /**
   * Adjusts playback rate (0.75x to 2.0x).
   * @param {number} rate
   */
  setPlaybackRate(rate) {
    const clamped = Math.max(0.75, Math.min(2.0, Number(rate) || 1.0));
    this.playbackRate = clamped;

    if (this.audioElement) {
      this.audioElement.playbackRate = clamped;
    }

    if (this.source === 'tts' && this.state === 'playing') {
      // Restart current chunk with updated speech rate
      if (this.speechSynth) this.speechSynth.cancel();
      this._speakChunk(this.currentChunkIndex);
    }

    this._updateMediaSessionPosition();
    this._emitStateChange();
  }

  /**
   * Seeks by offset in seconds.
   * @param {number} offsetSeconds
   */
  seekBy(offsetSeconds) {
    if (this.source === 'mp3' && this.audioElement && !isNaN(this.audioElement.duration)) {
      this.audioElement.currentTime = Math.max(
        0,
        Math.min(this.audioElement.duration, this.audioElement.currentTime + offsetSeconds)
      );
    } else if (this.source === 'tts') {
      // Jump chunk backward or forward
      const delta = offsetSeconds > 0 ? 1 : -1;
      const target = Math.max(0, Math.min(this.speechChunks.length - 1, this.currentChunkIndex + delta));
      if (target !== this.currentChunkIndex) {
        this.currentChunkIndex = target;
        if (this.speechSynth) this.speechSynth.cancel();
        if (this.state === 'playing') this._speakChunk(this.currentChunkIndex);
        this._emitProgress();
      }
    }
  }

  // ==========================================
  // Internal Playback Engines (Tier 1, 2, 3)
  // ==========================================

  /**
   * Tier 1: Attempts to play pre-rendered MP3 from GitHub Releases.
   * @private
   */
  _playMp3(url) {
    return new Promise((resolve, reject) => {
      if (!this.audioElement) return reject(new Error('No audio element'));

      const audio = this.audioElement;
      audio.src = url;
      audio.playbackRate = this.playbackRate;

      const onCanPlay = () => {
        cleanup();
        audio.play().then(resolve).catch(reject);
      };

      const onError = (e) => {
        cleanup();
        reject(new Error(`Failed to load MP3: ${url}`));
      };

      const cleanup = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
      };

      audio.addEventListener('canplay', onCanPlay, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
    });
  }

  /**
   * Tier 2: Plays concept narration via Web Speech API (speechSynthesis).
   * @private
   */
  _playTts(track) {
    if (!this.speechSynth) {
      console.warn('[AudioPlayer] Web Speech API is not supported in this environment.');
      this.stop();
      return;
    }

    // Extract text: metadata narrationText -> DOM concept-body -> title + tldr
    let text = track.narrationText || '';
    if (!text && typeof document !== 'undefined') {
      const bodyEl = document.querySelector('.concept-body');
      if (bodyEl) {
        text = bodyEl.textContent || '';
      }
    }
    if (!text) {
      text = `${track.title}. ${track.tldr || ''}`;
    }

    this.speechChunks = chunkNarrationText(text, 160);
    this.currentChunkIndex = 0;
    this.source = 'tts';
    this.state = 'playing';

    this._startTtsWatchdog();
    this._updateMediaSessionState();
    this._emitStateChange();

    this._speakChunk(0);
  }

  /**
   * Resumes Web Speech API playback from current chunk.
   * @private
   */
  _resumeTts() {
    if (!this.speechSynth || this.speechChunks.length === 0) return;
    this._startTtsWatchdog();
    this._speakChunk(this.currentChunkIndex);
  }

  /**
   * Speaks a single utterance chunk.
   * @private
   */
  _speakChunk(index) {
    if (!this.speechSynth || index >= this.speechChunks.length) {
      this._onTrackEnded();
      return;
    }

    const chunk = this.speechChunks[index];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = 'pt-BR';
    if (this.ptVoice) utterance.voice = this.ptVoice;
    utterance.rate = this.playbackRate;

    utterance.onend = () => {
      this.currentChunkIndex = index + 1;
      this._emitProgress();
      if (this.currentChunkIndex < this.speechChunks.length) {
        if (this.state === 'playing') {
          this._speakChunk(this.currentChunkIndex);
        }
      } else {
        this._onTrackEnded();
      }
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn(`[AudioPlayer] TTS error on chunk ${index}:`, e);
      this.currentChunkIndex = index + 1;
      if (this.currentChunkIndex < this.speechChunks.length && this.state === 'playing') {
        this._speakChunk(this.currentChunkIndex);
      } else {
        this._onTrackEnded();
      }
    };

    this.speechSynth.speak(utterance);
    this._emitProgress();
    this._updateMediaSessionPosition();
  }

  /**
   * Chrome/Safari Speech Keep-Alive Watchdog.
   * Pulses pause/resume every 10 seconds to circumvent the ~15s browser watchdog cutoff.
   * @private
   */
  _startTtsWatchdog() {
    this._stopTtsWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (this.speechSynth && this.speechSynth.speaking && !this.speechSynth.paused) {
        this.speechSynth.pause();
        this.speechSynth.resume();
      }
    }, 10000);
  }

  /**
   * @private
   */
  _stopTtsWatchdog() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  /**
   * Tier 3: Mobile background keep-alive using silent audio loop.
   * Prevents mobile browsers from putting tab/timers to sleep on screen lock.
   * @private
   */
  _startSilentKeepAlive() {
    if (!this.silentAudioElement) return;
    this.silentAudioElement.play().catch(() => {
      // Ignore autoplay policy rejections if gesture not passed
    });
  }

  /**
   * @private
   */
  _stopSilentKeepAlive() {
    if (!this.silentAudioElement) return;
    this.silentAudioElement.pause();
  }

  /**
   * Triggered when a track completes.
   * @private
   */
  _onTrackEnded() {
    this._stopSilentKeepAlive();
    this._stopTtsWatchdog();

    if (this.continuousMode && this.currentIndex + 1 < this.playlist.length) {
      console.log(`[AudioPlayer] Track ended. Auto-advancing to: ${this.currentIndex + 1}`);
      this.playTrack(this.currentIndex + 1);
    } else {
      this.stop();
    }
  }

  /**
   * @private
   */
  _fallbackToTts() {
    const track = this.currentTrack;
    if (track) {
      this._playTts(track);
    } else {
      this.stop();
    }
  }

  // ==========================================
  // Media Session API Synchronization
  // ==========================================

  /**
   * @private
   */
  _updateMediaSessionMetadata() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;

    const track = this.currentTrack;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const base = this.options.siteBase;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || track.slug,
      artist: 'Microsoft Azure AI-200',
      album: track.chapterTitle || track.chapter || 'Azure AI-200 Study Hub',
      artwork: [
        { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }
      ]
    });
  }

  /**
   * @private
   */
  _updateMediaSessionState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = this.state === 'playing' ? 'playing' : 'paused';
  }

  /**
   * @private
   */
  _updateMediaSessionPosition() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !('setPositionState' in navigator.mediaSession)) return;

    try {
      if (this.source === 'mp3' && this.audioElement && !isNaN(this.audioElement.duration)) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, this.audioElement.duration),
          playbackRate: this.playbackRate,
          position: Math.max(0, Math.min(this.audioElement.currentTime, this.audioElement.duration))
        });
      } else if (this.source === 'tts' && this.speechChunks.length > 0) {
        navigator.mediaSession.setPositionState({
          duration: this.speechChunks.length,
          playbackRate: this.playbackRate,
          position: this.currentChunkIndex
        });
      }
    } catch (e) {
      // Ignore InvalidStateError on rapid transitions
    }
  }

  // ==========================================
  // Event Emitter & UI Widget
  // ==========================================

  /**
   * Subscribes a listener to audio player state changes.
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }
    return () => this.subscribers.delete(callback);
  }

  /**
   * @private
   */
  _emitStateChange() {
    const payload = {
      state: this.state,
      source: this.source,
      currentIndex: this.currentIndex,
      totalTracks: this.playlist.length,
      currentTrack: this.currentTrack,
      playbackRate: this.playbackRate,
      continuousMode: this.continuousMode
    };

    for (const sub of this.subscribers) {
      try { sub(payload); } catch (e) { console.error(e); }
    }

    this._updateWidgetUi();
  }

  /**
   * @private
   */
  _emitProgress() {
    let progress = 0;
    let label = '';

    if (this.source === 'mp3' && this.audioElement && this.audioElement.duration) {
      progress = (this.audioElement.currentTime / this.audioElement.duration) * 100;
      label = `${this._formatTime(this.audioElement.currentTime)} / ${this._formatTime(this.audioElement.duration)}`;
    } else if (this.source === 'tts' && this.speechChunks.length > 0) {
      progress = ((this.currentChunkIndex + 1) / this.speechChunks.length) * 100;
      label = `Frase ${this.currentChunkIndex + 1} de ${this.speechChunks.length}`;
    }

    const payload = { progress, label };
    for (const sub of this.subscribers) {
      if (typeof sub.onProgress === 'function') sub.onProgress(payload);
    }

    if (this.widgetElement) {
      const bar = this.widgetElement.querySelector('.audio-progress-fill');
      const text = this.widgetElement.querySelector('.audio-time');
      if (bar) bar.style.width = `${progress}%`;
      if (text) text.textContent = label;
    }
  }

  /**
   * @private
   */
  _formatTime(seconds) {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  }

  /**
   * Mounts the accessible floating audio widget into a target DOM container.
   * @param {HTMLElement|string} containerOrSelector
   */
  mountWidget(containerOrSelector) {
    if (typeof document === 'undefined') return;

    const container = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector)
      : containerOrSelector;

    if (!container) return;

    const widget = document.createElement('div');
    widget.className = 'audio-player-widget';
    widget.setAttribute('role', 'region');
    widget.setAttribute('aria-label', 'Player de Áudio da Trilha');
    widget.innerHTML = `
      <div class="audio-inner">
        <div class="audio-track-info">
          <span class="audio-source-badge" data-source="none">Áudio</span>
          <div class="audio-titles">
            <strong class="audio-title">Nenhuma faixa selecionada</strong>
            <span class="audio-chapter">Trilha</span>
          </div>
        </div>
        <div class="audio-controls">
          <button class="audio-btn btn-prev" aria-label="Faixa anterior" title="Faixa anterior">⏮</button>
          <button class="audio-btn btn-play" aria-label="Reproduzir áudio" title="Reproduzir">▶</button>
          <button class="audio-btn btn-next" aria-label="Próxima faixa" title="Próxima">⏭</button>
          <button class="audio-btn btn-speed" aria-label="Velocidade de reprodução" title="Velocidade">1.0x</button>
          <button class="audio-btn btn-continuous" aria-label="Modo contínuo" title="Ouvir trilha em sequência (Contínuo)">🔁</button>
        </div>
        <div class="audio-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="audio-progress-fill" style="width: 0%;"></div>
        </div>
        <span class="audio-time">0:00</span>
      </div>
    `;

    // Event listeners
    widget.querySelector('.btn-play').addEventListener('click', () => this.togglePlay());
    widget.querySelector('.btn-prev').addEventListener('click', () => this.prev());
    widget.querySelector('.btn-next').addEventListener('click', () => this.next());
    widget.querySelector('.btn-speed').addEventListener('click', () => {
      const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
      const nextIdx = (speeds.indexOf(this.playbackRate) + 1) % speeds.length;
      this.setPlaybackRate(speeds[nextIdx]);
    });
    widget.querySelector('.btn-continuous').addEventListener('click', () => {
      this.continuousMode = !this.continuousMode;
      this._emitStateChange();
    });

    container.appendChild(widget);
    this.widgetElement = widget;
    this._updateWidgetUi();
  }

  /**
   * @private
   */
  _updateWidgetUi() {
    if (!this.widgetElement) return;

    const track = this.currentTrack;
    const titleEl = this.widgetElement.querySelector('.audio-title');
    const chapterEl = this.widgetElement.querySelector('.audio-chapter');
    const playBtn = this.widgetElement.querySelector('.btn-play');
    const speedBtn = this.widgetElement.querySelector('.btn-speed');
    const contBtn = this.widgetElement.querySelector('.btn-continuous');
    const badgeEl = this.widgetElement.querySelector('.audio-source-badge');

    if (track) {
      titleEl.textContent = track.title || track.slug;
      chapterEl.textContent = `${track.chapterTitle || track.chapter} (${this.currentIndex + 1}/${this.playlist.length})`;
    } else {
      titleEl.textContent = 'Nenhuma faixa selecionada';
      chapterEl.textContent = 'Trilha';
    }

    playBtn.textContent = this.state === 'playing' ? '⏸' : '▶';
    playBtn.setAttribute('aria-label', this.state === 'playing' ? 'Pausar áudio' : 'Reproduzir áudio');

    speedBtn.textContent = `${this.playbackRate}x`;
    contBtn.style.opacity = this.continuousMode ? '1.0' : '0.4';

    if (badgeEl) {
      badgeEl.setAttribute('data-source', this.source);
      if (this.source === 'mp3') {
        badgeEl.textContent = 'MP3 Releases';
        badgeEl.style.backgroundColor = '#16a34a';
      } else if (this.source === 'tts') {
        badgeEl.textContent = 'Web Speech pt-BR';
        badgeEl.style.backgroundColor = '#0284c7';
      } else {
        badgeEl.textContent = 'Áudio';
        badgeEl.style.backgroundColor = '#475569';
      }
    }
  }
}

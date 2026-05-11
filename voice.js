// ============================================================
// voice.js — AI Voice Assistant for Curious Oxfordshire Map
// ============================================================

class VoiceAssistant {
  constructor() {
    this.apiKey = localStorage.getItem('coxon_api_key') || null;
    this.conversation = [];
    this.synth = window.speechSynthesis;
    this.recognition = null;
    this.isListening = false;
    this.isSpeaking = false;
    this.autoListen = false;
    this.placesSummary = null; // built lazily on first open

    this.injectUI();
    this.setupRecognition();
    this.cacheVoices();
  }

  // ── Places summary ──────────────────────────────────────────

  buildPlacesSummary() {
    return places.map(p => {
      const tags = (p.tags || []).filter(t => t !== 'adventures').slice(0, 3).join(',');
      const fam = p.familyFriendly ? 'family' : '';
      return `[${p.id}] ${p.name} | ${p.category} | ${p.weather} | ${fam} | ${p.bestFor || ''} | ${p.cost || ''}`;
    }).join('\n');
  }

  // ── Speech synthesis setup ──────────────────────────────────

  cacheVoices() {
    const load = () => { this.voices = this.synth.getVoices(); };
    load();
    if (!this.voices || !this.voices.length) {
      this.synth.addEventListener('voiceschanged', load, { once: true });
    }
  }

  getBestVoice() {
    const voices = this.voices || this.synth.getVoices();
    // Prefer a pleasant English voice
    return voices.find(v => /Daniel|Samantha|Karen|Moira/.test(v.name)) ||
           voices.find(v => v.lang === 'en-GB') ||
           voices.find(v => v.lang.startsWith('en')) ||
           null;
  }

  // ── Speech recognition setup ────────────────────────────────

  setupRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { this.recognitionSupported = false; return; }
    this.recognitionSupported = true;

    this.recognition = new SR();
    this.recognition.lang = 'en-GB';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      if (text) this.handleUserInput(text);
    };

    this.recognition.onerror = (e) => {
      this.setListening(false);
      if (e.error === 'not-allowed') {
        this.addMsg('error', 'Microphone access denied — please allow it in your browser settings.');
      } else if (e.error !== 'aborted' && e.error !== 'no-speech') {
        this.addMsg('error', `Couldn't catch that (${e.error}). Try again.`);
      }
    };

    this.recognition.onend = () => this.setListening(false);
  }

  // ── UI injection ────────────────────────────────────────────

  injectUI() {
    document.body.insertAdjacentHTML('beforeend', `
      <button id="voice-btn" aria-label="Open voice guide" title="Voice guide">
        <span id="voice-btn-icon">🎙</span>
      </button>

      <div id="voice-panel" role="dialog" aria-label="Voice guide">
        <div id="voice-panel-header">
          <span id="voice-panel-title">🗺 Voice Guide</span>
          <span id="voice-status"></span>
          <button id="voice-key-btn" title="Change API key">🔑</button>
          <button id="voice-reset" title="Start fresh conversation">↺ New</button>
          <button id="voice-close" title="Close">✕</button>
        </div>
        <div id="voice-transcript"></div>
        <div id="voice-input-row">
          <button id="voice-tap-btn" class="vtap-idle">🎙 Tap to speak</button>
        </div>
      </div>
    `);

    this.panel      = document.getElementById('voice-panel');
    this.statusEl   = document.getElementById('voice-status');
    this.transcript = document.getElementById('voice-transcript');
    this.tapBtn     = document.getElementById('voice-tap-btn');

    document.getElementById('voice-btn').addEventListener('click', () => this.open());
    document.getElementById('voice-close').addEventListener('click', () => this.close());
    document.getElementById('voice-reset').addEventListener('click', () => this.reset());
    document.getElementById('voice-key-btn').addEventListener('click', () => this.promptApiKey(true));
    this.tapBtn.addEventListener('click', () => this.tapToggle());
  }

  // ── Panel lifecycle ─────────────────────────────────────────

  open() {
    this.panel.classList.add('open');
    if (!this.transcript.children.length) {
      if (!this.apiKey) {
        this.showSetupPrompt();
      } else {
        this.greet();
      }
    }
  }

  close() {
    this.panel.classList.remove('open');
    this.synth.cancel();
    if (this.isListening) this.recognition.stop();
    this.isSpeaking = false;
    this.autoListen = false;
    this.setTapState('idle');
  }

  reset() {
    this.synth.cancel();
    if (this.isListening) this.recognition.stop();
    this.conversation = [];
    this.transcript.innerHTML = '';
    this.isSpeaking = false;
    this.autoListen = false;
    this.setTapState('idle');
    this.greet();
  }

  // ── Greeting ────────────────────────────────────────────────

  greet() {
    const msg = "Hi! I'm your Oxfordshire guide. Tell me what you're in the mood for — a sunny adventure, a rainy day inside, something free, a nature walk — and I'll find the perfect spot for the family.";
    this.addMsg('assistant', msg);
    this.speak(msg);
  }

  showSetupPrompt() {
    this.addMsg('assistant', "Welcome! To use the voice guide I need an Anthropic API key. Tap 🔑 above to enter yours — it's saved only in your browser.");
  }

  // ── Tap button ──────────────────────────────────────────────

  tapToggle() {
    if (this.isSpeaking) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.autoListen = false;
      this.setTapState('idle');
      return;
    }
    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (!this.apiKey) { this.promptApiKey(); return; }
    if (!this.recognitionSupported) {
      this.addMsg('error', 'Voice input isn\'t supported in this browser — try Chrome.');
      return;
    }
    this.autoListen = false;
    this.setListening(true);
    try { this.recognition.start(); } catch (_) { this.setListening(false); }
  }

  setListening(val) {
    this.isListening = val;
    this.statusEl.textContent = val ? 'Listening…' : '';
    this.setTapState(val ? 'listening' : 'idle');
  }

  setTapState(state) {
    const btn = this.tapBtn;
    btn.className = `vtap-${state}`;
    btn.disabled = (state === 'thinking');
    const labels = {
      idle:      '🎙 Tap to speak',
      listening: '⏹ Tap to stop',
      thinking:  '⏳ Thinking…',
      speaking:  '⏸ Tap to stop',
    };
    btn.textContent = labels[state] || labels.idle;
  }

  // ── Claude integration ──────────────────────────────────────

  async handleUserInput(text) {
    this.addMsg('user', text);
    this.conversation.push({ role: 'user', content: text });
    this.setTapState('thinking');
    this.statusEl.textContent = 'Thinking…';

    try {
      const reply = await this.askClaude();
      const idMatch = reply.match(/\[ID:(\d+)\]/);
      const clean = reply.replace(/\[ID:\d+\]/g, '').trim();

      this.conversation.push({ role: 'assistant', content: reply });
      this.addMsg('assistant', clean);
      if (idMatch) this.highlightPlace(parseInt(idMatch[1]));
      this.speak(clean);
    } catch (err) {
      const msg = (err.message || '').includes('401')
        ? 'Invalid API key — tap 🔑 to update it.'
        : 'Something went wrong. Check your connection and try again.';
      this.addMsg('error', msg);
      this.setTapState('idle');
    }

    this.statusEl.textContent = '';
  }

  async askClaude() {
    if (!this.placesSummary) this.placesSummary = this.buildPlacesSummary();

    const system = `You are a warm, knowledgeable local guide helping visitors discover curious, unusual and interesting places across Oxfordshire.

RULES:
- If you have enough information, recommend ONE specific place. Write 2–3 enthusiastic sentences about it, then on a new line append [ID:X] (X = the exact ID number).
- If you genuinely need more info, ask ONE short clarifying question.
- Keep every response under 70 words — it will be read aloud.
- Only recommend places from the list below. Never invent places.

PLACES:
${this.placesSummary}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system,
        messages: this.conversation
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.content[0].text;
  }

  // ── Text-to-speech ──────────────────────────────────────────

  speak(text) {
    this.synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'en-GB';
    utt.rate = 0.93;
    utt.pitch = 1.05;
    const voice = this.getBestVoice();
    if (voice) utt.voice = voice;

    utt.onstart = () => {
      this.isSpeaking = true;
      this.setTapState('speaking');
    };
    utt.onend = () => {
      this.isSpeaking = false;
      this.autoListen = true;
      this.setTapState('idle');
      // Auto-start listening for follow-up
      setTimeout(() => {
        if (this.autoListen && this.panel.classList.contains('open') && !this.isListening) {
          this.startListening();
        }
      }, 1000);
    };
    utt.onerror = () => {
      this.isSpeaking = false;
      this.setTapState('idle');
    };

    this.synth.speak(utt);
  }

  // ── Map integration ─────────────────────────────────────────

  highlightPlace(id) {
    const place = places.find(p => p.id === id);
    if (!place) return;

    const marker = markerById[id];
    if (!marker) return;

    if (!map.hasLayer(marker)) map.addLayer(marker);
    map.setView([place.lat, place.lng], 14, { animate: true });
    setTimeout(() => marker.openPopup(), 700);

    document.querySelectorAll('.place-item').forEach(el =>
      el.classList.toggle('highlighted', el.dataset.id == id)
    );
    const el = document.querySelector(`.place-item[data-id="${id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ── Messages ────────────────────────────────────────────────

  addMsg(role, text) {
    const div = document.createElement('div');
    div.className = `voice-msg voice-msg-${role}`;
    div.textContent = text;
    this.transcript.appendChild(div);
    this.transcript.scrollTop = this.transcript.scrollHeight;
  }

  // ── API key management ──────────────────────────────────────

  promptApiKey(force = false) {
    const hint = this.apiKey
      ? 'A key is already saved. Enter a new one to replace it, or cancel to keep it.'
      : 'Get a free key at console.anthropic.com → API Keys.';
    const key = prompt(`Anthropic API key\n${hint}`);
    if (!key) return;
    if (!key.startsWith('sk-')) {
      alert("That doesn't look like an Anthropic API key (should start with sk-).");
      return;
    }
    this.apiKey = key;
    sessionStorage.setItem('coxon_api_key', key);
    if (!this.transcript.children.length || this.transcript.children.length === 1) {
      this.transcript.innerHTML = '';
      this.greet();
    } else {
      this.addMsg('assistant', 'API key saved. Carry on!');
    }
  }
}

window.addEventListener('load', () => {
  window.voiceAssistant = new VoiceAssistant();
});

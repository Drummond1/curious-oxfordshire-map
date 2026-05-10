// ============================================================
// chat.js — AI chatbot for Secret Oxfordshire
// Calls a Cloudflare Worker proxy — no API key in the browser.
// ============================================================

(function () {
  // URL of the deployed Cloudflare Worker (filled in after deployment)
  const WORKER_URL = 'https://secret-oxfordshire-ai.drummondgilbert.workers.dev';
  const MODEL      = 'claude-3-5-haiku-20241022';

  let chatOpen      = false;
  let messageHistory = [];

  // ── DOM refs ──────────────────────────────────────────────
  const panel        = document.getElementById('chat-panel');
  const mainDiv      = document.getElementById('chat-main');
  const messagesEl   = document.getElementById('chat-messages');
  const suggestionsEl = document.getElementById('chat-suggestions');
  const inputEl      = document.getElementById('chat-input');
  const sendBtn      = document.getElementById('chat-send');
  const closeBtn     = document.getElementById('chat-close');
  const sidebarBtn   = document.getElementById('chat-sidebar-btn');
  const fab          = document.getElementById('chat-fab');

  // ── Open / close ──────────────────────────────────────────
  function openChat() {
    chatOpen = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('open'));
    document.body.classList.add('chat-open');
    mainDiv.hidden = false;
    if (!messagesEl.children.length) showWelcome();
    setTimeout(() => inputEl.focus(), 350);
  }

  function closeChat() {
    chatOpen = false;
    panel.classList.remove('open');
    document.body.classList.remove('chat-open');
    setTimeout(() => { panel.hidden = true; }, 320);
  }

  sidebarBtn?.addEventListener('click', () => chatOpen ? closeChat() : openChat());
  fab?.addEventListener('click',        () => chatOpen ? closeChat() : openChat());
  closeBtn?.addEventListener('click',   closeChat);

  // Dismiss on overlay click
  document.addEventListener('click', e => {
    if (chatOpen && !panel.contains(e.target) &&
        e.target !== sidebarBtn && e.target !== fab &&
        !sidebarBtn?.contains(e.target) && !fab?.contains(e.target)) {
      closeChat();
    }
  });

  // ── Welcome ───────────────────────────────────────────────
  function showWelcome() {
    addMessage('ai', [
      'Hi! I\'m your Secret Oxfordshire guide. Describe what you\'re looking for — I\'ll search',
      `**${places.length.toLocaleString()} places and events** and explain exactly why each recommendation fits.`,
      '',
      'Try asking about the weather, who you\'re with, a date, a mood, or a location.',
    ].join('\n'));
  }

  // ── Smart pre-filtering ───────────────────────────────────
  function getRelevantPlaces(query, limit = 28) {
    const q     = query.toLowerCase();
    const words = q.split(/\W+/).filter(w => w.length > 2);

    const scored = places.map(place => {
      const blob = [
        place.name, place.description, place.type,
        place.whyCurious, place.bestFor, place.category,
        ...(place.tags || []),
      ].join(' ').toLowerCase();

      let score = 0;
      words.forEach(w => {
        if (blob.includes(w))              score += 1;
        if (place.name.toLowerCase().includes(w)) score += 2;
        if (place.type.toLowerCase().includes(w)) score += 1;
      });

      // Semantic boosts
      if (/\brain(y|ing)?\b|wet|indoor/.test(q)              && place.weather === 'indoor')                      score += 5;
      if (/child|kid|famil|toddler/.test(q)                  && place.familyFriendly)                            score += 5;
      if (/free|cheap|budget|no cost/.test(q)                && (place.tags||[]).includes('free-or-cheap'))      score += 5;
      if (/walk|hike|outdoors?|natur/.test(q)                && place.category === 'nature')                     score += 4;
      if (/histor|medieval|ancient|roman|old/.test(q)        && place.category === 'strange-or-historic')        score += 4;
      if (/food|eat|drink|pub|cafe|lunch|dinner/.test(q)     && place.category === 'food-or-treats')             score += 4;
      if (/secret|hidden|discover|unusual|quirky/.test(q)    && place.category === 'hidden-places')              score += 4;
      if (/adventur|excit|thrill|active/.test(q)             && place.category === 'adventures')                 score += 4;
      if (/event|festival|ceremon|traditional|annual/.test(q)&& place.category === 'events')                     score += 4;
      if (/couple|romantic|date night|partner/.test(q)       && !place.familyFriendly)                          score += 2;
      if (/dog|pet/.test(q)                                  && /dog/.test(blob))                                score += 4;
      if (/swim|water|river|lake/.test(q)                    && /swim|river|water|lake/.test(blob))              score += 4;
      if (/star|astron|night sky/.test(q)                    && /astron|star|night/.test(blob))                  score += 4;
      if (/fungus|mushroom|forag/.test(q)                    && /fungus|mushroom|forag/.test(blob))              score += 4;

      if (/weekend|this week|soon|upcoming/.test(q) && place.date) {
        const diff = (new Date(place.date) - new Date()) / 86400000;
        if (diff >= 0 && diff <= 14)  score += 6;
        if (diff >= 0 && diff <= 60)  score += 3;
      }

      if (typeof dateFrom !== 'undefined' && dateFrom && place.date) {
        const d    = new Date(place.date);
        const from = new Date(dateFrom);
        const to   = new Date(dateTo || dateFrom);
        if (d >= from && d <= to) score += 6;
      }

      return { place, score };
    });

    const sorted  = scored.sort((a, b) => b.score - a.score);
    const matched = sorted.filter(s => s.score > 0).slice(0, limit);
    if (matched.length < 10) {
      const extra = sorted.filter(s => s.score === 0).slice(0, limit - matched.length);
      return [...matched, ...extra].map(s => s.place);
    }
    return matched.map(s => s.place);
  }

  // ── Cloudflare Worker proxy (streaming) ───────────────────
  async function streamClaude(userQuery) {
    const relevant = getRelevantPlaces(userQuery);

    const systemPrompt = `You are an enthusiastic, knowledgeable local guide for Oxfordshire, England. You help people discover unusual, interesting, and sometimes eccentric things to do.

You have access to ${places.length} curated places and events. Based on the user's query, the ${relevant.length} most relevant are provided below.

RESPONSE RULES:
- Recommend 3–5 specific places from the list
- Start each with the exact place name in **bold**
- Briefly explain WHY it fits their request (1–2 sentences)
- Highlight what makes it special or unusual
- Include a practical detail (cost, indoor/outdoor, family note)
- If asked WHY, give fuller reasoning
- Keep the tone warm, honest, and enthusiastic
- Do NOT invent places not in the list

CONTEXT PLACES:
${JSON.stringify(relevant.map(p => ({
  name: p.name, type: p.type, category: p.category,
  description: p.description, whyCurious: p.whyCurious,
  cost: p.cost, bestFor: p.bestFor,
  weather: p.weather, familyFriendly: p.familyFriendly,
  date: p.date || null,
})), null, 0)}`;

    messageHistory.push({ role: 'user', content: userQuery });

    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        stream: true,
        system: systemPrompt,
        messages: messageHistory,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText  = '';

    const msgEl  = document.createElement('div');
    msgEl.className = 'chat-msg chat-msg-ai';
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    msgEl.appendChild(bubble);
    messagesEl.appendChild(msgEl);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            fullText += evt.delta.text;
            bubble.innerHTML = renderMarkdown(fullText);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
        } catch {}
      }
    }

    messageHistory.push({ role: 'assistant', content: fullText });
    injectPlaceLinks(msgEl, fullText, relevant);
    return fullText;
  }

  // ── Markdown renderer ─────────────────────────────────────
  function renderMarkdown(text) {
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^(?!<[pul])/, '<p>')
      .replace(/(?<![>])$/, '</p>');
  }

  // ── Place link injection ──────────────────────────────────
  function injectPlaceLinks(msgEl, text, relevant) {
    const matched = relevant.filter(p => text.includes(p.name));
    if (!matched.length) return;

    const linksDiv = document.createElement('div');
    linksDiv.className = 'chat-place-links';

    matched.slice(0, 5).forEach(place => {
      const btn = document.createElement('button');
      btn.className = 'chat-place-link';
      btn.textContent = `📍 ${place.name}`;
      btn.addEventListener('click', () => {
        closeChat();
        if (typeof isMobile === 'function' && isMobile()) {
          if (typeof panToForMobile === 'function') panToForMobile(place.lat, place.lng);
          if (typeof showDetail === 'function') showDetail(place);
        } else {
          map.setView([place.lat, place.lng], 14, { animate: true });
          if (typeof showDesktopDetail === 'function') showDesktopDetail(place);
        }
      });
      linksDiv.appendChild(btn);
    });

    msgEl.appendChild(linksDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── addMessage helper ─────────────────────────────────────
  function addMessage(role, text) {
    const msgEl  = document.createElement('div');
    msgEl.className = `chat-msg chat-msg-${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = role === 'ai' ? renderMarkdown(text) : escHtml(text);
    msgEl.appendChild(bubble);
    messagesEl.appendChild(msgEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return msgEl;
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Send ──────────────────────────────────────────────────
  async function send() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;

    suggestionsEl.classList.add('hidden');
    addMessage('user', text);
    inputEl.value = '';
    autoResize();

    inputEl.disabled = true;
    sendBtn.disabled = true;

    const loadingEl = document.createElement('div');
    loadingEl.className = 'chat-msg chat-msg-ai loading';
    const loadBubble = document.createElement('div');
    loadBubble.className = 'chat-bubble';
    loadingEl.appendChild(loadBubble);
    messagesEl.appendChild(loadingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      loadingEl.remove();
      await streamClaude(text);
    } catch (err) {
      loadingEl.remove();
      let errMsg;
      const m = err.message;
      if (m.includes('429'))      errMsg = 'Daily message limit reached — come back tomorrow!';
      else if (m.includes('503') || m.includes('overloaded')) errMsg = 'AI is busy right now — try again in a moment.';
      else                        errMsg = `Something went wrong: ${m}`;
      addMessage('ai', errMsg);
      console.error('Chat error:', err);
    } finally {
      inputEl.disabled = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn?.addEventListener('click', send);
  inputEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  // ── Suggestion chips ──────────────────────────────────────
  document.querySelectorAll('.chat-sugg').forEach(btn => {
    btn.addEventListener('click', () => {
      inputEl.value = btn.textContent.replace(/^[^\w]+/, '').trim();
      send();
    });
  });

  // ── Auto-resize textarea ──────────────────────────────────
  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }
  inputEl?.addEventListener('input', autoResize);

})();

/**
 * ai-assistant.js
 * AI Assistant widget for Milena Mayilyan's portfolio.
 * - Chat: POSTs to /api/ai-chat (OpenAI proxied server-side)
 * - Voice input: Web Speech API (Chrome/Edge/Safari desktop) with clear
 *   fallback message on unsupported browsers
 * - Voice output: SpeechSynthesis on AI replies
 */

(function () {
  'use strict';

  /* ── DOM ── */
  const aiBubble    = document.getElementById('ai-bubble');
  if (!aiBubble) return;

  const aiToggle    = document.getElementById('ai-toggle');
  const aiPanel     = document.getElementById('ai-panel');
  const aiMessages  = document.getElementById('ai-messages');
  const aiInput     = document.getElementById('ai-input');
  const aiSendBtn   = document.getElementById('ai-send-btn');
  const aiMicBtn    = document.getElementById('ai-mic-btn');
  const aiCloseBtn  = document.getElementById('ai-close-btn');
  const aiIconOpen  = document.getElementById('ai-icon-open');
  const aiIconClose = document.getElementById('ai-icon-close');

  /* ── State ── */
  let isOpen           = false;
  let isLoading        = false;
  let isListening      = false;
  let recognition      = null;
  let currentUtterance = null;
  let conversationHistory = [];

  /* ── Helpers ── */
  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  function appendMessage(text, type, withTTS = false) {
    const div = document.createElement('div');
    div.className = 'chat-msg ' + (
      type === 'ai-user'   ? 'user-msg'    :
      type === 'ai-reply'  ? 'owner-msg'   :
      type === 'ai-error'  ? 'sent-confirm':
      'system'
    );

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    div.appendChild(textSpan);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'chat-msg-time';
    timeDiv.textContent = now();
    div.appendChild(timeDiv);

    // TTS button on AI replies
    if (withTTS && type === 'ai-reply') {
      const btn = document.createElement('button');
      btn.className = 'ai-speak-btn';
      btn.title = 'Read aloud';
      btn.innerHTML = listenIcon();
      btn.addEventListener('click', () => speakText(text, btn));
      div.appendChild(btn);
    }

    aiMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  /* Show/hide a simple typing indicator as a chat-msg */
  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'chat-msg system ai-typing-bubble';
    typingEl.innerHTML = '<span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>';
    aiMessages.appendChild(typingEl);
    scrollToBottom();
  }
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  function setLoading(v) {
    isLoading = v;
    aiSendBtn.disabled = v;
    aiInput.disabled   = v;
  }

  /* ── Panel open/close ── */
  function openPanel() {
    isOpen = true;
    aiPanel.classList.add('open');
    aiIconOpen.style.display  = 'none';
    aiIconClose.style.display = 'block';
    if (aiMessages.children.length === 0) {
      appendMessage("Hi! I'm Milena's AI Assistant ✨ Ask me anything about her skills, projects, or background!", 'system');
    }
    setTimeout(() => aiInput.focus(), 120);
  }

  function closePanel() {
    isOpen = false;
    aiPanel.classList.remove('open');
    aiIconOpen.style.display  = 'block';
    aiIconClose.style.display = 'none';
    stopSpeech();
    stopListening();
  }

  aiToggle.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  aiCloseBtn.addEventListener('click', closePanel);
  document.addEventListener('click', e => {
    if (isOpen && !aiBubble.contains(e.target)) closePanel();
  });

  /* ── Send ── */
  async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text || isLoading) return;
    aiInput.value = '';
    aiInput.style.height = 'auto';
    appendMessage(text, 'ai-user');
    conversationHistory.push({ role: 'user', content: text });
    setLoading(true);
    showTyping();

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory }),
      });
      hideTyping();
      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.';
        try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
        appendMessage(msg, 'ai-error');
        conversationHistory.pop();
      } else {
        const data = await res.json();
        if (data.success && data.reply) {
          appendMessage(data.reply, 'ai-reply', true);
          conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
          appendMessage(data.error || 'No response. Please try again.', 'ai-error');
          conversationHistory.pop();
        }
      }
    } catch (err) {
      hideTyping();
      appendMessage('Network error — please check your connection.', 'ai-error');
      conversationHistory.pop();
    }

    setLoading(false);
    aiInput.focus();
  }

  aiSendBtn.addEventListener('click', sendMessage);
  aiInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  aiInput.addEventListener('input', () => {
    aiInput.style.height = 'auto';
    aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
  });

  /* ── Text-to-Speech ── */
  function speakText(text, btn) {
    if (!window.speechSynthesis) return;
    if (currentUtterance && btn.classList.contains('speaking')) {
      stopSpeech(); btn.classList.remove('speaking'); btn.innerHTML = listenIcon(); return;
    }
    stopSpeech();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95; utt.pitch = 1;
    currentUtterance = utt;
    btn.classList.add('speaking'); btn.innerHTML = stopIcon();
    utt.onend = utt.onerror = () => {
      currentUtterance = null; btn.classList.remove('speaking'); btn.innerHTML = listenIcon();
    };
    window.speechSynthesis.speak(utt);
  }
  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  function listenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Listen`;
  }
  function stopIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`;
  }

  /* ── Speech-to-Text via Web Speech API ── */
  /*
   * Web Speech API (SpeechRecognition) works in:
   *   Chrome (all platforms) — yes
   *   Edge — yes
   *   Safari macOS 14.1+ — yes
   *   Firefox — no (shows friendly message)
   *   Safari iOS — requires user gesture, works on iOS 14.5+
   * No HTTPS requirement for SpeechRecognition unlike MediaRecorder+getUserMedia.
   */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  if (!SR) {
    // Hide mic on truly unsupported browsers (Firefox)
    aiMicBtn.style.display = 'none';
  } else {
    recognition = new SR();
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = 'en-US';

    recognition.onresult = e => {
      let transcript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      aiInput.value = transcript;
      aiInput.style.height = 'auto';
      aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
    };

    recognition.onstart = () => {
      isListening = true;
      aiMicBtn.classList.add('recording');
      aiMicBtn.title = 'Listening… tap to stop';
    };

    recognition.onend = () => {
      isListening = false;
      aiMicBtn.classList.remove('recording');
      aiMicBtn.title = 'Speak your question';
    };

    recognition.onerror = e => {
      isListening = false;
      aiMicBtn.classList.remove('recording');
      if (e.error === 'not-allowed') {
        appendMessage('Microphone access denied. Please allow it in your browser settings.', 'ai-error');
      } else if (e.error === 'no-speech') {
        // Silent — user just didn't speak
      } else {
        appendMessage('Voice input error: ' + e.error + '. Please type instead.', 'ai-error');
      }
    };

    aiMicBtn.addEventListener('click', () => {
      if (isLoading) return;
      if (isListening) {
        stopListening();
      } else {
        try { recognition.start(); }
        catch (err) { console.warn('Speech recognition error:', err); }
      }
    });
  }

  function stopListening() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch (_) {}
    }
    isListening = false;
    aiMicBtn.classList.remove('recording');
  }

})();

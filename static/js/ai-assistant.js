/**
 * ai-assistant.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Assistant widget for Milena Mayilyan's portfolio.
 *
 * Features:
 *  • Sends conversation history to /api/ai-chat (server proxies to OpenAI)
 *  • Speech-to-Text via Web Speech API (SpeechRecognition)
 *  • Text-to-Speech via SpeechSynthesis API on AI replies
 *  • Typing indicator, auto-scroll, session history, error handling
 *  • Completely separate from the existing "Chat with Me" widget
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── DOM references ───────────────────────────────────────────────────── */
  const aiBubble   = document.getElementById('ai-bubble');
  if (!aiBubble) return;  // Safety guard if element is absent

  const aiToggle   = document.getElementById('ai-toggle');
  const aiPanel    = document.getElementById('ai-panel');
  const aiMessages = document.getElementById('ai-messages');
  const aiTyping   = document.getElementById('ai-typing');
  const aiInput    = document.getElementById('ai-input');
  const aiSendBtn  = document.getElementById('ai-send-btn');
  const aiMicBtn   = document.getElementById('ai-mic-btn');
  const aiCloseBtn = document.getElementById('ai-close-btn');
  const aiIconOpen  = document.getElementById('ai-icon-open');
  const aiIconClose = document.getElementById('ai-icon-close');

  /* ── State ────────────────────────────────────────────────────────────── */
  let isOpen        = false;
  let isLoading     = false;
  let isRecording   = false;
  let recognition   = null;   // SpeechRecognition instance
  let currentUtterance = null; // SpeechSynthesisUtterance being spoken

  /**
   * Conversation history sent to the server.
   * Each entry: { role: 'user'|'assistant', content: string }
   * The system prompt is prepended server-side and never stored here.
   */
  let conversationHistory = [];

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  /** Return current time as HH:MM string */
  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /** Scroll messages container to the bottom */
  function scrollToBottom() {
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  /**
   * Append a message bubble to the message list.
   * @param {string} text    - Message content (plain text; HTML is escaped)
   * @param {'ai-system'|'ai-user'|'ai-reply'|'ai-error'} type
   * @param {boolean} [withTTS=false] - Whether to add a speak button
   * @returns {HTMLElement} The created message element
   */
  function appendMessage(text, type, withTTS = false) {
    const div = document.createElement('div');
    div.className = `ai-msg ${type}`;

    // Sanitise text to prevent XSS before inserting
    const safeText = document.createTextNode(text);
    const textSpan = document.createElement('span');
    textSpan.appendChild(safeText);
    div.appendChild(textSpan);

    // Timestamp
    const timeDiv = document.createElement('div');
    timeDiv.className = 'ai-msg-time';
    timeDiv.textContent = now();
    div.appendChild(timeDiv);

    // Optional TTS button for AI replies
    if (withTTS && type === 'ai-reply') {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'ai-speak-btn';
      speakBtn.title = 'Read aloud';
      speakBtn.setAttribute('aria-label', 'Read this message aloud');
      speakBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        Listen`;
      speakBtn.addEventListener('click', () => speakText(text, speakBtn));
      div.appendChild(speakBtn);
    }

    aiMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  /** Show or hide the typing indicator */
  function setTyping(visible) {
    aiTyping.style.display = visible ? 'flex' : 'none';
    if (visible) scrollToBottom();
  }

  /** Enable or disable the send & mic controls */
  function setLoading(loading) {
    isLoading = loading;
    aiSendBtn.disabled = loading;
    aiInput.disabled   = loading;
  }

  /* ── Panel open / close ───────────────────────────────────────────────── */

  function openPanel() {
    isOpen = true;
    aiPanel.classList.add('open');
    aiIconOpen.style.display  = 'none';
    aiIconClose.style.display = 'block';

    // Show welcome message on first open
    if (aiMessages.children.length === 0) {
      appendMessage(
        "Hi! I'm Milena's AI Assistant 🤖 I know her CV, skills, projects, and professional background. Ask me anything about her!",
        'ai-system'
      );
    }

    setTimeout(() => aiInput.focus(), 120);
  }

  function closePanel() {
    isOpen = false;
    aiPanel.classList.remove('open');
    aiIconOpen.style.display  = 'block';
    aiIconClose.style.display = 'none';
    // Stop any ongoing speech
    stopSpeech();
  }

  aiToggle.addEventListener('click', () => {
    isOpen ? closePanel() : openPanel();
  });

  aiCloseBtn.addEventListener('click', closePanel);

  // Close when clicking outside the widget
  document.addEventListener('click', (e) => {
    if (isOpen && !aiBubble.contains(e.target)) {
      closePanel();
    }
  });

  /* ── Send message ─────────────────────────────────────────────────────── */

  async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text || isLoading) return;

    // Clear input and reset height
    aiInput.value = '';
    aiInput.style.height = 'auto';

    // Append user bubble
    appendMessage(text, 'ai-user');

    // Add to history
    conversationHistory.push({ role: 'user', content: text });

    setLoading(true);
    setTyping(true);

    try {
      const response = await fetch('/api/ai-chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: conversationHistory }),
      });

      setTyping(false);

      if (!response.ok) {
        // Try to surface server-side error message
        let errMsg = 'Something went wrong. Please try again.';
        try { const j = await response.json(); errMsg = j.error || errMsg; } catch (_) {}
        appendMessage(errMsg, 'ai-error');
        // Remove the last user message from history to allow retry
        conversationHistory.pop();
      } else {
        const data = await response.json();
        if (data.success && data.reply) {
          appendMessage(data.reply, 'ai-reply', true /* TTS button */);
          conversationHistory.push({ role: 'assistant', content: data.reply });
        } else {
          appendMessage(data.error || 'No response received.', 'ai-error');
          conversationHistory.pop();
        }
      }
    } catch (err) {
      setTyping(false);
      appendMessage('Network error — please check your connection and try again.', 'ai-error');
      conversationHistory.pop();
      console.error('[AI Assistant] Fetch error:', err);
    }

    setLoading(false);
    aiInput.focus();
  }

  aiSendBtn.addEventListener('click', sendMessage);

  aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  aiInput.addEventListener('input', () => {
    aiInput.style.height = 'auto';
    aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
  });

  /* ── Text-to-Speech ───────────────────────────────────────────────────── */

  /** Read text aloud using the Web Speech API */
  function speakText(text, btn) {
    if (!window.speechSynthesis) return;

    // If already speaking the same message, stop it
    if (currentUtterance && btn.classList.contains('speaking')) {
      stopSpeech();
      btn.classList.remove('speaking');
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        Listen`;
      return;
    }

    stopSpeech();  // Stop any previous utterance

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.95;
    utterance.pitch = 1;
    currentUtterance = utterance;

    btn.classList.add('speaking');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
      </svg>
      Stop`;

    utterance.onend = utterance.onerror = () => {
      currentUtterance = null;
      btn.classList.remove('speaking');
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        Listen`;
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  /* ── Speech-to-Text ───────────────────────────────────────────────────── */

  // Feature detection
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  if (!SpeechRecognition) {
    // Hide mic button gracefully on unsupported browsers
    aiMicBtn.disabled = true;
    aiMicBtn.title    = 'Speech input not supported in this browser';
    aiMicBtn.style.opacity = '0.3';
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = 'en-US';

    /** Called with interim/final transcript results */
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      aiInput.value = transcript;
      aiInput.style.height = 'auto';
      aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
    };

    recognition.onstart = () => {
      isRecording = true;
      aiMicBtn.classList.add('recording');
      aiMicBtn.title = 'Listening… click to stop';
    };

    recognition.onend = () => {
      isRecording = false;
      aiMicBtn.classList.remove('recording');
      aiMicBtn.title = 'Speak your question';
    };

    recognition.onerror = (e) => {
      isRecording = false;
      aiMicBtn.classList.remove('recording');
      console.warn('[AI Assistant] Speech recognition error:', e.error);
      if (e.error === 'not-allowed') {
        appendMessage(
          'Microphone access was denied. Please allow microphone permissions in your browser settings.',
          'ai-error'
        );
      }
    };

    aiMicBtn.addEventListener('click', () => {
      if (isLoading) return;
      if (isRecording) {
        recognition.stop();
      } else {
        try { recognition.start(); }
        catch (err) { console.warn('[AI Assistant] Could not start recognition:', err); }
      }
    });
  }

})();

/**
 * ai-assistant.js
 * ─────────────────────────────────────────────────────────────────────────────
 * AI Assistant widget for Milena Mayilyan's portfolio.
 *
 * Features:
 *  • Sends conversation history to /api/ai-chat (server proxies to OpenAI)
 *  • Speech-to-Text via MediaRecorder → /api/ai-transcribe (OpenAI Whisper)
 *    Works on ALL browsers/devices including Safari iOS.
 *  • Text-to-Speech via SpeechSynthesis API on AI replies
 *  • Typing indicator, auto-scroll, session history, error handling
 *  • Completely separate from the existing "Chat with Me" widget
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* ── DOM references ───────────────────────────────────────────────────── */
  const aiBubble   = document.getElementById('ai-bubble');
  if (!aiBubble) return;

  const aiToggle    = document.getElementById('ai-toggle');
  const aiPanel     = document.getElementById('ai-panel');
  const aiMessages  = document.getElementById('ai-messages');
  const aiTyping    = document.getElementById('ai-typing');
  const aiInput     = document.getElementById('ai-input');
  const aiSendBtn   = document.getElementById('ai-send-btn');
  const aiMicBtn    = document.getElementById('ai-mic-btn');
  const aiCloseBtn  = document.getElementById('ai-close-btn');
  const aiIconOpen  = document.getElementById('ai-icon-open');
  const aiIconClose = document.getElementById('ai-icon-close');

  /* ── State ────────────────────────────────────────────────────────────── */
  let isOpen           = false;
  let isLoading        = false;
  let isRecording      = false;
  let mediaRecorder    = null;
  let audioChunks      = [];
  let currentUtterance = null;

  /** Conversation history: [{role, content}, …] — system prompt added server-side */
  let conversationHistory = [];

  /* ── Helpers ──────────────────────────────────────────────────────────── */

  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    aiMessages.scrollTop = aiMessages.scrollHeight;
  }

  /**
   * Append a message bubble.
   * @param {string} text
   * @param {'ai-system'|'ai-user'|'ai-reply'|'ai-error'} type
   * @param {boolean} withTTS  — add Listen button on AI replies
   */
  function appendMessage(text, type, withTTS = false) {
    const div = document.createElement('div');
    div.className = `ai-msg ${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    div.appendChild(textSpan);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'ai-msg-time';
    timeDiv.textContent = now();
    div.appendChild(timeDiv);

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

  function setTyping(visible) {
    aiTyping.style.display = visible ? 'flex' : 'none';
    if (visible) scrollToBottom();
  }

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
    stopSpeech();
    // Stop recording if open panel is closed
    if (isRecording) stopRecording();
  }

  aiToggle.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  aiCloseBtn.addEventListener('click', closePanel);
  document.addEventListener('click', (e) => {
    if (isOpen && !aiBubble.contains(e.target)) closePanel();
  });

  /* ── Send message ─────────────────────────────────────────────────────── */

  async function sendMessage() {
    const text = aiInput.value.trim();
    if (!text || isLoading) return;

    aiInput.value = '';
    aiInput.style.height = 'auto';
    appendMessage(text, 'ai-user');
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
        let errMsg = 'Something went wrong. Please try again.';
        try { const j = await response.json(); errMsg = j.error || errMsg; } catch (_) {}
        appendMessage(errMsg, 'ai-error');
        conversationHistory.pop();
      } else {
        const data = await response.json();
        if (data.success && data.reply) {
          appendMessage(data.reply, 'ai-reply', true);
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  aiInput.addEventListener('input', () => {
    aiInput.style.height = 'auto';
    aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
  });

  /* ── Text-to-Speech ───────────────────────────────────────────────────── */

  function speakText(text, btn) {
    if (!window.speechSynthesis) return;

    if (currentUtterance && btn.classList.contains('speaking')) {
      stopSpeech();
      btn.classList.remove('speaking');
      btn.innerHTML = listenIcon();
      return;
    }

    stopSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate  = 0.95;
    utterance.pitch = 1;
    currentUtterance = utterance;

    btn.classList.add('speaking');
    btn.innerHTML = stopIcon();

    utterance.onend = utterance.onerror = () => {
      currentUtterance = null;
      btn.classList.remove('speaking');
      btn.innerHTML = listenIcon();
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    currentUtterance = null;
  }

  function listenIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    </svg> Listen`;
  }

  function stopIcon() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg> Stop`;
  }

  /* ── Speech-to-Text via MediaRecorder + Whisper ───────────────────────── */
  /*
   * Strategy: use MediaRecorder (supported on all modern browsers including
   * Safari iOS 14.5+) to capture audio, then POST the blob to our backend
   * /api/ai-transcribe which sends it to OpenAI Whisper. This avoids the
   * SpeechRecognition API which is unavailable on many mobile browsers.
   */

  // Check MediaRecorder support
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    aiMicBtn.disabled = true;
    aiMicBtn.title    = 'Audio recording not supported in this browser';
    aiMicBtn.style.opacity = '0.3';
  } else {
    aiMicBtn.addEventListener('click', async () => {
      if (isLoading) return;
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
      }
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type
      const mimeType = getSupportedMimeType();
      const options  = mimeType ? { mimeType } : {};

      mediaRecorder = new MediaRecorder(stream, options);
      audioChunks   = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the mic indicator
        stream.getTracks().forEach(t => t.stop());
        await transcribeAudio(mimeType);
      };

      mediaRecorder.start();
      isRecording = true;
      aiMicBtn.classList.add('recording');
      aiMicBtn.title = 'Recording… tap to stop';

    } catch (err) {
      console.error('[AI Assistant] Mic error:', err);
      if (err.name === 'NotAllowedError') {
        appendMessage('Microphone access was denied. Please allow microphone permissions in your browser settings.', 'ai-error');
      } else {
        appendMessage('Could not access microphone. Please check your device settings.', 'ai-error');
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    aiMicBtn.classList.remove('recording');
    aiMicBtn.title = 'Speak your question';
  }

  async function transcribeAudio(mimeType) {
    if (audioChunks.length === 0) return;

    // Show a subtle loading state on the mic button
    aiMicBtn.disabled = true;
    aiMicBtn.style.opacity = '0.5';

    try {
      const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      const ext  = getExtension(mimeType);
      const formData = new FormData();
      formData.append('audio', blob, `recording.${ext}`);

      const response = await fetch('/api/ai-transcribe', {
        method: 'POST',
        body:   formData,
      });

      const data = await response.json();

      if (data.success && data.transcript) {
        // Place transcript into the input field so user can review before sending
        aiInput.value = data.transcript;
        aiInput.style.height = 'auto';
        aiInput.style.height = Math.min(aiInput.scrollHeight, 100) + 'px';
        aiInput.focus();
      } else {
        appendMessage(data.error || 'Could not transcribe audio. Please try again.', 'ai-error');
      }
    } catch (err) {
      console.error('[AI Assistant] Transcription error:', err);
      appendMessage('Transcription failed — please try again.', 'ai-error');
    } finally {
      aiMicBtn.disabled = false;
      aiMicBtn.style.opacity = '1';
      audioChunks = [];
    }
  }

  /** Return the best audio MIME type supported by this browser */
  function getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';  // Let the browser choose
  }

  /** Map MIME type to file extension for Whisper */
  function getExtension(mimeType) {
    if (!mimeType) return 'webm';
    if (mimeType.includes('ogg'))  return 'ogg';
    if (mimeType.includes('mp4'))  return 'mp4';
    if (mimeType.includes('mpeg')) return 'mp3';
    return 'webm';
  }

})();

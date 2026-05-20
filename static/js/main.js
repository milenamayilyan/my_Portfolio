document.addEventListener('DOMContentLoaded', () => {

  /* ── Custom cursor ── */
  const cursor = document.querySelector('.cursor');
  const ring   = document.querySelector('.cursor-ring');
  if (window.matchMedia('(pointer: fine)').matches) {
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
      setTimeout(() => {
        ring.style.left = e.clientX + 'px';
        ring.style.top  = e.clientY + 'px';
      }, 60);
    });
    document.querySelectorAll('a, button, .skill-pill, .vol-card, .project-card').forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
    });
  } else {
    cursor.style.display = 'none';
    ring.style.display   = 'none';
  }

  /* ── Navbar ── */
  const nav = document.querySelector('nav[aria-label]');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }, { passive: true });


  /* ── Smooth scroll ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); window.scrollTo({ top: target.offsetTop - 70, behavior: 'smooth' }); }
    });
  });

  /* ── Scroll reveal ── */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* ── Hero parallax ── */
  window.addEventListener('scroll', () => {
    const hero = document.querySelector('#hero .hero-grid-line');
    if (hero) hero.style.transform = `translateY(${window.scrollY * 0.15}px)`;
  }, { passive: true });

  /* ── Toast ── */
  function showToast(msg, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.style.borderColor = isError ? '#e07070' : '';
    toast.style.color       = isError ? '#e07070' : '';
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  /* =========================================================
     LIVE CHAT WIDGET — 3-step: name → email → messages
     ========================================================= */
  const chatBubble   = document.getElementById('chat-bubble');
  if (!chatBubble) return;

  const chatToggle   = document.getElementById('chat-toggle');
  const chatPanel    = document.getElementById('chat-panel');
  const chatMessages = document.getElementById('chat-messages');
  const iconOpen     = document.getElementById('chat-icon-open');
  const iconClose    = document.getElementById('chat-icon-close');

  const step1        = document.getElementById('chat-step-1');
  const step2        = document.getElementById('chat-step-2');
  const step3        = document.getElementById('chat-step-3');
  const nameInput    = document.getElementById('chat-name-input');
  const emailInput   = document.getElementById('chat-email-input');
  const msgInput     = document.getElementById('chat-message-input');
  const nextBtn1     = document.getElementById('chat-next-btn');
  const nextBtn2     = document.getElementById('chat-next-btn-2');
  const sendBtn      = document.getElementById('chat-send-btn');

  // Restore session
  let session = { name: '', email: '', messages: [], session_id: null };
  try { const s = sessionStorage.getItem('mm_chat'); if (s) session = JSON.parse(s); } catch(e) {}
  if (!session.session_id) {
    session.session_id = 'sess_' + Math.random().toString(36).slice(2) + Date.now();
  }
  function saveSession() { sessionStorage.setItem('mm_chat', JSON.stringify(session)); }
  saveSession();

  // Connect to SocketIO /chat namespace and join our room
  const chatSocket = io('/chat');
  chatSocket.on('connect', () => {
    chatSocket.emit('join', { session_id: session.session_id });
  });

  // Listen for Milena's replies
  chatSocket.on('owner_reply', (data) => {
    const replyDiv = document.createElement('div');
    replyDiv.className = 'chat-msg owner-msg';
    replyDiv.innerHTML = `${data.message}<div class="chat-msg-time">${formatTime()}</div>`;
    chatMessages.appendChild(replyDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // Open chat panel if closed
    if (!chatOpen) {
      chatOpen = true;
      chatPanel.classList.add('open');
      iconOpen.style.display  = 'none';
      iconClose.style.display = 'block';
    }
  });

  function formatTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMsg(text, type) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.innerHTML = `${text}<div class="chat-msg-time">${formatTime()}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderMessages() {
    chatMessages.innerHTML = '';
    appendMsg("Hi! I'm Milena. Leave me a message and I'll get back to you 💬", 'system');
    session.messages.forEach(m => {
      if (m.type === 'user') appendMsg(m.text, 'user-msg');
      if (m.type === 'confirm') appendMsg(m.text, 'sent-confirm');
    });
  }

  function showCorrectStep() {
    step1.style.display = 'none';
    step2.style.display = 'none';
    step3.style.display = 'none';
    if (!session.name) {
      step1.style.display = 'flex';
      setTimeout(() => nameInput.focus(), 100);
    } else if (!session.email) {
      step2.style.display = 'flex';
      setTimeout(() => emailInput.focus(), 100);
    } else {
      step3.style.display = 'flex';
      setTimeout(() => msgInput.focus(), 100);
    }
  }

  let chatOpen = false;
  chatToggle.addEventListener('click', () => {
    chatOpen = !chatOpen;
    chatPanel.classList.toggle('open', chatOpen);
    iconOpen.style.display  = chatOpen ? 'none' : 'block';
    iconClose.style.display = chatOpen ? 'block' : 'none';
    if (chatOpen) { renderMessages(); showCorrectStep(); }
  });

  document.addEventListener('click', e => {
    if (chatOpen && !chatBubble.contains(e.target)) {
      chatOpen = false;
      chatPanel.classList.remove('open');
      iconOpen.style.display  = 'block';
      iconClose.style.display = 'none';
    }
  });

  // Step 1: name
  function goStep1() {
    const val = nameInput.value.trim();
    if (!val) { nameInput.focus(); return; }
    session.name = val;
    saveSession();
    step1.style.display = 'none';
    step2.style.display = 'flex';
    setTimeout(() => emailInput.focus(), 80);
  }
  nextBtn1.addEventListener('click', goStep1);
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goStep1(); }});

  // Step 2: email
  function goStep2() {
    const val = emailInput.value.trim();
    if (!val) { emailInput.focus(); return; }
    session.email = val;
    saveSession();
    step2.style.display = 'none';
    step3.style.display = 'flex';
    setTimeout(() => msgInput.focus(), 80);
  }
  nextBtn2.addEventListener('click', goStep2);
  emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); goStep2(); }});

  // Step 3: send message
  async function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    msgInput.value = '';
    msgInput.style.height = 'auto';

    session.messages.push({ type: 'user', text });
    saveSession();
    appendMsg(text, 'user-msg');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: session.name, email: session.email, message: text, session_id: session.session_id }),
      });
      const json = await res.json();
      const confirm = json.success ? "✓ Message sent! I'll reply soon." : "⚠ Couldn't send — please try again.";
      session.messages.push({ type: 'confirm', text: confirm });
      saveSession();
      appendMsg(confirm, 'sent-confirm');
    } catch {
      appendMsg("⚠ Network error — please try again.", 'sent-confirm');
    }

    sendBtn.disabled = false;
    msgInput.focus();
  }

  sendBtn.addEventListener('click', sendMessage);
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  msgInput.addEventListener('input', () => {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 100) + 'px';
  });
});

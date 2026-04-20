/* =====================================================
   MILENA MAYILYAN — Portfolio JS
   ===================================================== */

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

  /* ── Navbar scroll behaviour ── */
  const nav = document.querySelector('nav');
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');

  const updateNav = () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);

    // Highlight active section
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    document.querySelectorAll('.nav-links a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  };
  window.addEventListener('scroll', updateNav, { passive: true });

  /* ── Mobile nav ── */
  const hamburger  = document.querySelector('.nav-hamburger');
  const mobileNav  = document.querySelector('.mobile-nav');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
  });
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
    });
  });

  /* ── Smooth scroll ── */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.offsetTop - 70, behavior: 'smooth' });
      }
    });
  });

  /* ── Scroll reveal ── */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  /* ── Contact form ── */
  const form       = document.getElementById('contactForm');
  const formInner  = document.getElementById('formInner');
  const formSuccess = document.getElementById('formSuccess');
  const submitBtn  = document.getElementById('submitBtn');

  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      const data = {
        name:    document.getElementById('name').value,
        email:   document.getElementById('email').value,
        message: document.getElementById('message').value,
      };

      try {
        const res  = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (json.success) {
          formInner.style.display  = 'none';
          formSuccess.style.display = 'block';
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Message';
          showToast('Something went wrong. Please try again.', true);
        }
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
        showToast('Network error. Please try again.', true);
      }
    });
  }

  /* ── Toast helper ── */
  function showToast(msg, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.style.borderColor = isError ? '#e07070' : '';
    toast.style.color       = isError ? '#e07070' : '';
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  /* ── SocketIO: live notifications for owner ── */
  try {
    const socket = io('/admin', { reconnection: false });
    socket.on('new_message', data => {
      showToast(`New message from ${data.name}`);
    });
  } catch { /* SocketIO not loaded, skip */ }

  /* ── Hero parallax ── */
  window.addEventListener('scroll', () => {
    const hero = document.querySelector('#hero .hero-grid-line');
    if (hero) {
      hero.style.transform = `translateY(${window.scrollY * 0.15}px)`;
    }
  }, { passive: true });

  /* ── Typing animation for hero tagline ── */
  // Numbers ticker for hero badge
  const badgeNum = document.querySelector('.badge-count');
  if (badgeNum) {
    let count = 0;
    const target = parseInt(badgeNum.dataset.target);
    const tick = () => {
      if (count < target) {
        count++;
        badgeNum.textContent = count + '+';
        setTimeout(tick, 40);
      }
    };
    setTimeout(tick, 1200);
  }

});

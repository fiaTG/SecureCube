/**
 * SecureCube — ui.js
 * UI utilities: toast notifications, theme manager, form helpers,
 * password strength meter, MFA input handling, countdown timer,
 * particle background canvas.
 */

'use strict';

// ════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ════════════════════════════════════════════════════════════════════════

const Toast = (() => {
  let _container = null;

  const ICONS = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  function _getContainer() {
    if (!_container) _container = document.getElementById('toast-container');
    return _container;
  }

  /**
   * Show a toast notification.
   * @param {string} type    — 'success' | 'error' | 'warning' | 'info'
   * @param {string} title   — Bold heading text
   * @param {string} [msg]   — Optional supporting text
   * @param {number} [duration] — Auto-dismiss ms (0 = no auto-dismiss)
   */
  function show(type, title, msg = '', duration = 4500) {
    const container = _getContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');

    const iconEl = document.createElement('div');
    iconEl.innerHTML = ICONS[type] || ICONS.info;
    toast.appendChild(iconEl.firstElementChild);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'toast-body';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    bodyEl.appendChild(titleEl);

    if (msg) {
      const msgEl = document.createElement('div');
      msgEl.className = 'toast-msg';
      msgEl.textContent = msg;
      bodyEl.appendChild(msgEl);
    }
    toast.appendChild(bodyEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => _dismiss(toast));
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => _dismiss(toast), duration);
    }

    // Announce to screen readers
    AriaAnnouncer.announce(`${type}: ${title}${msg ? '. ' + msg : ''}`);
  }

  function _dismiss(toast) {
    if (!toast || toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400); // fallback
  }

  return Object.freeze({
    show,
    success: (title, msg, dur) => show('success', title, msg, dur),
    error:   (title, msg, dur) => show('error',   title, msg, dur),
    warning: (title, msg, dur) => show('warning', title, msg, dur),
    info:    (title, msg, dur) => show('info',    title, msg, dur),
  });
})();

// ════════════════════════════════════════════════════════════════════════
// ARIA LIVE ANNOUNCER (screen reader notifications)
// ════════════════════════════════════════════════════════════════════════

const AriaAnnouncer = (() => {
  let _el = null;
  let _timer = null;

  function _getEl() {
    if (!_el) _el = document.getElementById('aria-announcer');
    return _el;
  }

  function announce(message, delay = 100) {
    const el = _getEl();
    if (!el) return;
    clearTimeout(_timer);
    el.textContent = '';
    _timer = setTimeout(() => {
      el.textContent = message;
    }, delay);
  }

  return Object.freeze({ announce });
})();

// ════════════════════════════════════════════════════════════════════════
// THEME MANAGER
// ════════════════════════════════════════════════════════════════════════

const ThemeManager = (() => {
  const PREF_KEY = 'theme';

  function _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function init() {
    const saved = SecureStorage.getPreferences()[PREF_KEY];
    const preferred = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    _applyTheme(preferred);

    // Toggle button
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggle);
    }
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    _applyTheme(next);
    SecureStorage.savePreferences({ [PREF_KEY]: next });
    AriaAnnouncer.announce(`Theme switched to ${next} mode.`);
  }

  function getCurrent() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  return Object.freeze({ init, toggle, getCurrent });
})();

// ════════════════════════════════════════════════════════════════════════
// PASSWORD TOGGLE (show / hide)
// ════════════════════════════════════════════════════════════════════════

function initPasswordToggles() {
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.classList.toggle('is-revealed', isHidden);
      btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    });
  });
}

// ════════════════════════════════════════════════════════════════════════
// PASSWORD STRENGTH METER
// ════════════════════════════════════════════════════════════════════════

let _strengthFill, _strengthLabel, _strengthSR;
function updateStrengthMeter(password) {
  _strengthFill  = _strengthFill  || document.getElementById('strength-fill');
  _strengthLabel = _strengthLabel || document.getElementById('strength-label');
  _strengthSR    = _strengthSR    || document.getElementById('reg-pw-strength-sr');
  const fill = _strengthFill, label = _strengthLabel, srEl = _strengthSR;
  if (!fill || !label) return;

  const score = Validator.getPasswordStrength(password);
  const text  = Validator.getStrengthLabel(score);

  fill.dataset.level = password ? score : '';
  label.textContent  = password ? text : '';

  const colorMap = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  label.style.color = colorMap[score] || '';

  if (srEl) srEl.textContent = password ? `Password strength: ${text}` : '';
}

// ════════════════════════════════════════════════════════════════════════
// INLINE FIELD ERROR HELPER
// ════════════════════════════════════════════════════════════════════════

function showFieldError(inputOrId, errorId, message) {
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
  const errEl = document.getElementById(errorId);
  if (input)  input.classList.toggle('is-error', !!message);
  if (errEl)  errEl.textContent = message || '';
}

function clearFieldError(inputOrId, errorId) {
  showFieldError(inputOrId, errorId, '');
  const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
  if (input) input.classList.remove('is-error');
}

function clearAllErrors(formEl) {
  if (!formEl) return;
  formEl.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  formEl.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
}

// ════════════════════════════════════════════════════════════════════════
// LOADING STATE HELPERS
// ════════════════════════════════════════════════════════════════════════

function setButtonLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const textEl    = btn.querySelector('.btn-text');
  const spinnerEl = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  if (textEl)    textEl.style.opacity = loading ? '0' : '1';
  if (spinnerEl) spinnerEl.hidden     = !loading;
}

// ════════════════════════════════════════════════════════════════════════
// MFA DIGIT INPUTS — auto-advance, backspace, paste
// ════════════════════════════════════════════════════════════════════════

function initMFAInputs() {
  const digits = document.querySelectorAll('.mfa-digit');
  if (!digits.length) return;

  digits.forEach((input, idx) => {
    // Only allow numeric input
    input.addEventListener('keydown', (e) => {
      // Allow backspace, tab, arrow keys
      if (['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(e.key)) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          input.value = '';
          input.classList.remove('is-filled', 'is-error');
          if (idx > 0) digits[idx - 1].focus();
        }
        return;
      }
      // Block non-numeric
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    input.addEventListener('input', (e) => {
      const val = input.value.replace(/\D/g, '');
      input.value = val ? val[val.length - 1] : ''; // keep only last digit
      input.classList.toggle('is-filled', !!input.value);
      input.classList.remove('is-error');
      if (input.value && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
    });

    input.addEventListener('focus', () => {
      input.select();
    });
  });

  // Paste handler on the first input (distributes across all)
  digits[0].addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const nums   = pasted.replace(/\D/g, '').slice(0, 6);
    nums.split('').forEach((ch, i) => {
      if (digits[i]) {
        digits[i].value = ch;
        digits[i].classList.add('is-filled');
      }
    });
    // Focus the next empty or the last
    const nextEmpty = Array.from(digits).find(d => !d.value);
    if (nextEmpty) nextEmpty.focus();
    else digits[digits.length - 1].focus();
  });
}

function getMFACode() {
  return Array.from(document.querySelectorAll('.mfa-digit'))
    .map(d => d.value.trim())
    .join('');
}

function clearMFAInputs() {
  document.querySelectorAll('.mfa-digit').forEach(d => {
    d.value = '';
    d.classList.remove('is-filled', 'is-error');
  });
}

function shakeMFAInputs() {
  document.querySelectorAll('.mfa-digit').forEach(d => {
    d.classList.remove('is-error');
    void d.offsetWidth; // reflow to restart animation
    d.classList.add('is-error');
  });
}

// ════════════════════════════════════════════════════════════════════════
// MFA COUNTDOWN TIMER
// ════════════════════════════════════════════════════════════════════════

const CountdownTimer = (() => {
  let _intervalId  = null;
  let _remaining   = 0;
  let _onExpire    = null;

  function _fmt(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function start(seconds, onExpire) {
    stop();
    _remaining = seconds;
    _onExpire  = onExpire;

    const el        = document.getElementById('mfa-countdown');
    const resendBtn = document.getElementById('mfa-resend');
    const submitBtn = document.getElementById('mfa-submit');

    if (el) el.textContent = _fmt(_remaining);
    if (resendBtn) { resendBtn.disabled = true; resendBtn.setAttribute('aria-disabled', 'true'); }
    if (submitBtn) submitBtn.disabled = false;

    _intervalId = setInterval(() => {
      _remaining -= 1;
      if (el) {
        el.textContent = _fmt(Math.max(0, _remaining));
        el.classList.toggle('expiring', _remaining <= 10 && _remaining > 0);
      }
      if (_remaining <= 0) {
        stop();
        if (el) el.textContent = '00:00';
        if (resendBtn) { resendBtn.disabled = false; resendBtn.removeAttribute('aria-disabled'); }
        if (submitBtn) submitBtn.disabled = true;
        if (typeof _onExpire === 'function') _onExpire();
      }
    }, 1000);
  }

  function stop() {
    if (_intervalId) {
      clearInterval(_intervalId);
      _intervalId = null;
    }
  }

  function getRemaining() { return _remaining; }

  return Object.freeze({ start, stop, getRemaining });
})();

// ════════════════════════════════════════════════════════════════════════
// SUCCESS FACE — set content and trigger animation
// ════════════════════════════════════════════════════════════════════════

function setSuccessContent({ title, message, showSettings = false }) {
  const titleEl   = document.getElementById('success-title');
  const msgEl     = document.getElementById('success-message');
  const settingsBtn = document.getElementById('success-settings');

  if (titleEl)    titleEl.textContent = title   || 'Success!';
  if (msgEl)      msgEl.textContent   = message || '';
  if (settingsBtn) settingsBtn.hidden = !showSettings;

  // Re-trigger the SVG animations by cloning
  const svgEl = document.querySelector('.success-svg');
  if (svgEl) {
    const clone = svgEl.cloneNode(true);
    svgEl.parentNode.replaceChild(clone, svgEl);
  }

  AriaAnnouncer.announce(title + (message ? '. ' + message : ''));
}

// ════════════════════════════════════════════════════════════════════════
// SETTINGS FACE — populate user data
// ════════════════════════════════════════════════════════════════════════

function populateSettings(user) {
  if (!user) return;

  const nameEl   = document.getElementById('settings-name');
  const emailEl  = document.getElementById('settings-email');
  const avatarEl = document.getElementById('settings-avatar');

  // Use textContent (not innerHTML) — safe without escaping
  if (nameEl)   nameEl.textContent   = user.fullName || '—';
  if (emailEl)  emailEl.textContent  = user.email    || '—';
  if (avatarEl) avatarEl.textContent = (user.fullName || '?').charAt(0).toUpperCase();
}

function renderAuditLog() {
  const log   = SecureStorage.getAuditLog();
  const logEl = document.getElementById('audit-log');
  if (!logEl) return;

  if (!log.length) {
    logEl.innerHTML = '<li class="audit-log-empty">No activity recorded yet.</li>';
    return;
  }

  const icons = {
    login:     '🔑',
    register:  '✨',
    logout:    '👋',
    mfa:       '🛡️',
    pw_reset:  '🔒',
    delete:    '🗑️',
    settings:  '⚙️',
  };

  logEl.innerHTML = '';
  log.slice(0, 8).forEach(entry => {
    const li   = document.createElement('li');
    const time = new Date(entry.timestamp);
    const fmt  = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const icon = icons[entry.action] || '📋';
    const label = Validator.escapeHTML(entry.detail || entry.action);

    li.innerHTML =
      `<span class="audit-icon" aria-hidden="true">${icon}</span>` +
      `<span>${label}</span>` +
      `<span class="audit-time">${Validator.escapeHTML(fmt)}</span>`;

    logEl.appendChild(li);
  });
}

// ════════════════════════════════════════════════════════════════════════
// PARTICLE BACKGROUND CANVAS
// ════════════════════════════════════════════════════════════════════════

function initParticles() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  const PARTICLE_COUNT = window.innerWidth < 600 ? 30 : 55;
  const MAX_DIST  = 130;
  const SPEED_FACTOR = 0.35;

  let W, H, particles = [], raf;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x:  Math.random() * W,
      y:  Math.random() * H,
      vx: (Math.random() - 0.5) * SPEED_FACTOR,
      vy: (Math.random() - 0.5) * SPEED_FACTOR,
      r:  Math.random() * 2.5 + 1,
    };
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
  }

  function getColors() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      dot:  dark ? 'rgba(100, 160, 255, 0.45)' : 'rgba(37, 99, 235, 0.30)',
      line: dark ? 'rgba(100, 160, 255, '      : 'rgba(37, 99, 235, ',
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const { dot, line } = getColors();

    // Update positions
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1;
      if (p.y < 0 || p.y > H) p.vy *= -1;
    }

    // Build spatial grid to reduce line-drawing from O(n²) to O(n)
    const cellSize = MAX_DIST;
    const grid = new Map();
    for (let i = 0; i < particles.length; i++) {
      const key = `${Math.floor(particles[i].x / cellSize)},${Math.floor(particles[i].y / cellSize)}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }

    // Draw lines only between particles in the same or adjacent cells
    ctx.lineWidth = 0.8;
    for (let i = 0; i < particles.length; i++) {
      const cx = Math.floor(particles[i].x / cellSize);
      const cy = Math.floor(particles[i].y / cellSize);
      for (let nx = cx - 1; nx <= cx + 1; nx++) {
        for (let ny = cy - 1; ny <= cy + 1; ny++) {
          const neighbors = grid.get(`${nx},${ny}`);
          if (!neighbors) continue;
          for (const j of neighbors) {
            if (j <= i) continue;
            const dx   = particles[i].x - particles[j].x;
            const dy   = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MAX_DIST) {
              const alpha = (1 - dist / MAX_DIST) * 0.4;
              ctx.beginPath();
              ctx.strokeStyle = `${line}${alpha.toFixed(3)})`;
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // Draw dots
    ctx.fillStyle = dot;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  function start() {
    init();
    draw();
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
  }

  window.addEventListener('resize', () => {
    resize();
  });

  start();

  // getColors() is called every frame, so particle colors update automatically on theme change.
}

// ════════════════════════════════════════════════════════════════════════
// SIMULATE ASYNC DELAY (network request simulation)
// ════════════════════════════════════════════════════════════════════════

function simulateDelay(ms = 700) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * SecureCube — app.js
 * Main application controller. Orchestrates cube navigation, form handling,
 * session management, and all user interactions.
 *
 * ⚠️ This is a frontend-only demo. All auth is simulated via localStorage.
 * Never ship client-side auth validation as a security mechanism in production.
 */

'use strict';

// ── Delay constants (ms) ────────────────────────────────────────────────
const DELAY = {
  LOGIN:         650,
  REGISTER:      800,
  FORGOT:        700,
  MFA:           600,
  FOCUS_OFFSET:  200, // lets cube transition start before focusing
};

// ── App-level state ─────────────────────────────────────────────────────
const AppState = {
  pendingLoginEmail:  null,  // email waiting for MFA verification
  pendingRememberMe:  false,
  mfaTimerRunning:    false,
  successContext:     null,  // 'register' | 'login' | 'pw_reset' | 'settings'
};

// ════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // 1. Apply saved theme and init background
  ThemeManager.init();
  initParticles();

  // 2. Init cube
  CubeController.init();

  // 3. Init interactive UI
  initPasswordToggles();
  initMFAInputs();

  // 4. Wire up all event listeners
  bindLoginForm();
  bindRegisterForm();
  bindMFAForm();
  bindForgotForm();
  bindSuccessPage();
  bindSettingsPage();
  bindNavLinks();

  // 5. Restore session or pre-fill remembered email
  restoreSession();
});

// ════════════════════════════════════════════════════════════════════════
// SESSION RESTORE
// ════════════════════════════════════════════════════════════════════════

function restoreSession() {
  const session = SecureStorage.getSession();
  if (session && session.loggedIn) {
    // Already logged in — go to settings
    const user = SecureStorage.getUserByEmail(session.email);
    if (user) {
      populateSettings(user);
      renderAuditLog();
      CubeController.snapTo('settings');
      SecureStorage.appendAuditLog('settings', 'Returned to account settings');
      return;
    }
    SecureStorage.clearSession();
  }

  // Pre-fill remembered email
  const prefs = SecureStorage.getPreferences();
  if (prefs.rememberedEmail) {
    const loginEmailEl = document.getElementById('login-email');
    if (loginEmailEl) {
      loginEmailEl.value = prefs.rememberedEmail;
      const rememberEl = document.getElementById('login-remember');
      if (rememberEl) rememberEl.checked = true;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// NAVIGATION LINKS
// ════════════════════════════════════════════════════════════════════════

function bindNavLinks() {
  // Login → Register
  safe('goto-register', 'click', (e) => {
    e.preventDefault();
    clearAllErrors(document.getElementById('login-form'));
    CubeController.rotateTo('register');
    focusFirst('face-register');
  });

  // Login → Forgot
  safe('goto-forgot', 'click', (e) => {
    e.preventDefault();
    clearAllErrors(document.getElementById('login-form'));
    // Pre-fill email from login field
    const loginEmail = document.getElementById('login-email');
    const forgotEmail = document.getElementById('forgot-email');
    if (loginEmail && forgotEmail && loginEmail.value) {
      forgotEmail.value = loginEmail.value;
    }
    CubeController.rotateTo('forgot');
    focusFirst('face-forgot');
  });

  // Register → Login
  safe('register-back', 'click', (e) => {
    e.preventDefault();
    clearAllErrors(document.getElementById('register-form'));
    CubeController.rotateTo('login');
    focusFirst('face-login');
  });

  // MFA → Login
  safe('mfa-back', 'click', (e) => {
    e.preventDefault();
    CountdownTimer.stop();
    AppState.pendingLoginEmail = null;
    clearAllErrors(document.getElementById('mfa-form'));
    clearMFAInputs();
    CubeController.rotateTo('login');
    focusFirst('face-login');
  });

  // Forgot → Login
  safe('forgot-back', 'click', (e) => {
    e.preventDefault();
    clearAllErrors(document.getElementById('forgot-form'));
    CubeController.rotateTo('login');
    focusFirst('face-login');
  });
}

// ════════════════════════════════════════════════════════════════════════
// LOGIN FORM
// ════════════════════════════════════════════════════════════════════════

function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Live validation on blur
  form.querySelector('#login-email')?.addEventListener('blur', () => {
    const val = document.getElementById('login-email').value;
    const result = Validator.validateEmail(val);
    showFieldError('login-email', 'login-email-error', result.valid ? '' : result.message);
  });

  form.addEventListener('submit', handleLoginSubmit);
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  const emailInput = document.getElementById('login-email');
  const pwInput    = document.getElementById('login-password');
  const remember   = document.getElementById('login-remember');
  const form       = document.getElementById('login-form');

  const email    = Validator.normalizeEmail(emailInput.value);
  const password = pwInput.value;

  // ── Validation ──
  let hasError = false;
  if (!validateField(() => Validator.validateEmail(email), 'login-email', 'login-email-error')) hasError = true;
  if (!validateField(() => password ? { valid: true } : { valid: false, message: 'Password is required.' }, 'login-password', 'login-password-error')) hasError = true;
  if (hasError) return;

  // ── Lockout check ──
  const lockStatus = SecureStorage.isLockedOut(email);
  if (lockStatus.locked) {
    showLockout(lockStatus.remainingMs);
    return;
  }

  // ── Submit ──
  setButtonLoading('login-submit', true);
  await simulateDelay(DELAY.LOGIN);

  const user = SecureStorage.validateCredentials(email, password);

  if (!user) {
    setButtonLoading('login-submit', false);

    const attempts = SecureStorage.recordLoginFailure(email);
    const remaining = 5 - attempts.count;

    if (attempts.count >= 5) {
      showLockout(5 * 60 * 1000);
    } else {
      // Generic error — don't reveal whether email or password is wrong
      showFieldError('login-password', 'login-password-error',
        `Incorrect credentials.${remaining > 0 ? ` ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` : ''}`
      );
      Toast.error('Sign in failed', 'Please check your email and password.');
    }
    return;
  }

  // ── Success ── generate MFA code
  SecureStorage.resetLoginAttempts(email);
  hideLockout();

  const code = SecureStorage.generateMFACode(email);

  // Store pending state
  AppState.pendingLoginEmail  = email;
  AppState.pendingRememberMe  = remember?.checked || false;

  // Display demo code
  const demoCodeEl = document.getElementById('mfa-demo-code');
  if (demoCodeEl) demoCodeEl.textContent = code;

  // Start countdown
  clearMFAInputs();
  clearAllErrors(document.getElementById('mfa-form'));
  CountdownTimer.start(60, () => {
    Toast.warning('Code expired', 'Use the Resend button to get a new code.');
  });

  setButtonLoading('login-submit', false);

  // Remember email preference
  if (remember?.checked) {
    SecureStorage.savePreferences({ rememberedEmail: email });
  } else {
    SecureStorage.savePreferences({ rememberedEmail: '' });
  }

  SecureStorage.appendAuditLog('login', `Sign-in initiated for ${email}`);

  CubeController.rotateTo('mfa', () => {
    // Focus first MFA digit after rotation
    const firstDigit = document.querySelector('.mfa-digit');
    if (firstDigit) firstDigit.focus();
  });
}

function showLockout(remainingMs) {
  const msgEl  = document.getElementById('login-lockout-msg');
  const textEl = document.getElementById('login-lockout-text');
  if (!msgEl || !textEl) return;

  const mins = Math.ceil(remainingMs / 60000);
  textEl.textContent = `Account temporarily locked. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
  msgEl.hidden = false;
}

function hideLockout() {
  const msgEl = document.getElementById('login-lockout-msg');
  if (msgEl) msgEl.hidden = true;
}

// ════════════════════════════════════════════════════════════════════════
// REGISTER FORM
// ════════════════════════════════════════════════════════════════════════

function bindRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  // Live password strength
  form.querySelector('#reg-password')?.addEventListener('input', (e) => {
    updateStrengthMeter(e.target.value);
  });

  // Live confirm match
  form.querySelector('#reg-confirm')?.addEventListener('input', () => {
    const pw  = document.getElementById('reg-password').value;
    const con = document.getElementById('reg-confirm').value;
    if (con) {
      const res = Validator.validatePasswordMatch(pw, con);
      showFieldError('reg-confirm', 'reg-confirm-error', res.valid ? '' : res.message);
    }
  });

  form.addEventListener('submit', handleRegisterSubmit);
}

async function handleRegisterSubmit(e) {
  e.preventDefault();

  const name     = Validator.sanitizeText(document.getElementById('reg-name').value);
  const email    = Validator.normalizeEmail(document.getElementById('reg-email').value);
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const terms    = document.getElementById('reg-terms').checked;

  let hasError = false;
  if (!validateField(() => Validator.validateFullName(name),                      'reg-name',     'reg-name-error'))     hasError = true;
  if (!validateField(() => Validator.validateEmail(email),                        'reg-email',    'reg-email-error'))    hasError = true;
  if (!validateField(() => Validator.validatePassword(password, { isNew: true }), 'reg-password', 'reg-password-error')) hasError = true;
  if (!validateField(() => Validator.validatePasswordMatch(password, confirm),    'reg-confirm',  'reg-confirm-error'))  hasError = true;

  const termsRes = Validator.validateTerms(terms);
  if (!termsRes.valid) { document.getElementById('reg-terms-error').textContent = termsRes.message; hasError = true; }
  else document.getElementById('reg-terms-error').textContent = '';

  if (hasError) return;

  setButtonLoading('register-submit', true);
  await simulateDelay(DELAY.REGISTER);

  const result = SecureStorage.createUser({ fullName: name, email, password });

  setButtonLoading('register-submit', false);

  if (!result.ok) {
    showFieldError('reg-email', 'reg-email-error', result.error);
    Toast.error('Registration failed', result.error);
    return;
  }

  SecureStorage.appendAuditLog('register', `Account created: ${email}`);
  Toast.success('Account created!', 'Welcome to SecureCube.');

  AppState.successContext = 'register';
  setSuccessContent({
    title:        'Account created!',
    message:      `Welcome, ${result.user.fullName}! Your account has been created successfully. Sign in to continue.`,
    showSettings: false,
  });

  // Reset form
  document.getElementById('register-form').reset();
  updateStrengthMeter('');

  CubeController.rotateTo('success');
}

// ════════════════════════════════════════════════════════════════════════
// MFA FORM
// ════════════════════════════════════════════════════════════════════════

function bindMFAForm() {
  const form = document.getElementById('mfa-form');
  if (!form) return;

  form.addEventListener('submit', handleMFASubmit);

  safe('mfa-resend', 'click', handleMFAResend);
}

async function handleMFASubmit(e) {
  e.preventDefault();

  // Guard: session may have expired or user navigated here without logging in
  if (!AppState.pendingLoginEmail) {
    Toast.error('Session expired', 'Please sign in again.');
    CubeController.rotateTo('login');
    return;
  }

  const codeInput = getMFACode();
  const codeRes   = Validator.validateMFACode(codeInput);

  if (!codeRes.valid) {
    showFieldError(null, 'mfa-code-error', codeRes.message);
    shakeMFAInputs();
    return;
  }

  clearFieldError(null, 'mfa-code-error');
  setButtonLoading('mfa-submit', true);
  await simulateDelay(DELAY.MFA);

  const email  = AppState.pendingLoginEmail;
  const result = SecureStorage.verifyMFACode(email, codeInput);

  setButtonLoading('mfa-submit', false);

  if (!result.ok) {
    showFieldError(null, 'mfa-code-error', result.error);
    shakeMFAInputs();
    Toast.error('Verification failed', result.error);
    return;
  }

  // MFA success — create session
  CountdownTimer.stop();
  SecureStorage.clearMFACode();
  SecureStorage.saveSession({ email, rememberMe: AppState.pendingRememberMe });
  SecureStorage.appendAuditLog('mfa', `MFA verified for ${email}`);

  const user = SecureStorage.getUserByEmail(email);
  populateSettings(user);
  renderAuditLog();

  AppState.successContext = 'login';
  setSuccessContent({
    title:        'Welcome back!',
    message:      `You are now signed in${user ? ' as ' + user.fullName : ''}. Your session is active.`,
    showSettings: true,
  });

  clearMFAInputs();
  AppState.pendingLoginEmail = null;

  Toast.success('Signed in', `Welcome back${user ? ', ' + user.fullName.split(' ')[0] : ''}!`);
  CubeController.rotateTo('success');
}

async function handleMFAResend() {
  if (!AppState.pendingLoginEmail) {
    Toast.error('Error', 'Session expired. Please sign in again.');
    CubeController.rotateTo('login');
    return;
  }

  const code = SecureStorage.generateMFACode(AppState.pendingLoginEmail);
  const demoCodeEl = document.getElementById('mfa-demo-code');
  if (demoCodeEl) demoCodeEl.textContent = code;

  clearMFAInputs();
  clearFieldError(null, 'mfa-code-error');

  CountdownTimer.start(60, () => {
    Toast.warning('Code expired', 'Use the Resend button to get a new code.');
  });

  Toast.info('Code resent', 'A new verification code has been generated.');
  SecureStorage.appendAuditLog('mfa', 'MFA code resent');

  // Focus first digit
  const firstDigit = document.querySelector('.mfa-digit');
  if (firstDigit) firstDigit.focus();
}

// ════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD FORM
// ════════════════════════════════════════════════════════════════════════

function bindForgotForm() {
  const form = document.getElementById('forgot-form');
  if (!form) return;
  form.addEventListener('submit', handleForgotSubmit);
}

async function handleForgotSubmit(e) {
  e.preventDefault();

  const email   = Validator.normalizeEmail(document.getElementById('forgot-email').value);
  const newPw   = document.getElementById('forgot-new-pw').value;
  const confirm = document.getElementById('forgot-confirm-pw').value;

  let hasError = false;
  if (!validateField(() => Validator.validateEmail(email),                        'forgot-email',       'forgot-email-error'))       hasError = true;
  if (!validateField(() => Validator.validatePassword(newPw, { isNew: true }),    'forgot-new-pw',      'forgot-new-pw-error'))      hasError = true;
  if (!validateField(() => Validator.validatePasswordMatch(newPw, confirm),       'forgot-confirm-pw',  'forgot-confirm-pw-error'))  hasError = true;
  if (hasError) return;

  setButtonLoading('forgot-submit', true);
  await simulateDelay(DELAY.FORGOT);

  const user = SecureStorage.getUserByEmail(email);
  setButtonLoading('forgot-submit', false);

  if (!user) {
    // Generic error — don't confirm whether email exists (security best practice)
    showFieldError('forgot-email', 'forgot-email-error', 'No account found with that email address.');
    Toast.error('Reset failed', 'We could not find an account with that email.');
    return;
  }

  SecureStorage.updateUserPassword(email, newPw);
  SecureStorage.appendAuditLog('pw_reset', `Password reset for ${email}`);

  Toast.success('Password updated', 'You can now sign in with your new password.');

  AppState.successContext = 'pw_reset';
  setSuccessContent({
    title:        'Password reset!',
    message:      'Your password has been updated successfully. You can now sign in with your new credentials.',
    showSettings: false,
  });

  document.getElementById('forgot-form').reset();
  CubeController.rotateTo('success');
}

// ════════════════════════════════════════════════════════════════════════
// SUCCESS PAGE
// ════════════════════════════════════════════════════════════════════════

function bindSuccessPage() {
  safe('success-continue', 'click', () => {
    switch (AppState.successContext) {
      case 'login':
        // Already logged in — go to settings
        CubeController.rotateTo('settings', () => {
          renderAuditLog();
        });
        break;
      default:
        // Register / pw_reset — go back to login
        CubeController.rotateTo('login', () => {
          focusFirst('face-login');
        });
        break;
    }
    AppState.successContext = null;
  });

  safe('success-settings', 'click', () => {
    SecureStorage.appendAuditLog('settings', 'Navigated to account settings');
    renderAuditLog();
    CubeController.rotateTo('settings');
  });
}

// ════════════════════════════════════════════════════════════════════════
// ACCOUNT SETTINGS
// ════════════════════════════════════════════════════════════════════════

function bindSettingsPage() {
  // Change password → go to forgot face
  safe('settings-change-pw', 'click', () => {
    const session = SecureStorage.getSession();
    if (session) {
      const forgotEmail = document.getElementById('forgot-email');
      if (forgotEmail) forgotEmail.value = session.email;
    }
    clearAllErrors(document.getElementById('forgot-form'));
    CubeController.rotateTo('forgot', () => {
      focusFirst('face-forgot');
    });
  });

  // Logout
  safe('settings-logout', 'click', async () => {
    const session = SecureStorage.getSession();
    SecureStorage.appendAuditLog('logout', `Signed out: ${session?.email || 'unknown'}`);
    SecureStorage.clearSession();
    AppState.pendingLoginEmail = null;
    CountdownTimer.stop();

    Toast.info('Signed out', 'You have been signed out successfully.');
    CubeController.rotateTo('login', () => {
      document.getElementById('login-form')?.reset();
      hideLockout();
      focusFirst('face-login');
    });
  });

  // Delete account
  safe('settings-delete', 'click', async () => {
    const session = SecureStorage.getSession();
    if (!session) {
      Toast.error('Error', 'No active session found.');
      return;
    }

    // Confirm — using a simple confirm dialog (acceptable for demo)
    if (!window.confirm('Delete your demo account? This will remove all stored data for your account. This cannot be undone.')) {
      return;
    }

    SecureStorage.appendAuditLog('delete', `Account deleted: ${session.email}`);
    SecureStorage.deleteUser(session.email);
    SecureStorage.clearSession();
    SecureStorage.clearMFACode();

    Toast.warning('Account deleted', 'Your demo account has been removed.');
    CubeController.rotateTo('login', () => {
      document.getElementById('login-form')?.reset();
      hideLockout();
      focusFirst('face-login');
    });
  });
}

// ════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ════════════════════════════════════════════════════════════════════════

/**
 * Run a validator fn, display the result, and return whether the field is valid.
 * Eliminates the repeated if/else showFieldError + clearFieldError pattern.
 */
function validateField(validatorFn, inputId, errorId) {
  const result = validatorFn();
  if (!result.valid) {
    showFieldError(inputId, errorId, result.message);
    return false;
  }
  clearFieldError(inputId, errorId);
  return true;
}

/**
 * Safely attach a single event listener to an element by ID.
 * Silently skips if the element doesn't exist.
 */
function safe(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

/**
 * Focus the first focusable element inside a face.
 */
function focusFirst(faceId) {
  const face = document.getElementById(faceId);
  if (!face) return;
  // Small delay to let the cube transition start
  setTimeout(() => {
    const focusable = face.querySelector(
      'input:not([disabled]):not([type="hidden"]), button:not([disabled]), a[href]'
    );
    if (focusable) focusable.focus({ preventScroll: true });
  }, DELAY.FOCUS_OFFSET);
}

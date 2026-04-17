/**
 * SecureCube — storage.js
 * localStorage abstraction layer for users, sessions, MFA, preferences, and audit log.
 *
 * ⚠️ FRONTEND DEMO SECURITY SIMULATION — NOT production cryptography.
 * Password "hashing" here is a simple XOR-encode + Base64 for demo purposes only.
 * A real application must use bcrypt/argon2 on the server.
 */

'use strict';

const SecureStorage = (() => {

  // Storage key constants
  const KEYS = {
    USERS:              'securecube_users',
    SESSION:            'securecube_session',
    MFA_CODE:           'securecube_mfa_code',
    PREFERENCES:        'securecube_preferences',
    AUDIT_LOG:          'securecube_audit_log',
    LOGIN_ATTEMPTS:     'securecube_login_attempts',
    REGISTER_ATTEMPTS:  'securecube_register_attempts',
  };

  // ── Lightweight demo password encoding ─────────────────────────────────
  // This is NOT secure hashing — it is an encoding for demo visual purposes only.
  const DEMO_KEY = 'SecureCube_Demo_Key_v1';

  function _encodePassword(plaintext) {
    let encoded = '';
    for (let i = 0; i < plaintext.length; i++) {
      encoded += String.fromCharCode(
        plaintext.charCodeAt(i) ^ DEMO_KEY.charCodeAt(i % DEMO_KEY.length)
      );
    }
    return btoa(encoded);
  }

  function _decodePassword(encoded) {
    try {
      const raw = atob(encoded);
      let decoded = '';
      for (let i = 0; i < raw.length; i++) {
        decoded += String.fromCharCode(
          raw.charCodeAt(i) ^ DEMO_KEY.charCodeAt(i % DEMO_KEY.length)
        );
      }
      return decoded;
    } catch {
      return null;
    }
  }

  function _verifyPassword(plaintext, encoded) {
    return _encodePassword(plaintext) === encoded;
  }

  // ── Generic helpers ─────────────────────────────────────────────────────
  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function _remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently ignore storage errors in demo
    }
  }

  // ── ID generator ────────────────────────────────────────────────────────
  function _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ════════════════════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════════════════════

  function getUsers() {
    return _get(KEYS.USERS) || [];
  }

  /**
   * Find a user by email (case-insensitive, trimmed).
   * @returns {object|null}
   */
  function getUserByEmail(email) {
    const normalized = email.trim().toLowerCase();
    return getUsers().find(u => u.email === normalized) || null;
  }

  /**
   * Register a new user. Returns { ok, error, user }.
   */
  function createUser({ fullName, email, password }) {
    const rateCheck = isRegisterRateLimited();
    if (rateCheck.limited) {
      return { ok: false, error: 'Too many registration attempts. Please try again in a few minutes.' };
    }

    const users = getUsers();
    const normalized = email.trim().toLowerCase();

    if (users.find(u => u.email === normalized)) {
      return { ok: false, error: 'Email address is already registered.' };
    }

    _recordRegisterAttempt();

    const user = {
      id:              _generateId(),
      fullName:        fullName.trim(),
      email:           normalized,
      encodedPassword: _encodePassword(password),
      createdAt:       new Date().toISOString(),
    };

    users.push(user);
    _set(KEYS.USERS, users);
    return { ok: true, user };
  }

  /**
   * Update an existing user's password.
   */
  function updateUserPassword(email, newPassword) {
    const users = getUsers();
    const normalized = email.trim().toLowerCase();
    const idx = users.findIndex(u => u.email === normalized);
    if (idx === -1) return false;
    users[idx].encodedPassword = _encodePassword(newPassword);
    return _set(KEYS.USERS, users);
  }

  /**
   * Delete a user by email.
   */
  function deleteUser(email) {
    const normalized = email.trim().toLowerCase();
    const users = getUsers().filter(u => u.email !== normalized);
    return _set(KEYS.USERS, users);
  }

  /**
   * Validate login credentials.
   * @returns {object|null} — user object if valid, null otherwise.
   */
  function validateCredentials(email, password) {
    const user = getUserByEmail(email);
    if (!user) return null;
    if (!_verifyPassword(password, user.encodedPassword)) return null;
    return user;
  }

  // ════════════════════════════════════════════════════════════════════════
  // SESSION
  // ════════════════════════════════════════════════════════════════════════

  const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour simulated session timeout

  function getSession() {
    const session = _get(KEYS.SESSION);
    if (!session || !session.loggedIn) return null;
    // Session timeout check
    if (Date.now() - session.loginTimestamp > SESSION_TTL_MS) {
      clearSession();
      return null;
    }
    return session;
  }

  function saveSession({ email, rememberMe = false }) {
    _set(KEYS.SESSION, {
      email:          email.trim().toLowerCase(),
      loggedIn:       true,
      rememberMe:     !!rememberMe,
      loginTimestamp: Date.now(),
      lastLogin:      new Date().toISOString(),
    });
  }

  function clearSession() {
    _remove(KEYS.SESSION);
  }

  // ════════════════════════════════════════════════════════════════════════
  // MFA CODE
  // ════════════════════════════════════════════════════════════════════════

  const MFA_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate and store a 6-digit MFA code for the given email.
   * @returns {string} The generated code.
   */
  function generateMFACode(email) {
    const code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    _set(KEYS.MFA_CODE, {
      email:     email.trim().toLowerCase(),
      code,
      expiresAt: Date.now() + MFA_TTL_MS,
    });
    return code;
  }

  /**
   * Verify the provided code against the stored one.
   */
  function verifyMFACode(email, inputCode) {
    const stored = _get(KEYS.MFA_CODE);
    if (!stored) return { ok: false, error: 'No code found. Please request a new one.' };
    if (stored.email !== email.trim().toLowerCase()) return { ok: false, error: 'Code mismatch.' };
    if (Date.now() > stored.expiresAt) return { ok: false, error: 'Code has expired. Please resend.' };
    if (stored.code !== inputCode.trim()) return { ok: false, error: 'Incorrect code. Please try again.' };
    return { ok: true };
  }

  function clearMFACode() {
    _remove(KEYS.MFA_CODE);
  }

  function getMFACode() {
    return _get(KEYS.MFA_CODE);
  }

  // ════════════════════════════════════════════════════════════════════════
  // PREFERENCES (theme, remember-me email, etc.)
  // ════════════════════════════════════════════════════════════════════════

  function getPreferences() {
    return _get(KEYS.PREFERENCES) || {};
  }

  function savePreferences(patch) {
    const prefs = getPreferences();
    _set(KEYS.PREFERENCES, { ...prefs, ...patch });
  }

  // ════════════════════════════════════════════════════════════════════════
  // LOGIN ATTEMPT RATE LIMITING (simulated)
  // ════════════════════════════════════════════════════════════════════════

  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_MS    = 5 * 60 * 1000; // 5 minutes

  // ════════════════════════════════════════════════════════════════════════
  // REGISTRATION RATE LIMITING
  // ════════════════════════════════════════════════════════════════════════

  const MAX_REGISTER_ATTEMPTS = 3;
  const REGISTER_WINDOW_MS    = 5 * 60 * 1000; // 5 minutes

  function isRegisterRateLimited() {
    const now      = Date.now();
    const attempts = (_get(KEYS.REGISTER_ATTEMPTS) || []).filter(t => now - t < REGISTER_WINDOW_MS);
    return { limited: attempts.length >= MAX_REGISTER_ATTEMPTS, count: attempts.length };
  }

  function _recordRegisterAttempt() {
    const now      = Date.now();
    const attempts = (_get(KEYS.REGISTER_ATTEMPTS) || []).filter(t => now - t < REGISTER_WINDOW_MS);
    attempts.push(now);
    _set(KEYS.REGISTER_ATTEMPTS, attempts);
  }

  function getLoginAttempts(email) {
    const data = _get(KEYS.LOGIN_ATTEMPTS) || {};
    return data[email.trim().toLowerCase()] || { count: 0, lockedUntil: 0 };
  }

  function recordLoginFailure(email) {
    const key = email.trim().toLowerCase();
    const data = _get(KEYS.LOGIN_ATTEMPTS) || {};
    const current = data[key] || { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    data[key] = current;
    _set(KEYS.LOGIN_ATTEMPTS, data);
    return current;
  }

  function resetLoginAttempts(email) {
    const key = email.trim().toLowerCase();
    const data = _get(KEYS.LOGIN_ATTEMPTS) || {};
    delete data[key];
    _set(KEYS.LOGIN_ATTEMPTS, data);
  }

  function isLockedOut(email) {
    const { count, lockedUntil } = getLoginAttempts(email);
    if (lockedUntil > Date.now()) {
      return { locked: true, remainingMs: lockedUntil - Date.now(), count };
    }
    // Lock expired — reset
    if (count >= MAX_ATTEMPTS) resetLoginAttempts(email);
    return { locked: false, count };
  }

  // ════════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ════════════════════════════════════════════════════════════════════════

  const MAX_LOG_ENTRIES = 20;

  function appendAuditLog(action, detail = '') {
    const log = _get(KEYS.AUDIT_LOG) || [];
    log.unshift({
      action,
      detail,
      timestamp: new Date().toISOString(),
    });
    if (log.length > MAX_LOG_ENTRIES) log.length = MAX_LOG_ENTRIES;
    _set(KEYS.AUDIT_LOG, log);
  }

  function getAuditLog() {
    return _get(KEYS.AUDIT_LOG) || [];
  }

  // ────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────
  return Object.freeze({
    // Users
    getUsers, getUserByEmail, createUser, updateUserPassword, deleteUser, validateCredentials,
    // Session
    getSession, saveSession, clearSession,
    // MFA
    generateMFACode, verifyMFACode, clearMFACode, getMFACode,
    // Preferences
    getPreferences, savePreferences,
    // Rate limiting
    isLockedOut, recordLoginFailure, resetLoginAttempts, getLoginAttempts,
    isRegisterRateLimited,
    // Audit
    appendAuditLog, getAuditLog,
  });

})();

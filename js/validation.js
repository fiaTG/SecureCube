/**
 * SecureCube — validation.js
 * Pure validation functions with no side-effects.
 * All functions return { valid: boolean, message: string }.
 */

'use strict';

const Validator = (() => {

  // ── Email ─────────────────────────────────────────────────────────────
  const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  function validateEmail(value) {
    const v = (value || '').trim();
    if (!v)                    return { valid: false, message: 'Email address is required.' };
    if (!EMAIL_REGEX.test(v))  return { valid: false, message: 'Please enter a valid email address.' };
    if (v.length > 254)        return { valid: false, message: 'Email address is too long.' };
    return { valid: true, message: '' };
  }

  // ── Password rules ────────────────────────────────────────────────────
  const PW_RULES = {
    minLength:    { test: pw => pw.length >= 8,              label: 'At least 8 characters' },
    hasUppercase: { test: pw => /[A-Z]/.test(pw),            label: 'One uppercase letter' },
    hasLowercase: { test: pw => /[a-z]/.test(pw),            label: 'One lowercase letter' },
    hasNumber:    { test: pw => /[0-9]/.test(pw),            label: 'One number' },
    hasSpecial:   { test: pw => /[^A-Za-z0-9]/.test(pw),    label: 'One special character' },
  };

  /**
   * Returns password strength score 0–4.
   * 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong
   */
  function getPasswordStrength(password) {
    if (!password) return 0;
    const score = Object.values(PW_RULES).filter(r => r.test(password)).length;
    return Math.min(4, score);
  }

  function getStrengthLabel(score) {
    return ['', 'Weak', 'Fair', 'Good', 'Strong'][score] || '';
  }

  function validatePassword(value, options = {}) {
    const pw = value || '';
    if (!pw) return { valid: false, message: 'Password is required.' };

    const { isNew = true } = options;
    if (!isNew) {
      // For login — minimal check (just non-empty)
      return { valid: true, message: '' };
    }

    if (pw.length < 8)            return { valid: false, message: 'Password must be at least 8 characters.' };
    if (!/[A-Z]/.test(pw))        return { valid: false, message: 'Include at least one uppercase letter.' };
    if (!/[a-z]/.test(pw))        return { valid: false, message: 'Include at least one lowercase letter.' };
    if (!/[0-9]/.test(pw))        return { valid: false, message: 'Include at least one number.' };
    if (pw.length > 128)           return { valid: false, message: 'Password must be under 128 characters.' };
    return { valid: true, message: '' };
  }

  function validatePasswordMatch(password, confirm) {
    if (!confirm) return { valid: false, message: 'Please confirm your password.' };
    if (password !== confirm) return { valid: false, message: 'Passwords do not match.' };
    return { valid: true, message: '' };
  }

  // ── Full name ─────────────────────────────────────────────────────────
  function validateFullName(value) {
    const v = (value || '').trim();
    if (!v)           return { valid: false, message: 'Full name is required.' };
    if (v.length < 2) return { valid: false, message: 'Name must be at least 2 characters.' };
    if (v.length > 80) return { valid: false, message: 'Name is too long.' };
    // Only allow letters, spaces, hyphens, apostrophes
    if (!/^[\p{L}\s\-'.]+$/u.test(v)) {
      return { valid: false, message: 'Name contains invalid characters.' };
    }
    return { valid: true, message: '' };
  }

  // ── MFA Code ──────────────────────────────────────────────────────────
  function validateMFACode(code) {
    const v = (code || '').replace(/\s/g, '');
    if (!v)              return { valid: false, message: 'Verification code is required.' };
    if (!/^\d{6}$/.test(v)) return { valid: false, message: 'Code must be exactly 6 digits.' };
    return { valid: true, message: '' };
  }

  // ── Terms checkbox ────────────────────────────────────────────────────
  function validateTerms(checked) {
    if (!checked) return { valid: false, message: 'You must accept the terms of service.' };
    return { valid: true, message: '' };
  }

  // ── Input sanitization helpers ────────────────────────────────────────

  /**
   * Escape HTML special characters to prevent XSS when inserting to DOM.
   * Always use this for user-supplied content rendered as text nodes.
   */
  function escapeHTML(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str || '').replace(/[&<>"']/g, c => map[c]);
  }

  /**
   * Trim and normalize whitespace.
   */
  function sanitizeText(str) {
    return String(str || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Normalize email: trim and lowercase.
   */
  function normalizeEmail(str) {
    return String(str || '').trim().toLowerCase();
  }

  // ── Public API ────────────────────────────────────────────────────────
  return Object.freeze({
    validateEmail,
    validatePassword,
    validatePasswordMatch,
    validateFullName,
    validateMFACode,
    validateTerms,
    getPasswordStrength,
    getStrengthLabel,
    escapeHTML,
    sanitizeText,
    normalizeEmail,
  });

})();

/**
 * SecureCube — cube.js
 * 3D CSS cube rotation controller.
 * Manages face transitions and provides a clean API to the rest of the app.
 */

'use strict';

const CubeController = (() => {

  // ── Face → cube transform map ──────────────────────────────────────────
  // Each value is the CSS transform applied to #cube to bring that face
  // to the front (facing the viewer). Absolute values ensure clean state.
  const FACE_TRANSFORMS = {
    login:    'rotateY(0deg)',
    register: 'rotateY(-90deg)',
    mfa:      'rotateY(180deg)',
    forgot:   'rotateY(90deg)',
    success:  'rotateX(90deg)',
    settings: 'rotateX(-90deg)',
  };

  const VALID_FACES = Object.keys(FACE_TRANSFORMS);

  let _cubeEl       = null;
  let _currentFace  = 'login';
  let _isTransitioning = false;
  let _onTransitionEnd = null; // callback

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    _cubeEl = document.getElementById('cube');
    if (!_cubeEl) {
      console.error('[CubeController] #cube element not found.');
      return;
    }

    // Listen for transition end to unlock _isTransitioning
    _cubeEl.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'transform') return;
      _isTransitioning = false;
      if (typeof _onTransitionEnd === 'function') {
        const cb = _onTransitionEnd;
        _onTransitionEnd = null;
        cb(_currentFace);
      }
    });
  }

  // ── Core rotation ──────────────────────────────────────────────────────
  /**
   * Rotate the cube to show the specified face.
   * @param {string}   faceName  — one of VALID_FACES
   * @param {Function} [onDone]  — optional callback when transition completes
   * @param {boolean}  [force]   — skip transition-lock check (use sparingly)
   */
  function rotateTo(faceName, onDone, force = false) {
    if (!_cubeEl) return;
    if (!VALID_FACES.includes(faceName)) {
      console.warn(`[CubeController] Unknown face: "${faceName}"`);
      return;
    }
    if (_isTransitioning && !force) return;
    if (faceName === _currentFace && !force) {
      if (typeof onDone === 'function') onDone(faceName);
      return;
    }

    _isTransitioning = true;
    _currentFace = faceName;
    _onTransitionEnd = onDone || null;

    // Apply the new transform — CSS transition handles the animation
    _cubeEl.style.transform = FACE_TRANSFORMS[faceName];

    // Fallback: if transitionend never fires (e.g. display:none), resolve after timeout
    const TRANSITION_MS = 900;
    setTimeout(() => {
      if (_isTransitioning) {
        _isTransitioning = false;
        if (typeof _onTransitionEnd === 'function') {
          const cb = _onTransitionEnd;
          _onTransitionEnd = null;
          cb(_currentFace);
        }
      }
    }, TRANSITION_MS + 100);
  }

  /**
   * Instantly snap to a face without animation (used on page load).
   */
  function snapTo(faceName) {
    if (!_cubeEl || !VALID_FACES.includes(faceName)) return;
    _cubeEl.style.transition = 'none';
    _cubeEl.style.transform  = FACE_TRANSFORMS[faceName];
    _currentFace = faceName;
    _isTransitioning = false;
    // Re-enable transition after a paint frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (_cubeEl) _cubeEl.style.transition = '';
      });
    });
  }

  function getCurrentFace()   { return _currentFace; }
  function isTransitioning()  { return _isTransitioning; }
  function getValidFaces()    { return [...VALID_FACES]; }

  // ── Public API ─────────────────────────────────────────────────────────
  return Object.freeze({
    init,
    rotateTo,
    snapTo,
    getCurrentFace,
    isTransitioning,
    getValidFaces,
  });

})();

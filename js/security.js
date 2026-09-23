/* =====================================================
   IT SYNDICATE — SECURITY UTILITIES
   Version: 1.0.0
   Path: js/security.js
   =====================================================
   يوفر:
   - Sanitize strings (منع XSS)
   - escapeHtml
   - Rate limiting بسيط
   - CSRF-like token
   - Input validation helpers
   - Session fingerprint
   - منع right-click (اختياري)
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     SANITIZE — منع XSS
     ============================================ */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripTags(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/<[^>]*>/g, '');
  }

  function sanitizeInput(str, maxLength = 1000) {
    if (str === null || str === undefined) return '';
    let s = String(str).trim();
    if (s.length > maxLength) s = s.slice(0, maxLength);
    return stripTags(s);
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /* ============================================
     VALIDATION
     ============================================ */
  function isValidEmail(email) {
    if (!email) return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function isValidPhone(phone) {
    if (!phone) return false;
    const cleaned = String(phone).replace(/[\s\-\(\)\+]/g, '');
    return /^[0-9]{10,15}$/.test(cleaned);
  }

  function isValidNationalId(id) {
    if (!id) return false;
    return /^[0-9]{14}$/.test(String(id));
  }

  function isValidUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url);
      return ['http:', 'https:'].includes(u.protocol);
    } catch (e) {
      return false;
    }
  }

  /* ============================================
     RATE LIMITING
     ============================================ */
  const rateLimits = new Map();

  function rateLimit(key, maxAttempts = 5, windowMs = 60000) {
    const now = Date.now();
    const entry = rateLimits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    rateLimits.set(key, entry);

    if (entry.count > maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      };
    }

    return {
      allowed: true,
      remaining: maxAttempts - entry.count,
      resetAt: entry.resetAt,
      retryAfter: 0
    };
  }

  function clearRateLimit(key) {
    rateLimits.delete(key);
  }

  /* ============================================
     CSRF TOKEN (Client-side)
     ============================================ */
  function generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    if (window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      for (let i = 0; i < length; i++) {
        token += chars[bytes[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        token += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return token;
  }

  function getCsrfToken() {
    let token = sessionStorage.getItem('its_csrf_token');
    if (!token) {
      token = generateToken(32);
      sessionStorage.setItem('its_csrf_token', token);
    }
    return token;
  }

  function validateCsrfToken(token) {
    const stored = sessionStorage.getItem('its_csrf_token');
    return stored && stored === token;
  }

  /* ============================================
     SESSION FINGERPRINT
     ============================================ */
  function getSessionFingerprint() {
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ];
    const str = parts.join('|');
    // simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /* ============================================
     SECURE STORAGE
     ============================================ */
  function secureSet(key, value) {
    try {
      const data = {
        v: value,
        t: Date.now(),
        f: getSessionFingerprint()
      };
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function secureGet(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      // لو الـ fingerprint مختلف، ارفض
      if (data.f && data.f !== getSessionFingerprint()) {
        localStorage.removeItem(key);
        return null;
      }
      return data.v;
    } catch (e) {
      return null;
    }
  }

  /* ============================================
     BASIC PROTECTION (اختياري)
     ============================================ */
  function disableRightClick() {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function disableDevToolsShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') e.preventDefault();
      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
        e.preventDefault();
      }
      // Ctrl+U
      if (e.ctrlKey && e.key.toUpperCase() === 'U') {
        e.preventDefault();
      }
    });
  }

  /* ============================================
     CONSOLE WARNING
     ============================================ */
  function showConsoleWarning() {
    try {
      const style1 = 'color: #ef4444; font-size: 32px; font-weight: bold; text-shadow: 2px 2px 0 #000;';
      const style2 = 'color: #f59e0b; font-size: 16px; font-weight: bold;';
      const style3 = 'color: #fff; font-size: 14px;';

      console.log('%c⚠️ تحذير! ⚠️', style1);
      console.log('%cهذه المنطقة مخصصة للمطورين فقط', style2);
      console.log('%cلا تلصق أي كود هنا إلا لو كنت متأكد 100%', style3);
      console.log('%cأي كود تلصقه قد يسرق بياناتك أو يعطّل حسابك', style3);
    } catch (e) {}
  }

  /* ============================================
     HELPER — Debounce
     ============================================ */
  function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* ============================================
     HELPER — Throttle
     ============================================ */
  function throttle(fn, limit = 300) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  }

  /* ============================================
     EXPORT
     ============================================ */
  window.Security = {
    // Sanitize
    escapeHtml,
    escapeAttr,
    stripTags,
    sanitizeInput,

    // Validation
    isValidEmail,
    isValidPhone,
    isValidNationalId,
    isValidUrl,

    // Rate Limit
    rateLimit,
    clearRateLimit,

    // CSRF
    getCsrfToken,
    validateCsrfToken,
    generateToken,

    // Session
    getSessionFingerprint,

    // Storage
    secureSet,
    secureGet,

    // Protection
    disableRightClick,
    disableDevToolsShortcuts,

    // Helpers
    debounce,
    throttle,

    // Init
    init: function () {
      showConsoleWarning();
      // ⚡ مش بنفعّل الحماية دي بشكل افتراضي — عشان ما تزعجش المستخدم
      // لو عايز تفعّلها، شيل الكومنت:
      // disableRightClick();
      // disableDevToolsShortcuts();
    }
  };

  /* ============================================
     AUTO INIT
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.Security.init();
    });
  } else {
    window.Security.init();
  }

})();

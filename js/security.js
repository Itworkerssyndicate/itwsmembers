/* =====================================================
   IT SYNDICATE — SECURITY (MAXIMUM)
   Version: 3.0.0
   Path: js/security.js
   =====================================================
   ⚠️ حماية قصوى — تمنع أي عبث بالتطبيق
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONFIG
     ============================================ */
  const CONFIG = {
    blockRightClick: true,
    blockKeyboardShortcuts: true,
    blockDevTools: true,
    blockTextSelection: true,
    blockCopy: true,
    blockPrint: true,
    blockDragDrop: true,
    blockViewSource: true,
    blockIframeEmbedding: true,
    detectDevToolsOpen: true,
    showConsoleWarning: true,

    // لما DevTools يتفتح
    onDevToolsOpen: 'lock',       // 'lock' | 'redirect' | 'alert' | 'blur'
    lockMessage: '⚠️ تم اكتشاف محاولة عبث بالتطبيق. يرجى إغلاق أدوات المطور.',

    // اسمح للمطورين على localhost
    allowLocalhost: true
  };

  /* ============================================
     HELPERS
     ============================================ */
  function isLocalhost() {
    return location.hostname === 'localhost' ||
           location.hostname === '127.0.0.1' ||
           location.hostname === '' ||
           location.protocol === 'file:';
  }

  function shouldProtect() {
    if (CONFIG.allowLocalhost && isLocalhost()) return false;
    return true;
  }

  function log(...args) {
    if (shouldProtect()) return;
    console.log('[Security]', ...args);
  }

  /* ============================================
     1) LOCK PAGE
     ============================================ */
  let isLocked = false;

  function lockPage() {
    if (isLocked) return;
    isLocked = true;

    try {
      // غطّي الصفحة بشاشة سوداء + تحذير
      const overlay = document.createElement('div');
      overlay.id = 'security-lock-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        direction: rtl;
        font-family: 'Cairo', sans-serif;
        text-align: center;
        pointer-events: all;
      `;
      overlay.innerHTML = `
        <div style="max-width: 600px;">
          <div style="
            font-size: 80px;
            margin-bottom: 24px;
            animation: pulse 1.5s ease-in-out infinite;
          ">🔒</div>
          <h1 style="
            font-size: 32px;
            color: #ef4444;
            font-weight: 900;
            margin-bottom: 16px;
            font-family: 'Tajawal', sans-serif;
          ">تم قفل الصفحة</h1>
          <p style="
            font-size: 16px;
            color: #a0a8b8;
            line-height: 1.8;
            margin-bottom: 24px;
          ">
            ${CONFIG.lockMessage}
          </p>
          <div style="
            padding: 16px 20px;
            background: rgba(239, 68, 68, 0.1);
            border: 1.5px solid rgba(239, 68, 68, 0.4);
            border-radius: 12px;
            color: #f87171;
            font-size: 13.5px;
            line-height: 1.7;
          ">
            <strong>ملاحظة:</strong> هذه المحاولة تم تسجيلها. الرجاء إغلاق أدوات المطور ثم إعادة تحميل الصفحة.
          </div>
          <button onclick="location.reload()" style="
            margin-top: 24px;
            padding: 12px 32px;
            background: linear-gradient(135deg, #ef4444, #b91c1c);
            color: #fff;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
          ">إعادة تحميل الصفحة</button>
        </div>
        <style>
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
        </style>
      `;

      // امسح كل حاجة في body
      document.body.innerHTML = '';
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';

    } catch (e) {
      // لو فشل، اعمل حاجة أبسط
      try {
        document.documentElement.innerHTML = `
          <body style="background:#000;color:#ef4444;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;">
            <div>
              <h1 style="font-size:32px;margin-bottom:16px;">🔒 تم قفل الصفحة</h1>
              <p>${CONFIG.lockMessage}</p>
            </div>
          </body>
        `;
      } catch (e2) {}
    }
  }

  function handleDevToolsOpen() {
    if (!shouldProtect()) return;

    if (CONFIG.onDevToolsOpen === 'lock') {
      lockPage();
    } else if (CONFIG.onDevToolsOpen === 'alert') {
      alert(CONFIG.lockMessage);
    } else if (CONFIG.onDevToolsOpen === 'blur') {
      document.body.style.filter = 'blur(20px)';
    } else if (CONFIG.onDevToolsOpen === 'redirect') {
      location.href = 'about:blank';
    }
  }

  /* ============================================
     2) منع كليك يمين
     ============================================ */
  function blockContextMenu() {
    if (!CONFIG.blockRightClick) return;
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);
  }

  /* ============================================
     3) منع اختصارات الكيبورد
     ============================================ */
  function blockKeyboardShortcuts() {
    if (!CONFIG.blockKeyboardShortcuts) return;

    document.addEventListener('keydown', (e) => {
      const key = e.key;
      const keyUpper = key ? key.toUpperCase() : '';
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // F12
      if (key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // F5 (Refresh) — لو عايز تمنعه
      // if (key === 'F5') { e.preventDefault(); return false; }

      // Ctrl + Shift + I / J / C / K
      if (ctrl && shift && ['I', 'J', 'C', 'K', 'E', 'M'].includes(keyUpper)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + U (View Source)
      if (ctrl && keyUpper === 'U') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + S (Save)
      if (ctrl && keyUpper === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + P (Print)
      if (ctrl && keyUpper === 'P') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + Shift + S (Save As)
      if (ctrl && shift && keyUpper === 'S') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + Shift + P (Command Palette)
      if (ctrl && shift && keyUpper === 'P') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + A (Select All)
      if (CONFIG.blockTextSelection && ctrl && keyUpper === 'A') {
        // اسمح جوه الـ inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
          return true;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);
  }

  /* ============================================
     4) منع تحديد النص
     ============================================ */
  function blockTextSelection() {
    if (!CONFIG.blockTextSelection) return;
    document.addEventListener('selectstart', (e) => {
      if (e.target.tagName === 'INPUT' ||
          e.target.tagName === 'TEXTAREA' ||
          e.target.isContentEditable) return true;
      e.preventDefault();
      return false;
    }, true);

    // CSS احتياطي
    const style = document.createElement('style');
    style.textContent = `
      *:not(input):not(textarea):not([contenteditable="true"]) {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      input, textarea, [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      img {
        -webkit-user-drag: none;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  /* ============================================
     5) منع النسخ والقطع
     ============================================ */
  function blockCopy() {
    if (!CONFIG.blockCopy) return;
    ['copy', 'cut'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable) return true;
        e.preventDefault();
        return false;
      }, true);
    });
  }

  /* ============================================
     6) منع الطباعة
     ============================================ */
  function blockPrint() {
    if (!CONFIG.blockPrint) return;

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toUpperCase() === 'P') {
        e.preventDefault();
        return false;
      }
    }, true);

    window.print = function () {
      log('Print blocked');
      return false;
    };

    window.addEventListener('beforeprint', (e) => {
      e.preventDefault();
      return false;
    });

    window.matchMedia('print').addEventListener('change', (e) => {
      if (e.matches) {
        document.body.style.display = 'none';
      } else {
        document.body.style.display = '';
      }
    });
  }

  /* ============================================
     7) منع السحب والإفلات
     ============================================ */
  function blockDragDrop() {
    if (!CONFIG.blockDragDrop) return;
    ['dragstart', 'drop', 'dragover', 'dragend'].forEach(evt => {
      document.addEventListener(evt, (e) => {
        if (e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA') return true;
        e.preventDefault();
        return false;
      }, true);
    });
  }

  /* ============================================
     8) منع View Source (Ctrl+U)
     ============================================ */
  function blockViewSource() {
    if (!CONFIG.blockViewSource) return;
    // موجود في blockKeyboardShortcuts
    // كمان ممكن نمنع من view-source: url
    if (window.location.protocol === 'view-source:') {
      window.location.href = 'about:blank';
    }
  }

  /* ============================================
     9) منع Iframe Embedding
     ============================================ */
  function blockIframeEmbedding() {
    if (!CONFIG.blockIframeEmbedding) return;

    try {
      if (window.top !== window.self) {
        // الصفحة جوه iframe
        if (shouldProtect()) {
          // حاول تكسر الـ iframe
          try {
            window.top.location = window.self.location;
          } catch (e) {
            // cross-origin — امسح المحتوى
            document.documentElement.innerHTML = '';
          }
        }
      }
    } catch (e) {}
  }

  /* ============================================
     10) كشف DevTools — طرق متعددة
     ============================================ */
  let devToolsDetected = false;

  function detectDevTools() {
    if (!CONFIG.detectDevToolsOpen) return;

    /* ---------- الطريقة 1: الفرق بين innerWidth/outerWidth ---------- */
    const threshold = 160;

    function checkSize() {
      if (devToolsDetected) return;
      const wDiff = window.outerWidth - window.innerWidth > threshold;
      const hDiff = window.outerHeight - window.innerHeight > threshold;
      if (wDiff || hDiff) {
        devToolsDetected = true;
        handleDevToolsOpen();
      }
    }

    /* ---------- الطريقة 2: debugger timing ---------- */
    function checkDebugger() {
      if (devToolsDetected) return;
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const end = performance.now();
      if (end - start > 150) {
        devToolsDetected = true;
        handleDevToolsOpen();
      }
    }

    /* ---------- الطريقة 3: console detection ---------- */
    function checkConsole() {
      if (devToolsDetected) return;
      const element = new Image();
      let called = false;
      Object.defineProperty(element, 'id', {
        get: function () {
          called = true;
          return 'devtools-detector';
        }
      });
      try {
        console.log('%c', element);
      } catch (e) {}
      if (called) {
        devToolsDetected = true;
        handleDevToolsOpen();
      }
    }

    /* ---------- الطريقة 4: devtools detection element ---------- */
    function checkElement() {
      if (devToolsDetected) return;
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;pointer-events:none;';
      el.id = 'devtools-check-element';
      document.body.appendChild(el);
      // لو العنصر مش موجود أو اتحرك
      setTimeout(() => {
        if (document.getElementById('devtools-check-element')) {
          document.body.removeChild(el);
        }
      }, 100);
    }

    // شغّل كل الفحوصات
    setInterval(checkSize, 1000);
    setInterval(checkDebugger, 3000);
    setInterval(checkConsole, 2000);
    setInterval(checkElement, 5000);

    // فحص عند resize
    window.addEventListener('resize', checkSize);
  }

  /* ============================================
     11) CONSOLE WARNING
     ============================================ */
  function showConsoleWarning() {
    if (!CONFIG.showConsoleWarning) return;
    if (!shouldProtect()) return;

    try {
      const style1 = 'color: #ef4444; font-size: 40px; font-weight: bold; text-shadow: 2px 2px 0 #000;';
      const style2 = 'color: #f59e0b; font-size: 18px; font-weight: bold;';
      const style3 = 'color: #fff; font-size: 14px; line-height: 1.8;';
      const style4 = 'color: #22c55e; font-size: 14px; font-weight: bold;';

      console.log('%c⚠️ تحذير شديد! ⚠️', style1);
      console.log('%cهذه المنطقة محظورة تماماً', style2);
      console.log('%c────────────────────────────────────', style3);
      console.log('%c• لا تلصق أي كود هنا', style3);
      console.log('%c• أي محاولة عبث سيتم تسجيلها', style3);
      console.log('%c• قد يتم قفل حسابك نهائياً', style3);
      console.log('%c────────────────────────────────────', style3);
      console.log('%c🔒 الحماية مفعّلة', style4);
    } catch (e) {}
  }

  /* ============================================
     12) SANITIZE + VALIDATION
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

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
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
    } catch (e) { return false; }
  }

  /* ============================================
     13) RATE LIMITING
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
     14) CSRF + SESSION
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
      try { sessionStorage.setItem('its_csrf_token', token); } catch (e) {}
    }
    return token;
  }

  function validateCsrfToken(token) {
    const stored = sessionStorage.getItem('its_csrf_token');
    return stored && stored === token;
  }

  function getSessionFingerprint() {
    const parts = [
      navigator.userAgent || '',
      navigator.language || '',
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset()
    ];
    const str = parts.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /* ============================================
     15) HELPERS
     ============================================ */
  function debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

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
     INIT
     ============================================ */
  function init() {
    if (!shouldProtect()) {
      console.info('[Security] Localhost — protection disabled');
      return;
    }

    blockContextMenu();
    blockKeyboardShortcuts();
    blockTextSelection();
    blockCopy();
    blockPrint();
    blockDragDrop();
    blockViewSource();
    blockIframeEmbedding();

    setTimeout(() => {
      detectDevTools();
    }, 1500);

    showConsoleWarning();

    console.info('%c🔒 Security Activated', 'color:#22c55e;font-weight:bold;font-size:14px;');
  }

  /* ============================================
     EXPORT
     ============================================ */
  window.Security = {
    config: CONFIG,
    escapeHtml, escapeAttr, stripTags, sanitizeInput,
    isValidEmail, isValidPhone, isValidNationalId, isValidUrl,
    rateLimit, clearRateLimit,
    getCsrfToken, validateCsrfToken, generateToken,
    getSessionFingerprint,
    debounce, throttle,
    lock: lockPage,
    isDevToolsOpen: () => devToolsDetected
  };

  /* ============================================
     AUTO INIT
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

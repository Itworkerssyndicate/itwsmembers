/* =====================================================
   IT SYNDICATE — SECURITY MODULE
   Version: 3.0.0
   Path: js/security.js
   =====================================================
   يحتوي على:
   - منع Right Click (القائمة اليمنى)
   - منع F12 + Ctrl+Shift+I/J/C + Ctrl+U
   - منع النسخ (Copy) — مع استثناء الـ Inputs
   - منع السحب (Drag) للصور
   - كشف DevTools (Debugger Trap + Window Size)
   - Console Warning
   - حماية الحقول الحساسة (الرقم القومي / الباسورد)
   - تعطيل Print Screen (اختياري)
   - منع Iframe Embedding
   - منع Drop من الخارج
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONFIG
     ============================================ */
  const CONFIG = {
    disableRightClick: true,
    disableF12: true,
    disableShortcuts: true,
    disableCopy: true,
    disableCut: true,
    disableDrag: true,
    detectDevTools: true,
    consoleWarning: true,
    disablePrintScreen: false,
    allowInputsCopy: true,
    allowAdminPages: true,
    adminPagePatterns: [
      'admin.html',
      'dashboard.html',
      'head-approval.html',
      'members.html',
      'revenue.html',
      'subscriptions.html',
      'branches.html',
      'governorate.html',
      'social-committee.html',
      'public-relations.html',
      'committees-manager.html',
      'profile.html'
    ]
  };

  /* ============================================
     DETECT CURRENT PAGE
     ============================================ */
  function isAdminPage() {
    if (!CONFIG.allowAdminPages) return false;
    const path = window.location.pathname.toLowerCase();
    return CONFIG.adminPagePatterns.some(p => path.includes(p));
  }

  /* ============================================
     SHOW ALERT (Subtle)
     ============================================ */
  let lastAlertTime = 0;
  function showBlockedAlert() {
    const now = Date.now();
    if (now - lastAlertTime < 2000) return; // Rate limit
    lastAlertTime = now;

    if (typeof window.showToast === 'function') {
      window.showToast('هذا الإجراء غير مسموح', 'warning', 2000);
    }
  }

  /* ============================================
     1) BLOCK RIGHT CLICK
     ============================================ */
  function blockRightClick() {
    if (!CONFIG.disableRightClick) return;

    document.addEventListener('contextmenu', (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (isAdminPage()) return;

      e.preventDefault();
      showBlockedAlert();
      return false;
    }, { capture: true });
  }

  /* ============================================
     2) BLOCK KEYBOARD SHORTCUTS
     ============================================ */
  function blockKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (isAdminPage()) return;

      const key = e.key ? e.key.toUpperCase() : '';
      const keyCode = e.keyCode || e.which;

      // F12
      if (CONFIG.disableF12 && (key === 'F12' || keyCode === 123)) {
        e.preventDefault();
        e.stopPropagation();
        showBlockedAlert();
        return false;
      }

      // Ctrl+Shift+I / J / C / K
      if (CONFIG.disableShortcuts && e.ctrlKey && e.shiftKey) {
        if (['I', 'J', 'C', 'K'].includes(key)) {
          e.preventDefault();
          e.stopPropagation();
          showBlockedAlert();
          return false;
        }
      }

      // Ctrl+U (View Source)
      if (CONFIG.disableShortcuts && e.ctrlKey && !e.shiftKey && key === 'U') {
        e.preventDefault();
        e.stopPropagation();
        showBlockedAlert();
        return false;
      }

      // Ctrl+S (Save Page)
      if (CONFIG.disableShortcuts && e.ctrlKey && !e.shiftKey && key === 'S') {
        e.preventDefault();
        e.stopPropagation();
        showBlockedAlert();
        return false;
      }

      // Print Screen
      if (CONFIG.disablePrintScreen && (key === 'PRINTSCREEN' || keyCode === 44)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, { capture: true });
  }

  /* ============================================
     3) BLOCK COPY / CUT
     ============================================ */
  function blockCopy() {
    if (!CONFIG.disableCopy) return;

    document.addEventListener('copy', (e) => {
      const target = e.target;
      const tag = target.tagName;

      // Allow inputs / textareas
      if (CONFIG.allowInputsCopy && (tag === 'INPUT' || tag === 'TEXTAREA')) {
        return;
      }

      // Allow inside copy-enabled elements
      if (target.closest('[data-allow-copy]')) return;

      // Allow admin pages
      if (isAdminPage()) return;

      e.preventDefault();
      showBlockedAlert();
      return false;
    }, { capture: true });

    if (CONFIG.disableCut) {
      document.addEventListener('cut', (e) => {
        const target = e.target;
        const tag = target.tagName;

        if (CONFIG.allowInputsCopy && (tag === 'INPUT' || tag === 'TEXTAREA')) {
          return;
        }

        if (isAdminPage()) return;

        e.preventDefault();
        showBlockedAlert();
        return false;
      }, { capture: true });
    }
  }

  /* ============================================
     4) BLOCK DRAG (Images + Links)
     ============================================ */
  function blockDrag() {
    if (!CONFIG.disableDrag) return;

    document.addEventListener('dragstart', (e) => {
      const target = e.target;
      if (target.tagName === 'IMG' || target.tagName === 'A') {
        e.preventDefault();
        return false;
      }
    }, { capture: true });
  }

  /* ============================================
     5) DETECT DEVTOOLS (Debugger Trap)
     ============================================ */
  function detectDevToolsDebugger() {
    if (!CONFIG.detectDevTools) return;

    setInterval(() => {
      const start = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const end = performance.now();

      // If devtools is open, the debugger pauses execution > 100ms
      if (end - start > 100) {
        if (window.ITS_DEBUG) console.log('[Security] DevTools detected');
      }
    }, 3000);
  }

  /* ============================================
     6) DETECT DEVTOOLS (Window Size)
     ============================================ */
  function detectDevToolsSize() {
    if (!CONFIG.detectDevTools) return;

    const threshold = 160;

    function check() {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      if (widthDiff > threshold || heightDiff > threshold) {
        if (window.ITS_DEBUG) console.log('[Security] DevTools possible (size detection)');
      }
    }

    setInterval(check, 2000);
  }

  /* ============================================
     7) CONSOLE WARNING
     ============================================ */
  function consoleWarning() {
    if (!CONFIG.consoleWarning) return;

    const styleHeader = `
      color: #e62e2e;
      font-size: 32px;
      font-weight: 900;
      font-family: 'Tajawal', sans-serif;
      text-shadow: 0 0 20px #e62e2e;
      padding: 10px;
    `;

    const styleBody = `
      color: #ff5555;
      font-size: 14px;
      font-weight: 700;
      font-family: 'Cairo', sans-serif;
      padding: 10px;
      line-height: 1.6;
    `;

    const styleInfo = `
      color: #00f0ff;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      padding: 4px;
    `;

    console.log('%c⛔ توقف!', styleHeader);
    console.log(
      '%cهذه المنطقة مخصصة للمطورين فقط.\n' +
      'إذا قام أحدهم بإخبارك بنسخ أو لصق أي شيء هنا،\n' +
      'فهو يحاول اختراق حسابك أو سرقة بياناتك.\n' +
      'يرجى إغلاق هذه النافذة فورًا.',
      styleBody
    );
    console.log('%c— نقابة تكنولوجيا المعلومات والبرمجيات', styleInfo);
  }

  /* ============================================
     8) PROTECT SENSITIVE INPUTS
     ============================================ */
  function protectSensitiveInputs() {
    const sensitivePatterns = [
      'national_id',
      'password',
      'userPassword',
      'phone',
      'card_number',
      'cvv'
    ];

    function protect() {
      sensitivePatterns.forEach(pattern => {
        document.querySelectorAll(`input[name*="${pattern}"], input[id*="${pattern}"]`).forEach(input => {
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('autocorrect', 'off');
          input.setAttribute('autocapitalize', 'off');
          input.setAttribute('spellcheck', 'false');
        });
      });
    }

    protect();

    // Re-protect on DOM changes
    const observer = new MutationObserver(() => {
      protect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /* ============================================
     9) BLOCK IFRAME EMBEDDING (Clickjacking)
     ============================================ */
  function blockIframeEmbedding() {
    try {
      if (window.self !== window.top) {
        console.warn('[Security] Page is embedded in an iframe');
      }
    } catch (e) {
      console.warn('[Security] Cross-origin iframe detected');
    }
  }

  /* ============================================
     10) BLOCK TEXT SELECTION (Optional)
     ============================================ */
  function blockTextSelection() {
    if (isAdminPage()) return;

    const style = document.createElement('style');
    style.textContent = `
      .no-select {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
    `;
    document.head.appendChild(style);
  }

  /* ============================================
     11) DISABLE SAVE PAGE (Ctrl+S)
     ============================================ */
  function disableSavePage() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 's') {
        if (isAdminPage()) return;
        e.preventDefault();
        return false;
      }
    }, { capture: true });
  }

  /* ============================================
     12) DISABLE DROP FROM OUTSIDE
     ============================================ */
  function disableExternalDrop() {
    document.addEventListener('dragover', (e) => {
      if (e.target.closest('.file-upload, [data-allow-drop]')) return;
      e.preventDefault();
    }, { capture: true });

    document.addEventListener('drop', (e) => {
      if (e.target.closest('.file-upload, [data-allow-drop]')) return;
      e.preventDefault();
      return false;
    }, { capture: true });
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    try {
      blockRightClick();
      blockKeyboardShortcuts();
      blockCopy();
      blockDrag();
      consoleWarning();
      protectSensitiveInputs();
      blockIframeEmbedding();
      blockTextSelection();
      disableSavePage();
      disableExternalDrop();

      if (CONFIG.detectDevTools) {
        detectDevToolsDebugger();
        detectDevToolsSize();
      }

      if (window.ITS_DEBUG) {
        console.log('[Security] All protections active');
      }

      window.dispatchEvent(new CustomEvent('security-ready'));

    } catch (err) {
      console.error('[Security] Init failed:', err);
    }
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.Security = {
    isAdminPage,
    config: CONFIG,
    enable: (feature) => {
      if (feature in CONFIG) {
        CONFIG[feature] = true;
      }
    },
    disable: (feature) => {
      if (feature in CONFIG) {
        CONFIG[feature] = false;
      }
    }
  };

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

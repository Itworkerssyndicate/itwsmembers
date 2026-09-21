/* =====================================================
   IT SYNDICATE — Security Layer
   منع العبث + كشف DevTools + منع النسخ + حماية إضافية
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const STORAGE_KEY = 'its_security';
  const LOG_SUSPICIOUS = true;

  const SUSPICIOUS_EVENTS = [];

  /* ============================================
     CONFIG
     ============================================ */
  const CONFIG = {
    // منع الكليك يمين
    disableRightClick: true,

    // منع السحب
    disableDrag: true,

    // منع التحديد
    disableSelection: false, // بنسمح بالتحديد للـ input

    // منع اختصارات الكيبورد
    disableKeyboardShortcuts: true,

    // منع النسخ
    disableCopy: true,

    // منع اللصق
    disablePaste: false, // بنسمح باللصق في الفورم

    // منع القص
    disableCut: true,

    // كشف DevTools
    detectDevTools: true,

    // منع الطباعة (مش بنمنعها — بنسمح بالطباعة للفواتير)
    disablePrint: false,

    // منع حفظ الصفحة
    disableSave: true,

    // منع Ctrl+U (view source)
    disableViewSource: true,

    // Console warning
    consoleWarning: true,

    // حماية الصور
    protectImages: true,

    // منع iframe (Clickjacking)
    preventIframe: true
  };

  /* ============================================
     STATE
     ============================================ */
  let devToolsOpen = false;
  let devToolsCheckInterval = null;
  let warningShown = false;

  /* ============================================
     LOG SUSPICIOUS ACTIVITY
     ============================================ */
  function logSuspicious(event, details) {
    if (!LOG_SUSPICIOUS) return;

    const entry = {
      event,
      details: details || '',
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    SUSPICIOUS_EVENTS.push(entry);

    // أرسل للـ Supabase لو ممكن
    if (window.supabaseClient && window.getCurrentUser) {
      window.getCurrentUser().then(user => {
        if (!user) return;
        window.supabaseClient
          .from('user_actions')
          .insert([{
            user_id: user.id,
            user_email: user.email,
            action: 'suspicious_activity',
            entity: 'security',
            details: `${event}: ${details}`,
            created_at: new Date().toISOString()
          }])
          .then(() => {})
          .catch(() => {});
      }).catch(() => {});
    }
  }

  /* ============================================
     DISABLE RIGHT CLICK
     ============================================ */
  function disableRightClick() {
    if (!CONFIG.disableRightClick) return;

    document.addEventListener('contextmenu', (e) => {
      // اسمح بالكليك يمين في الـ inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      logSuspicious('right_click', `target: ${e.target.tagName}`);
      return false;
    }, false);
  }

  /* ============================================
     DISABLE DRAG
     ============================================ */
  function disableDrag() {
    if (!CONFIG.disableDrag) return;

    document.addEventListener('dragstart', (e) => {
      // اسمح بسحب الصور المرفوعة من الفورم
      if (e.target.tagName === 'IMG' && e.target.closest('.file-upload')) {
        return;
      }
      e.preventDefault();
      return false;
    });

    document.addEventListener('drop', (e) => {
      // اسمح بالـ drop في الفورم
      if (e.target.closest('.file-upload')) {
        return;
      }
      e.preventDefault();
      return false;
    });
  }

  /* ============================================
     DISABLE COPY
     ============================================ */
  function disableCopy() {
    if (!CONFIG.disableCopy) return;

    document.addEventListener('copy', (e) => {
      // اسمح بالنسخ في الـ inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const selection = window.getSelection().toString();
      if (selection.length > 0) {
        e.preventDefault();
        logSuspicious('copy_attempt', `length: ${selection.length}`);
        showSecurityToast('النسخ غير مسموح');
        return false;
      }
    });

    document.addEventListener('cut', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      return false;
    });
  }

  /* ============================================
     DISABLE KEYBOARD SHORTCUTS
     ============================================ */
  function disableKeyboardShortcuts() {
    if (!CONFIG.disableKeyboardShortcuts) return;

    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        logSuspicious('F12_pressed');
        showSecurityToast('غير مسموح');
        return false;
      }

      // Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
      if (e.ctrlKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'i' || key === 'j' || key === 'c') {
          e.preventDefault();
          logSuspicious('devtools_shortcut', `Ctrl+Shift+${key.toUpperCase()}`);
          showSecurityToast('غير مسموح');
          return false;
        }
      }

      // Ctrl+U (view source)
      if (CONFIG.disableViewSource && e.ctrlKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        logSuspicious('view_source_shortcut');
        return false;
      }

      // Ctrl+S (save)
      if (CONFIG.disableSave && e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        logSuspicious('save_shortcut');
        return false;
      }

      // Ctrl+P (print) — بنسمح بها في صفحات الطباعة
      if (CONFIG.disablePrint && e.ctrlKey && e.key.toLowerCase() === 'p') {
        const allowedPages = ['receipt', 'track', 'revenue', 'members', 'subscriptions'];
        const currentPage = window.location.pathname.toLowerCase();
        const isAllowed = allowedPages.some(p => currentPage.includes(p));

        if (!isAllowed) {
          e.preventDefault();
          logSuspicious('print_shortcut');
          return false;
        }
      }

      // Ctrl+A (select all) — بنسمح بها في الـ input
      if (e.ctrlKey && e.key.toLowerCase() === 'a') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
          // بنسمح بالـ select all
        }
      }

      // PrintScreen
      if (e.key === 'PrintScreen') {
        logSuspicious('printscreen');
        // حاول تمسح الـ clipboard
        try {
          navigator.clipboard.writeText('');
        } catch (err) {}
        return false;
      }
    }, false);
  }

  /* ============================================
     PROTECT IMAGES
     ============================================ */
  function protectImages() {
    if (!CONFIG.protectImages) return;

    // منع سحب الصور
    document.querySelectorAll('img').forEach(img => {
      img.addEventListener('dragstart', (e) => e.preventDefault());
    });

    // منع الصور من التحميل المباشر
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.tagName === 'IMG') {
            node.addEventListener('dragstart', (e) => e.preventDefault());
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================
     DETECT DEVTOOLS
     ============================================ */
  function detectDevTools() {
    if (!CONFIG.detectDevTools) return;

    // الطريقة 1: الفرق في الأبعاد
    const threshold = 160;

    function checkDimensions() {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      // لو الأبعاد مختلفة بكتير — يمكن DevTools مفتوحة
      if (widthDiff > threshold || heightDiff > threshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          onDevToolsOpen();
        }
      } else {
        if (devToolsOpen) {
          devToolsOpen = false;
        }
      }
    }

    // الطريقة 2: console.log + toString
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function () {
        devToolsOpen = true;
        onDevToolsOpen();
      }
    });

    // فحص دوري
    devToolsCheckInterval = setInterval(() => {
      checkDimensions();

      // فحص console
      console.log('%c', element);

      // مسح
      console.clear && console.clear();
    }, 1000);
  }

  function onDevToolsOpen() {
    logSuspicious('devtools_opened');

    if (warningShown) return;
    warningShown = true;

    // عرض تحذير
    showDevToolsWarning();

    // امسح console
    setTimeout(() => {
      try {
        console.clear();
      } catch (e) {}
    }, 100);

    // إخفاء المحتوى الحساس
    document.body.classList.add('devtools-open');

    // استنى 3 ثواني وبعدين ارجّع التحذير
    setTimeout(() => {
      warningShown = false;
    }, 3000);
  }

  function showDevToolsWarning() {
    const existing = document.getElementById('itsDevToolsWarning');
    if (existing) existing.remove();

    const warning = document.createElement('div');
    warning.id = 'itsDevToolsWarning';
    warning.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: rgba(0, 0, 0, 0.98);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: 'Cairo', 'Tajawal', sans-serif;
      color: #fff;
      text-align: center;
      animation: fadeIn 0.3s;
    `;

    warning.innerHTML = `
      <div style="max-width: 520px;">
        <div style="
          width: 90px;
          height: 90px;
          margin: 0 auto 24px;
          border-radius: 50%;
          background: rgba(255, 85, 85, 0.1);
          border: 2px solid #ff5555;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 40px rgba(255, 85, 85, 0.4);
          animation: pulseWarning 1.5s ease-in-out infinite;
        ">
          <svg viewBox="0 0 24 24" style="width: 44px; height: 44px; stroke: #ff5555; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h1 style="
          font-size: 28px;
          font-weight: 900;
          color: #ff5555;
          margin-bottom: 12px;
        ">تحذير أمني</h1>
        <p style="
          font-size: 15px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.8;
          margin-bottom: 24px;
        ">
          تم كشف محاولة فتح أدوات المطور.<br>
          هذا الإجراء <strong style="color:#fff;">مخالف</strong> لسياسة الاستخدام الآمن.<br>
          <br>
          تم تسجيل هذه المحاولة في سجلات النظام.
        </p>
        <div style="
          padding: 14px 20px;
          background: rgba(255, 85, 85, 0.1);
          border: 1px solid rgba(255, 85, 85, 0.3);
          border-radius: 12px;
          font-size: 13px;
          color: #ff5555;
          display: inline-block;
        ">
          لإغلاق هذا التحذير، أغلق أدوات المطور
        </div>
        <style>
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes pulseWarning {
            0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(255, 85, 85, 0.4); }
            50% { transform: scale(1.08); box-shadow: 0 0 60px rgba(255, 85, 85, 0.7); }
          }
        </style>
      </div>
    `;

    document.body.appendChild(warning);

    // إخفاء تلقائي عند إغلاق DevTools
    setTimeout(() => {
      if (!devToolsOpen) {
        warning.remove();
      }
    }, 3000);
  }

  /* ============================================
     PREVENT IFRAME (Clickjacking)
     ============================================ */
  function preventIframe() {
    if (!CONFIG.preventIframe) return;

    // لو الصفحة جوه iframe
    if (window.self !== window.top) {
      try {
        // حاول تكسر الـ frame
        window.top.location = window.self.location;
      } catch (e) {
        // لو مش قادر، اعرض رسالة
        document.body.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: #000;
            color: #fff;
            font-family: 'Cairo', sans-serif;
            text-align: center;
            padding: 20px;
          ">
            <div>
              <h1 style="color: #ff5555; font-size: 24px; margin-bottom: 12px;">غير مسموح</h1>
              <p style="color: rgba(255,255,255,0.6); font-size: 14px;">لا يمكن عرض هذه الصفحة داخل إطار</p>
            </div>
          </div>
        `;
      }
    }
  }

  /* ============================================
     CONSOLE WARNING
     ============================================ */
  function consoleWarning() {
    if (!CONFIG.consoleWarning) return;

    // عرض تحذير في الـ console
    const styles = {
      big: 'font-size: 24px; font-weight: bold; color: #ff5555; text-shadow: 1px 1px 2px rgba(0,0,0,0.5); padding: 10px;',
      medium: 'font-size: 14px; font-weight: bold; color: #ffb800; padding: 5px;',
      small: 'font-size: 12px; color: #00f0ff; padding: 3px;'
    };

    setTimeout(() => {
      try {
        console.log('%c⚠️ تحذير!', styles.big);
        console.log('%cهذه الصفحة محمية. أي محاولة للعبث أو تعديل الكود ستُسجل.', styles.medium);
        console.log('%cهذه المنصة مسجلة لـ نقابة تكنولوجيا المعلومات والبرمجيات', styles.small);
      } catch (e) {}
    }, 500);
  }

  /* ============================================
     SHOW SECURITY TOAST
     ============================================ */
  function showSecurityToast(msg) {
    const existing = document.getElementById('itsSecurityToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'itsSecurityToast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-30px);
      z-index: 999998;
      background: rgba(255, 85, 85, 0.95);
      border: 1.5px solid #ff5555;
      color: #fff;
      padding: 12px 22px;
      border-radius: 12px;
      font-family: 'Cairo', 'Tajawal', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      box-shadow: 0 10px 40px rgba(255, 85, 85, 0.5);
      opacity: 0;
      transition: all 0.3s;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    toast.innerHTML = `
      <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>${msg || 'هذا الإجراء غير مسموح'}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-30px)';
      setTimeout(() => toast.remove(), 400);
    }, 2200);
  }

  /* ============================================
     ADD GLOBAL STYLES
     ============================================ */
  function addGlobalStyles() {
    const style = document.createElement('style');
    style.id = 'its-security-styles';
    style.textContent = `
      /* منع التحديد في العناصر الحساسة */
      .no-select,
      .no-select * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }

      /* منع سحب الصور */
      img:not(.file-upload img) {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
        pointer-events: auto;
      }

      /* حماية الـ inputs */
      input, textarea, select {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      /* إخفاء المحتوى عند فتح DevTools */
      body.devtools-open .table-card,
      body.devtools-open .data-grid {
        filter: blur(8px);
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    // إضافة الـ styles
    addGlobalStyles();

    // تفعيل كل الحمايات
    disableRightClick();
    disableDrag();
    disableCopy();
    disableKeyboardShortcuts();
    protectImages();
    preventIframe();
    consoleWarning();

    // DevTools detection — بعد 2 ثانية من التحميل
    setTimeout(() => {
      detectDevTools();
    }, 2000);

    // Console clear دوري (كل 5 ثواني)
    setInterval(() => {
      if (devToolsOpen) {
        try {
          console.clear();
        } catch (e) {}
      }
    }, 5000);

    // حفظ أحداث العبث
    window.addEventListener('beforeunload', () => {
      if (SUSPICIOUS_EVENTS.length > 0) {
        try {
          sessionStorage.setItem('its_security_events', JSON.stringify(SUSPICIOUS_EVENTS));
        } catch (e) {}
      }
    });
  }

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================
     EXPOSE API
     ============================================ */
  window.Security = {
    CONFIG,
    getSuspiciousEvents: () => [...SUSPICIOUS_EVENTS],
    isDevToolsOpen: () => devToolsOpen,
    showWarning: showSecurityToast,
    log: logSuspicious
  };

})();

/* =====================================================
   IT SYNDICATE — Global Settings Manager
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const SETTINGS_TABLE = 'settings';
  const SETTINGS_CACHE_KEY = 'its_site_settings';
  const SETTINGS_VERSION_KEY = 'its_site_settings_v';
  const LOGO_CACHE_KEY = 'its_logo_url';
  const SITE_NAME_CACHE_KEY = 'its_site_name';
  const THEME_CACHE_KEY = 'its_global_default_theme';
  const BROADCAST_CHANNEL = 'its_settings_sync';
  const CACHE_TTL = 1000 * 60 * 60;

  const DEFAULTS = {
    site_name: 'نقابة تكنولوجيا المعلومات والبرمجيات',
    site_name_en: 'IT WORKERS SYNDICATE',
    site_logo_url: '',
    head_name: 'م / محمود جميل',
    head_title: 'النقيب العام',
    vice_president_name: '',
    vice_president_title: 'نائب رئيس النقابة',
    contact_email: 'info@itsyndicate.eg',
    contact_phone: '+20 100 000 0000',
    contact_address: 'القاهرة، مصر',
    footer_button_name: 'تقديم عضوية',
    footer_button_url: 'apply.html',
    default_theme: 'neon-dark',
    splash_duration: '5000',
    max_file_size: '10',
    allow_registration: 'true',
    maintenance_mode: 'false',
    hero_description: 'قدّم طلب عضويتك إلكترونيًا، ارفع مستنداتك، وتابع حالة طلبك لحظة بلحظة.',
    code_card_name: 'syndicate.js',
    code_card_content: '',
    code_card_status: 'ACTIVE',
    features_cards: '[]',
    about_card_enabled: 'false',
    about_card_title: 'عن النقابة',
    about_card_text: '',
    about_card_logo: '',
    cta_title: 'جاهز تبدأ رحلتك مع نقابتك؟',
    cta_subtitle: 'سجّل عضويتك الآن واستمتع بكل المزايا والخدمات',
    footer_description: 'منظومة رقمية متكاملة لتقديم وإدارة عضويات نقابة تكنولوجيا المعلومات والبرمجيات.',
    terms_text: 'أقر بأن جميع البيانات والمستندات المقدمة صحيحة، وأتحمل المسؤولية القانونية عن أي بيانات خاطئة.',
    footer_text: 'نقابة تكنولوجيا المعلومات والبرمجيات — جميع الحقوق محفوظة',
    subscription_reminder_days: '30',
    membership_no_prefix: 'MEM',
    application_prefix: 'ITS'
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let settings = { ...DEFAULTS };
  let lastLoaded = 0;
  let loadingPromise = null;
  let broadcastChannel = null;
  let unsubRealtime = null;
  let initialized = false;

  const changeListeners = new Map();
  const allChangeListeners = [];

  /* ============================================
     HELPERS
     ============================================ */
  function log(...args) {
    if (window.__ITS_DEBUG__) console.log('[Settings]', ...args);
  }

  function warn(...args) {
    console.warn('[Settings]', ...args);
  }

  /* ============================================
     CACHE
     ============================================ */
  function readCache() {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      const cachedVersion = localStorage.getItem(SETTINGS_VERSION_KEY);
      if (cachedVersion !== '2') return null;

      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(SETTINGS_VERSION_KEY, '2');
      if (data.site_logo_url) localStorage.setItem(LOGO_CACHE_KEY, data.site_logo_url);
      if (data.site_name) localStorage.setItem(SITE_NAME_CACHE_KEY, data.site_name);
      if (data.default_theme) localStorage.setItem(THEME_CACHE_KEY, data.default_theme);
    } catch (e) {
      warn('Cache write failed:', e);
    }
  }

  function clearCache() {
    try {
      localStorage.removeItem(SETTINGS_CACHE_KEY);
      localStorage.removeItem(SETTINGS_VERSION_KEY);
    } catch (e) {}
  }

  /* ============================================
     APPLY BRANDING
     ============================================ */
  function applyBranding(data) {
    if (!data) return;

    /* ===== Site name ===== */
    if (data.site_name) {
      document.title = data.site_name;

      document.querySelectorAll('[data-site-name]').forEach(el => {
        el.textContent = data.site_name;
      });

      const navName = document.getElementById('navSiteName');
      if (navName) navName.textContent = data.site_name;

      const footerName = document.getElementById('footerSiteName');
      if (footerName) footerName.textContent = data.site_name;
    }

    /* ===== Site name EN ===== */
    if (data.site_name_en) {
      document.querySelectorAll('[data-site-name-en]').forEach(el => {
        el.textContent = data.site_name_en;
      });
    }

    /* ===== Logo ===== */
    if (data.site_logo_url) {
      applyLogo(data.site_logo_url);
    }

    /* ===== Head ===== */
    if (data.head_name) {
      document.querySelectorAll('[data-head-name]').forEach(el => {
        el.textContent = data.head_name;
      });
    }
    if (data.head_title) {
      document.querySelectorAll('[data-head-title]').forEach(el => {
        el.textContent = data.head_title;
      });
    }

    /* ===== VP ===== */
    if (data.vice_president_name) {
      document.querySelectorAll('[data-vp-name]').forEach(el => {
        el.textContent = data.vice_president_name;
      });
    }
    if (data.vice_president_title) {
      document.querySelectorAll('[data-vp-title]').forEach(el => {
        el.textContent = data.vice_president_title;
      });
    }

    /* ===== Contact ===== */
    if (data.contact_email) {
      document.querySelectorAll('[data-contact-email]').forEach(el => {
        el.textContent = data.contact_email;
      });
    }
    if (data.contact_phone) {
      document.querySelectorAll('[data-contact-phone]').forEach(el => {
        el.textContent = data.contact_phone;
      });
    }
    if (data.contact_address) {
      document.querySelectorAll('[data-contact-address]').forEach(el => {
        el.textContent = data.contact_address;
      });
    }

    /* ===== Footer ===== */
    if (data.footer_text) {
      document.querySelectorAll('[data-footer-text]').forEach(el => {
        el.textContent = data.footer_text;
      });
    }

    /* ===== Terms ===== */
    if (data.terms_text) {
      document.querySelectorAll('[data-terms-text]').forEach(el => {
        el.textContent = data.terms_text;
      });
    }

    /* ===== Dynamic tags (data-setting="key") ===== */
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (!key) return;
      if (!(key in data)) return;

      const value = data[key] ?? '';

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.type === 'checkbox') {
          el.checked = value === 'true';
        } else if (el !== document.activeElement) {
          el.value = value;
        }
      } else {
        if (key === 'code_card_content' || key === 'hero_description' || key === 'footer_description') {
          el.style.whiteSpace = 'pre-line';
        }
        el.textContent = value;
      }
    });

    /* ===== OG Meta ===== */
    updateMetaTags(data);
  }

  function applyLogo(url) {
    if (!url) return;

    // Navbar
    const navImg = document.getElementById('navLogoImg');
    const navFb = document.getElementById('navLogoFallback');
    if (navImg && navFb) {
      navImg.onload = () => { navImg.style.display = 'block'; navFb.style.display = 'none'; };
      navImg.onerror = () => { navImg.style.display = 'none'; navFb.style.display = 'block'; };
      navImg.src = url;
    }

    // Footer
    const ftImg = document.getElementById('footerLogoImg');
    const ftFb = document.getElementById('footerLogoFallback');
    if (ftImg && ftFb) {
      ftImg.onload = () => { ftImg.style.display = 'block'; ftFb.style.display = 'none'; };
      ftImg.onerror = () => { ftImg.style.display = 'none'; ftFb.style.display = 'block'; };
      ftImg.src = url;
    }

    // Splash
    const splashImg = document.getElementById('logoImg');
    const splashFb = document.getElementById('logoFallback');
    if (splashImg && splashFb) {
      splashImg.onload = () => { splashImg.style.display = 'block'; splashFb.style.display = 'none'; };
      splashImg.onerror = () => { splashImg.style.display = 'none'; splashFb.style.display = 'block'; };
      splashImg.src = url;
    }

    // Brand logo (login)
    const brandImg = document.getElementById('brandLogoImg');
    const brandFb = document.getElementById('brandLogoFallback');
    if (brandImg && brandFb) {
      brandImg.onload = () => { brandImg.style.display = 'block'; brandFb.style.display = 'none'; };
      brandImg.onerror = () => { brandImg.style.display = 'none'; brandFb.style.display = 'block'; };
      brandImg.src = url;
    }

    // Receipt
    const receiptImg = document.getElementById('receiptLogoImg');
    const receiptFb = document.getElementById('receiptLogoFallback');
    if (receiptImg && receiptFb) {
      receiptImg.onload = () => { receiptImg.style.display = 'block'; receiptFb.style.display = 'none'; };
      receiptImg.onerror = () => { receiptImg.style.display = 'none'; receiptFb.style.display = 'block'; };
      receiptImg.src = url;
    }

    // About card
    const aboutImg = document.getElementById('aboutLogoImg');
    const aboutFb = document.getElementById('aboutLogoFallback');
    if (aboutImg && aboutFb) {
      aboutImg.onload = () => { aboutImg.style.display = 'block'; aboutFb.style.display = 'none'; };
      aboutImg.onerror = () => { aboutImg.style.display = 'none'; aboutFb.style.display = 'block'; };
      aboutImg.src = url;
    }

    // Generic
    document.querySelectorAll('[data-logo]').forEach(img => {
      img.src = url;
      img.style.display = 'block';
    });

    // Admin preview
    const preview = document.getElementById('logoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${url}" alt="Logo" />`;
      preview.classList.add('has-logo');
    }

    // Favicons
    const fav = document.getElementById('faviconLink');
    const apple = document.getElementById('appleTouchIcon');
    const shortcut = document.getElementById('shortcutIcon');
    if (fav) { fav.type = 'image/png'; fav.href = url; }
    if (apple) { apple.href = url; }
    if (shortcut) { shortcut.href = url; }

    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(el => { el.href = url; });
    document.querySelectorAll('link[rel="icon"]').forEach(el => {
      try { el.type = 'image/png'; el.href = url; } catch (e) {}
    });
  }

  function updateMetaTags(data) {
    if (!data) return;

    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && data.site_name) ogSiteName.setAttribute('content', data.site_name);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && data.site_name) ogTitle.setAttribute('content', data.site_name);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && data.hero_description) ogDesc.setAttribute('content', data.hero_description);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle && data.site_name) twTitle.setAttribute('content', data.site_name);
  }

  /* ============================================
     FETCH
     ============================================ */
  async function fetchFromSupabase() {
    if (!client) return null;

    try {
      const { data, error } = await client
        .from(SETTINGS_TABLE)
        .select('key, value');

      if (error) {
        warn('Fetch failed:', error.message);
        return null;
      }

      const loaded = { ...DEFAULTS };
      (data || []).forEach(row => {
        if (row.key) loaded[row.key] = row.value ?? '';
      });

      return loaded;
    } catch (err) {
      warn('Fetch error:', err);
      return null;
    }
  }

  /* ============================================
     LOAD
     ============================================ */
  async function load(force = false) {
    if (loadingPromise) return loadingPromise;

    if (!force && Date.now() - lastLoaded < CACHE_TTL) {
      const cached = readCache();
      if (cached) {
        settings = cached;
        applyBranding(cached);
        return cached;
      }
    }

    loadingPromise = (async () => {
      const cached = readCache();
      if (cached) {
        settings = cached;
        applyBranding(cached);
      }

      if (!client) {
        if (typeof window.onSupabaseReady === 'function') {
          await new Promise((resolve) => {
            window.onSupabaseReady((c) => {
              client = c;
              resolve();
            });
          });
        } else {
          const start = Date.now();
          while (!client && Date.now() - start < 5000) {
            await new Promise(r => setTimeout(r, 100));
            if (window.supabaseClient) client = window.supabaseClient;
          }
        }
      }

      const fresh = await fetchFromSupabase();
      if (fresh) {
        settings = fresh;
        lastLoaded = Date.now();
        writeCache(fresh);
        applyBranding(fresh);
        notifyAllListeners(settings);
        log('Loaded from Supabase');
      } else if (cached) {
        log('Using cache only');
      }

      loadingPromise = null;
      return settings;
    })();

    return loadingPromise;
  }

  /* ============================================
     GET / SET
     ============================================ */
  function get(key) {
    if (key === undefined || key === null) return { ...settings };
    return settings[key];
  }

  function getAll() {
    return { ...settings };
  }

  async function update(updates) {
    if (!updates || typeof updates !== 'object') return false;
    if (!client) return false;

    try {
      const rows = Object.entries(updates).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString()
      }));

      const { error } = await client
        .from(SETTINGS_TABLE)
        .upsert(rows, { onConflict: 'key' });

      if (error) throw error;

      Object.assign(settings, updates);
      lastLoaded = Date.now();
      writeCache(settings);
      applyBranding(settings);

      broadcastUpdate({ type: 'settings-updated', updates });

      Object.entries(updates).forEach(([k, v]) => notifyListeners(k, v, settings));
      notifyAllListeners(settings);

      return true;
    } catch (err) {
      warn('Update failed:', err);
      return false;
    }
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function onChange(key, callback) {
    if (typeof callback !== 'function') return () => {};

    if (!changeListeners.has(key)) changeListeners.set(key, []);
    changeListeners.get(key).push(callback);

    return function unsubscribe() {
      const arr = changeListeners.get(key);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx > -1) arr.splice(idx, 1);
        if (arr.length === 0) changeListeners.delete(key);
      }
    };
  }

  function onAnyChange(callback) {
    if (typeof callback !== 'function') return () => {};
    allChangeListeners.push(callback);
    return function unsubscribe() {
      const idx = allChangeListeners.indexOf(callback);
      if (idx > -1) allChangeListeners.splice(idx, 1);
    };
  }

  function notifyListeners(key, value, allSettings) {
    const arr = changeListeners.get(key);
    if (!arr) return;
    arr.forEach(cb => {
      try { cb(value, key, allSettings); } catch (e) { warn('Listener error:', e); }
    });
  }

  function notifyAllListeners(allSettings) {
    allChangeListeners.forEach(cb => {
      try { cb(allSettings); } catch (e) { warn('Listener error:', e); }
    });
  }

  /* ============================================
     BROADCAST
     ============================================ */
  function initBroadcast() {
    if (broadcastChannel) return;

    try {
      if ('BroadcastChannel' in window) {
        broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
        broadcastChannel.addEventListener('message', (e) => {
          const msg = e.data;
          if (msg?.type === 'settings-updated') {
            log('Broadcast received — reloading');
            load(true);
          }
        });
      } else {
        window.addEventListener('storage', (e) => {
          if (e.key === SETTINGS_CACHE_KEY && e.newValue) {
            try {
              const data = JSON.parse(e.newValue);
              settings = data;
              applyBranding(data);
              notifyAllListeners(data);
            } catch (err) {}
          }
        });
      }
    } catch (e) {
      warn('Broadcast init failed:', e);
    }
  }

  function broadcastUpdate(message) {
    try {
      if (broadcastChannel) broadcastChannel.postMessage(message);
    } catch (e) {}
  }

  /* ============================================
     REALTIME
     ============================================ */
  function initRealtime() {
    if (!window.Realtime || unsubRealtime) return;

    try {
      unsubRealtime = window.Realtime.watch(
        SETTINGS_TABLE,
        '*',
        window.debounce ? window.debounce(() => {
          log('Realtime change detected');
          load(true);
        }, 500) : () => load(true)
      );
    } catch (e) {
      warn('Realtime init failed:', e);
    }
  }

  /* ============================================
     HELPERS
     ============================================ */
  function isMaintenanceMode() {
    return settings.maintenance_mode === 'true';
  }

  function isRegistrationOpen() {
    return settings.allow_registration !== 'false';
  }

  function getMaxFileSizeBytes() {
    const mb = parseFloat(settings.max_file_size) || 10;
    return mb * 1024 * 1024;
  }

  function getMaxFileSizeMB() {
    return parseFloat(settings.max_file_size) || 10;
  }

  function getSplashDuration() {
    return parseInt(settings.splash_duration) || 5000;
  }

  function getDefaultTheme() {
    return settings.default_theme || DEFAULTS.default_theme;
  }

  /* ============================================
     MAINTENANCE OVERLAY
     ============================================ */
  function showMaintenanceOverlay() {
    const path = window.location.pathname.toLowerCase();
    const isAdminPath = path.includes('login') ||
                        path.includes('dashboard') ||
                        path.includes('admin') ||
                        path.includes('receipt');

    if (isAdminPath) return;
    if (!isMaintenanceMode()) return;
    if (document.getElementById('itsMaintenanceOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'itsMaintenanceOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: #000; display: flex; align-items: center; justify-content: center;
      padding: 20px; font-family: 'Cairo', 'Tajawal', sans-serif;
      color: #fff; text-align: center;
    `;

    overlay.innerHTML = `
      <div style="max-width:520px;">
        <div style="width:80px;height:80px;margin:0 auto 24px;border-radius:50%;background:rgba(255,184,0,0.1);border:1.5px solid #ffb800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(255,184,0,0.3);animation: pulseIcon 2s ease-in-out infinite;">
          <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:#ffb800;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h1 style="font-size:28px;font-weight:900;margin-bottom:12px;background:linear-gradient(135deg, #ffb800, #f97316);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">المنصة تحت الصيانة</h1>
        <p style="font-size:15px;color:rgba(255,255,255,0.6);line-height:1.8;margin-bottom:24px;">
          نعتذر عن الإزعاج، نقوم حاليًا بأعمال صيانة وتحديث للمنصة. سيتم استئناف الخدمة قريبًا.
        </p>
        <div style="font-size:13px;color:rgba(255,255,255,0.4);padding:12px 20px;background:rgba(255,184,0,0.05);border:1px solid rgba(255,184,0,0.2);border-radius:12px;display:inline-block;">
          للاستفسار: ${settings.contact_email || DEFAULTS.contact_email}
        </div>
      </div>
      <style>
        @keyframes pulseIcon {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      </style>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.SettingsManager = {
    init,
    load,
    refresh: () => load(true),
    get,
    getAll,
    update,
    applyBranding,
    applyLogo,
    onChange,
    onAnyChange,
    isMaintenanceMode,
    isRegistrationOpen,
    getMaxFileSizeBytes,
    getMaxFileSizeMB,
    getSplashDuration,
    getDefaultTheme,
    clearCache,
    DEFAULTS,
    CACHE_TTL
  };

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (initialized) return;
    initialized = true;

    const cached = readCache();
    if (cached) {
      settings = cached;
      applyBranding(cached);
      log('Applied from cache');
    }

    initBroadcast();

    if (typeof window.onSupabaseReady === 'function') {
      window.onSupabaseReady((c) => {
        client = c;
        load(false).then(() => {
          initRealtime();
          showMaintenanceOverlay();
          window.dispatchEvent(new CustomEvent('settings-ready', {
            detail: { settings: { ...settings } }
          }));
          log('Ready');
        });
      });
    } else {
      const start = Date.now();
      const checkInterval = setInterval(() => {
        if (window.supabaseClient) {
          clearInterval(checkInterval);
          client = window.supabaseClient;
          load(false).then(() => {
            initRealtime();
            showMaintenanceOverlay();
            window.dispatchEvent(new CustomEvent('settings-ready', {
              detail: { settings: { ...settings } }
            }));
            log('Ready (auto-detected)');
          });
        } else if (Date.now() - start > 5000) {
          clearInterval(checkInterval);
          warn('Supabase client not found, using cache only');
          window.dispatchEvent(new CustomEvent('settings-ready', {
            detail: { settings: { ...settings }, offline: true }
          }));
        }
      }, 100);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =====================================================
   IT SYNDICATE — Global Settings Manager
   =====================================================
   - Loads site settings from Supabase
   - Caches in localStorage for instant load
   - Auto-applies branding (logo, name, favicon)
   - Syncs across tabs via BroadcastChannel
   - Provides public API: SettingsManager.get(key)
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
  const CACHE_TTL = 1000 * 60 * 60; // 1 hour

  const DEFAULTS = {
    site_name: 'نقابة تكنولوجيا المعلومات والبرمجيات',
    site_name_en: 'IT WORKERS SYNDICATE',
    site_logo_url: '',
    head_name: 'م / محمود جميل',
    head_title: 'النقيب العام',
    contact_email: 'info@itsyndicate.eg',
    contact_phone: '+20 100 000 0000',
    contact_address: 'القاهرة، مصر',
    default_theme: 'neon-dark',
    splash_duration: '5000',
    max_file_size: '5',
    allow_registration: 'true',
    maintenance_mode: 'false',
    terms_text: 'أقر بأن جميع البيانات والمستندات المقدمة صحيحة، وأتحمل المسؤولية القانونية عن أي بيانات خاطئة.',
    footer_text: 'نقابة تكنولوجيا المعلومات والبرمجيات — جميع الحقوق محفوظة'
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

  const changeListeners = new Map(); // key → [callbacks]
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
     CACHE MANAGEMENT
     ============================================ */
  function readCache() {
    try {
      const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      // Check version
      const cachedVersion = localStorage.getItem(SETTINGS_VERSION_KEY);
      if (cachedVersion !== '1') return null;

      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(SETTINGS_VERSION_KEY, '1');
      // Specific caches for fast access
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
     APPLY BRANDING (Logo + Name + Favicon)
     ============================================ */
  function applyBranding(data) {
    if (!data) return;

    // 1. Site name (title + all elements)
    if (data.site_name) {
      document.title = data.site_name;

      document.querySelectorAll('[data-site-name]').forEach(el => {
        el.textContent = data.site_name;
      });

      const navName = document.getElementById('navSiteName');
      if (navName) navName.textContent = data.site_name;

      const footerName = document.getElementById('footerSiteName');
      if (footerName) footerName.textContent = data.site_name;

      const previewName = document.getElementById('siteNamePreview');
      if (previewName) previewName.textContent = data.site_name;
    }

    // 2. Site name (English)
    if (data.site_name_en) {
      document.querySelectorAll('[data-site-name-en]').forEach(el => {
        el.textContent = data.site_name_en;
      });
    }

    // 3. Logo
    if (data.site_logo_url) {
      applyLogo(data.site_logo_url);
    }

    // 4. Head info
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

    // 5. Contact info
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

    // 6. Footer text
    if (data.footer_text) {
      document.querySelectorAll('[data-footer-text]').forEach(el => {
        el.textContent = data.footer_text;
      });
    }

    // 7. Terms
    if (data.terms_text) {
      document.querySelectorAll('[data-terms-text]').forEach(el => {
        el.textContent = data.terms_text;
      });
    }

    // 8. OG meta tags update (dynamic — useful for SPA navigation)
    updateMetaTags(data);
  }

  function applyLogo(url) {
    if (!url) return;

    // Navbar logo
    const navImg = document.getElementById('navLogoImg');
    const navFb = document.getElementById('navLogoFallback');
    if (navImg && navFb) {
      navImg.onload = () => {
        navImg.style.display = 'block';
        navFb.style.display = 'none';
      };
      navImg.onerror = () => {
        navImg.style.display = 'none';
        navFb.style.display = 'block';
      };
      navImg.src = url;
    }

    // Footer logo
    const ftImg = document.getElementById('footerLogoImg');
    const ftFb = document.getElementById('footerLogoFallback');
    if (ftImg && ftFb) {
      ftImg.onload = () => {
        ftImg.style.display = 'block';
        ftFb.style.display = 'none';
      };
      ftImg.onerror = () => {
        ftImg.style.display = 'none';
        ftFb.style.display = 'block';
      };
      ftImg.src = url;
    }

    // Any generic [data-logo]
    document.querySelectorAll('[data-logo]').forEach(img => {
      img.src = url;
      img.style.display = 'block';
    });

    // Splash logo
    const splashImg = document.getElementById('logoImg');
    const splashFb = document.getElementById('logoFallback');
    if (splashImg && splashFb) {
      splashImg.onload = () => {
        splashImg.style.display = 'block';
        splashFb.style.display = 'none';
      };
      splashImg.onerror = () => {
        splashImg.style.display = 'none';
        splashFb.style.display = 'block';
      };
      splashImg.src = url;
    }

    // Logo preview (admin page)
    const preview = document.getElementById('logoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${url}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;" />`;
    }

    // Favicons
    const fav = document.getElementById('faviconLink');
    const apple = document.getElementById('appleTouchIcon');
    const shortcut = document.getElementById('shortcutIcon');
    if (fav) { fav.type = 'image/png'; fav.href = url; }
    if (apple) { apple.href = url; }
    if (shortcut) { shortcut.href = url; }

    // Apple touch
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(el => {
      el.href = url;
    });

    // Favicon fallbacks
    document.querySelectorAll('link[rel="icon"]').forEach(el => {
      try {
        el.type = 'image/png';
        el.href = url;
      } catch (e) {}
    });
  }

  function updateMetaTags(data) {
    if (!data) return;

    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName && data.site_name) ogSiteName.setAttribute('content', data.site_name);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && data.site_name) ogTitle.setAttribute('content', data.site_name);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle && data.site_name) twTitle.setAttribute('content', data.site_name);
  }

  /* ============================================
     FETCH FROM SUPABASE
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
     LOAD (with cache-first strategy)
     ============================================ */
  async function load(force = false) {
    // Already loading → return existing promise
    if (loadingPromise) return loadingPromise;

    // Cache is fresh → return cached
    if (!force && Date.now() - lastLoaded < CACHE_TTL) {
      const cached = readCache();
      if (cached) {
        settings = cached;
        applyBranding(cached);
        return cached;
      }
    }

    loadingPromise = (async () => {
      // 1. Try cache immediately (for instant UI)
      const cached = readCache();
      if (cached) {
        settings = cached;
        applyBranding(cached);
      }

      // 2. Wait for Supabase client if not ready
      if (!client) {
        if (typeof window.onSupabaseReady === 'function') {
          await new Promise((resolve) => {
            window.onSupabaseReady((c) => {
              client = c;
              resolve();
            });
          });
        } else {
          // Wait up to 5s for supabase-config.js
          const start = Date.now();
          while (!client && Date.now() - start < 5000) {
            await new Promise(r => setTimeout(r, 100));
            if (window.supabaseClient) client = window.supabaseClient;
          }
        }
      }

      // 3. Fetch fresh from server
      const fresh = await fetchFromSupabase();
      if (fresh) {
        settings = fresh;
        lastLoaded = Date.now();
        writeCache(fresh);
        applyBranding(fresh);

        // Notify listeners
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

      // Merge
      Object.assign(settings, updates);
      lastLoaded = Date.now();
      writeCache(settings);
      applyBranding(settings);

      // Broadcast
      broadcastUpdate({ type: 'settings-updated', updates });

      // Notify listeners
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
     BROADCAST CHANNEL (Cross-tab sync)
     ============================================ */
  function initBroadcast() {
    if (broadcastChannel) return;

    try {
      // Modern API
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
        // Fallback: storage event
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
      if (broadcastChannel) {
        broadcastChannel.postMessage(message);
      }
    } catch (e) {
      // Silent
    }
  }

  /* ============================================
     REALTIME (Supabase)
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
     MAINTENANCE MODE CHECK
     ============================================ */
  function isMaintenanceMode() {
    return settings.maintenance_mode === 'true';
  }

  function isRegistrationOpen() {
    return settings.allow_registration !== 'false';
  }

  function getMaxFileSizeBytes() {
    const mb = parseFloat(settings.max_file_size) || 5;
    return mb * 1024 * 1024;
  }

  function getMaxFileSizeMB() {
    return parseFloat(settings.max_file_size) || 5;
  }

  function getSplashDuration() {
    return parseInt(settings.splash_duration) || 5000;
  }

  function getDefaultTheme() {
    return settings.default_theme || DEFAULTS.default_theme;
  }

  /* ============================================
     MAINTENANCE MODE OVERLAY
     ============================================ */
  function showMaintenanceOverlay() {
    // Only show on public pages, not on login/admin
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
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      font-family: 'Cairo', 'Tajawal', sans-serif;
      color: #fff;
      text-align: center;
    `;

    overlay.innerHTML = `
      <div style="max-width:520px;">
        <div style="
          width:80px;
          height:80px;
          margin:0 auto 24px;
          border-radius:50%;
          background:rgba(255,184,0,0.1);
          border:1.5px solid #ffb800;
          display:flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 0 40px rgba(255,184,0,0.3);
          animation: pulseIcon 2s ease-in-out infinite;
        ">
          <svg viewBox="0 0 24 24" style="width:36px;height:36px;stroke:#ffb800;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h1 style="
          font-size:28px;
          font-weight:900;
          margin-bottom:12px;
          background:linear-gradient(135deg, #ffb800, #f97316);
          -webkit-background-clip:text;
          background-clip:text;
          -webkit-text-fill-color:transparent;
        ">المنصة تحت الصيانة</h1>
        <p style="
          font-size:15px;
          color:rgba(255,255,255,0.6);
          line-height:1.8;
          margin-bottom:24px;
        ">
          نعتذر عن الإزعاج، نقوم حاليًا بأعمال صيانة وتحديث للمنصة.
          سيتم استئناف الخدمة قريبًا.
        </p>
        <div style="
          font-size:13px;
          color:rgba(255,255,255,0.4);
          padding:12px 20px;
          background:rgba(255,184,0,0.05);
          border:1px solid rgba(255,184,0,0.2);
          border-radius:12px;
          display:inline-block;
        ">
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

    // Block scrolling
    document.body.style.overflow = 'hidden';
  }

  /* ============================================
     CONVENIENCE: Apply settings on the fly
     ============================================ */
  function apply(overrides = {}) {
    const merged = { ...settings, ...overrides };
    applyBranding(merged);
  }

  /* ============================================
     REFRESH
     ============================================ */
  async function refresh() {
    return load(true);
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (initialized) return;
    initialized = true;

    // 1. Apply cache immediately (no flash)
    const cached = readCache();
    if (cached) {
      settings = cached;
      applyBranding(cached);
      log('Applied from cache');
    }

    // 2. Init broadcast channel
    initBroadcast();

    // 3. Wait for Supabase → load fresh
    if (typeof window.onSupabaseReady === 'function') {
      window.onSupabaseReady((c) => {
        client = c;
        load(false).then(() => {
          // Setup realtime after first load
          initRealtime();

          // Show maintenance if enabled
          showMaintenanceOverlay();

          // Dispatch ready event
          window.dispatchEvent(new CustomEvent('settings-ready', {
            detail: { settings: { ...settings } }
          }));

          log('Ready');
        });
      });
    } else {
      // Try to auto-detect supabaseClient
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

  /* ============================================
     EXPOSE PUBLIC API
     ============================================ */
  window.SettingsManager = {
    // Lifecycle
    init,
    load,
    refresh,

    // Read
    get,
    getAll,

    // Write
    update,
    apply,

    // Listeners
    onChange,
    onAnyChange,

    // Helpers
    isMaintenanceMode,
    isRegistrationOpen,
    getMaxFileSizeBytes,
    getMaxFileSizeMB,
    getSplashDuration,
    getDefaultTheme,

    // Branding utilities (exposed for reuse)
    applyBranding,
    applyLogo,

    // Cache
    clearCache,

    // Constants
    DEFAULTS,
    CACHE_TTL
  };

  /* ============================================
     AUTO-INIT
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

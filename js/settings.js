/* =====================================================
   IT SYNDICATE — SETTINGS MANAGER
   Version: 3.0.0
   =====================================================
   يحتوي على:
   - تحميل كل الإعدادات من Supabase
   - Cache في localStorage
   - تطبيق الإعدادات على الصفحة (data-setting)
   - تطبيق اللوجو + الاسم + الاسم الإنجليزي
   - تطبيق الإعدادات على meta tags + title
   - Realtime sync
   - Events (settings-ready / settings-updated)
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const CACHE_KEY = 'its_site_settings';
  const LOGO_KEY = 'its_logo_url';
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 ساعة

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let settings = {};
  let isLoaded = false;
  let loadPromise = null;
  let unsubscribeRealtime = null;

  /* ============================================
     HELPERS
     ============================================ */
  function log(...args) {
    if (window.ITS_DEBUG) console.log('[Settings]', ...args);
  }

  function warn(...args) {
    console.warn('[Settings]', ...args);
  }

  function getCachedSettings() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      // Check TTL
      if (parsed.__cachedAt) {
        const age = Date.now() - parsed.__cachedAt;
        if (age > CACHE_TTL) {
          localStorage.removeItem(CACHE_KEY);
          return null;
        }
      }

      return parsed;
    } catch (e) {
      return null;
    }
  }

  function setCachedSettings(data) {
    try {
      const toSave = Object.assign({}, data, { __cachedAt: Date.now() });
      localStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
    } catch (e) {}
  }

  /* ============================================
     FETCH FROM SUPABASE
     ============================================ */
  async function fetchSettings() {
    if (!client) {
      warn('Supabase client not available');
      return {};
    }

    try {
      const { data, error } = await client
        .from('settings')
        .select('key, value');

      if (error) throw error;

      const map = {};
      (data || []).forEach(row => {
        if (row.key) map[row.key] = row.value ?? '';
      });

      return map;
    } catch (err) {
      warn('Fetch failed:', err.message);
      return {};
    }
  }

  /* ============================================
     APPLY SETTINGS TO PAGE
     ============================================ */
  function applyToPage(data) {
    if (!data || typeof data !== 'object') return;

    // 1) Apply data-setting attributes
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (!(key in data)) return;

      const value = data[key] ?? '';

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        if (el.type === 'checkbox') {
          el.checked = value === 'true' || value === true;
        } else {
          el.value = value;
        }
      } else if (el.tagName === 'IMG') {
        if (value) {
          el.src = value;
          el.style.display = '';
        }
      } else {
        // For text content - handle terms text carefully
        if (key === 'terms_text' || key === 'footer_description' || key === 'hero_description' || key === 'about_card_text') {
          el.textContent = value;
        } else {
          el.textContent = value;
        }
      }
    });

    // 2) Apply site name
    if (data.site_name) {
      document.querySelectorAll('[data-site-name]').forEach(el => {
        el.textContent = data.site_name;
      });

      // Update title
      if (data.site_name && document.title) {
        const currentTitle = document.title;
        const parts = currentTitle.split('—');
        if (parts.length > 1) {
          document.title = `${parts[0].trim()} — ${data.site_name}`;
        }
      }
    }

    // 3) Apply site name (English)
    if (data.site_name_en) {
      document.querySelectorAll('[data-site-name-en]').forEach(el => {
        el.textContent = data.site_name_en;
      });
    }

    // 4) Apply head name
    if (data.head_name) {
      document.querySelectorAll('[data-head-name]').forEach(el => {
        el.textContent = data.head_name;
      });
    }

    // 5) Apply head title
    if (data.head_title) {
      document.querySelectorAll('[data-head-title]').forEach(el => {
        el.textContent = data.head_title;
      });
    }

    // 6) Apply VP name
    if (data.vice_president_name) {
      document.querySelectorAll('[data-vp-name]').forEach(el => {
        el.textContent = data.vice_president_name;
      });
    }

    // 7) Apply VP title
    if (data.vice_president_title) {
      document.querySelectorAll('[data-vp-title]').forEach(el => {
        el.textContent = data.vice_president_title;
      });
    }

    // 8) Apply contact info
    if (data.contact_email) {
      document.querySelectorAll('[data-contact-email]').forEach(el => {
        el.textContent = data.contact_email;
        if (el.tagName === 'A') el.href = `mailto:${data.contact_email}`;
      });
    }

    if (data.contact_phone) {
      document.querySelectorAll('[data-contact-phone]').forEach(el => {
        el.textContent = data.contact_phone;
        if (el.tagName === 'A') el.href = `tel:${data.contact_phone}`;
      });
    }

    if (data.contact_address) {
      document.querySelectorAll('[data-contact-address]').forEach(el => {
        el.textContent = data.contact_address;
      });
    }

    // 9) Apply footer text
    if (data.footer_text) {
      document.querySelectorAll('[data-footer-text]').forEach(el => {
        el.textContent = data.footer_text;
      });
    }

    // 10) Apply terms text
    if (data.terms_text) {
      document.querySelectorAll('[data-terms-text]').forEach(el => {
        el.textContent = data.terms_text;
      });
    }

    // 11) Apply logo
    if (data.site_logo_url) {
      applyLogo(data.site_logo_url);
    }

    // 12) Apply meta description
    if (data.site_description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', data.site_description);
    }

    // 13) Apply OG tags
    if (data.site_name) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', data.site_name);

      const ogSite = document.querySelector('meta[property="og:site_name"]');
      if (ogSite) ogSite.setAttribute('content', data.site_name);

      const twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', data.site_name);
    }

    if (data.site_description) {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', data.site_description);
    }

    if (data.site_logo_url) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) ogImage.setAttribute('content', data.site_logo_url);

      const twImage = document.querySelector('meta[name="twitter:image"]');
      if (twImage) twImage.setAttribute('content', data.site_logo_url);
    }

    log('Applied to page');
  }

  /* ============================================
     APPLY LOGO
     ============================================ */
  function applyLogo(url) {
    if (!url) return;

    // Update all logo images
    const logoImgs = document.querySelectorAll(
      '#navLogoImg, #footerLogoImg, #brandLogoImg, #receiptLogoImg, #aboutLogoImg, #logoImg, [data-logo]'
    );

    logoImgs.forEach(img => {
      img.onload = () => {
        img.style.display = '';
        const fallback = img.parentElement?.querySelector('.logo-fallback');
        if (fallback) fallback.style.display = 'none';
      };
      img.onerror = () => {
        img.style.display = 'none';
        const fallback = img.parentElement?.querySelector('.logo-fallback');
        if (fallback) fallback.style.display = '';
      };
      img.src = url;
    });

    // Update favicon
    const favicon = document.getElementById('faviconLink');
    if (favicon) {
      favicon.type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      favicon.href = url;
    }

    const appleIcon = document.getElementById('appleTouchIcon');
    if (appleIcon) appleIcon.href = url;

    // Cache
    try {
      localStorage.setItem(LOGO_KEY, url);
    } catch (e) {}

    log('Logo applied:', url);
  }

  /* ============================================
     APPLY CACHED LOGO IMMEDIATELY
     ============================================ */
  function applyCachedLogo() {
    try {
      const cachedLogo = localStorage.getItem(LOGO_KEY);
      if (cachedLogo) {
        applyLogo(cachedLogo);
        log('Cached logo applied');
      }
    } catch (e) {}
  }

  /* ============================================
     MAIN LOAD
     ============================================ */
  async function load(options) {
    const opts = options || {};

    if (loadPromise && !opts.force) {
      return loadPromise;
    }

    loadPromise = (async () => {
      try {
        // 1) Apply cached first (instant)
        const cached = getCachedSettings();
        if (cached) {
          settings = Object.assign({}, cached);
          delete settings.__cachedAt;
          applyToPage(settings);
          log('Cached settings applied');
        }

        // 2) Fetch from Supabase
        const fresh = await fetchSettings();

        if (fresh && Object.keys(fresh).length > 0) {
          settings = Object.assign({}, settings, fresh);
          setCachedSettings(settings);
          applyToPage(settings);
          log('Fresh settings applied');
        }

        isLoaded = true;

        // 3) Dispatch event
        window.dispatchEvent(new CustomEvent('settings-ready', {
          detail: { settings: settings }
        }));

        // 4) Broadcast for other modules
        window.dispatchEvent(new CustomEvent('broadcast-settings', {
          detail: { settings: settings }
        }));

        return settings;
      } catch (err) {
        warn('Load failed:', err.message);
        isLoaded = true;
        return settings;
      }
    })();

    return loadPromise;
  }

  /* ============================================
     GETTERS
     ============================================ */
  function get(key, fallback) {
    if (!key) return fallback ?? null;
    if (!(key in settings)) return fallback ?? null;
    return settings[key];
  }

  function getAll() {
    return Object.assign({}, settings);
  }

  function getBool(key, fallback) {
    const val = get(key);
    if (val === null || val === undefined) return fallback ?? false;
    if (typeof val === 'boolean') return val;
    return String(val).toLowerCase() === 'true' || val === '1' || val === 'yes';
  }

  function getNumber(key, fallback) {
    const val = get(key);
    if (val === null || val === undefined || val === '') return fallback ?? 0;
    const num = parseFloat(val);
    return isNaN(num) ? (fallback ?? 0) : num;
  }

  /* ============================================
     UPDATE (local, for admin usage)
     ============================================ */
  function update(updates) {
    if (!updates || typeof updates !== 'object') return settings;

    settings = Object.assign({}, settings, updates);
    setCachedSettings(settings);
    applyToPage(updates);

    window.dispatchEvent(new CustomEvent('settings-updated', {
      detail: { updates, settings }
    }));

    return settings;
  }

  /* ============================================
     REALTIME SYNC
     ============================================ */
  function setupRealtime() {
    if (!client || !window.Realtime) return;

    try {
      unsubscribeRealtime = window.Realtime.watch('settings', (payload) => {
        log('Realtime update:', payload);
        // Refetch fresh
        load({ force: true });
      });
    } catch (e) {
      warn('Realtime setup failed:', e.message);
    }
  }

  /* ============================================
     LISTEN FOR BROADCASTS
     ============================================ */
  function setupListeners() {
    // Listen for settings-updated broadcast (from admin)
    window.addEventListener('broadcast-notification', (e) => {
      if (e.detail?.type === 'settings-updated') {
        load({ force: true });
      }
    });

    // Listen for logo-updated
    window.addEventListener('broadcast-notification', (e) => {
      if (e.detail?.type === 'logo-updated' && e.detail?.url) {
        applyLogo(e.detail.url);
      }
    });
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.SettingsManager = {
    load,
    get,
    getAll,
    getBool,
    getNumber,
    update,
    applyLogo,
    applyToPage,
    isLoaded: () => isLoaded,
    _settings: () => settings
  };

  /* ============================================
     START
     ============================================ */
  function start(c) {
    client = c;

    // Apply cached logo immediately
    applyCachedLogo();

    // Load settings
    load().then(() => {
      setupRealtime();
      setupListeners();
      log('Ready');
    });
  }

  // Wait for Supabase
  if (typeof window.onSupabaseReady === 'function') {
    window.onSupabaseReady(start);
  } else if (window.supabaseClient) {
    start(window.supabaseClient);
  } else {
    window.addEventListener('supabase-ready', (e) => {
      start(e.detail?.client || window.supabaseClient);
    }, { once: true });
  }

  // Fallback: apply cached logo even before Supabase is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCachedLogo);
  } else {
    applyCachedLogo();
  }

})();

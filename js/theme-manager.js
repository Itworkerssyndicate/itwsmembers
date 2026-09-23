/* =====================================================
   IT SYNDICATE — THEME MANAGER
   Version: 3.0.0
   Path: js/theme-manager.js
   =====================================================
   يحتوي على:
   - 8 ثيمات كاملة
   - تطبيق الثيم + تخزين في localStorage
   - Theme Picker (بناء تلقائي)
   - مزامنة مع settings (default_theme)
   - Auto-detect (prefers-color-scheme)
   - Theme Toggle (light/dark)
   - Events + Broadcast
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const STORAGE_KEY = 'its_theme';
  const DEFAULT_THEME_KEY = 'its_global_default_theme';
  const LEGACY_KEY = 'its_theme_preference';

  /* ============================================
     THEMES LIBRARY
     ============================================ */
  const THEMES = {
    'neon-dark': {
      name: 'Neon Dark',
      nameAr: 'نيون داكن',
      description: 'سماوي وبنفسجي — الوضع الافتراضي',
      type: 'dark',
      colors: {
        accent: '#00f0ff',
        accent2: '#b026ff',
        bg: '#0a0c14'
      }
    },
    'neon-light': {
      name: 'Neon Light',
      nameAr: 'نيون فاتح',
      description: 'أزرق وبنفسجي — وضع فاتح',
      type: 'light',
      colors: {
        accent: '#0099ff',
        accent2: '#a020f0',
        bg: '#f5f7fb'
      }
    },
    'cyberpunk': {
      name: 'Cyberpunk',
      nameAr: 'سايبربانك',
      description: 'ماجنتا وأصفر — كريتيف',
      type: 'dark',
      colors: {
        accent: '#ff0080',
        accent2: '#ffcc00',
        bg: '#0d0619'
      }
    },
    'emerald': {
      name: 'Emerald',
      nameAr: 'زمردي',
      description: 'أخضر وذهبي — هادئ',
      type: 'dark',
      colors: {
        accent: '#10b981',
        accent2: '#fbbf24',
        bg: '#071410'
      }
    },
    'royal': {
      name: 'Royal',
      nameAr: 'ملكي',
      description: 'بنفسجي وسماوي — فخم',
      type: 'dark',
      colors: {
        accent: '#8b5cf6',
        accent2: '#06b6d4',
        bg: '#0a0618'
      }
    },
    'patriot': {
      name: 'Patriot Red',
      nameAr: 'وطني أحمر',
      description: 'أحمر وأسود — هوية النقابة',
      type: 'dark',
      colors: {
        accent: '#e62e2e',
        accent2: '#1a1a1a',
        bg: '#0a0a0a'
      }
    },
    'tech-cairo': {
      name: 'Tech Cairo',
      nameAr: 'تك كايرو',
      description: 'أحمر وذهبي — فخم مصري',
      type: 'dark',
      colors: {
        accent: '#e62e2e',
        accent2: '#d4af37',
        bg: '#1a0a0a'
      }
    },
    'minimal': {
      name: 'Modern Minimal',
      nameAr: 'مينيمال',
      description: 'أحمر وأسود — فاتح احترافي',
      type: 'light',
      colors: {
        accent: '#e62e2e',
        accent2: '#1a1a1a',
        bg: '#ffffff'
      }
    }
  };

  /* ============================================
     STATE
     ============================================ */
  let currentTheme = null;
  let globalDefaultTheme = null;

  /* ============================================
     VALIDATION
     ============================================ */
  function isValidTheme(theme) {
    return typeof theme === 'string' && THEMES[theme] !== undefined;
  }

  /* ============================================
     READ STORED THEME
     ============================================ */
  function getStoredTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isValidTheme(stored)) return stored;

      // Legacy migration
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (isValidTheme(legacy)) {
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  function getGlobalDefault() {
    try {
      const stored = localStorage.getItem(DEFAULT_THEME_KEY);
      if (isValidTheme(stored)) return stored;
      return null;
    } catch (e) {
      return null;
    }
  }

  function detectSystemPreference() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'neon-light';
      }
    } catch (e) {}
    return 'neon-dark';
  }

  function resolveInitialTheme() {
    // Priority: stored user theme > global default > system preference
    return getStoredTheme() || getGlobalDefault() || detectSystemPreference();
  }

  /* ============================================
     APPLY THEME
     ============================================ */
  function applyTheme(theme, options) {
    const opts = options || {};

    if (!isValidTheme(theme)) {
      console.warn(`[ThemeManager] Invalid theme: ${theme}. Falling back to neon-dark.`);
      theme = 'neon-dark';
    }

    // Add transition class temporarily
    if (opts.animate !== false) {
      document.documentElement.classList.add('theme-transition');
    }

    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', theme);

    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && THEMES[theme].colors.bg) {
      meta.setAttribute('content', THEMES[theme].colors.bg);
    }

    currentTheme = theme;

    // Remove transition class after animation
    if (opts.animate !== false) {
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 350);
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { theme, info: THEMES[theme] }
    }));

    return theme;
  }

  /* ============================================
     SET THEME
     ============================================ */
  function setTheme(theme, options) {
    const opts = options || {};

    if (!isValidTheme(theme)) return currentTheme;

    applyTheme(theme, opts);

    // Save to localStorage (unless it's just a preview)
    if (opts.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch (e) {}
    }

    return theme;
  }

  function setGlobalDefault(theme) {
    if (!isValidTheme(theme)) return null;
    globalDefaultTheme = theme;
    try {
      localStorage.setItem(DEFAULT_THEME_KEY, theme);
    } catch (e) {}
    return theme;
  }

  function resetTheme() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {}

    const fallback = globalDefaultTheme || detectSystemPreference();
    applyTheme(fallback);
    return fallback;
  }

  /* ============================================
     GETTERS
     ============================================ */
  function getTheme() {
    return currentTheme;
  }

  function getThemes() {
    return THEMES;
  }

  function getThemeInfo(theme) {
    const key = theme || currentTheme;
    return THEMES[key] || null;
  }

  function isDark(theme) {
    const key = theme || currentTheme;
    return THEMES[key]?.type === 'dark';
  }

  function isLight(theme) {
    const key = theme || currentTheme;
    return THEMES[key]?.type === 'light';
  }

  /* ============================================
     TOGGLE (Light/Dark)
     ============================================ */
  function toggleTheme() {
    const current = currentTheme;
    const currentInfo = THEMES[current];

    if (!currentInfo) {
      setTheme('neon-dark');
      return;
    }

    if (currentInfo.type === 'dark') {
      // Switch to matching light theme
      const lightPairs = {
        'neon-dark': 'neon-light',
        'patriot': 'minimal',
        'tech-cairo': 'minimal',
        'cyberpunk': 'neon-light',
        'emerald': 'neon-light',
        'royal': 'neon-light'
      };
      setTheme(lightPairs[current] || 'neon-light');
    } else {
      // Switch to matching dark theme
      const darkPairs = {
        'neon-light': 'neon-dark',
        'minimal': 'patriot'
      };
      setTheme(darkPairs[current] || 'neon-dark');
    }
  }

  /* ============================================
     BUILD THEME PICKER
     ============================================ */
  function buildThemePicker(containerId, options) {
    const opts = options || {};
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    Object.entries(THEMES).forEach(([key, info]) => {
      const isActive = key === currentTheme;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'theme-option' + (isActive ? ' active' : '');
      card.dataset.theme = key;
      card.title = info.description || info.nameAr || info.name;

      card.style.cssText = `
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
        padding: 10px;
        background: ${isActive ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)'};
        border: 1.5px solid ${isActive ? info.colors.accent : 'rgba(255,255,255,0.08)'};
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.25s;
        font-family: inherit;
        text-align: right;
        position: relative;
        overflow: hidden;
      `;

      if (isActive) {
        card.style.boxShadow = `0 0 20px ${info.colors.accent}55`;
      }

      card.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
        ">
          <span style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${info.colors.accent};
            border: 2px solid rgba(255,255,255,0.2);
            box-shadow: 0 0 10px ${info.colors.accent}88;
            flex-shrink: 0;
          "></span>
          <span style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${info.colors.accent2};
            border: 2px solid rgba(255,255,255,0.2);
            flex-shrink: 0;
            margin-right: -8px;
          "></span>
          <span style="
            flex: 1;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(90deg, ${info.colors.accent}, ${info.colors.accent2});
            opacity: 0.5;
          "></span>
        </div>
        <div style="
          font-size: 12px;
          font-weight: 700;
          color: ${isActive ? info.colors.accent : 'rgba(255,255,255,0.85)'};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        ">${info.nameAr || info.name}</div>
        <div style="
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
        ">${info.description || ''}</div>
      `;

      card.addEventListener('mouseenter', () => {
        if (!isActive) {
          card.style.borderColor = info.colors.accent + '77';
          card.style.transform = 'translateY(-2px)';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (!isActive) {
          card.style.borderColor = 'rgba(255,255,255,0.08)';
          card.style.transform = '';
        }
      });

      card.addEventListener('click', () => {
        setTheme(key);
        buildThemePicker(containerId, options);
      });

      container.appendChild(card);
    });
  }

  /* ============================================
     BUILD THEME SELECT (Dropdown)
     ============================================ */
  function buildThemeSelect(selectId, currentValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const value = currentValue || currentTheme || 'neon-dark';
    select.innerHTML = '';

    Object.entries(THEMES).forEach(([key, info]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${info.nameAr || info.name} — ${info.description || ''}`;
      if (key === value) opt.selected = true;
      select.appendChild(opt);
    });

    return select;
  }

  /* ============================================
     SYNC WITH SETTINGS
     ============================================ */
  async function syncWithSettings() {
    try {
      // 1) Try localStorage first
      const cached = localStorage.getItem('its_site_settings');
      if (cached) {
        try {
          const settings = JSON.parse(cached);
          if (settings.default_theme && isValidTheme(settings.default_theme)) {
            setGlobalDefault(settings.default_theme);
          }
        } catch (e) {}
      }

      // 2) Try Supabase
      if (window.supabaseClient) {
        const { data } = await window.supabaseClient
          .from('settings')
          .select('value')
          .eq('key', 'default_theme')
          .maybeSingle();

        if (data?.value && isValidTheme(data.value)) {
          setGlobalDefault(data.value);
        }
      }
    } catch (e) {
      console.warn('[ThemeManager] Settings sync failed:', e.message);
    }
  }

  /* ============================================
     LISTEN FOR EXTERNAL CHANGES
     ============================================ */
  function setupListeners() {
    // Listen for theme changes from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue && isValidTheme(e.newValue)) {
        applyTheme(e.newValue);
      }
      if (e.key === DEFAULT_THEME_KEY && e.newValue && isValidTheme(e.newValue)) {
        setGlobalDefault(e.newValue);
      }
    });

    // Listen for system preference changes
    try {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', (e) => {
          // Only auto-switch if user hasn't explicitly chosen
          if (!getStoredTheme()) {
            applyTheme(e.matches ? 'neon-light' : 'neon-dark');
          }
        });
      }
    } catch (e) {}

    // Listen for settings-updated broadcast
    window.addEventListener('settings-updated', () => {
      syncWithSettings();
    });
  }

  /* ============================================
     AUTO-INIT
     ============================================ */
  function autoInit() {
    // Apply initial theme immediately (before paint)
    const initial = resolveInitialTheme();
    applyTheme(initial, { animate: false });

    // Setup listeners
    setupListeners();

    // Sync with settings (async)
    syncWithSettings();
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.ThemeManager = {
    // Theme actions
    apply: applyTheme,
    set: setTheme,
    reset: resetTheme,
    toggle: toggleTheme,

    // Getters
    get: getTheme,
    getAll: getThemes,
    getInfo: getThemeInfo,
    isDark,
    isLight,
    isValid: isValidTheme,

    // Global default
    setGlobalDefault,
    getGlobalDefault,

    // UI builders
    buildPicker: buildThemePicker,
    buildSelect: buildThemeSelect,

    // Sync
    sync: syncWithSettings,

    // Internals (for debugging)
    _themes: THEMES,
    _storageKey: STORAGE_KEY
  };

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    // Apply theme ASAP (before DOM ready to avoid flash)
    try {
      const initial = resolveInitialTheme();
      document.documentElement.setAttribute('data-theme', initial);
      currentTheme = initial;
    } catch (e) {}

    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  // If Supabase becomes ready, sync settings
  if (typeof window.onSupabaseReady === 'function') {
    window.onSupabaseReady(() => {
      syncWithSettings();
    });
  } else {
    window.addEventListener('supabase-ready', () => {
      syncWithSettings();
    });
  }

})();

/* =====================================================
   IT SYNDICATE — Theme Manager
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     THEMES DEFINITION
     ============================================ */
  const THEMES = {
    'neon-dark': {
      name: 'نيون داكن',
      description: 'الثيم الافتراضي',
      accent: '#00f0ff',
      accent2: '#b026ff',
      accentRgb: '0, 240, 255',
      accent2Rgb: '176, 38, 255',
      bg: '#000000',
      bg2: '#0a0c14',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    },
    'cyber-blue': {
      name: 'سيبر أزرق',
      description: 'أزرق سيبراني',
      accent: '#38bdf8',
      accent2: '#0284c7',
      accentRgb: '56, 189, 248',
      accent2Rgb: '2, 132, 199',
      bg: '#0a0f1e',
      bg2: '#0f172a',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    },
    'matrix-green': {
      name: 'ماتريكس',
      description: 'أخضر ماتريكس',
      accent: '#22c55e',
      accent2: '#16a34a',
      accentRgb: '34, 197, 94',
      accent2Rgb: '22, 163, 74',
      bg: '#000000',
      bg2: '#0a1a0f',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    },
    'sunset': {
      name: 'غروب',
      description: 'برتقالي ووردي',
      accent: '#f97316',
      accent2: '#ec4899',
      accentRgb: '249, 115, 22',
      accent2Rgb: '236, 72, 153',
      bg: '#1a0a0a',
      bg2: '#2a1010',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    },
    'royal-purple': {
      name: 'بنفسجي ملكي',
      description: 'بنفسجي فاخر',
      accent: '#a855f7',
      accent2: '#d946ef',
      accentRgb: '168, 85, 247',
      accent2Rgb: '217, 70, 239',
      bg: '#0f0524',
      bg2: '#1a0a35',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    },
    'light-pro': {
      name: 'فاتح احترافي',
      description: 'خلفية بيضاء',
      accent: '#2563eb',
      accent2: '#7c3aed',
      accentRgb: '37, 99, 235',
      accent2Rgb: '124, 58, 237',
      bg: '#f8fafc',
      bg2: '#ffffff',
      text: '#0f172a',
      textMuted: 'rgba(15, 23, 42, 0.65)',
      isDark: false
    },
    'midnight': {
      name: 'منتصف الليل',
      description: 'أزرق داكن هادئ',
      accent: '#60a5fa',
      accent2: '#818cf8',
      accentRgb: '96, 165, 250',
      accent2Rgb: '129, 140, 248',
      bg: '#050814',
      bg2: '#0a1024',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      isDark: true
    }
  };

  /* ============================================
     CONSTANTS
     ============================================ */
  const STORAGE_KEY = 'its_theme';
  const GLOBAL_THEME_CACHE_KEY = 'its_global_default_theme';
  const DEFAULT_THEME = 'neon-dark';

  /* ============================================
     STATE
     ============================================ */
  let currentThemeId = null;
  let client = null;

  const themeChangeListeners = [];

  /* ============================================
     GET USER THEME
     ============================================ */
  function getUserTheme() {
    try {
      const userTheme = localStorage.getItem(STORAGE_KEY);
      if (userTheme && THEMES[userTheme]) return userTheme;

      const globalDefault = localStorage.getItem(GLOBAL_THEME_CACHE_KEY);
      if (globalDefault && THEMES[globalDefault]) return globalDefault;

      return DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  }

  /* ============================================
     APPLY THEME
     ============================================ */
  function applyTheme(themeId, options = {}) {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    const root = document.documentElement;

    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light');

    // CSS Variables
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent-2', theme.accent2);
    root.style.setProperty('--accent-rgb', theme.accentRgb);
    root.style.setProperty('--accent-2-rgb', theme.accent2Rgb);
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--bg-2', theme.bg2);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-muted', theme.textMuted);

    // Meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) metaThemeColor.setAttribute('content', theme.bg);

    // Body background
    document.body.style.background = theme.bg;

    // Update swatches
    updateActiveSwatches(themeId);

    // Track
    const previousTheme = currentThemeId;
    currentThemeId = themeId;

    // Dispatch
    if (!options.silent) {
      window.dispatchEvent(new CustomEvent('theme-changed', {
        detail: { themeId, theme, previousTheme }
      }));

      themeChangeListeners.forEach(cb => {
        try { cb(themeId, theme); } catch (e) {}
      });
    }
  }

  /* ============================================
     SET USER THEME
     ============================================ */
  function setUserTheme(themeId, options = {}) {
    if (!THEMES[themeId]) {
      console.warn('[Theme] Unknown theme:', themeId);
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch (e) {}

    applyTheme(themeId);

    // Sync to server (fire & forget)
    if (options.sync !== false) {
      syncUserThemeToServer(themeId);
    }

    return true;
  }

  /* ============================================
     SYNC TO SUPABASE
     ============================================ */
  async function syncUserThemeToServer(themeId) {
    if (!window.supabaseClient) return;
    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return;

      await window.supabaseClient
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          theme: themeId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (e) {}
  }

  /* ============================================
     LOAD USER THEME FROM SERVER
     ============================================ */
  async function loadUserThemeFromServer() {
    if (!window.supabaseClient) return null;
    try {
      const { data: sessionData } = await window.supabaseClient.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) return null;

      const { data, error } = await window.supabaseClient
        .from('user_preferences')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) return null;

      if (data && data.theme && THEMES[data.theme]) {
        try { localStorage.setItem(STORAGE_KEY, data.theme); } catch (e) {}
        applyTheme(data.theme);
        return data.theme;
      }
    } catch (e) {}
    return null;
  }

  /* ============================================
     LOAD GLOBAL DEFAULT
     ============================================ */
  async function loadGlobalDefaultTheme() {
    if (!window.supabaseClient) {
      try {
        const cached = localStorage.getItem(GLOBAL_THEME_CACHE_KEY);
        if (cached && THEMES[cached]) {
          if (!localStorage.getItem(STORAGE_KEY)) {
            applyTheme(cached);
          }
        }
      } catch (e) {}
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('settings')
        .select('value')
        .eq('key', 'default_theme')
        .maybeSingle();

      if (error || !data) return;

      const globalTheme = data.value;
      if (globalTheme && THEMES[globalTheme]) {
        try { localStorage.setItem(GLOBAL_THEME_CACHE_KEY, globalTheme); } catch (e) {}

        const userTheme = localStorage.getItem(STORAGE_KEY);
        if (!userTheme) {
          applyTheme(globalTheme);
        }
      }
    } catch (e) {}
  }

  /* ============================================
     RESET
     ============================================ */
  function resetTheme() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

    let themeToApply = DEFAULT_THEME;
    try {
      const globalDefault = localStorage.getItem(GLOBAL_THEME_CACHE_KEY);
      if (globalDefault && THEMES[globalDefault]) {
        themeToApply = globalDefault;
      }
    } catch (e) {}

    applyTheme(themeToApply);

    // Clear server preference
    (async function () {
      if (!window.supabaseClient) return;
      try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return;
        await window.supabaseClient
          .from('user_preferences')
          .delete()
          .eq('user_id', user.id);
      } catch (e) {}
    })();

    if (typeof window.showToast === 'function') {
      window.showToast('تم إعادة تعيين الثيم', 'success', 2000);
    }
  }

  /* ============================================
     BUILD THEME GRID
     ============================================ */
  function buildThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;

    const current = getUserTheme();
    grid.innerHTML = '';

    Object.entries(THEMES).forEach(([id, theme]) => {
      const el = document.createElement('div');
      el.className = 'theme-item' + (id === current ? ' active' : '');
      el.dataset.theme = id;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      el.innerHTML = `
        <div class="theme-swatch">
          <span style="background:${theme.accent}"></span>
          <span style="background:${theme.accent2}"></span>
          <span style="background:${theme.bg}"></span>
        </div>
        <div class="theme-item-name">${theme.name}</div>
      `;

      el.addEventListener('click', () => setUserTheme(id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setUserTheme(id);
        }
      });

      grid.appendChild(el);
    });
  }

  /* ============================================
     UPDATE ACTIVE SWATCHES
     ============================================ */
  function updateActiveSwatches(activeId) {
    document.querySelectorAll('.theme-item').forEach(item => {
      item.classList.toggle('active', item.dataset.theme === activeId);
    });
  }

  /* ============================================
     GET THEME
     ============================================ */
  function getTheme(themeId) {
    return THEMES[themeId || getUserTheme()];
  }

  function getAllThemes() {
    return Object.entries(THEMES).map(([id, theme]) => ({
      id,
      ...theme
    }));
  }

  function getCurrentThemeId() {
    return currentThemeId || getUserTheme();
  }

  /* ============================================
     BUILD THEME SELECT (admin)
     ============================================ */
  function buildThemeSelect(selectId, currentValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '';
    Object.entries(THEMES).forEach(([id, theme]) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = theme.name;
      if (id === currentValue) opt.selected = true;
      select.appendChild(opt);
    });
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function onThemeChange(callback) {
    if (typeof callback !== 'function') return () => {};
    themeChangeListeners.push(callback);
    return function unsubscribe() {
      const idx = themeChangeListeners.indexOf(callback);
      if (idx > -1) themeChangeListeners.splice(idx, 1);
    };
  }

  /* ============================================
     LEGACY GLOBAL
     ============================================ */
  window.resetTheme = resetTheme;
  window.toggleThemePanel = window.toggleThemePanel || function () {
    const panel = document.getElementById('themePanel');
    if (panel) panel.classList.toggle('open');
  };

  /* ============================================
     EXPOSE PUBLIC API
     ============================================ */
  window.ThemeManager = {
    THEMES,
    DEFAULT_THEME,
    STORAGE_KEY,

    applyTheme,
    setUserTheme,
    getUserTheme,
    getCurrentThemeId,
    resetTheme,
    getTheme,
    getAllThemes,

    buildThemeGrid,
    buildThemeSelect,
    updateActiveSwatches,

    loadUserThemeFromServer,
    loadGlobalDefaultTheme,
    syncUserThemeToServer,

    onThemeChange
  };

  /* ============================================
     INIT
     ============================================ */
  function init() {
    // Apply cached theme immediately (no flash)
    applyTheme(getUserTheme(), { silent: true });

    // Build grid if present
    if (document.getElementById('themeGrid')) {
      buildThemeGrid();
    }

    // Wait for Supabase → load global default + user theme
    if (typeof window.onSupabaseReady === 'function') {
      window.onSupabaseReady(async (c) => {
        client = c;
        await loadGlobalDefaultTheme();
        await loadUserThemeFromServer();

        // Dispatch ready
        window.dispatchEvent(new CustomEvent('theme-ready', {
          detail: { themeId: getCurrentThemeId() }
        }));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

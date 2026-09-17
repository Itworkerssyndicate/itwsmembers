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
      description: 'الثيم الافتراضي — ألوان نيون على خلفية سوداء',
      accent: '#00f0ff',
      accent2: '#b026ff',
      bg: '#000000',
      bg2: '#0a0c14',
      cardBg: 'rgba(10, 12, 20, 0.65)',
      border: 'rgba(0, 240, 255, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#00ff9d',
      warning: '#ffb800',
      danger: '#ff5555',
      isDark: true
    },
    'cyber-blue': {
      name: 'سيبر أزرق',
      description: 'أزرق سيبراني احترافي',
      accent: '#38bdf8',
      accent2: '#0284c7',
      bg: '#0a0f1e',
      bg2: '#0f172a',
      cardBg: 'rgba(15, 23, 42, 0.7)',
      border: 'rgba(56, 189, 248, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      isDark: true
    },
    'matrix-green': {
      name: 'ماتريكس',
      description: 'أخضر ماتريكس على أسود',
      accent: '#22c55e',
      accent2: '#16a34a',
      bg: '#000000',
      bg2: '#0a1a0f',
      cardBg: 'rgba(10, 26, 15, 0.7)',
      border: 'rgba(34, 197, 94, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#22c55e',
      warning: '#eab308',
      danger: '#ef4444',
      isDark: true
    },
    'sunset': {
      name: 'غروب',
      description: 'برتقالي ووردي دافئ',
      accent: '#f97316',
      accent2: '#ec4899',
      bg: '#1a0a0a',
      bg2: '#2a1010',
      cardBg: 'rgba(42, 16, 16, 0.7)',
      border: 'rgba(249, 115, 22, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#22c55e',
      warning: '#fbbf24',
      danger: '#ef4444',
      isDark: true
    },
    'royal-purple': {
      name: 'بنفسجي ملكي',
      description: 'بنفسجي فاخر',
      accent: '#a855f7',
      accent2: '#d946ef',
      bg: '#0f0524',
      bg2: '#1a0a35',
      cardBg: 'rgba(26, 10, 53, 0.7)',
      border: 'rgba(168, 85, 247, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#22c55e',
      warning: '#fbbf24',
      danger: '#ef4444',
      isDark: true
    },
    'light-pro': {
      name: 'فاتح احترافي',
      description: 'خلفية بيضاء نظيفة',
      accent: '#2563eb',
      accent2: '#7c3aed',
      bg: '#f8fafc',
      bg2: '#ffffff',
      cardBg: 'rgba(255, 255, 255, 0.85)',
      border: 'rgba(37, 99, 235, 0.15)',
      text: '#0f172a',
      textMuted: 'rgba(15, 23, 42, 0.6)',
      success: '#16a34a',
      warning: '#d97706',
      danger: '#dc2626',
      isDark: false
    },
    'midnight': {
      name: 'منتصف الليل',
      description: 'أزرق داكن هادئ',
      accent: '#60a5fa',
      accent2: '#818cf8',
      bg: '#050814',
      bg2: '#0a1024',
      cardBg: 'rgba(10, 16, 36, 0.7)',
      border: 'rgba(96, 165, 250, 0.2)',
      text: '#ffffff',
      textMuted: 'rgba(255, 255, 255, 0.55)',
      success: '#22c55e',
      warning: '#f59e0b',
      danger: '#ef4444',
      isDark: true
    }
  };

  /* ============================================
     CONSTANTS
     ============================================ */
  const STORAGE_KEY = 'its_theme';
  const DEFAULT_THEME = 'neon-dark';
  const GLOBAL_THEME_CACHE_KEY = 'its_global_default_theme';

  /* ============================================
     GET USER THEME (with priority)
     Priority:
       1. User preference (localStorage)  → highest
       2. Global default (from settings)  → medium
       3. Hardcoded default               → lowest
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
  function applyTheme(themeId) {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    const root = document.documentElement;

    // Set attribute
    root.setAttribute('data-theme', themeId);
    root.setAttribute('data-theme-mode', theme.isDark ? 'dark' : 'light');

    // Set CSS variables
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--accent2', theme.accent2);
    root.style.setProperty('--bg', theme.bg);
    root.style.setProperty('--bg-2', theme.bg2);
    root.style.setProperty('--card-bg', theme.cardBg);
    root.style.setProperty('--border', theme.border);
    root.style.setProperty('--text', theme.text);
    root.style.setProperty('--text-muted', theme.textMuted);
    root.style.setProperty('--text-dim', theme.textMuted);
    root.style.setProperty('--success', theme.success);
    root.style.setProperty('--warning', theme.warning);
    root.style.setProperty('--danger', theme.danger);

    // Update <meta name="theme-color">
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.bg);
    }

    // Update body background
    document.body.style.background = theme.bg;

    // Update active swatches
    updateActiveSwatches(themeId);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { themeId, theme }
    }));
  }

  /* ============================================
     SET USER THEME
     ============================================ */
  function setUserTheme(themeId) {
    if (!THEMES[themeId]) {
      console.warn('[Theme] Unknown theme:', themeId);
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, themeId);
    } catch (e) {}

    applyTheme(themeId);

    // Sync to Supabase if logged in (fire & forget)
    syncUserThemeToServer(themeId);

    return true;
  }

  /* ============================================
     SYNC TO SUPABASE (user preferences)
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
    } catch (e) {
      // Silent fail
    }
  }

  /* ============================================
     LOAD USER THEME FROM SUPABASE
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
        // User theme from server overrides local (multi-device consistency)
        try { localStorage.setItem(STORAGE_KEY, data.theme); } catch (e) {}
        applyTheme(data.theme);
        return data.theme;
      }
    } catch (e) {}
    return null;
  }

  /* ============================================
     LOAD GLOBAL DEFAULT FROM SETTINGS
     ============================================ */
  async function loadGlobalDefaultTheme() {
    if (!window.supabaseClient) {
      // Try cache only
      try {
        const cached = localStorage.getItem(GLOBAL_THEME_CACHE_KEY);
        if (cached && THEMES[cached]) {
          // Only apply if user has no preference
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

        // Only apply if user hasn't chosen their own theme
        const userTheme = localStorage.getItem(STORAGE_KEY);
        if (!userTheme) {
          applyTheme(globalTheme);
        }
      }
    } catch (e) {}
  }

  /* ============================================
     RESET TO DEFAULT
     ============================================ */
  function resetTheme() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}

    // Use global default if exists, else hardcoded default
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
     BUILD THEME GRID (Panel)
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

      el.addEventListener('click', () => {
        setUserTheme(id);
      });

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
     GET THEME OBJECT
     ============================================ */
  function getTheme(themeId) {
    return THEMES[themeId || getUserTheme()];
  }

  /* ============================================
     GET ALL THEMES
     ============================================ */
  function getAllThemes() {
    return Object.entries(THEMES).map(([id, theme]) => ({
      id,
      ...theme
    }));
  }

  /* ============================================
     BUILD THEME SELECT (for admin settings)
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
     LISTEN FOR SYSTEM PREFERENCE CHANGES
     ============================================ */
  function watchSystemPreference() {
    if (!window.matchMedia) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      // Only apply if user has no manual preference
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch (err) { return; }

      // Optionally auto-switch to a light/dark theme
      // We respect the global default instead, so we skip this.
    };

    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

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
    resetTheme,
    getTheme,
    getAllThemes,

    buildThemeGrid,
    buildThemeSelect,
    updateActiveSwatches,

    loadUserThemeFromServer,
    loadGlobalDefaultTheme,
    syncUserThemeToServer
  };

  // Legacy global exports (backwards compat)
  window.resetTheme = resetTheme;
  window.toggleThemePanel = window.toggleThemePanel || function () {
    const panel = document.getElementById('themePanel');
    if (panel) panel.classList.toggle('open');
  };

  /* ============================================
     AUTO-INIT
     ============================================ */
  function init() {
    // 1. Apply cached theme immediately (no flash)
    applyTheme(getUserTheme());

    // 2. Build grid if present
    if (document.getElementById('themeGrid')) {
      buildThemeGrid();
    }

    // 3. Wait for Supabase → load global default + user theme
    if (typeof window.onSupabaseReady === 'function') {
      window.onSupabaseReady(async () => {
        await loadGlobalDefaultTheme();
        await loadUserThemeFromServer();
      });
    }

    // 4. Watch system preference (no-op for now, but ready)
    watchSystemPreference();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

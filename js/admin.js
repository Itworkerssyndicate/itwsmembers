/* =====================================================
   IT SYNDICATE — ADMIN PANEL LOGIC
   Version: 3.2.0
   =====================================================
   يحتوي على:
   - Auth + Role check (head / vp / deputy)
   - الإعدادات العامة
   - إعدادات الرئيسية
   - المستخدمون (CRUD)
   - المحافظات ✅ (CRUD كامل جديد)
   - أنواع العضوية (CRUD)
   - الشعب (CRUD)
   - المميزات (Editor تفاعلي)
   - سجل النشاط + التدقيق
   - Backup + Realtime
   - ✅ إصلاح قائمة الثيمات (buildSelect)
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const LOGO_BUCKET = 'branding';
  const MAX_LOGO_SIZE = 2 * 1024 * 1024;
  const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
  const AUDIT_TABLE = 'audit_log';

  /* ============================================
     THEMES FALLBACK LIST
     ============================================ */
  const THEMES_LIST = {
    'neon-dark':    { name: 'نيون داكن',     desc: 'سماوي وبنفسجي — افتراضي' },
    'neon-light':   { name: 'نيون فاتح',     desc: 'أزرق وبنفسجي — فاتح' },
    'cyberpunk':    { name: 'سايبربانك',     desc: 'ماجنتا وأصفر' },
    'emerald':      { name: 'زمردي',         desc: 'أخضر وذهبي' },
    'royal':        { name: 'ملكي',          desc: 'بنفسجي وسماوي' },
    'patriot':      { name: 'وطني أحمر',     desc: 'أحمر وأسود — هوية النقابة' },
    'tech-cairo':   { name: 'تك كايرو',      desc: 'أحمر وذهبي — فخم' },
    'minimal':      { name: 'مينيمال',       desc: 'أحمر وأسود — فاتح احترافي' }
  };

  /* ============================================
     ICON LIBRARY
     ============================================ */
  const ICON_LIBRARY = {
    zap: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    palette: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 0-4 6 6 0 0 1 0-12 2 2 0 0 0 0-4z"/></svg>',
    smartphone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    code: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    users: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    star: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    graduation: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    activity: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    award: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    trending: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    heart: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let settings = {};
  let users = [];
  let membershipTypes = [];
  let branches = [];
  let governorates = [];
  let featuresCards = [];
  let sessions = [];
  let actions = [];
  let auditLogs = [];
  let activeTab = 'settings';
  let unsubscribeRealtime = null;

  /* ============================================
     HELPERS
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return '---'; }
  }

  function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return '—';
    if (seconds < 60) return `${seconds} ث`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} د`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h} س ${m} د`;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  /* ============================================
     SVG ICONS (Admin-only)
     ============================================ */
  const ICONS = {
    save: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    upload: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    trash: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    image: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
  };

  /* ============================================
     AUTH CHECK
     ============================================ */
  async function checkAuth() {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        window.location.href = 'login.html';
        return false;
      }

      currentUser = session.user;

      const { data: userData } = await client
        .from('users')
        .select('role, full_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      const role = userData?.role || 'committee';

      const allowedRoles = ['head', 'vice_president', 'deputy'];
      if (!allowedRoles.includes(role)) {
        alert('هذه الصفحة مخصصة للنقيب العام ونوابه فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      window.currentUserRole = role;
      window.currentUserName = userData?.full_name || currentUser.email || 'النقيب';

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      return true;
    } catch (err) {
      console.error('[Admin] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     AUDIT LOG
     ============================================ */
  async function logAudit(action, entity, entityId, oldValue, newValue) {
    try {
      await client.from(AUDIT_TABLE).insert([{
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || 'unknown',
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.warn('[Audit] Log failed:', e.message);
    }
  }

  async function logAction(action, entity, entityId, details) {
    try {
      await client.from('user_actions').insert([{
        user_id: currentUser?.id,
        user_email: currentUser?.email,
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        details,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {}
  }

  /* ============================================
     TAB SWITCHING
     ============================================ */
  function switchTab(tabId) {
    activeTab = tabId;

    document.querySelectorAll('[data-tab-content]').forEach(el => {
      el.style.display = 'none';
    });

    const active = document.querySelector(`[data-tab-content="${tabId}"]`);
    if (active) active.style.display = 'block';

    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tabBtn === tabId);
    });

    // Lazy load
    if (tabId === 'users' && users.length === 0) loadUsers();
    if (tabId === 'governorates' && governorates.length === 0) loadGovernorates();
    if (tabId === 'types' && membershipTypes.length === 0) loadTypes();
    if (tabId === 'branches' && branches.length === 0) loadBranches();
    if (tabId === 'sessions') loadSessions();
    if (tabId === 'audit' && auditLogs.length === 0) loadAuditLog();

    try {
      history.replaceState(null, '', `#${tabId}`);
    } catch (e) {}
  }

  function setupTabs() {
    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tabBtn));
    });

    const hash = (window.location.hash || '').replace('#', '');
    switchTab(hash || 'settings');
  }

  /* ============================================
     LOAD SETTINGS
     ============================================ */
  async function loadSettings() {
    try {
      const { data, error } = await client.from('settings').select('key, value');

      if (error) throw error;

      settings = {};
      (data || []).forEach(row => {
        settings[row.key] = row.value ?? '';
      });

      applySettingsToForm();
      applyLogoPreview();
      buildThemeSelect();
      loadFeaturesFromSettings();

    } catch (err) {
      console.error('[Admin] Settings load error:', err);
      showToast('فشل تحميل الإعدادات: ' + err.message, 'error');
    }
  }

  function applySettingsToForm() {
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (!(key in settings)) return;

      const value = settings[key] ?? '';

      if (el.type === 'checkbox') {
        el.checked = value === 'true';
      } else {
        el.value = value;
      }
    });
  }

  function applyLogoPreview() {
    const preview = document.getElementById('logoPreview');
    if (!preview) return;

    const url = settings.site_logo_url;
    if (url) {
      preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Logo" />`;
      preview.classList.add('has-logo');
    } else {
      preview.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--text-dim);">
          <svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style="font-size:12px;">لا يوجد شعار</span>
        </div>
      `;
      preview.classList.remove('has-logo');
    }
  }

  /* ============================================
     ✅ BUILD THEME SELECT (FIXED)
     ============================================ */
  function buildThemeSelect() {
    const select = document.getElementById('defaultThemeSelect');
    if (!select) return;

    const currentValue = settings.default_theme || 'neon-dark';

    // ✅ الخيار 1: استخدم ThemeManager.buildSelect
    if (window.ThemeManager && typeof window.ThemeManager.buildSelect === 'function') {
      try {
        window.ThemeManager.buildSelect('defaultThemeSelect', currentValue);
        attachThemePreviewListener(select);
        return;
      } catch (e) {
        console.warn('[Admin] ThemeManager.buildSelect failed, using fallback:', e);
      }
    }

    // ✅ الخيار 2: Fallback يدوي (8 ثيمات)
    select.innerHTML = '';

    Object.entries(THEMES_LIST).forEach(([key, info]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${info.name} — ${info.desc}`;
      if (key === currentValue) opt.selected = true;
      select.appendChild(opt);
    });

    attachThemePreviewListener(select);
  }

  function attachThemePreviewListener(select) {
    if (!select || select.dataset.listenerAttached === 'true') return;

    select.addEventListener('change', () => {
      if (window.ThemeManager && typeof window.ThemeManager.apply === 'function') {
        window.ThemeManager.apply(select.value, { persist: false });
      }
    });

    select.dataset.listenerAttached = 'true';
  }

  /* ============================================
     SAVE SETTINGS
     ============================================ */
  async function saveSettings(btnId = 'saveSettingsBtn') {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = `<span>جاري الحفظ...</span><span class="spinner"></span>`;
    }

    try {
      const updates = {};

      document.querySelectorAll('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (!key) return;

        if (el.type === 'checkbox') {
          updates[key] = el.checked ? 'true' : 'false';
        } else {
          updates[key] = el.value || '';
        }
      });

      if (featuresCards.length > 0 || 'features_cards' in settings) {
        updates.features_cards = JSON.stringify(featuresCards);
      }

      const rows = Object.entries(updates).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString()
      }));

      const { error } = await client
        .from('settings')
        .upsert(rows, { onConflict: 'key' });

      if (error) throw error;

      Object.assign(settings, updates);

      await logAudit('update', 'settings', null, null, updates);
      await logAction('update_settings', 'settings', null, `تم تحديث ${Object.keys(updates).length} إعداد`);

      try {
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
        if (settings.site_logo_url) localStorage.setItem('its_logo_url', settings.site_logo_url);
        if (settings.default_theme) localStorage.setItem('its_global_default_theme', settings.default_theme);
      } catch (e) {}

      document.title = settings.site_name || document.title;

      showToast('تم حفظ الإعدادات بنجاح', 'success');

      if (window.Realtime) {
        window.Realtime.sendBroadcast('settings-updated', {
          timestamp: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error('[Admin] Save error:', err);
      showToast('فشل الحفظ: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        if (btn.dataset.originalHtml) {
          btn.innerHTML = btn.dataset.originalHtml;
          delete btn.dataset.originalHtml;
        }
      }
    }
  }

  /* ============================================
     LOGO UPLOAD
     ============================================ */
  async function uploadLogo(file) {
    if (file.size > MAX_LOGO_SIZE) {
      showToast(`حجم الشعار كبير (${formatFileSize(file.size)}) — الحد الأقصى 2 ميجا`, 'error');
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      showToast('صيغة غير مدعومة — PNG, JPG, SVG, WEBP فقط', 'error');
      return;
    }

    const btn = document.getElementById('uploadLogoBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الرفع...</span>';
    }

    try {
      let ext = 'png';
      if (file.type === 'image/svg+xml') ext = 'svg';
      else if (file.type === 'image/jpeg') ext = 'jpg';
      else if (file.type === 'image/webp') ext = 'webp';

      const filePath = `logo.${ext}`;

      const { error: upErr } = await client.storage
        .from(LOGO_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (upErr) throw upErr;

      const { data: urlData } = client.storage
        .from(LOGO_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: setErr } = await client
        .from('settings')
        .upsert([{
          key: 'site_logo_url',
          value: publicUrl,
          updated_at: new Date().toISOString()
        }], { onConflict: 'key' });

      if (setErr) throw setErr;

      settings.site_logo_url = publicUrl;

      try {
        localStorage.setItem('its_logo_url', publicUrl);
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
      } catch (e) {}

      applyLogoPreview();
      updateLogosEverywhere(publicUrl);

      await logAudit('upload', 'logo', filePath, null, { url: publicUrl, size: file.size });
      await logAction('upload_logo', 'logo', null, `حجم: ${formatFileSize(file.size)}`);

      showToast('تم رفع الشعار بنجاح', 'success');

      if (window.Realtime) {
        window.Realtime.sendBroadcast('logo-updated', { url: publicUrl });
      }

    } catch (err) {
      console.error('[Admin] Logo upload error:', err);
      showToast('فشل رفع الشعار: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.upload}<span>اختر شعار جديد</span>`;
      }
    }
  }

  function updateLogosEverywhere(url) {
    const fav = document.getElementById('faviconLink');
    const apple = document.getElementById('appleTouchIcon');
    if (fav) { fav.type = 'image/png'; fav.href = url; }
    if (apple) { apple.href = url; }

    document.querySelectorAll('[data-logo]').forEach(img => {
      img.src = url;
      img.style.display = 'block';
    });
  }

  async function removeLogo() {
    if (!confirm('هل أنت متأكد من إزالة الشعار؟')) return;

    try {
      try {
        await client.storage.from(LOGO_BUCKET).remove(['logo.png', 'logo.jpg', 'logo.svg', 'logo.webp']);
      } catch (e) {}

      await client.from('settings').upsert([{
        key: 'site_logo_url',
        value: '',
        updated_at: new Date().toISOString()
      }], { onConflict: 'key' });

      settings.site_logo_url = '';

      try {
        localStorage.removeItem('its_logo_url');
      } catch (e) {}

      applyLogoPreview();
      await logAudit('delete', 'logo', null, null, null);

      showToast('تم إزالة الشعار', 'success');
    } catch (err) {
      showToast('فشل الإزالة: ' + err.message, 'error');
    }
  }

  /* ============================================
     USERS
     ============================================ */
  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      users = data || [];
      renderUsersTable();
    } catch (err) {
      console.error('[Admin] Load users error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد مستخدمون</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const roleConfig = {
        head: { label: 'النقيب العام', cls: 'head' },
        vice_president: { label: 'نائب الرئيس', cls: 'vice_president' },
        deputy: { label: 'الوكيل', cls: 'deputy' },
        committee: { label: 'لجنة العضوية', cls: 'committee' },
        governorate_head: { label: 'نقيب محافظة', cls: 'governorate_head' },
        governorate_board: { label: 'مجلس محافظة', cls: 'governorate_board' },
        branches_manager: { label: 'مدير الفروع', cls: 'branches_manager' },
        social_committee_head: { label: 'رئيس اللجنة الاجتماعية', cls: 'social_committee_head' },
        social_committee_vice: { label: 'نائب اللجنة الاجتماعية', cls: 'social_committee_vice' },
        public_relations_head: { label: 'رئيس العلاقات العامة', cls: 'public_relations_head' },
        public_relations_vice: { label: 'نائب العلاقات العامة', cls: 'public_relations_vice' },
        committees_manager_head: { label: 'مدير اللجان', cls: 'committees_manager_head' },
        committees_manager_vice: { label: 'نائب مدير اللجان', cls: 'committees_manager_vice' }
      }[u.role] || { label: u.role, cls: 'committee' };

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;">
            <div style="font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(u.full_name || '—')}</div>
            ${u.position ? `<div style="font-size:11.5px;color:var(--accent);margin-top:3px;">${escapeHtml(u.position)}</div>` : ''}
            ${u.phone ? `<div style="font-size:11.5px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;margin-top:2px;">${escapeHtml(u.phone)}</div>` : ''}
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(u.email || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="role-badge ${roleConfig.cls}">
              <span class="dot"></span>
              ${roleConfig.label}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-dim);">
            ${escapeHtml(formatDate(u.last_login_at) || '—')}
          </td>
          <td style="padding:14px 12px;">
            ${u.is_active !== false ? `
              <span class="session-active"><span class="dot"></span>نشط</span>
            ` : `
              <span style="font-size:11.5px;color:var(--text-dim);">معطّل</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn edit-btn" data-action="edit-user" data-id="${u.id}" title="تعديل">
                ${ICONS.edit}
              </button>
              ${u.id !== currentUser.id ? `
                <button class="row-btn delete-btn" data-action="delete-user" data-id="${u.id}" title="حذف">
                  ${ICONS.trash}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action="edit-user"]').forEach(btn => {
      btn.addEventListener('click', () => openUserModal(btn.dataset.id));
    });

    tbody.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.id));
    });
  }

  window.openUserModal = async function (userId) {
    const modal = document.getElementById('userModal');
    if (!modal) return;

    const isEdit = !!userId;
    const user = isEdit ? users.find(u => u.id === userId) : null;

    document.getElementById('userModalTitle').textContent = isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم جديد';
    document.getElementById('userId').value = isEdit ? user.id : '';
    document.getElementById('userEmail').value = isEdit ? (user.email || '') : '';
    document.getElementById('userEmail').disabled = isEdit;
    document.getElementById('userFullName').value = isEdit ? (user.full_name || '') : '';
    document.getElementById('userPhone').value = isEdit ? (user.phone || '') : '';
    document.getElementById('userRole').value = isEdit ? (user.role || 'committee') : 'committee';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').parentElement.style.display = isEdit ? 'none' : 'block';
    document.getElementById('userNotes').value = isEdit ? (user.notes || '') : '';
    document.getElementById('userPosition').value = isEdit ? (user.position || '') : '';

    // Load governorates select
    const govSelect = document.getElementById('userGovernorate');
    if (govSelect) {
      // جلب المحافظات لو مش محملة
      if (governorates.length === 0) {
        try {
          const { data } = await client
            .from('governorates')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });
          governorates = data || [];
        } catch (e) {}
      }

      govSelect.innerHTML = '<option value="">-- اختر المحافظة --</option>';
      governorates.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        if (isEdit && String(user.governorate_id) === String(g.id)) opt.selected = true;
        govSelect.appendChild(opt);
      });
    }

    // Show/hide governorate field
    const govField = document.getElementById('userGovernorateField');
    const role = isEdit ? user.role : 'committee';
    const needsGov = ['governorate_head', 'governorate_board'].includes(role);
    if (govField) govField.style.display = needsGov ? 'block' : 'none';

    // Role change → show/hide gov field
    const roleSelect = document.getElementById('userRole');
    if (roleSelect && !roleSelect.dataset.govListenerAttached) {
      roleSelect.addEventListener('change', () => {
        const r = roleSelect.value;
        const needs = ['governorate_head', 'governorate_board'].includes(r);
        if (govField) govField.style.display = needs ? 'block' : 'none';
      });
      roleSelect.dataset.govListenerAttached = 'true';
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeUserModal = function () {
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveUser() {
    const userId = document.getElementById('userId').value;
    const email = document.getElementById('userEmail').value.trim();
    const fullName = document.getElementById('userFullName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;
    const notes = document.getElementById('userNotes').value.trim();
    const position = document.getElementById('userPosition')?.value.trim() || '';
    const governorateId = document.getElementById('userGovernorate')?.value || null;

    if (!email || !fullName) {
      showToast('البريد والاسم مطلوبان', 'warning');
      return;
    }

    // Validation للمحافظة
    const needsGov = ['governorate_head', 'governorate_board'].includes(role);
    if (needsGov && !governorateId) {
      showToast('اختر المحافظة (مطلوبة لهذا الدور)', 'warning');
      return;
    }

    const btn = document.getElementById('saveUserBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
      if (userId) {
        const { error } = await client
          .from('users')
          .update({
            full_name: fullName,
            phone,
            role,
            position,
            governorate_id: governorateId ? parseInt(governorateId) : null,
            notes
          })
          .eq('id', userId);

        if (error) throw error;

        await logAudit('update', 'user', userId, null, { full_name: fullName, role, position });
        await logAction('update_user', 'user', userId, `تم تحديث ${fullName}`);
        showToast('تم التحديث', 'success');

      } else {
        if (!password || password.length < 6) {
          throw new Error('الباسورد مطلوب (6 أحرف على الأقل)');
        }

        const tempClient = window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_KEY,
          { auth: { persistSession: false } }
        );

        const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });

        if (signUpErr) throw signUpErr;

        const newUserId = signUpData?.user?.id;
        if (!newUserId) throw new Error('فشل إنشاء المستخدم');

        const { error: insertErr } = await client
          .from('users')
          .upsert([{
            id: newUserId,
            email,
            full_name: fullName,
            phone,
            role,
            position,
            governorate_id: governorateId ? parseInt(governorateId) : null,
            notes
          }], { onConflict: 'id' });

        if (insertErr) throw insertErr;

        await logAudit('create', 'user', newUserId, null, { email, role, full_name: fullName, position });
        await logAction('create_user', 'user', newUserId, `تم إنشاء ${fullName} بدور ${role}`);
        showToast('تم إنشاء المستخدم — سيصله إيميل تأكيد', 'success');
      }

      closeUserModal();
      await loadUsers();
    } catch (err) {
      console.error('[Admin] Save user error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>حفظ</span>';
      }
    }
  }

  async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

    try {
      const { error } = await client.from('users').delete().eq('id', userId);
      if (error) throw error;

      await logAudit('delete', 'user', userId, null, null);
      await logAction('delete_user', 'user', userId, null);
      showToast('تم حذف المستخدم', 'success');
      await loadUsers();
    } catch (err) {
      showToast('فشل الحذف: ' + err.message, 'error');
    }
  }

  /* ============================================
     ✅ GOVERNORATES (جديد كامل)
     ============================================ */
  async function loadGovernorates() {
    const tbody = document.getElementById('govTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from('governorates')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      governorates = data || [];
      renderGovTable();
    } catch (err) {
      console.error('[Admin] Load governorates error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderGovTable() {
    const tbody = document.getElementById('govTableBody');
    if (!tbody) return;

    if (!governorates.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">
            لا توجد محافظات. اضغط "إضافة محافظة" لبدء الإضافة.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = governorates.map(g => {
      const structureLabel = g.structure_type === 'council' ? 'مجلس كامل' : 'وكيل + مساعدين';
      const structureColor = g.structure_type === 'council' ? '#22c55e' : '#f97316';

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:600;">${escapeHtml(g.code || '—')}</td>
          <td style="padding:14px 12px;font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(g.name || '—')}</td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 12px;background:${structureColor}15;border:1px solid ${structureColor};border-radius:100px;font-size:11.5px;color:${structureColor};font-weight:700;white-space:nowrap;">
              ${structureLabel}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">${g.sort_order || 0}</td>
          <td style="padding:14px 12px;">
            ${g.is_active !== false
              ? `<span class="session-active" style="font-size:11px;"><span class="dot"></span>مفعّلة</span>`
              : `<span style="font-size:11.5px;color:var(--text-dim);">معطّلة</span>`}
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn edit-btn" data-action="edit-gov" data-id="${g.id}" title="تعديل">
                ${ICONS.edit}
              </button>
              <button class="row-btn delete-btn" data-action="delete-gov" data-id="${g.id}" title="حذف">
                ${ICONS.trash}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action="edit-gov"]').forEach(btn => {
      btn.addEventListener('click', () => openGovModal(btn.dataset.id));
    });

    tbody.querySelectorAll('[data-action="delete-gov"]').forEach(btn => {
      btn.addEventListener('click', () => deleteGov(btn.dataset.id));
    });
  }

  window.openGovModal = function (govId) {
    const modal = document.getElementById('govModal');
    if (!modal) return;

    const isEdit = !!govId;
    const gov = isEdit ? governorates.find(g => String(g.id) === String(govId)) : null;

    document.getElementById('govModalTitle').textContent = isEdit ? 'تعديل محافظة' : 'إضافة محافظة';
    document.getElementById('govId').value = isEdit ? gov.id : '';
    document.getElementById('govName').value = isEdit ? (gov.name || '') : '';
    document.getElementById('govCode').value = isEdit ? (gov.code || '') : '';
    document.getElementById('govCode').disabled = isEdit;
    document.getElementById('govStructureType').value = isEdit ? (gov.structure_type || 'council') : 'council';
    document.getElementById('govSortOrder').value = isEdit ? (gov.sort_order || 1) : (governorates.length + 1);
    document.getElementById('govActive').checked = isEdit ? (gov.is_active !== false) : true;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeGovModal = function () {
    const modal = document.getElementById('govModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveGov() {
    const govId = document.getElementById('govId').value;
    const name = document.getElementById('govName').value.trim();
    const code = document.getElementById('govCode').value.trim().toUpperCase();
    const structureType = document.getElementById('govStructureType').value || 'council';
    const sortOrder = parseInt(document.getElementById('govSortOrder').value) || 0;
    const isActive = document.getElementById('govActive').checked;

    if (!name) {
      showToast('اسم المحافظة مطلوب', 'warning');
      return;
    }

    if (!code) {
      showToast('كود المحافظة مطلوب', 'warning');
      return;
    }

    const btn = document.getElementById('saveGovBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
      const payload = {
        name,
        code,
        structure_type: structureType,
        sort_order: sortOrder,
        is_active: isActive
      };

      if (govId) {
        const { error } = await client.from('governorates').update(payload).eq('id', govId);
        if (error) throw error;
        await logAudit('update', 'governorate', govId, null, payload);
        await logAction('update_governorate', 'governorate', govId, `تحديث ${name}`);
      } else {
        const { error } = await client.from('governorates').insert([payload]);
        if (error) throw error;
        await logAudit('create', 'governorate', null, null, payload);
        await logAction('create_governorate', 'governorate', null, `إضافة ${name}`);
      }

      showToast('تم الحفظ بنجاح', 'success');
      closeGovModal();
      await loadGovernorates();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('governorate-updated', {});
      }

    } catch (err) {
      console.error('[Admin] Save governorate error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>حفظ</span>`;
      }
    }
  }

  async function deleteGov(govId) {
    const gov = governorates.find(g => String(g.id) === String(govId));
    if (!gov) return;

    if (!confirm(`هل أنت متأكد من حذف محافظة "${gov.name}"؟\n\nتحذير: أي مستخدمين مرتبطين بهذه المحافظة سيفقدون الربط.`)) return;

    try {
      const { error } = await client.from('governorates').delete().eq('id', govId);
      if (error) throw error;

      await logAudit('delete', 'governorate', govId, gov, null);
      await logAction('delete_governorate', 'governorate', govId, `حذف ${gov.name}`);

      showToast('تم حذف المحافظة', 'success');
      await loadGovernorates();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('governorate-updated', {});
      }

    } catch (err) {
      console.error('[Admin] Delete governorate error:', err);
      showToast('فشل الحذف: ' + err.message, 'error');
    }
  }

  /* ============================================
     TYPES
     ============================================ */
  async function loadTypes() {
    const tbody = document.getElementById('typesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from('membership_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      membershipTypes = data || [];
      renderTypesTable();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderTypesTable() {
    const tbody = document.getElementById('typesTableBody');
    if (!tbody) return;

    if (!membershipTypes.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد أنواع</td></tr>`;
      return;
    }

    tbody.innerHTML = membershipTypes.map(t => `
      <tr style="border-bottom:1px solid var(--border-soft);">
        <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:600;">${escapeHtml(t.code || '—')}</td>
        <td style="padding:14px 12px;font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(t.name || '—')}</td>
        <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.description || '—')}</td>
        <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);font-weight:600;">${t.fee || 0} ج</td>
        <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">${t.duration_months || 12} شهر</td>
        <td style="padding:14px 12px;">
          ${t.is_active !== false
            ? `<span class="session-active" style="font-size:11px;"><span class="dot"></span>مفعّل</span>`
            : `<span style="font-size:11.5px;color:var(--text-dim);">معطّل</span>`}
        </td>
        <td style="padding:14px 12px;">
          <div class="row-actions">
            <button class="row-btn edit-btn" data-action="edit-type" data-id="${t.id}">${ICONS.edit}</button>
            <button class="row-btn delete-btn" data-action="delete-type" data-id="${t.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-type"]').forEach(btn => {
      btn.addEventListener('click', () => openTypeModal(btn.dataset.id));
    });

    tbody.querySelectorAll('[data-action="delete-type"]').forEach(btn => {
      btn.addEventListener('click', () => deleteType(btn.dataset.id));
    });
  }

  window.openTypeModal = function (typeId) {
    const modal = document.getElementById('typeModal');
    if (!modal) return;

    const isEdit = !!typeId;
    const type = isEdit ? membershipTypes.find(t => String(t.id) === String(typeId)) : null;

    document.getElementById('typeModalTitle').textContent = isEdit ? 'تعديل نوع' : 'إضافة نوع';
    document.getElementById('typeId').value = isEdit ? type.id : '';
    document.getElementById('typeName').value = isEdit ? (type.name || '') : '';
    document.getElementById('typeCode').value = isEdit ? (type.code || '') : '';
    document.getElementById('typeCode').disabled = isEdit;
    document.getElementById('typeDesc').value = isEdit ? (type.description || '') : '';
    document.getElementById('typeFee').value = isEdit ? (type.fee || 0) : 0;
    document.getElementById('typeDuration').value = isEdit ? (type.duration_months || 12) : 12;
    document.getElementById('typeSortOrder').value = isEdit ? (type.sort_order || 1) : (membershipTypes.length + 1);
    document.getElementById('typeActive').checked = isEdit ? (type.is_active !== false) : true;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeTypeModal = function () {
    const modal = document.getElementById('typeModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveType() {
    const typeId = document.getElementById('typeId').value;
    const name = document.getElementById('typeName').value.trim();
    const code = document.getElementById('typeCode').value.trim().toUpperCase();
    const description = document.getElementById('typeDesc').value.trim();
    const fee = parseFloat(document.getElementById('typeFee').value) || 0;
    const duration = parseInt(document.getElementById('typeDuration').value) || 12;
    const sortOrder = parseInt(document.getElementById('typeSortOrder').value) || 0;
    const isActive = document.getElementById('typeActive').checked;

    if (!name || !code) {
      showToast('الاسم والكود مطلوبان', 'warning');
      return;
    }

    const btn = document.getElementById('saveTypeBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
      const payload = {
        name, code, description, fee,
        duration_months: duration,
        sort_order: sortOrder,
        is_active: isActive
      };

      if (typeId) {
        const { error } = await client.from('membership_types').update(payload).eq('id', typeId);
        if (error) throw error;
        await logAudit('update', 'membership_type', typeId, null, payload);
      } else {
        const { error } = await client.from('membership_types').insert([payload]);
        if (error) throw error;
        await logAudit('create', 'membership_type', null, null, payload);
      }

      showToast('تم الحفظ', 'success');
      closeTypeModal();
      await loadTypes();
    } catch (err) {
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>حفظ</span>';
      }
    }
  }

  async function deleteType(typeId) {
    if (!confirm('هل أنت متأكد من حذف هذا النوع؟')) return;

    try {
      const { error } = await client.from('membership_types').delete().eq('id', typeId);
      if (error) throw error;
      await logAudit('delete', 'membership_type', typeId, null, null);
      showToast('تم الحذف', 'success');
      await loadTypes();
    } catch (err) {
      showToast('فشل: ' + err.message, 'error');
    }
  }

  /* ============================================
     BRANCHES
     ============================================ */
  async function loadBranches() {
    const tbody = document.getElementById('branchesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from('branches')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      branches = data || [];
      renderBranchesTable();
    } catch (err) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderBranchesTable() {
    const tbody = document.getElementById('branchesTableBody');
    if (!tbody) return;

    if (!branches.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد شعب</td></tr>`;
      return;
    }

    tbody.innerHTML = branches.map(b => `
      <tr style="border-bottom:1px solid var(--border-soft);">
        <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:600;">${escapeHtml(b.code || '—')}</td>
        <td style="padding:14px 12px;font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(b.name || '—')}</td>
        <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(b.description || '—')}</td>
        <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">${b.sort_order || 0}</td>
        <td style="padding:14px 12px;">
          ${b.is_active !== false
            ? `<span class="session-active" style="font-size:11px;"><span class="dot"></span>مفعّلة</span>`
            : `<span style="font-size:11.5px;color:var(--text-dim);">معطّلة</span>`}
        </td>
        <td style="padding:14px 12px;">
          <div class="row-actions">
            <button class="row-btn edit-btn" data-action="edit-branch" data-id="${b.id}">${ICONS.edit}</button>
            <button class="row-btn delete-btn" data-action="delete-branch" data-id="${b.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-action="edit-branch"]').forEach(btn => {
      btn.addEventListener('click', () => openBranchModal(btn.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete-branch"]').forEach(btn => {
      btn.addEventListener('click', () => deleteBranch(btn.dataset.id));
    });
  }

  window.openBranchModal = function (branchId) {
    const modal = document.getElementById('branchModal');
    if (!modal) return;

    const isEdit = !!branchId;
    const branch = isEdit ? branches.find(b => String(b.id) === String(branchId)) : null;

    document.getElementById('branchModalTitle').textContent = isEdit ? 'تعديل شعبة' : 'إضافة شعبة';
    document.getElementById('branchId').value = isEdit ? branch.id : '';
    document.getElementById('branchName').value = isEdit ? (branch.name || '') : '';
    document.getElementById('branchCode').value = isEdit ? (branch.code || '') : '';
    document.getElementById('branchCode').disabled = isEdit;
    document.getElementById('branchDesc').value = isEdit ? (branch.description || '') : '';
    document.getElementById('branchSortOrder').value = isEdit ? (branch.sort_order || 1) : (branches.length + 1);
    document.getElementById('branchActive').checked = isEdit ? (branch.is_active !== false) : true;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeBranchModal = function () {
    const modal = document.getElementById('branchModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveBranch() {
    const branchId = document.getElementById('branchId').value;
    const name = document.getElementById('branchName').value.trim();
    const code = document.getElementById('branchCode').value.trim().toUpperCase();
    const description = document.getElementById('branchDesc').value.trim();
    const sortOrder = parseInt(document.getElementById('branchSortOrder').value) || 0;
    const isActive = document.getElementById('branchActive').checked;

    if (!name || !code) {
      showToast('الاسم والكود مطلوبان', 'warning');
      return;
    }

    const btn = document.getElementById('saveBranchBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
      const payload = { name, code, description, sort_order: sortOrder, is_active: isActive };

      if (branchId) {
        const { error } = await client.from('branches').update(payload).eq('id', branchId);
        if (error) throw error;
        await logAudit('update', 'branch', branchId, null, payload);
      } else {
        const { error } = await client.from('branches').insert([payload]);
        if (error) throw error;
        await logAudit('create', 'branch', null, null, payload);
      }

      showToast('تم الحفظ', 'success');
      closeBranchModal();
      await loadBranches();
    } catch (err) {
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>حفظ</span>';
      }
    }
  }

  async function deleteBranch(branchId) {
    if (!confirm('هل أنت متأكد من حذف هذه الشعبة؟')) return;

    try {
      const { error } = await client.from('branches').delete().eq('id', branchId);
      if (error) throw error;
      await logAudit('delete', 'branch', branchId, null, null);
      showToast('تم الحذف', 'success');
      await loadBranches();
    } catch (err) {
      showToast('فشل: ' + err.message, 'error');
    }
  }

  /* ============================================
     FEATURES CARDS
     ============================================ */
  function loadFeaturesFromSettings() {
    try {
      const raw = settings.features_cards;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) featuresCards = parsed;
      }
    } catch (e) {
      featuresCards = [];
    }
    renderFeaturesPreview();
  }

  function renderFeaturesPreview() {
    const list = document.getElementById('featuresPreviewList');
    if (!list) return;

    if (!featuresCards.length) {
      list.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-dim);">لا توجد كروت بعد. اضغط "إضافة كارت" لإضافة أول كارت.</div>`;
      return;
    }

    list.innerHTML = featuresCards.map((c, idx) => {
      const iconHTML = c.logo
        ? `<img src="${escapeHtml(c.logo)}" alt="" />`
        : (ICON_LIBRARY[c.icon] || ICON_LIBRARY.zap);

      return `
        <div class="feature-preview-card">
          <div class="feature-preview-icon">${iconHTML}</div>
          <div class="feature-preview-info">
            <div class="feature-preview-title">${escapeHtml(c.title || 'بدون عنوان')}</div>
            <div class="feature-preview-text">${escapeHtml(c.text || '')}</div>
          </div>
          <div class="feature-preview-actions">
            <button class="feature-action-btn edit" data-action="edit-feature" data-idx="${idx}" title="تعديل">
              ${ICONS.edit}
            </button>
            <button class="feature-action-btn delete" data-action="delete-feature" data-idx="${idx}" title="حذف">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-action="edit-feature"]').forEach(btn => {
      btn.addEventListener('click', () => openFeatureModal(parseInt(btn.dataset.idx)));
    });
    list.querySelectorAll('[data-action="delete-feature"]').forEach(btn => {
      btn.addEventListener('click', () => deleteFeature(parseInt(btn.dataset.idx)));
    });
  }

  function renderIconPicker() {
    const picker = document.getElementById('iconPicker');
    if (!picker) return;

    picker.innerHTML = Object.entries(ICON_LIBRARY).map(([key, svg]) => `
      <div class="icon-option" data-icon="${key}" title="${key}">${svg}</div>
    `).join('');

    picker.querySelectorAll('.icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.getElementById('featureIcon').value = opt.dataset.icon;
        picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  window.openFeatureModal = function (index) {
    const modal = document.getElementById('featureModal');
    if (!modal) return;

    const isEdit = index !== null && index !== undefined && index >= 0;
    const feature = isEdit ? featuresCards[index] : null;

    document.getElementById('featureModalTitle').textContent = isEdit ? 'تعديل كارت' : 'إضافة كارت';
    document.getElementById('featureIndex').value = isEdit ? index : '';
    document.getElementById('featureTitle').value = isEdit ? (feature.title || '') : '';
    document.getElementById('featureText').value = isEdit ? (feature.text || '') : '';
    document.getElementById('featureLogo').value = isEdit ? (feature.logo || '') : '';

    const iconKey = isEdit ? (feature.icon || 'zap') : 'zap';
    document.getElementById('featureIcon').value = iconKey;

    renderIconPicker();
    const picker = document.getElementById('iconPicker');
    picker?.querySelectorAll('.icon-option').forEach(o => {
      o.classList.toggle('active', o.dataset.icon === iconKey);
    });

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeFeatureModal = function () {
    const modal = document.getElementById('featureModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  function saveFeature() {
    const index = document.getElementById('featureIndex').value;
    const title = document.getElementById('featureTitle').value.trim();
    const text = document.getElementById('featureText').value.trim();
    const icon = document.getElementById('featureIcon').value || 'zap';
    const logo = document.getElementById('featureLogo').value.trim();

    if (!title) {
      showToast('العنوان مطلوب', 'warning');
      return;
    }

    const card = { icon, title, text, logo: logo || undefined };

    if (index !== '' && index !== null && index !== undefined) {
      featuresCards[parseInt(index)] = card;
    } else {
      featuresCards.push(card);
    }

    renderFeaturesPreview();
    closeFeatureModal();
    showToast('تم الحفظ. لا تنسَ الضغط على "حفظ إعدادات الرئيسية"', 'info');
  }

  function deleteFeature(index) {
    if (!confirm('هل أنت متأكد من حذف هذا الكارت؟')) return;

    featuresCards.splice(index, 1);
    renderFeaturesPreview();
    showToast('تم الحذف. لا تنسَ الحفظ', 'info');
  }

  /* ============================================
     SESSIONS & ACTIONS
     ============================================ */
  async function loadSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    const actionsBody = document.getElementById('actionsTableBody');
    const countEl = document.getElementById('actionsCount');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    if (actionsBody) actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data: sessData } = await client
        .from('user_sessions')
        .select('*, users:user_id(full_name, role)')
        .order('login_at', { ascending: false })
        .limit(100);

      sessions = sessData || [];
      renderSessionsTable();

      const { data: actData } = await client
        .from('user_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      actions = actData || [];
      renderActionsTable();
      if (countEl) countEl.textContent = `${actions.length} إجراء`;

    } catch (err) {
      console.error('[Admin] Load sessions error:', err);
    }
  }

  function renderSessionsTable() {
    const tbody = document.getElementById('sessionsTableBody');
    if (!tbody) return;

    if (!sessions.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد جلسات مسجلة</td></tr>`;
      return;
    }

    tbody.innerHTML = sessions.map(s => {
      const userName = s.users?.full_name || '—';
      const role = s.users?.role || '—';
      const roleLabel = role === 'head' ? 'النقيب' : role === 'vice_president' ? 'نائب' : 'لجنة';

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:12px;font-size:13px;font-weight:600;color:var(--text);">${escapeHtml(userName)}</td>
          <td style="padding:12px;">
            <span class="role-badge ${role}">
              <span class="dot"></span>
              ${roleLabel}
            </span>
          </td>
          <td style="padding:12px;font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">${escapeHtml(formatDate(s.login_at))}</td>
          <td style="padding:12px;">
            ${s.is_active
              ? `<span class="session-active"><span class="dot"></span>مفتوحة</span>`
              : `<span class="session-duration">${escapeHtml(formatDuration(s.duration_seconds))}</span>`}
          </td>
          <td style="padding:12px;font-size:12px;color:var(--text-dim);">
            ${s.device ? escapeHtml(s.device.substring(0, 40)) : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderActionsTable() {
    const tbody = document.getElementById('actionsTableBody');
    if (!tbody) return;

    if (!actions.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد إجراءات</td></tr>`;
      return;
    }

    const actionLabels = {
      'update_settings': 'تحديث الإعدادات',
      'upload_logo': 'رفع شعار',
      'create_user': 'إنشاء مستخدم',
      'update_user': 'تعديل مستخدم',
      'delete_user': 'حذف مستخدم',
      'create_governorate': 'إضافة محافظة',
      'update_governorate': 'تعديل محافظة',
      'delete_governorate': 'حذف محافظة'
    };

    tbody.innerHTML = actions.map(a => `
      <tr style="border-bottom:1px solid var(--border-soft);">
        <td style="padding:12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
          <span dir="ltr">${escapeHtml(a.user_email || '—')}</span>
        </td>
        <td style="padding:12px;">
          <span style="font-size:12px;font-weight:700;color:var(--accent);">
            ${escapeHtml(actionLabels[a.action] || a.action)}
          </span>
        </td>
        <td style="padding:12px;font-size:12px;color:var(--text-muted);">${escapeHtml(a.details || '—')}</td>
        <td style="padding:12px;font-size:11.5px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;">${escapeHtml(formatDate(a.created_at))}</td>
      </tr>
    `).join('');
  }

  /* ============================================
     AUDIT LOG
     ============================================ */
  async function loadAuditLog() {
    const tbody = document.getElementById('auditTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from(AUDIT_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      auditLogs = data || [];
      renderAuditTable();
    } catch (err) {
      console.error('[Admin] Audit load error:', err);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد سجل بعد</td></tr>`;
    }
  }

  function renderAuditTable() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (!auditLogs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد سجل بعد</td></tr>`;
      return;
    }

    const actionColors = {
      'create': { label: 'إنشاء', color: 'var(--success)' },
      'update': { label: 'تعديل', color: 'var(--warning)' },
      'delete': { label: 'حذف', color: 'var(--danger)' },
      'upload': { label: 'رفع', color: 'var(--accent)' }
    };

    tbody.innerHTML = auditLogs.map(log => {
      const action = actionColors[log.action] || { label: log.action, color: 'var(--text-muted)' };
      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(log.user_email || '—')}</span>
          </td>
          <td style="padding:12px;">
            <span style="padding:4px 10px;background:${action.color}22;border:1px solid ${action.color};border-radius:100px;font-size:11.5px;color:${action.color};font-weight:700;">
              ${action.label}
            </span>
          </td>
          <td style="padding:12px;font-size:12.5px;color:var(--text-muted);">${escapeHtml(log.entity || '—')}</td>
          <td style="padding:12px;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--text-dim);">${escapeHtml(log.entity_id || '—')}</td>
          <td style="padding:12px;font-size:11.5px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;">${escapeHtml(formatDate(log.created_at))}</td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================
     EXPORT BACKUP
     ============================================ */
  async function exportBackup() {
    try {
      showToast('جاري تحضير النسخة الاحتياطية...', 'info');

      const [settingsRes, typesRes, branchesRes, usersRes, appsRes, govRes] = await Promise.all([
        client.from('settings').select('*'),
        client.from('membership_types').select('*'),
        client.from('branches').select('*'),
        client.from('users').select('*'),
        client.from('applications').select('*'),
        client.from('governorates').select('*')
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        exported_by: currentUser?.email,
        version: '3.2.0',
        data: {
          settings: settingsRes.data || [],
          membership_types: typesRes.data || [],
          branches: branchesRes.data || [],
          users: usersRes.data || [],
          applications: appsRes.data || [],
          governorates: govRes.data || []
        }
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `its-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('تم تصدير النسخة الاحتياطية', 'success');
    } catch (err) {
      showToast('فشل التصدير: ' + err.message, 'error');
    }
  }

  /* ============================================
     SETUP LISTENERS
     ============================================ */
  function setupListeners() {
    // Save settings
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveSettings('saveSettingsBtn'));

    const saveHomeBtn = document.getElementById('saveHomeBtn');
    if (saveHomeBtn) saveHomeBtn.addEventListener('click', () => saveSettings('saveHomeBtn'));

    // Upload logo
    const uploadInput = document.getElementById('logoFileInput');
    const uploadBtn = document.getElementById('uploadLogoBtn');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', () => uploadInput.click());
      uploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await uploadLogo(file);
        uploadInput.value = '';
      });
    }

    const removeBtn = document.getElementById('removeLogoBtn');
    if (removeBtn) removeBtn.addEventListener('click', removeLogo);

    // Add user
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserModal(null));

    const saveUserBtn = document.getElementById('saveUserBtn');
    if (saveUserBtn) saveUserBtn.addEventListener('click', saveUser);

    // ✅ Add governorate
    const addGovBtn = document.getElementById('addGovBtn');
    if (addGovBtn) addGovBtn.addEventListener('click', () => openGovModal(null));

    const saveGovBtn = document.getElementById('saveGovBtn');
    if (saveGovBtn) saveGovBtn.addEventListener('click', saveGov);

    // Add type
    const addTypeBtn = document.getElementById('addTypeBtn');
    if (addTypeBtn) addTypeBtn.addEventListener('click', () => openTypeModal(null));

    const saveTypeBtn = document.getElementById('saveTypeBtn');
    if (saveTypeBtn) saveTypeBtn.addEventListener('click', saveType);

    // Add branch
    const addBranchBtn = document.getElementById('addBranchBtn');
    if (addBranchBtn) addBranchBtn.addEventListener('click', () => openBranchModal(null));

    const saveBranchBtn = document.getElementById('saveBranchBtn');
    if (saveBranchBtn) saveBranchBtn.addEventListener('click', saveBranch);

    // Add feature
    const addFeatureBtn = document.getElementById('addFeatureBtn');
    if (addFeatureBtn) addFeatureBtn.addEventListener('click', () => openFeatureModal(null));

    const saveFeatureBtn = document.getElementById('saveFeatureBtn');
    if (saveFeatureBtn) saveFeatureBtn.addEventListener('click', saveFeature);

    // Refresh sessions
    const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
    if (refreshSessionsBtn) {
      refreshSessionsBtn.addEventListener('click', () => {
        sessions = [];
        actions = [];
        loadSessions();
      });
    }

    // Refresh audit
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');
    if (refreshAuditBtn) {
      refreshAuditBtn.addEventListener('click', () => {
        auditLogs = [];
        loadAuditLog();
      });
    }

    // Backup
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) backupBtn.addEventListener('click', exportBackup);

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    // Modal backdrops
    ['userModal', 'typeModal', 'branchModal', 'featureModal', 'govModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'userModal') window.closeUserModal();
          else if (id === 'typeModal') window.closeTypeModal();
          else if (id === 'branchModal') window.closeBranchModal();
          else if (id === 'featureModal') window.closeFeatureModal();
          else if (id === 'govModal') window.closeGovModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeUserModal();
        window.closeTypeModal();
        window.closeBranchModal();
        window.closeFeatureModal();
        window.closeGovModal();
      }
    });
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['settings', 'membership_types', 'branches', 'users', 'governorates'],
      async () => {
        if (activeTab === 'settings' || activeTab === 'home') await loadSettings();
        if (activeTab === 'types') await loadTypes();
        if (activeTab === 'branches') await loadBranches();
        if (activeTab === 'users') await loadUsers();
        if (activeTab === 'governorates') await loadGovernorates();
      },
      { debounceMs: 500, immediate: false }
    );

    window.addEventListener('broadcast-notification', (e) => {
      if (e.detail?.type === 'settings-updated') loadSettings();
    });
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (typeof window.onSupabaseReady !== 'function') {
      setTimeout(init, 100);
      return;
    }

    window.onSupabaseReady(async (c) => {
      client = c;

      const ok = await checkAuth();
      if (!ok) return;

      setupTabs();
      setupListeners();

      await loadSettings();

      setupRealtime();

      // Pre-load حسب التاب الحالي
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'governorates') loadGovernorates();
      if (activeTab === 'types') loadTypes();
      if (activeTab === 'branches') loadBranches();
      if (activeTab === 'sessions') loadSessions();
      if (activeTab === 'audit') loadAuditLog();

      console.log('[Admin] Ready. Version 3.2.0');
    });
  }

  window.switchTab = switchTab;
  window.saveFeature = saveFeature;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =====================================================
   IT SYNDICATE — Head of Syndicate (Admin) Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const DEFAULT_SETTINGS = {
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

  const LOGO_BUCKET = 'branding';
  const LOGO_FILE_NAME = 'logo';
  const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];

  const AUDIT_TABLE = 'audit_log';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let settings = { ...DEFAULT_SETTINGS };
  let users = [];
  let membershipTypes = [];
  let auditLogs = [];
  let unsubscribeRealtime = null;
  let activeTab = 'settings';

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

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    save: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    upload: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    users: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    file: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    palette: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 2a10 10 0 1 0 0 20 2 2 0 0 0 0-4 6 6 0 0 1 0-12 2 2 0 0 0 0-4z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    info: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    arrowBack: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
    image: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    key: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
    database: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
  };

  /* ============================================
     AUTH + ROLE CHECK
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

      // Get role
      const { data: userData, error } = await client
        .from('users')
        .select('role, full_name, email')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('[Admin] Role fetch error:', error.message);
      }

      userRole = userData?.role || 'committee';

      // 🔒 Only head can access
      if (userRole !== 'head') {
        alert('هذه الصفحة مخصصة للنقيب العام فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'النقيب';

      // Update UI
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
     LOG AUDIT
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
      // Silent fail — audit shouldn't break main flow
      console.warn('[Audit] Log failed:', e.message);
    }
  }

  /* ============================================
     LOAD SETTINGS
     ============================================ */
  async function loadSettings() {
    try {
      const { data, error } = await client
        .from('settings')
        .select('key, value');

      if (error) throw error;

      const loaded = { ...DEFAULT_SETTINGS };
      (data || []).forEach(row => {
        if (row.key) loaded[row.key] = row.value ?? '';
      });

      settings = loaded;
      applySettingsToForm();
      applyLogoPreview();
      applySiteNamePreview();
    } catch (err) {
      console.error('[Admin] Settings load error:', err);
      showToast('فشل تحميل الإعدادات: ' + err.message, 'error');
    }
  }

  function applySettingsToForm() {
    // Fill all inputs with [data-setting="key"]
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

  /* ============================================
     SAVE SETTINGS
     ============================================ */
  async function saveSettings() {
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = `<span>جاري الحفظ...</span>`;
    }

    try {
      const updates = {};

      // Collect from all inputs with [data-setting]
      document.querySelectorAll('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (!key) return;

        if (el.type === 'checkbox') {
          updates[key] = el.checked ? 'true' : 'false';
        } else {
          updates[key] = el.value || '';
        }
      });

      // Prepare upsert rows
      const rows = Object.entries(updates).map(([key, value]) => ({
        key,
        value: String(value),
        updated_at: new Date().toISOString()
      }));

      const { error } = await client
        .from('settings')
        .upsert(rows, { onConflict: 'key' });

      if (error) throw error;

      // Merge into state
      Object.assign(settings, updates);

      // Audit log
      await logAudit('update', 'settings', null, null, updates);

      // Save to localStorage cache (for instant load)
      try {
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
        if (settings.site_logo_url) {
          localStorage.setItem('its_logo_url', settings.site_logo_url);
        }
        if (settings.default_theme) {
          localStorage.setItem('its_global_default_theme', settings.default_theme);
        }
      } catch (e) {}

      // Update UI
      applySiteNamePreview();
      applyLogoPreview();
      document.title = settings.site_name || DEFAULT_SETTINGS.site_name;

      showToast('تم حفظ الإعدادات بنجاح', 'success');

      // Broadcast to all open tabs
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
     SITE NAME PREVIEW
     ============================================ */
  function applySiteNamePreview() {
    const preview = document.getElementById('siteNamePreview');
    if (preview) {
      preview.textContent = settings.site_name || DEFAULT_SETTINGS.site_name;
    }
  }

  /* ============================================
     LOGO UPLOAD
     ============================================ */
  function applyLogoPreview() {
    const preview = document.getElementById('logoPreview');
    if (!preview) return;

    const url = settings.site_logo_url;
    if (url) {
      preview.innerHTML = `
        <img src="${escapeHtml(url)}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain;" />
      `;
      preview.classList.add('has-logo');
    } else {
      preview.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;color:rgba(255,255,255,0.35);">
          <span style="width:36px;height:36px;display:inline-flex;">${ICONS.image}</span>
          <span style="font-size:12px;">لا يوجد شعار</span>
        </div>
      `;
      preview.classList.remove('has-logo');
    }
  }

  async function uploadLogo(file) {
    // Validate
    if (file.size > MAX_LOGO_SIZE) {
      showToast(`حجم الشعار كبير جدًا (${formatFileSize(file.size)}) — الحد الأقصى 2 ميجا`, 'error');
      return;
    }

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      showToast('صيغة الشعار غير مدعومة — مسموح: PNG, JPG, SVG, WEBP', 'error');
      return;
    }

    const btn = document.getElementById('uploadLogoBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الرفع...</span>';
    }

    try {
      // Extension
      let ext = 'png';
      if (file.type === 'image/svg+xml') ext = 'svg';
      else if (file.type === 'image/jpeg') ext = 'jpg';
      else if (file.type === 'image/webp') ext = 'webp';
      else if (file.type === 'image/png') ext = 'png';

      const fileName = `${LOGO_FILE_NAME}.${ext}`;
      const filePath = `logo.${ext}`;

      // Upload (upsert)
      const { error: upErr } = await client.storage
        .from(LOGO_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (upErr) throw upErr;

      // Get public URL (with cache-bust query)
      const { data: urlData } = client.storage
        .from(LOGO_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      // Save to settings
      const { error: setErr } = await client
        .from('settings')
        .upsert([{
          key: 'site_logo_url',
          value: publicUrl,
          updated_at: new Date().toISOString()
        }], { onConflict: 'key' });

      if (setErr) throw setErr;

      settings.site_logo_url = publicUrl;

      // Update local cache
      try {
        localStorage.setItem('its_logo_url', publicUrl);
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
      } catch (e) {}

      // Update preview
      applyLogoPreview();

      // Update favicon + all page logos
      updateLogosEverywhere(publicUrl);

      // Audit
      await logAudit('upload', 'logo', filePath, null, { url: publicUrl, size: file.size });

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
        btn.innerHTML = `<span style="width:14px;height:14px;display:inline-flex;margin-left:6px;">${ICONS.upload}</span><span>اختر شعار جديد</span>`;
      }
    }
  }

  function updateLogosEverywhere(url) {
    // Favicon
    const fav = document.getElementById('faviconLink');
    const apple = document.getElementById('appleTouchIcon');
    if (fav) { fav.type = 'image/png'; fav.href = url; }
    if (apple) { apple.href = url; }

    // All logo images in page
    document.querySelectorAll('[data-logo]').forEach(img => {
      img.src = url;
      img.style.display = 'block';
    });
  }

  async function removeLogo() {
    if (!confirm('هل أنت متأكد من إزالة الشعار؟')) return;

    try {
      // Delete file
      try {
        await client.storage.from(LOGO_BUCKET).remove([`logo.png`, `logo.jpg`, `logo.svg`, `logo.webp`]);
      } catch (e) {}

      // Clear setting
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
      console.error('[Admin] Remove logo error:', err);
      showToast('فشل الإزالة: ' + err.message, 'error');
    }
  }

  /* ============================================
     USERS MANAGEMENT
     ============================================ */
  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">جاري التحميل...</td></tr>`;
    }

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
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:#ff5555;">${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">لا يوجد مستخدمون</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isHead = u.role === 'head';
      const roleLabel = isHead ? 'النقيب العام' : 'لجنة العضويات';
      const roleColor = isHead ? '#f59e0b' : '#00f0ff';
      const roleBg = isHead ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0, 240, 255, 0.1)';

      return `
        <tr style="border-bottom:1px solid rgba(0,240,255,0.06);">
          <td style="padding:14px 12px;">
            <div style="font-weight:700;font-size:13.5px;color:#fff;">${escapeHtml(u.full_name || '—')}</div>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:rgba(255,255,255,0.7);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(u.email || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:4px 12px;
              background:${roleBg};
              border:1.5px solid ${roleColor};
              border-radius:100px;
              font-size:12px;
              color:${roleColor};
              font-weight:700;
            ">
              <span style="width:6px;height:6px;border-radius:50%;background:${roleColor};"></span>
              ${roleLabel}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:rgba(255,255,255,0.5);">${escapeHtml(formatDate(u.created_at))}</td>
          <td style="padding:14px 12px;">
            <div style="display:flex;gap:6px;justify-content:center;">
              <button class="user-edit-btn" data-id="${u.id}" title="تعديل الدور" style="
                width:32px;height:32px;
                border-radius:8px;
                background:rgba(0,255,157,0.08);
                border:1px solid rgba(0,255,157,0.25);
                color:#00ff9d;
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center;
                transition:all 0.2s;
              ">
                <span style="width:14px;height:14px;display:inline-flex;">${ICONS.edit}</span>
              </button>
              ${!isHead || u.id !== currentUser?.id ? `
                <button class="user-delete-btn" data-id="${u.id}" title="حذف" style="
                  width:32px;height:32px;
                  border-radius:8px;
                  background:rgba(255,85,85,0.08);
                  border:1px solid rgba(255,85,85,0.25);
                  color:#ff5555;
                  cursor:pointer;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  transition:all 0.2s;
                ">
                  <span style="width:14px;height:14px;display:inline-flex;">${ICONS.trash}</span>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind events
    tbody.querySelectorAll('.user-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openUserModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.user-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteUser(btn.dataset.id));
    });
  }

  /* ============================================
     USER MODAL (Create / Edit)
     ============================================ */
  function openUserModal(userId) {
    const modal = document.getElementById('userModal');
    if (!modal) return;

    const isEdit = !!userId;
    const user = isEdit ? users.find(u => u.id === userId) : null;

    document.getElementById('userModalTitle').textContent = isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم جديد';
    document.getElementById('userId').value = isEdit ? user.id : '';
    document.getElementById('userEmail').value = isEdit ? (user.email || '') : '';
    document.getElementById('userEmail').disabled = isEdit;
    document.getElementById('userFullName').value = isEdit ? (user.full_name || '') : '';
    document.getElementById('userRole').value = isEdit ? (user.role || 'committee') : 'committee';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').parentElement.style.display = isEdit ? 'none' : 'block';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeUserModal = function () {
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveUser() {
    const userId = document.getElementById('userId').value;
    const email = document.getElementById('userEmail').value.trim();
    const fullName = document.getElementById('userFullName').value.trim();
    const role = document.getElementById('userRole').value;
    const password = document.getElementById('userPassword').value;

    if (!email || !fullName) {
      showToast('البريد والاسم مطلوبان', 'warning');
      return;
    }

    const btn = document.getElementById('saveUserBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'جاري الحفظ...';
    }

    try {
      if (userId) {
        // Edit — update users table only
        const { error } = await client
          .from('users')
          .update({ full_name: fullName, role })
          .eq('id', userId);

        if (error) throw error;

        await logAudit('update', 'user', userId, null, { full_name: fullName, role });
        showToast('تم التحديث', 'success');
      } else {
        // Create — sign up
        if (!password || password.length < 6) {
          throw new Error('الباسورد مطلوب (6 أحرف على الأقل)');
        }

        const { data: signUpData, error: signUpErr } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        });

        if (signUpErr) throw signUpErr;

        const newUserId = signUpData?.user?.id;
        if (!newUserId) throw new Error('فشل إنشاء المستخدم');

        // Add to users table
        const { error: insertErr } = await client
          .from('users')
          .upsert([{
            id: newUserId,
            email,
            full_name: fullName,
            role
          }], { onConflict: 'id' });

        if (insertErr) throw insertErr;

        await logAudit('create', 'user', newUserId, null, { email, role, full_name: fullName });
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
        btn.innerHTML = 'حفظ';
      }
    }
  }

  async function deleteUser(userId) {
    if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟ لا يمكن التراجع.')) return;

    try {
      const { error } = await client.from('users').delete().eq('id', userId);
      if (error) throw error;

      await logAudit('delete', 'user', userId, null, null);
      showToast('تم حذف المستخدم', 'success');
      await loadUsers();
    } catch (err) {
      console.error('[Admin] Delete user error:', err);
      showToast('فشل الحذف: ' + err.message, 'error');
    }
  }

  /* ============================================
     MEMBERSHIP TYPES CRUD
     ============================================ */
  async function loadMembershipTypes() {
    const tbody = document.getElementById('typesTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">جاري التحميل...</td></tr>`;
    }

    try {
      const { data, error } = await client
        .from('membership_types')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      membershipTypes = data || [];
      renderTypesTable();
    } catch (err) {
      console.error('[Admin] Load types error:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#ff5555;">${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  function renderTypesTable() {
    const tbody = document.getElementById('typesTableBody');
    if (!tbody) return;

    if (!membershipTypes.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">لا توجد أنواع</td></tr>`;
      return;
    }

    tbody.innerHTML = membershipTypes.map(t => `
      <tr style="border-bottom:1px solid rgba(0,240,255,0.06);">
        <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent, #00f0ff);font-weight:600;">${escapeHtml(t.code || '—')}</td>
        <td style="padding:14px 12px;font-weight:700;font-size:13.5px;color:#fff;">${escapeHtml(t.name || '—')}</td>
        <td style="padding:14px 12px;font-size:12.5px;color:rgba(255,255,255,0.6);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.description || '—')}</td>
        <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent, #00f0ff);font-weight:600;">${t.fee || 0} ج</td>
        <td style="padding:14px 12px;font-size:12.5px;color:rgba(255,255,255,0.6);">${t.duration_months || 12} شهر</td>
        <td style="padding:14px 12px;">
          <div style="display:flex;gap:6px;justify-content:center;">
            <button class="type-edit-btn" data-id="${t.id}" style="
              width:32px;height:32px;
              border-radius:8px;
              background:rgba(0,255,157,0.08);
              border:1px solid rgba(0,255,157,0.25);
              color:#00ff9d;
              cursor:pointer;
              display:flex;align-items:center;justify-content:center;
            ">
              <span style="width:14px;height:14px;display:inline-flex;">${ICONS.edit}</span>
            </button>
            <button class="type-delete-btn" data-id="${t.id}" style="
              width:32px;height:32px;
              border-radius:8px;
              background:rgba(255,85,85,0.08);
              border:1px solid rgba(255,85,85,0.25);
              color:#ff5555;
              cursor:pointer;
              display:flex;align-items:center;justify-content:center;
            ">
              <span style="width:14px;height:14px;display:inline-flex;">${ICONS.trash}</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.type-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openTypeModal(btn.dataset.id));
    });

    tbody.querySelectorAll('.type-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteType(btn.dataset.id));
    });
  }

  function openTypeModal(typeId) {
    const modal = document.getElementById('typeModal');
    if (!modal) return;

    const isEdit = !!typeId;
    const type = isEdit ? membershipTypes.find(t => String(t.id) === String(typeId)) : null;

    document.getElementById('typeModalTitle').textContent = isEdit ? 'تعديل نوع العضوية' : 'إضافة نوع عضوية';
    document.getElementById('typeId').value = isEdit ? type.id : '';
    document.getElementById('typeName').value = isEdit ? (type.name || '') : '';
    document.getElementById('typeCode').value = isEdit ? (type.code || '') : '';
    document.getElementById('typeCode').disabled = isEdit;
    document.getElementById('typeDesc').value = isEdit ? (type.description || '') : '';
    document.getElementById('typeFee').value = isEdit ? (type.fee || 0) : 0;
    document.getElementById('typeDuration').value = isEdit ? (type.duration_months || 12) : 12;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

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

    if (!name || !code) {
      showToast('الاسم والكود مطلوبان', 'warning');
      return;
    }

    const btn = document.getElementById('saveTypeBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'جاري الحفظ...';
    }

    try {
      const payload = {
        name,
        code,
        description,
        fee,
        duration_months: duration
      };

      if (typeId) {
        const { error } = await client
          .from('membership_types')
          .update(payload)
          .eq('id', typeId);
        if (error) throw error;
        await logAudit('update', 'membership_type', typeId, null, payload);
      } else {
        const { error } = await client
          .from('membership_types')
          .insert([payload]);
        if (error) throw error;
        await logAudit('create', 'membership_type', null, null, payload);
      }

      showToast('تم الحفظ', 'success');
      closeTypeModal();
      await loadMembershipTypes();
    } catch (err) {
      console.error('[Admin] Save type error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ';
      }
    }
  }

  async function deleteType(typeId) {
    if (!confirm('هل أنت متأكد من حذف نوع العضوية؟ قد يؤثر على الطلبات الحالية.')) return;

    try {
      const { error } = await client.from('membership_types').delete().eq('id', typeId);
      if (error) throw error;

      await logAudit('delete', 'membership_type', typeId, null, null);
      showToast('تم الحذف', 'success');
      await loadMembershipTypes();
    } catch (err) {
      console.error('[Admin] Delete type error:', err);
      showToast('فشل: ' + err.message, 'error');
    }
  }

  /* ============================================
     AUDIT LOG
     ============================================ */
  async function loadAuditLog() {
    const tbody = document.getElementById('auditTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">جاري التحميل...</td></tr>`;
    }

    try {
      const { data, error } = await client
        .from(AUDIT_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        // Table might not exist yet
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">لا يوجد سجل بعد</td></tr>`;
        }
        return;
      }

      auditLogs = data || [];
      renderAuditTable();
    } catch (err) {
      console.error('[Admin] Audit load error:', err);
    }
  }

  function renderAuditTable() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    if (!auditLogs.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">لا يوجد سجل بعد</td></tr>`;
      return;
    }

    const actionLabels = {
      'create': { label: 'إنشاء', color: '#00ff9d' },
      'update': { label: 'تعديل', color: '#ffb800' },
      'delete': { label: 'حذف', color: '#ff5555' },
      'upload': { label: 'رفع', color: '#00f0ff' }
    };

    tbody.innerHTML = auditLogs.map(log => {
      const action = actionLabels[log.action] || { label: log.action, color: '#888' };
      return `
        <tr style="border-bottom:1px solid rgba(0,240,255,0.06);">
          <td style="padding:12px;font-size:12.5px;color:rgba(255,255,255,0.7);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(log.user_email || '—')}</span>
          </td>
          <td style="padding:12px;">
            <span style="
              padding:4px 10px;
              background:${action.color}22;
              border:1px solid ${action.color};
              border-radius:100px;
              font-size:11.5px;
              color:${action.color};
              font-weight:700;
            ">${action.label}</span>
          </td>
          <td style="padding:12px;font-size:12.5px;color:rgba(255,255,255,0.7);">${escapeHtml(log.entity || '—')}</td>
          <td style="padding:12px;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:rgba(255,255,255,0.5);">${escapeHtml(log.entity_id || '—')}</td>
          <td style="padding:12px;font-size:11.5px;color:rgba(255,255,255,0.5);font-family:'JetBrains Mono',monospace;">${escapeHtml(formatDate(log.created_at))}</td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================
     TABS
     ============================================ */
  function switchTab(tabId) {
    activeTab = tabId;

    // Hide all
    document.querySelectorAll('[data-tab-content]').forEach(el => {
      el.style.display = 'none';
    });

    // Show active
    const active = document.querySelector(`[data-tab-content="${tabId}"]`);
    if (active) active.style.display = 'block';

    // Update tab buttons
    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      const isActive = btn.dataset.tabBtn === tabId;
      btn.classList.toggle('active', isActive);
    });

    // Lazy-load data
    if (tabId === 'users' && !users.length) loadUsers();
    if (tabId === 'types' && !membershipTypes.length) loadMembershipTypes();
    if (tabId === 'audit' && !auditLogs.length) loadAuditLog();

    // Update URL hash
    try {
      history.replaceState(null, '', `#${tabId}`);
    } catch (e) {}
  }

  function setupTabs() {
    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tabBtn));
    });

    // From hash
    const hash = (window.location.hash || '').replace('#', '');
    if (hash) {
      switchTab(hash);
    } else {
      switchTab('settings');
    }
  }

  /* ============================================
     THEME PREVIEW SELECT
     ============================================ */
  function buildThemeSelect() {
    const select = document.getElementById('defaultThemeSelect');
    if (!select) return;
    if (window.ThemeManager && typeof window.ThemeManager.buildThemeSelect === 'function') {
      window.ThemeManager.buildThemeSelect('defaultThemeSelect', settings.default_theme);
    }
  }

  function previewThemeChange() {
    const select = document.getElementById('defaultThemeSelect');
    if (!select) return;

    const themeId = select.value;
    // Live preview only (not saved until user clicks save)
    if (window.ThemeManager) {
      window.ThemeManager.applyTheme(themeId);
    }
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['settings', 'membership_types', 'users'],
      async () => {
        if (activeTab === 'settings') await loadSettings();
        if (activeTab === 'types') await loadMembershipTypes();
        if (activeTab === 'users') await loadUsers();
      },
      { debounceMs: 500, immediate: false }
    );

    // Listen for settings broadcasts
    window.addEventListener('broadcast-notification', (e) => {
      const data = e.detail;
      if (data?.type === 'settings-updated') {
        loadSettings();
      }
    });
  }

  /* ============================================
     EXPORT BACKUP
     ============================================ */
  async function exportBackup() {
    try {
      showToast('جاري تحضير النسخة الاحتياطية...', 'info');

      const [settingsRes, typesRes, usersRes] = await Promise.all([
        client.from('settings').select('*'),
        client.from('membership_types').select('*'),
        client.from('users').select('*')
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        exported_by: currentUser?.email,
        version: '1.0.0',
        data: {
          settings: settingsRes.data || [],
          membership_types: typesRes.data || [],
          users: usersRes.data || []
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
      console.error('[Admin] Backup error:', err);
      showToast('فشل التصدير: ' + err.message, 'error');
    }
  }

  /* ============================================
     SETUP EVENT LISTENERS
     ============================================ */
  function setupListeners() {
    // Save settings
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);

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

    // Remove logo
    const removeBtn = document.getElementById('removeLogoBtn');
    if (removeBtn) removeBtn.addEventListener('click', removeLogo);

    // Theme preview
    const themeSelect = document.getElementById('defaultThemeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', previewThemeChange);
    }

    // Add user
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserModal(null));

    // Save user
    const saveUserBtn = document.getElementById('saveUserBtn');
    if (saveUserBtn) saveUserBtn.addEventListener('click', saveUser);

    // Add type
    const addTypeBtn = document.getElementById('addTypeBtn');
    if (addTypeBtn) addTypeBtn.addEventListener('click', () => openTypeModal(null));

    // Save type
    const saveTypeBtn = document.getElementById('saveTypeBtn');
    if (saveTypeBtn) saveTypeBtn.addEventListener('click', saveType);

    // Refresh audit
    const refreshAuditBtn = document.getElementById('refreshAuditBtn');
    if (refreshAuditBtn) {
      refreshAuditBtn.addEventListener('click', () => {
        auditLogs = [];
        loadAuditLog();
      });
    }

    // Export backup
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

    // Modals backdrop close + ESC
    ['userModal', 'typeModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'userModal') window.closeUserModal();
          else window.closeTypeModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeUserModal();
        window.closeTypeModal();
      }
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

      // Setup UI
      setupTabs();
      setupListeners();

      // Load settings
      await loadSettings();

      // Build theme select
      buildThemeSelect();

      // Setup realtime
      setupRealtime();

      // Pre-load users/types if their tab is active
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'types') loadMembershipTypes();
      if (activeTab === 'audit') loadAuditLog();

      console.log('[Admin] Ready.');
    });
  }

  // Expose for HTML inline events
  window.switchTab = switchTab;
  window.closeUserModal = window.closeUserModal || function () {};
  window.closeTypeModal = window.closeTypeModal || function () {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

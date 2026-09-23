/* =====================================================
   IT SYNDICATE — ADMIN LOGIC
   Version: 3.2.0
   Path: js/admin.js
   =====================================================
   يحتوي على:
   - Auth + Role check (head / vp / deputy)
   - Tab management (10 tabs)
   - Settings: تحميل + حفظ + شعار + صورة النقيب + backup
   - ⚡ About Card: شعار + عنوان + نص + toggle
   - Home: تحميل + حفظ إعدادات الرئيسية
   - ⚡ Features Cards: إضافة/تعديل/حذف/معاينة
   - Users: CRUD + فلاتر + تفعيل/تعطيل/رفض + تغيير باسورد
   - Governorates: CRUD
   - Committees: مجالس المحافظات
   - Types: CRUD أنواع العضوية
   - Branches: CRUD الشعب
   - Expense Categories: CRUD
   - Sessions: سجل النشاط + آخر الإجراءات
   - Audit: سجل التدقيق
   - Realtime على 6 جداول
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const BRANDING_BUCKET = 'branding';
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB
  const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'];
  const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const PAGE_SIZE = 50;

  const ROLE_LABELS = {
    head: 'النقيب العام',
    vice_president: 'نائب رئيس النقابة',
    deputy: 'الوكيل',
    committee: 'لجنة العضوية',
    governorate_head: 'نقيب محافظة',
    governorate_board: 'مجلس محافظة',
    branches_manager: 'مدير الفروع',
    social_committee_head: 'رئيس اللجنة الاجتماعية',
    social_committee_vice: 'نائب اللجنة الاجتماعية',
    public_relations_head: 'رئيس العلاقات العامة',
    public_relations_vice: 'نائب العلاقات العامة',
    committees_manager_head: 'مدير اللجان',
    committees_manager_vice: 'نائب مدير اللجان'
  };

  const COUNCIL_POSITIONS = [
    { key: 'head',              label: 'النقيب' },
    { key: 'vice1',             label: 'النائب الأول' },
    { key: 'vice2',             label: 'النائب الثاني' },
    { key: 'secretary',         label: 'الأمين العام' },
    { key: 'secretary_assist',  label: 'مساعد الأمين' },
    { key: 'treasurer',         label: 'أمين الصندوق' },
    { key: 'treasurer_assist',  label: 'مساعد أمين الصندوق' }
  ];

  const SIMPLE_POSITIONS = [
    { key: 'agent',    label: 'الوكيل' },
    { key: 'assist1',  label: 'مساعد أول' },
    { key: 'assist2',  label: 'مساعد ثاني' }
  ];

  /* ============================================
     ICONS LIBRARY
     ============================================ */
  const ICONS = {
    edit: '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    zap: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    code: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    users: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    star: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    award: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    trending: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    smartphone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    graduation: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
    activity: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let activeTab = 'settings';

  let settings = {};
  let users = [];
  let usersFilter = 'all';
  let governorates = [];
  let types = [];
  let branches = [];
  let expenseCategories = [];
  let sessions = [];
  let actions = [];
  let auditLogs = [];

  let editingUserId = null;
  let editingGovId = null;
  let editingTypeId = null;
  let editingBranchId = null;
  let editingExpCatId = null;
  let currentCommitteeGovId = null;

  // ⚡ Features
  let featuresCards = [];

  let unsubscribeRealtime = null;

  /* ============================================
     HELPERS
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return '—'; }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const m = Math.floor(diff / 60000);
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(diff / 86400000);
      if (m < 1) return 'الآن';
      if (m < 60) return `منذ ${m} دقيقة`;
      if (h < 24) return `منذ ${h} ساعة`;
      if (d < 30) return `منذ ${d} يوم`;
      return formatDate(dateStr);
    } catch (e) { return ''; }
  }

  function getInitials(name) {
    if (!name) return '؟';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 0) return '؟';
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + ' ' + parts[1].charAt(0);
  }

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  function roleLabel(r) { return ROLE_LABELS[r] || r || '—'; }

  function roleBadgeClass(r) {
    const map = {
      head: 'head',
      vice_president: 'vice_president',
      deputy: 'deputy',
      committee: 'committee',
      governorate_head: 'governorate_head',
      governorate_board: 'governorate_board',
      branches_manager: 'branches_manager',
      social_committee_head: 'social_committee_head',
      social_committee_vice: 'social_committee_vice',
      public_relations_head: 'public_relations_head',
      public_relations_vice: 'public_relations_vice',
      committees_manager_head: 'committees_manager_head',
      committees_manager_vice: 'committees_manager_vice'
    };
    return map[r] || 'committee';
  }

  function statusBadge(status) {
    const s = (status || '').toLowerCase();
    const map = {
      active:   { cls: 'active',   label: 'نشط' },
      pending:  { cls: 'pending',  label: 'بانتظار التفعيل' },
      rejected: { cls: 'rejected', label: 'مرفوض' },
      disabled: { cls: 'disabled', label: 'معطّل' }
    };
    const info = map[s] || { cls: 'disabled', label: status || '—' };
    return `<span class="status-badge ${info.cls}"><span class="dot"></span>${escapeHtml(info.label)}</span>`;
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
  }

  /* ============================================
     AUTH GUARD
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

      userRole = userData?.role || 'committee';
      const allowedRoles = ['head', 'vice_president', 'deputy'];

      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للنقيب العام ونوابه فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      window.currentUserRole = userRole;
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
     TABS
     ============================================ */
  function initTabs() {
    $$('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tabBtn));
    });
  }

  function switchTab(tab) {
    if (!tab) return;
    activeTab = tab;

    $$('[data-tab-btn]').forEach(b => {
      b.classList.toggle('active', b.dataset.tabBtn === tab);
    });

    $$('[data-tab-content]').forEach(c => {
      const show = c.dataset.tabContent === tab;
      c.style.display = show ? '' : 'none';
    });

    switch (tab) {
      case 'settings':            loadSettings(); break;
      case 'home':                loadSettings(); break;
      case 'users':               loadUsers(); break;
      case 'governorates':        loadGovernorates(); break;
      case 'committees':          loadCommitteeGovernorates(); break;
      case 'types':               loadTypes(); break;
      case 'branches':            loadBranches(); break;
      case 'expense-categories':  loadExpenseCategories(); break;
      case 'sessions':            loadSessions(); break;
      case 'audit':               loadAudit(); break;
    }
  }

  /* ============================================
     SETTINGS
     ============================================ */
  async function loadSettings() {
    try {
      const { data, error } = await client
        .from('settings')
        .select('key, value');
      if (error) throw error;

      const map = {};
      (data || []).forEach(r => {
        map[r.key] = r.value;
      });
      settings = map;

      // Fill data-setting inputs
      $$('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (!(key in map)) return;
        const val = map[key];

        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
          if (el.type === 'checkbox') {
            el.checked = val === true || val === 'true' || val === '1';
          } else {
            if (document.activeElement !== el) {
              el.value = (typeof val === 'object') ? JSON.stringify(val) : (val ?? '');
            }
          }
        } else {
          if (typeof val !== 'object') {
            const str = String(val ?? '');
            if (el.textContent.trim() !== str.trim()) {
              el.textContent = str;
            }
          }
        }
      });

      // ⚡ Logo preview
      const logoUrl = map.site_logo_url || map.logo_url;
      if (logoUrl) {
        const lp = $('#logoPreview');
        if (lp) {
          lp.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="logo" />`;
          lp.classList.add('has-logo');
        }
      }

      // ⚡ Head photo preview
      const headUrl = map.head_photo_url;
      if (headUrl) {
        const hp = $('#headPhotoPreview');
        if (hp) {
          hp.innerHTML = `<img src="${escapeHtml(headUrl)}" alt="head" />`;
          hp.classList.add('has-photo');
        }
      }

      // ⚡ About logo preview
      const aboutLogo = map.about_card_logo;
      if (aboutLogo) {
        const al = $('#aboutLogoPreview');
        if (al) {
          al.innerHTML = `<img src="${escapeHtml(aboutLogo)}" alt="" />`;
          al.classList.add('has-logo');
        }
      }

      // ⚡ Features cards
      loadFeaturesFromSettings();

    } catch (e) {
      console.error('loadSettings:', e);
      showToast('فشل تحميل الإعدادات', 'error');
    }
  }

  async function saveSettings() {
    try {
      const updates = [];

      $$('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (!key) return;

        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'number') val = el.value === '' ? null : Number(el.value);
        else val = el.value;

        updates.push({ key, value: val });
      });

      // ⚡ Features cards JSON — احفظها دايمًا
      updates.push({ key: 'features_cards', value: featuresCards });

      if (!updates.length) {
        showToast('لا يوجد تغييرات', 'info');
        return;
      }

      const { error } = await client
        .from('settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;

      // Update local cache
      updates.forEach(u => { settings[u.key] = u.value; });

      // Cache in localStorage
      try {
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
      } catch (e) {}

      showToast('تم حفظ الإعدادات بنجاح', 'success');

      // Broadcast to other tabs
      if (window.Realtime) {
        window.Realtime.sendBroadcast('settings-updated', {});
      }

    } catch (e) {
      console.error('saveSettings:', e);
      showToast('فشل حفظ الإعدادات: ' + (e.message || ''), 'error');
    }
  }

  function initSettingsTab() {
    const saveBtn = $('#saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);

    const saveHomeBtn = $('#saveHomeBtn');
    if (saveHomeBtn) saveHomeBtn.addEventListener('click', saveSettings);

    // Logo upload
    setupImageUpload({
      btnId: 'uploadLogoBtn',
      inputId: 'logoFileInput',
      removeId: 'removeLogoBtn',
      settingKey: 'site_logo_url',
      previewId: 'logoPreview',
      previewClass: 'has-logo',
      allowedTypes: ALLOWED_LOGO_TYPES,
      label: 'الشعار'
    });

    // Head photo upload
    setupImageUpload({
      btnId: 'uploadHeadPhotoBtn',
      inputId: 'headPhotoInput',
      removeId: 'removeHeadPhotoBtn',
      settingKey: 'head_photo_url',
      previewId: 'headPhotoPreview',
      previewClass: 'has-photo',
      allowedTypes: ALLOWED_PHOTO_TYPES,
      label: 'صورة النقيب'
    });

    // ⚡ About logo upload
    setupImageUpload({
      btnId: 'uploadAboutLogoBtn',
      inputId: 'aboutLogoFileInput',
      removeId: 'removeAboutLogoBtn',
      settingKey: 'about_card_logo',
      previewId: 'aboutLogoPreview',
      previewClass: 'has-logo',
      allowedTypes: ALLOWED_LOGO_TYPES,
      label: 'شعار قسم "عن النقابة"'
    });

    // Backup
    const backupBtn = $('#backupBtn');
    if (backupBtn) backupBtn.addEventListener('click', exportBackup);

    // ⚡ Feature buttons
    const addFeatureBtn = $('#addFeatureBtn');
    if (addFeatureBtn) addFeatureBtn.addEventListener('click', () => openFeatureModal(null));

    const saveFeatureBtn = $('#saveFeatureBtn');
    if (saveFeatureBtn) saveFeatureBtn.addEventListener('click', saveFeature);
  }

  function setupImageUpload(config) {
    const btn = document.getElementById(config.btnId);
    const input = document.getElementById(config.inputId);
    const removeBtn = document.getElementById(config.removeId);

    if (btn && input) {
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) await uploadBrandingImage(file, config);
        input.value = '';
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => removeBrandingImage(config));
    }
  }

  async function uploadBrandingImage(file, config) {
    try {
      if (file.size > MAX_IMAGE_SIZE) {
        showToast(`حجم الملف كبير — الحد الأقصى 2 ميجا`, 'error');
        return;
      }
      if (!config.allowedTypes.includes(file.type)) {
        showToast('صيغة غير مدعومة', 'error');
        return;
      }

      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${config.settingKey}_${Date.now()}.${ext}`;

      const { error: upErr } = await client.storage
        .from(BRANDING_BUCKET)
        .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = client.storage.from(BRANDING_BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: sErr } = await client
        .from('settings')
        .upsert({ key: config.settingKey, value: url }, { onConflict: 'key' });
      if (sErr) throw sErr;

      settings[config.settingKey] = url;

      const el = document.getElementById(config.previewId);
      if (el) {
        el.innerHTML = `<img src="${escapeHtml(url)}" alt="" />`;
        el.classList.add(config.previewClass);
      }

      try {
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
      } catch (e) {}

      showToast(`تم رفع ${config.label} بنجاح`, 'success');

      if (window.Realtime) {
        window.Realtime.sendBroadcast('settings-updated', {});
      }

    } catch (e) {
      console.error('uploadBrandingImage:', e);
      showToast('فشل الرفع: ' + e.message, 'error');
    }
  }

  async function removeBrandingImage(config) {
    if (!confirm(`متأكد من إزالة ${config.label}؟`)) return;

    try {
      const { error } = await client
        .from('settings')
        .upsert({ key: config.settingKey, value: '' }, { onConflict: 'key' });
      if (error) throw error;

      settings[config.settingKey] = '';

      const el = document.getElementById(config.previewId);
      if (el) {
        el.innerHTML = '';
        el.classList.remove(config.previewClass);
      }

      try {
        localStorage.setItem('its_site_settings', JSON.stringify(settings));
      } catch (e) {}

      showToast('تم الحذف', 'success');

      if (window.Realtime) {
        window.Realtime.sendBroadcast('settings-updated', {});
      }

    } catch (e) {
      console.error('removeBrandingImage:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     ⚡ FEATURES CARDS
     ============================================ */
  function loadFeaturesFromSettings() {
    try {
      const raw = settings.features_cards;
      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) {
          featuresCards = parsed;
        } else {
          featuresCards = [];
        }
      } else {
        featuresCards = [];
      }
    } catch (e) {
      console.error('[Admin] loadFeaturesFromSettings error:', e);
      featuresCards = [];
    }
    renderFeaturesPreview();
  }

  function getIconByName(name) {
    return ICONS[name] || ICONS.check;
  }

  function renderFeaturesPreview() {
    const list = document.getElementById('featuresPreviewList');
    if (!list) return;

    if (!featuresCards.length) {
      list.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا توجد كروت بعد. اضغط "إضافة كارت" لإضافة أول كارت.</div>';
      return;
    }

    list.innerHTML = featuresCards.map((c, idx) => {
      const iconHTML = c.logo
        ? `<img src="${escapeHtml(c.logo)}" alt="" />`
        : getIconByName(c.icon);

      return `
        <div class="feature-preview-card">
          <div class="feature-preview-icon">${iconHTML}</div>
          <div class="feature-preview-info">
            <div class="feature-preview-title">${escapeHtml(c.title || 'بدون عنوان')}</div>
            <div class="feature-preview-text">${escapeHtml(c.text || '')}</div>
          </div>
          <div class="feature-preview-actions">
            <button type="button" class="feature-action-btn edit" data-action="edit-feature" data-idx="${idx}" title="تعديل">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button type="button" class="feature-action-btn delete" data-action="delete-feature" data-idx="${idx}" title="حذف">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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

  function openFeatureModal(index = null) {
    const modal = document.getElementById('featureModal');
    if (!modal) return;

    const isEdit = index !== null && index !== undefined && index >= 0;
    const feature = isEdit ? featuresCards[index] : null;

    const titleEl = document.getElementById('featureModalTitle');
    if (titleEl) titleEl.textContent = isEdit ? 'تعديل كارت' : 'إضافة كارت';

    const indexInput = document.getElementById('featureIndex');
    if (indexInput) indexInput.value = isEdit ? index : '';

    const titleInput = document.getElementById('featureTitle');
    if (titleInput) titleInput.value = isEdit ? (feature.title || '') : '';

    const textInput = document.getElementById('featureText');
    if (textInput) textInput.value = isEdit ? (feature.text || '') : '';

    const logoInput = document.getElementById('featureLogo');
    if (logoInput) logoInput.value = isEdit ? (feature.logo || '') : '';

    const iconInput = document.getElementById('featureIcon');
    if (iconInput) iconInput.value = isEdit ? (feature.icon || 'zap') : 'zap';

    buildIconPicker();

    openModal('featureModal');
  }

  window.openFeatureModal = openFeatureModal;

  function buildIconPicker() {
    const picker = document.getElementById('iconPicker');
    const iconInput = document.getElementById('featureIcon');
    if (!picker || !iconInput) return;

    const icons = ['zap', 'shield', 'eye', 'clock', 'code', 'users', 'star', 'heart', 'award', 'trending', 'smartphone', 'briefcase', 'graduation', 'activity', 'check'];
    const current = iconInput.value || 'zap';

    picker.innerHTML = icons.map(name => `
      <div class="icon-option ${name === current ? 'active' : ''}" data-icon="${name}" title="${name}">
        ${getIconByName(name)}
      </div>
    `).join('');

    picker.querySelectorAll('.icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        iconInput.value = opt.dataset.icon;
        picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  window.closeFeatureModal = function () {
    closeModal('featureModal');
  };

  function saveFeature() {
    const index = document.getElementById('featureIndex')?.value;
    const title = document.getElementById('featureTitle')?.value.trim();
    const text = document.getElementById('featureText')?.value.trim();
    const icon = document.getElementById('featureIcon')?.value || 'zap';
    const logo = document.getElementById('featureLogo')?.value.trim();

    if (!title) {
      showToast('العنوان مطلوب', 'warning');
      return;
    }

    const card = {
      icon,
      title,
      text: text || ''
    };

    if (logo) card.logo = logo;

    if (index !== '' && index !== null && index !== undefined) {
      featuresCards[parseInt(index)] = card;
    } else {
      featuresCards.push(card);
    }

    renderFeaturesPreview();
    closeModal('featureModal');
    showToast('تم الحفظ — لا تنسَ الضغط على "حفظ إعدادات الرئيسية"', 'info');
  }

  window.saveFeature = saveFeature;

  function deleteFeature(index) {
    if (!confirm('هل أنت متأكد من حذف هذا الكارت؟')) return;
    featuresCards.splice(index, 1);
    renderFeaturesPreview();
    showToast('تم الحذف — لا تنسَ الحفظ', 'info');
  }

  /* ============================================
     USERS
     ============================================ */
  async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await client
        .from('users')
        .select('id, full_name, email, phone, role, position, governorate_id, is_active, registration_source, last_login_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      users = data || [];
      renderUsers();

      const counts = {
        all: users.length,
        active: users.filter(u => u.is_active !== false).length,
        pending: users.filter(u => u.is_active === false).length,
        rejected: 0
      };
      const cAll = document.getElementById('countAllUsers'); if (cAll) cAll.textContent = counts.all;
      const cAct = document.getElementById('countActiveUsers'); if (cAct) cAct.textContent = counts.active;
      const cPnd = document.getElementById('countPendingUsers'); if (cPnd) cPnd.textContent = counts.pending;
      const cRej = document.getElementById('countRejectedUsers'); if (cRej) cRej.textContent = counts.rejected;
    } catch (e) {
      console.error('loadUsers:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    let list = users;
    if (usersFilter === 'active') list = list.filter(u => u.is_active !== false);
    else if (usersFilter === 'pending') list = list.filter(u => u.is_active === false);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد مستخدمون في هذه الفئة</td></tr>`;
      return;
    }

    const govMap = {};
    governorates.forEach(g => { govMap[g.id] = g.name; });

    tbody.innerHTML = list.map(u => {
      const isMe = u.id === currentUser.id;
      const isActive = u.is_active !== false;
      const isPending = u.is_active === false;
      const sourceLabel = u.registration_source === 'self_signup' ? 'تسجيل ذاتي'
                        : u.registration_source === 'admin' ? 'إضافة النقيب'
                        : (u.registration_source || '—');

      let statusBadgeHTML = '';
      if (isPending) {
        statusBadgeHTML = '<span class="status-badge pending"><span class="dot"></span>بانتظار التفعيل</span>';
      } else {
        statusBadgeHTML = '<span class="status-badge active"><span class="dot"></span>نشط</span>';
      }

      let actionsHTML = '';

      actionsHTML += `<button type="button" class="row-btn edit-btn" data-action="edit-user" data-id="${u.id}" title="تعديل">${ICONS.edit}</button>`;

      if (!isMe) {
        if (isActive) {
          actionsHTML += `<button type="button" class="row-btn" data-action="deactivate-user" data-id="${u.id}" title="تعطيل" style="background:rgba(var(--warning-rgb),0.08);border:1px solid rgba(var(--warning-rgb),0.25);color:var(--warning);">
            <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>`;
        } else if (isPending) {
          actionsHTML += `<button type="button" class="row-btn" data-action="activate-user" data-id="${u.id}" title="تفعيل" style="background:rgba(var(--success-rgb),0.08);border:1px solid rgba(var(--success-rgb),0.25);color:var(--success);">${ICONS.check}</button>`;
          actionsHTML += `<button type="button" class="row-btn" data-action="reject-user" data-id="${u.id}" title="رفض" style="background:rgba(var(--danger-rgb),0.08);border:1px solid rgba(var(--danger-rgb),0.25);color:var(--danger);">${ICONS.x}</button>`;
        }
      }

      actionsHTML += `<button type="button" class="row-btn delete-btn" data-action="delete-user" data-id="${u.id}" title="حذف" ${isMe ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>${ICONS.trash}</button>`;

      return `
        <tr style="border-bottom:1px solid var(--border-soft);${isPending ? 'background:rgba(var(--warning-rgb),0.03);' : ''}">
          <td style="padding:14px 12px;">
            <div style="font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(u.full_name || '—')}</div>
            ${u.phone ? `<div style="font-size:11.5px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;margin-top:2px;">${escapeHtml(u.phone)}</div>` : ''}
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(u.email || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="role-badge ${roleBadgeClass(u.role)}"><span class="dot"></span>${escapeHtml(roleLabel(u.role))}</span>
          </td>
          <td style="padding:14px 12px;font-size:11.5px;color:var(--text-dim);">
            <span style="display:inline-block;padding:3px 9px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:10.5px;">${escapeHtml(sourceLabel)}</span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-dim);">${escapeHtml(formatDate(u.last_login_at))}</td>
          <td style="padding:14px 12px;">${statusBadgeHTML}</td>
          <td style="padding:14px 12px;">
            <div class="row-actions">${actionsHTML}</div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-action="edit-user"]').forEach(b => {
      b.addEventListener('click', () => openUserModal(b.dataset.id));
    });
    tbody.querySelectorAll('[data-action="delete-user"]').forEach(b => {
      if (b.disabled) return;
      b.addEventListener('click', () => deleteUser(b.dataset.id));
    });
    tbody.querySelectorAll('[data-action="activate-user"]').forEach(b => {
      b.addEventListener('click', () => activateUser(b.dataset.id));
    });
    tbody.querySelectorAll('[data-action="deactivate-user"]').forEach(b => {
      b.addEventListener('click', () => deactivateUser(b.dataset.id));
    });
    tbody.querySelectorAll('[data-action="reject-user"]').forEach(b => {
      b.addEventListener('click', () => rejectUser(b.dataset.id));
    });
  }

  function initUsersTab() {
    $$('[data-users-filter]').forEach(b => {
      b.addEventListener('click', () => {
        usersFilter = b.dataset.usersFilter;
        $$('[data-users-filter]').forEach(x => x.classList.toggle('active', x === b));
        renderUsers();
      });
    });

    const addBtn = $('#addUserBtn');
    if (addBtn) addBtn.addEventListener('click', () => openUserModal());

    const saveBtn = $('#saveUserBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveUser);

    const roleSelect = $('#userRole');
    if (roleSelect) {
      roleSelect.addEventListener('change', () => {
        const r = roleSelect.value;
        const needsGov = r === 'governorate_head' || r === 'governorate_board';
        const field = $('#userGovernorateField');
        if (field) field.style.display = needsGov ? '' : 'none';
      });
    }
  }

  async function openUserModal(id = null) {
    editingUserId = id;
    const title = $('#userModalTitle');

    await ensureGovernoratesLoaded();
    const govSel = $('#userGovernorate');
    if (govSel) {
      govSel.innerHTML = '<option value="">-- اختر المحافظة --</option>' +
        governorates.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    }

    if (id) {
      const u = users.find(x => x.id === id);
      if (!u) return;
      if (title) title.textContent = 'تعديل مستخدم';
      $('#userId').value = u.id;
      $('#userFullName').value = u.full_name || '';
      $('#userEmail').value = u.email || '';
      $('#userPhone').value = u.phone || '';
      $('#userRole').value = u.role || '';
      $('#userPosition').value = u.position || '';
      $('#userGovernorate').value = u.governorate_id || '';
      $('#userNotes').value = u.notes || '';
      const passField = $('#passwordField');
      if (passField) passField.style.display = 'none';

      const needsGov = u.role === 'governorate_head' || u.role === 'governorate_board';
      const govField = $('#userGovernorateField');
      if (govField) govField.style.display = needsGov ? '' : 'none';
    } else {
      if (title) title.textContent = 'إضافة مستخدم جديد';
      $('#userId').value = '';
      $('#userFullName').value = '';
      $('#userEmail').value = '';
      $('#userPhone').value = '';
      $('#userRole').value = '';
      $('#userPosition').value = '';
      $('#userGovernorate').value = '';
      $('#userNotes').value = '';
      $('#userPassword').value = '';
      const passField = $('#passwordField');
      if (passField) passField.style.display = '';
      const govField = $('#userGovernorateField');
      if (govField) govField.style.display = 'none';
    }

    openModal('userModal');
  }

  window.openUserModal = openUserModal;
  window.closeUserModal = function () { closeModal('userModal'); };

  async function saveUser() {
    const id = $('#userId').value;
    const full_name = $('#userFullName').value.trim();
    const email = $('#userEmail').value.trim();
    const phone = $('#userPhone').value.trim();
    const role = $('#userRole').value;
    const position = $('#userPosition').value.trim();
    const governorate_id = $('#userGovernorate').value || null;
    const notes = $('#userNotes').value.trim();
    const password = $('#userPassword')?.value || '';

    if (!full_name || !email || !role) {
      showToast('املأ الحقول الإلزامية', 'error');
      return;
    }

    const needsGov = role === 'governorate_head' || role === 'governorate_board';
    if (needsGov && !governorate_id) {
      showToast('اختر المحافظة', 'error');
      return;
    }

    try {
      if (id) {
        const { error } = await client.from('users').update({
          full_name, email, phone, role, position,
          governorate_id: governorate_id ? parseInt(governorate_id) : null,
          notes
        }).eq('id', id);
        if (error) throw error;
        showToast('تم التحديث', 'success');
      } else {
        if (!password || password.length < 6) {
          showToast('كلمة المرور 6 أحرف على الأقل', 'error');
          return;
        }

        const tempClient = window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_KEY,
          { auth: { persistSession: false } }
        );

        const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
          email, password,
          options: { data: { full_name } }
        });

        if (signUpErr) throw signUpErr;

        const newUserId = signUpData?.user?.id;
        if (!newUserId) throw new Error('فشل إنشاء المستخدم');

        const { error } = await client.from('users').upsert({
          id: newUserId,
          full_name, email, phone, role, position,
          governorate_id: governorate_id ? parseInt(governorate_id) : null,
          notes, is_active: true,
          registration_source: 'admin'
        }, { onConflict: 'id' });

        if (error) throw error;
        showToast('تم إضافة المستخدم', 'success');
      }

      closeModal('userModal');
      await loadUsers();
    } catch (e) {
      console.error('saveUser:', e);
      showToast(e.message || 'فشل الحفظ', 'error');
    }
  }

  async function deleteUser(id) {
    if (!confirm('متأكد من حذف المستخدم؟')) return;
    try {
      const { error } = await client.from('users').delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف', 'success');
      await loadUsers();
    } catch (e) {
      console.error('deleteUser:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  async function activateUser(id) {
    if (!confirm('تفعيل هذا المستخدم؟')) return;
    try {
      const { error } = await client.from('users').update({
        is_active: true,
        activated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      showToast('تم التفعيل', 'success');
      await loadUsers();
    } catch (e) {
      showToast('فشل التفعيل: ' + e.message, 'error');
    }
  }

  async function deactivateUser(id) {
    if (!confirm('تعطيل هذا المستخدم؟')) return;
    try {
      const { error } = await client.from('users').update({
        is_active: false,
        deactivated_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      showToast('تم التعطيل', 'success');
      await loadUsers();
    } catch (e) {
      showToast('فشل التعطيل: ' + e.message, 'error');
    }
  }

  async function rejectUser(id) {
    if (!confirm('رفض هذا المستخدم؟')) return;
    try {
      const { error } = await client.from('users').update({
        is_active: false,
        rejected_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      showToast('تم الرفض', 'success');
      await loadUsers();
    } catch (e) {
      showToast('فشل الرفض: ' + e.message, 'error');
    }
  }

  /* ============================================
     GOVERNORATES
     ============================================ */
  async function ensureGovernoratesLoaded() {
    if (governorates.length) return governorates;
    const { data, error } = await client
      .from('governorates')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    governorates = data || [];
    return governorates;
  }

  async function loadGovernorates() {
    const tbody = document.getElementById('govTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      await ensureGovernoratesLoaded();
      renderGovernorates();
    } catch (e) {
      console.error('loadGovernorates:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderGovernorates() {
    const tbody = document.getElementById('govTableBody');
    if (!tbody) return;
    if (!governorates.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد محافظات</td></tr>`;
      return;
    }
    tbody.innerHTML = governorates.map(g => `
      <tr>
        <td dir="ltr" style="text-align:right;">${escapeHtml(g.code || '—')}</td>
        <td>${escapeHtml(g.name || '—')}</td>
        <td>${g.structure_type === 'council' ? 'مجلس كامل' : 'وكيل + مساعدين'}</td>
        <td>${escapeHtml(g.sort_order ?? '—')}</td>
        <td>${statusBadge(g.is_active !== false ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="row-btn edit-btn" data-edit-gov="${g.id}">${ICONS.edit}</button>
            <button type="button" class="row-btn delete-btn" data-del-gov="${g.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-gov]').forEach(b => b.addEventListener('click', () => openGovModal(b.dataset.editGov)));
    tbody.querySelectorAll('[data-del-gov]').forEach(b => b.addEventListener('click', () => deleteGov(b.dataset.delGov)));
  }

  function initGovernoratesTab() {
    const addBtn = $('#addGovBtn');
    if (addBtn) addBtn.addEventListener('click', () => openGovModal());
    const saveBtn = $('#saveGovBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveGov);
  }

  function openGovModal(id = null) {
    editingGovId = id;
    const title = $('#govModalTitle');
    if (id) {
      const g = governorates.find(x => String(x.id) === String(id));
      if (!g) return;
      if (title) title.textContent = 'تعديل محافظة';
      $('#govId').value = g.id;
      $('#govName').value = g.name || '';
      $('#govCode').value = g.code || '';
      $('#govStructureType').value = g.structure_type || 'council';
      $('#govSortOrder').value = g.sort_order ?? 0;
      $('#govActive').checked = g.is_active !== false;
    } else {
      if (title) title.textContent = 'إضافة محافظة';
      $('#govId').value = '';
      $('#govName').value = '';
      $('#govCode').value = '';
      $('#govStructureType').value = 'council';
      $('#govSortOrder').value = 0;
      $('#govActive').checked = true;
    }
    openModal('govModal');
  }

  window.openGovModal = openGovModal;
  window.closeGovModal = function () { closeModal('govModal'); };

  async function saveGov() {
    const id = $('#govId').value;
    const payload = {
      name: $('#govName').value.trim(),
      code: $('#govCode').value.trim().toUpperCase() || null,
      structure_type: $('#govStructureType').value,
      sort_order: Number($('#govSortOrder').value) || 0,
      is_active: $('#govActive').checked
    };
    if (!payload.name) { showToast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await client.from('governorates').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await client.from('governorates').insert(payload);
        if (error) throw error;
      }
      showToast('تم الحفظ', 'success');
      closeModal('govModal');
      governorates = [];
      await loadGovernorates();
    } catch (e) {
      console.error('saveGov:', e);
      showToast('فشل الحفظ', 'error');
    }
  }

  async function deleteGov(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await client.from('governorates').delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف', 'success');
      governorates = [];
      await loadGovernorates();
    } catch (e) {
      console.error('deleteGov:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     COMMITTEES
     ============================================ */
  async function loadCommitteeGovernorates() {
    await ensureGovernoratesLoaded();
    const sel = $('#committeeGovSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر المحافظة --</option>' +
      governorates.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

    sel.onchange = () => loadCommitteePositions(sel.value);
  }

  async function loadCommitteePositions(govId) {
    const container = $('#committeePositionsContainer');
    if (!container) return;
    if (!govId) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);">اختر محافظة لعرض مجلسها</div>`;
      return;
    }
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</div>`;

    try {
      const gov = governorates.find(g => String(g.id) === String(govId));
      const positions = gov?.structure_type === 'simple' ? SIMPLE_POSITIONS : COUNCIL_POSITIONS;

      const { data, error } = await client
        .from('governorate_committees')
        .select('*')
        .eq('governorate_id', govId);
      if (error) throw error;

      const byPos = {};
      (data || []).forEach(r => { byPos[r.position] = r; });

      container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">` +
        positions.map(p => {
          const m = byPos[p.key];
          return `
            <div style="padding:16px;background:rgba(0,0,0,0.25);border:1px solid var(--border-soft);border-radius:var(--radius-md);">
              <div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">${escapeHtml(p.label)}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${escapeHtml(m?.full_name || '— شاغر —')}</div>
              <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;">${escapeHtml(m?.phone || '')}</div>
              <button type="button" class="btn btn-outline btn-sm" data-pos-btn="${p.key}" data-pos-label="${escapeHtml(p.label)}">
                ${m ? 'تعديل' : 'تعيين'}
              </button>
            </div>
          `;
        }).join('') + `</div>`;

      container.querySelectorAll('[data-pos-btn]').forEach(b => {
        b.addEventListener('click', () => openPositionModal(govId, b.dataset.posBtn, b.dataset.posLabel));
      });
    } catch (e) {
      console.error('loadCommitteePositions:', e);
      container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</div>`;
    }
  }

  function openPositionModal(govId, posKey, posLabel) {
    $('#posGovernorateId').value = govId;
    $('#posPosition').value = posKey;
    $('#posPositionLabel').value = posLabel;
    $('#posFullName').value = '';
    $('#posNationalId').value = '';
    $('#posPhone').value = '';
    $('#posEmail').value = '';
    $('#posNotes').value = '';
    openModal('positionModal');
  }

  window.closePositionModal = function () { closeModal('positionModal'); };

  async function savePosition() {
    const govId = $('#posGovernorateId').value;
    const position = $('#posPosition').value;
    const full_name = $('#posFullName').value.trim();
    if (!full_name) { showToast('الاسم مطلوب', 'error'); return; }

    const payload = {
      governorate_id: govId,
      position,
      full_name,
      national_id: $('#posNationalId').value.trim() || null,
      phone: $('#posPhone').value.trim() || null,
      email: $('#posEmail').value.trim() || null,
      notes: $('#posNotes').value.trim() || null
    };

    try {
      const { data: existing } = await client
        .from('governorate_committees')
        .select('id')
        .eq('governorate_id', govId)
        .eq('position', position)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await client.from('governorate_committees').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('governorate_committees').insert(payload);
        if (error) throw error;
      }
      showToast('تم الحفظ', 'success');
      closeModal('positionModal');
      loadCommitteePositions(govId);
    } catch (e) {
      console.error('savePosition:', e);
      showToast('فشل الحفظ', 'error');
    }
  }

  function initCommitteesTab() {
    const saveBtn = $('#savePositionBtn');
    if (saveBtn) saveBtn.addEventListener('click', savePosition);
  }

  /* ============================================
     TYPES
     ============================================ */
  async function loadTypes() {
    const tbody = document.getElementById('typesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await client
        .from('membership_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      types = data || [];
      renderTypes();
    } catch (e) {
      console.error('loadTypes:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderTypes() {
    const tbody = document.getElementById('typesTableBody');
    if (!tbody) return;
    if (!types.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد أنواع</td></tr>`;
      return;
    }
    tbody.innerHTML = types.map(t => `
      <tr>
        <td dir="ltr" style="text-align:right;">${escapeHtml(t.code || '—')}</td>
        <td>${escapeHtml(t.name || '—')}</td>
        <td>${escapeHtml(t.description || '—')}</td>
        <td>${escapeHtml(t.fee ?? '—')} ج.م</td>
        <td>${escapeHtml(t.duration_months ?? '—')} شهر</td>
        <td>${statusBadge(t.is_active !== false ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="row-btn edit-btn" data-edit-type="${t.id}">${ICONS.edit}</button>
            <button type="button" class="row-btn delete-btn" data-del-type="${t.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-type]').forEach(b => b.addEventListener('click', () => openTypeModal(b.dataset.editType)));
    tbody.querySelectorAll('[data-del-type]').forEach(b => b.addEventListener('click', () => deleteType(b.dataset.delType)));
  }

  function initTypesTab() {
    const addBtn = $('#addTypeBtn');
    if (addBtn) addBtn.addEventListener('click', () => openTypeModal());
    const saveBtn = $('#saveTypeBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveType);
  }

  function openTypeModal(id = null) {
    editingTypeId = id;
    const title = $('#typeModalTitle');
    if (id) {
      const t = types.find(x => String(x.id) === String(id));
      if (!t) return;
      if (title) title.textContent = 'تعديل نوع';
      $('#typeId').value = t.id;
      $('#typeName').value = t.name || '';
      $('#typeCode').value = t.code || '';
      $('#typeDesc').value = t.description || '';
      $('#typeFee').value = t.fee ?? '';
      $('#typeDuration').value = t.duration_months ?? '';
      $('#typeSortOrder').value = t.sort_order ?? 0;
      $('#typeActive').checked = t.is_active !== false;
    } else {
      if (title) title.textContent = 'إضافة نوع عضوية';
      $('#typeId').value = '';
      $('#typeName').value = '';
      $('#typeCode').value = '';
      $('#typeDesc').value = '';
      $('#typeFee').value = '';
      $('#typeDuration').value = '';
      $('#typeSortOrder').value = 0;
      $('#typeActive').checked = true;
    }
    openModal('typeModal');
  }

  window.openTypeModal = openTypeModal;
  window.closeTypeModal = function () { closeModal('typeModal'); };

  async function saveType() {
    const id = $('#typeId').value;
    const payload = {
      name: $('#typeName').value.trim(),
      code: $('#typeCode').value.trim().toUpperCase() || null,
      description: $('#typeDesc').value.trim() || null,
      fee: Number($('#typeFee').value) || 0,
      duration_months: Number($('#typeDuration').value) || 12,
      sort_order: Number($('#typeSortOrder').value) || 0,
      is_active: $('#typeActive').checked
    };
    if (!payload.name) { showToast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await client.from('membership_types').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await client.from('membership_types').insert(payload);
        if (error) throw error;
      }
      showToast('تم الحفظ', 'success');
      closeModal('typeModal');
      await loadTypes();
    } catch (e) {
      console.error('saveType:', e);
      showToast('فشل الحفظ: ' + e.message, 'error');
    }
  }

  async function deleteType(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await client.from('membership_types').delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف', 'success');
      await loadTypes();
    } catch (e) {
      console.error('deleteType:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     BRANCHES
     ============================================ */
  async function loadBranches() {
    const tbody = document.getElementById('branchesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await client
        .from('branches')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      branches = data || [];
      renderBranches();
    } catch (e) {
      console.error('loadBranches:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderBranches() {
    const tbody = document.getElementById('branchesTableBody');
    if (!tbody) return;
    if (!branches.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد شعب</td></tr>`;
      return;
    }
    tbody.innerHTML = branches.map(b => `
      <tr>
        <td dir="ltr" style="text-align:right;">${escapeHtml(b.code || '—')}</td>
        <td>${escapeHtml(b.name || '—')}</td>
        <td>${escapeHtml(b.description || '—')}</td>
        <td>${escapeHtml(b.sort_order ?? '—')}</td>
        <td>${statusBadge(b.is_active !== false ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="row-btn edit-btn" data-edit-branch="${b.id}">${ICONS.edit}</button>
            <button type="button" class="row-btn delete-btn" data-del-branch="${b.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-branch]').forEach(b => b.addEventListener('click', () => openBranchModal(b.dataset.editBranch)));
    tbody.querySelectorAll('[data-del-branch]').forEach(b => b.addEventListener('click', () => deleteBranch(b.dataset.delBranch)));
  }

  function initBranchesTab() {
    const addBtn = $('#addBranchBtn');
    if (addBtn) addBtn.addEventListener('click', () => openBranchModal());
    const saveBtn = $('#saveBranchBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveBranch);
  }

  function openBranchModal(id = null) {
    editingBranchId = id;
    const title = $('#branchModalTitle');
    if (id) {
      const b = branches.find(x => String(x.id) === String(id));
      if (!b) return;
      if (title) title.textContent = 'تعديل شعبة';
      $('#branchId').value = b.id;
      $('#branchName').value = b.name || '';
      $('#branchCode').value = b.code || '';
      $('#branchDesc').value = b.description || '';
      $('#branchSortOrder').value = b.sort_order ?? 0;
      $('#branchActive').checked = b.is_active !== false;
    } else {
      if (title) title.textContent = 'إضافة شعبة';
      $('#branchId').value = '';
      $('#branchName').value = '';
      $('#branchCode').value = '';
      $('#branchDesc').value = '';
      $('#branchSortOrder').value = 0;
      $('#branchActive').checked = true;
    }
    openModal('branchModal');
  }

  window.openBranchModal = openBranchModal;
  window.closeBranchModal = function () { closeModal('branchModal'); };

  async function saveBranch() {
    const id = $('#branchId').value;
    const payload = {
      name: $('#branchName').value.trim(),
      code: $('#branchCode').value.trim().toUpperCase() || null,
      description: $('#branchDesc').value.trim() || null,
      sort_order: Number($('#branchSortOrder').value) || 0,
      is_active: $('#branchActive').checked
    };
    if (!payload.name) { showToast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await client.from('branches').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await client.from('branches').insert(payload);
        if (error) throw error;
      }
      showToast('تم الحفظ', 'success');
      closeModal('branchModal');
      await loadBranches();
    } catch (e) {
      console.error('saveBranch:', e);
      showToast('فشل الحفظ: ' + e.message, 'error');
    }
  }

  async function deleteBranch(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await client.from('branches').delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف', 'success');
      await loadBranches();
    } catch (e) {
      console.error('deleteBranch:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     EXPENSE CATEGORIES
     ============================================ */
  async function loadExpenseCategories() {
    const tbody = document.getElementById('expCatTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await client
        .from('expense_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      expenseCategories = data || [];
      renderExpenseCategories();
    } catch (e) {
      console.error('loadExpenseCategories:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderExpenseCategories() {
    const tbody = document.getElementById('expCatTableBody');
    if (!tbody) return;
    if (!expenseCategories.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد تصنيفات</td></tr>`;
      return;
    }
    tbody.innerHTML = expenseCategories.map(c => `
      <tr>
        <td dir="ltr" style="text-align:right;">${escapeHtml(c.code || '—')}</td>
        <td>${escapeHtml(c.name || '—')}</td>
        <td>${escapeHtml(c.description || '—')}</td>
        <td>${escapeHtml(c.sort_order ?? '—')}</td>
        <td>${statusBadge(c.is_active !== false ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="row-btn edit-btn" data-edit-expcat="${c.id}">${ICONS.edit}</button>
            <button type="button" class="row-btn delete-btn" data-del-expcat="${c.id}">${ICONS.trash}</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit-expcat]').forEach(b => b.addEventListener('click', () => openExpCatModal(b.dataset.editExpcat)));
    tbody.querySelectorAll('[data-del-expcat]').forEach(b => b.addEventListener('click', () => deleteExpCat(b.dataset.delExpcat)));
  }

  function initExpenseCategoriesTab() {
    const addBtn = $('#addExpCatBtn');
    if (addBtn) addBtn.addEventListener('click', () => openExpCatModal());
    const saveBtn = $('#saveExpCatBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveExpCat);
  }

  function openExpCatModal(id = null) {
    editingExpCatId = id;
    const title = $('#expCatModalTitle');
    if (id) {
      const c = expenseCategories.find(x => String(x.id) === String(id));
      if (!c) return;
      if (title) title.textContent = 'تعديل تصنيف';
      $('#expCatId').value = c.id;
      $('#expCatName').value = c.name || '';
      $('#expCatCode').value = c.code || '';
      $('#expCatDesc').value = c.description || '';
      $('#expCatSortOrder').value = c.sort_order ?? 0;
      $('#expCatActive').checked = c.is_active !== false;
    } else {
      if (title) title.textContent = 'إضافة تصنيف مصروفات';
      $('#expCatId').value = '';
      $('#expCatName').value = '';
      $('#expCatCode').value = '';
      $('#expCatDesc').value = '';
      $('#expCatSortOrder').value = 0;
      $('#expCatActive').checked = true;
    }
    openModal('expCatModal');
  }

  window.openExpCatModal = openExpCatModal;
  window.closeExpCatModal = function () { closeModal('expCatModal'); };

  async function saveExpCat() {
    const id = $('#expCatId').value;
    const payload = {
      name: $('#expCatName').value.trim(),
      code: $('#expCatCode').value.trim().toUpperCase() || null,
      description: $('#expCatDesc').value.trim() || null,
      sort_order: Number($('#expCatSortOrder').value) || 0,
      is_active: $('#expCatActive').checked
    };
    if (!payload.name) { showToast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await client.from('expense_categories').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await client.from('expense_categories').insert(payload);
        if (error) throw error;
      }
      showToast('تم الحفظ', 'success');
      closeModal('expCatModal');
      await loadExpenseCategories();
    } catch (e) {
      console.error('saveExpCat:', e);
      showToast('فشل الحفظ: ' + e.message, 'error');
    }
  }

  async function deleteExpCat(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await client.from('expense_categories').delete().eq('id', id);
      if (error) throw error;
      showToast('تم الحذف', 'success');
      await loadExpenseCategories();
    } catch (e) {
      console.error('deleteExpCat:', e);
      showToast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     SESSIONS
     ============================================ */
  async function loadSessions() {
    const tbody = document.getElementById('sessionsTableBody');
    const actionsBody = document.getElementById('actionsTableBody');
    const actionsCount = document.getElementById('actionsCount');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    if (actionsBody) actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const [sessRes, actRes] = await Promise.all([
        client.from('user_sessions').select('*').order('login_at', { ascending: false }).limit(50),
        client.from('user_actions').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      const sessionData = sessRes.data || [];
      const actionData = actRes.data || [];

      if (tbody) {
        if (!sessionData.length) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد نشاط</td></tr>`;
        } else {
          tbody.innerHTML = sessionData.map(s => `
            <tr>
              <td>${escapeHtml(s.user_id || '—')}</td>
              <td>—</td>
              <td>${escapeHtml(formatDate(s.login_at || s.created_at))}</td>
              <td>${s.duration_seconds ? Math.floor(s.duration_seconds / 60) + ' د' : '—'}</td>
              <td>${escapeHtml((s.device || s.user_agent || '—').slice(0, 40))}</td>
            </tr>
          `).join('');
        }
      }

      if (actionsBody) {
        if (!actionData.length) {
          actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد إجراءات</td></tr>`;
        } else {
          actionsBody.innerHTML = actionData.map(a => `
            <tr>
              <td>${escapeHtml(a.user_email || a.user_id || '—')}</td>
              <td>${escapeHtml(a.action || '—')}</td>
              <td>${escapeHtml(a.details || '—')}</td>
              <td>${escapeHtml(formatDate(a.created_at))}</td>
            </tr>
          `).join('');
        }
      }

      if (actionsCount) actionsCount.textContent = `${actionData.length} إجراء`;
    } catch (e) {
      console.error('loadSessions:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
      if (actionsBody) actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function initSessionsTab() {
    const refreshBtn = $('#refreshSessionsBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadSessions);
  }

  /* ============================================
     AUDIT
     ============================================ */
  async function loadAudit() {
    const tbody = document.getElementById('auditTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      if (!data?.length) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد سجل</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(a => `
        <tr>
          <td>${escapeHtml(a.user_email || a.user_id || '—')}</td>
          <td>${escapeHtml(a.action || '—')}</td>
          <td>${escapeHtml(a.entity || '—')}</td>
          <td dir="ltr" style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:11.5px;">${escapeHtml(String(a.entity_id || '').slice(0, 8) || '—')}</td>
          <td>${escapeHtml(formatDate(a.created_at))}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('loadAudit:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function initAuditTab() {
    const refreshBtn = $('#refreshAuditBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAudit);
  }

  /* ============================================
     BACKUP
     ============================================ */
  async function exportBackup() {
    try {
      showToast('جاري تجهيز النسخة...', 'info');

      const [settingsRes, typesRes, branchesRes, usersRes, appsRes, govRes] = await Promise.all([
        client.from('settings').select('*'),
        client.from('membership_types').select('*'),
        client.from('branches').select('*'),
        client.from('users').select('*'),
        client.from('applications').select('*').limit(500),
        client.from('governorates').select('*')
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        exported_by: currentUser?.email || null,
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
      const a = document.createElement('a');
      a.href = url;
      a.download = `its-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('تم تحميل النسخة', 'success');
    } catch (e) {
      console.error('exportBackup:', e);
      showToast('فشل النسخ', 'error');
    }
  }

  /* ============================================
     NAVBAR / LOGOUT
     ============================================ */
  function initNavbar() {
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!confirm('تسجيل الخروج؟')) return;
        if (window.signOut) window.signOut('login.html');
      });
    }
  }

  /* ============================================
     REALTIME
     ============================================ */
  function initRealtime() {
    if (!window.Realtime || typeof window.Realtime.watchMany !== 'function') {
      console.warn('[Admin] Realtime not available');
      return;
    }

    try {
      unsubscribeRealtime = window.Realtime.watchMany(
        ['users', 'governorates', 'membership_types', 'branches', 'expense_categories', 'settings'],
        (payload, table) => {
          if (activeTab === 'users' && table === 'users') {
            refreshUsersUI();
          }

          if (activeTab === 'governorates' && table === 'governorates') {
            governorates = [];
            loadGovernorates();
          }

          if (activeTab === 'types' && table === 'membership_types') {
            loadTypes();
          }

          if (activeTab === 'branches' && table === 'branches') {
            loadBranches();
          }

          if (activeTab === 'expense-categories' && table === 'expense_categories') {
            loadExpenseCategories();
          }

          if ((activeTab === 'settings' || activeTab === 'home') && table === 'settings') {
            refreshSettingsUI();
          }
        },
        { debounceMs: 800 }
      );
    } catch (e) {
      console.warn('Realtime init skipped:', e);
    }
  }

  /**
   * ⚡ تحديث خفيف للمستخدمين
   */
  async function refreshUsersUI() {
    try {
      const { data, error } = await client
        .from('users')
        .select('id, full_name, email, phone, role, position, governorate_id, is_active, registration_source, last_login_at, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      users = data || [];
      renderUsers();
    } catch (e) {
      console.error('[Admin] refreshUsersUI:', e);
    }
  }

  /**
   * ⚡ تحديث خفيف للإعدادات
   */
  async function refreshSettingsUI() {
    try {
      const { data, error } = await client
        .from('settings')
        .select('key, value');
      if (error) throw error;

      const map = {};
      (data || []).forEach(r => { map[r.key] = r.value; });

      Object.keys(map).forEach(key => {
        const newVal = map[key];
        const oldVal = settings[key];

        if (JSON.stringify(newVal) === JSON.stringify(oldVal)) return;

        settings[key] = newVal;

        $$(`[data-setting="${key}"]`).forEach(el => {
          if (document.activeElement === el) return;
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            if (el.type === 'checkbox') {
              el.checked = newVal === true || newVal === 'true' || newVal === '1';
            } else {
              el.value = (typeof newVal === 'object') ? JSON.stringify(newVal) : (newVal ?? '');
            }
          }
        });

        // ⚡ Logo previews
        if (key === 'site_logo_url' || key === 'logo_url') {
          const lp = $('#logoPreview');
          if (lp) {
            if (newVal) {
              lp.innerHTML = `<img src="${escapeHtml(newVal)}" alt="logo" />`;
              lp.classList.add('has-logo');
            } else {
              lp.innerHTML = '';
              lp.classList.remove('has-logo');
            }
          }
        }

        if (key === 'head_photo_url') {
          const hp = $('#headPhotoPreview');
          if (hp) {
            if (newVal) {
              hp.innerHTML = `<img src="${escapeHtml(newVal)}" alt="head" />`;
              hp.classList.add('has-photo');
            } else {
              hp.innerHTML = '';
              hp.classList.remove('has-photo');
            }
          }
        }

        // ⚡ About logo preview
        if (key === 'about_card_logo') {
          const al = $('#aboutLogoPreview');
          if (al) {
            if (newVal) {
              al.innerHTML = `<img src="${escapeHtml(newVal)}" alt="" />`;
              al.classList.add('has-logo');
            } else {
              al.innerHTML = '';
              al.classList.remove('has-logo');
            }
          }
        }

        // ⚡ Features cards
        if (key === 'features_cards') {
          loadFeaturesFromSettings();
        }
      });

      console.log('[Admin] Settings refreshed (light)');
    } catch (e) {
      console.error('[Admin] refreshSettingsUI:', e);
    }
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

      initTabs();
      initSettingsTab();
      initUsersTab();
      initGovernoratesTab();
      initCommitteesTab();
      initTypesTab();
      initBranchesTab();
      initExpenseCategoriesTab();
      initSessionsTab();
      initAuditTab();
      initNavbar();

      // Modal backdrops
      ['userModal', 'typeModal', 'branchModal', 'govModal', 'expCatModal', 'featureModal', 'positionModal', 'changePasswordModal'].forEach(id => {
        const m = document.getElementById(id);
        if (m) {
          m.addEventListener('click', (e) => {
            if (e.target === m) closeModal(id);
          });
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          ['userModal', 'typeModal', 'branchModal', 'govModal', 'expCatModal', 'featureModal', 'positionModal', 'changePasswordModal'].forEach(closeModal);
        }
      });

      // Setup realtime
      initRealtime();

      // Load initial tab
      switchTab('settings');

      console.log('[Admin] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

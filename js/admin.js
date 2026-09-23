/* ============================================
   ADMIN.JS — لوحة النقيب العام
   IT Workers Syndicate — v3.0.0
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     1. STATE
     ============================================ */
  const state = {
    user: null,
    currentTab: 'settings',
    users: [],
    usersFilter: 'all',
    governorates: [],
    types: [],
    branches: [],
    expenseCategories: [],
    settings: {},
    committees: {}, // { govId: [positions] }
    editingUserId: null,
    editingTypeId: null,
    editingBranchId: null,
    editingGovId: null,
    editingExpCatId: null,
    realtimeChannels: []
  };

  /* ============================================
     2. HELPERS
     ============================================ */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toast(msg, type = 'info') {
    if (typeof window.toast === 'function') return window.toast(msg, type);
    console.log(`[${type}] ${msg}`);
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '—'; }
  }

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
      active: { cls: 'active', label: 'نشط' },
      pending: { cls: 'pending', label: 'بانتظار التفعيل' },
      rejected: { cls: 'rejected', label: 'مرفوض' },
      disabled: { cls: 'disabled', label: 'معطّل' }
    };
    const info = map[s] || { cls: 'disabled', label: status || '—' };
    return `<span class="status-badge ${info.cls}"><span class="dot"></span>${esc(info.label)}</span>`;
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('active');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
  }

  /* ============================================
     3. AUTH GUARD
     ============================================ */
  async function guard() {
    try {
      const user = await (window.getCurrentUser ? window.getCurrentUser() : null);
      if (!user) {
        window.location.href = 'login.html';
        return false;
      }
      const role = user.role || user.user_role;
      const allowed = ['head', 'vice_president', 'deputy'];
      if (!allowed.includes(role)) {
        toast('ليس لديك صلاحية الوصول لهذه الصفحة', 'error');
        setTimeout(() => window.location.href = 'home.html', 1200);
        return false;
      }
      state.user = user;
      return true;
    } catch (e) {
      console.error('Guard error:', e);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     4. TABS
     ============================================ */
  function initTabs() {
    $$('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tabBtn));
    });
  }

  function switchTab(tab) {
    if (!tab) return;
    state.currentTab = tab;

    $$('[data-tab-btn]').forEach(b => {
      b.classList.toggle('active', b.dataset.tabBtn === tab);
    });

    $$('[data-tab-content]').forEach(c => {
      const show = c.dataset.tabContent === tab;
      c.style.display = show ? '' : 'none';
    });

    // lazy load
    switch (tab) {
      case 'settings':      loadSettings(); break;
      case 'home':          loadHomeSettings(); break;
      case 'users':         loadUsers(); break;
      case 'governorates':  loadGovernorates(); break;
      case 'committees':    loadCommitteeGovernorates(); break;
      case 'types':         loadTypes(); break;
      case 'branches':      loadBranches(); break;
      case 'expense-categories': loadExpenseCategories(); break;
      case 'sessions':      loadSessions(); break;
      case 'audit':         loadAudit(); break;
    }
  }

  /* ============================================
     5. SETTINGS TAB
     ============================================ */
  async function loadSettings() {
    try {
      const { data, error } = await window.sb
        .from('settings')
        .select('key, value');
      if (error) throw error;

      const map = {};
      (data || []).forEach(r => { map[r.key] = r.value; });
      state.settings = map;

      // fill inputs with data-setting
      $$('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (!(key in map)) return;
        const val = map[key];
        if (el.type === 'checkbox') {
          el.checked = val === true || val === 'true' || val === '1';
        } else {
          el.value = val ?? '';
        }
      });

      // logo preview
      if (map.logo_url) {
        const lp = $('#logoPreview');
        if (lp) {
          lp.innerHTML = `<img src="${esc(map.logo_url)}" alt="logo" />`;
          lp.classList.add('has-logo');
        }
      }
      // head photo preview
      if (map.head_photo_url) {
        const hp = $('#headPhotoPreview');
        if (hp) {
          hp.innerHTML = `<img src="${esc(map.head_photo_url)}" alt="head" />`;
          hp.classList.add('has-photo');
        }
      }
    } catch (e) {
      console.error('loadSettings:', e);
      toast('فشل تحميل الإعدادات', 'error');
    }
  }

  async function loadHomeSettings() {
    // نفس الـ settings بس للتاب الرئيسية
    if (!Object.keys(state.settings).length) {
      await loadSettings();
    }
  }

  async function saveSettings(keys = null) {
    try {
      const updates = [];
      $$('[data-setting]').forEach(el => {
        const key = el.dataset.setting;
        if (keys && !keys.includes(key)) return;
        let val;
        if (el.type === 'checkbox') val = el.checked;
        else if (el.type === 'number') val = el.value === '' ? null : Number(el.value);
        else val = el.value;
        updates.push({ key, value: val });
      });

      if (!updates.length) {
        toast('لا يوجد تغييرات', 'info');
        return;
      }

      const { error } = await window.sb
        .from('settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;
      toast('تم حفظ الإعدادات بنجاح', 'success');
    } catch (e) {
      console.error('saveSettings:', e);
      toast('فشل حفظ الإعدادات', 'error');
    }
  }

  function initSettingsTab() {
    const saveBtn = $('#saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => saveSettings());

    const saveHomeBtn = $('#saveHomeBtn');
    if (saveHomeBtn) saveHomeBtn.addEventListener('click', () => saveSettings());

    // Logo upload
    const uploadLogoBtn = $('#uploadLogoBtn');
    const logoFileInput = $('#logoFileInput');
    const removeLogoBtn = $('#removeLogoBtn');

    if (uploadLogoBtn && logoFileInput) {
      uploadLogoBtn.addEventListener('click', () => logoFileInput.click());
      logoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) await uploadBranding(file, 'logo_url', '#logoPreview');
        logoFileInput.value = '';
      });
    }
    if (removeLogoBtn) {
      removeLogoBtn.addEventListener('click', () => removeBranding('logo_url', '#logoPreview'));
    }

    // Head photo
    const uploadHeadBtn = $('#uploadHeadPhotoBtn');
    const headFileInput = $('#headPhotoInput');
    const removeHeadBtn = $('#removeHeadPhotoBtn');

    if (uploadHeadBtn && headFileInput) {
      uploadHeadBtn.addEventListener('click', () => headFileInput.click());
      headFileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (file) await uploadBranding(file, 'head_photo_url', '#headPhotoPreview');
        headFileInput.value = '';
      });
    }
    if (removeHeadBtn) {
      removeHeadBtn.addEventListener('click', () => removeBranding('head_photo_url', '#headPhotoPreview'));
    }

    // Backup
    const backupBtn = $('#backupBtn');
    if (backupBtn) backupBtn.addEventListener('click', exportBackup);
  }

  async function uploadBranding(file, settingKey, previewSel) {
    try {
      const maxMB = 2;
      if (file.size > maxMB * 1024 * 1024) {
        toast(`الحد الأقصى ${maxMB} ميجا`, 'error');
        return;
      }
      const ext = file.name.split('.').pop();
      const path = `${settingKey}_${Date.now()}.${ext}`;

      const { error: upErr } = await window.sb.storage
        .from('branding')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = window.sb.storage.from('branding').getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: sErr } = await window.sb
        .from('settings')
        .upsert({ key: settingKey, value: url }, { onConflict: 'key' });
      if (sErr) throw sErr;

      const el = $(previewSel);
      if (el) {
        el.innerHTML = `<img src="${esc(url)}" alt="" />`;
        el.classList.add(settingKey === 'logo_url' ? 'has-logo' : 'has-photo');
      }
      toast('تم الرفع بنجاح', 'success');
    } catch (e) {
      console.error('uploadBranding:', e);
      toast('فشل رفع الصورة', 'error');
    }
  }

  async function removeBranding(settingKey, previewSel) {
    if (!confirm('متأكد من الإزالة؟')) return;
    try {
      const { error } = await window.sb
        .from('settings')
        .upsert({ key: settingKey, value: '' }, { onConflict: 'key' });
      if (error) throw error;

      const el = $(previewSel);
      if (el) {
        el.innerHTML = '';
        el.classList.remove('has-logo', 'has-photo');
      }
      toast('تم الحذف', 'success');
    } catch (e) {
      console.error('removeBranding:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     6. USERS TAB
     ============================================ */
  async function loadUsers() {
    const tbody = $('#usersTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const { data, error } = await window.sb
        .from('users')
        .select('id, full_name, email, phone, role, position, governorate_id, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      state.users = data || [];
      renderUsers();

      // counts
      const counts = {
        all: state.users.length,
        active: state.users.filter(u => u.status === 'active').length,
        pending: state.users.filter(u => u.status === 'pending').length,
        rejected: state.users.filter(u => u.status === 'rejected').length
      };
      const cAll = $('#countAllUsers'); if (cAll) cAll.textContent = counts.all;
      const cAct = $('#countActiveUsers'); if (cAct) cAct.textContent = counts.active;
      const cPnd = $('#countPendingUsers'); if (cPnd) cPnd.textContent = counts.pending;
      const cRej = $('#countRejectedUsers'); if (cRej) cRej.textContent = counts.rejected;
    } catch (e) {
      console.error('loadUsers:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderUsers() {
    const tbody = $('#usersTableBody');
    if (!tbody) return;

    let list = state.users;
    if (state.usersFilter !== 'all') {
      list = list.filter(u => u.status === state.usersFilter);
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد مستخدمون</td></tr>`;
      return;
    }

    const govMap = {};
    state.governorates.forEach(g => { govMap[g.id] = g.name; });

    tbody.innerHTML = list.map(u => `
      <tr>
        <td>${esc(u.full_name || '—')}</td>
        <td dir="ltr" style="text-align:right;">${esc(u.email || '—')}</td>
        <td><span class="role-badge ${roleBadgeClass(u.role)}"><span class="dot"></span>${esc(roleLabel(u.role))}</span></td>
        <td>${esc(u.position || '—')}</td>
        <td>${esc(govMap[u.governorate_id] || '—')}</td>
        <td>${statusBadge(u.status)}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn edit-btn" data-edit-user="${u.id}" title="تعديل">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" data-del-user="${u.id}" title="حذف">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // bind
    $$('[data-edit-user]').forEach(b => {
      b.addEventListener('click', () => openUserModal(b.dataset.editUser));
    });
    $$('[data-del-user]').forEach(b => {
      b.addEventListener('click', () => deleteUser(b.dataset.delUser));
    });
  }

  function initUsersTab() {
    $$('[data-users-filter]').forEach(b => {
      b.addEventListener('click', () => {
        state.usersFilter = b.dataset.usersFilter;
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
    state.editingUserId = id;
    const title = $('#userModalTitle');

    // populate governorates
    await ensureGovernoratesLoaded();
    const govSel = $('#userGovernorate');
    if (govSel) {
      govSel.innerHTML = '<option value="">-- اختر المحافظة --</option>' +
        state.governorates.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
    }

    if (id) {
      const u = state.users.find(x => x.id === id);
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
      toast('املأ الحقول الإلزامية', 'error');
      return;
    }

    const needsGov = role === 'governorate_head' || role === 'governorate_board';
    if (needsGov && !governorate_id) {
      toast('اختر المحافظة', 'error');
      return;
    }

    try {
      if (id) {
        const { error } = await window.sb.from('users').update({
          full_name, email, phone, role, position, governorate_id, notes
        }).eq('id', id);
        if (error) throw error;
        toast('تم التحديث', 'success');
      } else {
        if (!password || password.length < 6) {
          toast('كلمة المرور 6 أحرف على الأقل', 'error');
          return;
        }
        // إنشاء المستخدم في Auth
        if (window.sb.auth?.admin?.createUser) {
          const { data: authData, error: authErr } = await window.sb.auth.admin.createUser({
            email, password, email_confirm: true
          });
          if (authErr) throw authErr;

          const { error } = await window.sb.from('users').insert({
            id: authData.user.id,
            full_name, email, phone, role, position, governorate_id, notes,
            status: 'active'
          });
          if (error) throw error;
        } else {
          throw new Error('إنشاء المستخدمين يتطلب Service Role');
        }
        toast('تم إضافة المستخدم', 'success');
      }

      closeModal('userModal');
      await loadUsers();
    } catch (e) {
      console.error('saveUser:', e);
      toast(e.message || 'فشل الحفظ', 'error');
    }
  }

  async function deleteUser(id) {
    if (!confirm('متأكد من حذف المستخدم؟')) return;
    try {
      const { error } = await window.sb.from('users').delete().eq('id', id);
      if (error) throw error;
      toast('تم الحذف', 'success');
      await loadUsers();
    } catch (e) {
      console.error('deleteUser:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     7. GOVERNORATES TAB
     ============================================ */
  async function ensureGovernoratesLoaded() {
    if (state.governorates.length) return state.governorates;
    const { data, error } = await window.sb
      .from('governorates')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    state.governorates = data || [];
    return state.governorates;
  }

  async function loadGovernorates() {
    const tbody = $('#govTableBody');
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
    const tbody = $('#govTableBody');
    if (!tbody) return;
    if (!state.governorates.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد محافظات</td></tr>`;
      return;
    }
    tbody.innerHTML = state.governorates.map(g => `
      <tr>
        <td dir="ltr" style="text-align:right;">${esc(g.code || '—')}</td>
        <td>${esc(g.name || '—')}</td>
        <td>${g.structure_type === 'council' ? 'مجلس كامل' : 'وكيل + مساعدين'}</td>
        <td>${esc(g.sort_order ?? '—')}</td>
        <td>${statusBadge(g.active ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn edit-btn" data-edit-gov="${g.id}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" data-del-gov="${g.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    $$('[data-edit-gov]').forEach(b => b.addEventListener('click', () => openGovModal(b.dataset.editGov)));
    $$('[data-del-gov]').forEach(b => b.addEventListener('click', () => deleteGov(b.dataset.delGov)));
  }

  function initGovernoratesTab() {
    const addBtn = $('#addGovBtn');
    if (addBtn) addBtn.addEventListener('click', () => openGovModal());
    const saveBtn = $('#saveGovBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveGov);
  }

  function openGovModal(id = null) {
    state.editingGovId = id;
    const title = $('#govModalTitle');
    if (id) {
      const g = state.governorates.find(x => x.id === id);
      if (!g) return;
      if (title) title.textContent = 'تعديل محافظة';
      $('#govId').value = g.id;
      $('#govName').value = g.name || '';
      $('#govCode').value = g.code || '';
      $('#govStructureType').value = g.structure_type || 'council';
      $('#govSortOrder').value = g.sort_order ?? 0;
      $('#govActive').checked = !!g.active;
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
  window.closeGovModal = function () { closeModal('govModal'); };

  async function saveGov() {
    const id = $('#govId').value;
    const payload = {
      name: $('#govName').value.trim(),
      code: $('#govCode').value.trim().toUpperCase() || null,
      structure_type: $('#govStructureType').value,
      sort_order: Number($('#govSortOrder').value) || 0,
      active: $('#govActive').checked
    };
    if (!payload.name) { toast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await window.sb.from('governorates').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('governorates').insert(payload);
        if (error) throw error;
      }
      toast('تم الحفظ', 'success');
      closeModal('govModal');
      state.governorates = [];
      await loadGovernorates();
    } catch (e) {
      console.error('saveGov:', e);
      toast('فشل الحفظ', 'error');
    }
  }

  async function deleteGov(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await window.sb.from('governorates').delete().eq('id', id);
      if (error) throw error;
      toast('تم الحذف', 'success');
      state.governorates = [];
      await loadGovernorates();
    } catch (e) {
      console.error('deleteGov:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     8. COMMITTEES TAB
     ============================================ */
  const COUNCIL_POSITIONS = [
    { key: 'head', label: 'النقيب' },
    { key: 'vice1', label: 'النائب الأول' },
    { key: 'vice2', label: 'النائب الثاني' },
    { key: 'secretary', label: 'الأمين العام' },
    { key: 'secretary_assist', label: 'مساعد الأمين' },
    { key: 'treasurer', label: 'أمين الصندوق' },
    { key: 'treasurer_assist', label: 'مساعد أمين الصندوق' }
  ];
  const SIMPLE_POSITIONS = [
    { key: 'agent', label: 'الوكيل' },
    { key: 'assist1', label: 'مساعد أول' },
    { key: 'assist2', label: 'مساعد ثاني' }
  ];

  async function loadCommitteeGovernorates() {
    await ensureGovernoratesLoaded();
    const sel = $('#committeeGovSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر المحافظة --</option>' +
      state.governorates.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');

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
      const gov = state.governorates.find(g => g.id === govId);
      const positions = gov?.structure_type === 'simple' ? SIMPLE_POSITIONS : COUNCIL_POSITIONS;

      const { data, error } = await window.sb
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
              <div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px;">${esc(p.label)}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${esc(m?.full_name || '— شاغر —')}</div>
              <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;">${esc(m?.phone || '')}</div>
              <button type="button" class="btn btn-outline btn-sm" data-pos-btn="${p.key}" data-pos-label="${esc(p.label)}">
                ${m ? 'تعديل' : 'تعيين'}
              </button>
            </div>
          `;
        }).join('') + `</div>`;

      $$('[data-pos-btn]').forEach(b => {
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
    if (!full_name) { toast('الاسم مطلوب', 'error'); return; }

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
      const { data: existing } = await window.sb
        .from('governorate_committees')
        .select('id')
        .eq('governorate_id', govId)
        .eq('position', position)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await window.sb.from('governorate_committees').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('governorate_committees').insert(payload);
        if (error) throw error;
      }
      toast('تم الحفظ', 'success');
      closeModal('positionModal');
      loadCommitteePositions(govId);
    } catch (e) {
      console.error('savePosition:', e);
      toast('فشل الحفظ', 'error');
    }
  }

  function initCommitteesTab() {
    const saveBtn = $('#savePositionBtn');
    if (saveBtn) saveBtn.addEventListener('click', savePosition);
  }

  /* ============================================
     9. TYPES TAB
     ============================================ */
  async function loadTypes() {
    const tbody = $('#typesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await window.sb
        .from('membership_types')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      state.types = data || [];
      renderTypes();
    } catch (e) {
      console.error('loadTypes:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderTypes() {
    const tbody = $('#typesTableBody');
    if (!tbody) return;
    if (!state.types.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد أنواع</td></tr>`;
      return;
    }
    tbody.innerHTML = state.types.map(t => `
      <tr>
        <td dir="ltr" style="text-align:right;">${esc(t.code || '—')}</td>
        <td>${esc(t.name || '—')}</td>
        <td>${esc(t.description || '—')}</td>
        <td>${esc(t.fee ?? '—')} ج.م</td>
        <td>${esc(t.duration_months ?? '—')} شهر</td>
        <td>${statusBadge(t.active ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn edit-btn" data-edit-type="${t.id}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" data-del-type="${t.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    $$('[data-edit-type]').forEach(b => b.addEventListener('click', () => openTypeModal(b.dataset.editType)));
    $$('[data-del-type]').forEach(b => b.addEventListener('click', () => deleteType(b.dataset.delType)));
  }

  function initTypesTab() {
    const addBtn = $('#addTypeBtn');
    if (addBtn) addBtn.addEventListener('click', () => openTypeModal());
    const saveBtn = $('#saveTypeBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveType);
  }

  function openTypeModal(id = null) {
    state.editingTypeId = id;
    const title = $('#typeModalTitle');
    if (id) {
      const t = state.types.find(x => x.id === id);
      if (!t) return;
      if (title) title.textContent = 'تعديل نوع';
      $('#typeId').value = t.id;
      $('#typeName').value = t.name || '';
      $('#typeCode').value = t.code || '';
      $('#typeDesc').value = t.description || '';
      $('#typeFee').value = t.fee ?? '';
      $('#typeDuration').value = t.duration_months ?? '';
      $('#typeSortOrder').value = t.sort_order ?? 0;
      $('#typeActive').checked = !!t.active;
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
      active: $('#typeActive').checked
    };
    if (!payload.name) { toast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await window.sb.from('membership_types').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('membership_types').insert(payload);
        if (error) throw error;
      }
      toast('تم الحفظ', 'success');
      closeModal('typeModal');
      await loadTypes();
    } catch (e) {
      console.error('saveType:', e);
      toast('فشل الحفظ', 'error');
    }
  }

  async function deleteType(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await window.sb.from('membership_types').delete().eq('id', id);
      if (error) throw error;
      toast('تم الحذف', 'success');
      await loadTypes();
    } catch (e) {
      console.error('deleteType:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     10. BRANCHES TAB
     ============================================ */
  async function loadBranches() {
    const tbody = $('#branchesTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await window.sb
        .from('branches')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      state.branches = data || [];
      renderBranches();
    } catch (e) {
      console.error('loadBranches:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderBranches() {
    const tbody = $('#branchesTableBody');
    if (!tbody) return;
    if (!state.branches.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد شعب</td></tr>`;
      return;
    }
    tbody.innerHTML = state.branches.map(b => `
      <tr>
        <td dir="ltr" style="text-align:right;">${esc(b.code || '—')}</td>
        <td>${esc(b.name || '—')}</td>
        <td>${esc(b.description || '—')}</td>
        <td>${esc(b.sort_order ?? '—')}</td>
        <td>${statusBadge(b.active ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn edit-btn" data-edit-branch="${b.id}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" data-del-branch="${b.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    $$('[data-edit-branch]').forEach(b => b.addEventListener('click', () => openBranchModal(b.dataset.editBranch)));
    $$('[data-del-branch]').forEach(b => b.addEventListener('click', () => deleteBranch(b.dataset.delBranch)));
  }

  function initBranchesTab() {
    const addBtn = $('#addBranchBtn');
    if (addBtn) addBtn.addEventListener('click', () => openBranchModal());
    const saveBtn = $('#saveBranchBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveBranch);
  }

  function openBranchModal(id = null) {
    state.editingBranchId = id;
    const title = $('#branchModalTitle');
    if (id) {
      const b = state.branches.find(x => x.id === id);
      if (!b) return;
      if (title) title.textContent = 'تعديل شعبة';
      $('#branchId').value = b.id;
      $('#branchName').value = b.name || '';
      $('#branchCode').value = b.code || '';
      $('#branchDesc').value = b.description || '';
      $('#branchSortOrder').value = b.sort_order ?? 0;
      $('#branchActive').checked = !!b.active;
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
  window.closeBranchModal = function () { closeModal('branchModal'); };

  async function saveBranch() {
    const id = $('#branchId').value;
    const payload = {
      name: $('#branchName').value.trim(),
      code: $('#branchCode').value.trim().toUpperCase() || null,
      description: $('#branchDesc').value.trim() || null,
      sort_order: Number($('#branchSortOrder').value) || 0,
      active: $('#branchActive').checked
    };
    if (!payload.name) { toast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await window.sb.from('branches').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('branches').insert(payload);
        if (error) throw error;
      }
      toast('تم الحفظ', 'success');
      closeModal('branchModal');
      await loadBranches();
    } catch (e) {
      console.error('saveBranch:', e);
      toast('فشل الحفظ', 'error');
    }
  }

  async function deleteBranch(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await window.sb.from('branches').delete().eq('id', id);
      if (error) throw error;
      toast('تم الحذف', 'success');
      await loadBranches();
    } catch (e) {
      console.error('deleteBranch:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     11. EXPENSE CATEGORIES TAB
     ============================================ */
  async function loadExpenseCategories() {
    const tbody = $('#expCatTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await window.sb
        .from('expense_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      state.expenseCategories = data || [];
      renderExpenseCategories();
    } catch (e) {
      console.error('loadExpenseCategories:', e);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">فشل التحميل</td></tr>`;
    }
  }

  function renderExpenseCategories() {
    const tbody = $('#expCatTableBody');
    if (!tbody) return;
    if (!state.expenseCategories.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد تصنيفات</td></tr>`;
      return;
    }
    tbody.innerHTML = state.expenseCategories.map(c => `
      <tr>
        <td dir="ltr" style="text-align:right;">${esc(c.code || '—')}</td>
        <td>${esc(c.name || '—')}</td>
        <td>${esc(c.description || '—')}</td>
        <td>${esc(c.sort_order ?? '—')}</td>
        <td>${statusBadge(c.active ? 'active' : 'disabled')}</td>
        <td>
          <div class="row-actions">
            <button class="row-btn edit-btn" data-edit-expcat="${c.id}">
              <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="row-btn delete-btn" data-del-expcat="${c.id}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    $$('[data-edit-expcat]').forEach(b => b.addEventListener('click', () => openExpCatModal(b.dataset.editExpcat)));
    $$('[data-del-expcat]').forEach(b => b.addEventListener('click', () => deleteExpCat(b.dataset.delExpcat)));
  }

  function initExpenseCategoriesTab() {
    const addBtn = $('#addExpCatBtn');
    if (addBtn) addBtn.addEventListener('click', () => openExpCatModal());
    const saveBtn = $('#saveExpCatBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveExpCat);
  }

  function openExpCatModal(id = null) {
    state.editingExpCatId = id;
    const title = $('#expCatModalTitle');
    if (id) {
      const c = state.expenseCategories.find(x => x.id === id);
      if (!c) return;
      if (title) title.textContent = 'تعديل تصنيف';
      $('#expCatId').value = c.id;
      $('#expCatName').value = c.name || '';
      $('#expCatCode').value = c.code || '';
      $('#expCatDesc').value = c.description || '';
      $('#expCatSortOrder').value = c.sort_order ?? 0;
      $('#expCatActive').checked = !!c.active;
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
  window.closeExpCatModal = function () { closeModal('expCatModal'); };

  async function saveExpCat() {
    const id = $('#expCatId').value;
    const payload = {
      name: $('#expCatName').value.trim(),
      code: $('#expCatCode').value.trim().toUpperCase() || null,
      description: $('#expCatDesc').value.trim() || null,
      sort_order: Number($('#expCatSortOrder').value) || 0,
      active: $('#expCatActive').checked
    };
    if (!payload.name) { toast('الاسم مطلوب', 'error'); return; }

    try {
      if (id) {
        const { error } = await window.sb.from('expense_categories').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('expense_categories').insert(payload);
        if (error) throw error;
      }
      toast('تم الحفظ', 'success');
      closeModal('expCatModal');
      await loadExpenseCategories();
    } catch (e) {
      console.error('saveExpCat:', e);
      toast('فشل الحفظ', 'error');
    }
  }

  async function deleteExpCat(id) {
    if (!confirm('متأكد من الحذف؟')) return;
    try {
      const { error } = await window.sb.from('expense_categories').delete().eq('id', id);
      if (error) throw error;
      toast('تم الحذف', 'success');
      await loadExpenseCategories();
    } catch (e) {
      console.error('deleteExpCat:', e);
      toast('فشل الحذف', 'error');
    }
  }

  /* ============================================
     12. SESSIONS TAB
     ============================================ */
  async function loadSessions() {
    const tbody = $('#sessionsTableBody');
    const actionsBody = $('#actionsTableBody');
    const actionsCount = $('#actionsCount');

    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    if (actionsBody) actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;

    try {
      const [sessRes, actRes] = await Promise.all([
        window.sb.from('user_sessions').select('*').order('last_seen', { ascending: false }).limit(50),
        window.sb.from('user_actions').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      const sessions = sessRes.data || [];
      const actions = actRes.data || [];

      if (tbody) {
        if (!sessions.length) {
          tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">لا يوجد نشاط</td></tr>`;
        } else {
          tbody.innerHTML = sessions.map(s => `
            <tr>
              <td>${esc(s.user_name || s.user_id || '—')}</td>
              <td>${esc(roleLabel(s.role))}</td>
              <td>${fmtDate(s.last_seen || s.created_at)}</td>
              <td>${esc(s.duration || '—')}</td>
              <td>${esc(s.device || '—')}</td>
            </tr>
          `).join('');
        }
      }

      if (actionsBody) {
        if (!actions.length) {
          actionsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-dim);">لا توجد إجراءات</td></tr>`;
        } else {
          actionsBody.innerHTML = actions.map(a => `
            <tr>
              <td>${esc(a.user_name || a.user_id || '—')}</td>
              <td>${esc(a.action || '—')}</td>
              <td>${esc(a.details || '—')}</td>
              <td>${fmtDate(a.created_at)}</td>
            </tr>
          `).join('');
        }
      }

      if (actionsCount) actionsCount.textContent = `${actions.length} إجراء`;

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
     13. AUDIT TAB
     ============================================ */
  async function loadAudit() {
    const tbody = $('#auditTableBody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    try {
      const { data, error } = await window.sb
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
          <td>${esc(a.user_name || a.user_id || '—')}</td>
          <td>${esc(a.action || '—')}</td>
          <td>${esc(a.entity || '—')}</td>
          <td dir="ltr" style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:11.5px;">${esc((a.entity_id || '').slice(0, 8) || '—')}</td>
          <td>${fmtDate(a.created_at)}</td>
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
     14. BACKUP
     ============================================ */
  async function exportBackup() {
    try {
      toast('جاري تجهيز النسخة...', 'info');
      const [settingsRes, typesRes, branchesRes, usersRes, appsRes] = await Promise.all([
        window.sb.from('settings').select('*'),
        window.sb.from('membership_types').select('*'),
        window.sb.from('branches').select('*'),
        window.sb.from('users').select('*'),
        window.sb.from('applications').select('*')
      ]);

      const backup = {
        exported_at: new Date().toISOString(),
        version: '3.0.0',
        settings: settingsRes.data || [],
        membership_types: typesRes.data || [],
        branches: branchesRes.data || [],
        users: usersRes.data || [],
        applications: appsRes.data || []
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

      toast('تم تحميل النسخة', 'success');
    } catch (e) {
      console.error('exportBackup:', e);
      toast('فشل النسخ', 'error');
    }
  }

  /* ============================================
     15. NAVBAR / LOGOUT / MOBILE
     ============================================ */
  function initNavbar() {
    const logoutBtn = $('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!confirm('تسجيل الخروج؟')) return;
        try {
          if (typeof window.logout === 'function') await window.logout();
          else await window.sb.auth.signOut();
        } catch (err) { console.error(err); }
        window.location.href = 'login.html';
      });
    }
  }

  /* ============================================
     16. REALTIME
     ============================================ */
  function initRealtime() {
    if (typeof window.watchMany !== 'function') return;
    try {
      window.watchMany(
        ['users', 'governorates', 'membership_types', 'branches', 'expense_categories', 'settings'],
        () => {
          // إعادة تحميل التاب الحالي فقط
          switch (state.currentTab) {
            case 'users':              loadUsers(); break;
            case 'governorates':       state.governorates = []; loadGovernorates(); break;
            case 'types':              loadTypes(); break;
            case 'branches':           loadBranches(); break;
            case 'expense-categories': loadExpenseCategories(); break;
            case 'settings':
            case 'home':               loadSettings(); break;
          }
        }
      );
    } catch (e) {
      console.warn('Realtime init skipped:', e);
    }
  }

  /* ============================================
     17. USER BADGE
     ============================================ */
  function fillUserBadge() {
    const name = state.user?.full_name || state.user?.name || state.user?.email || '—';
    $$('[data-user-name]').forEach(el => el.textContent = name);
  }

  /* ============================================
     18. INIT
     ============================================ */
  async function init() {
    const ok = await guard();
    if (!ok) return;

    fillUserBadge();
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
    initRealtime();

    // تحميل أول تاب
    switchTab('settings');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =====================================================
   IT SYNDICATE — PROFILE LOGIC
   Version: 1.0.0
   =====================================================
   يحتوي على:
   - Auth Check
   - جلب بيانات المستخدم من جدول users
   - جلب اسم المحافظة
   - عرض البيانات في الـ UI
   - تغيير كلمة المرور (مع التحقق من القديمة)
   - Audit Log
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let currentUserData = null;
  let governorateName = '';
  let isChangingPassword = false;

  /* ============================================
     HELPERS
     ============================================ */
  const $ = (sel) => document.querySelector(sel);

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

  function formatDateShort(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) { return '—'; }
  }

  function getInitials(name) {
    if (!name) return '؟';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 0) return '؟';
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + ' ' + parts[1].charAt(0);
  }

  function getRoleLabel(role) {
    const labels = {
      'head': 'النقيب العام',
      'vice_president': 'نائب رئيس النقابة',
      'deputy': 'الوكيل',
      'committee': 'لجنة العضوية',
      'governorate_head': 'نقيب محافظة',
      'governorate_board': 'مجلس محافظة',
      'branches_manager': 'مدير الفروع',
      'social_committee_head': 'رئيس اللجنة الاجتماعية',
      'social_committee_vice': 'نائب اللجنة الاجتماعية',
      'public_relations_head': 'رئيس العلاقات العامة',
      'public_relations_vice': 'نائب العلاقات العامة',
      'committees_manager_head': 'مدير اللجان',
      'committees_manager_vice': 'نائب مدير اللجان'
    };
    return labels[role] || 'موظف';
  }

  function getDashboardPath(role) {
    const routes = {
      'head': 'admin.html',
      'vice_president': 'admin.html',
      'deputy': 'admin.html',
      'committee': 'dashboard.html',
      'governorate_head': 'governorate.html',
      'governorate_board': 'governorate.html',
      'branches_manager': 'branches.html',
      'social_committee_head': 'social-committee.html',
      'social_committee_vice': 'social-committee.html',
      'public_relations_head': 'public-relations.html',
      'public_relations_vice': 'public-relations.html',
      'committees_manager_head': 'committees-manager.html',
      'committees_manager_vice': 'committees-manager.html'
    };
    return routes[role] || 'dashboard.html';
  }

  function showToast(message, type) {
    type = type || 'info';
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log('[' + type + '] ' + message);
  }

  function setButtonLoading(btn, text, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<span>' + text + '</span><span class="spinner"></span>';
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ============================================
     ALERT HELPERS
     ============================================ */
  function showMainAlert(type, message) {
    const box = document.getElementById('alertBox');
    if (!box) return;
    renderAlert(box, type, message);
  }

  function clearMainAlert() {
    const box = document.getElementById('alertBox');
    if (box) box.innerHTML = '';
  }

  function showPasswordAlert(type, message) {
    const box = document.getElementById('passwordAlertBox');
    if (!box) return;
    renderAlert(box, type, message);
  }

  function clearPasswordAlert() {
    const box = document.getElementById('passwordAlertBox');
    if (box) box.innerHTML = '';
  }

  function renderAlert(box, type, message) {
    if (!box) return;

    const colors = {
      success: { bg: 'rgba(var(--success-rgb), 0.12)', border: 'var(--success)', text: 'var(--success)' },
      error:   { bg: 'rgba(var(--danger-rgb), 0.12)',  border: 'var(--danger)',  text: 'var(--danger)' },
      warning: { bg: 'rgba(var(--warning-rgb), 0.12)', border: 'var(--warning)', text: 'var(--warning)' },
      info:    { bg: 'rgba(var(--accent-rgb), 0.1)',   border: 'var(--accent)',  text: 'var(--accent)' }
    };
    const c = colors[type] || colors.info;

    const iconSvg = type === 'success'
      ? '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === 'error'
      ? '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      : '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

    box.innerHTML = `
      <div style="
        background:${c.bg};
        border:1.5px solid ${c.border};
        color:${c.text};
        padding:13px 16px;
        border-radius:12px;
        font-size:13.5px;
        font-weight:600;
        display:flex;
        align-items:center;
        gap:10px;
        margin-bottom:18px;
        animation:alertIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        ${iconSvg}
        <span>${escapeHtml(message)}</span>
      </div>
      <style>
        @keyframes alertIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
  }

  /* ============================================
     WAIT FOR SUPABASE
     ============================================ */
  function waitForSupabase() {
    return new Promise((resolve) => {
      if (window.supabaseClient) {
        resolve(window.supabaseClient);
        return;
      }

      if (typeof window.onSupabaseReady === 'function') {
        window.onSupabaseReady((c) => resolve(c));
        setTimeout(() => resolve(window.supabaseClient || null), 5000);
      } else {
        const start = Date.now();
        const check = setInterval(() => {
          if (window.supabaseClient) {
            clearInterval(check);
            resolve(window.supabaseClient);
          } else if (Date.now() - start > 5000) {
            clearInterval(check);
            resolve(null);
          }
        }, 100);
      }
    });
  }

  /* ============================================
     AUTH CHECK
     ============================================ */
  async function checkAuth() {
    try {
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData && sessionData.session;
      if (!session) {
        window.location.href = 'login.html';
        return false;
      }

      currentUser = session.user;
      return true;
    } catch (err) {
      console.error('[Profile] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD USER DATA
     ============================================ */
  async function loadUserData() {
    try {
      // 1) جلب بيانات المستخدم
      const { data, error } = await client
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('لم يتم العثور على بيانات المستخدم');

      currentUserData = data;

      // 2) جلب اسم المحافظة (لو موجودة)
      if (data.governorate_id) {
        try {
          const { data: govData } = await client
            .from('governorates')
            .select('name')
            .eq('id', data.governorate_id)
            .maybeSingle();

          if (govData && govData.name) {
            governorateName = govData.name;
          }
        } catch (e) {
          console.warn('[Profile] Governorate load failed:', e.message);
        }
      }

      // 3) عرض البيانات
      renderUserData();

      // 4) تحديث الـ dashboard link
      updateDashboardLink();

      // 5) إخفاء Loading + إظهار Grid
      const loadingState = document.getElementById('loadingState');
      const profileGrid = document.getElementById('profileGrid');
      if (loadingState) loadingState.style.display = 'none';
      if (profileGrid) profileGrid.style.display = 'grid';

      console.log('[Profile] Data loaded');
      return true;

    } catch (err) {
      console.error('[Profile] Load error:', err);
      showToast('فشل تحميل البيانات: ' + err.message, 'error');

      const loadingState = document.getElementById('loadingState');
      if (loadingState) {
        loadingState.innerHTML = `
          <div style="color:var(--danger);font-size:14px;line-height:1.7;">
            <strong>حدث خطأ</strong><br>
            ${escapeHtml(err.message)}<br><br>
            <button onclick="window.location.reload()" class="btn btn-primary btn-sm" style="margin-top:10px;">
              إعادة تحميل الصفحة
            </button>
          </div>
        `;
      }
      return false;
    }
  }

  /* ============================================
     RENDER USER DATA
     ============================================ */
  function renderUserData() {
    if (!currentUserData) return;

    const u = currentUserData;

    // Avatar (initials)
    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
      const initials = getInitials(u.full_name || currentUser.email || '؟');
      avatar.innerHTML = `<span>${escapeHtml(initials)}</span>`;
    }

    // Name
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.textContent = u.full_name || '—';

    // Email
    const emailEl = document.getElementById('profileEmail');
    if (emailEl) emailEl.textContent = u.email || currentUser.email || '—';

    // Role badge
    const roleLabelEl = document.getElementById('profileRoleLabel');
    if (roleLabelEl) roleLabelEl.textContent = getRoleLabel(u.role);

    // Position
    const positionEl = document.getElementById('profilePosition');
    if (positionEl) {
      if (u.position && u.position.trim()) {
        positionEl.textContent = u.position;
        positionEl.style.display = 'block';
      } else {
        positionEl.style.display = 'none';
      }
    }

    // Side stats
    const createdAt = document.getElementById('statCreatedAt');
    if (createdAt) createdAt.textContent = formatDateShort(u.created_at);

    const lastLogin = document.getElementById('statLastLogin');
    if (lastLogin) lastLogin.textContent = formatDateShort(u.last_login_at);

    // Detail: full name
    const detFullName = document.getElementById('detFullName');
    if (detFullName) detFullName.textContent = u.full_name || '—';

    // Detail: email
    const detEmail = document.getElementById('detEmail');
    if (detEmail) detEmail.textContent = u.email || currentUser.email || '—';

    // Detail: phone
    const detPhone = document.getElementById('detPhone');
    if (detPhone) detPhone.textContent = u.phone || '—';

    // Detail: role
    const detRole = document.getElementById('detRole');
    if (detRole) detRole.textContent = getRoleLabel(u.role);

    // Detail: position
    const detPositionWrap = document.getElementById('detPositionWrap');
    const detPosition = document.getElementById('detPosition');
    if (detPositionWrap && detPosition) {
      if (u.position && u.position.trim()) {
        detPosition.textContent = u.position;
        detPositionWrap.style.display = 'block';
      } else {
        detPositionWrap.style.display = 'none';
      }
    }

    // Detail: governorate
    const detGovWrap = document.getElementById('detGovWrap');
    const detGov = document.getElementById('detGov');
    if (detGovWrap && detGov) {
      if (governorateName) {
        detGov.textContent = governorateName;
        detGovWrap.style.display = 'block';
      } else {
        detGovWrap.style.display = 'none';
      }
    }

    // Update navbar user name
    document.querySelectorAll('[data-user-name]').forEach((el) => {
      el.textContent = u.full_name || '—';
    });
  }

  /* ============================================
     UPDATE DASHBOARD LINK
     ============================================ */
  function updateDashboardLink() {
    const link = document.getElementById('dashboardLink');
    if (!link || !currentUserData) return;

    const path = getDashboardPath(currentUserData.role);
    link.href = path;
    link.style.display = 'inline-flex';
  }

  /* ============================================
     CHANGE PASSWORD
     ============================================ */
  async function changePassword(e) {
    e.preventDefault();

    if (isChangingPassword) return;

    clearPasswordAlert();

    const currentPassword = document.getElementById('current_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    // Validation
    if (!currentPassword) {
      showPasswordAlert('error', 'أدخل كلمة المرور الحالية');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showPasswordAlert('error', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmPassword) {
      showPasswordAlert('error', 'كلمتا المرور غير متطابقتين');
      return;
    }

    if (newPassword === currentPassword) {
      showPasswordAlert('warning', 'كلمة المرور الجديدة مطابقة للقديمة — اختر كلمة مرور مختلفة');
      return;
    }

    isChangingPassword = true;
    const btn = document.getElementById('changePasswordBtn');
    setButtonLoading(btn, 'جاري التغيير...', true);

    try {
      // 1) التحقق من كلمة المرور الحالية بإعادة تسجيل الدخول
      if (window.showPasswordAlert) {
        showPasswordAlert('info', 'جاري التحقق من كلمة المرور الحالية...');
      }

      const { data: userData, error: signInError } = await client.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('كلمة المرور الحالية غير صحيحة');
      }

      // 2) تغيير كلمة المرور
      if (window.showPasswordAlert) {
        showPasswordAlert('info', 'جاري تغيير كلمة المرور...');
      }

      const { error: updateError } = await client.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error('فشل تغيير كلمة المرور: ' + updateError.message);
      }

      // 3) تحديث تاريخ تغيير كلمة المرور
      try {
        await client
          .from('users')
          .update({
            password_changed_at: new Date().toISOString(),
            password_changed_by: currentUser.id
          })
          .eq('id', currentUser.id);
      } catch (e) {
        console.warn('[Profile] Could not update password_changed_at:', e.message);
      }

      // 4) تسجيل الإجراء في audit_log
      try {
        await client.from('audit_log').insert([{
          user_id: currentUser.id,
          user_email: currentUser.email,
          action: 'change_password',
          entity: 'users',
          entity_id: currentUser.id,
          notes: 'المستخدم غيّر كلمة المرور بنفسه',
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      // 5) تحديث كلمة المرور في الـ cache (refresh session)
      try {
        await client.auth.refreshSession();
      } catch (e) {}

      // 6) عرض رسالة نجاح
      showPasswordAlert('success', 'تم تغيير كلمة المرور بنجاح — استخدم الكلمة الجديدة في تسجيل الدخول القادم');

      // 7) إفراغ الحقول
      document.getElementById('passwordForm').reset();
      const strengthBar = document.getElementById('passwordStrength');
      if (strengthBar) strengthBar.classList.remove('weak', 'medium', 'strong');
      const hint = document.getElementById('passwordHint');
      if (hint) hint.textContent = 'استخدم 6 أحرف على الأقل، مع أرقام ورموز لقوة أفضل';
      const matchHint = document.getElementById('passwordMatchHint');
      if (matchHint) matchHint.textContent = '';

      showToast('تم تغيير كلمة المرور بنجاح', 'success');

    } catch (err) {
      console.error('[Profile] Change password error:', err);
      showPasswordAlert('error', err.message || 'حدث خطأ غير متوقع');
    } finally {
      isChangingPassword = false;
      setButtonLoading(btn, 'تغيير كلمة المرور', false);
    }
  }

  /* ============================================
     REFRESH BUTTON
     ============================================ */
  function setupRefreshButton() {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span><span>جاري التحديث...</span>';

      try {
        await loadUserData();
        showToast('تم تحديث البيانات', 'success');
      } catch (err) {
        showToast('فشل التحديث', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  }

  /* ============================================
     LOGOUT
     ============================================ */
  function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        if (window.signOut) {
          window.signOut('login.html');
        } else {
          client.auth.signOut().then(() => {
            window.location.href = 'login.html';
          });
        }
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

      await loadUserData();

      // ربط الفورم
      const passwordForm = document.getElementById('passwordForm');
      if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
      }

      setupRefreshButton();
      setupLogout();

      console.log('[Profile] Ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

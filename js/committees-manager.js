/* =====================================================
   IT SYNDICATE — Committees Manager Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const HC_SOON_DAYS = 30;
  const RECENT_LIMIT = 10;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let membershipTypes = [];
  let recentApps = [];
  let unsubscribeRealtime = null;

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
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) { return '---'; }
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

  function getMembershipTypeName(typeId) {
    const t = membershipTypes.find(x => String(x.id) === String(typeId));
    return t?.name || '—';
  }

  function getDaysRemaining(endDate) {
    if (!endDate) return null;
    try {
      const end = new Date(endDate).getTime();
      const now = Date.now();
      return Math.ceil((end - now) / 86400000);
    } catch (e) { return null; }
  }

  function getHCStatus(endDate) {
    const days = getDaysRemaining(endDate);
    if (days === null) return { label: 'غير محدد', key: 'expired' };
    if (days < 0) return { label: 'منتهية', key: 'expired' };
    if (days <= HC_SOON_DAYS) return { label: 'تنتهي قريبًا', key: 'soon' };
    return { label: 'سارية', key: 'active' };
  }

  /* ============================================
     STATUS MAP (Applications)
     ============================================ */
  const STATUS_MAP = {
    'pending':                  { label: 'بانتظار الفحص',           color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)' },
    'ai_review':                { label: 'فحص تلقائي',              color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)' },
    'under_review':             { label: 'تحت المراجعة',            color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)' },
    'needs_docs':               { label: 'مستندات ناقصة',           color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)' },
    'approved':                 { label: 'مقبول',                   color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)' },
    'rejected':                 { label: 'مرفوض',                   color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)' },
    'awaiting_payment':         { label: 'بانتظار الدفع',            color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)' },
    'paid':                     { label: 'تم الدفع',                 color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)' },
    'awaiting_membership_no':   { label: 'بانتظار رقم العضوية',      color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)' },
    'membership_no_assigned':   { label: 'تم إصدار رقم العضوية',     color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)' },
    'card_processing':          { label: 'تجهيز الكارنية',           color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)' },
    'card_ready':               { label: 'الكارنية جاهز',           color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)' },
    'delivered':                { label: 'تم الاستلام',              color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)' },
    'cancelled':                { label: 'ملغي',                    color: '#888',    bg: 'rgba(136, 136, 136, 0.12)' }
  };

  function getStatusInfo(status) {
    return STATUS_MAP[status] || {
      label: status || 'غير معروف',
      color: '#888',
      bg: 'rgba(136, 136, 136, 0.12)'
    };
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
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

      userRole = userData?.role || 'committee';

      const allowedRoles = [
        'committees_manager_head',
        'committees_manager_vice',
        'head',
        'vice_president',
        'deputy'
      ];

      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة لمدير اللجان فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'موظف';

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      return true;
    } catch (err) {
      console.error('[CommitteesManager] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD LOOKUPS
     ============================================ */
  async function loadLookups() {
    try {
      const { data } = await client
        .from('membership_types')
        .select('*')
        .order('sort_order', { ascending: true });

      membershipTypes = data || [];
    } catch (err) {
      console.error('[CommitteesManager] Lookups error:', err);
    }
  }

  /* ============================================
     LOAD OVERALL STATS
     ============================================ */
  async function loadOverallStats() {
    try {
      // 1) Members stats
      const { data: membersData } = await client
        .from('members')
        .select('has_health_care, health_care_end, governorate')
        .eq('is_active', true);

      let totalMembers = 0;
      let hcTotal = 0;
      let hcActive = 0;
      let prWithContact = 0;
      const govSet = new Set();

      if (membersData) {
        totalMembers = membersData.length;

        membersData.forEach(m => {
          if (m.has_health_care) {
            hcTotal++;
            const st = getHCStatus(m.health_care_end);
            if (st.key === 'active') hcActive++;
          }
          if (m.governorate) govSet.add(m.governorate);
        });
      }

      // 2) Applications stats
      const { data: appsData } = await client
        .from('applications')
        .select('status');

      let pendingApps = 0;
      let approvedApps = 0;

      if (appsData) {
        appsData.forEach(a => {
          if (['pending', 'ai_review', 'under_review', 'needs_docs'].includes(a.status)) {
            pendingApps++;
          } else if (['approved', 'awaiting_payment', 'paid', 'awaiting_membership_no',
                     'membership_no_assigned', 'card_processing', 'card_ready', 'delivered'].includes(a.status)) {
            approvedApps++;
          }
        });
      }

      // 3) Members with contact (for PR)
      try {
        const { data: contactData } = await client
          .from('members')
          .select('phone, email')
          .eq('is_active', true);

        if (contactData) {
          contactData.forEach(m => {
            if (m.phone || m.email) prWithContact++;
          });
        }
      } catch (e) {}

      // Update UI
      setText('statTotalMembers', totalMembers);
      setText('statPendingApps', pendingApps);
      setText('statApprovedApps', approvedApps);
      setText('statHealthCare', hcTotal);
      setText('statGovs', govSet.size);

      // Committee cards stats
      setText('socialHC', hcTotal);
      setText('socialHCActive', hcActive);

      setText('prTotal', totalMembers);
      setText('prWithContact', prWithContact);

      setText('memPending', pendingApps);
      setText('memApproved', approvedApps);

    } catch (e) {
      console.error('[CommitteesManager] Stats error:', e);
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ============================================
     LOAD RECENT APPLICATIONS
     ============================================ */
  async function loadRecentApplications() {
    const tbody = document.getElementById('recentAppsBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <span class="spinner"></span>
              <span>جاري التحميل...</span>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      const { data, error } = await client
        .from('applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT);

      if (error) throw error;

      recentApps = data || [];

      renderRecentApps();

      const countEl = document.getElementById('recentCount');
      if (countEl) countEl.textContent = `${recentApps.length} طلب`;

    } catch (err) {
      console.error('[CommitteesManager] Recent apps error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">
              حدث خطأ: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ============================================
     RENDER RECENT APPS
     ============================================ */
  function renderRecentApps() {
    const tbody = document.getElementById('recentAppsBody');
    if (!tbody) return;

    if (!recentApps.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:50px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:42px;height:42px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:14px;">لا توجد طلبات بعد</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recentApps.map(app => {
      const status = getStatusInfo(app.status);
      const typeName = getMembershipTypeName(app.membership_type_id);
      const initials = getInitials(app.full_name);

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-2-rgb),0.15));border:1px solid rgba(var(--accent-rgb),0.25);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;color:var(--accent);flex-shrink:0;">
                ${escapeHtml(initials)}
              </div>
              <div style="min-width:0;line-height:1.25;">
                <div style="font-weight:700;font-size:13.5px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;">
                  ${escapeHtml(app.full_name)}
                </div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-dim);">
                  ${escapeHtml(app.national_id)}
                </div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:600;">
              ${escapeHtml(app.tracking_no)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 12px;background:rgba(var(--accent-rgb),0.08);border:1px solid rgba(var(--accent-rgb),0.2);border-radius:100px;font-size:12px;color:var(--accent);font-weight:600;white-space:nowrap;">
              ${escapeHtml(typeName)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:100px;font-size:11.5px;color:#22c55e;font-weight:600;white-space:nowrap;">
              ${escapeHtml(app.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:${status.bg};border:1.5px solid ${status.color};border-radius:100px;font-size:11.5px;color:${status.color};font-weight:700;white-space:nowrap;">
              <span style="width:6px;height:6px;border-radius:50%;background:${status.color};"></span>
              ${escapeHtml(status.label)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <div class="time-cell">
              ${ICONS.clock}
              <span>${escapeHtml(timeAgo(app.created_at))}</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['applications', 'members', 'health_care_members'],
      async () => {
        await loadOverallStats();
        await loadRecentApplications();
      },
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function setupListeners() {
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
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

      await loadLookups();

      setupListeners();

      await loadOverallStats();
      await loadRecentApplications();

      setupRealtime();

      console.log('[CommitteesManager] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

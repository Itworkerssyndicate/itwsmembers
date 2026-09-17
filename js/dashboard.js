/* =====================================================
   IT SYNDICATE — Committee Dashboard Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const STATUS_MAP = {
    'pending':         { label: 'بانتظار الفحص',        color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'ai_review':       { label: 'فحص تلقائي',           color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'under_review':    { label: 'تحت المراجعة',         color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'needs_docs':      { label: 'مستندات ناقصة',        color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'approved':        { label: 'مقبول',                color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'rejected':        { label: 'مرفوض',                color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)',   border: '#ff5555' },
    'paid':            { label: 'تم الدفع',              color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'card_processing': { label: 'تجهيز الكارنية',       color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'card_ready':      { label: 'الكارنية جاهز',        color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'delivered':       { label: 'تم الاستلام',          color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'cancelled':       { label: 'ملغي',                 color: '#888',    bg: 'rgba(136, 136, 136, 0.12)', border: '#888' }
  };

  const ALL_STATUSES = Object.keys(STATUS_MAP);

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let applications = [];
  let filteredApplications = [];
  let currentPage = 1;
  let totalCount = 0;
  let filters = {
    status: 'all',
    search: '',
    membershipType: 'all',
    governorate: 'all'
  };
  let sortBy = 'newest'; // newest | oldest | name
  let membershipTypes = [];
  let unsubscribeRealtime = null;
  let currentDetailApp = null;
  let currentDetailAttachments = [];

  /* ============================================
     DOM HELPERS
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
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
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

  function getStatusInfo(status) {
    return STATUS_MAP[status] || {
      label: status || 'غير معروف',
      color: '#888',
      bg: 'rgba(136, 136, 136, 0.12)',
      border: '#888'
    };
  }

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    // Fallback
    console.log(`[${type}] ${message}`);
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    search: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    filter: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    download: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    stats: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    inbox: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    close: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    file: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    image: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    chevronLeft: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevronRight: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  };

  /* ============================================
     AUTH CHECK + ROLE
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

      // Get role from users table
      const { data: userData, error } = await client
        .from('users')
        .select('role, full_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('[Dashboard] User role fetch failed:', error.message);
      }

      // Default role
      userRole = userData?.role || 'committee';
      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'موظف';

      // If head, show admin link
      const adminLink = document.getElementById('adminLink');
      if (adminLink && userRole === 'head') {
        adminLink.style.display = 'flex';
      }

      // Set user name in UI
      const userNameEls = document.querySelectorAll('[data-user-name]');
      userNameEls.forEach(el => {
        el.textContent = window.currentUserName;
      });

      const roleLabel = userRole === 'head' ? 'النقيب العام' : 'لجنة العضويات';
      const roleEls = document.querySelectorAll('[data-user-role]');
      roleEls.forEach(el => {
        el.textContent = roleLabel;
      });

      return true;
    } catch (err) {
      console.error('[Dashboard] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD MEMBERSHIP TYPES
     ============================================ */
  async function loadMembershipTypes() {
    const { data } = await client
      .from('membership_types')
      .select('*')
      .order('id', { ascending: true });

    membershipTypes = data || [];

    // Populate filter select
    const filterSelect = document.getElementById('typeFilter');
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">كل الأنواع</option>';
      membershipTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        filterSelect.appendChild(opt);
      });
    }
  }

  function getTypeName(typeId) {
    const t = membershipTypes.find(x => x.id === typeId);
    return t?.name || '—';
  }

  /* ============================================
     STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('applications')
        .select('status');

      if (error || !data) return;

      const counts = {
        total: data.length,
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        card_ready: 0,
        delivered: 0
      };

      data.forEach(a => {
        if (a.status === 'pending' || a.status === 'ai_review') counts.pending++;
        if (a.status === 'under_review' || a.status === 'needs_docs') counts.under_review++;
        if (a.status === 'approved' || a.status === 'paid') counts.approved++;
        if (a.status === 'rejected') counts.rejected++;
        if (a.status === 'card_ready') counts.card_ready++;
        if (a.status === 'delivered') counts.delivered++;
      });

      renderStats(counts);
    } catch (e) {
      console.error('[Dashboard] Stats error:', e);
    }
  }

  function renderStats(counts) {
    const statsBox = document.getElementById('statsGrid');
    if (!statsBox) return;

    const stats = [
      { key: 'total',        label: 'إجمالي الطلبات',    value: counts.total,        color: '#00f0ff', icon: ICONS.inbox },
      { key: 'pending',      label: 'بانتظار المراجعة',  value: counts.pending,      color: '#ffb800', icon: ICONS.clock },
      { key: 'under_review', label: 'تحت المراجعة',      value: counts.under_review, color: '#00f0ff', icon: ICONS.eye },
      { key: 'approved',     label: 'مقبول / مدفوع',      value: counts.approved,     color: '#00ff9d', icon: ICONS.check },
      { key: 'card_ready',   label: 'كارنية جاهز',       value: counts.card_ready,   color: '#00ff9d', icon: ICONS.file },
      { key: 'delivered',    label: 'تم الاستلام',        value: counts.delivered,    color: '#00ff9d', icon: ICONS.check },
      { key: 'rejected',     label: 'مرفوض',              value: counts.rejected,     color: '#ff5555', icon: ICONS.x }
    ];

    statsBox.innerHTML = stats.map(s => `
      <div class="stat-card" data-status="${s.key}" style="
        padding:18px;
        background:rgba(10, 12, 20, 0.65);
        border:1.5px solid rgba(0, 240, 255, 0.12);
        border-radius:14px;
        cursor:pointer;
        transition:all 0.3s;
        position:relative;
        overflow:hidden;
      ">
        <div style="
          position:absolute;
          top:-30px;
          left:-30px;
          width:120px;
          height:120px;
          border-radius:50%;
          background:radial-gradient(circle, ${s.color}22, transparent 70%);
          pointer-events:none;
        "></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;position:relative;z-index:1;">
          <span style="width:22px;height:22px;display:inline-flex;color:${s.color};">${s.icon}</span>
          <span style="
            font-family:'JetBrains Mono',monospace;
            font-size:26px;
            font-weight:700;
            color:${s.color};
            text-shadow:0 0 20px ${s.color}66;
          ">${s.value}</span>
        </div>
        <div style="font-size:12.5px;color:rgba(255,255,255,0.55);position:relative;z-index:1;">${s.label}</div>
      </div>
    `).join('');

    // Click handlers to filter
    statsBox.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.status;
        let statusVal = 'all';
        if (key === 'pending') statusVal = 'pending';
        else if (key === 'under_review') statusVal = 'under_review';
        else if (key === 'approved') statusVal = 'approved';
        else if (key === 'rejected') statusVal = 'rejected';
        else if (key === 'card_ready') statusVal = 'card_ready';
        else if (key === 'delivered') statusVal = 'delivered';

        const filterEl = document.getElementById('statusFilter');
        if (filterEl) {
          filterEl.value = statusVal;
          filters.status = statusVal;
          currentPage = 1;
          loadApplications();
        }
      });

      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-4px)';
        card.style.borderColor = 'rgba(0, 240, 255, 0.4)';
        card.style.boxShadow = '0 10px 30px rgba(0, 240, 255, 0.15)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.borderColor = '';
        card.style.boxShadow = '';
      });
    });
  }

  /* ============================================
     LOAD APPLICATIONS
     ============================================ */
  async function loadApplications() {
    const tbody = document.getElementById('appsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(0,240,255,0.3);border-top-color:#00f0ff;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
              <span>جاري التحميل...</span>
            </div>
          </td>
        </tr>
      `;
    }

    if (!document.getElementById('dashSpin')) {
      const st = document.createElement('style');
      st.id = 'dashSpin';
      st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(st);
    }

    try {
      // Build query
      let query = client.from('applications').select('*', { count: 'exact' });

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'pending') {
          query = query.in('status', ['pending', 'ai_review']);
        } else if (filters.status === 'under_review') {
          query = query.in('status', ['under_review', 'needs_docs']);
        } else if (filters.status === 'approved') {
          query = query.in('status', ['approved', 'paid']);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      // Membership type filter
      if (filters.membershipType && filters.membershipType !== 'all') {
        query = query.eq('membership_type_id', parseInt(filters.membershipType));
      }

      // Governorate filter
      if (filters.governorate && filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }

      // Search
      if (filters.search) {
        const s = filters.search.trim();
        // Search in name, phone, tracking, national id
        query = query.or(
          `full_name.ilike.%${s}%,phone.ilike.%${s}%,tracking_no.ilike.%${s}%,national_id.ilike.%${s}%`
        );
      }

      // Sort
      if (sortBy === 'newest') query = query.order('created_at', { ascending: false });
      else if (sortBy === 'oldest') query = query.order('created_at', { ascending: true });
      else if (sortBy === 'name') query = query.order('full_name', { ascending: true });

      // Pagination
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      applications = data || [];
      totalCount = count || 0;

      applyLocalFilters();
      renderTable();
      renderPagination();

    } catch (err) {
      console.error('[Dashboard] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:40px;color:#ff5555;">
              حدث خطأ: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  function applyLocalFilters() {
    // Additional client-side filtering if needed
    filteredApplications = applications.slice();
  }

  /* ============================================
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('appsTableBody');
    if (!tbody) return;

    if (!filteredApplications.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:rgba(255,255,255,0.4);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:15px;">لا توجد طلبات مطابقة</div>
              <div style="font-size:13px;">جرب تغيير الفلاتر أو البحث</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredApplications.map(app => {
      const status = getStatusInfo(app.status);
      const typeName = getTypeName(app.membership_type_id);
      const initials = (window.getInitials ? window.getInitials(app.full_name) : '؟');

      return `
        <tr data-id="${app.id}" style="
          cursor:pointer;
          transition:background 0.2s;
          border-bottom:1px solid rgba(0,240,255,0.06);
        ">
          <td style="padding:14px 12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="
                width:36px;
                height:36px;
                border-radius:10px;
                background:linear-gradient(135deg, rgba(0,240,255,0.15), rgba(176,38,255,0.15));
                border:1px solid rgba(0, 240, 255, 0.25);
                display:flex;
                align-items:center;
                justify-content:center;
                font-family:'JetBrains Mono',monospace;
                font-weight:700;
                font-size:12px;
                color:var(--accent, #00f0ff);
                flex-shrink:0;
              ">${escapeHtml(initials)}</div>
              <div style="min-width:0;">
                <div style="font-weight:700;font-size:13.5px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${escapeHtml(app.full_name)}</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:rgba(255,255,255,0.45);">${escapeHtml(app.national_id)}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent, #00f0ff);font-weight:600;">${escapeHtml(app.tracking_no)}</td>
          <td style="padding:14px 12px;">
            <span style="
              display:inline-block;
              padding:4px 12px;
              background:rgba(0,240,255,0.08);
              border:1px solid rgba(0,240,255,0.2);
              border-radius:100px;
              font-size:12px;
              color:var(--accent, #00f0ff);
              font-weight:600;
            ">${escapeHtml(typeName)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:5px 12px;
              background:${status.bg};
              border:1.5px solid ${status.border};
              border-radius:100px;
              font-size:12px;
              color:${status.color};
              font-weight:700;
              white-space:nowrap;
            ">
              <span style="width:6px;height:6px;border-radius:50%;background:${status.color};"></span>
              ${escapeHtml(status.label)}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:rgba(255,255,255,0.6);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(app.phone)}</span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:rgba(255,255,255,0.55);">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="width:12px;height:12px;display:inline-flex;color:rgba(255,255,255,0.4);">${ICONS.clock}</span>
              <span>${escapeHtml(timeAgo(app.created_at))}</span>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <div style="display:flex;gap:6px;justify-content:center;">
              <button class="row-btn view-btn" data-id="${app.id}" title="عرض التفاصيل" style="
                width:32px;height:32px;
                border-radius:8px;
                background:rgba(0,240,255,0.08);
                border:1px solid rgba(0,240,255,0.25);
                color:var(--accent, #00f0ff);
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center;
                transition:all 0.2s;
              ">
                <span style="width:14px;height:14px;display:inline-flex;">${ICONS.eye}</span>
              </button>
              <button class="row-btn edit-btn" data-id="${app.id}" title="تحديث الحالة" style="
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
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind row clicks
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        const id = tr.dataset.id;
        openDetailModal(id);
      });

      tr.addEventListener('mouseenter', () => {
        tr.style.background = 'rgba(0, 240, 255, 0.04)';
      });
      tr.addEventListener('mouseleave', () => {
        tr.style.background = '';
      });
    });

    // View buttons
    tbody.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailModal(btn.dataset.id);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(0,240,255,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(0,240,255,0.08)';
      });
    });

    // Edit buttons
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatusModal(btn.dataset.id);
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(0,255,157,0.2)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(0,255,157,0.08)';
      });
    });
  }

  /* ============================================
     PAGINATION
     ============================================ */
  function renderPagination() {
    const box = document.getElementById('paginationBox');
    if (!box) return;

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (totalPages <= 1) {
      box.innerHTML = '';
      return;
    }

    const btnStyle = (active, disabled) => `
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:36px;
      height:36px;
      padding:0 10px;
      border-radius:10px;
      font-family:inherit;
      font-size:13px;
      font-weight:600;
      cursor:${disabled ? 'not-allowed' : 'pointer'};
      transition:all 0.2s;
      background:${active ? 'linear-gradient(135deg, var(--accent, #00f0ff), var(--accent2, #b026ff))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(0,240,255,0.15)'};
      color:${active ? '#000' : (disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)')};
      opacity:${disabled ? 0.4 : 1};
    `;

    let pagesHTML = '';

    // Prev
    pagesHTML += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="${btnStyle(false, currentPage === 1)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronRight}</span>
    </button>`;

    // Page numbers
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    pages.forEach(p => {
      if (p === '...') {
        pagesHTML += `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;color:rgba(255,255,255,0.4);">…</span>`;
      } else {
        pagesHTML += `<button data-page="${p}" style="${btnStyle(p === currentPage, false)}">${p}</button>`;
      }
    });

    // Next
    pagesHTML += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" style="${btnStyle(false, currentPage === totalPages)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronLeft}</span>
    </button>`;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:20px;">
        <div style="font-size:12.5px;color:rgba(255,255,255,0.5);">
          صفحة ${currentPage} من ${totalPages} — إجمالي ${totalCount} طلب
        </div>
        <div style="display:flex;gap:6px;align-items:center;">${pagesHTML}</div>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== currentPage) {
          currentPage = p;
          loadApplications();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      if (!btn.disabled) {
        btn.addEventListener('mouseenter', () => {
          if (parseInt(btn.dataset.page) !== currentPage) {
            btn.style.background = 'rgba(0,240,255,0.1)';
            btn.style.borderColor = 'rgba(0,240,255,0.4)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          if (parseInt(btn.dataset.page) !== currentPage) {
            btn.style.background = 'rgba(255,255,255,0.04)';
            btn.style.borderColor = 'rgba(0,240,255,0.15)';
          }
        });
      }
    });
  }

  /* ============================================
     DETAIL MODAL
     ============================================ */
  async function openDetailModal(appId) {
    const modal = document.getElementById('detailModal');
    if (!modal) return;

    const content = document.getElementById('detailContent');
    if (content) {
      content.innerHTML = `
        <div style="padding:60px 20px;text-align:center;color:rgba(255,255,255,0.5);">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:18px;height:18px;border:2px solid rgba(0,240,255,0.3);border-top-color:#00f0ff;border-radius:50%;animation:spin 0.8s linear infinite;"></span>
            <span>جاري التحميل...</span>
          </div>
        </div>
      `;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
      // Fetch app
      const { data: app, error: appErr } = await client
        .from('applications')
        .select('*')
        .eq('id', appId)
        .maybeSingle();

      if (appErr || !app) {
        throw new Error('لم يتم العثور على الطلب');
      }

      currentDetailApp = app;

      // Fetch attachments
      const { data: attachments } = await client
        .from('attachments')
        .select('*')
        .eq('application_id', appId);

      currentDetailAttachments = attachments || [];

      // Fetch history
      const { data: history } = await client
        .from('status_history')
        .select('*')
        .eq('application_id', appId)
        .order('changed_at', { ascending: false });

      renderDetailContent(app, currentDetailAttachments, history || []);

    } catch (err) {
      console.error('[Dashboard] Detail error:', err);
      if (content) {
        content.innerHTML = `
          <div style="padding:40px 20px;text-align:center;color:#ff5555;">
            ${escapeHtml(err.message)}
          </div>
        `;
      }
    }
  }

  function renderDetailContent(app, attachments, history) {
    const content = document.getElementById('detailContent');
    if (!content) return;

    const status = getStatusInfo(app.status);
    const typeName = getTypeName(app.membership_type_id);

    const attachmentsByType = {};
    attachments.forEach(a => {
      attachmentsByType[a.doc_type] = a;
    });

    const docLabels = {
      id_front: 'بطاقة الرقم القومي - وجه',
      id_back: 'بطاقة الرقم القومي - ظهر',
      certificate: 'الشهادة الدراسية',
      photo: 'الصورة الشخصية'
    };

    content.innerHTML = `
      <div style="animation:modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);">

        <!-- Header -->
        <div style="
          padding:20px 24px;
          border-bottom:1px solid rgba(0,240,255,0.12);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          flex-wrap:wrap;
          background:linear-gradient(135deg, rgba(0,240,255,0.04), transparent);
        ">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--accent, #00f0ff);margin-bottom:4px;">${escapeHtml(app.tracking_no)}</div>
            <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:${status.bg};border:1.5px solid ${status.border};border-radius:100px;font-size:12px;color:${status.color};font-weight:700;">
              <span style="width:6px;height:6px;border-radius:50%;background:${status.color};"></span>
              ${escapeHtml(status.label)}
            </div>
          </div>
          <button onclick="closeDetailModal()" style="
            width:36px;height:36px;
            border-radius:10px;
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.1);
            color:rgba(255,255,255,0.7);
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
            transition:all 0.2s;
          ">
            <span style="width:16px;height:16px;display:inline-flex;">${ICONS.close}</span>
          </button>
        </div>

        <!-- Body -->
        <div style="padding:24px;overflow-y:auto;max-height:calc(90vh - 200px);">

          <!-- Personal Info -->
          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent, #00f0ff);">${ICONS.user}</span>
            البيانات الشخصية
          </h4>
          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
            gap:12px;
            margin-bottom:24px;
          ">
            ${renderDetailItem('الاسم الرباعي', app.full_name)}
            ${renderDetailItem('الرقم القومي', app.national_id, true)}
            ${renderDetailItem('الموبايل', app.phone, true)}
            ${renderDetailItem('البريد', app.email || '—')}
            ${renderDetailItem('العنوان', app.address || '—')}
            ${renderDetailItem('المحافظة', app.governorate || '—')}
          </div>

          <!-- Professional Info -->
          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent, #00f0ff);">${ICONS.shield}</span>
            البيانات المهنية
          </h4>
          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
            gap:12px;
            margin-bottom:24px;
          ">
            ${renderDetailItem('نوع العضوية', typeName)}
            ${renderDetailItem('المؤهل', app.qualification || '—')}
            ${renderDetailItem('سنة التخرج', app.graduation_year || '—')}
            ${renderDetailItem('جهة العمل', app.employer || '—')}
            ${renderDetailItem('تاريخ التقديم', formatDate(app.created_at))}
          </div>

          <!-- Attachments -->
          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent, #00f0ff);">${ICONS.file}</span>
            المرفقات
          </h4>
          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
            gap:12px;
            margin-bottom:24px;
          ">
            ${Object.entries(docLabels).map(([key, label]) => {
              const att = attachmentsByType[key];
              if (!att) {
                return `
                  <div style="
                    padding:14px;
                    background:rgba(255,85,85,0.06);
                    border:1px solid rgba(255,85,85,0.2);
                    border-radius:12px;
                    text-align:center;
                  ">
                    <div style="font-size:12px;color:#ff5555;margin-bottom:6px;">${escapeHtml(label)}</div>
                    <div style="font-size:11.5px;color:rgba(255,255,255,0.4);">غير مرفق</div>
                  </div>
                `;
              }
              return `
                <div style="
                  padding:14px;
                  background:rgba(0,240,255,0.04);
                  border:1px solid rgba(0,240,255,0.15);
                  border-radius:12px;
                  text-align:center;
                ">
                  <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:8px;">${escapeHtml(label)}</div>
                  <button type="button" onclick="viewAttachment('${escapeHtml(att.file_path)}')" style="
                    padding:6px 14px;
                    background:rgba(0,240,255,0.1);
                    border:1px solid rgba(0,240,255,0.3);
                    color:var(--accent, #00f0ff);
                    border-radius:8px;
                    font-family:inherit;
                    font-size:12px;
                    font-weight:600;
                    cursor:pointer;
                    display:inline-flex;
                    align-items:center;
                    gap:6px;
                  ">
                    <span style="width:12px;height:12px;display:inline-flex;">${ICONS.eye}</span>
                    <span>عرض</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Status History -->
          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent, #00f0ff);">${ICONS.clock}</span>
            سجل الحالات
          </h4>
          <div style="
            padding:16px;
            background:rgba(10, 12, 20, 0.5);
            border:1px solid rgba(0,240,255,0.1);
            border-radius:12px;
            max-height:240px;
            overflow-y:auto;
          ">
            ${history.length === 0
              ? '<div style="text-align:center;color:rgba(255,255,255,0.4);font-size:13px;">لا يوجد سجل بعد</div>'
              : history.map(h => {
                  const st = getStatusInfo(h.new_status);
                  return `
                    <div style="
                      padding:10px 0;
                      border-bottom:1px solid rgba(0,240,255,0.08);
                      display:flex;
                      align-items:center;
                      gap:10px;
                      font-size:12.5px;
                    ">
                      <span style="width:8px;height:8px;border-radius:50%;background:${st.color};flex-shrink:0;"></span>
                      <span style="font-weight:600;color:${st.color};">${escapeHtml(st.label)}</span>
                      <span style="color:rgba(255,255,255,0.4);margin-right:auto;font-family:'JetBrains Mono',monospace;font-size:11px;">${escapeHtml(formatDate(h.changed_at))}</span>
                    </div>
                  `;
                }).join('')
            }
          </div>

        </div>

        <!-- Footer Actions -->
        <div style="
          padding:16px 24px;
          border-top:1px solid rgba(0,240,255,0.12);
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          justify-content:flex-end;
        ">
          <button type="button" onclick="openStatusModal('${app.id}')" style="
            padding:11px 22px;
            background:linear-gradient(135deg, var(--accent, #00f0ff), var(--accent2, #b026ff));
            border:none;
            border-radius:10px;
            color:#000;
            font-family:inherit;
            font-weight:700;
            font-size:13.5px;
            cursor:pointer;
            display:inline-flex;
            align-items:center;
            gap:8px;
          ">
            <span style="width:14px;height:14px;display:inline-flex;">${ICONS.edit}</span>
            <span>تحديث الحالة</span>
          </button>
        </div>

      </div>
    `;
  }

  function renderDetailItem(label, value, isMono = false) {
    return `
      <div style="
        padding:12px 14px;
        background:rgba(10, 12, 20, 0.5);
        border:1px solid rgba(0,240,255,0.08);
        border-radius:10px;
      ">
        <div style="font-size:11.5px;color:rgba(255,255,255,0.45);margin-bottom:4px;">${escapeHtml(label)}</div>
        <div style="
          font-size:13.5px;
          font-weight:600;
          color:#fff;
          ${isMono ? "font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;" : ''}
          word-break:break-word;
        ">${escapeHtml(value || '—')}</div>
      </div>
    `;
  }

  window.closeDetailModal = function () {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentDetailApp = null;
    currentDetailAttachments = [];
  };

  /* ============================================
     VIEW ATTACHMENT
     ============================================ */
  window.viewAttachment = async function (filePath) {
    try {
      const { data, error } = await client.storage
        .from('attachments')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (err) {
      showToast('فشل فتح المرفق: ' + err.message, 'error');
    }
  };

  /* ============================================
     STATUS MODAL
     ============================================ */
  let currentStatusAppId = null;

  window.openStatusModal = function (appId) {
    const modal = document.getElementById('statusModal');
    if (!modal) return;

    currentStatusAppId = appId;

    // Reset form
    const newStatus = document.getElementById('newStatus');
    const notes = document.getElementById('statusNotes');
    if (newStatus) newStatus.value = '';
    if (notes) notes.value = '';

    // Pre-fill if we have current app
    if (currentDetailApp && String(currentDetailApp.id) === String(appId)) {
      if (newStatus) newStatus.value = currentDetailApp.status || '';
      if (notes) notes.value = currentDetailApp.reviewer_notes || '';
    } else {
      const app = applications.find(a => String(a.id) === String(appId));
      if (app) {
        if (newStatus) newStatus.value = app.status || '';
        if (notes) notes.value = app.reviewer_notes || '';
      }
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeStatusModal = function () {
    const modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentStatusAppId = null;
  };

  async function saveStatusUpdate() {
    if (!currentStatusAppId) return;

    const newStatus = document.getElementById('newStatus')?.value;
    const notes = document.getElementById('statusNotes')?.value?.trim() || '';

    if (!newStatus) {
      showToast('اختر الحالة الجديدة', 'warning');
      return;
    }

    const btn = document.getElementById('saveStatusBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span>';
    }

    try {
      const updateData = {
        status: newStatus,
        reviewer_notes: notes || null
      };

      const { error } = await client
        .from('applications')
        .update(updateData)
        .eq('id', currentStatusAppId);

      if (error) throw error;

      // Insert into status_history
      await client.from('status_history').insert([{
        application_id: currentStatusAppId,
        old_status: currentDetailApp?.status || null,
        new_status: newStatus,
        notes: notes || 'تم التحديث من لوحة اللجنة',
        changed_by: currentUser?.email || 'committee'
      }]);

      showToast('تم تحديث الحالة بنجاح', 'success');

      closeStatusModal();
      closeDetailModal();

      // Reload
      await loadApplications();
      await loadStats();

    } catch (err) {
      console.error('[Dashboard] Update error:', err);
      showToast('فشل التحديث: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'حفظ التحديث';
      }
    }
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!applications.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم التتبع', 'الاسم', 'الرقم القومي', 'الموبايل',
      'البريد', 'نوع العضوية', 'المحافظة', 'الحالة', 'تاريخ التقديم'
    ];

    const rows = applications.map(a => [
      a.tracking_no,
      a.full_name,
      a.national_id,
      a.phone,
      a.email || '',
      getTypeName(a.membership_type_id),
      a.governorate || '',
      getStatusInfo(a.status).label,
      formatDate(a.created_at)
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `applications_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير البيانات', 'success');
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['applications', 'status_history'],
      async () => {
        await loadApplications();
        await loadStats();
      },
      { debounceMs: 400, immediate: false }
    );
  }

  /* ============================================
     FILTERS + SEARCH UI
     ============================================ */
  function setupFilters() {
    // Status
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    // Type
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        filters.membershipType = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    // Governorate
    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const debouncedSearch = window.debounce ? window.debounce(() => {
        filters.search = searchInput.value;
        currentPage = 1;
        loadApplications();
      }, 400) : () => {};

      searchInput.addEventListener('input', debouncedSearch);
    }

    // Sort
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadApplications();
        await loadStats();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    // Save status
    const saveBtn = document.getElementById('saveStatusBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveStatusUpdate);
    }
  }

  /* ============================================
     MODAL CLOSE ON BACKDROP
     ============================================ */
  function setupModalBackdrops() {
    ['detailModal', 'statusModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'detailModal') window.closeDetailModal();
          else window.closeStatusModal();
        }
      });
    });

    // ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeDetailModal();
        window.closeStatusModal();
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

      // Auth
      const ok = await checkAuth();
      if (!ok) return;

      // Load types
      await loadMembershipTypes();

      // Setup UI
      setupFilters();
      setupModalBackdrops();

      // Load data
      await loadStats();
      await loadApplications();

      // Realtime
      setupRealtime();

      console.log('[Dashboard] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

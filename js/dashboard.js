/* =====================================================
   IT SYNDICATE — Dashboard Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;

  const STATUS_MAP = {
    'pending':                { label: 'بانتظار الفحص',          color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'ai_review':              { label: 'فحص تلقائي',             color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'under_review':           { label: 'تحت المراجعة',           color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'needs_docs':             { label: 'مستندات ناقصة',          color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'approved':               { label: 'مقبول',                  color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'rejected':               { label: 'مرفوض',                  color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)',   border: '#ff5555' },
    'awaiting_payment':       { label: 'بانتظار الدفع',           color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'paid':                   { label: 'تم الدفع',                color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'awaiting_membership_no': { label: 'بانتظار رقم العضوية',     color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800' },
    'membership_no_assigned': { label: 'تم إصدار رقم العضوية',    color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'card_processing':        { label: 'تجهيز الكارنية',         color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff' },
    'card_ready':             { label: 'الكارنية جاهز',          color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'delivered':              { label: 'تم الاستلام',              color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d' },
    'cancelled':              { label: 'ملغي',                    color: '#888',    bg: 'rgba(136, 136, 136, 0.12)', border: '#888' }
  };

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
  let sortBy = 'newest';
  let membershipTypes = [];
  let unsubscribeRealtime = null;
  let currentDetailApp = null;
  let currentDetailAttachments = [];
  let reportData = [];

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
    console.log(`[${type}] ${message}`);
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    phone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    stats: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
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

      const { data: userData, error } = await client
        .from('users')
        .select('role, full_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) console.warn('[Dashboard] Role fetch failed:', error.message);

      userRole = userData?.role || 'committee';
      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'موظف';

      // Show admin link if head
      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';
      }

      // Set user name
      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      const roleLabel = userRole === 'head' ? 'النقيب العام'
                      : userRole === 'vice_president' ? 'نائب رئيس النقابة'
                      : 'لجنة العضويات';

      document.querySelectorAll('[data-user-role]').forEach(el => {
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
      .order('sort_order', { ascending: true });

    membershipTypes = data || [];

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
        .select('status, governorate');

      if (error || !data) return;

      const counts = {
        total: data.length,
        pending: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
        paid: 0,
        card_ready: 0,
        delivered: 0
      };

      data.forEach(a => {
        if (a.status === 'pending' || a.status === 'ai_review') counts.pending++;
        if (a.status === 'under_review' || a.status === 'needs_docs') counts.under_review++;
        if (a.status === 'approved' || a.status === 'awaiting_payment') counts.approved++;
        if (a.status === 'paid') counts.paid++;
        if (a.status === 'rejected') counts.rejected++;
        if (a.status === 'card_ready' || a.status === 'card_processing') counts.card_ready++;
        if (a.status === 'delivered') counts.delivered++;
      });

      renderStats(counts);
      buildReport(data);
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
      { key: 'approved',     label: 'مقبول',             value: counts.approved,     color: '#00ff9d', icon: ICONS.check },
      { key: 'paid',         label: 'مدفوع',              value: counts.paid,         color: '#00ff9d', icon: ICONS.shield },
      { key: 'card_ready',   label: 'كارنية جاهز',       value: counts.card_ready,   color: '#00ff9d', icon: ICONS.file },
      { key: 'delivered',    label: 'تم الاستلام',        value: counts.delivered,    color: '#00ff9d', icon: ICONS.check },
      { key: 'rejected',     label: 'مرفوض',              value: counts.rejected,     color: '#ff5555', icon: ICONS.x }
    ];

    statsBox.innerHTML = stats.map(s => `
      <div class="stat-card" data-status="${s.key}" style="padding:18px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;left:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle, ${s.color}22, transparent 70%);pointer-events:none;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;position:relative;z-index:1;">
          <span style="width:22px;height:22px;display:inline-flex;color:${s.color};">${s.icon}</span>
          <span class="stat-num" style="color:${s.color};text-shadow:0 0 20px ${s.color}66;">${s.value}</span>
        </div>
        <div class="stat-label" style="position:relative;z-index:1;">${s.label}</div>
      </div>
    `).join('');

    statsBox.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.status;
        let statusVal = 'all';
        if (key === 'pending') statusVal = 'pending';
        else if (key === 'under_review') statusVal = 'under_review';
        else if (key === 'approved') statusVal = 'approved';
        else if (key === 'rejected') statusVal = 'rejected';
        else if (key === 'paid') statusVal = 'paid';
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
    });
  }

  /* ============================================
     GOVERNORATE REPORT
     ============================================ */
  function buildReport(data) {
    const counts = {};
    data.forEach(a => {
      const gov = a.governorate || 'غير محدد';
      counts[gov] = (counts[gov] || 0) + 1;
    });

    reportData = Object.entries(counts).map(([name, count]) => ({ name, count }));
    reportData.sort((a, b) => b.count - a.count);

    const total = data.length;

    const grid = document.getElementById('reportGrid');
    const totalEl = document.getElementById('reportTotal');

    if (totalEl) totalEl.textContent = `الإجمالي: ${total} طلب`;

    if (grid) {
      if (reportData.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-dim);">لا توجد بيانات</div>';
      } else {
        grid.innerHTML = reportData.map(r => `
          <div class="report-gov-card">
            <div class="report-gov-name">${escapeHtml(r.name)}</div>
            <div class="report-gov-count">${r.count}</div>
          </div>
        `).join('');
      }
    }
  }

  /* ============================================
     LOAD APPLICATIONS
     ============================================ */
  async function loadApplications() {
    const tbody = document.getElementById('appsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:40px;color:var(--text-dim);">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <span class="spinner"></span>
              <span>جاري التحميل...</span>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      let query = client.from('applications').select('*', { count: 'exact' });

      // Status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Type filter
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

      renderTable();
      renderPagination();

      const countEl = document.getElementById('tableCount');
      if (countEl) countEl.textContent = `${totalCount} طلب`;

    } catch (err) {
      console.error('[Dashboard] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center;padding:40px;color:var(--danger);">
              حدث خطأ: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ============================================
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('appsTableBody');
    if (!tbody) return;

    if (!applications.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:15px;">لا توجد طلبات مطابقة</div>
              <div style="font-size:13px;">جرب تغيير الفلاتر أو البحث</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = applications.map(app => {
      const status = getStatusInfo(app.status);
      const typeName = getTypeName(app.membership_type_id);
      const initials = (window.getInitials ? window.getInitials(app.full_name) : '؟');

      return `
        <tr data-id="${app.id}" style="cursor:pointer;transition:background 0.2s;border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;">
            <div class="member-cell">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-info">
                <div class="member-name">${escapeHtml(app.full_name)}</div>
                <div class="member-nid">${escapeHtml(app.national_id)}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <span class="tracking-cell">${escapeHtml(app.tracking_no)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="type-badge">${escapeHtml(typeName)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="governorate-cell">${escapeHtml(app.governorate || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:${status.bg};border:1.5px solid ${status.border};border-radius:100px;font-size:12px;color:${status.color};font-weight:700;white-space:nowrap;">
              <span style="width:6px;height:6px;border-radius:50%;background:${status.color};"></span>
              ${escapeHtml(status.label)}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(app.phone)}</span>
          </td>
          <td style="padding:14px 12px;">
            <div class="time-cell">
              ${ICONS.clock}
              <span>${escapeHtml(timeAgo(app.created_at))}</span>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn view-btn" data-action="view" data-id="${app.id}" title="عرض التفاصيل">
                ${ICONS.eye}
              </button>
              <button class="row-btn edit-btn" data-action="edit" data-id="${app.id}" title="تحديث الحالة">
                ${ICONS.edit}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Row click
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openDetailModal(tr.dataset.id);
      });
      tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(var(--accent-rgb), 0.04)'; });
      tr.addEventListener('mouseleave', () => { tr.style.background = ''; });
    });

    // Buttons
    tbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'view') openDetailModal(id);
        else if (action === 'edit') openStatusModal(id);
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
      display:inline-flex;align-items:center;justify-content:center;
      min-width:36px;height:36px;padding:0 10px;border-radius:10px;
      font-family:inherit;font-size:13px;font-weight:600;
      cursor:${disabled ? 'not-allowed' : 'pointer'};
      transition:all 0.2s;
      background:${active ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(var(--accent-rgb), 0.15)'};
      color:${active ? '#000' : (disabled ? 'var(--text-faint)' : 'var(--text-muted)')};
      opacity:${disabled ? 0.4 : 1};
    `;

    let pagesHTML = '';

    pagesHTML += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="${btnStyle(false, currentPage === 1)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronRight}</span>
    </button>`;

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
        pagesHTML += `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;color:var(--text-dim);">…</span>`;
      } else {
        pagesHTML += `<button data-page="${p}" style="${btnStyle(p === currentPage, false)}">${p}</button>`;
      }
    });

    pagesHTML += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" style="${btnStyle(false, currentPage === totalPages)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronLeft}</span>
    </button>`;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="font-size:12.5px;color:var(--text-dim);">
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
        <div style="padding:60px 20px;text-align:center;color:var(--text-muted);">
          <div style="display:inline-flex;align-items:center;gap:10px;">
            <span class="spinner"></span>
            <span>جاري التحميل...</span>
          </div>
        </div>
      `;
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
      const { data: app, error: appErr } = await client
        .from('applications')
        .select('*')
        .eq('id', appId)
        .maybeSingle();

      if (appErr || !app) throw new Error('لم يتم العثور على الطلب');

      currentDetailApp = app;

      const { data: attachments } = await client
        .from('attachments')
        .select('*')
        .eq('application_id', appId);

      currentDetailAttachments = attachments || [];

      const { data: history } = await client
        .from('status_history')
        .select('*')
        .eq('application_id', appId)
        .order('created_at', { ascending: false });

      renderDetailContent(app, currentDetailAttachments, history || []);

    } catch (err) {
      console.error('[Dashboard] Detail error:', err);
      if (content) {
        content.innerHTML = `
          <div style="padding:40px 20px;text-align:center;color:var(--danger);">
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
    attachments.forEach(a => { attachmentsByType[a.doc_type] = a; });

    const docLabels = {
      id_front: 'بطاقة الرقم القومي - وجه',
      id_back: 'بطاقة الرقم القومي - ظهر',
      certificate: 'الشهادة الدراسية',
      photo: 'الصورة الشخصية',
      work_certificate: 'شهادة إثبات عمل',
      criminal_record: 'فيش وتشبيه'
    };

    content.innerHTML = `
      <div style="animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);">

        <div style="padding:20px 24px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(135deg, rgba(var(--accent-rgb), 0.04), transparent);">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:var(--accent);margin-bottom:4px;">${escapeHtml(app.tracking_no)}</div>
            <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;background:${status.bg};border:1.5px solid ${status.border};border-radius:100px;font-size:12px;color:${status.color};font-weight:700;">
              <span style="width:6px;height:6px;border-radius:50%;background:${status.color};"></span>
              ${escapeHtml(status.label)}
            </div>
          </div>
          <button onclick="closeDetailModal()" style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <span style="width:16px;height:16px;display:inline-flex;">${ICONS.close}</span>
          </button>
        </div>

        <div style="padding:24px;overflow-y:auto;max-height:calc(90vh - 200px);">

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.user}</span>
            البيانات الشخصية
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:24px;">
            ${renderDetailItem('الاسم الرباعي', app.full_name)}
            ${renderDetailItem('الرقم القومي', app.national_id, true)}
            ${renderDetailItem('الموبايل', app.phone, true)}
            ${renderDetailItem('البريد', app.email || '—')}
            ${renderDetailItem('العنوان', app.address || '—')}
            ${renderDetailItem('المحافظة', app.governorate || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.shield}</span>
            البيانات المهنية
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:24px;">
            ${renderDetailItem('نوع العضوية', typeName)}
            ${renderDetailItem('المؤهل', app.qualification || '—')}
            ${renderDetailItem('سنة التخرج', app.graduation_year || '—')}
            ${renderDetailItem('التقدير', app.grade || '—')}
            ${renderDetailItem('جهة العمل', app.employer || '—')}
            ${renderDetailItem('المسمى الوظيفي', app.job_title || '—')}
            ${renderDetailItem('تاريخ التقديم', formatDate(app.created_at))}
          </div>

          ${app.is_other_syndicate ? `
            <div style="padding:12px 16px;background:rgba(var(--warning-rgb),0.08);border:1px solid rgba(var(--warning-rgb),0.3);border-radius:10px;margin-bottom:24px;">
              <div style="font-size:12px;color:var(--warning);font-weight:600;">مقيد في نقابة أخرى:</div>
              <div style="font-size:14px;color:var(--text);font-weight:700;margin-top:4px;">${escapeHtml(app.other_syndicate || '—')}</div>
            </div>
          ` : ''}

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.file}</span>
            المرفقات
          </h4>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:24px;">
            ${Object.entries(docLabels).map(([key, label]) => {
              const att = attachmentsByType[key];
              if (!att) {
                return `
                  <div style="padding:14px;background:rgba(var(--danger-rgb),0.06);border:1px solid rgba(var(--danger-rgb),0.2);border-radius:12px;text-align:center;">
                    <div style="font-size:12px;color:var(--danger);margin-bottom:6px;">${escapeHtml(label)}</div>
                    <div style="font-size:11.5px;color:var(--text-dim);">غير مرفق</div>
                  </div>
                `;
              }
              return `
                <div style="padding:14px;background:rgba(var(--accent-rgb),0.04);border:1px solid rgba(var(--accent-rgb),0.15);border-radius:12px;text-align:center;">
                  <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">${escapeHtml(label)}</div>
                  ${att.ai_verified ? `<div style="font-size:11px;color:var(--success);margin-bottom:6px;">✓ فحص آلي: ${att.ai_score ? Math.round(att.ai_score) + '%' : 'نعم'}</div>` : ''}
                  <button type="button" onclick="viewAttachment('${escapeHtml(att.file_path)}')" style="padding:6px 14px;background:rgba(var(--accent-rgb),0.1);border:1px solid rgba(var(--accent-rgb),0.3);color:var(--accent);border-radius:8px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                    <span style="width:12px;height:12px;display:inline-flex;">${ICONS.eye}</span>
                    <span>عرض</span>
                  </button>
                </div>
              `;
            }).join('')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.clock}</span>
            سجل الحالات
          </h4>
          <div style="padding:16px;background:rgba(10, 12, 20, 0.5);border:1px solid var(--border-soft);border-radius:12px;max-height:280px;overflow-y:auto;">
            ${history.length === 0
              ? '<div style="text-align:center;color:var(--text-dim);font-size:13px;">لا يوجد سجل بعد</div>'
              : history.map(h => {
                  const st = getStatusInfo(h.new_status);
                  return `
                    <div style="padding:10px 0;border-bottom:1px solid var(--border-soft);display:flex;flex-direction:column;gap:6px;font-size:12.5px;">
                      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${st.color};flex-shrink:0;"></span>
                        <span style="font-weight:600;color:${st.color};">${escapeHtml(st.label)}</span>
                        <span style="color:var(--text-dim);margin-right:auto;font-family:'JetBrains Mono',monospace;font-size:11px;">${escapeHtml(formatDate(h.created_at))}</span>
                      </div>
                      ${h.notes ? `<div style="padding-right:18px;color:var(--text-muted);font-size:12px;">${escapeHtml(h.notes)}</div>` : ''}
                      ${h.changed_by_name ? `<div style="padding-right:18px;color:var(--text-dim);font-size:11px;">— ${escapeHtml(h.changed_by_name)}</div>` : ''}
                    </div>
                  `;
                }).join('')
            }
          </div>

        </div>

        <div style="padding:16px 24px;border-top:1px solid var(--border-soft);display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
          <button type="button" onclick="openStatusModal('${app.id}')" style="padding:11px 22px;background:linear-gradient(135deg, var(--accent), var(--accent-2));border:none;border-radius:10px;color:#000;font-family:inherit;font-weight:700;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
            <span style="width:14px;height:14px;display:inline-flex;">${ICONS.edit}</span>
            <span>تحديث الحالة</span>
          </button>
        </div>

      </div>
    `;
  }

  function renderDetailItem(label, value, isMono = false) {
    return `
      <div style="padding:12px 14px;background:rgba(10, 12, 20, 0.5);border:1px solid var(--border-soft);border-radius:10px;">
        <div style="font-size:11.5px;color:var(--text-dim);margin-bottom:4px;">${escapeHtml(label)}</div>
        <div style="font-size:13.5px;font-weight:600;color:var(--text);${isMono ? "font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;" : ''}word-break:break-word;">
          ${escapeHtml(value || '—')}
        </div>
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

    const newStatus = document.getElementById('newStatus');
    const notes = document.getElementById('statusNotes');
    const missingField = document.getElementById('missingDocsField');

    if (newStatus) newStatus.value = '';
    if (notes) notes.value = '';
    if (missingField) missingField.style.display = 'none';

    // Reset checkboxes
    document.querySelectorAll('input[name="missing_doc"]').forEach(cb => { cb.checked = false; });

    // Pre-fill
    if (currentDetailApp && String(currentDetailApp.id) === String(appId)) {
      if (newStatus) newStatus.value = currentDetailApp.status || '';
      if (notes) notes.value = currentDetailApp.reviewer_notes || '';

      if (currentDetailApp.status === 'needs_docs' && currentDetailApp.missing_docs) {
        if (missingField) missingField.style.display = 'block';
        currentDetailApp.missing_docs.forEach(docKey => {
          const cb = document.querySelector(`input[name="missing_doc"][value="${docKey}"]`);
          if (cb) cb.checked = true;
        });
      }
    } else {
      const app = applications.find(a => String(a.id) === String(appId));
      if (app) {
        if (newStatus) newStatus.value = app.status || '';
        if (notes) notes.value = app.reviewer_notes || '';
      }
    }

    // Show/hide missing docs field on status change
    if (newStatus) {
      newStatus.addEventListener('change', () => {
        if (missingField) {
          missingField.style.display = newStatus.value === 'needs_docs' ? 'block' : 'none';
        }
      });
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

    // لو needs_docs → لازم نختار أوراق
    let missingDocs = [];
    if (newStatus === 'needs_docs') {
      document.querySelectorAll('input[name="missing_doc"]:checked').forEach(cb => {
        missingDocs.push(cb.value);
      });
      if (missingDocs.length === 0) {
        showToast('اختر الأوراق الناقصة', 'warning');
        return;
      }
    }

    const btn = document.getElementById('saveStatusBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span><span class="spinner"></span>';
    }

    try {
      const updateData = {
        status: newStatus,
        reviewer_notes: notes || null,
        reviewed_by: currentUser?.id,
        reviewed_at: new Date().toISOString()
      };

      if (newStatus === 'needs_docs') {
        updateData.missing_docs = missingDocs;
        updateData.docs_requested_at = new Date().toISOString();
      }

      const { error } = await client
        .from('applications')
        .update(updateData)
        .eq('id', currentStatusAppId);

      if (error) throw error;

      showToast('تم تحديث الحالة بنجاح', 'success');

      closeStatusModal();
      closeDetailModal();

      await loadApplications();
      await loadStats();

    } catch (err) {
      console.error('[Dashboard] Update error:', err);
      showToast('فشل التحديث: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="20 6 9 17 4 12"/></svg><span>حفظ التحديث</span>';
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
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     FILTERS
     ============================================ */
  function setupFilters() {
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        filters.membershipType = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const debouncedSearch = window.debounce ? window.debounce(() => {
        filters.search = searchInput.value;
        currentPage = 1;
        loadApplications();
      }, 400) : () => {};

      searchInput.addEventListener('input', debouncedSearch);
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

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

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    const saveBtn = document.getElementById('saveStatusBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveStatusUpdate);
    }
  }

  /* ============================================
     MODAL BACKDROPS
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

      const ok = await checkAuth();
      if (!ok) return;

      await loadMembershipTypes();

      setupFilters();
      setupModalBackdrops();

      await loadStats();
      await loadApplications();

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

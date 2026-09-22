/* =====================================================
   IT SYNDICATE — Head Approval Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const CARD_BUCKET = 'cards';
  const MAX_CARD_SIZE = 5 * 1024 * 1024;
  const ALLOWED_CARD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  /* ============================================
     STATUS MAP
     ============================================ */
  const STATUS_MAP = {
    'paid':                     { label: 'تم الدفع',                 cls: 'status-paid' },
    'awaiting_membership_no':   { label: 'بانتظار رقم العضوية',      cls: 'status-awaiting' },
    'membership_no_assigned':   { label: 'تم إصدار رقم العضوية',     cls: 'status-assigned' },
    'card_processing':          { label: 'جاري تجهيز الكارنية',      cls: 'status-assigned' },
    'card_ready':               { label: 'كارنية جاهز',             cls: 'status-card-ready' },
    'delivered':                { label: 'تم الاستلام',              cls: 'status-delivered' }
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let applications = [];
  let currentPage = 1;
  let totalCount = 0;
  let branches = [];
  let governorates = [];
  let membershipTypes = [];
  let filters = {
    status: 'all',
    search: '',
    governorate: 'all'
  };
  let sortBy = 'newest';
  let unsubscribeRealtime = null;
  let currentAssignApp = null;
  let currentCardApp = null;
  let currentCardFile = null;

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
      cls: 'status-awaiting'
    };
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

  function getTypeName(typeId) {
    const t = membershipTypes.find(x => String(x.id) === String(typeId));
    return t?.name || '—';
  }

  function formatMoney(n) {
    if (n === null || n === undefined || n === '') return '—';
    return parseFloat(n).toLocaleString('ar-EG') + ' ج';
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    approve: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    card: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    health: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>',
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
      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'موظف';

      // الأدوار المسموح لها بالدخول
      const allowedRoles = ['head', 'vice_president', 'deputy'];
      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للنقيب العام ونوابه فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      // Show admin link if head
      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      return true;
    } catch (err) {
      console.error('[HeadApproval] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD LOOKUPS
     ============================================ */
  async function loadLookups() {
    try {
      const [typesRes, branchesRes, govRes] = await Promise.all([
        client.from('membership_types').select('*').order('sort_order', { ascending: true }),
        client.from('branches').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        client.from('governorates').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      ]);

      membershipTypes = typesRes.data || [];
      branches = branchesRes.data || [];
      governorates = govRes.data || [];

      // Fill branch filter
      const branchSelect = document.getElementById('assignBranch');
      if (branchSelect) {
        branchSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';
        branches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          branchSelect.appendChild(opt);
        });
      }

      // Fill gov filter
      const govFilter = document.getElementById('govFilter');
      if (govFilter) {
        govFilter.innerHTML = '<option value="all">كل المحافظات</option>';
        governorates.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.name;
          opt.textContent = g.name;
          govFilter.appendChild(opt);
        });
      }

    } catch (err) {
      console.error('[HeadApproval] Lookups error:', err);
    }
  }

  /* ============================================
     LOAD STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('applications')
        .select('status')
        .in('status', [
          'paid',
          'awaiting_membership_no',
          'membership_no_assigned',
          'card_processing',
          'card_ready',
          'delivered'
        ]);

      if (error || !data) return;

      const counts = {
        awaiting: 0,
        assigned: 0,
        processing: 0,
        card_ready: 0,
        delivered: 0,
        total: data.length
      };

      data.forEach(a => {
        if (a.status === 'awaiting_membership_no') counts.awaiting++;
        else if (a.status === 'membership_no_assigned') counts.assigned++;
        else if (a.status === 'card_processing') counts.processing++;
        else if (a.status === 'card_ready') counts.card_ready++;
        else if (a.status === 'delivered') counts.delivered++;
      });

      const setNum = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      setNum('statAwaiting', counts.awaiting);
      setNum('statAssigned', counts.assigned);
      setNum('statProcessing', counts.processing);
      setNum('statCardReady', counts.card_ready);
      setNum('statDelivered', counts.delivered);
      setNum('statTotal', counts.total);

    } catch (e) {
      console.error('[HeadApproval] Stats error:', e);
    }
  }

  /* ============================================
     LOAD APPLICATIONS
     ============================================ */
  async function loadApplications() {
    const tbody = document.getElementById('approvalTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:40px;color:var(--text-dim);">
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <span class="spinner"></span>
              <span>جاري التحميل...</span>
            </div>
          </td>
        </tr>
      `;
    }

    try {
      let query = client
        .from('applications')
        .select('*', { count: 'exact' })
        .in('status', [
          'paid',
          'awaiting_membership_no',
          'membership_no_assigned',
          'card_processing',
          'card_ready',
          'delivered'
        ]);

      // Status filter
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Governorate filter
      if (filters.governorate && filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }

      // Search
      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${s}%,phone.ilike.%${s}%,tracking_no.ilike.%${s}%,national_id.ilike.%${s}%,membership_no.ilike.%${s}%`
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
      console.error('[HeadApproval] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;padding:40px;color:var(--danger);">
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
    const tbody = document.getElementById('approvalTableBody');
    if (!tbody) return;

    if (!applications.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:15px;">لا توجد طلبات معتمدة</div>
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
      const initials = getInitials(app.full_name);
      const hasHC = app.wants_health_care === true;
      const membershipNo = app.membership_no || '—';
      const totalAmount = (parseFloat(app.membership_fee) || 0) + (parseFloat(app.health_care_amount) || 0);

      // Buttons based on status
      const canAssign = app.status === 'paid' || app.status === 'awaiting_membership_no';
      const canUploadCard = app.status === 'membership_no_assigned' || app.status === 'card_processing';

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
            <span style="display:inline-block;padding:4px 12px;background:rgba(var(--accent-rgb),0.08);border:1px solid rgba(var(--accent-rgb),0.2);border-radius:100px;font-size:12px;color:var(--accent);font-weight:600;white-space:nowrap;">
              ${escapeHtml(typeName)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;white-space:nowrap;">
              ${escapeHtml(app.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;">
            ${hasHC ? `
              <span class="hc-badge">
                ${ICONS.health}
                <span>نعم</span>
              </span>
            ` : `
              <span style="font-size:12px;color:var(--text-dim);">لا</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--success);font-weight:700;white-space:nowrap;">
              ${formatMoney(totalAmount)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span class="status-badge ${status.cls}">
              <span class="dot"></span>
              ${escapeHtml(status.label)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            ${app.membership_no ? `
              <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--success);font-weight:700;">
                ${escapeHtml(app.membership_no)}
              </span>
            ` : `
              <span style="font-size:11.5px;color:var(--text-dim);">—</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);">
              <span style="width:12px;height:12px;display:inline-flex;">${ICONS.clock}</span>
              <span>${escapeHtml(timeAgo(app.created_at))}</span>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              ${canAssign ? `
                <button class="row-btn approve-btn" data-action="assign" data-id="${app.id}" title="إصدار رقم العضوية">
                  ${ICONS.approve}
                </button>
              ` : ''}
              ${canUploadCard ? `
                <button class="row-btn card-btn" data-action="upload-card" data-id="${app.id}" title="رفع صورة الكارنية">
                  ${ICONS.card}
                </button>
              ` : ''}
              <button class="row-btn view-btn" data-action="view" data-id="${app.id}" title="عرض التفاصيل">
                ${ICONS.eye}
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
        if (action === 'assign') openAssignModal(id);
        else if (action === 'upload-card') openCardModal(id);
        else if (action === 'view') openDetailModal(id);
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
     GENERATE MEMBERSHIP NO
     ============================================ */
  async function generateMembershipNo(branchId) {
    try {
      // Get prefix from settings
      let prefix = 'MEM';
      if (window.SettingsManager) {
        prefix = window.SettingsManager.get('membership_no_prefix', 'MEM');
      }

      const year = new Date().getFullYear();

      // Get branch code
      let branchCode = '';
      if (branchId) {
        const br = branches.find(b => String(b.id) === String(branchId));
        if (br?.code) branchCode = '-' + br.code;
      }

      // Count existing in this branch this year
      let query = client
        .from('members')
        .select('id', { count: 'exact', head: true })
        .like('membership_no', `${prefix}-${year}${branchCode}-%`);

      const { count } = await query;

      const nextNum = (count || 0) + 1;
      const padded = String(nextNum).padStart(5, '0');

      return `${prefix}-${year}${branchCode}-${padded}`;
    } catch (e) {
      console.warn('[generateMembershipNo]', e);
      const year = new Date().getFullYear();
      const padded = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
      return `MEM-${year}-${padded}`;
    }
  }

  /* ============================================
     ASSIGN MODAL
     ============================================ */
  async function openAssignModal(appId) {
    const modal = document.getElementById('assignModal');
    if (!modal) return;

    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) {
      showToast('لم يتم العثور على الطلب', 'error');
      return;
    }

    currentAssignApp = app;

    document.getElementById('assignAppId').value = app.id;
    document.getElementById('assignMemberName').value = app.full_name || '';
    document.getElementById('assignBranch').value = app.branch_id || '';
    document.getElementById('assignDuration').value = 12;
    document.getElementById('assignHealthCare').checked = app.wants_health_care === true;

    // Auto-generate membership no
    const autoNo = await generateMembershipNo(app.branch_id);
    document.getElementById('assignNo').value = autoNo;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeAssignModal = function () {
    const modal = document.getElementById('assignModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentAssignApp = null;
  };

  async function confirmAssign() {
    if (!currentAssignApp) return;

    const branchId = document.getElementById('assignBranch').value;
    const membershipNo = document.getElementById('assignNo').value.trim();
    const duration = parseInt(document.getElementById('assignDuration').value) || 12;
    const hasHealthCare = document.getElementById('assignHealthCare').checked;

    if (!branchId) {
      showToast('اختر الشعبة أولًا', 'warning');
      return;
    }

    if (!membershipNo) {
      showToast('رقم العضوية مطلوب', 'warning');
      return;
    }

    const btn = document.getElementById('confirmAssignBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الاعتماد...</span><span class="spinner"></span>';
    }

    try {
      const app = currentAssignApp;
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const endDate = new Date(now.getFullYear(), now.getMonth() + duration, now.getDate())
        .toISOString().slice(0, 10);

      // 1) Create member record
      const memberPayload = {
        membership_no: membershipNo,
        application_id: app.id,
        full_name: app.full_name,
        national_id: app.national_id,
        birth_date: app.birth_date,
        age: app.age,
        phone: app.phone,
        email: app.email,
        address: app.address,
        governorate: app.governorate,
        governorate_id: app.governorate_id,
        qualification: app.qualification,
        graduation_year: app.graduation_year,
        grade: app.grade,
        employer: app.employer,
        job_title: app.job_title,
        membership_type_id: app.membership_type_id,
        branch_id: parseInt(branchId),
        has_health_care: hasHealthCare,
        health_care_start: hasHealthCare ? startDate : null,
        health_care_end: hasHealthCare ? endDate : null,
        health_care_amount: hasHealthCare ? (parseFloat(app.health_care_amount) || 0) : 0,
        total_paid: (parseFloat(app.membership_fee) || 0) + (parseFloat(app.health_care_amount) || 0),
        membership_start: startDate,
        membership_end: endDate,
        card_status: 'not_issued',
        is_active: true,
        registration_source: 'online'
      };

      const { data: memberData, error: memberErr } = await client
        .from('members')
        .insert([memberPayload])
        .select()
        .single();

      if (memberErr) throw new Error('فشل إنشاء العضو: ' + memberErr.message);

      // 2) Update application
      const { error: appErr } = await client
        .from('applications')
        .update({
          status: 'membership_no_assigned',
          membership_no: membershipNo,
          member_id: memberData.id,
          branch_id: parseInt(branchId),
          reviewed_by: currentUser.id,
          reviewed_at: now.toISOString()
        })
        .eq('id', app.id);

      if (appErr) throw new Error('فشل تحديث الطلب: ' + appErr.message);

      // 3) Log status history
      try {
        await client.from('status_history').insert([{
          application_id: app.id,
          old_status: app.status,
          new_status: 'membership_no_assigned',
          notes: `تم إصدار رقم العضوية: ${membershipNo}`,
          changed_by: currentUser.id,
          changed_by_name: window.currentUserName,
          is_auto: false
        }]);
      } catch (e) {}

      showToast(`تم اعتماد رقم العضوية: ${membershipNo}`, 'success');

      closeAssignModal();
      await loadApplications();
      await loadStats();

    } catch (err) {
      console.error('[HeadApproval] Assign error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="20 6 9 17 4 12"/></svg><span>اعتماد رقم العضوية</span>';
      }
    }
  }

  /* ============================================
     CARD MODAL
     ============================================ */
  function openCardModal(appId) {
    const modal = document.getElementById('cardModal');
    if (!modal) return;

    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) {
      showToast('لم يتم العثور على الطلب', 'error');
      return;
    }

    currentCardApp = app;
    currentCardFile = null;

    document.getElementById('cardAppId').value = app.id;
    document.getElementById('cardMemberName').value = app.full_name || '';
    document.getElementById('cardMembershipNo').value = app.membership_no || '';
    document.getElementById('cardFileName').textContent = '';
    document.getElementById('cardPreviewBox').style.display = 'none';
    document.getElementById('uploadCardArea').classList.remove('has-file');

    const fileInput = document.getElementById('cardFileInput');
    if (fileInput) fileInput.value = '';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeCardModal = function () {
    const modal = document.getElementById('cardModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentCardApp = null;
    currentCardFile = null;
  };

  function setupCardUpload() {
    const area = document.getElementById('uploadCardArea');
    const fileInput = document.getElementById('cardFileInput');
    if (!area || !fileInput) return;

    area.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > MAX_CARD_SIZE) {
        showToast(`حجم الملف كبير — الحد الأقصى 5 ميجا`, 'error');
        fileInput.value = '';
        return;
      }

      if (!ALLOWED_CARD_TYPES.includes(file.type)) {
        showToast('صيغة غير مدعومة — JPG, PNG فقط', 'error');
        fileInput.value = '';
        return;
      }

      currentCardFile = file;

      area.classList.add('has-file');
      document.getElementById('cardFileName').textContent =
        `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

      // Preview
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = document.getElementById('cardPreviewImg');
        if (img) img.src = ev.target.result;
        document.getElementById('cardPreviewBox').style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  async function confirmCard() {
    if (!currentCardApp || !currentCardFile) {
      showToast('ارفع صورة الكارنية أولًا', 'warning');
      return;
    }

    const btn = document.getElementById('confirmCardBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الرفع...</span><span class="spinner"></span>';
    }

    try {
      const app = currentCardApp;
      const ext = (currentCardFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${app.id}/card_${Date.now()}.${ext}`;

      // 1) Upload to storage
      const { error: upErr } = await client.storage
        .from(CARD_BUCKET)
        .upload(path, currentCardFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: currentCardFile.type
        });

      if (upErr) throw new Error('فشل الرفع: ' + upErr.message);

      // 2) Get public URL
      const { data: urlData } = client.storage
        .from(CARD_BUCKET)
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl;

      // 3) Update application
      const { error: appErr } = await client
        .from('applications')
        .update({
          card_image_url: publicUrl,
          card_ready_at: new Date().toISOString(),
          status: 'card_ready'
        })
        .eq('id', app.id);

      if (appErr) throw new Error('فشل تحديث الطلب: ' + appErr.message);

      // 4) Update member
      if (app.member_id) {
        try {
          await client
            .from('members')
            .update({
              card_status: 'ready',
              card_image_url: publicUrl,
              card_issued_at: new Date().toISOString()
            })
            .eq('id', app.member_id);
        } catch (e) {}
      }

      // 5) Log history
      try {
        await client.from('status_history').insert([{
          application_id: app.id,
          old_status: app.status,
          new_status: 'card_ready',
          notes: `تم رفع صورة الكارنية — جاهز للاستلام`,
          changed_by: currentUser.id,
          changed_by_name: window.currentUserName,
          is_auto: false
        }]);
      } catch (e) {}

      showToast('تم رفع صورة الكارنية بنجاح', 'success');

      closeCardModal();
      await loadApplications();
      await loadStats();

    } catch (err) {
      console.error('[HeadApproval] Card error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="20 6 9 17 4 12"/></svg><span>حفظ واعتماد الكارنية</span>';
      }
    }
  }

  /* ============================================
     DETAIL MODAL (Simple - view only)
     ============================================ */
  async function openDetailModal(appId) {
    // Basic implementation: show a modal with details
    // For now, redirect to dashboard with the app id? Or show simple alert
    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) return;

    // Build a simple detail modal (reuse dashboard's approach)
    const info = [
      `الاسم: ${app.full_name}`,
      `الرقم القومي: ${app.national_id}`,
      `رقم التتبع: ${app.tracking_no}`,
      `رقم العضوية: ${app.membership_no || '—'}`,
      `الموبايل: ${app.phone}`,
      `نوع العضوية: ${getTypeName(app.membership_type_id)}`,
      `المحافظة: ${app.governorate || '—'}`,
      `الرعاية الصحية: ${app.wants_health_care ? 'نعم' : 'لا'}`,
      `الحالة: ${getStatusInfo(app.status).label}`
    ].join('\n');

    alert(info);
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
      'رقم التتبع', 'رقم العضوية', 'الاسم', 'الرقم القومي', 'الموبايل',
      'نوع العضوية', 'المحافظة', 'الرعاية الصحية', 'المبلغ', 'الحالة', 'التاريخ'
    ];

    const rows = applications.map(a => {
      const total = (parseFloat(a.membership_fee) || 0) + (parseFloat(a.health_care_amount) || 0);
      return [
        a.tracking_no,
        a.membership_no || '',
        a.full_name,
        a.national_id,
        a.phone,
        getTypeName(a.membership_type_id),
        a.governorate || '',
        a.wants_health_care ? 'نعم' : 'لا',
        total,
        getStatusInfo(a.status).label,
        formatDate(a.created_at)
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `head_approval_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['applications', 'members', 'status_history'],
      async () => {
        await loadApplications();
        await loadStats();
      },
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     SETUP LISTENERS
     ============================================ */
  function setupListeners() {
    // Stats cards click
    document.querySelectorAll('[data-filter]').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.dataset.filter;
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
          statusFilter.value = filter;
          filters.status = filter;
          currentPage = 1;
          loadApplications();
        }
      });
    });

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        currentPage = 1;
        loadApplications();
      });
    }

    // Gov filter
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
      const debounced = window.debounce ? window.debounce(() => {
        filters.search = searchInput.value;
        currentPage = 1;
        loadApplications();
      }, 400) : (() => {
        clearTimeout(window.__haSearchT);
        window.__haSearchT = setTimeout(() => {
          filters.search = searchInput.value;
          currentPage = 1;
          loadApplications();
        }, 400);
      });
      searchInput.addEventListener('input', debounced);
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
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // Assign confirm
    const confirmAssignBtn = document.getElementById('confirmAssignBtn');
    if (confirmAssignBtn) confirmAssignBtn.addEventListener('click', confirmAssign);

    // Card confirm
    const confirmCardBtn = document.getElementById('confirmCardBtn');
    if (confirmCardBtn) confirmCardBtn.addEventListener('click', confirmCard);

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    // Modal backdrops
    ['assignModal', 'cardModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'assignModal') window.closeAssignModal();
          else if (id === 'cardModal') window.closeCardModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeAssignModal();
        window.closeCardModal();
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

      await loadLookups();

      setupListeners();
      setupCardUpload();

      await loadStats();
      await loadApplications();

      setupRealtime();

      console.log('[HeadApproval] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

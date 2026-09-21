/* =====================================================
   IT SYNDICATE — Head Approval Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 25;
  const DEFAULT_DURATION = 12;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let applications = [];
  let filteredApps = [];
  let currentPage = 1;
  let branches = [];
  let membershipTypes = [];
  let selectedIds = new Set();
  let currentApp = null;
  let unsubscribeRealtime = null;

  let filters = {
    search: '',
    status: 'awaiting_membership_no',
    branch: 'all'
  };

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
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) { return '---'; }
  }

  function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return Number(n).toLocaleString('en-US');
  }

  function showToast(message, type = 'info') {
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log(`[${type}] ${message}`);
  }

  /* ============================================
     ICONS
     ============================================ */
  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    key: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    phone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    award: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
    file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  };

  /* ============================================
     AUTH
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

      // لازم head فقط
      if (userRole !== 'head') {
        alert('هذه الصفحة مخصصة للنقيب العام فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = userData?.full_name || currentUser.email;
      });

      return true;
    } catch (err) {
      console.error('[HeadApproval] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD BRANCHES & TYPES
     ============================================ */
  async function loadBranches() {
    const { data } = await client
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    branches = data || [];

    const filter = document.getElementById('branchFilter');
    if (filter) {
      filter.innerHTML = '<option value="all">الكل</option>';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        filter.appendChild(opt);
      });
    }

    const assignSelect = document.getElementById('assignBranch');
    if (assignSelect) {
      assignSelect.innerHTML = '<option value="">-- اختر الشعبة --</option>';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        assignSelect.appendChild(opt);
      });
    }
  }

  async function loadTypes() {
    const { data } = await client
      .from('membership_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    membershipTypes = data || [];
  }

  function getTypeName(id) {
    const t = membershipTypes.find(x => x.id === id);
    return t?.name || '—';
  }

  function getTypeFee(id) {
    const t = membershipTypes.find(x => x.id === id);
    return parseFloat(t?.fee) || 0;
  }

  /* ============================================
     LOAD APPLICATIONS
     ============================================ */
  async function loadApplications() {
    const tbody = document.getElementById('approvalTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:40px;color:var(--text-dim);">
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
        .select('*, payments:payments!payments_application_id_fkey(*)');

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      } else {
        // حالات الاعتماد فقط
        query = query.in('status', [
          'awaiting_membership_no',
          'membership_no_assigned',
          'card_processing',
          'card_ready',
          'delivered'
        ]);
      }

      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${s}%,national_id.ilike.%${s}%,phone.ilike.%${s}%,tracking_no.ilike.%${s}%`
        );
      }

      query = query.order('created_at', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      applications = data || [];
      filteredApps = applications;

      renderStats();
      renderTable();
      renderPagination();

    } catch (err) {
      console.error('[HeadApproval] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center;padding:40px;color:var(--danger);">
              ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ============================================
     STATS
     ============================================ */
  function renderStats() {
    const awaiting = applications.filter(a => a.status === 'awaiting_membership_no').length;

    const today = new Date().toISOString().split('T')[0];
    const assignedToday = applications.filter(a =>
      a.status !== 'awaiting_membership_no' &&
      a.approved_at &&
      a.approved_at.startsWith(today)
    ).length;

    const pendingRevenue = applications
      .filter(a => a.status === 'awaiting_membership_no')
      .reduce((sum, a) => sum + getTypeFee(a.membership_type_id), 0);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('statAwaiting', formatNumber(awaiting));
    setVal('statAssignedToday', formatNumber(assignedToday));
    setVal('statRevenuePending', formatNumber(pendingRevenue));

    // Bulk banner
    const banner = document.getElementById('bulkBanner');
    if (banner) {
      banner.style.display = awaiting > 0 ? 'flex' : 'none';
    }
  }

  /* ============================================
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('approvalTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredApps.slice(start, end);

    const countEl = document.getElementById('tableCount');
    if (countEl) countEl.textContent = `${filteredApps.length} طلب`;

    if (!pageData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:80px 20px;">
            <div class="empty-state">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div class="empty-state-title">لا توجد طلبات بانتظار الاعتماد</div>
              <div style="font-size:13px;">كل الطلبات تم اعتمادها</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageData.map(a => {
      const initials = window.getInitials ? window.getInitials(a.full_name) : '؟';
      const typeName = getTypeName(a.membership_type_id);

      // آخر دفعة
      let lastPaymentDate = null;
      let lastPaymentAmount = 0;
      if (a.payments && a.payments.length > 0) {
        const sortedPayments = a.payments.sort((x, y) =>
          new Date(y.paid_at) - new Date(x.paid_at)
        );
        lastPaymentDate = sortedPayments[0].paid_at;
        lastPaymentAmount = sortedPayments[0].amount;
      }

      // Status badge
      let statusBadge = '';
      if (a.status === 'awaiting_membership_no') {
        statusBadge = `<span class="status-badge status-awaiting"><span class="dot"></span>بانتظار الاعتماد</span>`;
      } else if (a.status === 'membership_no_assigned') {
        statusBadge = `<span class="status-badge status-assigned"><span class="dot"></span>معتمد</span>`;
      } else if (a.status === 'card_processing') {
        statusBadge = `<span class="status-badge status-assigned"><span class="dot"></span>تجهيز الكارنية</span>`;
      } else if (a.status === 'card_ready') {
        statusBadge = `<span class="status-badge status-paid"><span class="dot"></span>الكارنية جاهز</span>`;
      } else if (a.status === 'delivered') {
        statusBadge = `<span class="status-badge status-paid"><span class="dot"></span>تم التسليم</span>`;
      }

      const isSelected = selectedIds.has(String(a.id));

      return `
        <tr data-id="${a.id}" style="border-bottom:1px solid var(--border-soft);">
          <td class="check-cell">
            ${a.status === 'awaiting_membership_no' ? `
              <input type="checkbox" class="row-check" data-id="${a.id}" ${isSelected ? 'checked' : ''} />
            ` : ''}
          </td>
          <td style="padding:14px 12px;">
            <div class="member-cell">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-info">
                <div class="member-name">${escapeHtml(a.full_name)}</div>
                <div class="member-nid">${escapeHtml(a.national_id || '—')}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:700;">${escapeHtml(a.tracking_no)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;white-space:nowrap;">
              ${escapeHtml(typeName)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;white-space:nowrap;">
              ${escapeHtml(a.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(a.phone || '—')}</span>
          </td>
          <td style="padding:14px 12px;">${statusBadge}</td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
            ${lastPaymentDate
              ? `${escapeHtml(formatDate(lastPaymentDate))}${lastPaymentAmount ? ` <span style="color:var(--success);">(${formatNumber(lastPaymentAmount)} ج)</span>` : ''}`
              : '—'}
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn view-btn" data-action="view" data-id="${a.id}" title="عرض التفاصيل">
                ${ICONS.eye}
              </button>
              ${a.status === 'awaiting_membership_no' ? `
                <button class="row-btn assign-btn" data-action="assign" data-id="${a.id}" title="اعتماد وإصدار">
                  ${ICONS.key}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind checkboxes
    tbody.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = String(cb.dataset.id);
        if (cb.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        updateBulkButton();
      });
    });

    // Bind buttons
    tbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'view') openViewModal(id);
        else if (action === 'assign') openAssignModal(id);
      });
    });

    // Sync select-all
    const selectAll = document.getElementById('bulkSelectAll');
    if (selectAll) {
      const totalSelectable = pageData.filter(a => a.status === 'awaiting_membership_no').length;
      const selectedInPage = pageData.filter(a =>
        a.status === 'awaiting_membership_no' && selectedIds.has(String(a.id))
      ).length;

      selectAll.checked = totalSelectable > 0 && selectedInPage === totalSelectable;
      selectAll.indeterminate = selectedInPage > 0 && selectedInPage < totalSelectable;
    }
  }

  /* ============================================
     BULK BUTTON
     ============================================ */
  function updateBulkButton() {
    const btn = document.getElementById('bulkApproveBtn');
    const txt = document.getElementById('bulkBtnText');
    const sub = document.getElementById('bulkSub');

    if (btn) {
      btn.disabled = selectedIds.size === 0;
    }
    if (txt) {
      txt.textContent = selectedIds.size > 0
        ? `اعتماد ${selectedIds.size} طلب`
        : 'اعتماد المحددين';
    }
    if (sub) {
      sub.textContent = selectedIds.size > 0
        ? `تم تحديد ${selectedIds.size} طلب — جاهزين للاعتماد`
        : 'اختر الطلبات من الجدول لاعتمادها دفعة واحدة';
    }
  }

  /* ============================================
     PAGINATION
     ============================================ */
  function renderPagination() {
    const box = document.getElementById('paginationBox');
    if (!box) return;

    const totalPages = Math.ceil(filteredApps.length / PAGE_SIZE);
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
      background:${active ? 'linear-gradient(135deg, #f59e0b, var(--accent))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(245,158,11,0.2)'};
      color:${active ? '#000' : (disabled ? 'var(--text-faint)' : 'var(--text-muted)')};
      opacity:${disabled ? 0.4 : 1};
    `;

    let html = '';
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="${btnStyle(false, currentPage === 1)}">
      <span style="width:14px;height:14px;display:inline-flex;">
        <svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="15 18 9 12 15 6"/></svg>
      </span>
    </button>`;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

    if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }

    pages.forEach(p => {
      if (p === '...') {
        html += `<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;color:var(--text-dim);">…</span>`;
      } else {
        html += `<button data-page="${p}" style="${btnStyle(p === currentPage, false)}">${p}</button>`;
      }
    });

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" style="${btnStyle(false, currentPage === totalPages)}">
      <span style="width:14px;height:14px;display:inline-flex;">
        <svg viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="9 18 15 12 9 6"/></svg>
      </span>
    </button>`;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:16px 22px;border-top:1px solid var(--border-soft);">
        <div style="font-size:12.5px;color:var(--text-dim);">
          صفحة ${currentPage} من ${totalPages} — إجمالي ${filteredApps.length} طلب
        </div>
        <div style="display:flex;gap:6px;align-items:center;">${html}</div>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== currentPage) {
          currentPage = p;
          renderTable();
          renderPagination();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  /* ============================================
     VIEW MODAL
     ============================================ */
  function openViewModal(appId) {
    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) return;

    const modal = document.getElementById('viewModal');
    const content = document.getElementById('viewModalContent');
    if (!modal || !content) return;

    const typeName = getTypeName(app.membership_type_id);

    content.innerHTML = `
      <div style="animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);">

        <div class="modal-header-custom">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#f59e0b;margin-bottom:4px;">
              ${escapeHtml(app.tracking_no)}
            </div>
            <h3>${escapeHtml(app.full_name)}</h3>
          </div>
          <button type="button" class="close-btn" onclick="closeViewModal()">
            ${ICONS.close}
          </button>
        </div>

        <div style="padding:24px;overflow-y:auto;max-height:calc(90vh - 200px);">

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:#f59e0b;">${ICONS.user}</span>
            البيانات الشخصية
          </h4>
          <div class="detail-grid" style="margin-bottom:24px;">
            ${detailItem('الاسم', app.full_name)}
            ${detailItem('الرقم القومي', app.national_id, true)}
            ${detailItem('الموبايل', app.phone, true)}
            ${detailItem('البريد', app.email || '—')}
            ${detailItem('العنوان', app.address || '—')}
            ${detailItem('المحافظة', app.governorate || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:#f59e0b;">${ICONS.briefcase}</span>
            البيانات المهنية
          </h4>
          <div class="detail-grid" style="margin-bottom:24px;">
            ${detailItem('نوع العضوية', typeName)}
            ${detailItem('المؤهل', app.qualification || '—')}
            ${detailItem('سنة التخرج', app.graduation_year || '—')}
            ${detailItem('التقدير', app.grade || '—')}
            ${detailItem('جهة العمل', app.employer || '—')}
            ${detailItem('المسمى الوظيفي', app.job_title || '—')}
          </div>

          ${app.payments && app.payments.length > 0 ? `
            <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span style="width:16px;height:16px;display:inline-flex;color:#f59e0b;">${ICONS.award}</span>
              المدفوعات
            </h4>
            <div style="padding:16px;background:rgba(var(--success-rgb),0.04);border:1px solid rgba(var(--success-rgb),0.2);border-radius:12px;margin-bottom:24px;">
              ${app.payments.map(p => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(var(--success-rgb),0.1);">
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text);">${formatNumber(p.amount)} جنيه</div>
                    <div style="font-size:11.5px;color:var(--text-dim);">${escapeHtml(formatDate(p.paid_at))}</div>
                  </div>
                  <span class="status-badge status-paid">
                    <span class="dot"></span>
                    ${p.status === 'confirmed' ? 'مؤكد' : p.status}
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}

        </div>

        <div class="modal-footer-custom">
          ${app.status === 'awaiting_membership_no' ? `
            <button type="button" class="btn btn-primary" onclick="closeViewModal();openAssignModal('${app.id}')">
              ${ICONS.key}
              <span>اعتماد وإصدار رقم العضوية</span>
            </button>
          ` : `
            <span style="font-size:13px;color:var(--success);font-weight:700;">✓ تم الاعتماد</span>
          `}
        </div>

      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function detailItem(label, value, isMono = false) {
    return `
      <div class="detail-item">
        <div class="detail-item-label">${escapeHtml(label)}</div>
        <div class="detail-item-value" style="${isMono ? "font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;" : ''}">
          ${escapeHtml(value || '—')}
        </div>
      </div>
    `;
  }

  window.closeViewModal = function () {
    const modal = document.getElementById('viewModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ============================================
     ASSIGN MODAL
     ============================================ */
  function openAssignModal(appId) {
    const app = applications.find(a => String(a.id) === String(appId));
    if (!app) return;

    currentApp = app;

    const modal = document.getElementById('assignModal');
    if (!modal) return;

    document.getElementById('assignAppId').value = app.id;
    document.getElementById('assignMemberName').value = app.full_name;
    document.getElementById('assignBranch').value = '';
    document.getElementById('assignDuration').value = DEFAULT_DURATION;

    // Auto-fill amount
    document.getElementById('assignAmount').value = getTypeFee(app.membership_type_id);

    // Generate membership no
    generateMembershipNo();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeAssignModal = function () {
    const modal = document.getElementById('assignModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentApp = null;
  };

  async function generateMembershipNo() {
    const prefix = 'MEM';
    const year = new Date().getFullYear();

    try {
      const { data } = await client
        .from('members')
        .select('membership_no')
        .like('membership_no', `${prefix}-${year}-%`)
        .order('membership_no', { ascending: false })
        .limit(1);

      let nextNum = 1;
      if (data && data.length > 0 && data[0].membership_no) {
        const parts = data[0].membership_no.split('-');
        const lastNum = parseInt(parts[2]) || 0;
        nextNum = lastNum + 1;
      }

      const newNo = `${prefix}-${year}-${String(nextNum).padStart(5, '0')}`;
      document.getElementById('assignNo').value = newNo;
    } catch (e) {
      const fallback = `${prefix}-${year}-00001`;
      document.getElementById('assignNo').value = fallback;
    }
  }

  /* ============================================
     CONFIRM ASSIGN
     ============================================ */
  async function confirmAssign() {
    if (!currentApp) return;

    const appId = currentApp.id;
    const branchId = document.getElementById('assignBranch').value;
    const mno = document.getElementById('assignNo').value.trim();
    const duration = parseInt(document.getElementById('assignDuration').value) || DEFAULT_DURATION;
    const amount = parseFloat(document.getElementById('assignAmount').value) || 0;

    if (!branchId) {
      showToast('اختر الشعبة', 'warning');
      return;
    }
    if (!mno) {
      showToast('رقم العضوية مطلوب', 'warning');
      return;
    }

    const btn = document.getElementById('confirmAssignBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الاعتماد...</span><span class="spinner"></span>';
    }

    try {
      await approveSingleApplication(currentApp, {
        branchId: parseInt(branchId),
        membershipNo: mno,
        duration,
        amount
      });

      showToast('تم الاعتماد بنجاح ✓', 'success');

      closeAssignModal();
      await loadApplications();

    } catch (err) {
      console.error('[Assign] Error:', err);
      showToast('فشل الاعتماد: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>اعتماد وإصدار</span>`;
      }
    }
  }

  /* ============================================
     APPROVE SINGLE (Helper)
     ============================================ */
  async function approveSingleApplication(app, options) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (options.duration || DEFAULT_DURATION));

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // 1) أنشئ العضو
    const memberData = {
      full_name: app.full_name,
      national_id: app.national_id,
      phone: app.phone,
      email: app.email,
      address: app.address,
      governorate: app.governorate,
      qualification: app.qualification,
      graduation_year: app.graduation_year,
      grade: app.grade,
      employer: app.employer,
      job_title: app.job_title,
      membership_type_id: app.membership_type_id,
      branch_id: options.branchId,
      membership_no: options.membershipNo,
      application_id: app.id,
      membership_start: startStr,
      membership_end: endStr,
      card_status: 'processing',
      is_active: true
    };

    // Check if member exists (by national_id)
    const { data: existingMember } = await client
      .from('members')
      .select('id')
      .eq('national_id', app.national_id)
      .maybeSingle();

    let memberId;

    if (existingMember) {
      // Update
      const { data: updated, error: updErr } = await client
        .from('members')
        .update(memberData)
        .eq('id', existingMember.id)
        .select()
        .single();

      if (updErr) throw updErr;
      memberId = updated.id;
    } else {
      // Insert
      const { data: inserted, error: insErr } = await client
        .from('members')
        .insert([memberData])
        .select()
        .single();

      if (insErr) throw insErr;
      memberId = inserted.id;
    }

    // 2) أنشئ اشتراك
    await client
      .from('membership_subscriptions')
      .insert([{
        member_id: memberId,
        membership_type_id: app.membership_type_id,
        start_date: startStr,
        end_date: endStr,
        amount: options.amount || 0,
        status: 'active'
      }]);

    // 3) حدّث حالة الطلب
    const { error: appErr } = await client
      .from('applications')
      .update({
        status: 'membership_no_assigned',
        member_id: memberId,
        branch_id: options.branchId,
        approved_by: currentUser.id,
        approved_at: new Date().toISOString(),
        reviewer_notes: `تم الاعتماد — رقم العضوية: ${options.membershipNo}`
      })
      .eq('id', app.id);

    if (appErr) throw appErr;

    // 4) سجّل دفعة (لو المبلغ > 0)
    if (options.amount > 0) {
      await client
        .from('payments')
        .insert([{
          application_id: app.id,
          member_id: memberId,
          amount: options.amount,
          payment_method: 'cash',
          governorate: app.governorate,
          status: 'confirmed',
          confirmed_by: currentUser.id,
          confirmed_at: new Date().toISOString(),
          paid_at: new Date().toISOString()
        }]);
    }

    // 5) Log
    if (window.logUserAction) {
      await window.logUserAction(
        'approve_member',
        'application',
        app.id,
        `${app.full_name} — رقم: ${options.membershipNo}`
      );
    }

    return memberId;
  }

  /* ============================================
     BULK APPROVE
     ============================================ */
  async function bulkApprove() {
    const ids = Array.from(selectedIds);

    if (!ids.length) {
      showToast('اختر طلبات للاعتماد', 'warning');
      return;
    }

    // تأكيد
    const confirmMsg = `سيتم اعتماد ${ids.length} طلب وإصدار أرقام العضوية لهم.\n\nهل أنت متأكد؟`;
    if (!confirm(confirmMsg)) return;

    // اختر شعبة
    const branchOptions = branches.map(b => `${b.id}: ${b.name}`).join('\n');
    const branchInput = prompt(
      `اختر رقم الشعبة:\n\n${branchOptions}\n\nأدخل الرقم:`,
      branches[0]?.id || ''
    );

    if (!branchInput) return;
    const branchId = parseInt(branchInput);

    if (isNaN(branchId) || !branches.find(b => b.id === branchId)) {
      showToast('رقم الشعبة غير صالح', 'error');
      return;
    }

    const btn = document.getElementById('bulkApproveBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الاعتماد...</span><span class="spinner"></span>';
    }

    let success = 0;
    let failed = 0;
    let nextNum = null;

    // Get last membership no
    try {
      const { data } = await client
        .from('members')
        .select('membership_no')
        .like('membership_no', `MEM-${new Date().getFullYear()}-%`)
        .order('membership_no', { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].membership_no) {
        const parts = data[0].membership_no.split('-');
        nextNum = (parseInt(parts[2]) || 0) + 1;
      } else {
        nextNum = 1;
      }
    } catch (e) {
      nextNum = 1;
    }

    for (const id of ids) {
      const app = applications.find(a => String(a.id) === String(id));
      if (!app) continue;

      try {
        const mno = `MEM-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;
        nextNum++;

        await approveSingleApplication(app, {
          branchId,
          membershipNo: mno,
          duration: DEFAULT_DURATION,
          amount: getTypeFee(app.membership_type_id)
        });

        success++;
      } catch (err) {
        console.error('Bulk approve failed for', app.full_name, err);
        failed++;
      }
    }

    selectedIds.clear();
    updateBulkButton();

    showToast(
      `تم اعتماد ${success} طلب${failed > 0 ? ` — فشل ${failed}` : ''}`,
      success > 0 ? 'success' : 'error',
      5000
    );

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${ICONS.check}<span>اعتماد المحددين</span>`;
    }

    await loadApplications();
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!filteredApps.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم التتبع', 'الاسم', 'الرقم القومي', 'الموبايل',
      'نوع العضوية', 'المحافظة', 'الحالة', 'تاريخ التقديم'
    ];

    const statusLabels = {
      'awaiting_membership_no': 'بانتظار الاعتماد',
      'membership_no_assigned': 'تم الاعتماد',
      'card_processing': 'جاري تجهيز الكارنية',
      'card_ready': 'الكارنية جاهز',
      'delivered': 'تم التسليم'
    };

    const rows = filteredApps.map(a => [
      a.tracking_no || '',
      a.full_name || '',
      a.national_id || '',
      a.phone || '',
      getTypeName(a.membership_type_id),
      a.governorate || '',
      statusLabels[a.status] || a.status,
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
    link.download = `head-approval_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['applications', 'members', 'payments'],
      async () => {
        await loadApplications();
      },
      { debounceMs: 600, immediate: false }
    );
  }

  /* ============================================
     FILTERS
     ============================================ */
  function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      const debounced = window.debounce ? window.debounce(() => {
        filters.search = searchInput.value;
        currentPage = 1;
        loadApplications();
      }, 400) : () => {};

      searchInput.addEventListener('input', debounced);
    }

    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        currentPage = 1;
        selectedIds.clear();
        updateBulkButton();
        loadApplications();
      });
    }

    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => {
        filters.branch = e.target.value;
        // مش بنعمل query — بس بنفلتر محليًا لو محتاج
      });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadApplications();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    if (bulkApproveBtn) bulkApproveBtn.addEventListener('click', bulkApprove);

    const confirmBtn = document.getElementById('confirmAssignBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmAssign);

    // Select all
    const selectAll = document.getElementById('bulkSelectAll');
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageData = filteredApps.slice(start, end);

        pageData.forEach(a => {
          if (a.status === 'awaiting_membership_no') {
            if (selectAll.checked) {
              selectedIds.add(String(a.id));
            } else {
              selectedIds.delete(String(a.id));
            }
          }
        });

        renderTable();
        updateBulkButton();
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }
  }

  /* ============================================
     MODAL BACKDROPS
     ============================================ */
  function setupModalBackdrops() {
    ['assignModal', 'viewModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'assignModal') window.closeAssignModal();
          else window.closeViewModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeAssignModal();
        window.closeViewModal();
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

      await loadBranches();
      await loadTypes();

      setupFilters();
      setupModalBackdrops();

      await loadApplications();

      setupRealtime();

      console.log('[HeadApproval] Ready.');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

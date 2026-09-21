/* =====================================================
   IT SYNDICATE — Members Management Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const SOON_DAYS = 30;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let members = [];
  let membersWithSubs = [];
  let filteredMembers = [];
  let currentPage = 1;
  let totalCount = 0;
  let branches = [];
  let membershipTypes = [];

  let filters = {
    search: '',
    branch: 'all',
    governorate: 'all',
    type: 'all',
    subStatus: 'all'
  };

  let unsubscribeRealtime = null;
  let currentMemberForAssign = null;

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

  function getStatusColor(status) {
    const map = {
      active: 'var(--success)',
      soon: 'var(--warning)',
      expired: 'var(--danger)'
    };
    return map[status] || 'var(--text-muted)';
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
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    key: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    users: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    phone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    briefcase: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>',
    alert: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    award: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>'
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

      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';

        const headBtn = document.getElementById('headApprovalBtn');
        if (headBtn) headBtn.style.display = 'inline-flex';
      }

      const roleLabel = userRole === 'head' ? 'النقيب العام'
                     : userRole === 'vice_president' ? 'نائب رئيس النقابة'
                     : 'لجنة العضوية';

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = userData?.full_name || currentUser.email;
      });
      document.querySelectorAll('[data-user-role]').forEach(el => {
        el.textContent = roleLabel;
      });

      return true;
    } catch (err) {
      console.error('[Members] Auth error:', err);
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
      filter.innerHTML = '<option value="all">كل الشعب</option>';
      branches.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        filter.appendChild(opt);
      });
    }

    // assign modal
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

    const filter = document.getElementById('typeFilter');
    if (filter) {
      filter.innerHTML = '<option value="all">كل الأنواع</option>';
      membershipTypes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        filter.appendChild(opt);
      });
    }
  }

  function getBranchName(id) {
    const b = branches.find(x => x.id === id);
    return b?.name || '—';
  }

  function getTypeName(id) {
    const t = membershipTypes.find(x => x.id === id);
    return t?.name || '—';
  }

  /* ============================================
     LOAD MEMBERS
     ============================================ */
  async function loadMembers() {
    const tbody = document.getElementById('membersTableBody');
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
      let query = client.from('members').select('*', { count: 'exact' });

      if (filters.branch !== 'all') {
        query = query.eq('branch_id', parseInt(filters.branch));
      }
      if (filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }
      if (filters.type !== 'all') {
        query = query.eq('membership_type_id', parseInt(filters.type));
      }
      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${s}%,national_id.ilike.%${s}%,phone.ilike.%${s}%,membership_no.ilike.%${s}%`
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      members = data || [];
      totalCount = count || 0;

      // Load subscriptions for each member
      await loadSubscriptionsForMembers();

      // Apply subscription filter
      applySubStatusFilter();

      // Render
      renderStats();
      renderTable();
      renderPagination();

    } catch (err) {
      console.error('[Members] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center;padding:40px;color:var(--danger);">
              ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  async function loadSubscriptionsForMembers() {
    if (!members.length) {
      membersWithSubs = [];
      return;
    }

    const memberIds = members.map(m => m.id);

    const { data: subs, error } = await client
      .from('membership_subscriptions')
      .select('*')
      .in('member_id', memberIds)
      .order('end_date', { ascending: false });

    if (error) {
      console.warn('[Members] Subs load error:', error);
      membersWithSubs = members.map(m => ({ ...m, subscription: null, daysRemaining: null, subStatus: 'expired' }));
      return;
    }

    const subsMap = {};
    (subs || []).forEach(s => {
      if (!subsMap[s.member_id]) subsMap[s.member_id] = s;
    });

    const now = new Date();
    membersWithSubs = members.map(m => {
      const sub = subsMap[m.id] || null;
      let daysRemaining = null;
      let subStatus = 'expired';

      if (sub && sub.end_date) {
        const endDate = new Date(sub.end_date);
        daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) subStatus = 'expired';
        else if (daysRemaining <= SOON_DAYS) subStatus = 'soon';
        else subStatus = 'active';
      } else if (m.membership_end) {
        const endDate = new Date(m.membership_end);
        daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) subStatus = 'expired';
        else if (daysRemaining <= SOON_DAYS) subStatus = 'soon';
        else subStatus = 'active';
      }

      return {
        ...m,
        subscription: sub,
        daysRemaining,
        subStatus
      };
    });
  }

  function applySubStatusFilter() {
    if (filters.subStatus === 'all') {
      filteredMembers = membersWithSubs;
    } else {
      filteredMembers = membersWithSubs.filter(m => m.subStatus === filters.subStatus);
    }
  }

  /* ============================================
     STATS
     ============================================ */
  function renderStats() {
    const total = membersWithSubs.length;
    const active = membersWithSubs.filter(m => m.subStatus === 'active').length;
    const soon = membersWithSubs.filter(m => m.subStatus === 'soon').length;
    const expired = membersWithSubs.filter(m => m.subStatus === 'expired').length;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('statTotalMembers', total);
    setVal('statActiveSubs', active);
    setVal('statExpiringSoon', soon);
    setVal('statExpired', expired);
  }

  /* ============================================
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredMembers.slice(start, end);

    const countEl = document.getElementById('tableCount');
    if (countEl) countEl.textContent = `${filteredMembers.length} عضو`;

    if (!pageData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.users}</span>
              <div style="font-size:15px;">لا يوجد أعضاء مطابقين</div>
              <div style="font-size:13px;">جرب تغيير الفلاتر أو البحث</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageData.map(m => {
      const initials = window.getInitials ? window.getInitials(m.full_name) : '؟';
      const branchName = getBranchName(m.branch_id);
      const mno = m.membership_no;

      let subBadge = '';
      if (m.subStatus === 'active') {
        subBadge = `<span class="sub-status sub-active"><span class="dot"></span>نشط</span>`;
      } else if (m.subStatus === 'soon') {
        subBadge = `<span class="sub-status sub-soon"><span class="dot"></span>ينتهي قريبًا</span>`;
      } else {
        subBadge = `<span class="sub-status sub-expired"><span class="dot"></span>منتهي</span>`;
      }

      let daysText = '—';
      if (m.daysRemaining !== null && m.daysRemaining !== undefined) {
        if (m.daysRemaining < 0) {
          daysText = `<span style="color:var(--danger);font-weight:700;">متأخر ${Math.abs(m.daysRemaining)} يوم</span>`;
        } else if (m.daysRemaining === 0) {
          daysText = `<span style="color:var(--warning);font-weight:700;">ينتهي اليوم</span>`;
        } else {
          const color = m.daysRemaining <= SOON_DAYS ? 'var(--warning)' : 'var(--success)';
          daysText = `<span style="color:${color};font-weight:700;">${m.daysRemaining} يوم</span>`;
        }
      }

      return `
        <tr data-id="${m.id}" style="cursor:pointer;transition:background 0.2s;border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;">
            <div class="member-cell">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-info">
                <div class="member-name">${escapeHtml(m.full_name)}</div>
                <div class="member-nid">${escapeHtml(m.national_id || '—')}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            ${mno
              ? `<span class="mno-badge">${escapeHtml(mno)}</span>`
              : `<span class="mno-pending">بانتظار الإصدار</span>`}
          </td>
          <td style="padding:14px 12px;">
            <span class="branch-cell">${escapeHtml(branchName)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="branch-cell">${escapeHtml(m.governorate || '—')}</span>
          </td>
          <td style="padding:14px 12px;">${subBadge}</td>
          <td style="padding:14px 12px;">${daysText}</td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(m.phone || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn view-btn" data-action="view" data-id="${m.id}" title="عرض التفاصيل">
                ${ICONS.eye}
              </button>
              ${!mno ? `
                <button class="row-btn key-btn" data-action="assign" data-id="${m.id}" title="إصدار رقم العضوية">
                  ${ICONS.key}
                </button>
              ` : `
                <button class="row-btn refresh-btn" data-action="renew" data-id="${m.id}" title="تجديد الاشتراك">
                  ${ICONS.refresh}
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Row click
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openMemberDetail(tr.dataset.id);
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
        if (action === 'view') openMemberDetail(id);
        else if (action === 'assign') openAssignModal(id);
        else if (action === 'renew') renewSubscription(id);
      });
    });
  }

  /* ============================================
     PAGINATION
     ============================================ */
  function renderPagination() {
    const box = document.getElementById('paginationBox');
    if (!box) return;

    const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE);
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

    let html = '';
    html += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" style="${btnStyle(false, currentPage === 1)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronRight}</span>
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
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronLeft}</span>
    </button>`;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="font-size:12.5px;color:var(--text-dim);">
          صفحة ${currentPage} من ${totalPages} — إجمالي ${filteredMembers.length} عضو
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
     MEMBER DETAIL
     ============================================ */
  function openMemberDetail(memberId) {
    const modal = document.getElementById('memberModal');
    const content = document.getElementById('memberModalContent');
    if (!modal || !content) return;

    const m = membersWithSubs.find(x => String(x.id) === String(memberId));
    if (!m) return;

    const branchName = getBranchName(m.branch_id);
    const typeName = getTypeName(m.membership_type_id);
    const sub = m.subscription;

    content.innerHTML = `
      <div style="animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);">

        <div class="modal-header-custom">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--accent);margin-bottom:4px;">
              ${m.membership_no ? escapeHtml(m.membership_no) : 'بانتظار الإصدار'}
            </div>
            <h3>${escapeHtml(m.full_name)}</h3>
          </div>
          <button type="button" class="close-btn" onclick="closeMemberModal()">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style="padding:24px;overflow-y:auto;max-height:calc(90vh - 200px);">

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.user}</span>
            البيانات الشخصية
          </h4>
          <div class="detail-grid" style="margin-bottom:24px;">
            ${detailItem('الاسم', m.full_name)}
            ${detailItem('الرقم القومي', m.national_id, true)}
            ${detailItem('الموبايل', m.phone, true)}
            ${detailItem('البريد', m.email || '—')}
            ${detailItem('العنوان', m.address || '—')}
            ${detailItem('المحافظة', m.governorate || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.briefcase}</span>
            البيانات المهنية
          </h4>
          <div class="detail-grid" style="margin-bottom:24px;">
            ${detailItem('نوع العضوية', typeName)}
            ${detailItem('الشعبة', branchName)}
            ${detailItem('المؤهل', m.qualification || '—')}
            ${detailItem('سنة التخرج', m.graduation_year || '—')}
            ${detailItem('التقدير', m.grade || '—')}
            ${detailItem('جهة العمل', m.employer || '—')}
            ${detailItem('المسمى الوظيفي', m.job_title || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
            <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.calendar}</span>
            العضوية والاشتراك
          </h4>
          <div class="detail-grid" style="margin-bottom:24px;">
            ${detailItem('رقم العضوية', m.membership_no || '—', true)}
            ${detailItem('تاريخ البداية', formatDate(m.membership_start))}
            ${detailItem('تاريخ الانتهاء', formatDate(m.membership_end))}
            ${detailItem('الأيام المتبقية', m.daysRemaining !== null ? (m.daysRemaining < 0 ? `متأخر ${Math.abs(m.daysRemaining)} يوم` : `${m.daysRemaining} يوم`) : '—')}
            ${detailItem('حالة الاشتراك',
              m.subStatus === 'active' ? 'نشط' :
              m.subStatus === 'soon' ? 'ينتهي قريبًا' : 'منتهي')}
            ${detailItem('حالة الكارنية', m.card_status === 'delivered' ? 'تم التسليم' :
              m.card_status === 'ready' ? 'جاهز' :
              m.card_status === 'processing' ? 'جاري التجهيز' : 'لم يُصدر')}
          </div>

          ${sub ? `
            <h4 style="font-family:'Tajawal',sans-serif;font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px;display:flex;align-items:center;gap:8px;">
              <span style="width:16px;height:16px;display:inline-flex;color:var(--accent);">${ICONS.award}</span>
              آخر اشتراك
            </h4>
            <div class="detail-grid">
              ${detailItem('بداية الاشتراك', formatDate(sub.start_date))}
              ${detailItem('نهاية الاشتراك', formatDate(sub.end_date))}
              ${detailItem('المبلغ', sub.amount ? `${sub.amount} جنيه` : '—')}
              ${detailItem('الحالة', sub.status === 'active' ? 'نشط' : sub.status === 'expired' ? 'منتهي' : sub.status)}
            </div>
          ` : ''}

        </div>

        <div class="modal-footer-custom">
          ${!m.membership_no ? `
            <button type="button" class="btn btn-primary" onclick="openAssignModal('${m.id}')">
              ${ICONS.key}
              <span>إصدار رقم العضوية</span>
            </button>
          ` : `
            <button type="button" class="btn btn-primary" onclick="renewSubscription('${m.id}')">
              ${ICONS.refresh}
              <span>تجديد الاشتراك</span>
            </button>
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

  window.closeMemberModal = function () {
    const modal = document.getElementById('memberModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ============================================
     ASSIGN MEMBERSHIP NO
     ============================================ */
  window.openAssignModal = function (memberId) {
    const m = membersWithSubs.find(x => String(x.id) === String(memberId));
    if (!m) return;

    currentMemberForAssign = m;

    const modal = document.getElementById('assignNoModal');
    if (!modal) return;

    // Close member modal first
    window.closeMemberModal();

    document.getElementById('assignAppId').value = m.id;
    document.getElementById('assignMemberName').value = m.full_name;
    document.getElementById('assignBranch').value = m.branch_id || '';
    document.getElementById('assignDuration').value = 12;

    // Auto-generate membership no
    generateMembershipNo();

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeAssignModal = function () {
    const modal = document.getElementById('assignNoModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentMemberForAssign = null;
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

  async function confirmAssign() {
    const appId = document.getElementById('assignAppId').value;
    const branchId = document.getElementById('assignBranch').value;
    const mno = document.getElementById('assignNo').value.trim();
    const duration = parseInt(document.getElementById('assignDuration').value) || 12;

    if (!appId) return;

    const m = membersWithSubs.find(x => String(x.id) === String(appId));
    if (!m) return;

    if (!mno) {
      showToast('رقم العضوية مطلوب', 'warning');
      return;
    }

    if (!branchId) {
      showToast('اختر الشعبة', 'warning');
      return;
    }

    const btn = document.getElementById('confirmAssignBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span><span class="spinner"></span>';
    }

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + duration);

      // Update member
      const { error: memErr } = await client
        .from('members')
        .update({
          membership_no: mno,
          branch_id: parseInt(branchId),
          membership_start: startDate.toISOString().split('T')[0],
          membership_end: endDate.toISOString().split('T')[0],
          card_status: 'processing',
          is_active: true
        })
        .eq('id', appId);

      if (memErr) throw memErr;

      // Create subscription
      const { error: subErr } = await client
        .from('membership_subscriptions')
        .insert([{
          member_id: appId,
          membership_type_id: m.membership_type_id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          amount: m.membership_type_id ? (membershipTypes.find(t => t.id === m.membership_type_id)?.fee || 0) : 0
        }]);

      if (subErr) console.warn('Sub creation failed:', subErr);

      // Log action
      if (window.logUserAction) {
        await window.logUserAction('assign_membership_no', 'member', appId, `رقم: ${mno}, شعبة: ${branchId}`);
      }

      showToast('تم إصدار رقم العضوية بنجاح', 'success');

      closeAssignModal();
      await loadMembers();

    } catch (err) {
      console.error('[Assign] Error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>اعتماد رقم العضوية</span>`;
      }
    }
  }

  /* ============================================
     RENEW SUBSCRIPTION
     ============================================ */
  async function renewSubscription(memberId) {
    const m = membersWithSubs.find(x => String(x.id) === String(memberId));
    if (!m) return;

    const months = prompt('عدد شهور التجديد؟', '12');
    if (!months) return;

    const duration = parseInt(months);
    if (isNaN(duration) || duration < 1) {
      showToast('رقم غير صالح', 'error');
      return;
    }

    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + duration);

      // Update member
      await client
        .from('members')
        .update({
          membership_start: startDate.toISOString().split('T')[0],
          membership_end: endDate.toISOString().split('T')[0]
        })
        .eq('id', memberId);

      // Create new subscription
      const { error } = await client
        .from('membership_subscriptions')
        .insert([{
          member_id: memberId,
          membership_type_id: m.membership_type_id,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
          amount: m.membership_type_id ? (membershipTypes.find(t => t.id === m.membership_type_id)?.fee || 0) : 0
        }]);

      if (error) throw error;

      if (window.logUserAction) {
        await window.logUserAction('renew_subscription', 'member', memberId, `تجديد ${duration} شهر`);
      }

      showToast('تم التجديد بنجاح', 'success');
      await loadMembers();

    } catch (err) {
      console.error('[Renew] Error:', err);
      showToast('فشل: ' + err.message, 'error');
    }
  }

  window.renewSubscription = renewSubscription;

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!filteredMembers.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم العضوية', 'الاسم', 'الرقم القومي', 'الموبايل',
      'البريد', 'الشعبة', 'المحافظة', 'نوع العضوية',
      'تاريخ البداية', 'تاريخ الانتهاء', 'الأيام المتبقية', 'حالة الاشتراك'
    ];

    const rows = filteredMembers.map(m => [
      m.membership_no || '',
      m.full_name || '',
      m.national_id || '',
      m.phone || '',
      m.email || '',
      getBranchName(m.branch_id),
      m.governorate || '',
      getTypeName(m.membership_type_id),
      formatDate(m.membership_start),
      formatDate(m.membership_end),
      m.daysRemaining !== null ? m.daysRemaining : '',
      m.subStatus === 'active' ? 'نشط' :
      m.subStatus === 'soon' ? 'ينتهي قريبًا' : 'منتهي'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `members_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['members', 'membership_subscriptions'],
      async () => {
        await loadMembers();
      },
      { debounceMs: 500, immediate: false }
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
        loadMembers();
      }, 400) : () => {};

      searchInput.addEventListener('input', debounced);
    }

    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => {
        filters.branch = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
      typeFilter.addEventListener('change', (e) => {
        filters.type = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    const subFilter = document.getElementById('subFilter');
    if (subFilter) {
      subFilter.addEventListener('change', (e) => {
        filters.subStatus = e.target.value;
        currentPage = 1;
        applySubStatusFilter();
        renderTable();
        renderPagination();
      });
    }

    // Actions
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadMembers();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const pendingApprovalBtn = document.getElementById('pendingApprovalBtn');
    if (pendingApprovalBtn) {
      pendingApprovalBtn.addEventListener('click', async () => {
        try {
          const { data, error } = await client
            .from('applications')
            .select('*')
            .eq('status', 'awaiting_membership_no')
            .order('created_at', { ascending: true });

          if (error) throw error;

          if (!data || !data.length) {
            showToast('لا توجد طلبات بانتظار رقم العضوية', 'info');
            return;
          }

          const list = data.map(a =>
            `• ${a.tracking_no} — ${a.full_name}`
          ).join('\n');

          alert(`الطلبات بانتظار رقم العضوية (${data.length}):\n\n${list}\n\nاذهب إلى لوحة النقيب → اعتماد النقيب`);
        } catch (err) {
          showToast('فشل: ' + err.message, 'error');
        }
      });
    }

    // Head approval
    const headApprovalBtn = document.getElementById('headApprovalBtn');
    if (headApprovalBtn) {
      headApprovalBtn.addEventListener('click', () => {
        window.location.href = 'head-approval.html';
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

    // Confirm assign
    const confirmBtn = document.getElementById('confirmAssignBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmAssign);
  }

  /* ============================================
     MODAL BACKDROPS
     ============================================ */
  function setupModalBackdrops() {
    ['memberModal', 'assignNoModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'memberModal') window.closeMemberModal();
          else window.closeAssignModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeMemberModal();
        window.closeAssignModal();
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

      await loadMembers();

      setupRealtime();

      console.log('[Members] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

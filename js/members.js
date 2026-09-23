/* =====================================================
   IT SYNDICATE — MEMBERS LOGIC
   Version: 3.0.0
   Path: js/members.js
   =====================================================
   يحتوي على:
   - Auth + Role check
   - 5 كروت إحصائية
   - جدول الأعضاء + Pagination
   - 5 فلاتر
   - Member Detail Modal (4 تابات)
   - Assign Membership No
   - Renew Modal
   - Export CSV + Print
   - Realtime
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const SOON_DAYS = 30;
  const ATTACHMENTS_BUCKET = 'attachments';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let members = [];
  let currentPage = 1;
  let totalCount = 0;
  let branches = [];
  let governorates = [];
  let membershipTypes = [];
  let filters = {
    search: '',
    branch: 'all',
    governorate: 'all',
    type: 'all',
    subStatus: 'all'
  };
  let unsubscribeRealtime = null;
  let currentMember = null;

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

  function getBranchName(branchId) {
    const b = branches.find(x => String(x.id) === String(branchId));
    return b?.name || '—';
  }

  function getTypeName(typeId) {
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

  function getSubStatus(endDate) {
    const days = getDaysRemaining(endDate);
    if (days === null) return { label: 'غير محدد', cls: 'sub-expired', key: 'expired' };
    if (days < 0) return { label: 'منتهي', cls: 'sub-expired', key: 'expired' };
    if (days <= SOON_DAYS) return { label: 'ينتهي قريبًا', cls: 'sub-soon', key: 'soon' };
    return { label: 'نشط', cls: 'sub-active', key: 'active' };
  }

  function getDaysClass(days) {
    if (days === null) return 'days-expired';
    if (days < 0) return 'days-expired';
    if (days <= SOON_DAYS) return 'days-soon';
    return 'days-active';
  }

  function getCardStatusLabel(status) {
    const map = {
      'not_issued': 'لم يتم الإصدار',
      'processing': 'جاري التجهيز',
      'ready': 'جاهز',
      'delivered': 'تم الاستلام'
    };
    return map[status] || 'غير محدد';
  }

  /* ============================================
     ICONS
     ============================================ */
  const ICONS = {
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
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
      window.currentUserRole = userRole;
      window.currentUserName = userData?.full_name || currentUser.email || 'موظف';

      const allowedRoles = ['head', 'vice_president', 'deputy', 'committee'];
      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للجنة العضويات والنقيب فقط');
        window.location.href = 'login.html';
        return false;
      }

      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';

        const headApprovalBtn = document.getElementById('headApprovalBtn');
        if (headApprovalBtn) headApprovalBtn.style.display = 'inline-flex';
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      const roleLabel = userRole === 'head' ? 'النقيب العام'
                      : userRole === 'vice_president' ? 'نائب رئيس النقابة'
                      : userRole === 'deputy' ? 'الوكيل'
                      : 'لجنة العضوات';

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
     LOOKUPS
     ============================================ */
  async function loadLookups() {
    try {
      const [brRes, govRes, typesRes] = await Promise.all([
        client.from('branches').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        client.from('governorates').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
        client.from('membership_types').select('*').order('sort_order', { ascending: true })
      ]);

      branches = brRes.data || [];
      governorates = govRes.data || [];
      membershipTypes = typesRes.data || [];

      const branchFilter = document.getElementById('branchFilter');
      if (branchFilter) {
        branchFilter.innerHTML = '<option value="all">كل الشعب</option>';
        branches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          branchFilter.appendChild(opt);
        });
      }

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

      const typeFilter = document.getElementById('typeFilter');
      if (typeFilter) {
        typeFilter.innerHTML = '<option value="all">كل الأنواع</option>';
        membershipTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          typeFilter.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('[Members] Lookups error:', err);
    }
  }

  /* ============================================
     STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('members')
        .select('membership_end, has_health_care')
        .eq('is_active', true);

      if (error || !data) return;

      let active = 0, soon = 0, expired = 0, hc = 0;

      data.forEach(m => {
        const st = getSubStatus(m.membership_end);
        if (st.key === 'active') active++;
        else if (st.key === 'soon') soon++;
        else expired++;

        if (m.has_health_care) hc++;
      });

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      set('statTotalMembers', data.length);
      set('statActiveSubs', active);
      set('statExpiringSoon', soon);
      set('statExpired', expired);
      set('statHealthCare', hc);
    } catch (e) {
      console.error('[Members] Stats error:', e);
    }
  }

  /* ============================================
     LOAD MEMBERS
     ============================================ */
  async function loadMembers() {
    const tbody = document.getElementById('membersTableBody');
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
        .from('members')
        .select('*', { count: 'exact' })
        .eq('is_active', true);

      if (filters.governorate && filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }

      if (filters.branch && filters.branch !== 'all') {
        query = query.eq('branch_id', parseInt(filters.branch));
      }

      if (filters.type && filters.type !== 'all') {
        query = query.eq('membership_type_id', parseInt(filters.type));
      }

      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${s}%,phone.ilike.%${s}%,national_id.ilike.%${s}%,membership_no.ilike.%${s}%`
        );
      }

      query = query.order('created_at', { ascending: false });

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      let list = data || [];

      if (filters.subStatus && filters.subStatus !== 'all') {
        list = list.filter(m => getSubStatus(m.membership_end).key === filters.subStatus);
      }

      members = list;
      totalCount = filters.subStatus !== 'all' ? list.length : (count || 0);

      renderTable();
      renderPagination();

      const countEl = document.getElementById('tableCount');
      if (countEl) countEl.textContent = `${members.length} عضو`;
    } catch (err) {
      console.error('[Members] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align:center;padding:40px;color:var(--danger);">
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
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!members.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.user}</span>
              <div style="font-size:15px;">لا يوجد أعضاء مطابقين</div>
              <div style="font-size:13px;">جرب تغيير الفلاتر أو البحث</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = members.map(m => {
      const st = getSubStatus(m.membership_end);
      const days = getDaysRemaining(m.membership_end);
      const daysText = days === null ? '—' : (days < 0 ? `منتهي (${Math.abs(days)} يوم)` : `${days} يوم`);
      const initials = getInitials(m.full_name);
      const branchName = getBranchName(m.branch_id);
      const hasHC = m.has_health_care === true;

      return `
        <tr data-id="${m.id}" style="cursor:pointer;transition:background 0.2s;border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;">
            <div class="member-cell">
              <div class="member-avatar">${escapeHtml(initials)}</div>
              <div class="member-info">
                <div class="member-name">${escapeHtml(m.full_name)}</div>
                <div class="member-nid">${escapeHtml(m.national_id)}</div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            ${m.membership_no ? `
              <span class="mno-badge">${escapeHtml(m.membership_no)}</span>
            ` : `
              <span class="mno-pending">بانتظار الإصدار</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <span class="branch-cell">${escapeHtml(branchName)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:100px;font-size:11.5px;color:#22c55e;font-weight:600;white-space:nowrap;">
              ${escapeHtml(m.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span class="sub-status ${st.cls}">
              <span class="dot"></span>
              ${escapeHtml(st.label)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span class="days-cell ${getDaysClass(days)}">${escapeHtml(daysText)}</span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(m.phone || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            ${hasHC ? `
              <span class="hc-badge">
                ${ICONS.heart}
                <span>نعم</span>
              </span>
            ` : `
              <span style="font-size:12px;color:var(--text-dim);">لا</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn view-btn" data-action="view" data-id="${m.id}" title="عرض التفاصيل">
                ${ICONS.eye}
              </button>
              <button class="row-btn key-btn" data-action="renew" data-id="${m.id}" title="تجديد">
                ${ICONS.refresh}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openMemberModal(tr.dataset.id);
      });
      tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(var(--accent-rgb), 0.04)'; });
      tr.addEventListener('mouseleave', () => { tr.style.background = ''; });
    });

    tbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'view') openMemberModal(id);
        else if (action === 'renew') window.openRenewModal(id);
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
          صفحة ${currentPage} من ${totalPages} — إجمالي ${totalCount} عضو
        </div>
        <div style="display:flex;gap:6px;align-items:center;">${pagesHTML}</div>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== currentPage) {
          currentPage = p;
          loadMembers();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  /* ============================================
     MEMBER MODAL
     ============================================ */
  async function openMemberModal(memberId) {
    const modal = document.getElementById('memberModal');
    const content = document.getElementById('memberModalContent');
    if (!modal || !content) return;

    content.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:var(--text-muted);">
        <span class="spinner"></span>
      </div>
    `;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
      const { data: member, error } = await client
        .from('members')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();

      if (error || !member) throw new Error('لم يتم العثور على العضو');

      currentMember = member;

      const { data: payments } = await client
        .from('payments')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });

      const { data: subs } = await client
        .from('membership_subscriptions')
        .select('*')
        .eq('member_id', memberId)
        .order('start_date', { ascending: false });

      renderMemberContent(member, payments || [], subs || []);
    } catch (err) {
      console.error('[Members] Detail error:', err);
      content.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--danger);">
          ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function renderMemberContent(m, payments, subs) {
    const content = document.getElementById('memberModalContent');
    if (!content) return;

    const st = getSubStatus(m.membership_end);
    const typeName = getTypeName(m.membership_type_id);
    const branchName = getBranchName(m.branch_id);
    const hcStatus = m.has_health_care ? getSubStatus(m.health_care_end) : null;

    const canAssign = !m.membership_no || !m.membership_no.trim();

    content.innerHTML = `
      <div style="animation: fadeUp 0.4s;">

        <!-- HEADER -->
        <div style="padding:22px 24px;border-bottom:1px solid var(--border-soft);display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:linear-gradient(135deg, rgba(var(--accent-rgb), 0.04), transparent);">
          <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-2-rgb),0.15));border:1px solid rgba(var(--accent-rgb),0.3);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:var(--accent);flex-shrink:0;">
            ${escapeHtml(getInitials(m.full_name))}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'Tajawal',sans-serif;font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px;">
              ${escapeHtml(m.full_name)}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${m.membership_no ? `<span class="mno-badge">${escapeHtml(m.membership_no)}</span>` : `<span class="mno-pending">بانتظار الإصدار</span>`}
              <span class="sub-status ${st.cls}">
                <span class="dot"></span>
                ${escapeHtml(st.label)}
              </span>
              ${m.has_health_care ? `<span class="hc-badge">${ICONS.heart}<span>رعاية صحية</span></span>` : ''}
            </div>
          </div>
          <button type="button" onclick="closeMemberModal()" style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="width:16px;height:16px;display:inline-flex;">${ICONS.close}</span>
          </button>
        </div>

        <!-- TABS -->
        <div class="modal-tabs" style="margin:16px 24px 0;">
          <button class="modal-tab-btn active" data-modal-tab="info">المعلومات</button>
          <button class="modal-tab-btn" data-modal-tab="subs">الاشتراكات</button>
          <button class="modal-tab-btn" data-modal-tab="payments">سجل المدفوعات</button>
          ${canAssign ? `<button class="modal-tab-btn" data-modal-tab="membership">رقم العضوية</button>` : ''}
        </div>

        <!-- TAB: INFO -->
        <div data-tab-panel="info" style="padding:24px;overflow-y:auto;max-height:calc(90vh - 260px);">
          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">البيانات الشخصية</h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('الرقم القومي', m.national_id, true)}
            ${renderDetailItem('تاريخ الميلاد', formatDate(m.birth_date))}
            ${renderDetailItem('السن', m.age || '—')}
            ${renderDetailItem('الموبايل', m.phone, true)}
            ${renderDetailItem('البريد', m.email || '—')}
            ${renderDetailItem('العنوان', m.address || '—')}
            ${renderDetailItem('المحافظة', m.governorate || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">البيانات المهنية</h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('نوع العضوية', typeName)}
            ${renderDetailItem('الشعبة', branchName)}
            ${renderDetailItem('المؤهل', m.qualification || '—')}
            ${renderDetailItem('سنة التخرج', m.graduation_year || '—')}
            ${renderDetailItem('جهة العمل', m.employer || '—')}
            ${renderDetailItem('المسمى الوظيفي', m.job_title || '—')}
          </div>

          ${m.has_health_care ? `
            <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:#ec4899;margin-bottom:12px;">الرعاية الصحية</h4>
            <div class="detail-grid" style="margin-bottom:20px;">
              ${renderDetailItem('بداية الرعاية', formatDate(m.health_care_start))}
              ${renderDetailItem('نهاية الرعاية', formatDate(m.health_care_end))}
              ${renderDetailItem('المبلغ', (parseFloat(m.health_care_amount) || 0).toLocaleString('ar-EG') + ' ج', true)}
              ${renderDetailItem('الحالة', hcStatus?.label || '—')}
            </div>
          ` : ''}

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">بيانات العضوية</h4>
          <div class="detail-grid">
            ${renderDetailItem('بداية العضوية', formatDate(m.membership_start))}
            ${renderDetailItem('نهاية العضوية', formatDate(m.membership_end))}
            ${renderDetailItem('إجمالي المدفوع', (parseFloat(m.total_paid) || 0).toLocaleString('ar-EG') + ' ج', true)}
            ${renderDetailItem('حالة الكارنية', getCardStatusLabel(m.card_status))}
          </div>
        </div>

        <!-- TAB: SUBS -->
        <div data-tab-panel="subs" style="padding:24px;overflow-y:auto;max-height:calc(90vh - 260px);display:none;">
          ${renderSubsTab(subs, m)}
        </div>

        <!-- TAB: PAYMENTS -->
        <div data-tab-panel="payments" style="padding:24px;overflow-y:auto;max-height:calc(90vh - 260px);display:none;">
          ${renderPaymentsTab(payments)}
        </div>

        ${canAssign ? `
          <div data-tab-panel="membership" style="padding:24px;overflow-y:auto;max-height:calc(90vh - 260px);display:none;">
            <div class="notice info">
              <strong>ملاحظة:</strong> هذا العضو ليس لديه رقم عضوية حتى الآن. اضغط الزر أدناه لإصدار رقم عضوية جديد.
            </div>

            <div class="form-group">
              <label for="quickBranch">الشعبة <span style="color:var(--danger);">*</span></label>
              <select id="quickBranch">
                <option value="">-- اختر الشعبة --</option>
                ${branches.map(b => `<option value="${b.id}" ${String(b.id) === String(m.branch_id) ? 'selected' : ''}>${escapeHtml(b.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="quickMembershipNo">رقم العضوية</label>
              <input type="text" id="quickMembershipNo" placeholder="MEM-2026-00001" dir="ltr" style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;" />
              <span class="form-hint">سيتم توليده تلقائيًا لو تركته فاضيًا</span>
            </div>

            <div class="form-group">
              <label for="quickDuration">مدة العضوية (شهور)</label>
              <input type="number" id="quickDuration" value="12" min="1" max="120" />
            </div>

            <button type="button" class="btn btn-success btn-block" id="quickAssignBtn" style="margin-top:16px;">
              ${ICONS.check}
              <span>اعتماد رقم العضوية</span>
            </button>
          </div>
        ` : ''}

      </div>
    `;

    // Tabs listeners
    content.querySelectorAll('[data-modal-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.modalTab;
        content.querySelectorAll('[data-modal-tab]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        content.querySelectorAll('[data-tab-panel]').forEach(p => {
          p.style.display = p.dataset.tabPanel === tab ? 'block' : 'none';
        });
      });
    });

    // Quick assign
    const assignBtn = document.getElementById('quickAssignBtn');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => quickAssignMembershipNo(m));
    }
  }

  function renderDetailItem(label, value, isMono = false) {
    return `
      <div class="detail-item">
        <div class="detail-item-label">${escapeHtml(label)}</div>
        <div class="detail-item-value" style="${isMono ? "font-family:'JetBrains Mono',monospace;direction:ltr;text-align:right;" : ''}">
          ${escapeHtml(value || '—')}
        </div>
      </div>
    `;
  }

  function renderSubsTab(subs, m) {
    if (!subs.length && !m.membership_start) {
      return '<div class="empty-payment">لا يوجد سجل اشتراكات بعد</div>';
    }

    const list = subs.length ? subs : [{
      id: 'current',
      start_date: m.membership_start,
      end_date: m.membership_end,
      amount: m.total_paid
    }];

    return list.map(s => {
      const st = getSubStatus(s.end_date);
      const days = getDaysRemaining(s.end_date);
      const daysText = days === null ? '—' : (days < 0 ? `منتهي (${Math.abs(days)} يوم)` : `${days} يوم`);
      return `
        <div style="padding:16px;background:rgba(0,0,0,0.3);border:1px solid var(--border-soft);border-radius:12px;margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:700;color:var(--text);">${escapeHtml(formatDate(s.start_date))} — ${escapeHtml(formatDate(s.end_date))}</div>
            <span class="sub-status ${st.cls}">
              <span class="dot"></span>
              ${escapeHtml(st.label)}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;">
            <span style="color:var(--text-muted);">المبلغ: <strong style="color:var(--success);font-family:'JetBrains Mono',monospace;">${(parseFloat(s.amount) || 0).toLocaleString('ar-EG')} ج</strong></span>
            <span class="days-cell ${getDaysClass(days)}">${escapeHtml(daysText)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPaymentsTab(payments) {
    if (!payments.length) {
      return '<div class="empty-payment">لا يوجد سجل مدفوعات بعد</div>';
    }

    return payments.map(p => {
      const status = p.status === 'confirmed'
        ? { label: 'مؤكد', cls: 'sub-active' }
        : p.status === 'pending'
        ? { label: 'معلق', cls: 'sub-soon' }
        : { label: 'مرفوض', cls: 'sub-expired' };

      return `
        <div class="payment-history-item">
          <div class="ph-info">
            <div class="ph-date">${escapeHtml(formatDate(p.created_at))}</div>
            <div class="ph-amount">${(parseFloat(p.amount) || 0).toLocaleString('ar-EG')} ج</div>
            <div class="ph-type">${escapeHtml(p.payment_method || '—')}</div>
          </div>
          <div class="ph-actions">
            <span class="sub-status ${status.cls}">${status.label}</span>
            ${p.receipt_path ? `
              <button class="ph-btn view" data-action="view-receipt" data-path="${escapeHtml(p.receipt_path)}" title="عرض الإيصال">
                ${ICONS.eye}
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  window.closeMemberModal = function () {
    const modal = document.getElementById('memberModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentMember = null;
  };

  /* ============================================
     QUICK ASSIGN MEMBERSHIP NO
     ============================================ */
  async function quickAssignMembershipNo(m) {
    const branchId = document.getElementById('quickBranch')?.value;
    const membershipNo = document.getElementById('quickMembershipNo')?.value.trim();
    const duration = parseInt(document.getElementById('quickDuration')?.value) || 12;

    if (!branchId) {
      showToast('اختر الشعبة أولًا', 'warning');
      return;
    }

    const btn = document.getElementById('quickAssignBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الاعتماد...</span><span class="spinner"></span>';
    }

    try {
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const endDate = new Date(now.getFullYear(), now.getMonth() + duration, now.getDate())
        .toISOString().slice(0, 10);

      let finalMembershipNo = membershipNo;
      if (!finalMembershipNo) {
        const year = now.getFullYear();
        const prefix = 'MEM';
        const br = branches.find(b => String(b.id) === String(branchId));
        const branchCode = br?.code ? `-${br.code}` : '';

        const { count } = await client
          .from('members')
          .select('id', { count: 'exact', head: true })
          .like('membership_no', `${prefix}-${year}${branchCode}-%`);

        const nextNum = (count || 0) + 1;
        const padded = String(nextNum).padStart(5, '0');
        finalMembershipNo = `${prefix}-${year}${branchCode}-${padded}`;
      }

      const { error } = await client
        .from('members')
        .update({
          membership_no: finalMembershipNo,
          branch_id: parseInt(branchId),
          membership_start: startDate,
          membership_end: endDate,
          is_active: true
        })
        .eq('id', m.id);

      if (error) throw error;

      if (m.application_id) {
        try {
          await client
            .from('applications')
            .update({
              membership_no: finalMembershipNo,
              status: 'membership_no_assigned',
              branch_id: parseInt(branchId)
            })
            .eq('id', m.application_id);

          await client.from('status_history').insert([{
            application_id: m.application_id,
            old_status: 'paid',
            new_status: 'membership_no_assigned',
            notes: `تم إصدار رقم العضوية: ${finalMembershipNo}`,
            changed_by: currentUser.id,
            changed_by_name: window.currentUserName,
            is_auto: false
          }]);
        } catch (e) {}
      }

      showToast(`تم اعتماد رقم العضوية: ${finalMembershipNo}`, 'success');

      window.closeMemberModal();
      await loadMembers();
      await loadStats();
    } catch (err) {
      console.error('[Members] Assign error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>اعتماد رقم العضوية</span>`;
      }
    }
  }

  /* ============================================
     RENEW MODAL
     ============================================ */
  window.openRenewModal = function (memberId) {
    const modal = document.getElementById('renewModal');
    if (!modal) return;

    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) return;

    currentMember = member;

    document.getElementById('renewMemberId').value = member.id;
    document.getElementById('renewMemberName').value = member.full_name || '';
    document.getElementById('renewMonths').value = '12';
    document.getElementById('renewStartDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('renewAmount').value = '';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeRenewModal = function () {
    const modal = document.getElementById('renewModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function confirmRenew() {
    if (!currentMember) return;

    const memberId = document.getElementById('renewMemberId').value;
    const months = parseInt(document.getElementById('renewMonths').value) || 12;
    const startDate = document.getElementById('renewStartDate').value;
    const amount = parseFloat(document.getElementById('renewAmount').value) || 0;

    if (!startDate) {
      showToast('اختر تاريخ البداية', 'warning');
      return;
    }

    const btn = document.getElementById('confirmRenewBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري التجديد...</span><span class="spinner"></span>';
    }

    try {
      const start = new Date(startDate);
      const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate());
      const endDate = end.toISOString().slice(0, 10);

      const { error } = await client
        .from('members')
        .update({
          membership_start: startDate,
          membership_end: endDate,
          total_paid: (parseFloat(currentMember.total_paid) || 0) + amount
        })
        .eq('id', memberId);

      if (error) throw error;

      try {
        await client.from('membership_subscriptions').insert([{
          member_id: memberId,
          start_date: startDate,
          end_date: endDate,
          amount: amount,
          is_active: true
        }]);
      } catch (e) {}

      if (amount > 0) {
        try {
          await client.from('payments').insert([{
            member_id: memberId,
            amount: amount,
            payment_method: 'cash',
            status: 'confirmed',
            notes: `تجديد لمدة ${months} شهر`
          }]);
        } catch (e) {}
      }

      showToast('تم التجديد بنجاح', 'success');

      window.closeRenewModal();
      await loadMembers();
      await loadStats();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('member-renewed', { memberId });
      }
    } catch (err) {
      console.error('[Members] Renew error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>تجديد</span>`;
      }
    }
  }

  /* ============================================
     VIEW RECEIPT
     ============================================ */
  async function viewReceipt(path) {
    try {
      const { data, error } = await client.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(path, 3600);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      showToast('فشل فتح الإيصال: ' + err.message, 'error');
    }
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!members.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم العضوية', 'الاسم', 'الرقم القومي', 'الموبايل',
      'البريد', 'الشعبة', 'المحافظة', 'نوع العضوية',
      'بداية الاشتراك', 'نهاية الاشتراك', 'حالة الاشتراك',
      'الرعاية الصحية', 'إجمالي المدفوع'
    ];

    const rows = members.map(m => {
      const st = getSubStatus(m.membership_end);
      return [
        m.membership_no || '',
        m.full_name,
        m.national_id,
        m.phone,
        m.email || '',
        getBranchName(m.branch_id),
        m.governorate || '',
        getTypeName(m.membership_type_id),
        formatDate(m.membership_start),
        formatDate(m.membership_end),
        st.label,
        m.has_health_care ? 'نعم' : 'لا',
        parseFloat(m.total_paid) || 0
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
      ['members', 'membership_subscriptions', 'payments'],
      async () => {
        await loadMembers();
        await loadStats();
      },
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function setupListeners() {
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
        loadMembers();
      });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      let t = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => {
          filters.search = searchInput.value;
          currentPage = 1;
          loadMembers();
        }, 400);
      });
    }

    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadMembers();
        await loadStats();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

    const exportPdfBtn = document.getElementById('exportPdfBtn');
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => window.print());

    const headApprovalBtn = document.getElementById('headApprovalBtn');
    if (headApprovalBtn) {
      headApprovalBtn.addEventListener('click', () => {
        window.location.href = 'head-approval.html';
      });
    }

    const pendingApprovalBtn = document.getElementById('pendingApprovalBtn');
    if (pendingApprovalBtn) {
      pendingApprovalBtn.addEventListener('click', () => {
        window.location.href = 'head-approval.html';
      });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    const confirmRenewBtn = document.getElementById('confirmRenewBtn');
    if (confirmRenewBtn) confirmRenewBtn.addEventListener('click', confirmRenew);

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="view-receipt"]');
      if (btn) {
        e.preventDefault();
        viewReceipt(btn.dataset.path);
      }
    });

    ['memberModal', 'renewModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'memberModal') window.closeMemberModal();
          else if (id === 'renewModal') window.closeRenewModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeMemberModal();
        window.closeRenewModal();
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

      await loadStats();
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

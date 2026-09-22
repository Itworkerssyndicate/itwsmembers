/* =====================================================
   IT SYNDICATE — SUBSCRIPTIONS LOGIC
   Version: 3.0.0
   =====================================================
   يحتوي على:
   - Auth + Role check
   - 4 كروت إحصائية (نشط / قريب / منتهي / إجمالي)
   - 4 تابات (نشطة / تنتهي قريبًا / منتهية / الكل)
   - جدول الاشتراكات + Pagination
   - 4 فلاتر (بحث + شعبة + محافظة + فترة تنبيه)
   - تجديد فردي
   - تجديد جماعي
   - Export CSV + Print
   - Realtime
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const DEFAULT_SOON_DAYS = 30;

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
  let currentTab = 'active';
  let soonDays = DEFAULT_SOON_DAYS;
  let filters = {
    search: '',
    branch: 'all',
    governorate: 'all'
  };
  let unsubscribeRealtime = null;
  let currentRenewMember = null;

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
    if (days === null) return { label: 'غير محدد', cls: 'status-expired', key: 'expired' };
    if (days < 0) return { label: 'منتهي', cls: 'status-expired', key: 'expired' };
    if (days <= soonDays) return { label: 'ينتهي قريبًا', cls: 'status-soon', key: 'soon' };
    return { label: 'نشط', cls: 'status-active', key: 'active' };
  }

  function getDaysClass(days) {
    if (days === null) return 'days-expired';
    if (days < 0) return 'days-expired';
    if (days <= soonDays) return 'days-soon';
    return 'days-active';
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    download: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    print: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>'
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

      const allowedRoles = ['head', 'vice_president', 'deputy', 'committee'];
      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للجنة العضويات والنقيب فقط');
        window.location.href = 'login.html';
        return false;
      }

      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      const roleLabel = userRole === 'head' ? 'النقيب العام'
                      : userRole === 'vice_president' ? 'نائب رئيس النقابة'
                      : userRole === 'deputy' ? 'الوكيل'
                      : 'لجنة العضويات';

      document.querySelectorAll('[data-user-role]').forEach(el => {
        el.textContent = roleLabel;
      });

      return true;
    } catch (err) {
      console.error('[Subscriptions] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD LOOKUPS
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

    } catch (err) {
      console.error('[Subscriptions] Lookups error:', err);
    }
  }

  /* ============================================
     LOAD SUMMARY
     ============================================ */
  async function loadSummary() {
    try {
      const { data, error } = await client
        .from('members')
        .select('membership_end')
        .eq('is_active', true);

      if (error || !data) return;

      let active = 0, soon = 0, expired = 0;

      data.forEach(m => {
        const st = getSubStatus(m.membership_end);
        if (st.key === 'active') active++;
        else if (st.key === 'soon') soon++;
        else expired++;
      });

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      set('sumActive', active);
      set('sumSoon', soon);
      set('sumExpired', expired);
      set('sumTotal', data.length);

      // Tab counts
      set('countActive', active);
      set('countSoon', soon);
      set('countExpired', expired);
      set('countAll', data.length);

    } catch (e) {
      console.error('[Subscriptions] Summary error:', e);
    }
  }

  /* ============================================
     LOAD MEMBERS
     ============================================ */
  async function loadMembers() {
    const tbody = document.getElementById('subsTableBody');
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

      if (filters.search) {
        const s = filters.search.trim();
        query = query.or(
          `full_name.ilike.%${s}%,phone.ilike.%${s}%,national_id.ilike.%${s}%,membership_no.ilike.%${s}%`
        );
      }

      query = query.order('membership_end', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      let allMembers = data || [];

      // Filter by tab
      if (currentTab === 'active') {
        allMembers = allMembers.filter(m => getSubStatus(m.membership_end).key === 'active');
      } else if (currentTab === 'soon') {
        allMembers = allMembers.filter(m => getSubStatus(m.membership_end).key === 'soon');
      } else if (currentTab === 'expired') {
        allMembers = allMembers.filter(m => getSubStatus(m.membership_end).key === 'expired');
      }

      members = allMembers;
      totalCount = allMembers.length;

      renderTable();
      renderPagination();

      const countEl = document.getElementById('tableCount');
      if (countEl) countEl.textContent = `${members.length} عضو`;

    } catch (err) {
      console.error('[Subscriptions] Load error:', err);
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
    const tbody = document.getElementById('subsTableBody');
    if (!tbody) return;

    if (!members.length) {
      const labels = {
        active: 'لا يوجد أعضاء باشتراكات نشطة',
        soon: 'لا يوجد أعضاء باشتراكات تنتهي قريبًا',
        expired: 'لا يوجد أعضاء باشتراكات منتهية',
        all: 'لا يوجد أعضاء'
      };
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:15px;">${escapeHtml(labels[currentTab] || 'لا يوجد أعضاء')}</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageMembers = members.slice(start, end);

    tbody.innerHTML = pageMembers.map(m => {
      const st = getSubStatus(m.membership_end);
      const days = getDaysRemaining(m.membership_end);
      const daysText = days === null ? '—' : (days < 0 ? `منتهي (${Math.abs(days)} يوم)` : `${days} يوم`);
      const initials = getInitials(m.full_name);
      const branchName = getBranchName(m.branch_id);

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
              <span style="font-size:11.5px;color:var(--text-dim);">—</span>
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
            <span style="font-size:12px;color:var(--text-muted);">${escapeHtml(formatDate(m.membership_start))}</span>
          </td>
          <td style="padding:14px 12px;">
            <span style="font-size:12px;color:var(--text-muted);">${escapeHtml(formatDate(m.membership_end))}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="days-cell ${getDaysClass(days)}">${escapeHtml(daysText)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="status-badge ${st.cls}">
              <span class="dot"></span>
              ${escapeHtml(st.label)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn renew-btn" data-action="renew" data-id="${m.id}" title="تجديد">
                ${ICONS.refresh}
              </button>
              <button class="row-btn view-btn" data-action="view" data-id="${m.id}" title="عرض">
                ${ICONS.eye}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openRenewModal(tr.dataset.id);
      });
      tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(var(--accent-rgb), 0.04)'; });
      tr.addEventListener('mouseleave', () => { tr.style.background = ''; });
    });

    tbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'renew') openRenewModal(id);
        else if (action === 'view') {
          window.location.href = `members.html?id=${id}`;
        }
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
          renderTable();
          renderPagination();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  /* ============================================
     RENEW MODAL
     ============================================ */
  function openRenewModal(memberId) {
    const modal = document.getElementById('renewModal');
    if (!modal) return;

    const member = members.find(m => String(m.id) === String(memberId));
    if (!member) {
      showToast('لم يتم العثور على العضو', 'error');
      return;
    }

    currentRenewMember = member;

    document.getElementById('renewMemberId').value = member.id;
    document.getElementById('renewMemberName').value = member.full_name || '';
    document.getElementById('renewMonths').value = '12';
    document.getElementById('renewStartDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('renewAmount').value = '';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  window.closeRenewModal = function () {
    const modal = document.getElementById('renewModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    currentRenewMember = null;
  };

  async function confirmRenew() {
    if (!currentRenewMember) return;

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
          total_paid: (parseFloat(currentRenewMember.total_paid) || 0) + amount
        })
        .eq('id', memberId);

      if (error) throw error;

      // Add subscription record
      try {
        await client.from('membership_subscriptions').insert([{
          member_id: memberId,
          start_date: startDate,
          end_date: endDate,
          amount: amount,
          is_active: true,
          created_by: currentUser.id
        }]);
      } catch (e) {}

      // Add payment record
      if (amount > 0) {
        try {
          await client.from('payments').insert([{
            member_id: memberId,
            amount: amount,
            payment_method: 'cash',
            status: 'confirmed',
            notes: `تجديد لمدة ${months} شهر`,
            created_by: currentUser.id
          }]);
        } catch (e) {}
      }

      showToast('تم التجديد بنجاح', 'success');

      closeRenewModal();
      await loadMembers();
      await loadSummary();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('subscription-renewed', { memberId });
      }

    } catch (err) {
      console.error('[Subscriptions] Renew error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>تجديد</span>`;
      }
    }
  }

  /* ============================================
     BULK RENEW MODAL
     ============================================ */
  window.openBulkRenewModal = function () {
    const modal = document.getElementById('bulkRenewModal');
    if (!modal) return;

    const info = document.getElementById('bulkRenewInfo');
    if (info) {
      info.textContent = `سيتم تجديد ${members.length} عضو ظاهر حاليًا في الجدول.`;
    }

    document.getElementById('bulkRenewMonths').value = '12';
    document.getElementById('bulkRenewAmount').value = '';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeBulkRenewModal = function () {
    const modal = document.getElementById('bulkRenewModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function confirmBulkRenew() {
    if (!members.length) {
      showToast('لا يوجد أعضاء للتجديد', 'warning');
      return;
    }

    const months = parseInt(document.getElementById('bulkRenewMonths').value) || 12;
    const amount = parseFloat(document.getElementById('bulkRenewAmount').value) || 0;

    if (!confirm(`هل أنت متأكد من تجديد ${members.length} عضو لمدة ${months} شهر؟`)) {
      return;
    }

    const btn = document.getElementById('confirmBulkRenewBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري التجديد...</span><span class="spinner"></span>';
    }

    let successCount = 0;
    let errorCount = 0;

    try {
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const end = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
      const endDate = end.toISOString().slice(0, 10);

      for (const m of members) {
        try {
          await client
            .from('members')
            .update({
              membership_start: startDate,
              membership_end: endDate,
              total_paid: (parseFloat(m.total_paid) || 0) + amount
            })
            .eq('id', m.id);

          // Subscription record
          try {
            await client.from('membership_subscriptions').insert([{
              member_id: m.id,
              start_date: startDate,
              end_date: endDate,
              amount: amount,
              is_active: true,
              created_by: currentUser.id
            }]);
          } catch (e) {}

          // Payment record
          if (amount > 0) {
            try {
              await client.from('payments').insert([{
                member_id: m.id,
                amount: amount,
                payment_method: 'cash',
                status: 'confirmed',
                notes: `تجديد جماعي لمدة ${months} شهر`,
                created_by: currentUser.id
              }]);
            } catch (e) {}
          }

          successCount++;
        } catch (err) {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(`تم تجديد ${successCount} عضو بنجاح`, 'success');
      } else {
        showToast(`تم تجديد ${successCount} عضو — فشل ${errorCount}`, 'warning', 4000);
      }

      closeBulkRenewModal();
      await loadMembers();
      await loadSummary();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('bulk-renewed', { count: successCount });
      }

    } catch (err) {
      console.error('[Subscriptions] Bulk renew error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>تجديد الجميع</span>`;
      }
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
      'الشعبة', 'المحافظة', 'بداية الاشتراك', 'نهاية الاشتراك',
      'المتبقي (يوم)', 'حالة الاشتراك'
    ];

    const rows = members.map(m => {
      const days = getDaysRemaining(m.membership_end);
      const st = getSubStatus(m.membership_end);
      return [
        m.membership_no || '',
        m.full_name,
        m.national_id,
        m.phone,
        getBranchName(m.branch_id),
        m.governorate || '',
        formatDate(m.membership_start),
        formatDate(m.membership_end),
        days === null ? '' : days,
        st.label
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
    link.download = `subscriptions_${currentTab}_${new Date().toISOString().slice(0, 10)}.csv`;
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
        await loadSummary();
      },
      { debounceMs: 600, immediate: false }
    );
  }

  /* ============================================
     SETUP LISTENERS
     ============================================ */
  function setupListeners() {
    // Tabs
    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tabBtn;
        currentTab = tab;
        currentPage = 1;

        document.querySelectorAll('[data-tab-btn]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });

        loadMembers();
      });
    });

    // Branch filter
    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => {
        filters.branch = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    // Gov filter
    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    // Days filter
    const daysFilter = document.getElementById('daysFilter');
    if (daysFilter) {
      daysFilter.addEventListener('change', (e) => {
        soonDays = parseInt(e.target.value) || DEFAULT_SOON_DAYS;
        await loadMembers();
        await loadSummary();
      });
    }

    // Search
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

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadMembers();
        await loadSummary();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Export
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    // Print
    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // Bulk renew
    const bulkRenewBtn = document.getElementById('bulkRenewBtn');
    if (bulkRenewBtn) bulkRenewBtn.addEventListener('click', () => window.openBulkRenewModal());

    const confirmBulkRenewBtn = document.getElementById('confirmBulkRenewBtn');
    if (confirmBulkRenewBtn) confirmBulkRenewBtn.addEventListener('click', confirmBulkRenew);

    const confirmRenewBtn = document.getElementById('confirmRenewBtn');
    if (confirmRenewBtn) confirmRenewBtn.addEventListener('click', confirmRenew);

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
    ['renewModal', 'bulkRenewModal'].forEach(id => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (id === 'renewModal') window.closeRenewModal();
          else if (id === 'bulkRenewModal') window.closeBulkRenewModal();
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.closeRenewModal();
        window.closeBulkRenewModal();
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

      await loadSummary();
      await loadMembers();

      setupRealtime();

      console.log('[Subscriptions] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

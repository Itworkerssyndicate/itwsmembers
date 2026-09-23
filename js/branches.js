/* =====================================================
   IT SYNDICATE — BRANCHES MANAGER LOGIC
   Version: 3.0.0
   Path: js/branches.js
   =====================================================
   يحتوي على:
   - Auth + Role check (branches_manager / head / vp / deputy)
   - 5 كروت إحصائية
   - جدول الأعضاء حسب المحافظة والشعبة
   - 4 فلاتر
   - Member Detail Modal
   - Export CSV
   - Realtime
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
  let currentPage = 1;
  let totalCount = 0;
  let branches = [];
  let governorates = [];
  let membershipTypes = [];
  let filters = {
    search: '',
    governorate: 'all',
    branch: 'all',
    subStatus: 'all'
  };
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

  function getSubStatus(endDate) {
    const days = getDaysRemaining(endDate);
    if (days === null) return { label: 'غير محدد', cls: 'status-expired', key: 'expired' };
    if (days < 0) return { label: 'منتهي', cls: 'status-expired', key: 'expired' };
    if (days <= SOON_DAYS) return { label: 'ينتهي قريبًا', cls: 'status-soon', key: 'soon' };
    return { label: 'نشط', cls: 'status-active', key: 'active' };
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
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    health: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>'
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

      const allowedRoles = ['branches_manager', 'head', 'vice_president', 'deputy'];
      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة لمدير الفروع فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      return true;
    } catch (err) {
      console.error('[Branches] Auth error:', err);
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
    } catch (err) {
      console.error('[Branches] Lookups error:', err);
    }
  }

  /* ============================================
     STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('members')
        .select('membership_end, governorate')
        .eq('is_active', true);

      if (error || !data) return;

      let active = 0, soon = 0, expired = 0;
      const govSet = new Set();

      data.forEach(m => {
        const st = getSubStatus(m.membership_end);
        if (st.key === 'active') active++;
        else if (st.key === 'soon') soon++;
        else expired++;

        if (m.governorate) govSet.add(m.governorate);
      });

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      set('statTotal', data.length);
      set('statActive', active);
      set('statSoon', soon);
      set('statExpired', expired);
      set('statGovs', govSet.size);
    } catch (e) {
      console.error('[Branches] Stats error:', e);
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
      console.error('[Branches] Load error:', err);
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
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
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
              <span style="font-size:11.5px;color:var(--text-dim);">—</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <span class="branch-cell">${escapeHtml(branchName)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="gov-badge">${escapeHtml(m.governorate || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="status-badge ${st.cls}">
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
                ${ICONS.health}
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
        openMemberModal(btn.dataset.id);
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
     MEMBER DETAIL MODAL
     ============================================ */
  async function openMemberModal(memberId) {
    const modal = document.getElementById('memberModal');
    const body = document.getElementById('memberModalBody');
    if (!modal || !body) return;

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    body.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <span class="spinner"></span>
      </div>
    `;

    try {
      const { data: m, error } = await client
        .from('members')
        .select('*')
        .eq('id', memberId)
        .maybeSingle();

      if (error || !m) throw new Error('لم يتم العثور على العضو');

      const st = getSubStatus(m.membership_end);
      const branchName = getBranchName(m.branch_id);
      const typeName = getMembershipTypeName(m.membership_type_id);

      body.innerHTML = `
        <div style="animation:fadeUp 0.3s;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-soft);">
            <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-2-rgb),0.15));border:1px solid rgba(var(--accent-rgb),0.3);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:var(--accent);flex-shrink:0;">
              ${escapeHtml(getInitials(m.full_name))}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Tajawal',sans-serif;font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px;">
                ${escapeHtml(m.full_name)}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${m.membership_no ? `<span class="mno-badge">${escapeHtml(m.membership_no)}</span>` : ''}
                <span class="status-badge ${st.cls}">
                  <span class="dot"></span>
                  ${escapeHtml(st.label)}
                </span>
              </div>
            </div>
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">البيانات الشخصية</h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('الرقم القومي', m.national_id, true)}
            ${renderDetailItem('الموبايل', m.phone, true)}
            ${renderDetailItem('البريد', m.email || '—')}
            ${renderDetailItem('المحافظة', m.governorate || '—')}
            ${renderDetailItem('العنوان', m.address || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">البيانات المهنية</h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('نوع العضوية', typeName)}
            ${renderDetailItem('الشعبة', branchName)}
            ${renderDetailItem('المؤهل', m.qualification || '—')}
            ${renderDetailItem('جهة العمل', m.employer || '—')}
            ${renderDetailItem('المسمى الوظيفي', m.job_title || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">بيانات العضوية</h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('بداية العضوية', formatDate(m.membership_start))}
            ${renderDetailItem('نهاية العضوية', formatDate(m.membership_end))}
            ${renderDetailItem('إجمالي المدفوع', (parseFloat(m.total_paid) || 0).toLocaleString('ar-EG') + ' ج', true)}
            ${renderDetailItem('حالة الكارنية', getCardStatusLabel(m.card_status))}
          </div>

          ${m.has_health_care ? `
            <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:#ec4899;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
              ${ICONS.health}
              الرعاية الصحية
            </h4>
            <div class="detail-grid">
              ${renderDetailItem('بداية الرعاية', formatDate(m.health_care_start))}
              ${renderDetailItem('نهاية الرعاية', formatDate(m.health_care_end))}
              ${renderDetailItem('مبلغ الرعاية', (parseFloat(m.health_care_amount) || 0).toLocaleString('ar-EG') + ' ج', true)}
            </div>
          ` : ''}
        </div>
      `;
    } catch (err) {
      console.error('[Branches] Detail error:', err);
      body.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--danger);">
          ${escapeHtml(err.message)}
        </div>
      `;
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

  window.closeMemberModal = function () {
    const modal = document.getElementById('memberModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

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
      'المتبقي (يوم)', 'حالة الاشتراك', 'الرعاية الصحية'
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
        st.label,
        m.has_health_care ? 'نعم' : 'لا'
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
    link.download = `branches_${new Date().toISOString().slice(0, 10)}.csv`;
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
        await loadStats();
      },
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function setupListeners() {
    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        currentPage = 1;
        loadMembers();
      });
    }

    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => {
        filters.branch = e.target.value;
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

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    const modal = document.getElementById('memberModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeMemberModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.closeMemberModal();
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

      console.log('[Branches] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

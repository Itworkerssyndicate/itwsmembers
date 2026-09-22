/* =====================================================
   IT SYNDICATE — Social Committee Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;
  const HC_SOON_DAYS = 30;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let members = [];
  let hcMembers = [];
  let currentPage = 1;
  let hcCurrentPage = 1;
  let totalCount = 0;
  let hcTotalCount = 0;
  let branches = [];
  let governorates = [];
  let membershipTypes = [];
  let filters = {
    search: '',
    branch: 'all',
    governorate: 'all',
    hc: 'all'
  };
  let reportData = [];
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

  function getHCStatus(startDate, endDate) {
    const days = getDaysRemaining(endDate);
    if (days === null) return { label: 'غير محدد', cls: 'hc-date-expired', key: 'expired' };
    if (days < 0) return { label: 'منتهية', cls: 'hc-date-expired', key: 'expired' };
    if (days <= HC_SOON_DAYS) return { label: 'تنتهي قريبًا', cls: 'hc-date-soon', key: 'soon' };
    return { label: 'سارية', cls: 'hc-date-active', key: 'active' };
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    health: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
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

      const allowedRoles = [
        'social_committee_head',
        'social_committee_vice',
        'head',
        'vice_president',
        'deputy'
      ];

      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للجنة الاجتماعية فقط');
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
      console.error('[SocialCommittee] Auth error:', err);
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
      console.error('[SocialCommittee] Lookups error:', err);
    }
  }

  /* ============================================
     LOAD STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('members')
        .select('has_health_care, health_care_end')
        .eq('is_active', true);

      if (error || !data) return;

      let hcTotal = 0, hcActive = 0, hcSoon = 0, hcExpired = 0;

      data.forEach(m => {
        if (m.has_health_care) {
          hcTotal++;
          const st = getHCStatus(null, m.health_care_end);
          if (st.key === 'active') hcActive++;
          else if (st.key === 'soon') hcSoon++;
          else hcExpired++;
        }
      });

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      set('statTotal', data.length);
      set('statHC', hcTotal);
      set('statHCActive', hcActive);
      set('statHCSoon', hcSoon);
      set('statHCExpired', hcExpired);

    } catch (e) {
      console.error('[SocialCommittee] Stats error:', e);
    }
  }

  /* ============================================
     LOAD REPORT
     ============================================ */
  async function loadReport() {
    const grid = document.getElementById('reportGrid');
    const totalEl = document.getElementById('reportTotal');
    if (!grid) return;

    try {
      const { data, error } = await client
        .from('members')
        .select('governorate')
        .eq('is_active', true)
        .eq('has_health_care', true);

      if (error || !data) return;

      const counts = {};
      data.forEach(m => {
        const key = m.governorate || 'غير محدد';
        counts[key] = (counts[key] || 0) + 1;
      });

      reportData = Object.entries(counts).map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      if (totalEl) totalEl.textContent = `الإجمالي: ${data.length} عضو`;

      if (!reportData.length) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا توجد بيانات</div>';
        return;
      }

      grid.innerHTML = reportData.map(r => `
        <div class="report-card">
          <div class="report-name">${escapeHtml(r.name)}</div>
          <div class="report-count">${r.count}</div>
        </div>
      `).join('');

    } catch (e) {
      console.error('[SocialCommittee] Report error:', e);
    }
  }

  /* ============================================
     LOAD MEMBERS (ALL)
     ============================================ */
  async function loadMembers() {
    const tbody = document.getElementById('membersTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">
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

      // Governorate
      if (filters.governorate && filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }

      // Branch
      if (filters.branch && filters.branch !== 'all') {
        query = query.eq('branch_id', parseInt(filters.branch));
      }

      // HC filter
      if (filters.hc === 'yes') {
        query = query.eq('has_health_care', true);
      } else if (filters.hc === 'no') {
        query = query.eq('has_health_care', false);
      }

      // Search
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

      members = data || [];
      totalCount = count || 0;

      renderTable();
      renderPagination();

      const countEl = document.getElementById('tableCount');
      if (countEl) countEl.textContent = `${members.length} عضو`;

    } catch (err) {
      console.error('[SocialCommittee] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">
              حدث خطأ: ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ============================================
     RENDER TABLE (ALL)
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!members.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:60px 20px;">
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
      const initials = getInitials(m.full_name);
      const branchName = getBranchName(m.branch_id);
      const hasHC = m.has_health_care === true;
      const hcStatus = hasHC ? getHCStatus(m.health_care_start, m.health_care_end) : null;

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
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(m.phone || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            ${hasHC ? `
              <div style="display:flex;flex-direction:column;gap:4px;">
                <span class="hc-badge">
                  ${ICONS.health}
                  <span>نعم</span>
                </span>
                <span class="hc-dates ${hcStatus.cls}">${escapeHtml(hcStatus.label)}</span>
              </div>
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

    // Row click
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openMemberModal(tr.dataset.id);
      });
      tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(236, 72, 153, 0.04)'; });
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
     LOAD HC MEMBERS
     ============================================ */
  async function loadHCMembers() {
    const tbody = document.getElementById('hcTableBody');
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
      let query = client
        .from('members')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .eq('has_health_care', true);

      query = query.order('health_care_end', { ascending: true });

      const from = (hcCurrentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      hcMembers = data || [];
      hcTotalCount = count || 0;

      renderHCTable();
      renderHCPagination();

      const countEl = document.getElementById('hcTableCount');
      if (countEl) countEl.textContent = `${hcMembers.length} عضو`;

    } catch (err) {
      console.error('[SocialCommittee] HC load error:', err);
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
     RENDER HC TABLE
     ============================================ */
  function renderHCTable() {
    const tbody = document.getElementById('hcTableBody');
    if (!tbody) return;

    if (!hcMembers.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.health}</span>
              <div style="font-size:15px;">لا يوجد أعضاء لهم رعاية صحية</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = hcMembers.map(m => {
      const initials = getInitials(m.full_name);
      const hcStatus = getHCStatus(m.health_care_start, m.health_care_end);
      const amount = parseFloat(m.health_care_amount) || 0;

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
            <span class="gov-badge">${escapeHtml(m.governorate || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="hc-dates">${escapeHtml(formatDate(m.health_care_start))}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="hc-dates ${hcStatus.cls}">${escapeHtml(formatDate(m.health_care_end))}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="amount-cell">${amount.toLocaleString('ar-EG')} ج</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="status-badge" style="background:rgba(236,72,153,0.1);border-color:#ec4899;color:#ec4899;">
              <span class="dot"></span>
              ${escapeHtml(hcStatus.label)}
            </span>
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

    // Row click
    tbody.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-btn')) return;
        openMemberModal(tr.dataset.id);
      });
      tr.addEventListener('mouseenter', () => { tr.style.background = 'rgba(236, 72, 153, 0.04)'; });
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
     PAGINATION (ALL)
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
      background:${active ? 'linear-gradient(135deg, #ec4899, var(--accent))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(236, 72, 153, 0.2)'};
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
     PAGINATION (HC)
     ============================================ */
  function renderHCPagination() {
    const box = document.getElementById('hcPaginationBox');
    if (!box) return;

    const totalPages = Math.ceil(hcTotalCount / PAGE_SIZE);
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
      background:${active ? 'linear-gradient(135deg, #ec4899, var(--accent))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(236, 72, 153, 0.2)'};
      color:${active ? '#000' : (disabled ? 'var(--text-faint)' : 'var(--text-muted)')};
      opacity:${disabled ? 0.4 : 1};
    `;

    let pagesHTML = '';

    pagesHTML += `<button ${hcCurrentPage === 1 ? 'disabled' : ''} data-page="${hcCurrentPage - 1}" style="${btnStyle(false, hcCurrentPage === 1)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronRight}</span>
    </button>`;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, hcCurrentPage - Math.floor(maxVisible / 2));
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
        pagesHTML += `<button data-page="${p}" style="${btnStyle(p === hcCurrentPage, false)}">${p}</button>`;
      }
    });

    pagesHTML += `<button ${hcCurrentPage === totalPages ? 'disabled' : ''} data-page="${hcCurrentPage + 1}" style="${btnStyle(false, hcCurrentPage === totalPages)}">
      <span style="width:14px;height:14px;display:inline-flex;">${ICONS.chevronLeft}</span>
    </button>`;

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
        <div style="font-size:12.5px;color:var(--text-dim);">
          صفحة ${hcCurrentPage} من ${totalPages} — إجمالي ${hcTotalCount} عضو
        </div>
        <div style="display:flex;gap:6px;align-items:center;">${pagesHTML}</div>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== hcCurrentPage) {
          hcCurrentPage = p;
          loadHCMembers();
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

      const branchName = getBranchName(m.branch_id);
      const typeName = getMembershipTypeName(m.membership_type_id);

      body.innerHTML = `
        <div style="animation:fadeUp 0.3s;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border-soft);">
            <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg, rgba(236,72,153,0.15), rgba(var(--accent-rgb),0.15));border:1px solid rgba(236,72,153,0.3);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:20px;color:#ec4899;flex-shrink:0;">
              ${escapeHtml(getInitials(m.full_name))}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-family:'Tajawal',sans-serif;font-size:20px;font-weight:800;color:var(--text);margin-bottom:6px;">
                ${escapeHtml(m.full_name)}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${m.membership_no ? `<span class="mno-badge">${escapeHtml(m.membership_no)}</span>` : ''}
                ${m.has_health_care ? `<span class="hc-badge">${ICONS.health}<span>رعاية صحية</span></span>` : ''}
              </div>
            </div>
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">
            البيانات الشخصية
          </h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('الرقم القومي', m.national_id, true)}
            ${renderDetailItem('الموبايل', m.phone, true)}
            ${renderDetailItem('البريد', m.email || '—')}
            ${renderDetailItem('المحافظة', m.governorate || '—')}
            ${renderDetailItem('العنوان', m.address || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">
            البيانات المهنية
          </h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('نوع العضوية', typeName)}
            ${renderDetailItem('الشعبة', branchName)}
            ${renderDetailItem('المؤهل', m.qualification || '—')}
            ${renderDetailItem('جهة العمل', m.employer || '—')}
          </div>

          <h4 style="font-family:'Tajawal',sans-serif;font-size:14px;font-weight:700;color:var(--text);margin-bottom:12px;">
            بيانات العضوية
          </h4>
          <div class="detail-grid" style="margin-bottom:20px;">
            ${renderDetailItem('بداية العضوية', formatDate(m.membership_start))}
            ${renderDetailItem('نهاية العضوية', formatDate(m.membership_end))}
            ${renderDetailItem('إجمالي المدفوع', (parseFloat(m.total_paid) || 0).toLocaleString('ar-EG') + ' ج', true)}
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
      console.error('[SocialCommittee] Detail error:', err);
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
     EXPORT CSV (ALL)
     ============================================ */
  function exportCSV() {
    if (!members.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم العضوية', 'الاسم', 'الرقم القومي', 'الموبايل',
      'الشعبة', 'المحافظة', 'الرعاية الصحية', 'بداية الرعاية', 'نهاية الرعاية'
    ];

    const rows = members.map(m => [
      m.membership_no || '',
      m.full_name,
      m.national_id,
      m.phone,
      getBranchName(m.branch_id),
      m.governorate || '',
      m.has_health_care ? 'نعم' : 'لا',
      m.has_health_care ? formatDate(m.health_care_start) : '',
      m.has_health_care ? formatDate(m.health_care_end) : ''
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `social_committee_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير البيانات', 'success');
  }

  /* ============================================
     EXPORT CSV (HC)
     ============================================ */
  function exportHC_CSV() {
    if (!hcMembers.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'رقم العضوية', 'الاسم', 'الرقم القومي', 'المحافظة',
      'بداية الرعاية', 'نهاية الرعاية', 'المبلغ', 'الحالة'
    ];

    const rows = hcMembers.map(m => {
      const st = getHCStatus(m.health_care_start, m.health_care_end);
      return [
        m.membership_no || '',
        m.full_name,
        m.national_id,
        m.governorate || '',
        formatDate(m.health_care_start),
        formatDate(m.health_care_end),
        parseFloat(m.health_care_amount) || 0,
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
    link.download = `health_care_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['members', 'health_care_members'],
      async () => {
        await loadMembers();
        await loadHCMembers();
        await loadStats();
        await loadReport();
      },
      { debounceMs: 500, immediate: false }
    );
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function setupListeners() {
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

    // HC filter
    const hcFilter = document.getElementById('hcFilter');
    if (hcFilter) {
      hcFilter.addEventListener('change', (e) => {
        filters.hc = e.target.value;
        currentPage = 1;
        loadMembers();
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
        await loadStats();
        await loadReport();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Refresh HC
    const refreshHCBtn = document.getElementById('refreshHCBtn');
    if (refreshHCBtn) {
      refreshHCBtn.addEventListener('click', async () => {
        refreshHCBtn.disabled = true;
        await loadHCMembers();
        await loadStats();
        refreshHCBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    const exportHCBtn = document.getElementById('exportHCBtn');
    if (exportHCBtn) exportHCBtn.addEventListener('click', exportHC_CSV);

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
          if (window.signOut) window.signOut('login.html');
        }
      });
    }

    // Modal backdrop
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
      await loadHCMembers();
      await loadReport();

      setupRealtime();

      console.log('[SocialCommittee] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =====================================================
   IT SYNDICATE — Subscriptions Management Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 25;
  const SOON_DAYS_DEFAULT = 30;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let allMembers = [];
  let filteredMembers = [];
  let currentTab = 'active';
  let currentPage = 1;
  let branches = [];
  let membershipTypes = [];
  let unsubscribeRealtime = null;
  let currentRenewMember = null;

  let filters = {
    search: '',
    branch: 'all',
    governorate: 'all',
    soonDays: 30
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
    users: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
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
      }

      return true;
    } catch (err) {
      console.error('[Subs] Auth error:', err);
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
  }

  async function loadTypes() {
    const { data } = await client
      .from('membership_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    membershipTypes = data || [];
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
     LOAD MEMBERS + SUBSCRIPTIONS
     ============================================ */
  async function loadMembers() {
    const tbody = document.getElementById('subsTableBody');
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
      // جيب الأعضاء
      let query = client
        .from('members')
        .select('*')
        .eq('is_active', true)
        .order('membership_end', { ascending: true, nullsFirst: false });

      if (filters.branch !== 'all') {
        query = query.eq('branch_id', parseInt(filters.branch));
      }
      if (filters.governorate !== 'all') {
        query = query.eq('governorate', filters.governorate);
      }

      const { data: membersData, error } = await query;

      if (error) throw error;

      // جيب آخر اشتراك لكل عضو
      const memberIds = (membersData || []).map(m => m.id);
      let subsMap = {};

      if (memberIds.length > 0) {
        const { data: subs } = await client
          .from('membership_subscriptions')
          .select('*')
          .in('member_id', memberIds)
          .order('end_date', { ascending: false });

        (subs || []).forEach(s => {
          if (!subsMap[s.member_id]) subsMap[s.member_id] = s;
        });
      }

      // احسب الأيام المتبقية
      const now = new Date();
      allMembers = (membersData || []).map(m => {
        const sub = subsMap[m.id] || null;
        let endDate = null;
        let startDate = null;
        let amount = 0;

        if (sub) {
          endDate = sub.end_date ? new Date(sub.end_date) : null;
          startDate = sub.start_date ? new Date(sub.start_date) : null;
          amount = parseFloat(sub.amount) || 0;
        } else if (m.membership_end) {
          endDate = new Date(m.membership_end);
          startDate = m.membership_start ? new Date(m.membership_start) : null;
        }

        let daysRemaining = null;
        let status = 'expired';

        if (endDate) {
          daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

          if (daysRemaining < 0) status = 'expired';
          else if (daysRemaining <= filters.soonDays) status = 'soon';
          else status = 'active';
        }

        return {
          ...m,
          subscription: sub,
          subStart: startDate,
          subEnd: endDate,
          subAmount: amount,
          daysRemaining,
          status
        };
      });

      applyFilters();
      renderStats();
      renderTabs();
      renderTable();
      renderPagination();

    } catch (err) {
      console.error('[Subs] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center;padding:40px;color:var(--danger);">
              ${escapeHtml(err.message)}
            </td>
          </tr>
        `;
      }
    }
  }

  /* ============================================
     APPLY FILTERS
     ============================================ */
  function applyFilters() {
    let result = allMembers.slice();

    // Search
    if (filters.search) {
      const s = filters.search.toLowerCase().trim();
      result = result.filter(m =>
        (m.full_name || '').toLowerCase().includes(s) ||
        (m.membership_no || '').toLowerCase().includes(s) ||
        (m.phone || '').toLowerCase().includes(s) ||
        (m.national_id || '').toLowerCase().includes(s)
      );
    }

    // Tab filter
    if (currentTab !== 'all') {
      result = result.filter(m => m.status === currentTab);
    }

    filteredMembers = result;
    currentPage = 1;
  }

  /* ============================================
     STATS
     ============================================ */
  function renderStats() {
    const active = allMembers.filter(m => m.status === 'active').length;
    const soon = allMembers.filter(m => m.status === 'soon').length;
    const expired = allMembers.filter(m => m.status === 'expired').length;
    const total = allMembers.length;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatNumber(val);
    };

    setVal('sumActive', active);
    setVal('sumSoon', soon);
    setVal('sumExpired', expired);
    setVal('sumTotal', total);
  }

  /* ============================================
     TABS
     ============================================ */
  function renderTabs() {
    const activeCount = allMembers.filter(m => m.status === 'active').length;
    const soonCount = allMembers.filter(m => m.status === 'soon').length;
    const expiredCount = allMembers.filter(m => m.status === 'expired').length;
    const totalCount = allMembers.length;

    const setCount = (key, val) => {
      const el = document.querySelector(`[data-count="${key}"]`);
      if (el) el.textContent = val;
    };

    setCount('active', activeCount);
    setCount('soon', soonCount);
    setCount('expired', expiredCount);
    setCount('all', totalCount);
  }

  function setupTabs() {
    document.querySelectorAll('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tabBtn;

        document.querySelectorAll('[data-tab-btn]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });

        applyFilters();
        renderTable();
        renderPagination();
      });
    });
  }

  /* ============================================
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('subsTableBody');
    if (!tbody) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredMembers.slice(start, end);

    const countEl = document.getElementById('tableCount');
    if (countEl) {
      countEl.textContent = `${filteredMembers.length} اشتراك`;
    }

    if (!pageData.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.calendar}</span>
              <div style="font-size:15px;">لا توجد اشتراكات في هذه الفئة</div>
              <div style="font-size:13px;">جرب تغيير التاب أو الفلاتر</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pageData.map(m => {
      const initials = window.getInitials ? window.getInitials(m.full_name) : '؟';
      const branchName = getBranchName(m.branch_id);

      // Days
      let daysText = '—';
      let daysClass = 'days-active';

      if (m.daysRemaining !== null && m.daysRemaining !== undefined) {
        if (m.daysRemaining < 0) {
          daysText = `متأخر ${Math.abs(m.daysRemaining)} يوم`;
          daysClass = 'days-expired';
        } else if (m.daysRemaining === 0) {
          daysText = 'ينتهي اليوم';
          daysClass = 'days-soon';
        } else {
          daysText = `${m.daysRemaining} يوم`;
          daysClass = m.daysRemaining <= filters.soonDays ? 'days-soon' : 'days-active';
        }
      }

      // Status badge
      let statusBadge = '';
      if (m.status === 'active') {
        statusBadge = `<span class="status-badge status-active"><span class="dot"></span>نشط</span>`;
      } else if (m.status === 'soon') {
        statusBadge = `<span class="status-badge status-soon"><span class="dot"></span>ينتهي قريبًا</span>`;
      } else {
        statusBadge = `<span class="status-badge status-expired"><span class="dot"></span>منتهي</span>`;
      }

      return `
        <tr data-id="${m.id}" style="border-bottom:1px solid var(--border-soft);">
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
            ${m.membership_no
              ? `<span class="mno-badge">${escapeHtml(m.membership_no)}</span>`
              : `<span style="color:var(--text-dim);font-size:12px;">—</span>`}
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;white-space:nowrap;">
              ${escapeHtml(branchName)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;white-space:nowrap;">
              ${escapeHtml(m.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);direction:ltr;text-align:right;">
            <span dir="ltr">${escapeHtml(m.phone || '—')}</span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
            ${escapeHtml(formatDate(m.subStart))}
          </td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
            ${escapeHtml(formatDate(m.subEnd))}
          </td>
          <td style="padding:14px 12px;">
            <span class="days-cell ${daysClass}">${escapeHtml(daysText)}</span>
          </td>
          <td style="padding:14px 12px;">${statusBadge}</td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn view-btn" data-action="view" data-id="${m.id}" title="عرض التفاصيل">
                ${ICONS.eye}
              </button>
              <button class="row-btn renew-btn" data-action="renew" data-id="${m.id}" title="تجديد">
                ${ICONS.refresh}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind buttons
    tbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'renew') openRenewModal(id);
        else if (action === 'view') {
          window.location.href = `members.html?search=${encodeURIComponent(
            allMembers.find(x => String(x.id) === String(id))?.national_id || ''
          )}`;
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
          صفحة ${currentPage} من ${totalPages} — إجمالي ${filteredMembers.length} اشتراك
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
     RENEW MODAL
     ============================================ */
  function openRenewModal(memberId) {
    const m = allMembers.find(x => String(x.id) === String(memberId));
    if (!m) return;

    currentRenewMember = m;

    const modal = document.getElementById('renewModal');
    if (!modal) return;

    document.getElementById('renewMemberId').value = m.id;
    document.getElementById('renewMemberName').value = m.full_name;
    document.getElementById('renewMonths').value = '12';
    document.getElementById('renewStartDate').value = new Date().toISOString().split('T')[0];

    // Auto-fill amount based on type
    const typeId = m.membership_type_id;
    const type = membershipTypes.find(t => t.id === typeId);
    document.getElementById('renewAmount').value = type?.fee || 0;

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

    const memberId = currentRenewMember.id;
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
      const end = new Date(start);
      end.setMonth(end.getMonth() + months);

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      // 1) حدّث العضو
      const { error: memErr } = await client
        .from('members')
        .update({
          membership_start: startStr,
          membership_end: endStr
        })
        .eq('id', memberId);

      if (memErr) throw memErr;

      // 2) اعمل اشتراك جديد
      const { error: subErr } = await client
        .from('membership_subscriptions')
        .insert([{
          member_id: memberId,
          membership_type_id: currentRenewMember.membership_type_id,
          start_date: startStr,
          end_date: endStr,
          amount: amount,
          status: 'active'
        }]);

      if (subErr) throw subErr;

      // 3) سجّل دفعة
      const { error: payErr } = await client
        .from('payments')
        .insert([{
          member_id: memberId,
          amount: amount,
          payment_method: 'cash',
          governorate: currentRenewMember.governorate,
          status: 'confirmed',
          paid_at: new Date().toISOString(),
          notes: `تجديد اشتراك ${months} شهر`
        }]);

      if (payErr) console.warn('Payment log failed:', payErr);

      // 4) Log user action
      if (window.logUserAction) {
        await window.logUserAction(
          'renew_subscription',
          'member',
          memberId,
          `${currentRenewMember.full_name} - ${months} شهر - ${amount} جنيه`
        );
      }

      showToast('تم التجديد بنجاح', 'success');

      closeRenewModal();
      await loadMembers();

    } catch (err) {
      console.error('[Renew] Error:', err);
      showToast('فشل التجديد: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check}<span>تجديد</span>`;
      }
    }
  }

  /* ============================================
     BULK RENEW
     ============================================ */
  async function bulkRenew() {
    const expired = allMembers.filter(m => m.status === 'expired');

    if (!expired.length) {
      showToast('لا توجد اشتراكات منتهية للتجديد', 'info');
      return;
    }

    const confirmMsg = `سيتم تجديد ${expired.length} اشتراك منتهي.\n\nهل أنت متأكد؟`;
    if (!confirm(confirmMsg)) return;

    const months = 12;
    let success = 0;
    let failed = 0;

    showToast(`جاري التجديد... (0/${expired.length})`, 'info');

    for (const m of expired) {
      try {
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + months);

        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        await client
          .from('members')
          .update({
            membership_start: startStr,
            membership_end: endStr
          })
          .eq('id', m.id);

        const type = membershipTypes.find(t => t.id === m.membership_type_id);

        await client
          .from('membership_subscriptions')
          .insert([{
            member_id: m.id,
            membership_type_id: m.membership_type_id,
            start_date: startStr,
            end_date: endStr,
            amount: type?.fee || 0,
            status: 'active'
          }]);

        success++;
      } catch (err) {
        console.error('Bulk renew failed for', m.full_name, err);
        failed++;
      }
    }

    showToast(`تم تجديد ${success} اشتراك — فشل ${failed}`, success > 0 ? 'success' : 'error');

    await loadMembers();
  }

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
      'الشعبة', 'المحافظة', 'نوع العضوية',
      'بداية الاشتراك', 'نهاية الاشتراك', 'المتبقي', 'الحالة'
    ];

    const rows = filteredMembers.map(m => [
      m.membership_no || '',
      m.full_name || '',
      m.national_id || '',
      m.phone || '',
      getBranchName(m.branch_id),
      m.governorate || '',
      getTypeName(m.membership_type_id),
      formatDate(m.subStart),
      formatDate(m.subEnd),
      m.daysRemaining !== null ? m.daysRemaining : '',
      m.status === 'active' ? 'نشط' :
      m.status === 'soon' ? 'ينتهي قريبًا' : 'منتهي'
    ]);

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
        applyFilters();
        renderTable();
        renderPagination();
      }, 350) : () => {};

      searchInput.addEventListener('input', debounced);
    }

    const branchFilter = document.getElementById('branchFilter');
    if (branchFilter) {
      branchFilter.addEventListener('change', (e) => {
        filters.branch = e.target.value;
        loadMembers();
      });
    }

    const govFilter = document.getElementById('govFilter');
    if (govFilter) {
      govFilter.addEventListener('change', (e) => {
        filters.governorate = e.target.value;
        loadMembers();
      });
    }

    const daysFilter = document.getElementById('daysFilter');
    if (daysFilter) {
      daysFilter.addEventListener('change', (e) => {
        filters.soonDays = parseInt(e.target.value) || 30;
        loadMembers();
      });
    }

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

    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const bulkRenewBtn = document.getElementById('bulkRenewBtn');
    if (bulkRenewBtn) bulkRenewBtn.addEventListener('click', bulkRenew);

    const confirmRenewBtn = document.getElementById('confirmRenewBtn');
    if (confirmRenewBtn) confirmRenewBtn.addEventListener('click', confirmRenew);

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
     MODAL BACKDROP
     ============================================ */
  function setupModalBackdrops() {
    const modal = document.getElementById('renewModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeRenewModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.closeRenewModal();
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

      setupTabs();
      setupFilters();
      setupModalBackdrops();

      await loadMembers();

      setupRealtime();

      console.log('[Subs] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

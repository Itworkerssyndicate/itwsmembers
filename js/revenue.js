/* =====================================================
   IT SYNDICATE — REVENUE LOGIC
   Version: 3.0.0
   =====================================================
   يحتوي على:
   - Auth + Role check
   - جلب الإيرادات (payments)
   - جلب المصروفات (expenses)
   - حساب الإجمالي + الصافي
   - تقرير المحافظات + تصنيفات المصروفات
   - جداول مفصلة (Payments + Expenses)
   - إضافة مصروف جديد
   - فلترة بالتاريخ + طريقة الدفع + الحالة
   - تصدير CSV + طباعة
   - Realtime
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 30;
  const ATTACHMENTS_BUCKET = 'attachments';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;

  let payments = [];
  let expenses = [];
  let members = [];
  let governorates = [];
  let expenseCategories = [];
  let membershipTypes = [];

  let dateFrom = null;
  let dateTo = null;
  let paymentMethodFilter = 'all';
  let paymentStatusFilter = 'all';
  let quickRange = 'all';

  let paymentsPage = 1;
  let expensesPage = 1;

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

  function formatDateFull(dateStr) {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch (e) { return '---'; }
  }

  function formatMoney(amount, withCurrency = true) {
    if (amount === null || amount === undefined || amount === '') return withCurrency ? '0 ج' : '0';
    const num = parseFloat(amount);
    if (isNaN(num)) return withCurrency ? '0 ج' : '0';
    const formatted = num.toLocaleString('ar-EG', { maximumFractionDigits: 2 });
    return withCurrency ? formatted + ' ج' : formatted;
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

  function getMemberName(memberId) {
    if (!memberId) return '—';
    const m = members.find(x => String(x.id) === String(memberId));
    return m?.full_name || '—';
  }

  function getMembershipNo(memberId) {
    if (!memberId) return '—';
    const m = members.find(x => String(x.id) === String(memberId));
    return m?.membership_no || '—';
  }

  function getCategoryName(catId) {
    if (!catId) return 'غير محدد';
    const c = expenseCategories.find(x => String(x.id) === String(catId));
    return c?.name || 'غير محدد';
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    revenue: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    expense: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
    net: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    card: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    trending: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    map: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    tag: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>',
    eye: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    download: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    print: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
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

      // Revenue is only for head/deputy/vp
      const allowedRoles = ['head', 'vice_president', 'deputy'];
      if (!allowedRoles.includes(userRole)) {
        alert('هذه الصفحة مخصصة للنقيب العام والوكيل فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';
      }

      return true;
    } catch (err) {
      console.error('[Revenue] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD LOOKUPS
     ============================================ */
  async function loadLookups() {
    try {
      const [membersRes, govRes, catRes, typesRes] = await Promise.all([
        client.from('members').select('id, full_name, membership_no').eq('is_active', true),
        client.from('governorates').select('*').order('sort_order', { ascending: true }),
        client.from('expense_categories').select('*').order('sort_order', { ascending: true }),
        client.from('membership_types').select('*').order('sort_order', { ascending: true })
      ]);

      members = membersRes.data || [];
      governorates = govRes.data || [];
      expenseCategories = catRes.data || [];
      membershipTypes = typesRes.data || [];

      // Fill category select in expense modal
      const catSelect = document.getElementById('expCategory');
      if (catSelect) {
        catSelect.innerHTML = '<option value="">-- اختر التصنيف --</option>';
        expenseCategories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          catSelect.appendChild(opt);
        });
      }

      // Fill member select in expense modal
      const memberSelect = document.getElementById('expMember');
      if (memberSelect) {
        memberSelect.innerHTML = '<option value="">-- لا يوجد --</option>';
        members.slice(0, 200).forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = `${m.full_name}${m.membership_no ? ' — ' + m.membership_no : ''}`;
          memberSelect.appendChild(opt);
        });
      }

      // Fill governorate select in expense modal
      const govSelect = document.getElementById('expGov');
      if (govSelect) {
        govSelect.innerHTML = '<option value="">-- لا يوجد --</option>';
        governorates.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          govSelect.appendChild(opt);
        });
      }

    } catch (err) {
      console.error('[Revenue] Lookups error:', err);
    }
  }

  /* ============================================
     DATE FILTERS
     ============================================ */
  function getDateRange() {
    let from = dateFrom;
    let to = dateTo;

    if (quickRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      from = today.toISOString();
      to = new Date().toISOString();
    } else if (quickRange === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString();
      to = new Date().toISOString();
    } else if (quickRange === 'month') {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      from = d.toISOString();
      to = new Date().toISOString();
    } else if (quickRange === 'quarter') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      from = d.toISOString();
      to = new Date().toISOString();
    } else if (quickRange === 'year') {
      const d = new Date();
      d.setMonth(0);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      from = d.toISOString();
      to = new Date().toISOString();
    }

    return { from, to };
  }

  /* ============================================
     LOAD PAYMENTS
     ============================================ */
  async function loadPayments() {
    const tbody = document.getElementById('paymentsTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    }

    try {
      const { from, to } = getDateRange();

      let query = client
        .from('payments')
        .select('*, members(full_name, membership_no, governorate, national_id)', { count: 'exact' });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      if (paymentMethodFilter && paymentMethodFilter !== 'all') {
        query = query.eq('payment_method', paymentMethodFilter);
      }

      if (paymentStatusFilter && paymentStatusFilter !== 'all') {
        query = query.eq('status', paymentStatusFilter);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      payments = data || [];

      renderPaymentsTable();
      updateTotals();

    } catch (err) {
      console.error('[Revenue] Payments error:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  /* ============================================
     RENDER PAYMENTS TABLE
     ============================================ */
  function renderPaymentsTable() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (!payments.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:60px;color:var(--text-dim);">لا توجد مدفوعات</td></tr>`;
      const countEl = document.getElementById('paymentsCount');
      if (countEl) countEl.textContent = '0';
      return;
    }

    const start = (paymentsPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pagePayments = payments.slice(start, end);

    tbody.innerHTML = pagePayments.map(p => {
      const member = p.members || {};
      const initials = getInitials(member.full_name);
      const status = p.status === 'confirmed'
        ? { label: 'مؤكد', cls: 'status-confirmed' }
        : p.status === 'pending'
        ? { label: 'معلق', cls: 'status-pending' }
        : { label: 'مرفوض', cls: 'status-rejected' };

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);">${escapeHtml(formatDate(p.created_at))}</td>
          <td style="padding:14px 12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-2-rgb),0.15));border:1px solid rgba(var(--accent-rgb),0.25);display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:10.5px;color:var(--accent);flex-shrink:0;">
                ${escapeHtml(initials)}
              </div>
              <div style="min-width:0;line-height:1.25;">
                <div style="font-weight:700;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">
                  ${escapeHtml(member.full_name || '—')}
                </div>
              </div>
            </div>
          </td>
          <td style="padding:14px 12px;">
            ${member.membership_no ? `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--success);font-weight:700;">${escapeHtml(member.membership_no)}</span>` : '—'}
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:100px;font-size:11.5px;color:#22c55e;font-weight:600;white-space:nowrap;">
              ${escapeHtml(member.governorate || '—')}
            </span>
          </td>
          <td style="padding:14px 12px;">
            <span class="method-badge">${escapeHtml(p.payment_method || '—')}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="amount-cell">${formatMoney(p.amount)}</span>
          </td>
          <td style="padding:14px 12px;">
            <span class="status-badge ${status.cls}">
              <span class="dot"></span>
              ${status.label}
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const countEl = document.getElementById('paymentsCount');
    if (countEl) countEl.textContent = `${payments.length} عملية`;

    // Pagination for payments
    renderPaymentsPagination();
  }

  function renderPaymentsPagination() {
    const box = document.getElementById('paymentsPagination');
    if (!box) return;

    const totalPages = Math.ceil(payments.length / PAGE_SIZE);
    if (totalPages <= 1) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML = `
      <div style="display:flex;justify-content:center;gap:6px;">
        <button data-page="${paymentsPage - 1}" ${paymentsPage === 1 ? 'disabled' : ''} style="padding:8px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:inherit;font-weight:600;cursor:${paymentsPage === 1 ? 'not-allowed' : 'pointer'};">
          السابق
        </button>
        <span style="padding:8px 14px;color:var(--text-dim);font-size:13px;">
          صفحة ${paymentsPage} من ${totalPages}
        </span>
        <button data-page="${paymentsPage + 1}" ${paymentsPage === totalPages ? 'disabled' : ''} style="padding:8px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:inherit;font-weight:600;cursor:${paymentsPage === totalPages ? 'not-allowed' : 'pointer'};">
          التالي
        </button>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== paymentsPage) {
          paymentsPage = p;
          renderPaymentsTable();
        }
      });
    });
  }

  /* ============================================
     LOAD EXPENSES
     ============================================ */
  async function loadExpenses() {
    const tbody = document.getElementById('expensesTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-dim);">جاري التحميل...</td></tr>`;
    }

    try {
      const { from, to } = getDateRange();

      let query = client
        .from('expenses')
        .select('*, expense_categories(name), members(full_name), governorates(name)', { count: 'exact' });

      if (from) query = query.gte('created_at', from);
      if (to) query = query.lte('created_at', to);

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      expenses = data || [];

      renderExpensesTable();
      updateExpensesStats();

    } catch (err) {
      console.error('[Revenue] Expenses error:', err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">${escapeHtml(err.message)}</td></tr>`;
      }
    }
  }

  function renderExpensesTable() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    if (!expenses.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:60px;color:var(--text-dim);">لا توجد مصروفات</td></tr>`;
      const countEl = document.getElementById('expensesTableCount');
      if (countEl) countEl.textContent = '0';
      return;
    }

    const start = (expensesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageExpenses = expenses.slice(start, end);

    tbody.innerHTML = pageExpenses.map(e => {
      const catName = e.expense_categories?.name || 'غير محدد';
      const memberName = e.members?.full_name || '—';
      const govName = e.governorates?.name || '—';

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);">${escapeHtml(formatDate(e.created_at))}</td>
          <td style="padding:14px 12px;font-size:13px;color:var(--text);">${escapeHtml(e.description || '—')}</td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--danger-rgb),0.06);border:1px solid rgba(var(--danger-rgb),0.2);border-radius:100px;font-size:11.5px;color:var(--danger);font-weight:600;white-space:nowrap;">
              ${escapeHtml(catName)}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">${escapeHtml(memberName)}</td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">${escapeHtml(govName)}</td>
          <td style="padding:14px 12px;">
            <span class="amount-cell expense">${formatMoney(e.amount)}</span>
          </td>
        </tr>
      `;
    }).join('');

    const countEl = document.getElementById('expensesTableCount');
    if (countEl) countEl.textContent = `${expenses.length} مصروف`;

    renderExpensesPagination();
  }

  function renderExpensesPagination() {
    const box = document.getElementById('expensesPagination');
    if (!box) return;

    const totalPages = Math.ceil(expenses.length / PAGE_SIZE);
    if (totalPages <= 1) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML = `
      <div style="display:flex;justify-content:center;gap:6px;">
        <button data-page="${expensesPage - 1}" ${expensesPage === 1 ? 'disabled' : ''} style="padding:8px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:inherit;font-weight:600;cursor:${expensesPage === 1 ? 'not-allowed' : 'pointer'};">
          السابق
        </button>
        <span style="padding:8px 14px;color:var(--text-dim);font-size:13px;">
          صفحة ${expensesPage} من ${totalPages}
        </span>
        <button data-page="${expensesPage + 1}" ${expensesPage === totalPages ? 'disabled' : ''} style="padding:8px 14px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-family:inherit;font-weight:600;cursor:${expensesPage === totalPages ? 'not-allowed' : 'pointer'};">
          التالي
        </button>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== expensesPage) {
          expensesPage = p;
          renderExpensesTable();
        }
      });
    });
  }

  /* ============================================
     UPDATE TOTALS
     ============================================ */
  function updateTotals() {
    const totalRevenue = payments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const net = totalRevenue - totalExpenses;

    // Update UI
    const revEl = document.getElementById('totalRevenue');
    if (revEl) revEl.innerHTML = `${formatMoney(totalRevenue, false)} <small>جنيه</small>`;

    const revSubEl = document.getElementById('totalRevenueSub');
    if (revSubEl) revSubEl.textContent = `${payments.filter(p => p.status === 'confirmed').length} دفعة مؤكدة`;

    const expEl = document.getElementById('totalExpenses');
    if (expEl) expEl.innerHTML = `${formatMoney(totalExpenses, false)} <small>جنيه</small>`;

    const expSubEl = document.getElementById('totalExpensesSub');
    if (expSubEl) expSubEl.textContent = `${expenses.length} مصروف`;

    const netEl = document.getElementById('totalNet');
    if (netEl) netEl.innerHTML = `${formatMoney(Math.abs(net), false)} <small>جنيه</small>`;

    const netSubEl = document.getElementById('totalNetSub');
    if (netSubEl) netSubEl.textContent = net >= 0 ? 'ربح' : 'خسارة';

    const netCard = document.getElementById('netCard');
    if (netCard) {
      netCard.classList.toggle('negative', net < 0);
    }

    // Quick stats
    const statCount = document.getElementById('statPaymentsCount');
    if (statCount) statCount.textContent = payments.length;

    const confirmedPayments = payments.filter(p => p.status === 'confirmed');
    const avgPayment = confirmedPayments.length
      ? totalRevenue / confirmedPayments.length
      : 0;

    const statAvg = document.getElementById('statAvgPayment');
    if (statAvg) statAvg.textContent = formatMoney(avgPayment, false);

    // Today revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRevenue = payments
      .filter(p => p.status === 'confirmed' && new Date(p.created_at) >= today)
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const statToday = document.getElementById('statTodayRevenue');
    if (statToday) statToday.textContent = formatMoney(todayRevenue, false);

    const statExpCount = document.getElementById('statExpensesCount');
    if (statExpCount) statExpCount.textContent = expenses.length;

    // Gov count
    const govSet = new Set();
    payments.forEach(p => {
      const gov = p.members?.governorate;
      if (gov) govSet.add(gov);
    });

    const statGovs = document.getElementById('statGovernorates');
    if (statGovs) statGovs.textContent = govSet.size;

    // Build reports
    buildGovReport();
    buildCatReport();
  }

  function updateExpensesStats() {
    const totalExpenses = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalEl = document.getElementById('expensesTotal');
    if (totalEl) totalEl.textContent = formatMoney(totalExpenses, false);

    const countEl = document.getElementById('expensesCount');
    if (countEl) countEl.textContent = expenses.length;

    const avg = expenses.length ? totalExpenses / expenses.length : 0;
    const avgEl = document.getElementById('expensesAvg');
    if (avgEl) avgEl.textContent = formatMoney(avg, false);

    updateTotals();
  }

  /* ============================================
     GOVERNORATE REPORT
     ============================================ */
  function buildGovReport() {
    const grid = document.getElementById('govGrid');
    const countEl = document.getElementById('govCount');
    if (!grid) return;

    const govMap = {};

    payments
      .filter(p => p.status === 'confirmed')
      .forEach(p => {
        const gov = p.members?.governorate || 'غير محدد';
        if (!govMap[gov]) govMap[gov] = { count: 0, total: 0 };
        govMap[gov].count++;
        govMap[gov].total += parseFloat(p.amount) || 0;
      });

    const list = Object.entries(govMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا توجد بيانات</div>';
      if (countEl) countEl.textContent = '0';
      return;
    }

    grid.innerHTML = list.map(r => `
      <div class="gov-card">
        <div class="gov-name">${escapeHtml(r.name)}</div>
        <div class="gov-stats">
          <span class="gov-count">${r.count} دفعة</span>
          <span class="gov-amount">${formatMoney(r.total, false)} ج</span>
        </div>
      </div>
    `).join('');

    if (countEl) countEl.textContent = `${list.length} محافظة`;
  }

  /* ============================================
     CATEGORY REPORT
     ============================================ */
  function buildCatReport() {
    const grid = document.getElementById('catGrid');
    const countEl = document.getElementById('catCount');
    if (!grid) return;

    const catMap = {};

    expenses.forEach(e => {
      const cat = e.expense_categories?.name || 'غير محدد';
      if (!catMap[cat]) catMap[cat] = { count: 0, total: 0 };
      catMap[cat].count++;
      catMap[cat].total += parseFloat(e.amount) || 0;
    });

    const list = Object.entries(catMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">لا توجد بيانات</div>';
      if (countEl) countEl.textContent = '0';
      return;
    }

    grid.innerHTML = list.map(r => `
      <div class="cat-card">
        <div class="cat-name">${escapeHtml(r.name)}</div>
        <div class="cat-stats">
          <span class="cat-count">${r.count} مصروف</span>
          <span class="cat-amount">${formatMoney(r.total, false)} ج</span>
        </div>
      </div>
    `).join('');

    if (countEl) countEl.textContent = `${list.length} تصنيف`;
  }

  /* ============================================
     ADD EXPENSE
     ============================================ */
  window.openExpenseModal = function () {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;

    document.getElementById('expDescription').value = '';
    document.getElementById('expAmount').value = '';
    document.getElementById('expCategory').value = '';
    document.getElementById('expMember').value = '';
    document.getElementById('expGov').value = '';
    document.getElementById('expDate').value = new Date().toISOString().slice(0, 10);
    document.getElementById('expNotes').value = '';

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.closeExpenseModal = function () {
    const modal = document.getElementById('expenseModal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  async function saveExpense() {
    const description = document.getElementById('expDescription').value.trim();
    const amount = parseFloat(document.getElementById('expAmount').value);
    const categoryId = document.getElementById('expCategory').value;
    const memberId = document.getElementById('expMember').value;
    const govId = document.getElementById('expGov').value;
    const date = document.getElementById('expDate').value;
    const notes = document.getElementById('expNotes').value.trim();

    if (!description) {
      showToast('الوصف مطلوب', 'warning');
      return;
    }
    if (!amount || amount <= 0) {
      showToast('المبلغ يجب أن يكون أكبر من صفر', 'warning');
      return;
    }

    const btn = document.getElementById('saveExpenseBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جاري الحفظ...</span><span class="spinner"></span>';
    }

    try {
      const payload = {
        description,
        amount,
        category_id: categoryId ? parseInt(categoryId) : null,
        member_id: memberId || null,
        governorate_id: govId ? parseInt(govId) : null,
        expense_date: date || new Date().toISOString().slice(0, 10),
        notes: notes || null,
        created_by: currentUser.id
      };

      const { error } = await client.from('expenses').insert([payload]);
      if (error) throw error;

      showToast('تم إضافة المصروف بنجاح', 'success');
      closeExpenseModal();

      await loadExpenses();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('expense-added', {});
      }

    } catch (err) {
      console.error('[Revenue] Save expense error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.check || ''}<span>حفظ</span>`;
      }
    }
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportPaymentsCSV() {
    if (!payments.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = ['التاريخ', 'العضو', 'رقم العضوية', 'المحافظة', 'طريقة الدفع', 'المبلغ', 'الحالة'];

    const rows = payments.map(p => [
      formatDate(p.created_at),
      p.members?.full_name || '—',
      p.members?.membership_no || '—',
      p.members?.governorate || '—',
      p.payment_method || '—',
      p.amount || 0,
      p.status || '—'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير المدفوعات', 'success');
  }

  function exportExpensesCSV() {
    if (!expenses.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = ['التاريخ', 'الوصف', 'التصنيف', 'العضو', 'المحافظة', 'المبلغ'];

    const rows = expenses.map(e => [
      formatDate(e.created_at),
      e.description || '',
      e.expense_categories?.name || '—',
      e.members?.full_name || '—',
      e.governorates?.name || '—',
      e.amount || 0
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('تم تصدير المصروفات', 'success');
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['payments', 'expenses', 'members'],
      async () => {
        await loadPayments();
        await loadExpenses();
      },
      { debounceMs: 800, immediate: false }
    );
  }

  /* ============================================
     SETUP LISTENERS
     ============================================ */
  function setupListeners() {
    // Date filters
    const fromInput = document.getElementById('dateFrom');
    if (fromInput) {
      fromInput.addEventListener('change', (e) => {
        dateFrom = e.target.value ? new Date(e.target.value).toISOString() : null;
        quickRange = null;
        loadPayments();
        loadExpenses();
      });
    }

    const toInput = document.getElementById('dateTo');
    if (toInput) {
      toInput.addEventListener('change', (e) => {
        dateTo = e.target.value ? new Date(e.target.value).toISOString() : null;
        quickRange = null;
        loadPayments();
        loadExpenses();
      });
    }

    // Payment method filter
    const pmFilter = document.getElementById('paymentMethodFilter');
    if (pmFilter) {
      pmFilter.addEventListener('change', (e) => {
        paymentMethodFilter = e.target.value;
        loadPayments();
      });
    }

    // Status filter
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        paymentStatusFilter = e.target.value;
        loadPayments();
      });
    }

    // Quick date buttons
    document.querySelectorAll('[data-range]').forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.dataset.range;
        quickRange = range;
        dateFrom = null;
        dateTo = null;

        document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        loadPayments();
        loadExpenses();
      });
    });

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadPayments();
        await loadExpenses();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Export buttons
    const exportBtn = document.getElementById('exportCsvBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportPaymentsCSV);

    const exportExpBtn = document.getElementById('exportExpensesCsvBtn');
    if (exportExpBtn) exportExpBtn.addEventListener('click', exportExpensesCSV);

    // Print
    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // Add expense
    const addExpBtn = document.getElementById('addExpenseBtn');
    if (addExpBtn) addExpBtn.addEventListener('click', () => window.openExpenseModal());

    const saveExpBtn = document.getElementById('saveExpenseBtn');
    if (saveExpBtn) saveExpBtn.addEventListener('click', saveExpense);

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
    const modal = document.getElementById('expenseModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeExpenseModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') window.closeExpenseModal();
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

      await loadPayments();
      await loadExpenses();

      setupRealtime();

      console.log('[Revenue] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

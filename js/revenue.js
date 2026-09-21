/* =====================================================
   IT SYNDICATE — Revenue Reports Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let payments = [];
  let filteredPayments = [];
  let currentRange = 'all';

  let filters = {
    dateFrom: '',
    dateTo: '',
    paymentMethod: 'all',
    status: 'all'
  };

  let unsubscribeRealtime = null;

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

  function formatDateTime(dateStr) {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
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
     LOAD PAYMENTS
     ============================================ */
  async function loadPayments() {
    const tbody = document.getElementById('paymentsTableBody');
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
        .from('payments')
        .select('*, members:member_id(full_name, membership_no, governorate, national_id, phone), applications:application_id(full_name, tracking_no, governorate)');

      // Date filter
      if (filters.dateFrom) {
        query = query.gte('paid_at', filters.dateFrom + 'T00:00:00');
      }
      if (filters.dateTo) {
        query = query.lte('paid_at', filters.dateTo + 'T23:59:59');
      }

      // Method
      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }

      // Status
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      query = query.order('paid_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      payments = data || [];
      filteredPayments = payments;

      renderStats();
      renderPaymentsTable();
      renderGovernorateReport();

    } catch (err) {
      console.error('[Revenue] Load error:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center;padding:40px;color:var(--danger);">
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
    const total = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const count = filteredPayments.length;
    const avg = count > 0 ? total / count : 0;

    // Today's revenue
    const today = new Date().toISOString().split('T')[0];
    const todayTotal = filteredPayments
      .filter(p => p.paid_at && p.paid_at.startsWith(today))
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    // Governorates count
    const govs = new Set();
    filteredPayments.forEach(p => {
      const gov = p.members?.governorate || p.applications?.governorate;
      if (gov) govs.add(gov);
    });

    // Update total card
    const totalEl = document.getElementById('totalRevenue');
    if (totalEl) {
      totalEl.innerHTML = `${formatNumber(total)} <small>جنيه</small>`;
    }

    const totalSub = document.getElementById('totalSub');
    if (totalSub) {
      if (currentRange === 'all') {
        totalSub.textContent = `إجمالي ${count} دفعة — كل الفترات`;
      } else {
        const from = filters.dateFrom ? formatDate(filters.dateFrom) : '—';
        const to = filters.dateTo ? formatDate(filters.dateTo) : '—';
        totalSub.textContent = `${count} دفعة من ${from} إلى ${to}`;
      }
    }

    // Quick stats
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal('statPaymentsCount', formatNumber(count));
    setVal('statAvgPayment', formatNumber(Math.round(avg)));
    setVal('statTodayRevenue', formatNumber(todayTotal));
    setVal('statGovernorates', govs.size);

    // Update payments count
    const paymentsCountEl = document.getElementById('paymentsCount');
    if (paymentsCountEl) paymentsCountEl.textContent = `${count} دفعة`;
  }

  /* ============================================
     PAYMENTS TABLE
     ============================================ */
  function renderPaymentsTable() {
    const tbody = document.getElementById('paymentsTableBody');
    if (!tbody) return;

    if (!filteredPayments.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.file}</span>
              <div style="font-size:15px;">لا توجد مدفوعات مطابقة</div>
              <div style="font-size:13px;">جرب تغيير الفترة الزمنية أو الفلاتر</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const methodLabels = {
      cash: 'نقدي',
      bank: 'تحويل بنكي',
      instapay: 'إنستاباي',
      wallet: 'محفظة إلكترونية',
      fawry: 'فوري',
      card: 'بطاقة بنكية'
    };

    tbody.innerHTML = filteredPayments.map(p => {
      const memberName = p.members?.full_name || p.applications?.full_name || '—';
      const memberNo = p.members?.membership_no || '';
      const governorate = p.members?.governorate || p.applications?.governorate || p.governorate || '—';
      const method = methodLabels[p.payment_method] || p.payment_method || '—';
      const amount = parseFloat(p.amount) || 0;

      let statusBadge = '';
      if (p.status === 'confirmed') {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(var(--success-rgb),0.1);border:1px solid var(--success);border-radius:100px;font-size:11.5px;color:var(--success);font-weight:700;"><span style="width:6px;height:6px;border-radius:50%;background:var(--success);"></span>مؤكد</span>`;
      } else if (p.status === 'pending') {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(var(--warning-rgb),0.1);border:1px solid var(--warning);border-radius:100px;font-size:11.5px;color:var(--warning);font-weight:700;"><span style="width:6px;height:6px;border-radius:50%;background:var(--warning);"></span>معلق</span>`;
      } else {
        statusBadge = `<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(var(--danger-rgb),0.1);border:1px solid var(--danger);border-radius:100px;font-size:11.5px;color:var(--danger);font-weight:700;"><span style="width:6px;height:6px;border-radius:50%;background:var(--danger);"></span>${escapeHtml(p.status)}</span>`;
      }

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
            ${escapeHtml(formatDateTime(p.paid_at))}
          </td>
          <td style="padding:14px 12px;">
            <div style="font-weight:700;font-size:13.5px;color:var(--text);">${escapeHtml(memberName)}</div>
          </td>
          <td style="padding:14px 12px;">
            ${memberNo
              ? `<span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);font-weight:700;">${escapeHtml(memberNo)}</span>`
              : `<span style="color:var(--text-dim);font-size:12px;">—</span>`}
          </td>
          <td style="padding:14px 12px;">
            <span style="display:inline-block;padding:4px 10px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.18);border-radius:100px;font-size:11.5px;color:var(--text-muted);font-weight:600;">
              ${escapeHtml(governorate)}
            </span>
          </td>
          <td style="padding:14px 12px;font-size:12.5px;color:var(--text-muted);">
            ${escapeHtml(method)}
          </td>
          <td style="padding:14px 12px;">
            <span class="amount-cell">${formatNumber(amount)} ج</span>
          </td>
          <td style="padding:14px 12px;">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  /* ============================================
     GOVERNORATE REPORT
     ============================================ */
  function renderGovernorateReport() {
    const grid = document.getElementById('govGrid');
    const countEl = document.getElementById('govCount');
    if (!grid) return;

    if (!filteredPayments.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-dim);">
          لا توجد بيانات
        </div>
      `;
      if (countEl) countEl.textContent = '—';
      return;
    }

    // Group by governorate
    const govMap = {};
    filteredPayments.forEach(p => {
      const gov = p.members?.governorate || p.applications?.governorate || p.governorate || 'غير محدد';
      if (!govMap[gov]) {
        govMap[gov] = { count: 0, total: 0 };
      }
      govMap[gov].count += 1;
      govMap[gov].total += parseFloat(p.amount) || 0;
    });

    const govArray = Object.entries(govMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    if (countEl) countEl.textContent = `${govArray.length} محافظة`;

    grid.innerHTML = govArray.map(g => `
      <div class="gov-card">
        <div class="gov-name">${escapeHtml(g.name)}</div>
        <div class="gov-stats">
          <div class="gov-count">${g.count} دفعة</div>
          <div class="gov-amount">${formatNumber(g.total)} ج</div>
        </div>
      </div>
    `).join('');
  }

  /* ============================================
     DATE RANGES
     ============================================ */
  function applyDateRange(range) {
    currentRange = range;

    // Update active button
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.range === range);
    });

    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let from = '';
    let to = todayStr;

    switch (range) {
      case 'today':
        from = todayStr;
        to = todayStr;
        break;

      case 'week':
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        from = weekAgo.toISOString().split('T')[0];
        break;

      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        from = monthStart.toISOString().split('T')[0];
        break;

      case 'quarter':
        const quarterAgo = new Date();
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        from = quarterAgo.toISOString().split('T')[0];
        break;

      case 'year':
        const yearStart = new Date(today.getFullYear(), 0, 1);
        from = yearStart.toISOString().split('T')[0];
        break;

      case 'all':
      default:
        from = '';
        to = '';
        break;
    }

    if (dateFrom) dateFrom.value = from;
    if (dateTo) dateTo.value = to;

    filters.dateFrom = from;
    filters.dateTo = to;

    loadPayments();
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!filteredPayments.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'التاريخ', 'العضو', 'رقم العضوية', 'المحافظة',
      'طريقة الدفع', 'المبلغ', 'الحالة'
    ];

    const methodLabels = {
      cash: 'نقدي',
      bank: 'تحويل بنكي',
      instapay: 'إنستاباي',
      wallet: 'محفظة إلكترونية',
      fawry: 'فوري',
      card: 'بطاقة بنكية'
    };

    const statusLabels = {
      confirmed: 'مؤكد',
      pending: 'معلق',
      rejected: 'مرفوض',
      refunded: 'مسترد'
    };

    const rows = filteredPayments.map(p => {
      const memberName = p.members?.full_name || p.applications?.full_name || '';
      const memberNo = p.members?.membership_no || '';
      const governorate = p.members?.governorate || p.applications?.governorate || p.governorate || '';

      return [
        formatDateTime(p.paid_at),
        memberName,
        memberNo,
        governorate,
        methodLabels[p.payment_method] || p.payment_method || '',
        parseFloat(p.amount) || 0,
        statusLabels[p.status] || p.status || ''
      ];
    });

    // Add totals row
    const totalAmount = filteredPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    rows.push(['', '', '', '', 'الإجمالي', totalAmount, '']);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `revenue_${new Date().toISOString().slice(0, 10)}.csv`;
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
      ['payments', 'members'],
      async () => {
        await loadPayments();
      },
      { debounceMs: 600, immediate: false }
    );
  }

  /* ============================================
     FILTERS
     ============================================ */
  function setupFilters() {
    // Date inputs
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');

    if (dateFrom) {
      dateFrom.addEventListener('change', (e) => {
        filters.dateFrom = e.target.value;
        currentRange = 'custom';
        document.querySelectorAll('.quick-date-btn').forEach(btn => btn.classList.remove('active'));
        loadPayments();
      });
    }

    if (dateTo) {
      dateTo.addEventListener('change', (e) => {
        filters.dateTo = e.target.value;
        currentRange = 'custom';
        document.querySelectorAll('.quick-date-btn').forEach(btn => btn.classList.remove('active'));
        loadPayments();
      });
    }

    // Payment method
    const methodFilter = document.getElementById('paymentMethodFilter');
    if (methodFilter) {
      methodFilter.addEventListener('change', (e) => {
        filters.paymentMethod = e.target.value;
        loadPayments();
      });
    }

    // Status
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        filters.status = e.target.value;
        loadPayments();
      });
    }

    // Quick date buttons
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyDateRange(btn.dataset.range);
      });
    });

    // Actions
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadPayments();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

    const printBtn = document.getElementById('printBtn');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

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

      setupFilters();

      await loadPayments();

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

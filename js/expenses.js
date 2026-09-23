/* =====================================================
   IT SYNDICATE — Expenses Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const PAGE_SIZE = 20;

  const CATEGORY_COLORS = {
    'RENT':       { color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)' },
    'SALARIES':   { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' },
    'MAINTENANCE':{ color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)' },
    'UTILITIES':  { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
    'SUPPLIES':   { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
    'EVENTS':     { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)' },
    'TRANSPORT':  { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' },
    'MARKETING':  { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)' },
    'TRAINING':   { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
    'HEALTH':     { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    'OTHER':      { color: '#888888', bg: 'rgba(136, 136, 136, 0.12)' }
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentUser = null;
  let userRole = null;
  let expenses = [];
  let categories = [];
  let members = [];
  let governorates = [];
  let currentPage = 1;
  let totalCount = 0;
  let filters = {
    search: '',
    category: 'all',
    dateFrom: null,
    dateTo: null
  };
  let unsubscribeRealtime = null;
  let currentExpenseId = null;

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

  function formatMoney(amount, withCurrency = true) {
    if (amount === null || amount === undefined || amount === '') {
      return withCurrency ? '0 ج' : '0';
    }
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

  function getCategoryName(catId) {
    if (!catId) return 'غير محدد';
    const c = categories.find(x => String(x.id) === String(catId));
    return c?.name || 'غير محدد';
  }

  function getCategoryCode(catId) {
    if (!catId) return 'OTHER';
    const c = categories.find(x => String(x.id) === String(catId));
    return c?.code || 'OTHER';
  }

  function getCategoryColor(catId) {
    const code = getCategoryCode(catId);
    return CATEGORY_COLORS[code] || CATEGORY_COLORS['OTHER'];
  }

  function getMemberName(memberId) {
    if (!memberId) return '—';
    const m = members.find(x => String(x.id) === String(memberId));
    return m?.full_name || '—';
  }

  function getGovName(govId) {
    if (!govId) return '—';
    const g = governorates.find(x => String(x.id) === String(govId));
    return g?.name || '—';
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    trash: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="9 18 15 12 9 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>'
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
        alert('هذه الصفحة مخصصة للنقيب العام واللجنة المالية فقط');
        window.location.href = 'dashboard.html';
        return false;
      }

      if (userRole === 'head') {
        const adminLink = document.getElementById('adminLink');
        if (adminLink) adminLink.style.display = 'flex';
      }

      document.querySelectorAll('[data-user-name]').forEach(el => {
        el.textContent = window.currentUserName;
      });

      return true;
    } catch (err) {
      console.error('[Expenses] Auth error:', err);
      window.location.href = 'login.html';
      return false;
    }
  }

  /* ============================================
     LOAD LOOKUPS
     ============================================ */
  async function loadLookups() {
    try {
      const [catRes, memRes, govRes] = await Promise.all([
        client.from('expense_categories').select('*').order('sort_order', { ascending: true }),
        client.from('members').select('id, full_name, membership_no').eq('is_active', true).limit(500),
        client.from('governorates').select('*').eq('is_active', true).order('sort_order', { ascending: true })
      ]);

      categories = catRes.data || [];
      members = memRes.data || [];
      governorates = govRes.data || [];

      // Fill category filter
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="all">كل التصنيفات</option>';
        categories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          categoryFilter.appendChild(opt);
        });
      }

      // Fill category select in modal
      const expCat = document.getElementById('expCategory');
      if (expCat) {
        expCat.innerHTML = '<option value="">-- اختر التصنيف --</option>';
        categories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          expCat.appendChild(opt);
        });
      }

      // Fill member select in modal
      const expMember = document.getElementById('expMember');
      if (expMember) {
        expMember.innerHTML = '<option value="">-- لا يوجد --</option>';
        members.slice(0, 200).forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = `${m.full_name}${m.membership_no ? ' — ' + m.membership_no : ''}`;
          expMember.appendChild(opt);
        });
      }

      // Fill governorate select in modal
      const expGov = document.getElementById('expGov');
      if (expGov) {
        expGov.innerHTML = '<option value="">-- لا يوجد --</option>';
        governorates.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          expGov.appendChild(opt);
        });
      }

    } catch (err) {
      console.error('[Expenses] Lookups error:', err);
    }
  }

  /* ============================================
     LOAD STATS
     ============================================ */
  async function loadStats() {
    try {
      const { data, error } = await client
        .from('expenses')
        .select('amount, category_id');

      if (error || !data) return;

      const total = data.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const count = data.length;
      const avg = count > 0 ? total / count : 0;

      const catSet = new Set();
      data.forEach(e => {
        if (e.category_id) catSet.add(e.category_id);
      });

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };

      set('statTotalExpenses', formatMoney(total, false));
      set('statCount', count);
      set('statAvg', formatMoney(avg, false));
      set('statCategories', catSet.size);

    } catch (e) {
      console.error('[Expenses] Stats error:', e);
    }
  }

  /* ============================================
     LOAD EXPENSES
     ============================================ */
  async function loadExpenses() {
    const tbody = document.getElementById('expensesTableBody');
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
        .from('expenses')
        .select('*, expense_categories(name, code), members(full_name), governorates(name)', { count: 'exact' });

      if (filters.category && filters.category !== 'all') {
        query = query.eq('category_id', parseInt(filters.category));
      }

      if (filters.dateFrom) {
        query = query.gte('expense_date', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('expense_date', filters.dateTo);
      }

      if (filters.search) {
        const s = filters.search.trim();
        query = query.ilike('description', `%${s}%`);
      }

      query = query.order('expense_date', { ascending: false });

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      expenses = data || [];
      totalCount = count || 0;

      renderTable();
      renderPagination();

      const countEl = document.getElementById('tableCount');
      if (countEl) countEl.textContent = `${totalCount} مصروف`;

    } catch (err) {
      console.error('[Expenses] Load error:', err);
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
     RENDER TABLE
     ============================================ */
  function renderTable() {
    const tbody = document.getElementById('expensesTableBody');
    if (!tbody) return;

    if (!expenses.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center;padding:60px 20px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-dim);">
              <span style="width:48px;height:48px;display:inline-flex;">${ICONS.inbox}</span>
              <div style="font-size:15px;">لا توجد مصروفات</div>
              <div style="font-size:13px;">اضغط "إضافة مصروف" لتسجيل أول مصروف</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = expenses.map(e => {
      const categoryName = e.expense_categories?.name || 'غير محدد';
      const categoryCode = e.expense_categories?.code || 'OTHER';
      const catColor = CATEGORY_COLORS[categoryCode] || CATEGORY_COLORS['OTHER'];
      const memberName = e.members?.full_name || null;
      const govName = e.governorates?.name || null;
      const initials = memberName ? getInitials(memberName) : null;

      return `
        <tr style="border-bottom:1px solid var(--border-soft);">
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;">
            ${escapeHtml(formatDate(e.expense_date || e.created_at))}
          </td>
          <td style="padding:14px 12px;font-size:13px;color:var(--text);font-weight:600;">
            ${escapeHtml(e.description || '—')}
          </td>
          <td style="padding:14px 12px;">
            <span class="category-badge" style="background:${catColor.bg};border-color:${catColor.color};color:${catColor.color};">
              ${escapeHtml(categoryName)}
            </span>
          </td>
          <td style="padding:14px 12px;">
            ${memberName ? `
              <div class="member-cell">
                <div class="member-avatar">${escapeHtml(initials)}</div>
                <div class="member-info">
                  <div class="member-name">${escapeHtml(memberName)}</div>
                </div>
              </div>
            ` : `
              <span style="font-size:12px;color:var(--text-dim);">—</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            ${govName ? `
              <span style="display:inline-block;padding:4px 10px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:100px;font-size:11.5px;color:#22c55e;font-weight:600;white-space:nowrap;">
                ${escapeHtml(govName)}
              </span>
            ` : `
              <span style="font-size:12px;color:var(--text-dim);">—</span>
            `}
          </td>
          <td style="padding:14px 12px;">
            <span class="amount-cell">${escapeHtml(formatMoney(e.amount))}</span>
          </td>
          <td style="padding:14px 12px;font-size:12px;color:var(--text-muted);">
            ${escapeHtml(e.created_by_name || '—')}
          </td>
          <td style="padding:14px 12px;">
            <div class="row-actions">
              <button class="row-btn delete-btn" data-action="delete" data-id="${e.id}" title="حذف">
                ${ICONS.trash}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind delete
    tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
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
      background:${active ? 'linear-gradient(135deg, var(--danger), var(--warning))' : 'rgba(255,255,255,0.04)'};
      border:1px solid ${active ? 'transparent' : 'rgba(var(--danger-rgb), 0.2)'};
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
          صفحة ${currentPage} من ${totalPages} — إجمالي ${totalCount} مصروف
        </div>
        <div style="display:flex;gap:6px;align-items:center;">${pagesHTML}</div>
      </div>
    `;

    box.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page);
        if (p >= 1 && p <= totalPages && p !== currentPage) {
          currentPage = p;
          loadExpenses();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  }

  /* ============================================
     OPEN EXPENSE MODAL
     ============================================ */
  window.openExpenseModal = function () {
    const modal = document.getElementById('expenseModal');
    if (!modal) return;

    currentExpenseId = null;

    document.getElementById('expenseModalTitle').textContent = 'إضافة مصروف جديد';
    document.getElementById('expenseId').value = '';
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
    currentExpenseId = null;
  };

  /* ============================================
     SAVE EXPENSE
     ============================================ */
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
        description: description,
        amount: amount,
        category_id: categoryId ? parseInt(categoryId) : null,
        member_id: memberId || null,
        governorate_id: govId ? parseInt(govId) : null,
        expense_date: date || new Date().toISOString().slice(0, 10),
        notes: notes || null,
        created_by: currentUser.id,
        created_by_name: window.currentUserName
      };

      if (currentExpenseId) {
        const { error } = await client
          .from('expenses')
          .update(payload)
          .eq('id', currentExpenseId);
        if (error) throw error;
        showToast('تم تحديث المصروف', 'success');
      } else {
        const { error } = await client.from('expenses').insert([payload]);
        if (error) throw error;
        showToast('تم إضافة المصروف بنجاح', 'success');
      }

      // Log audit
      try {
        await client.from('audit_log').insert([{
          user_id: currentUser.id,
          user_email: currentUser.email,
          action: currentExpenseId ? 'update' : 'create',
          entity: 'expenses',
          entity_id: currentExpenseId || null,
          new_value: JSON.stringify(payload),
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      closeExpenseModal();

      await loadExpenses();
      await loadStats();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('expense-added', {});
      }

    } catch (err) {
      console.error('[Expenses] Save error:', err);
      showToast('فشل: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = ICONS.check + '<span>حفظ</span>';
      }
    }
  }

  /* ============================================
     DELETE EXPENSE
     ============================================ */
  async function deleteExpense(expenseId) {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;

    try {
      const { error } = await client
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      // Log audit
      try {
        await client.from('audit_log').insert([{
          user_id: currentUser.id,
          user_email: currentUser.email,
          action: 'delete',
          entity: 'expenses',
          entity_id: String(expenseId),
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      showToast('تم حذف المصروف', 'success');

      await loadExpenses();
      await loadStats();

      if (window.Realtime) {
        window.Realtime.sendBroadcast('expense-deleted', {});
      }

    } catch (err) {
      console.error('[Expenses] Delete error:', err);
      showToast('فشل الحذف: ' + err.message, 'error');
    }
  }

  /* ============================================
     EXPORT CSV
     ============================================ */
  function exportCSV() {
    if (!expenses.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const headers = [
      'التاريخ', 'الوصف', 'التصنيف', 'العضو', 'المحافظة', 'المبلغ', 'أضيف بواسطة', 'ملاحظات'
    ];

    const rows = expenses.map(e => [
      formatDate(e.expense_date || e.created_at),
      e.description || '',
      e.expense_categories?.name || 'غير محدد',
      e.members?.full_name || '—',
      e.governorates?.name || '—',
      e.amount || 0,
      e.created_by_name || '—',
      e.notes || ''
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

    showToast('تم تصدير البيانات', 'success');
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (!window.Realtime) return;

    unsubscribeRealtime = window.Realtime.watchManyAndReload(
      ['expenses', 'expense_categories'],
      async () => {
        await loadExpenses();
        await loadStats();
      },
      { debounceMs: 600, immediate: false }
    );
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function setupListeners() {
    // Add expense
    const addBtn = document.getElementById('addExpenseBtn');
    if (addBtn) addBtn.addEventListener('click', () => window.openExpenseModal());

    // Save expense
    const saveBtn = document.getElementById('saveExpenseBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveExpense);

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        filters.category = e.target.value;
        currentPage = 1;
        loadExpenses();
      });
    }

    // Date from
    const dateFrom = document.getElementById('dateFrom');
    if (dateFrom) {
      dateFrom.addEventListener('change', (e) => {
        filters.dateFrom = e.target.value || null;
        currentPage = 1;
        loadExpenses();
      });
    }

    // Date to
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
      dateTo.addEventListener('change', (e) => {
        filters.dateTo = e.target.value || null;
        currentPage = 1;
        loadExpenses();
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
          loadExpenses();
        }, 400);
      });
    }

    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await loadExpenses();
        await loadStats();
        refreshBtn.disabled = false;
        showToast('تم التحديث', 'success', 1500);
      });
    }

    // Export
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

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

      await loadStats();
      await loadExpenses();

      setupRealtime();

      console.log('[Expenses] Ready. Role:', userRole);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* =====================================================
   IT SYNDICATE — TRACK LOGIC
   Version: 3.0.0
   Path: js/track.js
   =====================================================
   يحتوي على:
   - بحث مزدوج (رقم تتبع / رقم قومي)
   - Render كامل للطلب + Timeline
   - 11 مرحلة (pending → delivered)
   - رفع الأوراق الناقصة
   - QR Code
   - Progress Bar
   - Recent Trackings (آخر 5)
   - Realtime sync
   - تحميل كصورة + طباعة
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const LAST_TRACKING_KEY = 'its_last_tracking';
  const RECENT_TRACKINGS_KEY = 'its_recent_trackings';
  const MAX_RECENT = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];

  /* ============================================
     STATUS MAP
     ============================================ */
  const STATUS_MAP = {
    'pending':                  { label: 'بانتظار الفحص',           step: 1, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800', active: true },
    'ai_review':                { label: 'تم الفحص التلقائي',        step: 2, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff', active: false },
    'under_review':             { label: 'تحت المراجعة البشرية',     step: 3, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff', active: true },
    'needs_docs':               { label: 'مطلوب مستندات ناقصة',      step: 3, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800', active: true },
    'approved':                 { label: 'مقبول مبدئيًا',            step: 4, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d', active: false },
    'rejected':                 { label: 'مرفوض',                   step: 0, color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)',   border: '#ff5555', active: false },
    'awaiting_payment':         { label: 'بانتظار الدفع',            step: 5, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800', active: true },
    'payment_under_review':     { label: 'دفع تحت المراجعة',         step: 5, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff', active: true },
    'paid':                     { label: 'تم الدفع',                 step: 6, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',   border: '#00ff9d', active: false },
    'awaiting_membership_no':   { label: 'بانتظار رقم العضوية',      step: 7, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)',   border: '#ffb800', active: true },
    'membership_no_assigned':   { label: 'تم تسجيل رقم العضوية',     step: 8, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff', active: false },
    'card_processing':          { label: 'جاري تجهيز الكارنية',      step: 9, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',    border: '#00f0ff', active: true },
    'card_ready':               { label: 'الكارنية جاهز',           step: 10, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',  border: '#00ff9d', active: false },
    'delivered':                { label: 'تم الاستلام',              step: 11, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)',  border: '#00ff9d', active: false },
    'cancelled':                { label: 'ملغي',                    step: 0, color: '#888',    bg: 'rgba(136, 136, 136, 0.12)', border: '#888',    active: false }
  };

  /* ============================================
     STAGES
     ============================================ */
  const STAGES = [
    { key: 'pending',                title: 'تم استلام الطلب',          desc: 'تم تسجيل طلبك في النظام' },
    { key: 'ai_review',              title: 'الفحص التلقائي',            desc: 'تم فحص المستندات آلياً' },
    { key: 'under_review',           title: 'المراجعة البشرية',          desc: 'الطلب الآن عند لجنة العضوية' },
    { key: 'approved',               title: 'الاعتماد المبدئي',          desc: 'تم قبول طلبك مبدئياً' },
    { key: 'awaiting_payment',       title: 'بانتظار الدفع',             desc: 'يرجى سداد رسوم العضوية' },
    { key: 'paid',                   title: 'تم الدفع',                  desc: 'تم تأكيد عملية الدفع' },
    { key: 'awaiting_membership_no', title: 'بانتظار رقم العضوية',        desc: 'يتم إصدار رقم العضوية' },
    { key: 'membership_no_assigned', title: 'تم إصدار رقم العضوية',       desc: 'رقمك أصبح نشطاً' },
    { key: 'card_processing',        title: 'جاري تجهيز الكارنية',        desc: 'يتم طباعة الكارنية الرسمي' },
    { key: 'card_ready',             title: 'الكارنية جاهز',             desc: 'بانتظار الاستلام' },
    { key: 'delivered',              title: 'تم الاستلام',                desc: 'تم تسليم الكارنية بنجاح' }
  ];

  /* ============================================
     DOC LABELS
     ============================================ */
  const DOC_LABELS = {
    id_front: 'بطاقة الرقم القومي (وجه)',
    id_back: 'بطاقة الرقم القومي (ظهر)',
    certificate: 'الشهادة الدراسية',
    photo: 'الصورة الشخصية',
    work_certificate: 'شهادة إثبات عمل',
    criminal_record: 'فيش وتشبيه'
  };

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentApplication = null;
  let currentHistory = [];
  let currentAttachments = [];
  let unsubscribeWatcher = null;

  /* ============================================
     HELPERS
     ============================================ */
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
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return '---'; }
  }

  function getStatusInfo(status) {
    return STATUS_MAP[status] || {
      label: status || 'غير معروف',
      step: 0,
      color: '#888',
      bg: 'rgba(136, 136, 136, 0.12)',
      border: '#888',
      active: false
    };
  }

  function setAlert(containerId, type, message) {
    const box = document.getElementById(containerId);
    if (!box) return;

    const colors = {
      success: { bg: 'rgba(var(--success-rgb), 0.12)', border: 'var(--success)', text: 'var(--success)', icon: ICONS.check },
      error:   { bg: 'rgba(var(--danger-rgb), 0.12)',  border: 'var(--danger)',  text: 'var(--danger)',  icon: ICONS.x },
      warning: { bg: 'rgba(var(--warning-rgb), 0.12)', border: 'var(--warning)', text: 'var(--warning)', icon: ICONS.alert },
      info:    { bg: 'rgba(var(--accent-rgb), 0.1)',   border: 'var(--accent)',  text: 'var(--accent)',  icon: ICONS.info }
    };
    const c = colors[type] || colors.info;

    box.innerHTML = `
      <div style="
        background:${c.bg};
        border:1.5px solid ${c.border};
        color:${c.text};
        padding:14px 18px;
        border-radius:12px;
        font-size:14px;
        font-weight:600;
        display:flex;
        align-items:center;
        gap:10px;
        margin-bottom:16px;
      ">
        <span style="width:20px;height:20px;display:inline-flex;flex-shrink:0;">${c.icon}</span>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    search: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    alert: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    copy: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    user: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    phone: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
    upload: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    file: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    download: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    print: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    card: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
  };

  /* ============================================
     RECENT TRACKINGS
     ============================================ */
  function getRecentTrackings() {
    try {
      const raw = localStorage.getItem(RECENT_TRACKINGS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function addRecentTracking(item) {
    if (!item || !item.tracking_no) return;
    try {
      const list = getRecentTrackings().filter(i => i.tracking_no !== item.tracking_no);
      list.unshift({
        tracking_no: item.tracking_no,
        full_name: item.full_name,
        status: item.status,
        updated_at: new Date().toISOString()
      });
      localStorage.setItem(RECENT_TRACKINGS_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
      localStorage.setItem(LAST_TRACKING_KEY, item.tracking_no);
    } catch (e) {}
  }

  function renderRecentTrackings() {
    const container = document.getElementById('recentBox');
    if (!container) return;

    const list = getRecentTrackings();
    if (list.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="padding:16px 18px;background:rgba(var(--accent-rgb),0.04);border:1px solid rgba(var(--accent-rgb),0.15);border-radius:14px;margin-top:20px;">
        <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;font-weight:600;">آخر عمليات البحث</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${list.map(item => `
            <button type="button" class="recent-chip" data-tracking="${escapeHtml(item.tracking_no)}">
              ${escapeHtml(item.tracking_no)}
            </button>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.recent-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('trackingInput');
        const natInput = document.getElementById('nationalIdInput');
        if (input) input.value = btn.dataset.tracking;
        if (natInput) natInput.value = '';
        search();
      });
    });
  }

  /* ============================================
     LOAD ATTACHMENTS
     ============================================ */
  async function loadAttachments(applicationId) {
    const { data, error } = await client
      .from('attachments')
      .select('*')
      .eq('application_id', applicationId);

    if (error) {
      console.warn('Load attachments failed:', error);
      return [];
    }
    return data || [];
  }

  /* ============================================
     SEARCH
     ============================================ */
  async function search() {
    if (!client) {
      setAlert('resultBox', 'error', 'جاري تحميل النظام، حاول مرة أخرى');
      return;
    }

    const trackingInput = document.getElementById('trackingInput');
    const nationalInput = document.getElementById('nationalIdInput');
    const tracking = (trackingInput?.value || '').trim();
    const nationalId = (nationalInput?.value || '').trim();

    if (!tracking && !nationalId) {
      setAlert('resultBox', 'warning', 'من فضلك أدخل رقم التتبع أو الرقم القومي');
      return;
    }

    if (nationalId && !/^\d{14}$/.test(nationalId)) {
      setAlert('resultBox', 'error', 'الرقم القومي يجب أن يكون 14 رقم');
      return;
    }

    const btn = document.getElementById('searchBtn');
    const originalHtml = btn?.innerHTML || '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>جاري البحث</span><span class="spinner"></span>`;
    }

    try {
      let query = client.from('applications').select('*');
      if (tracking) {
        query = query.eq('tracking_no', tracking);
      } else {
        query = query.eq('national_id', nationalId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error('خطأ في البحث: ' + error.message);

      if (!data) {
        setAlert('resultBox', 'warning', 'لم يتم العثور على طلب بهذه البيانات');
        return;
      }

      currentApplication = data;

      const [historyRes, attachmentsRes] = await Promise.all([
        client.from('status_history').select('*').eq('application_id', data.id).order('created_at', { ascending: true }),
        loadAttachments(data.id)
      ]);

      currentHistory = historyRes.data || [];
      currentAttachments = attachmentsRes || [];

      renderResult(data, currentHistory, currentAttachments);

      addRecentTracking(data);
      renderRecentTrackings();

      setupRealtimeWatch(data.id);

    } catch (err) {
      console.error('[Track] Error:', err);
      setAlert('resultBox', 'error', err.message || 'حدث خطأ غير متوقع');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  }

  /* ============================================
     RENDER RESULT
     ============================================ */
  function renderResult(app, history, attachments) {
    const box = document.getElementById('resultBox');
    if (!box) return;

    const status = getStatusInfo(app.status);
    const currentStep = status.step;
    const isRejected = app.status === 'rejected' || app.status === 'cancelled';
    const needsDocs = app.status === 'needs_docs';

    // Timeline
    const timelineHTML = STAGES.map((stage, idx) => {
      const stageNum = idx + 1;
      let state = 'pending';

      if (isRejected) {
        if (stageNum < currentStep) state = 'done';
        else state = 'skipped';
      } else {
        if (stageNum < currentStep) state = 'done';
        else if (stageNum === currentStep) state = 'current';
        else state = 'pending';
      }

      const histItem = history.find(h => h.new_status === stage.key);
      const date = histItem?.created_at;
      const notes = histItem?.notes;
      const changedByName = histItem?.changed_by_name;

      const titleColor = state === 'done' ? 'var(--success)'
                       : state === 'current' ? 'var(--warning)'
                       : state === 'skipped' ? 'rgba(var(--danger-rgb),0.7)'
                       : 'var(--text)';

      return `
        <div class="timeline-row ${state}">
          <div class="timeline-dot">
            ${state === 'done' ? `<span style="width:12px;height:12px;color:#000;">${ICONS.check}</span>` : ''}
          </div>
          <div class="timeline-row-title" style="color:${titleColor};">
            <span>${escapeHtml(stage.title)}</span>
            ${state === 'current' ? `<span class="now-badge">جاري الآن</span>` : ''}
          </div>
          <div class="timeline-row-desc">${escapeHtml(stage.desc)}</div>
          ${date ? `
            <div class="timeline-row-date">
              <span style="width:12px;height:12px;display:inline-flex;">${ICONS.clock}</span>
              <span>${escapeHtml(formatDate(date))}</span>
            </div>
          ` : ''}
          ${notes ? `
            <div class="timeline-notes">
              ${escapeHtml(notes)}
              ${changedByName ? `<span class="timeline-notes-by">— ${escapeHtml(changedByName)}</span>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Missing docs banner
    const missingDocsHTML = (needsDocs && app.missing_docs && app.missing_docs.length > 0) ? `
      <div class="missing-docs-banner">
        <div class="missing-docs-title">
          ${ICONS.alert}
          <span>مطلوب منك رفع المستندات التالية:</span>
        </div>
        <div class="missing-docs-list">
          ${app.missing_docs.map(docKey => {
            const label = DOC_LABELS[docKey] || docKey;
            const alreadyUploaded = attachments.some(a => a.doc_type === docKey && a.uploaded_at > app.docs_requested_at);
            return `
              <div class="missing-doc-item" data-doc="${escapeHtml(docKey)}">
                <div class="missing-doc-name">
                  ${ICONS.file}
                  <span>${escapeHtml(label)}</span>
                </div>
                <div>
                  <input type="file" class="missing-doc-input" data-doc="${escapeHtml(docKey)}" accept="image/*,application/pdf" />
                  <button type="button" class="upload-missing-btn" data-doc="${escapeHtml(docKey)}" ${alreadyUploaded ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    ${ICONS.upload}
                    <span>${alreadyUploaded ? 'تم الرفع' : 'ارفع الآن'}</span>
                  </button>
                  <span class="missing-doc-status ${alreadyUploaded ? 'show' : ''}">تم الرفع</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    // Payment section
    const paymentHTML = app.status === 'awaiting_payment' ? `
      <div class="payment-section">
        <div class="payment-title">
          ${ICONS.card}
          <span>الفاتورة والدفع</span>
        </div>
        <div class="invoice-table">
          <div class="invoice-row">
            <span class="label">رسوم العضوية</span>
            <span class="value">${(parseFloat(app.membership_fee) || 0).toLocaleString('ar-EG')} جنيه</span>
          </div>
          ${app.wants_health_care ? `
            <div class="invoice-row">
              <span class="label">الرعاية الصحية</span>
              <span class="value">${(parseFloat(app.health_care_amount) || 0).toLocaleString('ar-EG')} جنيه</span>
            </div>
          ` : ''}
          <div class="invoice-row total">
            <span class="label">الإجمالي</span>
            <span class="value">${(parseFloat(app.total_amount) || 0).toLocaleString('ar-EG')} جنيه</span>
          </div>
        </div>
        <div class="payment-methods">
          <div class="payment-method-card">
            <div class="pm-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div class="pm-title">تحويل بنكي</div>
            <div class="pm-desc">حوّل المبلغ على حساب النقابة</div>
          </div>
          <div class="payment-method-card">
            <div class="pm-icon">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div class="pm-title">دفع كاش</div>
            <div class="pm-desc">في فرع النقابة الرئيسي</div>
          </div>
        </div>
        <div class="info-banner">
          ${ICONS.info}
          <div>بعد الدفع، ارفع صورة الإيصال هنا ليتم تأكيده.</div>
        </div>
        <label class="upload-receipt-box" id="uploadReceiptBox">
          <input type="file" id="receiptFileInput" accept="image/*,application/pdf" />
          <div class="up-icon">
            ${ICONS.upload}
          </div>
          <div class="up-text">ارفع صورة إيصال الدفع</div>
          <div class="up-hint">JPG / PNG / PDF</div>
          <div class="filename" id="receiptFilename"></div>
        </label>
      </div>
    ` : '';

    // Card section
    const cardHTML = (app.status === 'card_ready' || app.status === 'delivered') && app.card_image_url ? `
      <div class="card-section">
        <div class="card-title">
          ${ICONS.card}
          <span>الكارنية الرسمي</span>
        </div>
        <div class="card-image-wrap">
          <img src="${escapeHtml(app.card_image_url)}" alt="الكارنية" />
        </div>
        <div class="card-actions">
          <a href="${escapeHtml(app.card_image_url)}" download="card.jpg" class="btn btn-primary">
            ${ICONS.download}
            <span>تحميل</span>
          </a>
          <a href="${escapeHtml(app.card_image_url)}" target="_blank" class="btn btn-outline">
            <span>عرض بحجم كامل</span>
          </a>
        </div>
      </div>
    ` : '';

    // Rejection notice
    const rejectionNotice = isRejected ? `
      <div class="rejection-notice">
        ${ICONS.alert}
        <span>${app.reviewer_notes ? escapeHtml(app.reviewer_notes) : 'تم رفض الطلب. للاستفسار تواصل مع اللجنة.'}</span>
      </div>
    ` : '';

    // QR
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(app.tracking_no)}`;

    // Progress
    const totalSteps = STAGES.length;
    const progressPct = isRejected ? 100 : Math.round((currentStep / totalSteps) * 100);

    box.innerHTML = `
      <div class="result-wrap">

        ${missingDocsHTML}

        <div class="result-header">
          <div class="result-header-inner">
            <div class="result-info">
              <div class="result-label">رقم التتبع</div>
              <div class="result-tracking">
                <span>${escapeHtml(app.tracking_no)}</span>
                <button type="button" class="copy-btn-sm" id="copyTrackingBtn" title="نسخ">
                  ${ICONS.copy}
                </button>
              </div>
              <div class="status-pill ${status.active ? 'active' : ''}" style="background:${status.bg};border-color:${status.border};color:${status.color};">
                <span class="status-dot"></span>
                <span>${escapeHtml(status.label)}</span>
              </div>
            </div>
            <div class="qr-box">
              <img src="${qrUrl}" alt="QR" />
            </div>
          </div>

          ${!isRejected ? `
            <div class="progress-wrap">
              <div class="progress-info">
                <span>التقدم</span>
                <span>${progressPct}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${progressPct}%"></div>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="details-grid">
          ${renderDetailCard(ICONS.user, 'الاسم', app.full_name)}
          ${renderDetailCard(ICONS.calendar, 'تاريخ التقديم', formatDate(app.created_at))}
          ${renderDetailCard(ICONS.phone, 'الموبايل', app.phone)}
          ${renderDetailCard(ICONS.info, 'المحافظة', app.governorate || '—')}
        </div>

        ${paymentHTML}

        ${cardHTML}

        <div class="timeline-card">
          <div class="timeline-title">
            ${ICONS.clock}
            <span>مراحل الطلب</span>
          </div>
          <div class="timeline-track">
            ${timelineHTML}
          </div>
          ${rejectionNotice}
        </div>

        <div class="result-actions">
          <button type="button" class="btn btn-outline" id="refreshTrackBtn">
            ${ICONS.refresh}
            <span>تحديث</span>
          </button>
          <button type="button" class="btn btn-outline" id="downloadReceiptBtn">
            ${ICONS.download}
            <span>تحميل كصورة</span>
          </button>
          <button type="button" class="btn btn-primary" id="printTrackBtn">
            ${ICONS.print}
            <span>طباعة</span>
          </button>
        </div>
      </div>
    `;

    // Bind actions
    document.getElementById('copyTrackingBtn')?.addEventListener('click', () => {
      copyTracking(app.tracking_no);
    });

    document.getElementById('refreshTrackBtn')?.addEventListener('click', () => {
      refreshTracking();
    });

    document.getElementById('printTrackBtn')?.addEventListener('click', () => {
      window.print();
    });

    document.getElementById('downloadReceiptBtn')?.addEventListener('click', () => {
      downloadTrackAsImage(app.tracking_no);
    });

    // Missing docs uploads
    document.querySelectorAll('.upload-missing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const docKey = btn.dataset.doc;
        const input = document.querySelector(`.missing-doc-input[data-doc="${docKey}"]`);
        if (input) input.click();
      });
    });

    document.querySelectorAll('.missing-doc-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const docKey = input.dataset.doc;
        await uploadMissingDoc(docKey, file);
      });
    });

    // Receipt upload
    setupReceiptUpload();
  }

  function renderDetailCard(icon, label, value) {
    return `
      <div class="detail-card">
        <div class="detail-card-icon">${icon}</div>
        <div class="detail-card-content">
          <div class="detail-card-label">${escapeHtml(label)}</div>
          <div class="detail-card-value">${escapeHtml(value || '—')}</div>
        </div>
      </div>
    `;
  }

  /* ============================================
     UPLOAD MISSING DOC
     ============================================ */
  async function uploadMissingDoc(docKey, file) {
    if (!currentApplication) return;

    const applicationId = currentApplication.id;
    const btn = document.querySelector(`.upload-missing-btn[data-doc="${docKey}"]`);
    const statusEl = btn?.closest('.missing-doc-item')?.querySelector('.missing-doc-status');

    if (file.size > MAX_FILE_SIZE) {
      if (window.showTrackToast) window.showTrackToast('حجم الملف كبير — الحد الأقصى 10 ميجا', 'error');
      return;
    }

    const allowed = docKey === 'photo' || docKey === 'id_front' || docKey === 'id_back'
      ? ALLOWED_IMAGE_TYPES
      : ALLOWED_DOC_TYPES;

    if (!allowed.includes(file.type)) {
      if (window.showTrackToast) window.showTrackToast('صيغة غير مدعومة', 'error');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="upload-spinner"></span><span>جاري الرفع...</span>`;
    }

    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${applicationId}/${docKey}_${Date.now()}.${ext}`;

      const { error: upErr } = await client.storage
        .from('attachments')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type
        });

      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await client.from('attachments').insert([{
        application_id: applicationId,
        file_path: path,
        file_type: file.type,
        file_size: file.size,
        doc_type: docKey,
        is_required: true,
        ai_verified: false
      }]);

      if (insErr) throw new Error(insErr.message);

      const newMissingDocs = (currentApplication.missing_docs || []).filter(d => d !== docKey);

      const updateData = {
        missing_docs: newMissingDocs.length > 0 ? newMissingDocs : null,
        docs_submitted_at: new Date().toISOString()
      };

      if (newMissingDocs.length === 0) {
        updateData.status = 'under_review';
        updateData.reviewer_notes = 'تم استلام المستندات الناقصة — الطلب الآن تحت المراجعة';
      }

      const { error: updErr } = await client
        .from('applications')
        .update(updateData)
        .eq('id', applicationId);

      if (updErr) throw new Error(updErr.message);

      if (statusEl) statusEl.classList.add('show');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.innerHTML = `${ICONS.check}<span>تم الرفع</span>`;
      }

      if (window.showTrackToast) {
        window.showTrackToast('تم رفع المستند بنجاح', 'success');
      }

      setTimeout(() => refreshTracking(), 1500);

    } catch (err) {
      console.error('[Upload Missing] Error:', err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${ICONS.upload}<span>ارفع الآن</span>`;
      }
      if (window.showTrackToast) {
        window.showTrackToast('فشل الرفع: ' + err.message, 'error');
      }
    }
  }

  /* ============================================
     RECEIPT UPLOAD
     ============================================ */
  function setupReceiptUpload() {
    const box = document.getElementById('uploadReceiptBox');
    const input = document.getElementById('receiptFileInput');
    const filenameEl = document.getElementById('receiptFilename');

    if (!box || !input) return;

    box.addEventListener('click', () => input.click());

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        if (window.showTrackToast) window.showTrackToast('حجم الملف كبير — الحد الأقصى 10 ميجا', 'error');
        return;
      }

      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        if (window.showTrackToast) window.showTrackToast('صيغة غير مدعومة', 'error');
        return;
      }

      box.classList.add('has-file');
      if (filenameEl) filenameEl.textContent = file.name;

      try {
        const appId = currentApplication.id;
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${appId}/receipt_${Date.now()}.${ext}`;

        const { error: upErr } = await client.storage
          .from('attachments')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });

        if (upErr) throw new Error(upErr.message);

        await client.from('attachments').insert([{
          application_id: appId,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          doc_type: 'payment_receipt',
          is_required: false,
          ai_verified: false
        }]);

        const { error: updErr } = await client
          .from('applications')
          .update({
            payment_receipt_url: path,
            status: 'payment_under_review'
          })
          .eq('id', appId);

        if (updErr) throw new Error(updErr.message);

        if (window.showTrackToast) {
          window.showTrackToast('تم رفع الإيصال — بانتظار التأكيد', 'success');
        }

        setTimeout(() => refreshTracking(), 1500);

      } catch (err) {
        console.error('[Receipt] Error:', err);
        if (window.showTrackToast) window.showTrackToast('فشل الرفع: ' + err.message, 'error');
      }
    });
  }

  /* ============================================
     REFRESH
     ============================================ */
  async function refreshTracking() {
    if (!currentApplication) return;

    try {
      const { data } = await client
        .from('applications')
        .select('*')
        .eq('id', currentApplication.id)
        .maybeSingle();

      if (!data) return;

      currentApplication = data;

      const [historyRes, attachmentsRes] = await Promise.all([
        client.from('status_history').select('*').eq('application_id', data.id).order('created_at', { ascending: true }),
        loadAttachments(data.id)
      ]);

      currentHistory = historyRes.data || [];
      currentAttachments = attachmentsRes || [];

      renderResult(data, currentHistory, currentAttachments);

      if (window.showTrackToast) window.showTrackToast('تم التحديث', 'success');
    } catch (e) {
      console.warn(e);
    }
  }

  /* ============================================
     COPY TRACKING
     ============================================ */
  function copyTracking(trackingNo) {
    if (!trackingNo) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(trackingNo).then(() => {
        if (window.showTrackToast) window.showTrackToast('تم نسخ رقم التتبع', 'success');
      }).catch(() => fallbackCopy(trackingNo));
    } else {
      fallbackCopy(trackingNo);
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (window.showTrackToast) window.showTrackToast('تم نسخ رقم التتبع', 'success');
    } catch (e) {
      if (window.showTrackToast) window.showTrackToast('فشل النسخ', 'error');
    }
  }

  /* ============================================
     DOWNLOAD AS IMAGE
     ============================================ */
  async function downloadTrackAsImage(trackingNo) {
    const resultBox = document.getElementById('resultBox');
    if (!resultBox || typeof html2canvas === 'undefined') {
      if (window.showTrackToast) window.showTrackToast('جارٍ التحميل...', 'info');
      return;
    }

    try {
      if (window.showTrackToast) window.showTrackToast('جاري تحضير الصورة...', 'info');

      document.querySelectorAll('.result-actions, .upload-missing-btn, .recent-chip, .upload-receipt-box').forEach(el => {
        el.style.display = 'none';
      });

      const canvas = await html2canvas(resultBox, {
        scale: 2,
        backgroundColor: '#0a0c14',
        logging: false,
        useCORS: true
      });

      document.querySelectorAll('.result-actions, .upload-missing-btn, .recent-chip, .upload-receipt-box').forEach(el => {
        el.style.display = '';
      });

      const link = document.createElement('a');
      link.download = `متابعة-${trackingNo}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      if (window.showTrackToast) window.showTrackToast('تم التحميل', 'success');

    } catch (err) {
      console.error('[Download] Error:', err);
      document.querySelectorAll('.result-actions, .upload-missing-btn, .recent-chip, .upload-receipt-box').forEach(el => {
        el.style.display = '';
      });
      if (window.showTrackToast) window.showTrackToast('فشل التحميل', 'error');
    }
  }

  /* ============================================
     REALTIME WATCH
     ============================================ */
  function setupRealtimeWatch(applicationId) {
    if (!window.Realtime) return;

    if (unsubscribeWatcher) {
      try { unsubscribeWatcher(); } catch (e) {}
      unsubscribeWatcher = null;
    }

    unsubscribeWatcher = window.Realtime.watchRow('applications', applicationId, async () => {
      const { data } = await client
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (data) {
        currentApplication = data;

        const [historyRes, attachmentsRes] = await Promise.all([
          client.from('status_history').select('*').eq('application_id', data.id).order('created_at', { ascending: true }),
          loadAttachments(data.id)
        ]);

        currentHistory = historyRes.data || [];
        currentAttachments = attachmentsRes || [];

        renderResult(data, currentHistory, currentAttachments);

        if (window.showTrackToast) {
          window.showTrackToast('تم تحديث حالة الطلب', 'success');
        }
      }
    }, { idColumn: 'id', debounceMs: 500 });
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

      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) searchBtn.addEventListener('click', search);

      document.querySelectorAll('#trackingInput, #nationalIdInput').forEach(el => {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search();
          }
        });
      });

      try {
        const params = new URLSearchParams(window.location.search);
        const tr = params.get('tracking') || params.get('t');
        if (tr) {
          const input = document.getElementById('trackingInput');
          if (input) {
            input.value = tr;
            search();
          }
        } else {
          const last = localStorage.getItem(LAST_TRACKING_KEY);
          if (last) {
            const input = document.getElementById('trackingInput');
            if (input) input.value = last;
          }
        }
      } catch (e) {}

      renderRecentTrackings();

      console.log('[Track] Ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

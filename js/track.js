/* =====================================================
   IT SYNDICATE — Track Application Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const LAST_TRACKING_KEY = 'its_last_tracking';
  const RECENT_TRACKINGS_KEY = 'its_recent_trackings';
  const MAX_RECENT = 5;

  /* ============================================
     STATUS MAP
     ============================================ */
  const STATUS_MAP = {
    'pending':         { label: 'بانتظار الفحص',           step: 1, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)', border: '#ffb800' },
    'ai_review':       { label: 'جاري الفحص التلقائي',     step: 2, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',  border: '#00f0ff' },
    'under_review':    { label: 'تحت المراجعة البشرية',     step: 3, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',  border: '#00f0ff' },
    'needs_docs':      { label: 'مستندات ناقصة',           step: 3, color: '#ffb800', bg: 'rgba(255, 184, 0, 0.12)', border: '#ffb800' },
    'approved':        { label: 'مقبول مبدئيًا',           step: 4, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d' },
    'rejected':        { label: 'مرفوض',                  step: 0, color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)',  border: '#ff5555' },
    'paid':            { label: 'تم الدفع',                step: 5, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d' },
    'card_processing': { label: 'جاري تجهيز الكارنية',      step: 6, color: '#00f0ff', bg: 'rgba(0, 240, 255, 0.1)',  border: '#00f0ff' },
    'card_ready':      { label: 'الكارنية جاهز',           step: 7, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d' },
    'delivered':       { label: 'تم الاستلام',             step: 8, color: '#00ff9d', bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d' },
    'cancelled':       { label: 'ملغي',                    step: 0, color: '#ff5555', bg: 'rgba(255, 85, 85, 0.12)',  border: '#ff5555' }
  };

  /* ============================================
     STAGES (Timeline)
     ============================================ */
  const STAGES = [
    { key: 'pending',         title: 'تم استلام الطلب',      desc: 'تم تسجيل طلبك في النظام' },
    { key: 'ai_review',       title: 'الفحص التلقائي',        desc: 'تحقق ذكي من المستندات' },
    { key: 'under_review',    title: 'المراجعة البشرية',      desc: 'مراجعة يدوية من اللجنة' },
    { key: 'approved',        title: 'الاعتماد المبدئي',      desc: 'تم قبول طلبك مبدئيًا' },
    { key: 'paid',            title: 'الدفع',                 desc: 'سداد رسوم العضوية' },
    { key: 'card_processing', title: 'تجهيز الكارنية',        desc: 'طباعة الكارنية الرسمي' },
    { key: 'card_ready',      title: 'الكارنية جاهز',         desc: 'بانتظار الاستلام' },
    { key: 'delivered',       title: 'تم الاستلام',           desc: 'تم تسليم الكارنية' }
  ];

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let currentApplication = null;
  let currentHistory = [];
  let unsubscribeWatcher = null;

  /* ============================================
     DOM CACHE
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    search: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    x: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    copy: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    qr: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z"/><path d="M18 18h3v3h-3z"/></svg>`,
    user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`
  };

  /* ============================================
     HELPERS
     ============================================ */
  function setAlert(containerId, type, message) {
    const box = document.getElementById(containerId);
    if (!box) return;

    const colors = {
      success: { bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d', text: '#00ff9d', icon: ICONS.check },
      error:   { bg: 'rgba(255, 85, 85, 0.12)', border: '#ff5555', text: '#ff5555', icon: ICONS.x },
      warning: { bg: 'rgba(255, 184, 0, 0.12)', border: '#ffb800', text: '#ffb800', icon: ICONS.alert },
      info:    { bg: 'rgba(0, 240, 255, 0.1)',  border: '#00f0ff', text: '#00f0ff', icon: ICONS.info }
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
      ">
        <span style="width:20px;height:20px;display:inline-flex;flex-shrink:0;">${c.icon}</span>
        <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
      </div>
    `;
  }

  function clearAlert(containerId) {
    const box = document.getElementById(containerId);
    if (box) box.innerHTML = '';
  }

  function getStatusInfo(status) {
    return STATUS_MAP[status] || {
      label: status || 'غير معروف',
      step: 0,
      color: '#888',
      bg: 'rgba(136, 136, 136, 0.12)',
      border: '#888'
    };
  }

  function formatDate(dateStr) {
    if (!dateStr) return '---';
    try {
      return new Date(dateStr).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '---';
    }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} دقيقة`;
      if (hours < 24) return `منذ ${hours} ساعة`;
      if (days < 30) return `منذ ${days} يوم`;
      return formatDate(dateStr);
    } catch (e) {
      return '';
    }
  }

  /* ============================================
     RECENT TRACKINGS
     ============================================ */
  function getRecentTrackings() {
    try {
      const raw = localStorage.getItem(RECENT_TRACKINGS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
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
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    container.innerHTML = `
      <div style="
        padding:16px 18px;
        background:rgba(0, 240, 255, 0.04);
        border:1px solid rgba(0, 240, 255, 0.15);
        border-radius:14px;
        margin-bottom:16px;
      ">
        <div style="font-size:12.5px;color:rgba(255,255,255,0.55);margin-bottom:10px;font-weight:600;">آخر عمليات البحث</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${list.map(item => {
            const st = getStatusInfo(item.status);
            return `
              <button type="button" class="recent-chip" data-tracking="${window.escapeHtml ? window.escapeHtml(item.tracking_no) : item.tracking_no}" style="
                background:rgba(255,255,255,0.04);
                border:1px solid ${st.border};
                color:${st.color};
                padding:7px 14px;
                border-radius:100px;
                font-size:12.5px;
                font-family:'JetBrains Mono',monospace;
                font-weight:600;
                cursor:pointer;
                transition:all 0.2s;
              ">${window.escapeHtml ? window.escapeHtml(item.tracking_no) : item.tracking_no}</button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.recent-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const tr = btn.dataset.tracking;
        const input = document.getElementById('trackingInput');
        if (input) {
          input.value = tr;
          const natInput = document.getElementById('nationalIdInput');
          if (natInput) natInput.value = '';
        }
        search();
      });
    });
  }

  function clearRecentTrackings() {
    try {
      localStorage.removeItem(RECENT_TRACKINGS_KEY);
      localStorage.removeItem(LAST_TRACKING_KEY);
    } catch (e) {}
    renderRecentTrackings();
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

    // Validate
    if (nationalId && !/^\d{14}$/.test(nationalId)) {
      setAlert('resultBox', 'error', 'الرقم القومي يجب أن يكون 14 رقم');
      return;
    }

    // Disable button + loading
    const btn = document.getElementById('searchBtn');
    const originalHtml = btn?.innerHTML || '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>جاري البحث</span><span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;margin-right:8px;"></span>`;
    }

    if (!document.getElementById('trackSpin')) {
      const st = document.createElement('style');
      st.id = 'trackSpin';
      st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(st);
    }

    clearAlert('resultBox');

    try {
      // Build query
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

      if (error) {
        throw new Error('خطأ في البحث: ' + error.message);
      }

      if (!data) {
        setAlert('resultBox', 'warning', 'لم يتم العثور على طلب بهذه البيانات');
        return;
      }

      currentApplication = data;

      // Load history
      await loadHistory(data.id);

      // Render
      renderResult(data, currentHistory);

      // Add to recents
      addRecentTracking(data);
      renderRecentTrackings();

      // Setup realtime watcher on this application
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
     LOAD HISTORY
     ============================================ */
  async function loadHistory(applicationId) {
    const { data, error } = await client
      .from('status_history')
      .select('*')
      .eq('application_id', applicationId)
      .order('changed_at', { ascending: true });

    currentHistory = data || [];
    return currentHistory;
  }

  /* ============================================
     RENDER RESULT
     ============================================ */
  function renderResult(app, history) {
    const box = document.getElementById('resultBox');
    if (!box) return;

    const status = getStatusInfo(app.status);
    const currentStep = status.step;
    const isRejected = app.status === 'rejected' || app.status === 'cancelled';

    // Build timeline
    const timelineHTML = STAGES.map((stage, idx) => {
      const stageNum = idx + 1;
      let state = 'pending'; // pending | done | current

      if (isRejected) {
        if (stageNum < currentStep) state = 'done';
        else state = 'skipped';
      } else {
        if (stageNum < currentStep) state = 'done';
        else if (stageNum === currentStep) state = 'current';
        else state = 'pending';
      }

      const histItem = history.find(h => h.new_status === stage.key);
      const date = histItem ? histItem.changed_at : null;
      const notes = histItem?.notes;

      const dotColor = {
        done: '#00ff9d',
        current: '#ffb800',
        pending: 'rgba(255,255,255,0.15)',
        skipped: 'rgba(255,85,85,0.3)'
      }[state] || 'rgba(255,255,255,0.15)';

      const titleColor = state === 'done' ? '#fff'
                       : state === 'current' ? '#ffb800'
                       : state === 'skipped' ? 'rgba(255,85,85,0.6)'
                       : 'rgba(255,255,255,0.4)';

      return `
        <div class="timeline-item ${state}" style="
          position:relative;
          padding:14px 0 14px 0;
          padding-right:40px;
        ">
          <div style="
            position:absolute;
            right:0;
            top:16px;
            width:24px;
            height:24px;
            border-radius:50%;
            background:${dotColor};
            border:3px solid #0a0c14;
            box-shadow:0 0 0 2px ${dotColor}, 0 0 15px ${dotColor};
            ${state === 'current' ? 'animation:pulseTrack 1.6s ease-in-out infinite;' : ''}
            display:flex;
            align-items:center;
            justify-content:center;
          ">
            ${state === 'done' ? `<span style="width:12px;height:12px;color:#000;">${ICONS.check}</span>` : ''}
          </div>
          <div style="
            display:flex;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
            margin-bottom:4px;
          ">
            <div style="font-weight:700;font-size:15px;color:${titleColor};">${stage.title}</div>
            ${state === 'current' ? `
              <span style="
                font-size:10.5px;
                padding:2px 10px;
                border-radius:100px;
                background:rgba(255,184,0,0.15);
                border:1px solid #ffb800;
                color:#ffb800;
                font-weight:700;
                letter-spacing:0.5px;
              ">جاري الآن</span>
            ` : ''}
          </div>
          <div style="font-size:12.5px;color:rgba(255,255,255,0.45);">${stage.desc}</div>
          ${date ? `
            <div style="
              display:flex;
              align-items:center;
              gap:6px;
              font-size:11.5px;
              color:rgba(255,255,255,0.4);
              margin-top:6px;
              font-family:'JetBrains Mono',monospace;
            ">
              <span style="width:12px;height:12px;display:inline-flex;">${ICONS.clock}</span>
              <span>${formatDate(date)}</span>
            </div>
          ` : ''}
          ${notes ? `
            <div style="
              margin-top:8px;
              padding:8px 12px;
              background:rgba(0,240,255,0.05);
              border-right:2px solid var(--accent, #00f0ff);
              border-radius:6px;
              font-size:12.5px;
              color:rgba(255,255,255,0.7);
            ">${window.escapeHtml ? window.escapeHtml(notes) : notes}</div>
          ` : ''}
        </div>
      `;
    }).join('');

    // Rejection notice
    const rejectionNotice = isRejected ? `
      <div style="
        margin-top:20px;
        padding:16px 18px;
        background:rgba(255,85,85,0.1);
        border:1.5px solid #ff5555;
        border-radius:12px;
        color:#ff5555;
        font-size:13.5px;
        font-weight:600;
        display:flex;
        align-items:center;
        gap:10px;
      ">
        <span style="width:20px;height:20px;display:inline-flex;flex-shrink:0;">${ICONS.alert}</span>
        <span>${app.reviewer_notes ? window.escapeHtml(app.reviewer_notes) : 'تم رفض الطلب. للاستفسار تواصل مع اللجنة.'}</span>
      </div>
    ` : '';

    // QR Code
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(app.tracking_no)}`;

    // Progress percentage
    const totalSteps = STAGES.length;
    const progressPct = isRejected ? 100 : Math.round((currentStep / totalSteps) * 100);

    box.innerHTML = `
      <div style="animation: resultIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);">

        <!-- Header Card -->
        <div style="
          padding:24px;
          background:rgba(10, 12, 20, 0.7);
          border:1.5px solid ${status.border};
          border-radius:18px;
          margin-bottom:20px;
          position:relative;
          overflow:hidden;
        ">
          <div style="
            position:absolute;
            top:-60px;
            left:-60px;
            width:180px;
            height:180px;
            border-radius:50%;
            background:radial-gradient(circle, ${status.color}22, transparent 70%);
            pointer-events:none;
          "></div>

          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;position:relative;z-index:1;">
            <div style="flex:1;min-width:240px;">
              <div style="font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:1px;margin-bottom:6px;">رقم التتبع</div>
              <div style="
                display:flex;
                align-items:center;
                gap:10px;
                margin-bottom:14px;
                flex-wrap:wrap;
              ">
                <span style="
                  font-family:'JetBrains Mono',monospace;
                  font-size:22px;
                  font-weight:700;
                  color:var(--accent, #00f0ff);
                  letter-spacing:1px;
                ">${window.escapeHtml ? window.escapeHtml(app.tracking_no) : app.tracking_no}</span>
                <button type="button" onclick="copyTracking('${app.tracking_no}')" style="
                  background:rgba(0,240,255,0.08);
                  border:1px solid rgba(0,240,255,0.3);
                  color:var(--accent, #00f0ff);
                  width:32px;
                  height:32px;
                  border-radius:8px;
                  cursor:pointer;
                  display:inline-flex;
                  align-items:center;
                  justify-content:center;
                  transition:all 0.2s;
                " title="نسخ">
                  <span style="width:16px;height:16px;display:inline-flex;">${ICONS.copy}</span>
                </button>
              </div>

              <div style="
                display:inline-flex;
                align-items:center;
                gap:8px;
                padding:8px 16px;
                background:${status.bg};
                border:1.5px solid ${status.border};
                border-radius:100px;
                font-size:13.5px;
                font-weight:700;
                color:${status.color};
              ">
                <span style="width:14px;height:14px;display:inline-flex;">
                  ${isRejected ? ICONS.x : (currentStep >= 8 ? ICONS.check : ICONS.clock)}
                </span>
                <span>${status.label}</span>
              </div>
            </div>

            <div style="
              background:white;
              padding:8px;
              border-radius:12px;
              flex-shrink:0;
              box-shadow:0 0 25px rgba(0,240,255,0.2);
            ">
              <img src="${qrUrl}" alt="QR" style="width:120px;height:120px;display:block;" />
            </div>
          </div>

          <!-- Progress bar -->
          ${!isRejected ? `
            <div style="margin-top:20px;position:relative;z-index:1;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.45);margin-bottom:6px;">
                <span>التقدم</span>
                <span>${progressPct}%</span>
              </div>
              <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;">
                <div style="
                  height:100%;
                  width:${progressPct}%;
                  background:linear-gradient(90deg, var(--accent, #00f0ff), var(--accent2, #b026ff));
                  box-shadow:0 0 15px var(--accent, #00f0ff);
                  border-radius:6px;
                  transition:width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
                "></div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Details Grid -->
        <div style="
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
          gap:12px;
          margin-bottom:20px;
        ">
          ${renderDetailCard(ICONS.user, 'الاسم', app.full_name)}
          ${renderDetailCard(ICONS.calendar, 'تاريخ التقديم', formatDate(app.created_at))}
          ${renderDetailCard(ICONS.phone, 'الموبايل', app.phone)}
          ${renderDetailCard(ICONS.info, 'نوع العضوية', document.getElementById('membershipTypeName')?.textContent || '—')}
        </div>

        <!-- Timeline -->
        <div style="
          padding:24px;
          background:rgba(10, 12, 20, 0.6);
          border:1px solid rgba(0,240,255,0.12);
          border-radius:18px;
        ">
          <h3 style="
            font-family:'Tajawal',sans-serif;
            font-size:17px;
            font-weight:700;
            color:#fff;
            margin-bottom:16px;
            display:flex;
            align-items:center;
            gap:8px;
          ">
            <span style="width:20px;height:20px;display:inline-flex;color:var(--accent,#00f0ff);">${ICONS.clock}</span>
            <span>مراحل الطلب</span>
          </h3>

          <div style="position:relative;padding-right:0;">
            <!-- Vertical line -->
            <div style="
              position:absolute;
              right:11px;
              top:16px;
              bottom:16px;
              width:2px;
              background:linear-gradient(to bottom,
                rgba(0,255,157,0.4) 0%,
                rgba(0,240,255,0.2) 50%,
                rgba(255,255,255,0.08) 100%);
            "></div>
            ${timelineHTML}
          </div>

          ${rejectionNotice}
        </div>

        <!-- Actions -->
        <div style="
          display:flex;
          gap:10px;
          margin-top:20px;
          flex-wrap:wrap;
        ">
          <button type="button" onclick="refreshTracking()" style="
            flex:1;
            min-width:140px;
            padding:12px 20px;
            background:rgba(0,240,255,0.08);
            border:1.5px solid rgba(0,240,255,0.3);
            color:var(--accent, #00f0ff);
            border-radius:12px;
            font-family:inherit;
            font-weight:700;
            font-size:14px;
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:8px;
            transition:all 0.25s;
          ">
            <span style="width:16px;height:16px;display:inline-flex;">${ICONS.refresh}</span>
            <span>تحديث</span>
          </button>

          <button type="button" onclick="window.print()" style="
            flex:1;
            min-width:140px;
            padding:12px 20px;
            background:linear-gradient(135deg, var(--accent, #00f0ff), var(--accent2, #b026ff));
            border:none;
            color:#000;
            border-radius:12px;
            font-family:inherit;
            font-weight:700;
            font-size:14px;
            cursor:pointer;
            transition:all 0.25s;
          ">طباعة</button>
        </div>

      </div>

      <style>
        @keyframes resultIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseTrack {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.2); }
        }
      </style>
    `;
  }

  function renderDetailCard(icon, label, value) {
    return `
      <div style="
        padding:14px 16px;
        background:rgba(10, 12, 20, 0.5);
        border:1px solid rgba(0,240,255,0.1);
        border-radius:12px;
        display:flex;
        align-items:center;
        gap:12px;
      ">
        <div style="
          width:36px;
          height:36px;
          border-radius:10px;
          background:rgba(0,240,255,0.08);
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
        ">
          <span style="width:18px;height:18px;display:inline-flex;color:var(--accent,#00f0ff);">${icon}</span>
        </div>
        <div style="min-width:0;">
          <div style="font-size:11.5px;color:rgba(255,255,255,0.45);margin-bottom:2px;">${label}</div>
          <div style="font-size:13.5px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.escapeHtml ? window.escapeHtml(value || '—') : (value || '—')}</div>
        </div>
      </div>
    `;
  }

  /* ============================================
     REALTIME WATCH
     ============================================ */
  function setupRealtimeWatch(applicationId) {
    if (!window.Realtime) return;

    // Unsubscribe previous
    if (unsubscribeWatcher) {
      try { unsubscribeWatcher(); } catch (e) {}
      unsubscribeWatcher = null;
    }

    unsubscribeWatcher = window.Realtime.watchRow('applications', applicationId, async () => {
      // Reload application + history
      const { data } = await client
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .maybeSingle();

      if (data) {
        currentApplication = data;
        await loadHistory(applicationId);
        renderResult(data, currentHistory);

        // Toast on status change
        if (window.showToast) {
          window.showToast('تم تحديث حالة الطلب', 'info', 2500);
        }
      }
    });
  }

  /* ============================================
     PUBLIC HELPERS (used by inline onclick)
     ============================================ */
  window.copyTracking = function (trackingNo) {
    if (window.copyToClipboard) {
      window.copyToClipboard(trackingNo);
    } else {
      try {
        navigator.clipboard.writeText(trackingNo);
        alert('تم نسخ رقم التتبع');
      } catch (e) {
        alert('فشل النسخ');
      }
    }
  };

  window.refreshTracking = async function () {
    if (!currentApplication) return;
    try {
      const { data } = await client
        .from('applications')
        .select('*')
        .eq('id', currentApplication.id)
        .maybeSingle();

      if (data) {
        currentApplication = data;
        await loadHistory(data.id);
        renderResult(data, currentHistory);
        if (window.showToast) window.showToast('تم التحديث', 'success', 1500);
      }
    } catch (e) {
      if (window.showToast) window.showToast('فشل التحديث', 'error', 2000);
    }
  };

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (typeof window.onSupabaseReady !== 'function') {
      setTimeout(init, 100);
      return;
    }

    window.onSupabaseReady((c) => {
      client = c;

      // Setup search button
      const searchBtn = document.getElementById('searchBtn');
      if (searchBtn) {
        searchBtn.addEventListener('click', search);
      }

      // Enter key
      document.querySelectorAll('#trackingInput, #nationalIdInput').forEach(el => {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            search();
          }
        });
      });

      // Auto-search if ?tracking= in URL
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
          // Restore last tracking
          const last = localStorage.getItem(LAST_TRACKING_KEY);
          if (last) {
            const input = document.getElementById('trackingInput');
            if (input) input.value = last;
          }
        }
      } catch (e) {}

      // Render recent
      renderRecentTrackings();

      // Clear button (if exists)
      const clearBtn = document.getElementById('clearRecentBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', clearRecentTrackings);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

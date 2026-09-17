/* =====================================================
   IT SYNDICATE — Apply Form Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
  const MIN_IMAGE_WIDTH = 400;
  const MIN_IMAGE_HEIGHT = 250;
  const RECEIPT_STORAGE_KEY = 'its_receipt_data';
  const DRAFT_STORAGE_KEY = 'its_apply_draft';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let membershipTypes = [];
  let selectedFiles = {
    id_front: null,
    id_back: null,
    certificate: null,
    photo: null
  };
  let fileCheckResults = {
    id_front: null,
    id_back: null,
    certificate: null,
    photo: null
  };
  let isSubmitting = false;
  let draftSaveTimer = null;

  /* ============================================
     DOM CACHE
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ============================================
     SVG ICONS (No emoji)
     ============================================ */
  const ICONS = {
    camera: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    file: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    user: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    check: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    loader: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
    send: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };

  /* ============================================
     UTILS
     ============================================ */
  function setAlert(containerId, type, message) {
    const box = document.getElementById(containerId);
    if (!box) return;

    const colors = {
      success: { bg: 'rgba(0, 255, 157, 0.12)', border: '#00ff9d', text: '#00ff9d' },
      error:   { bg: 'rgba(255, 85, 85, 0.12)', border: '#ff5555', text: '#ff5555' },
      warning: { bg: 'rgba(255, 184, 0, 0.12)', border: '#ffb800', text: '#ffb800' },
      info:    { bg: 'rgba(0, 240, 255, 0.1)',  border: '#00f0ff', text: '#00f0ff' }
    };
    const c = colors[type] || colors.info;
    const iconMap = {
      success: ICONS.check,
      error: ICONS.x,
      warning: ICONS.alert,
      info: ICONS.info
    };
    const icon = iconMap[type] || ICONS.info;

    box.innerHTML = `
      <div class="alert alert-${type}" style="
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
        animation: alertIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <span style="width:20px;height:20px;display:inline-flex;flex-shrink:0;">${icon}</span>
        <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
      </div>
    `;

    // Add animation keyframes if not exists
    if (!document.getElementById('applyAnimStyles')) {
      const style = document.createElement('style');
      style.id = 'applyAnimStyles';
      style.textContent = `
        @keyframes alertIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes checkPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  function clearAlert(containerId) {
    const box = document.getElementById(containerId);
    if (box) box.innerHTML = '';
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setButtonLoading(btn, text, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = `<span>${text}</span><span class="spin" style="
        display:inline-block;
        width:16px;height:16px;
        border:2px solid rgba(255,255,255,0.3);
        border-top-color:#fff;
        border-radius:50%;
        animation: spin 0.8s linear infinite;
        margin-right:8px;
      "></span>`;
      if (!document.getElementById('spinStyles')) {
        const st = document.createElement('style');
        st.id = 'spinStyles';
        st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(st);
      }
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ============================================
     FILE UPLOAD HANDLERS
     ============================================ */
  function setupFileUploads() {
    const uploadWrappers = $$('.file-upload');

    uploadWrappers.forEach(wrapper => {
      const input = wrapper.querySelector('input[type=file]');
      if (!input) return;

      const fieldName = input.name;

      // Click wrapper → open file picker
      wrapper.addEventListener('click', (e) => {
        if (e.target === input) return;
        input.click();
      });

      // Handle file selection
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resetUploadUI(wrapper, fieldName);
          return;
        }
        await handleFileSelected(wrapper, fieldName, file);
      });

      // Drag & drop
      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.style.borderColor = 'var(--accent, #00f0ff)';
        wrapper.style.background = 'rgba(0, 240, 255, 0.06)';
      });

      wrapper.addEventListener('dragleave', () => {
        wrapper.style.borderColor = '';
        wrapper.style.background = '';
      });

      wrapper.addEventListener('drop', async (e) => {
        e.preventDefault();
        wrapper.style.borderColor = '';
        wrapper.style.background = '';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        // Set into input
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } catch (err) {}

        await handleFileSelected(wrapper, fieldName, file);
      });
    });
  }

  function resetUploadUI(wrapper, fieldName) {
    wrapper.classList.remove('has-file');
    const filename = wrapper.querySelector('.filename');
    if (filename) filename.textContent = '';
    selectedFiles[fieldName] = null;
    fileCheckResults[fieldName] = null;
    updateCheckUI(fieldName, null);
  }

  async function handleFileSelected(wrapper, fieldName, file) {
    // Reset
    wrapper.classList.remove('has-file');
    const filename = wrapper.querySelector('.filename');
    if (filename) filename.textContent = '';

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      updateCheckUI(fieldName, {
        status: 'fail',
        message: `حجم الملف كبير جدًا (${window.formatFileSize ? window.formatFileSize(file.size) : Math.round(file.size/1024) + 'KB'}) — الحد الأقصى 5 ميجا`
      });
      selectedFiles[fieldName] = null;
      fileCheckResults[fieldName] = null;
      return;
    }

    // Type check
    const isCert = fieldName === 'certificate';
    const allowed = isCert ? ALLOWED_DOC_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      updateCheckUI(fieldName, {
        status: 'fail',
        message: isCert
          ? 'صيغة الملف غير مدعومة — مسموح: JPG, PNG, PDF'
          : 'صيغة الصورة غير مدعومة — مسموح: JPG, PNG'
      });
      selectedFiles[fieldName] = null;
      fileCheckResults[fieldName] = null;
      return;
    }

    // Show loading
    updateCheckUI(fieldName, { status: 'checking', message: 'جاري فحص الملف...' });

    // Validate image
    if (file.type.startsWith('image/')) {
      const result = await validateImageFile(file);
      if (!result.ok) {
        updateCheckUI(fieldName, { status: 'fail', message: result.message });
        selectedFiles[fieldName] = null;
        fileCheckResults[fieldName] = null;
        return;
      }
    }

    // Success
    selectedFiles[fieldName] = file;
    fileCheckResults[fieldName] = { ok: true, status: 'pass' };

    wrapper.classList.add('has-file');
    if (filename) filename.textContent = `${file.name} (${window.formatFileSize ? window.formatFileSize(file.size) : Math.round(file.size/1024) + 'KB'})`;

    updateCheckUI(fieldName, {
      status: 'pass',
      message: 'الملف جاهز للرفع'
    });

    saveDraft();
  }

  function validateImageFile(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      const cleanup = () => URL.revokeObjectURL(url);

      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        cleanup();

        if (w < MIN_IMAGE_WIDTH || h < MIN_IMAGE_HEIGHT) {
          resolve({
            ok: false,
            message: `دقة الصورة منخفضة (${w}×${h}) — الحد الأدنى ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT}`
          });
          return;
        }

        // Aspect ratio sanity: reject very weird ratios
        const ratio = w / h;
        if (ratio > 4 || ratio < 0.25) {
          resolve({
            ok: false,
            message: 'أبعاد الصورة غير مناسبة، من فضلك استخدم صورة أوضح'
          });
          return;
        }

        resolve({ ok: true });
      };

      img.onerror = () => {
        cleanup();
        resolve({ ok: false, message: 'الملف غير صالح أو تالف' });
      };

      img.src = url;
    });
  }

  function updateCheckUI(fieldName, result) {
    const el = document.getElementById('check-' + fieldName);
    if (!el) return;

    if (!result) {
      el.className = 'ai-check';
      el.innerHTML = '';
      return;
    }

    const statusConfig = {
      checking: {
        cls: 'checking',
        bg: 'rgba(255, 184, 0, 0.1)',
        border: '#ffb800',
        color: '#ffb800',
        icon: ICONS.loader,
        spin: true
      },
      pass: {
        cls: 'pass',
        bg: 'rgba(0, 255, 157, 0.1)',
        border: '#00ff9d',
        color: '#00ff9d',
        icon: ICONS.check,
        spin: false
      },
      fail: {
        cls: 'fail',
        bg: 'rgba(255, 85, 85, 0.1)',
        border: '#ff5555',
        color: '#ff5555',
        icon: ICONS.x,
        spin: false
      }
    };

    const c = statusConfig[result.status] || statusConfig.checking;

    el.className = 'ai-check ' + c.cls;
    el.style.cssText = `
      background:${c.bg};
      border:1px solid ${c.border};
      color:${c.color};
      padding:10px 14px;
      border-radius:10px;
      font-size:13px;
      font-weight:600;
      display:flex;
      align-items:center;
      gap:10px;
      margin-top:8px;
    `;

    el.innerHTML = `
      <span style="width:18px;height:18px;display:inline-flex;flex-shrink:0;${c.spin ? 'animation:spin 0.9s linear infinite;' : ''}">${c.icon}</span>
      <span>${window.escapeHtml ? window.escapeHtml(result.message) : result.message}</span>
    `;

    if (!document.getElementById('spinStyles')) {
      const st = document.createElement('style');
      st.id = 'spinStyles';
      st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(st);
    }
  }

  /* ============================================
     LOAD MEMBERSHIP TYPES
     ============================================ */
  async function loadMembershipTypes() {
    const select = document.getElementById('membershipType');
    if (!select) return;

    const { data, error } = await client
      .from('membership_types')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      setAlert('alertBox', 'error', 'فشل تحميل أنواع العضوية: ' + error.message);
      return;
    }

    membershipTypes = data || [];
    select.innerHTML = '<option value="">اختر النوع</option>';

    membershipTypes.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} — ${t.fee} جنيه`;
      opt.dataset.fee = t.fee;
      opt.dataset.name = t.name;
      select.appendChild(opt);
    });

    // Preselect from URL ?type=id
    try {
      const params = new URLSearchParams(window.location.search);
      const typeId = params.get('type');
      if (typeId) select.value = typeId;
    } catch (e) {}

    updatePriceDisplay();
    select.addEventListener('change', updatePriceDisplay);
  }

  function updatePriceDisplay() {
    const select = document.getElementById('membershipType');
    const priceEl = document.getElementById('priceDisplay');
    if (!select || !priceEl) return;

    const opt = select.selectedOptions[0];
    const fee = opt?.dataset?.fee;

    if (!fee) {
      priceEl.style.display = 'none';
      return;
    }

    priceEl.style.display = 'block';
    priceEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.25);border-radius:12px;margin-top:12px;">
        <span style="font-size:13px;color:rgba(255,255,255,0.7);">الرسوم السنوية</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--accent,#00f0ff);">${fee} <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.5);">جنيه</span></span>
      </div>
    `;
  }

  /* ============================================
     FORM VALIDATION
     ============================================ */
  function validateForm() {
    const errors = [];
    const form = document.getElementById('applyForm');
    if (!form) return errors;

    const getVal = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    // Basic fields
    const fullName = getVal('full_name');
    const nationalId = getVal('national_id');
    const phone = getVal('phone');
    const email = getVal('email');
    const membershipType = getVal('membership_type_id');

    if (!fullName || fullName.length < 6) {
      errors.push('الاسم الرباعي مطلوب (6 أحرف على الأقل)');
    }

    if (!/^\d{14}$/.test(nationalId)) {
      errors.push('الرقم القومي يجب أن يكون 14 رقم');
    }

    if (!/^01[0125]\d{8}$/.test(phone)) {
      errors.push('رقم الموبايل غير صحيح (مثال: 01012345678)');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('البريد الإلكتروني غير صحيح');
    }

    if (!membershipType) {
      errors.push('اختر نوع العضوية');
    }

    // Files
    const requiredFiles = ['id_front', 'id_back', 'certificate', 'photo'];
    const fileLabels = {
      id_front: 'بطاقة الرقم القومي (وجه)',
      id_back: 'بطاقة الرقم القومي (ظهر)',
      certificate: 'الشهادة الدراسية',
      photo: 'الصورة الشخصية'
    };

    requiredFiles.forEach(f => {
      if (!selectedFiles[f]) {
        errors.push(`مطلوب: ${fileLabels[f]}`);
      } else if (fileCheckResults[f] && fileCheckResults[f].status === 'fail') {
        errors.push(`الملف "${fileLabels[f]}" فيه مشكلة`);
      }
    });

    // Agreement
    const agree = document.getElementById('agreeTerms');
    if (agree && !agree.checked) {
      errors.push('يجب الموافقة على الإقرار');
    }

    return errors;
  }

  /* ============================================
     DUPLICATE CHECK
     ============================================ */
  async function checkDuplicate(nationalId) {
    const { data, error } = await client
      .from('applications')
      .select('id, tracking_no, status, created_at')
      .eq('national_id', nationalId)
      .in('status', [
        'pending', 'ai_review', 'under_review', 'needs_docs',
        'approved', 'paid', 'card_processing', 'card_ready'
      ])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      // If error (e.g. RLS), don't block
      return null;
    }

    if (data && data.length > 0) {
      return data[0];
    }
    return null;
  }

  /* ============================================
     SUBMIT
     ============================================ */
  async function submitForm(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearAlert('alertBox');
    const errors = validateForm();
    if (errors.length > 0) {
      setAlert('alertBox', 'error', errors[0] + (errors.length > 1 ? ` (و${errors.length - 1} أخطاء أخرى)` : ''));
      scrollToTop();
      return;
    }

    isSubmitting = true;
    const btn = document.getElementById('submitBtn');
    setButtonLoading(btn, 'جاري الإرسال...', true);

    try {
      const form = document.getElementById('applyForm');
      const getVal = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

      const nationalId = getVal('national_id');

      // 1) Duplicate check
      setAlert('alertBox', 'info', 'جاري التحقق من البيانات...');
      const duplicate = await checkDuplicate(nationalId);
      if (duplicate) {
        throw new Error(`يوجد طلب مسبق بنفس الرقم القومي — رقم التتبع: ${duplicate.tracking_no}`);
      }

      // 2) Insert application
      setAlert('alertBox', 'info', 'جاري إنشاء الطلب...');
      const payload = {
        full_name: getVal('full_name'),
        national_id: nationalId,
        phone: getVal('phone'),
        email: getVal('email') || null,
        address: getVal('address') || null,
        qualification: getVal('qualification') || null,
        graduation_year: getVal('graduation_year') ? parseInt(getVal('graduation_year')) : null,
        employer: getVal('employer') || null,
        governorate: getVal('governorate') || null,
        membership_type_id: parseInt(getVal('membership_type_id')),
        status: 'pending',
        ai_score: 0
      };

      const { data: appData, error: appError } = await client
        .from('applications')
        .insert([payload])
        .select()
        .single();

      if (appError) {
        throw new Error('فشل إنشاء الطلب: ' + appError.message);
      }

      const applicationId = appData.id;
      const trackingNo = appData.tracking_no;

      // 3) Upload files
      setAlert('alertBox', 'info', 'جاري رفع المرفقات...');

      const fileUploads = [
        { field: 'id_front', docType: 'id_front' },
        { field: 'id_back', docType: 'id_back' },
        { field: 'certificate', docType: 'certificate' },
        { field: 'photo', docType: 'photo' }
      ];

      const uploadedPaths = [];
      const uploadErrors = [];

      for (const f of fileUploads) {
        const file = selectedFiles[f.field];
        if (!file) continue;

        const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
        const path = `${applicationId}/${f.docType}_${Date.now()}.${ext}`;

        const { error: upErr } = await client.storage
          .from('attachments')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });

        if (upErr) {
          uploadErrors.push(`${f.docType}: ${upErr.message}`);
          continue;
        }

        uploadedPaths.push({ path, file, docType: f.docType });

        // Insert into attachments table
        await client.from('attachments').insert([{
          application_id: applicationId,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          doc_type: f.docType,
          ai_verified: true
        }]);
      }

      if (uploadErrors.length > 0) {
        console.warn('[Apply] Some uploads failed:', uploadErrors);
      }

      // 4) Prepare receipt data
      const selectedTypeOpt = form.querySelector(`[name="membership_type_id"]`)?.selectedOptions[0];
      const membershipName = selectedTypeOpt?.dataset?.name || selectedTypeOpt?.textContent?.split('—')[0]?.trim() || '';

      const receiptData = {
        tracking_no: trackingNo,
        application_id: applicationId,
        full_name: appData.full_name,
        national_id: appData.national_id,
        phone: appData.phone,
        membership_type: membershipName,
        membership_type_id: appData.membership_type_id,
        status: appData.status,
        created_at: appData.created_at
      };

      // 5) Save receipt + clear draft
      try {
        sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receiptData));
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {}

      // 6) Success
      setAlert('alertBox', 'success', 'تم استلام طلبك بنجاح، جاري التحويل للإيصال...');

      setTimeout(() => {
        window.location.href = 'receipt.html';
      }, 800);

    } catch (err) {
      console.error('[Apply] Error:', err);
      setAlert('alertBox', 'error', err.message || 'حدث خطأ غير متوقع');
      scrollToTop();
      isSubmitting = false;
      setButtonLoading(btn, 'إرسال الطلب', false);
    }
  }

  /* ============================================
     DRAFT (auto-save form data)
     ============================================ */
  function saveDraft() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      try {
        const form = document.getElementById('applyForm');
        if (!form) return;
        const data = {};
        form.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.type === 'file' || el.type === 'checkbox') return;
          if (!el.name) return;
          data[el.name] = el.value;
        });
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          data,
          savedAt: new Date().toISOString()
        }));
      } catch (e) {}
    }, 600);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return;

      const form = document.getElementById('applyForm');
      if (!form) return;

      // Restore only if draft is < 24h old
      const savedAt = new Date(parsed.savedAt).getTime();
      if (Date.now() - savedAt > 24 * 60 * 60 * 1000) return;

      Object.entries(parsed.data).forEach(([name, value]) => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el && el.type !== 'file' && el.type !== 'checkbox') {
          el.value = value || '';
        }
      });

      // Restore membership type from URL if not restored
      const params = new URLSearchParams(window.location.search);
      const typeId = params.get('type');
      if (typeId) {
        const select = document.getElementById('membershipType');
        if (select) select.value = typeId;
        updatePriceDisplay();
      }
    } catch (e) {}
  }

  function setupDraftAutosave() {
    const form = document.getElementById('applyForm');
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.type === 'file') return;
      el.addEventListener('input', saveDraft);
      el.addEventListener('change', saveDraft);
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

      // Load types
      await loadMembershipTypes();

      // Setup file uploads
      setupFileUploads();

      // Restore draft
      restoreDraft();

      // Setup autosave
      setupDraftAutosave();

      // Form submit
      const form = document.getElementById('applyForm');
      if (form) {
        form.addEventListener('submit', submitForm);
      }

      // Real-time: if membership_types changes, reload
      if (window.Realtime) {
        window.Realtime.watch('membership_types', () => {
          loadMembershipTypes();
        });
      }
    });
  }

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

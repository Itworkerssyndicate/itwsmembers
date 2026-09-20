/* =====================================================
   IT SYNDICATE — Apply Form Logic
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (بعد التعديل)
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_DOC_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
  const MIN_IMAGE_WIDTH = 400;
  const MIN_IMAGE_HEIGHT = 250;
  const RECEIPT_STORAGE_KEY = 'its_receipt_data';
  const DRAFT_STORAGE_KEY = 'its_apply_draft';
  const TESSERACT_CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  /* ============================================
     REQUIRED & OPTIONAL DOCS
     ============================================ */
  const REQUIRED_DOCS = [
    { field: 'id_front',      docType: 'id_front',      label: 'بطاقة الرقم القومي (وجه)',  keywords: ['جمهورية مصر العربية', 'بطاقة تحقيق الشخصية'] },
    { field: 'id_back',       docType: 'id_back',       label: 'بطاقة الرقم القومي (ظهر)',  keywords: [] },
    { field: 'certificate',   docType: 'certificate',   label: 'الشهادة الدراسية',          keywords: ['شهادة', 'بكالوريوس', 'ليسانس', 'دبلوم', 'ثانوية', 'التقدير'] },
    { field: 'photo',         docType: 'photo',         label: 'الصورة الشخصية',            keywords: [] }
  ];

  const OPTIONAL_DOCS = [
    { field: 'work_certificate', docType: 'work_certificate', label: 'شهادة إثبات عمل', keywords: ['شهادة', 'خبرة', 'عمل'] },
    { field: 'criminal_record',  docType: 'criminal_record',  label: 'فيش وتشبيه',      keywords: ['فيش', 'تشبيه', 'حسن سيرة', 'وزارة الداخلية'] }
  ];

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let membershipTypes = [];
  let selectedFiles = {};
  let fileCheckResults = {};
  let aiAnalysisResults = {};
  let isSubmitting = false;
  let draftSaveTimer = null;

  /* Camera state */
  let cameraStream = null;
  let cameraFacing = 'environment';
  let cameraTarget = null;
  let capturedBlob = null;

  /* Tesseract state */
  let tesseractLoaded = false;
  let tesseractWorker = null;

  /* ============================================
     DOM HELPERS
     ============================================ */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ============================================
     SVG ICONS
     ============================================ */
  const ICONS = {
    check: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    loader: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
    alert: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  /* ============================================
     ALERT BOX
     ============================================ */
  function setAlert(type, message) {
    const box = document.getElementById('alertBox');
    if (!box) return;

    const colors = {
      success: { bg: 'rgba(var(--success-rgb), 0.12)', border: 'var(--success)', text: 'var(--success)', icon: ICONS.check },
      error:   { bg: 'rgba(var(--danger-rgb), 0.12)',  border: 'var(--danger)',  text: 'var(--danger)',  icon: ICONS.x },
      warning: { bg: 'rgba(var(--warning-rgb), 0.12)', border: 'var(--warning)', text: 'var(--warning)', icon: ICONS.alert },
      info:    { bg: 'rgba(var(--accent-rgb), 0.1)',   border: 'var(--accent)',  text: 'var(--accent)',  icon: ICONS.info }
    };
    const c = colors[type] || colors.info;

    box.innerHTML = `
      <div class="alert" style="background:${c.bg};border-color:${c.border};color:${c.text};">
        <span style="width:18px;height:18px;display:inline-flex;flex-shrink:0;">${c.icon}</span>
        <span>${window.escapeHtml ? window.escapeHtml(message) : message}</span>
      </div>
    `;
  }

  function clearAlert() {
    const box = document.getElementById('alertBox');
    if (box) box.innerHTML = '';
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setButtonLoading(btn, text, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = `<span>${text}</span><span class="spinner"></span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ============================================
     LOAD TESSERACT
     ============================================ */
  function loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve();
        return;
      }

      const existing = document.querySelector('script[data-tesseract]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Tesseract')));
        return;
      }

      const script = document.createElement('script');
      script.src = TESSERACT_CDN;
      script.async = true;
      script.dataset.tesseract = 'true';
      script.onload = () => {
        tesseractLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Tesseract'));
      document.head.appendChild(script);
    });
  }

  /* ============================================
     AI OVERLAY
     ============================================ */
  function openAIOverlay(title) {
    const overlay = document.getElementById('aiOverlay');
    const t = document.getElementById('aiTitle');
    const s = document.getElementById('aiStatus');
    const p = document.getElementById('aiProgressFill');
    const r = document.getElementById('aiResult');
    const a = document.getElementById('aiActions');

    if (!overlay) return;

    if (t) t.textContent = title || 'جاري الفحص الذكي';
    if (s) s.textContent = 'بدء التحليل...';
    if (p) p.style.width = '0%';
    if (r) { r.className = 'ai-result'; r.innerHTML = ''; }
    if (a) a.style.display = 'none';

    overlay.classList.add('open');
  }

  function updateAIStatus(text) {
    const s = document.getElementById('aiStatus');
    if (s) s.textContent = text;
  }

  function updateAIProgress(pct) {
    const p = document.getElementById('aiProgressFill');
    if (p) p.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  function showAIResult(type, message) {
    const r = document.getElementById('aiResult');
    if (!r) return;
    r.className = 'ai-result show ' + type;
    r.innerHTML = message;
  }

  function closeAIOverlay() {
    const overlay = document.getElementById('aiOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function showAIActions() {
    const a = document.getElementById('aiActions');
    if (a) a.style.display = 'flex';
  }

  window.retakePhoto = function () {
    closeAIOverlay();
    // اعادة فتح الكاميرا على نفس الهدف
    if (cameraTarget) {
      setTimeout(() => openCamera(cameraTarget), 300);
    }
  };

  window.acceptPhoto = function () {
    if (!capturedBlob || !cameraTarget) {
      closeAIOverlay();
      return;
    }

    // حوّل الـ Blob لـ File
    const file = new File([capturedBlob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const field = cameraTarget;

    // ضع الملف في الـ input
    const input = document.querySelector(`input[name="${field}"]`);
    if (input) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (e) {
        console.warn('DataTransfer failed:', e);
      }
    }

    // خزنه في selectedFiles
    selectedFiles[field] = file;
    fileCheckResults[field] = { ok: true, status: 'pass' };

    // UI
    const wrapper = document.getElementById('upload-' + field);
    if (wrapper) {
      wrapper.classList.add('has-file');
      const filename = wrapper.querySelector('.filename');
      if (filename) {
        filename.textContent = `${file.name} (${window.formatFileSize ? window.formatFileSize(file.size) : Math.round(file.size/1024) + 'KB'})`;
      }
    }

    updateCheckUI(field, {
      status: 'pass',
      message: 'تم قبول الصورة بعد الفحص'
    });

    closeAIOverlay();
    capturedBlob = null;
    cameraTarget = null;

    if (window.showToast) {
      window.showToast('تم استخدام الصورة', 'success', 2000);
    }

    saveDraft();
  };

  /* ============================================
     CAMERA
     ============================================ */
  window.openCamera = async function (field) {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    const title = document.getElementById('cameraTitle');
    const hint = document.getElementById('cameraHint');

    if (!modal || !video) return;

    cameraTarget = field;
    capturedBlob = null;

    // عنوان حسب النوع
    const titles = {
      id_front: 'تصوير بطاقة الرقم القومي (وجه)',
      id_back: 'تصوير بطاقة الرقم القومي (ظهر)',
      certificate: 'تصوير الشهادة الدراسية',
      photo: 'تصوير الصورة الشخصية',
      work_certificate: 'تصوير شهادة إثبات العمل',
      criminal_record: 'تصوير الفيش والتشبيه'
    };
    if (title) title.textContent = titles[field] || 'التقاط صورة';

    // تلميح
    const hints = {
      id_front: 'ضع البطاقة داخل الإطار بحيث تظهر كل البيانات',
      id_back: 'ضع البطاقة داخل الإطار بحيث تظهر كل البيانات',
      certificate: 'ضع الشهادة داخل الإطار',
      photo: 'قف أمام الكاميرا في مكان مضيء',
      work_certificate: 'ضع الشهادة داخل الإطار',
      criminal_record: 'ضع الفيش داخل الإطار'
    };
    if (hint) hint.textContent = hints[field] || 'ضع المستند داخل الإطار';

    modal.classList.add('open');

    try {
      await startCamera();
    } catch (err) {
      console.error('Camera error:', err);
      if (window.showToast) {
        window.showToast('تعذّر الوصول للكاميرا: ' + err.message, 'error');
      }
      closeCamera();
    }
  };

  async function startCamera() {
    const video = document.getElementById('cameraVideo');
    if (!video) return;

    // اقفل الكاميرا القديمة
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }

    const constraints = {
      video: {
        facingMode: cameraFacing,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = cameraStream;
  }

  window.switchCamera = async function () {
    cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    try {
      await startCamera();
    } catch (err) {
      if (window.showToast) {
        window.showToast('تعذّر تبديل الكاميرا', 'error');
      }
    }
  };

  window.closeCamera = function () {
    const modal = document.getElementById('cameraModal');
    if (modal) modal.classList.remove('open');

    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }

    cameraTarget = null;
    capturedBlob = null;
  };

  window.capturePhoto = async function () {
    const video = document.getElementById('cameraVideo');
    if (!video || !cameraStream) return;

    // اعمل canvas للصورة
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // حوّل لـ Blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;

      capturedBlob = blob;

      // اقفل الكاميرا
      closeCamera();

      // شغّل الفحص الذكي
      await analyzeCapturedPhoto(blob, cameraTarget);
    }, 'image/jpeg', 0.92);
  };

  /* ============================================
     ANALYZE CAPTURED PHOTO (Tesseract)
     ============================================ */
  async function analyzeCapturedPhoto(blob, field) {
    if (!field) return;

    const docInfo = REQUIRED_DOCS.concat(OPTIONAL_DOCS).find(d => d.field === field);
    const docLabel = docInfo?.label || 'المستند';

    openAIOverlay('جاري فحص ' + docLabel);
    updateAIProgress(10);
    updateAIStatus('تحضير محرك الفحص...');

    try {
      // حمّل Tesseract
      await loadTesseract();

      updateAIProgress(25);
      updateAIStatus('قراءة النص من الصورة...');

      // حوّل الـ Blob لـ Image
      const img = await blobToImage(blob);

      // ابدأ الفحص
      const result = await window.Tesseract.recognize(
        img,
        'ara+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = 25 + (m.progress || 0) * 65;
              updateAIProgress(pct);
              updateAIStatus(`جاري قراءة النص... ${Math.round((m.progress || 0) * 100)}%`);
            } else if (m.status === 'loading language traineddata') {
              updateAIStatus('تحميل بيانات اللغة...');
            } else if (m.status === 'initializing api') {
              updateAIStatus('تهيئة المحرك...');
            }
          }
        }
      );

      updateAIProgress(95);
      updateAIStatus('تحليل النتائج...');

      const text = result?.data?.text || '';
      const confidence = result?.data?.confidence || 0;

      // تحقق من المحتوى
      const validation = validateDocument(field, text, confidence);

      updateAIProgress(100);

      if (validation.ok) {
        showAIResult('success', `
          <strong>✓ تم الفحص بنجاح</strong><br>
          <span style="font-size:12.5px;opacity:0.9;">
            ${validation.message}<br>
            نسبة الثقة: ${Math.round(confidence)}%
          </span>
        `);
        updateAIStatus('المستند صالح');

        // خزّن النتيجة
        aiAnalysisResults[field] = {
          ok: true,
          confidence: confidence,
          text: text,
          timestamp: new Date().toISOString()
        };

        // اعرض زر القبول
        setTimeout(() => {
          showAIActions();
        }, 600);
      } else {
        showAIResult('error', `
          <strong>✗ مشكلة في المستند</strong><br>
          <span style="font-size:12.5px;opacity:0.9;">
            ${validation.message}
          </span>
        `);
        updateAIStatus('يحتاج إعادة التصوير');
        showAIActions();
      }

    } catch (err) {
      console.error('[AI Analysis] Error:', err);
      showAIResult('warning', `
        <strong>⚠ تعذّر الفحص التلقائي</strong><br>
        <span style="font-size:12.5px;opacity:0.9;">
          يمكنك استخدام الصورة على أي حال، وسيتم فحصها من قبل اللجنة.
        </span>
      `);
      updateAIStatus('خطأ في الفحص');
      showAIActions();
    }
  }

  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  function validateDocument(field, text, confidence) {
    if (!text || text.trim().length < 10) {
      return {
        ok: false,
        message: 'الصورة لا تحتوي على نص واضح. تأكد من جودة التصوير.'
      };
    }

    if (confidence < 40) {
      return {
        ok: false,
        message: 'جودة الصورة منخفضة. حاول الإضاءة بشكل أفضل.'
      };
    }

    const docInfo = REQUIRED_DOCS.concat(OPTIONAL_DOCS).find(d => d.field === field);
    if (!docInfo) {
      return { ok: true, message: 'تم قبول المستند' };
    }

    // تحقق من الكلمات المفتاحية
    const keywords = docInfo.keywords || [];
    if (keywords.length > 0) {
      const normalizedText = text.replace(/\s+/g, ' ').trim();
      const found = keywords.some(kw => normalizedText.includes(kw));

      if (!found) {
        return {
          ok: false,
          message: `لم يتم التعرف على "${docInfo.label}" في الصورة. تأكد من التصوير الصحيح.`
        };
      }
    }

    // للبطاقة: تأكد إن فيه أرقام (رقم قومي)
    if (field === 'id_front') {
      const digits = (text.match(/\d+/g) || []).join('');
      if (digits.length < 14) {
        return {
          ok: false,
          message: 'لم يتم التعرف على الرقم القومي. تأكد من وضوح البطاقة.'
        };
      }
    }

    return {
      ok: true,
      message: 'المستند صالح وواضح'
    };
  }

  /* ============================================
     FILE UPLOADS (Drag & Drop + Click)
     ============================================ */
  function setupFileUploads() {
    const wrappers = $$('.file-upload');

    wrappers.forEach(wrapper => {
      const input = wrapper.querySelector('input[type=file]');
      if (!input) return;

      const fieldName = input.name;

      // Click (بس لو مش على زر الكاميرا)
      wrapper.addEventListener('click', (e) => {
        if (e.target.closest('.upload-actions')) return;
        input.click();
      });

      // File change
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
        wrapper.style.borderColor = 'var(--accent)';
        wrapper.style.background = 'rgba(var(--accent-rgb), 0.06)';
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
    aiAnalysisResults[fieldName] = null;
    updateCheckUI(fieldName, null);
  }

  async function handleFileSelected(wrapper, fieldName, file) {
    wrapper.classList.remove('has-file');
    const filename = wrapper.querySelector('.filename');
    if (filename) filename.textContent = '';

    // حجم
    if (file.size > MAX_FILE_SIZE) {
      updateCheckUI(fieldName, {
        status: 'fail',
        message: `حجم الملف كبير (${window.formatFileSize ? window.formatFileSize(file.size) : ''}). الحد الأقصى 10 ميجا.`
      });
      selectedFiles[fieldName] = null;
      return;
    }

    // نوع
    const isOptionalDoc = OPTIONAL_DOCS.some(d => d.field === fieldName);
    const isCert = fieldName === 'certificate' || isOptionalDoc;
    const allowed = isCert ? ALLOWED_DOC_TYPES : ALLOWED_IMAGE_TYPES;

    if (!allowed.includes(file.type)) {
      updateCheckUI(fieldName, {
        status: 'fail',
        message: isCert ? 'صيغة غير مدعومة — مسموح: JPG, PNG, PDF' : 'صيغة غير مدعومة — مسموح: JPG, PNG'
      });
      selectedFiles[fieldName] = null;
      return;
    }

    updateCheckUI(fieldName, { status: 'checking', message: 'جاري فحص الملف...' });

    // لو صورة → تحقق من الأبعاد + الفحص الذكي
    if (file.type.startsWith('image/')) {
      const dimCheck = await validateImageDimensions(file);
      if (!dimCheck.ok) {
        updateCheckUI(fieldName, { status: 'fail', message: dimCheck.message });
        selectedFiles[fieldName] = null;
        return;
      }

      // خزّن الملف
      selectedFiles[fieldName] = file;
      wrapper.classList.add('has-file');
      if (filename) {
        filename.textContent = `${file.name} (${window.formatFileSize ? window.formatFileSize(file.size) : ''})`;
      }

      // ابدأ الفحص الذكي
      setTimeout(() => {
        analyzeUploadedFile(file, fieldName);
      }, 300);

      updateCheckUI(fieldName, {
        status: 'checking',
        message: 'جاري الفحص الذكي...'
      });

    } else {
      // PDF → اقبل مباشرة
      selectedFiles[fieldName] = file;
      wrapper.classList.add('has-file');
      if (filename) {
        filename.textContent = `${file.name} (${window.formatFileSize ? window.formatFileSize(file.size) : ''})`;
      }

      updateCheckUI(fieldName, {
        status: 'pass',
        message: 'الملف جاهز للرفع'
      });

      saveDraft();
    }
  }

  function validateImageDimensions(file) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        URL.revokeObjectURL(url);

        if (w < MIN_IMAGE_WIDTH || h < MIN_IMAGE_HEIGHT) {
          resolve({
            ok: false,
            message: `دقة الصورة منخفضة (${w}×${h}). الحد الأدنى ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT}.`
          });
          return;
        }

        const ratio = w / h;
        if (ratio > 4 || ratio < 0.25) {
          resolve({
            ok: false,
            message: 'أبعاد الصورة غير مناسبة. استخدم صورة أوضح.'
          });
          return;
        }

        resolve({ ok: true });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ ok: false, message: 'الملف غير صالح أو تالف.' });
      };

      img.src = url;
    });
  }

  async function analyzeUploadedFile(file, field) {
    const docInfo = REQUIRED_DOCS.concat(OPTIONAL_DOCS).find(d => d.field === field);
    const docLabel = docInfo?.label || 'المستند';

    openAIOverlay('فحص ' + docLabel);
    updateAIProgress(10);
    updateAIStatus('تحضير محرك الفحص...');

    try {
      await loadTesseract();
      updateAIProgress(25);
      updateAIStatus('قراءة النص من الصورة...');

      const result = await window.Tesseract.recognize(
        file,
        'ara+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              const pct = 25 + (m.progress || 0) * 65;
              updateAIProgress(pct);
              updateAIStatus(`جاري قراءة النص... ${Math.round((m.progress || 0) * 100)}%`);
            }
          }
        }
      );

      updateAIProgress(95);
      updateAIStatus('تحليل النتائج...');

      const text = result?.data?.text || '';
      const confidence = result?.data?.confidence || 0;

      const validation = validateDocument(field, text, confidence);

      updateAIProgress(100);

      if (validation.ok) {
        showAIResult('success', `
          <strong>✓ تم الفحص بنجاح</strong><br>
          <span style="font-size:12.5px;opacity:0.9;">
            ${validation.message}<br>
            نسبة الثقة: ${Math.round(confidence)}%
          </span>
        `);
        updateAIStatus('المستند صالح');

        aiAnalysisResults[field] = {
          ok: true,
          confidence: confidence,
          text: text,
          timestamp: new Date().toISOString()
        };

        fileCheckResults[field] = { ok: true, status: 'pass' };

        // اقفل تلقائيًا بعد ثانيتين لو تمام
        setTimeout(() => {
          closeAIOverlay();
          updateCheckUI(field, {
            status: 'pass',
            message: 'تم الفحص ✓ المستند صالح'
          });
        }, 1800);

      } else {
        showAIResult('error', `
          <strong>✗ مشكلة في المستند</strong><br>
          <span style="font-size:12.5px;opacity:0.9;">
            ${validation.message}
          </span>
        `);
        updateAIStatus('يحتاج إعادة الرفع');
        showAIActions();

        fileCheckResults[field] = { ok: false, status: 'fail', message: validation.message };

        updateCheckUI(field, {
          status: 'fail',
          message: validation.message
        });
      }

    } catch (err) {
      console.error('[AI] Error:', err);
      showAIResult('warning', `
        <strong>⚠ تعذّر الفحص التلقائي</strong><br>
        <span style="font-size:12.5px;opacity:0.9;">
          سيتم فحص المستند من قبل اللجنة يدويًا.
        </span>
      `);
      updateAIStatus('خطأ في الفحص');
      showAIActions();

      // نعتبره "تحذير مش فشل" عشان مايمنعش الإرسال
      fileCheckResults[field] = { ok: true, status: 'warning' };

      updateCheckUI(field, {
        status: 'pass',
        message: 'سيتم فحصه يدويًا من اللجنة'
      });
    }
  }

  function updateCheckUI(fieldName, result) {
    const el = document.getElementById('check-' + fieldName);
    if (!el) return;

    if (!result) {
      el.className = 'ai-check';
      el.innerHTML = '';
      return;
    }

    const config = {
      checking: { cls: 'checking', icon: ICONS.loader, spin: true },
      pass:     { cls: 'pass',     icon: ICONS.check,  spin: false },
      fail:     { cls: 'fail',     icon: ICONS.x,      spin: false }
    };

    const c = config[result.status] || config.checking;

    el.className = 'ai-check ' + c.cls;
    el.innerHTML = `
      <span style="width:16px;height:16px;display:inline-flex;flex-shrink:0;${c.spin ? 'animation:spin 0.9s linear infinite;' : ''}">${c.icon}</span>
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
    if (!select || !client) return;

    const { data, error } = await client
      .from('membership_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      setAlert('error', 'فشل تحميل أنواع العضوية: ' + error.message);
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

    // Preselect من URL
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
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(var(--accent-rgb),0.06);border:1px solid rgba(var(--accent-rgb),0.25);border-radius:12px;margin-top:12px;">
        <span style="font-size:13px;color:var(--text-muted);">الرسوم السنوية</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:700;color:var(--accent);">
          ${fee} <span style="font-size:13px;font-weight:500;color:var(--text-muted);">جنيه</span>
        </span>
      </div>
    `;
  }

  /* ============================================
     VALIDATE FORM
     ============================================ */
  function validateForm() {
    const errors = [];
    const form = document.getElementById('applyForm');
    if (!form) return errors;

    const getVal = (name) => (form.querySelector(`[name="${name}"]`)?.value || '').trim();

    const fullName = getVal('full_name');
    const nationalId = getVal('national_id');
    const phone = getVal('phone');
    const email = getVal('email');
    const membershipType = getVal('membership_type_id');

    if (!fullName || fullName.length < 6) errors.push('الاسم الرباعي مطلوب (6 أحرف على الأقل)');
    if (!/^\d{14}$/.test(nationalId)) errors.push('الرقم القومي يجب أن يكون 14 رقم');
    if (!/^01[0125]\d{8}$/.test(phone)) errors.push('رقم الموبايل غير صحيح');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('البريد الإلكتروني غير صحيح');
    if (!membershipType) errors.push('اختر نوع العضوية');

    // لو مقيد في نقابة أخرى → لازم اسم النقابة
    const isOtherSyndicate = form.querySelector('input[name="is_other_syndicate"]:checked')?.value === 'yes';
    if (isOtherSyndicate) {
      const otherName = getVal('other_syndicate');
      if (!otherName || otherName.length < 3) {
        errors.push('اسم النقابة الأخرى مطلوب');
      }
    }

    // الملفات المطلوبة
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
        errors.push(`الملف "${fileLabels[f]}" فيه مشكلة — أعد رفعه`);
      }
    });

    // الإقرار
    const agree = document.getElementById('agreeTerms');
    if (agree && !agree.checked) errors.push('يجب الموافقة على الإقرار');

    return errors;
  }

  /* ============================================
     CHECK DUPLICATE
     ============================================ */
  async function checkDuplicate(nationalId) {
    const { data, error } = await client
      .from('applications')
      .select('id, tracking_no, status, created_at')
      .eq('national_id', nationalId)
      .in('status', [
        'pending', 'ai_review', 'under_review', 'needs_docs',
        'approved', 'awaiting_payment', 'paid',
        'awaiting_membership_no', 'membership_no_assigned',
        'card_processing', 'card_ready'
      ])
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) return null;
    if (data && data.length > 0) return data[0];
    return null;
  }

  /* ============================================
     SUBMIT
     ============================================ */
  async function submitForm(e) {
    e.preventDefault();
    if (isSubmitting) return;

    clearAlert();
    const errors = validateForm();

    if (errors.length > 0) {
      setAlert('error', errors[0] + (errors.length > 1 ? ` (و${errors.length - 1} أخطاء أخرى)` : ''));
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

      // 1) فحص التكرار
      setAlert('info', 'جاري التحقق من البيانات...');
      const duplicate = await checkDuplicate(nationalId);
      if (duplicate) {
        throw new Error(`يوجد طلب مسبق بنفس الرقم القومي — رقم التتبع: ${duplicate.tracking_no}`);
      }

      // 2) أنشئ الطلب
      setAlert('info', 'جاري إنشاء الطلب...');

      const isOtherSyndicate = form.querySelector('input[name="is_other_syndicate"]:checked')?.value === 'yes';

      const payload = {
        full_name: getVal('full_name'),
        national_id: nationalId,
        phone: getVal('phone'),
        email: getVal('email') || null,
        address: getVal('address') || null,
        qualification: getVal('qualification') || null,
        graduation_year: getVal('graduation_year') ? parseInt(getVal('graduation_year')) : null,
        grade: getVal('grade') || null,
        employer: getVal('employer') || null,
        job_title: getVal('job_title') || null,
        governorate: getVal('governorate') || null,
        membership_type_id: parseInt(getVal('membership_type_id')),
        is_other_syndicate: isOtherSyndicate,
        other_syndicate: isOtherSyndicate ? getVal('other_syndicate') : null,
        status: 'pending',
        ai_score: 0
      };

      const { data: appData, error: appError } = await client
        .from('applications')
        .insert([payload])
        .select()
        .single();

      if (appError) throw new Error('فشل إنشاء الطلب: ' + appError.message);

      const applicationId = appData.id;
      const trackingNo = appData.tracking_no;

      // 3) ارفع الملفات
      setAlert('info', 'جاري رفع المرفقات...');

      const allDocs = REQUIRED_DOCS.concat(OPTIONAL_DOCS);

      for (const docInfo of allDocs) {
        const file = selectedFiles[docInfo.field];
        if (!file) continue;

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${applicationId}/${docInfo.docType}_${Date.now()}.${ext}`;

        const { error: upErr } = await client.storage
          .from('attachments')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
          });

        if (upErr) {
          console.warn(`Upload failed for ${docInfo.field}:`, upErr);
          continue;
        }

        const isRequired = REQUIRED_DOCS.some(d => d.field === docInfo.field);
        const aiResult = aiAnalysisResults[docInfo.field];

        await client.from('attachments').insert([{
          application_id: applicationId,
          file_path: path,
          file_type: file.type,
          file_size: file.size,
          doc_type: docInfo.docType,
          is_required: isRequired,
          ai_verified: aiResult?.ok || false,
          ai_score: aiResult?.confidence || null,
          ai_notes: aiResult ? `ثقة: ${Math.round(aiResult.confidence)}%` : null
        }]);
      }

      // 4) احسب متوسط الـ AI Score
      const scores = Object.values(aiAnalysisResults).filter(r => r?.ok).map(r => r.confidence);
      if (scores.length > 0) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        await client
          .from('applications')
          .update({
            ai_score: avgScore,
            ai_verified: true,
            status: 'ai_review'
          })
          .eq('id', applicationId);
      }

      // 5) بيانات الإيصال
      const selectedTypeOpt = form.querySelector(`[name="membership_type_id"]`)?.selectedOptions[0];
      const membershipName = selectedTypeOpt?.dataset?.name || '';

      const receiptData = {
        tracking_no: trackingNo,
        application_id: applicationId,
        full_name: appData.full_name,
        national_id: appData.national_id,
        phone: appData.phone,
        membership_type: membershipName,
        membership_type_id: appData.membership_type_id,
        status: 'ai_review',
        created_at: appData.created_at
      };

      try {
        sessionStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(receiptData));
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (err) {}

      setAlert('success', 'تم استلام طلبك بنجاح، جاري التحويل للإيصال...');

      setTimeout(() => {
        window.location.href = 'receipt.html';
      }, 800);

    } catch (err) {
      console.error('[Apply] Error:', err);
      setAlert('error', err.message || 'حدث خطأ غير متوقع');
      scrollToTop();
      isSubmitting = false;
      setButtonLoading(btn, 'إرسال الطلب', false);
    }
  }

  /* ============================================
     DRAFT
     ============================================ */
  function saveDraft() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      try {
        const form = document.getElementById('applyForm');
        if (!form) return;

        const data = {};
        form.querySelectorAll('input, select, textarea').forEach(el => {
          if (el.type === 'file' || el.type === 'checkbox' || el.type === 'radio') return;
          if (!el.name) return;
          data[el.name] = el.value;
        });

        // راديو نقابة أخرى
        const otherRadio = form.querySelector('input[name="is_other_syndicate"]:checked');
        if (otherRadio) data.is_other_syndicate = otherRadio.value;

        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          data,
          savedAt: new Date().toISOString()
        }));

        // مؤشر الحفظ
        const indicator = document.getElementById('draftIndicator');
        if (indicator) {
          indicator.style.opacity = '1';
          clearTimeout(window.__draftHideTimer);
          window.__draftHideTimer = setTimeout(() => {
            indicator.style.opacity = '0';
          }, 2000);
        }
      } catch (e) {}
    }, 600);
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed?.data) return;

      // تحقق من العمر (24 ساعة)
      const savedAt = new Date(parsed.savedAt).getTime();
      if (Date.now() - savedAt > 24 * 60 * 60 * 1000) return;

      const form = document.getElementById('applyForm');
      if (!form) return;

      Object.entries(parsed.data).forEach(([name, value]) => {
        if (name === 'is_other_syndicate') {
          const radio = form.querySelector(`input[name="is_other_syndicate"][value="${value}"]`);
          if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
        } else {
          const el = form.querySelector(`[name="${name}"]`);
          if (el && el.type !== 'file' && el.type !== 'checkbox') {
            el.value = value || '';
          }
        }
      });

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

      await loadMembershipTypes();
      setupFileUploads();
      restoreDraft();
      setupDraftAutosave();

      const form = document.getElementById('applyForm');
      if (form) form.addEventListener('submit', submitForm);

      // Realtime
      if (window.Realtime) {
        window.Realtime.watch('membership_types', () => loadMembershipTypes());
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

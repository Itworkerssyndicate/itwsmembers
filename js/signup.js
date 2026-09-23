/* =====================================================
   IT SYNDICATE — SIGNUP LOGIC
   Version: 1.0.0
   Path: js/signup.js
   =====================================================
   يحتوي على:
   - تحميل قايمة المحافظات
   - تحقق كامل من الفورم
   - إنشاء مستخدم في Supabase Auth
   - إضافة سجل في جدول users (is_active = FALSE)
   - عرض Success State
   - Audit Log
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let governorates = [];
  let isSubmitting = false;

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

  function showToast(message, type) {
    type = type || 'info';
    if (window.showToast) {
      window.showToast(message, type);
      return;
    }
    console.log('[' + type + '] ' + message);
  }

  function setButtonLoading(btn, text, loading) {
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.dataset.originalHtml = btn.innerHTML;
      btn.innerHTML = '<span>' + text + '</span><span class="spinner"></span>';
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
        delete btn.dataset.originalHtml;
      }
    }
  }

  /* ============================================
     LOAD GOVERNORATES
     ============================================ */
  async function loadGovernorates() {
    const select = document.getElementById('governorate_id');
    if (!select || !client) return;

    try {
      const { data, error } = await client
        .from('governorates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      governorates = data || [];
      select.innerHTML = '<option value="">-- اختر المحافظة --</option>';

      governorates.forEach(function(g) {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.name;
        select.appendChild(opt);
      });

    } catch (err) {
      console.warn('[Signup] Load governorates error:', err.message);
    }
  }

  /* ============================================
     WAIT FOR SUPABASE
     ============================================ */
  function waitForSupabase() {
    return new Promise(function(resolve) {
      if (window.supabaseClient) {
        resolve(window.supabaseClient);
        return;
      }

      if (typeof window.onSupabaseReady === 'function') {
        window.onSupabaseReady(function(c) { resolve(c); });
        setTimeout(function() { resolve(window.supabaseClient || null); }, 5000);
      } else {
        const start = Date.now();
        const check = setInterval(function() {
          if (window.supabaseClient) {
            clearInterval(check);
            resolve(window.supabaseClient);
          } else if (Date.now() - start > 5000) {
            clearInterval(check);
            resolve(null);
          }
        }, 100);
      }
    });
  }

  /* ============================================
     VALIDATE FORM
     ============================================ */
  function validateForm() {
    const errors = [];

    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const role = document.getElementById('role').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password_confirm').value;
    const agree = document.getElementById('agreeTerms').checked;
    const govId = document.getElementById('governorate_id').value;

    // الاسم
    if (!fullName || fullName.length < 6) {
      errors.push('الاسم الكامل مطلوب (6 أحرف على الأقل)');
    }

    // البريد
    if (!email) {
      errors.push('البريد الإلكتروني مطلوب');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('صيغة البريد الإلكتروني غير صحيحة');
    }

    // الموبايل
    if (!phone) {
      errors.push('رقم الموبايل مطلوب');
    } else if (!/^01[0125]\d{8}$/.test(phone)) {
      errors.push('رقم الموبايل غير صحيح');
    }

    // الدور
    if (!role) {
      errors.push('اختر الدور المطلوب');
    }

    // المحافظة (للأدوار اللي محتاجاها)
    const needsGov = ['governorate_head', 'governorate_board'].indexOf(role) !== -1;
    if (needsGov && !govId) {
      errors.push('اختر المحافظة (مطلوبة لهذا الدور)');
    }

    // الباسورد
    if (!password) {
      errors.push('كلمة المرور مطلوبة');
    } else if (password.length < 6) {
      errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }

    // تأكيد الباسورد
    if (password !== passwordConfirm) {
      errors.push('كلمتا المرور غير متطابقتين');
    }

    // الإقرار
    if (!agree) {
      errors.push('يجب الموافقة على الشروط والأحكام');
    }

    return errors;
  }

  /* ============================================
     TRANSLATE AUTH ERRORS
     ============================================ */
  function translateAuthError(msg) {
    if (!msg) return 'حدث خطأ غير متوقع';
    const m = msg.toLowerCase();

    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
      return 'هذا البريد مسجل بالفعل — جرب تسجيل الدخول';
    }
    if (m.includes('invalid email')) {
      return 'البريد الإلكتروني غير صحيح';
    }
    if (m.includes('password')) {
      return 'كلمة المرور ضعيفة جدًا — استخدم 6 أحرف على الأقل';
    }
    if (m.includes('too many requests') || m.includes('rate limit')) {
      return 'محاولات كثيرة — حاول بعد قليل';
    }
    if (m.includes('network')) {
      return 'فشل الاتصال — تحقق من الإنترنت';
    }
    return msg;
  }

  /* ============================================
     SUBMIT HANDLER
     ============================================ */
  async function submitForm(e) {
    e.preventDefault();

    if (isSubmitting) return;

    // مسح التنبيهات القديمة
    if (window.clearSignupAlert) window.clearSignupAlert();

    // التحقق
    const errors = validateForm();
    if (errors.length > 0) {
      if (window.showSignupAlert) {
        window.showSignupAlert('error', errors[0] + (errors.length > 1 ? ' (و' + (errors.length - 1) + ' أخطاء أخرى)' : ''));
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    isSubmitting = true;
    const btn = document.getElementById('signupBtn');
    setButtonLoading(btn, 'جاري الإرسال...', true);

    try {
      // 1) انتظر Supabase
      const c = await waitForSupabase();
      if (!c) {
        throw new Error('فشل تحميل النظام — حاول تحديث الصفحة');
      }
      client = c;

      // 2) جمع البيانات
      const fullName = document.getElementById('full_name').value.trim();
      const email = document.getElementById('email').value.trim().toLowerCase();
      const phone = document.getElementById('phone').value.trim();
      const role = document.getElementById('role').value;
      const position = document.getElementById('position').value.trim();
      const password = document.getElementById('password').value;
      const govId = document.getElementById('governorate_id').value;

      // 3) إنشاء المستخدم في Supabase Auth
      if (window.showSignupAlert) {
        window.showSignupAlert('info', 'جاري إنشاء الحساب...');
      }

      const tempClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_KEY,
        { auth: { persistSession: false } }
      );

      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin + '/login.html'
        }
      });

      if (signUpErr) {
        throw new Error(translateAuthError(signUpErr.message));
      }

      const newUserId = signUpData && signUpData.user ? signUpData.user.id : null;
      if (!newUserId) {
        throw new Error('فشل إنشاء الحساب — حاول مرة أخرى');
      }

      // 4) إضافة سجل في جدول users
      if (window.showSignupAlert) {
        window.showSignupAlert('info', 'جاري حفظ البيانات...');
      }

      const userPayload = {
        id: newUserId,
        email: email,
        full_name: fullName,
        phone: phone,
        role: role,
        position: position || null,
        governorate_id: govId ? parseInt(govId) : null,
        is_active: false,
        registration_source: 'self_signup',
        signup_notes: 'تسجيل ذاتي — بانتظار التفعيل من النقيب العام',
        created_at: new Date().toISOString()
      };

      const { error: insertErr } = await client
        .from('users')
        .upsert([userPayload], { onConflict: 'id' });

      if (insertErr) {
        try {
          await tempClient.auth.admin.deleteUser(newUserId);
        } catch (e) {}
        throw new Error('فشل حفظ البيانات: ' + insertErr.message);
      }

      // 5) تسجيل الإجراء في user_actions
      try {
        await client.from('user_actions').insert([{
          user_id: newUserId,
          user_email: email,
          action: 'self_signup',
          entity: 'users',
          entity_id: newUserId,
          details: 'تسجيل حساب جديد — دور: ' + role,
          created_at: new Date().toISOString()
        }]);
      } catch (e) {}

      // 6) عرض Success State
      const form = document.getElementById('signupForm');
      const successState = document.getElementById('successState');
      const loginLink = document.getElementById('loginLink');

      if (form) form.style.display = 'none';
      if (successState) successState.classList.add('show');
      if (loginLink) loginLink.style.display = 'none';

      if (window.clearSignupAlert) window.clearSignupAlert();

      window.scrollTo({ top: 0, behavior: 'smooth' });

      launchConfetti();

      console.log('[Signup] Success — User ID:', newUserId);

    } catch (err) {
      console.error('[Signup] Error:', err);
      if (window.showSignupAlert) {
        window.showSignupAlert('error', err.message || 'حدث خطأ غير متوقع');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      isSubmitting = false;
      setButtonLoading(btn, 'إرسال الطلب', false);
    }
  }

  /* ============================================
     CONFETTI
     ============================================ */
  function launchConfetti() {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}

    const colors = ['#00f0ff', '#b026ff', '#00ff9d', '#ffb800', '#e62e2e'];
    const count = 40;

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(container);

    for (let i = 0; i < count; i++) {
      const piece = document.createElement('span');
      const size = 6 + Math.random() * 8;
      piece.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        top: -20px;
        left: ${Math.random() * 100}%;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        opacity: 0.9;
        animation: signupConfetti ${2.5 + Math.random() * 2}s linear ${Math.random() * 0.6}s forwards;
      `;
      container.appendChild(piece);
    }

    if (!document.getElementById('signupConfettiStyle')) {
      const style = document.createElement('style');
      style.id = 'signupConfettiStyle';
      style.textContent = `
        @keyframes signupConfetti {
          to {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(function() {
      if (container.parentNode) container.parentNode.removeChild(container);
    }, 6000);
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (typeof window.onSupabaseReady !== 'function') {
      setTimeout(init, 100);
      return;
    }

    window.onSupabaseReady(async function(c) {
      client = c;

      // تحميل المحافظات
      await loadGovernorates();

      // ربط الفورم
      const form = document.getElementById('signupForm');
      if (form) {
        form.addEventListener('submit', submitForm);
      }

      // Realtime للمحافظات
      if (window.Realtime) {
        window.Realtime.watch('governorates', function() {
          loadGovernorates();
        }, { debounceMs: 600 });
      }

      console.log('[Signup] Ready');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

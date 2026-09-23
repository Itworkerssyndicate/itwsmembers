/* =====================================================
   IT SYNDICATE — SETTINGS MANAGER
   Version: 3.2.0
   Path: js/settings.js
   =====================================================
   يحتوي على:
   - تحميل الإعدادات من Supabase
   - تطبيقها على DOM (data-setting / data-site-name / ...)
   - مزامنة Realtime خفيفة
   - تخزين مؤقت في localStorage
   - منع applyToDom المتكرر (hash)
   - دعم about_card + features_cards
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONFIG
     ============================================ */
  const STORAGE_KEY = 'its_site_settings';
  const LOGO_KEY = 'its_logo_url';
  const HEAD_PHOTO_KEY = 'its_head_photo_url';

  /* ============================================
     STATE
     ============================================ */
  let settings = {};
  let isLoaded = false;
  let isFreshLoaded = false;
  let loadPromise = null;
  let realtimeSetup = false;
  let lastApplyHash = '';

  /* ============================================
     HELPERS
     ============================================ */
  function hashSettings(s) {
    if (!s) return '';
    try {
      const keys = Object.keys(s).sort();
      return keys.map(k => `${k}=${String(s[k] ?? '')}`).join('|');
    } catch (e) {
      return String(Date.now());
    }
  }

  function setTextIfChanged(el, newText) {
    if (!el) return;
    const t = String(newText ?? '');
    if (el.textContent !== t) {
      el.textContent = t;
    }
  }

  function setAttrIfChanged(el, attr, val) {
    if (!el) return;
    if (el.getAttribute(attr) !== val) {
      el.setAttribute(attr, val);
    }
  }

  /* ============================================
     APPLY TO DOM
     ============================================ */
  function applyToDom(s) {
    if (!s) return;

    // منع applyToDom المتكرر بنفس القيم
    const newHash = hashSettings(s);
    if (newHash === lastApplyHash) {
      window.dispatchEvent(new CustomEvent('settings-applied', { detail: { settings: s } }));
      return;
    }
    lastApplyHash = newHash;

    /* ==========================================
       Site Name
       ========================================== */
    document.querySelectorAll('[data-site-name]').forEach(el => {
      if (s.site_name) setTextIfChanged(el, s.site_name);
    });

    document.querySelectorAll('[data-site-name-en]').forEach(el => {
      if (s.site_name_en) setTextIfChanged(el, s.site_name_en);
    });

    /* ==========================================
       Page Title
       ========================================== */
    if (s.site_name) {
      const parts = document.title.split(' — ');
      const baseTitle = parts[0] || document.title;
      const newTitle = baseTitle.includes(s.site_name) ? document.title : `${baseTitle} — ${s.site_name}`;
      if (document.title !== newTitle) {
        document.title = newTitle;
      }
    }

    /* ==========================================
       Logo
       ========================================== */
    if (s.site_logo_url) {
      // Nav logo
      const navImg = document.getElementById('navLogoImg');
      const navFallback = document.getElementById('navLogoFallback');
      if (navImg) {
        if (navImg.dataset.currentSrc !== s.site_logo_url) {
          navImg.dataset.currentSrc = s.site_logo_url;
          navImg.onload = () => {
            navImg.style.display = '';
            if (navFallback) navFallback.style.display = 'none';
          };
          navImg.onerror = () => {
            navImg.style.display = 'none';
            if (navFallback) navFallback.style.display = '';
          };
          navImg.src = s.site_logo_url;
        }
      }

      // data-logo
      document.querySelectorAll('[data-logo]').forEach(el => {
        if (el.tagName === 'IMG') {
          if (el.dataset.currentSrc !== s.site_logo_url) {
            el.dataset.currentSrc = s.site_logo_url;
            el.src = s.site_logo_url;
          }
          el.style.display = '';
        }
      });

      // Logo IDs
      const logoIds = [
        'logoImg', 'aboutLogoImg', 'footerLogoImg',
        'brandLogoImg', 'receiptLogoImg'
      ];
      logoIds.forEach(id => {
        const img = document.getElementById(id);
        const fb = document.getElementById(id.replace('Img', 'Fallback'));
        if (img) {
          if (img.dataset.currentSrc !== s.site_logo_url) {
            img.dataset.currentSrc = s.site_logo_url;
            img.onload = () => {
              img.style.display = '';
              if (fb) fb.style.display = 'none';
            };
            img.onerror = () => {
              img.style.display = 'none';
              if (fb) fb.style.display = '';
            };
            img.src = s.site_logo_url;
          }
        }
      });

      // Favicon
      const fav = document.getElementById('faviconLink');
      const apple = document.getElementById('appleTouchIcon');
      if (fav) {
        setAttrIfChanged(fav, 'type', 'image/png');
        setAttrIfChanged(fav, 'href', s.site_logo_url);
      }
      if (apple) {
        setAttrIfChanged(apple, 'href', s.site_logo_url);
      }
    }

    /* ==========================================
       Head Info
       ========================================== */
    document.querySelectorAll('[data-head-name]').forEach(el => {
      if (s.head_name) setTextIfChanged(el, s.head_name);
    });

    document.querySelectorAll('[data-head-title]').forEach(el => {
      if (s.head_title) setTextIfChanged(el, s.head_title);
    });

    document.querySelectorAll('[data-head-message]').forEach(el => {
      if (s.head_message) {
        setTextIfChanged(el, s.head_message);
        el.style.display = 'block';
      }
    });

    if (s.head_photo_url) {
      document.querySelectorAll('[data-head-photo]').forEach(el => {
        if (el.tagName === 'IMG') {
          if (el.dataset.currentSrc !== s.head_photo_url) {
            el.dataset.currentSrc = s.head_photo_url;
            el.src = s.head_photo_url;
          }
          el.style.display = '';
        }
      });

      const headImg = document.getElementById('headPhotoImg');
      const headFallback = document.getElementById('headPhotoFallback');
      if (headImg) {
        if (headImg.dataset.currentSrc !== s.head_photo_url) {
          headImg.dataset.currentSrc = s.head_photo_url;
          headImg.onload = () => {
            headImg.style.display = '';
            if (headFallback) headFallback.style.display = 'none';
          };
          headImg.onerror = () => {
            headImg.style.display = 'none';
            if (headFallback) headFallback.style.display = '';
          };
          headImg.src = s.head_photo_url;
        }
      }
    }

    /* ==========================================
       Contact
       ========================================== */
    document.querySelectorAll('[data-contact-email]').forEach(el => {
      if (s.contact_email) {
        setTextIfChanged(el, s.contact_email);
        if (el.tagName === 'A') setAttrIfChanged(el, 'href', `mailto:${s.contact_email}`);
      }
    });

    document.querySelectorAll('[data-contact-phone]').forEach(el => {
      if (s.contact_phone) {
        setTextIfChanged(el, s.contact_phone);
        if (el.tagName === 'A') setAttrIfChanged(el, 'href', `tel:${s.contact_phone}`);
      }
    });

    document.querySelectorAll('[data-contact-address]').forEach(el => {
      if (s.contact_address) setTextIfChanged(el, s.contact_address);
    });

    /* ==========================================
       Footer
       ========================================== */
    document.querySelectorAll('[data-footer-text]').forEach(el => {
      if (s.footer_text) setTextIfChanged(el, s.footer_text);
    });

    document.querySelectorAll('[data-footer-description]').forEach(el => {
      if (s.footer_description) setTextIfChanged(el, s.footer_description);
    });

    const footerBtn = document.getElementById('footerButton');
    if (footerBtn) {
      if (s.footer_button_name && s.footer_button_url) {
        setTextIfChanged(footerBtn, s.footer_button_name);
        setAttrIfChanged(footerBtn, 'href', s.footer_button_url);
        footerBtn.style.display = 'inline-flex';
      } else {
        footerBtn.style.display = 'none';
      }
    }

    /* ==========================================
       Hero
       ========================================== */
    const setText = (sel, val) => {
      if (!val) return;
      document.querySelectorAll(sel).forEach(el => setTextIfChanged(el, val));
    };

    setText('[data-hero-badge]', s.hero_badge);
    setText('[data-hero-title-1]', s.hero_title_1);
    setText('[data-hero-title-2]', s.hero_title_2);
    setText('[data-hero-description]', s.hero_description);

    const heroBtn1 = document.getElementById('heroBtn1');
    const heroBtn2 = document.getElementById('heroBtn2');
    if (heroBtn1 && s.hero_btn1_url) setAttrIfChanged(heroBtn1, 'href', s.hero_btn1_url);
    if (heroBtn2 && s.hero_btn2_url) setAttrIfChanged(heroBtn2, 'href', s.hero_btn2_url);

    /* ==========================================
       Code Card
       ========================================== */
    setText('[data-code-card-name]', s.code_card_name);
    setText('[data-code-card-status]', s.code_card_status);

    const codeCardBody = document.getElementById('codeCardBody');
    if (codeCardBody && s.code_card_content) {
      setTextIfChanged(codeCardBody, s.code_card_content);
    }

    /* ==========================================
       Section Titles
       ========================================== */
    setText('[data-types-title]', s.types_title);
    setText('[data-types-subtitle]', s.types_subtitle);

    setText('[data-steps-title]', s.steps_title);
    setText('[data-steps-subtitle]', s.steps_subtitle);

    for (let i = 1; i <= 4; i++) {
      setText(`[data-step${i}-title]`, s[`step${i}_title`]);
      setText(`[data-step${i}-desc]`, s[`step${i}_desc`]);
    }

    /* ==========================================
       CTA
       ========================================== */
    setText('[data-cta-title]', s.cta_title);
    setText('[data-cta-subtitle]', s.cta_subtitle);

    const ctaBtn = document.getElementById('ctaBtn');
    if (ctaBtn && s.cta_btn_url) setAttrIfChanged(ctaBtn, 'href', s.cta_btn_url);

    /* ==========================================
       Terms
       ========================================== */
    setText('[data-terms-text]', s.terms_text);

    /* ==========================================
       ⚡ GENERIC: [data-setting] — النمط العام
       ========================================== */
    document.querySelectorAll('[data-setting]').forEach(el => {
      const key = el.dataset.setting;
      if (!key || !(key in s)) return;

      const val = s[key];
      const tag = el.tagName;

      // صور
      if (tag === 'IMG' && (key.endsWith('_url') || key.endsWith('_logo') || key.endsWith('_photo'))) {
        if (el.dataset.currentSrc !== val) {
          el.dataset.currentSrc = val;
          el.src = val;
        }
        return;
      }

      // Checkbox
      if (el.type === 'checkbox') {
        const shouldCheck = val === true || val === 'true' || val === '1';
        if (el.checked !== shouldCheck) el.checked = shouldCheck;
        return;
      }

      // Inputs / Textareas / Selects
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // متلمسش اللي المستخدم بيكتب فيه دلوقتي
        if (document.activeElement === el) return;
        const strVal = String(val ?? '');
        if (el.value !== strVal) el.value = strVal;
        return;
      }

      // عناصر نصية
      const newText = String(val ?? '');
      if (el.textContent.trim() !== newText.trim()) {
        el.textContent = newText;
      }
    });

    /* ==========================================
       ⚡ data-site-name-en (النمط الأصلي)
       ========================================== */
    document.querySelectorAll('[data-site-name-en]').forEach(el => {
      if (s.site_name_en) setTextIfChanged(el, s.site_name_en);
    });

    /* ==========================================
       ⚡ data-setting="site_name_en" (نمط home.html)
       ========================================== */
    document.querySelectorAll('[data-setting="site_name_en"]').forEach(el => {
      if (s.site_name_en) setTextIfChanged(el, s.site_name_en);
    });

    /* ==========================================
       ⚡ About Card — شعار القسم
       ========================================== */
    const aboutLogo = s.about_card_logo;
    if (aboutLogo) {
      const aboutImg = document.getElementById('aboutLogoImg');
      const aboutFb = document.getElementById('aboutLogoFallback');
      if (aboutImg) {
        if (aboutImg.dataset.currentSrc !== aboutLogo) {
          aboutImg.dataset.currentSrc = aboutLogo;
          aboutImg.onload = () => {
            aboutImg.style.display = 'block';
            if (aboutFb) aboutFb.style.display = 'none';
          };
          aboutImg.onerror = () => {
            aboutImg.style.display = 'none';
            if (aboutFb) aboutFb.style.display = 'block';
          };
          aboutImg.src = aboutLogo;
        }
      }
    }

    /* ==========================================
       ⚡ Features Cards — عنوان القسم
       ========================================== */
    if (s.features_title) {
      document.querySelectorAll('[data-features-title]').forEach(el => {
        setTextIfChanged(el, s.features_title);
      });
    }
    if (s.features_subtitle) {
      document.querySelectorAll('[data-features-subtitle]').forEach(el => {
        setTextIfChanged(el, s.features_subtitle);
      });
    }

    /* ==========================================
       ⚡ Health Care
       ========================================== */
    if (s.health_care_enabled === 'false' || s.health_care_enabled === false) {
      document.querySelectorAll('[data-health-care-section]').forEach(el => {
        el.style.display = 'none';
      });
    }

    /* ==========================================
       ⚡ Maintenance Mode
       ========================================== */
    const isMaintenance = s.maintenance_mode === 'true' || s.maintenance_mode === true;
    if (isMaintenance) {
      const page = window.location.pathname.split('/').pop();
      const isPublicPage = ['index.html', 'home.html', ''].includes(page);
      const isStaff = window.currentUserRole && window.currentUserRole !== 'anon';
      if (isPublicPage && !isStaff) {
        document.querySelectorAll('[data-maintenance-banner]').forEach(el => {
          el.style.display = 'block';
        });
      }
    }

    /* ==========================================
       Dispatch Events
       ========================================== */
    window.dispatchEvent(new CustomEvent('settings-applied', { detail: { settings: s } }));
  }

  /* ============================================
     LOAD SETTINGS
     ============================================ */
  async function load(force = false) {
    if (!force && isLoaded && Object.keys(settings).length > 0) {
      return settings;
    }

    if (loadPromise && !force) {
      return loadPromise;
    }

    loadPromise = (async () => {
      try {
        /* 1) Cache first */
        if (!force) {
          try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && typeof parsed === 'object') {
                settings = parsed;
                applyToDom(settings);
              }
            }
          } catch (e) {}
        }

        /* 2) Fetch from Supabase */
        if (typeof window.getAllSettings !== 'function') {
          await waitForSupabase();
        }

        if (typeof window.getAllSettings === 'function') {
          const fresh = await window.getAllSettings();
          if (fresh && Object.keys(fresh).length > 0) {
            settings = fresh;
            applyToDom(settings);
            isLoaded = true;
            isFreshLoaded = true;

            // Cache
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
            } catch (e) {}

            // Dispatch settings-ready
            window.dispatchEvent(new CustomEvent('settings-ready', {
              detail: { settings }
            }));
          }
        }

        return settings;
      } catch (e) {
        console.warn('[Settings] Load failed:', e.message);
        return settings;
      } finally {
        loadPromise = null;
      }
    })();

    return loadPromise;
  }

  function waitForSupabase() {
    return new Promise((resolve) => {
      if (window.supabaseClient) {
        resolve();
        return;
      }
      if (typeof window.onSupabaseReady === 'function') {
        window.onSupabaseReady(() => resolve());
      } else {
        window.addEventListener('supabase-ready', () => resolve(), { once: true });
        setTimeout(resolve, 3000);
      }
    });
  }

  /* ============================================
     GETTERS
     ============================================ */
  function get(key, fallback = null) {
    return (key in settings) ? settings[key] : fallback;
  }

  function getAll() {
    return { ...settings };
  }

  /* ============================================
     REALTIME
     ============================================ */
  function setupRealtime() {
    if (realtimeSetup) return;

    // نستخدم window.Realtime
    if (!window.Realtime || typeof window.Realtime.watch !== 'function') {
      setTimeout(setupRealtime, 500);
      return;
    }

    realtimeSetup = true;

    try {
      window.Realtime.watch('settings', async () => {
        if (typeof window.clearSettingsCache === 'function') {
          window.clearSettingsCache();
        }
        isLoaded = false;
        await load(true);
      }, { debounceMs: 800 });
    } catch (e) {
      console.warn('[Settings] Realtime setup failed:', e.message);
      realtimeSetup = false;
    }
  }

  /* ============================================
     INIT
     ============================================ */
  async function init() {
    // 1) Load from cache أولاً
    await load();

    // 2) Realtime
    setupRealtime();

    // 3) Sync from Supabase (مرة واحدة)
    const doFreshLoad = () => {
      if (!isFreshLoaded) {
        load(true);
      }
    };

    if (typeof window.onSupabaseReady === 'function') {
      window.onSupabaseReady(doFreshLoad);
    } else {
      window.addEventListener('supabase-ready', doFreshLoad, { once: true });
    }
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.SettingsManager = {
    load,
    get,
    getAll,
    apply: applyToDom,
    _settings: () => settings,
    _isLoaded: () => isLoaded,
    _isFreshLoaded: () => isFreshLoaded
  };

  // Shortcut
  window.getSiteSetting = get;

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

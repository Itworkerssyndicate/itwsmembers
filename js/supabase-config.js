/* =====================================================
   IT SYNDICATE — Supabase Configuration
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONFIG
     ============================================ */
  const SUPABASE_URL = 'https://zenhokbsuxgiyptmdphs.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_uh_nhMGHE5OoO4VI097w_g_-64KUF80';

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let ready = false;
  const readyCallbacks = [];
  let currentSessionId = null;
  let sessionStartTime = null;

  /* ============================================
     LOAD SUPABASE LIBRARY
     ============================================ */
  function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
      if (window.supabase && window.supabase.createClient) {
        return resolve();
      }

      const existing = document.querySelector('script[data-supabase-lib]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Supabase')));
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async = true;
      script.dataset.supabaseLib = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Supabase library'));
      document.head.appendChild(script);
    });
  }

  /* ============================================
     INIT CLIENT
     ============================================ */
  async function initClient() {
    try {
      await loadSupabaseLibrary();

      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library not available');
      }

      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'its_auth_token'
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        },
        global: {
          headers: {
            'x-application-name': 'IT-Syndicate'
          }
        }
      });

      // Expose globally
      window.supabaseClient = client;
      window.SUPABASE_URL = SUPABASE_URL;
      window.SUPABASE_KEY = SUPABASE_KEY;
      ready = true;

      // Fire callbacks
      readyCallbacks.forEach(cb => {
        try { cb(client); } catch (e) { console.error('Callback error:', e); }
      });
      readyCallbacks.length = 0;

      // Dispatch event
      window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client } }));

      // Init session tracking
      initSessionTracking();

    } catch (err) {
      console.error('[Supabase] Init failed:', err);
      window.dispatchEvent(new CustomEvent('supabase-error', { detail: { error: err } }));
    }
  }

  /* ============================================
     SESSION TRACKING
     ============================================ */
  async function initSessionTracking() {
    if (!client) return;

    try {
      const { data } = await client.auth.getSession();
      if (data?.session?.user) {
        await startSession();
      }

      // Listen for auth changes
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await startSession();
          // Update last_login_at
          try {
            await client
              .from('users')
              .update({ last_login_at: new Date().toISOString() })
              .eq('id', session.user.id);
          } catch (e) {}
        } else if (event === 'SIGNED_OUT') {
          await endSession();
        }
      });
    } catch (e) {
      console.warn('[Session] Init failed:', e);
    }

    // End session on page unload
    window.addEventListener('beforeunload', () => {
      endSession();
    });
  }

  async function startSession() {
    if (!client) return;

    try {
      const { data } = await client.auth.getSession();
      const user = data?.session?.user;
      if (!user) return;

      sessionStartTime = Date.now();

      const { data: sessionData, error } = await client
        .from('user_sessions')
        .insert([{
          user_id: user.id,
          login_at: new Date().toISOString(),
          user_agent: navigator.userAgent.substring(0, 255),
          device: getDeviceInfo(),
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.warn('[Session] Start failed:', error.message);
        return;
      }

      currentSessionId = sessionData?.id || null;
      try {
        localStorage.setItem('its_session_id', currentSessionId);
      } catch (e) {}
    } catch (e) {
      console.warn('[Session] Start error:', e);
    }
  }

  async function endSession() {
    if (!client || !currentSessionId) return;

    try {
      const duration = sessionStartTime
        ? Math.round((Date.now() - sessionStartTime) / 1000)
        : null;

      await client
        .from('user_sessions')
        .update({
          logout_at: new Date().toISOString(),
          duration_seconds: duration,
          is_active: false
        })
        .eq('id', currentSessionId);

      try {
        localStorage.removeItem('its_session_id');
      } catch (e) {}

      currentSessionId = null;
    } catch (e) {}
  }

  function getDeviceInfo() {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'Mobile';
    if (/tablet/i.test(ua)) return 'Tablet';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone/i.test(ua)) return 'iPhone';
    return 'Desktop';
  }

  /* ============================================
     PUBLIC: onSupabaseReady
     ============================================ */
  window.onSupabaseReady = function (callback) {
    if (typeof callback !== 'function') return;

    if (ready && client) {
      try { callback(client); } catch (e) { console.error('Callback error:', e); }
    } else {
      readyCallbacks.push(callback);
    }
  };

  /* ============================================
     PUBLIC: getSupabase
     ============================================ */
  window.getSupabase = function () {
    return client;
  };

  /* ============================================
     HELPERS
     ============================================ */

  /* Format date to Arabic */
  window.formatDateAr = function (date) {
    if (!date) return '---';
    try {
      return new Date(date).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '---';
    }
  };

  /* Format date short */
  window.formatDateShort = function (date) {
    if (!date) return '---';
    try {
      return new Date(date).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (e) {
      return '---';
    }
  };

  /* Format time */
  window.formatTime = function (date) {
    if (!date) return '---';
    try {
      return new Date(date).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '---';
    }
  };

  /* Escape HTML */
  window.escapeHtml = function (str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  /* Validate national ID */
  window.validateNationalId = function (id) {
    if (!id) return false;
    return /^\d{14}$/.test(String(id).trim());
  };

  /* Validate phone */
  window.validatePhone = function (phone) {
    if (!phone) return false;
    return /^01[0125]\d{8}$/.test(String(phone).trim());
  };

  /* Validate email */
  window.validateEmail = function (email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  };

  /* Generate tracking number (client preview) */
  window.generateTrackingNumber = function () {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    return `ITS-${yyyy}-${rand}`;
  };

  /* Toast notification */
  window.showToast = function (message, type = 'info', duration = 3500) {
    type = type || 'info';

    const existing = document.getElementById('itsToast');
    if (existing) existing.remove();

    const colors = {
      success: { bg: 'rgba(0, 255, 157, 0.15)', border: '#00ff9d', text: '#00ff9d' },
      error:   { bg: 'rgba(255, 85, 85, 0.15)', border: '#ff5555', text: '#ff5555' },
      warning: { bg: 'rgba(255, 184, 0, 0.15)', border: '#ffb800', text: '#ffb800' },
      info:    { bg: 'rgba(0, 240, 255, 0.15)', border: '#00f0ff', text: '#00f0ff' }
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.id = 'itsToast';
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-30px);
      z-index: 99999;
      background: ${c.bg};
      border: 1.5px solid ${c.border};
      color: ${c.text};
      padding: 14px 22px;
      border-radius: 12px;
      font-family: 'Cairo', 'Tajawal', sans-serif;
      font-size: 14px;
      font-weight: 600;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px ${c.border}33;
      max-width: 90%;
      text-align: center;
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-30px)';
      setTimeout(() => toast.remove(), 400);
    }, duration);
  };

  /* Debounce */
  window.debounce = function (fn, delay = 300) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  };

  /* Throttle */
  window.throttle = function (fn, limit = 300) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit);
      }
    };
  };

  /* Copy to clipboard */
  window.copyToClipboard = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      window.showToast('تم النسخ', 'success', 2000);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        window.showToast('تم النسخ', 'success', 2000);
        return true;
      } catch (err) {
        window.showToast('فشل النسخ', 'error', 2000);
        return false;
      } finally {
        ta.remove();
      }
    }
  };

  /* File size formatter */
  window.formatFileSize = function (bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  /* Truncate */
  window.truncate = function (str, len = 40) {
    if (!str) return '';
    str = String(str);
    return str.length > len ? str.slice(0, len) + '...' : str;
  };

  /* Initials */
  window.getInitials = function (name) {
    if (!name) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + ' ' + parts[parts.length - 1].charAt(0);
  };

  /* ============================================
     AUTH HELPERS
     ============================================ */
  window.getCurrentSession = async function () {
    if (!client) return null;
    try {
      const { data } = await client.auth.getSession();
      return data?.session || null;
    } catch (e) {
      return null;
    }
  };

  window.getCurrentUser = async function () {
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user || null;
    } catch (e) {
      return null;
    }
  };

  window.signOut = async function (redirect = 'login.html') {
    if (!client) return;
    try {
      await endSession();
      await client.auth.signOut();
      window.location.href = redirect;
    } catch (e) {
      console.error('Sign out failed:', e);
      window.location.href = redirect;
    }
  };

  window.requireAuth = async function (redirect = 'login.html') {
    const session = await window.getCurrentSession();
    if (!session) {
      window.location.href = redirect;
      return null;
    }
    return session;
  };

  /* Get user role */
  window.getUserRole = async function () {
    if (!client) return null;
    try {
      const user = await window.getCurrentUser();
      if (!user) return null;

      const { data, error } = await client
        .from('users')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) return null;
      return data || null;
    } catch (e) {
      return null;
    }
  };

  /* Log user action */
  window.logUserAction = async function (action, entity, entityId, details) {
    if (!client) return;
    try {
      const user = await window.getCurrentUser();
      if (!user) return;

      await client.from('user_actions').insert([{
        user_id: user.id,
        user_email: user.email,
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        details,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {}
  };

  /* ============================================
     START
     ============================================ */
  initClient();

})();

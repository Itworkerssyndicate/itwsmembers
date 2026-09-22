/* =====================================================
   IT SYNDICATE — SUPABASE CONFIG
   Version: 3.0.0
   =====================================================
   يحتوي على:
   - تهيئة Supabase Client
   - دعم الـ CDN الرسمي
   - Helpers عامة (escapeHtml / formatDate / debounce ...)
   - Auth helpers (getSession / signOut / getCurrentUser)
   - Storage helpers (upload / remove / getPublicUrl / signedUrl)
   - Role helpers (isAdmin / hasRole / getUserRole)
   - Global Init + onSupabaseReady
   - Error handling + logging
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONFIG
     ============================================ */
  const SUPABASE_URL = 'https://zenhokbsuxgiyptmdphs.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_uh_nhMGHE5OoO4VI097w_g_-64KUF80';
  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  const CDN_TIMEOUT = 10000;

  /* ============================================
     GLOBAL STATE
     ============================================ */
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  let clientInstance = null;
  let readyCallbacks = [];
  let isReady = false;

  /* ============================================
     LOAD SUPABASE CDN (if not loaded)
     ============================================ */
  function loadSupabaseCDN() {
    return new Promise((resolve, reject) => {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        resolve();
        return;
      }

      const existing = document.querySelector('script[data-supabase-cdn]');
      if (existing) {
        if (window.supabase) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Failed to load Supabase CDN')));
        return;
      }

      const script = document.createElement('script');
      script.src = SUPABASE_CDN;
      script.async = true;
      script.dataset.supabaseCdn = 'true';

      const timeout = setTimeout(() => {
        reject(new Error('Supabase CDN timeout'));
      }, CDN_TIMEOUT);

      script.onload = () => {
        clearTimeout(timeout);
        if (window.supabase) resolve();
        else reject(new Error('Supabase not found after CDN load'));
      };

      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Supabase CDN failed to load'));
      };

      document.head.appendChild(script);
    });
  }

  /* ============================================
     INIT CLIENT
     ============================================ */
  function createClient() {
    if (clientInstance) return clientInstance;

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase library not loaded');
    }

    clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'its_auth_token',
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-application-name': 'its-syndicate-web'
        }
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });

    window.supabaseClient = clientInstance;
    return clientInstance;
  }

  /* ============================================
     READY CALLBACK
     ============================================ */
  function registerReady(callback) {
    if (typeof callback !== 'function') return;

    if (isReady && clientInstance) {
      try {
        callback(clientInstance);
      } catch (e) {
        console.error('[onSupabaseReady] Callback error:', e);
      }
      return;
    }

    readyCallbacks.push(callback);
  }

  window.onSupabaseReady = registerReady;

  function fireReady() {
    isReady = true;
    const cbs = readyCallbacks.slice();
    readyCallbacks = [];
    cbs.forEach(cb => {
      try {
        cb(clientInstance);
      } catch (e) {
        console.error('[onSupabaseReady] Fire error:', e);
      }
    });

    window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { client: clientInstance } }));
  }

  /* ============================================
     INIT
     ============================================ */
  async function init() {
    try {
      await loadSupabaseCDN();

      const client = createClient();

      // Authenticate: refresh session if exists
      try {
        const { data } = await client.auth.getSession();
        if (data?.session) {
          window.dispatchEvent(new CustomEvent('supabase-auth-ready', {
            detail: { session: data.session }
          }));
        }
      } catch (e) {
        console.warn('[Supabase] Session check failed:', e.message);
      }

      fireReady();

      console.log('[Supabase] Client initialized');
    } catch (err) {
      console.error('[Supabase] Init failed:', err);
      window.dispatchEvent(new CustomEvent('supabase-init-error', {
        detail: { error: err }
      }));
    }
  }

  /* ============================================
     GLOBAL HELPERS
     ============================================ */

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

  /* Format Date (Arabic) */
  window.formatDate = function (dateStr, options) {
    if (!dateStr) return '---';
    try {
      const opts = options || {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return new Date(dateStr).toLocaleString('ar-EG', opts);
    } catch (e) {
      return '---';
    }
  };

  /* Format Date Short */
  window.formatDateShort = function (dateStr) {
    return window.formatDate(dateStr, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  /* Time Ago */
  window.timeAgo = function (dateStr) {
    if (!dateStr) return '';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const m = Math.floor(diff / 60000);
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(diff / 86400000);
      if (m < 1) return 'الآن';
      if (m < 60) return `منذ ${m} دقيقة`;
      if (h < 24) return `منذ ${h} ساعة`;
      if (d < 30) return `منذ ${d} يوم`;
      return window.formatDate(dateStr);
    } catch (e) {
      return '';
    }
  };

  /* Format File Size */
  window.formatFileSize = function (bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  };

  /* Format Money */
  window.formatMoney = function (amount, currency) {
    if (amount === null || amount === undefined || amount === '') return '—';
    const num = parseFloat(amount);
    if (isNaN(num)) return '—';
    const symbol = currency || 'ج';
    return num.toLocaleString('ar-EG') + ' ' + symbol;
  };

  /* Get Initials */
  window.getInitials = function (name) {
    if (!name) return '؟';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 0) return '؟';
    if (parts.length === 1) return parts[0].charAt(0);
    return parts[0].charAt(0) + ' ' + parts[1].charAt(0);
  };

  /* Debounce */
  window.debounce = function (fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay || 300);
    };
  };

  /* Throttle */
  window.throttle = function (fn, limit) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => { inThrottle = false; }, limit || 300);
      }
    };
  };

  /* Copy to clipboard */
  window.copyToClipboard = async function (text) {
    if (!text) return false;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return true;
      }
    } catch (e) {
      return false;
    }
  };

  /* ============================================
     TOAST (Global)
     ============================================ */
  window.showToast = function (message, type = 'info', duration = 3000) {
    let container = document.getElementById('globalToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'globalToastContainer';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
        max-width: calc(100vw - 32px);
      `;
      document.body.appendChild(container);
    }

    const colors = {
      success: { bg: 'rgba(0, 255, 157, 0.15)', border: 'rgba(0, 255, 157, 0.6)', text: '#00ff9d' },
      error:   { bg: 'rgba(255, 85, 85, 0.15)',  border: 'rgba(255, 85, 85, 0.6)',  text: '#ff5555' },
      warning: { bg: 'rgba(255, 184, 0, 0.15)',  border: 'rgba(255, 184, 0, 0.6)',  text: '#ffb800' },
      info:    { bg: 'rgba(0, 240, 255, 0.12)',  border: 'rgba(0, 240, 255, 0.5)',  text: '#00f0ff' }
    };

    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.style.cssText = `
      background: ${c.bg};
      border: 1.5px solid ${c.border};
      color: ${c.text};
      padding: 12px 22px;
      border-radius: 12px;
      font-family: 'Cairo', sans-serif;
      font-size: 13.5px;
      font-weight: 700;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      text-align: center;
      max-width: 480px;
      word-break: break-word;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, duration);
  };

  /* ============================================
     AUTH HELPERS
     ============================================ */
  window.getCurrentUser = async function () {
    if (!clientInstance) return null;
    try {
      const { data } = await clientInstance.auth.getUser();
      return data?.user || null;
    } catch (e) {
      return null;
    }
  };

  window.getCurrentSession = async function () {
    if (!clientInstance) return null;
    try {
      const { data } = await clientInstance.auth.getSession();
      return data?.session || null;
    } catch (e) {
      return null;
    }
  };

  window.signOut = async function (redirectTo) {
    if (!clientInstance) return;
    try {
      await clientInstance.auth.signOut();
    } catch (e) {
      console.warn('[signOut]', e.message);
    }

    try {
      localStorage.removeItem('its_auth_token');
      localStorage.removeItem('its_remember_email');
    } catch (e) {}

    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  /* ============================================
     ROLE HELPERS
     ============================================ */
  window.getUserRole = async function () {
    if (!clientInstance) return null;
    try {
      const user = await window.getCurrentUser();
      if (!user) return null;

      const { data } = await clientInstance
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      return data?.role || null;
    } catch (e) {
      return null;
    }
  };

  window.hasRole = function (allowedRoles) {
    const role = window.currentUserRole;
    if (!role) return false;
    if (typeof allowedRoles === 'string') return role === allowedRoles;
    if (Array.isArray(allowedRoles)) return allowedRoles.includes(role);
    return false;
  };

  window.isAdmin = function () {
    return window.hasRole(['head', 'vice_president', 'deputy']);
  };

  /* ============================================
     STORAGE HELPERS
     ============================================ */
  window.uploadFile = async function (bucket, path, file, options) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const opts = options || {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    };
    const { data, error } = await clientInstance.storage
      .from(bucket)
      .upload(path, file, opts);
    if (error) throw error;
    return data;
  };

  window.removeFile = async function (bucket, paths) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const arr = Array.isArray(paths) ? paths : [paths];
    const { data, error } = await clientInstance.storage.from(bucket).remove(arr);
    if (error) throw error;
    return data;
  };

  window.getPublicUrl = function (bucket, path) {
    if (!clientInstance) return '';
    const { data } = clientInstance.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || '';
  };

  window.getSignedUrl = async function (bucket, path, expiresIn) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const { data, error } = await clientInstance.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn || 3600);
    if (error) throw error;
    return data?.signedUrl || '';
  };

  /* ============================================
     DB HELPERS
     ============================================ */
  window.dbSelect = async function (table, options) {
    if (!clientInstance) throw new Error('Supabase not ready');
    let query = clientInstance.from(table).select(options?.select || '*');
    if (options?.eq) {
      Object.entries(options.eq).forEach(([k, v]) => {
        query = query.eq(k, v);
      });
    }
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending !== false });
    }
    if (options?.limit) query = query.limit(options.limit);
    if (options?.single) query = query.maybeSingle();
    const { data, error } = await query;
    if (error) throw error;
    return data;
  };

  window.dbInsert = async function (table, payload) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const arr = Array.isArray(payload) ? payload : [payload];
    const { data, error } = await clientInstance.from(table).insert(arr).select();
    if (error) throw error;
    return data;
  };

  window.dbUpdate = async function (table, id, payload, idColumn) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const col = idColumn || 'id';
    const { data, error } = await clientInstance.from(table).update(payload).eq(col, id).select();
    if (error) throw error;
    return data;
  };

  window.dbDelete = async function (table, id, idColumn) {
    if (!clientInstance) throw new Error('Supabase not ready');
    const col = idColumn || 'id';
    const { error } = await clientInstance.from(table).delete().eq(col, id);
    if (error) throw error;
    return true;
  };

  /* ============================================
     SETTINGS HELPER
     ============================================ */
  window.getSetting = async function (key, defaultValue) {
    if (!clientInstance) return defaultValue ?? null;
    try {
      const { data } = await clientInstance
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
      return data?.value ?? defaultValue ?? null;
    } catch (e) {
      return defaultValue ?? null;
    }
  };

  window.getAllSettings = async function () {
    if (!clientInstance) return {};
    try {
      const { data } = await clientInstance.from('settings').select('key, value');
      const map = {};
      (data || []).forEach(row => {
        map[row.key] = row.value;
      });
      return map;
    } catch (e) {
      return {};
    }
  };

  /* ============================================
     AUDIT LOG
     ============================================ */
  window.logAudit = async function (action, entity, entityId, oldValue, newValue) {
    if (!clientInstance) return;
    try {
      const user = await window.getCurrentUser();
      await clientInstance.from('audit_log').insert([{
        user_id: user?.id || null,
        user_email: user?.email || 'unknown',
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        old_value: oldValue ? JSON.stringify(oldValue) : null,
        new_value: newValue ? JSON.stringify(newValue) : null,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      console.warn('[logAudit]', e.message);
    }
  };

  window.logUserAction = async function (action, entity, entityId, details) {
    if (!clientInstance) return;
    try {
      const user = await window.getCurrentUser();
      if (!user) return;
      await clientInstance.from('user_actions').insert([{
        user_id: user.id,
        user_email: user.email,
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        details: details || null,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {}
  };

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also try immediately if DOM is already loaded
  setTimeout(() => {
    if (!isReady && !clientInstance) {
      init().catch(() => {});
    }
  }, 100);

})();

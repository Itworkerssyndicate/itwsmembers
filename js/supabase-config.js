/* ============================================
   SUPABASE-CONFIG.JS
   IT Workers Syndicate — v3.0.0
   Path: js/supabase-config.js
   Heart of the system: Supabase client + helpers
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     1. CONFIG
     ============================================ */
  const SUPABASE_URL = window.SUPABASE_URL || 'YOUR_SUPABASE_URL';
  const SUPABASE_KEY = window.SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY';

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] CDN not loaded! Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }

  /* ============================================
     2. CLIENT
     ============================================ */
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'its-auth'
    },
    realtime: { params: { eventsPerSecond: 10 } }
  });

  window.sb = sb;

  /* ============================================
     3. CONSTANTS
     ============================================ */
  const ROLES = {
    HEAD: 'head',
    VICE_PRESIDENT: 'vice_president',
    DEPUTY: 'deputy',
    COMMITTEE: 'committee',
    GOVERNORATE_HEAD: 'governorate_head',
    GOVERNORATE_BOARD: 'governorate_board',
    BRANCHES_MANAGER: 'branches_manager',
    SOCIAL_HEAD: 'social_committee_head',
    SOCIAL_VICE: 'social_committee_vice',
    PR_HEAD: 'public_relations_head',
    PR_VICE: 'public_relations_vice',
    CM_HEAD: 'committees_manager_head',
    CM_VICE: 'committees_manager_vice'
  };

  const ROLE_LABELS = {
    head: 'النقيب العام',
    vice_president: 'نائب رئيس النقابة',
    deputy: 'الوكيل',
    committee: 'لجنة العضوية',
    governorate_head: 'نقيب محافظة',
    governorate_board: 'مجلس محافظة',
    branches_manager: 'مدير الفروع',
    social_committee_head: 'رئيس اللجنة الاجتماعية',
    social_committee_vice: 'نائب اللجنة الاجتماعية',
    public_relations_head: 'رئيس العلاقات العامة',
    public_relations_vice: 'نائب العلاقات العامة',
    committees_manager_head: 'مدير اللجان',
    committees_manager_vice: 'نائب مدير اللجان'
  };

  const STATUS = {
    PENDING: 'pending',
    AI_REVIEW: 'ai_review',
    UNDER_REVIEW: 'under_review',
    APPROVED: 'approved',
    AWAITING_PAYMENT: 'awaiting_payment',
    PAYMENT_UNDER_REVIEW: 'payment_under_review',
    PAID: 'paid',
    AWAITING_MEMBERSHIP_NO: 'awaiting_membership_no',
    MEMBERSHIP_NO_ASSIGNED: 'membership_no_assigned',
    CARD_READY: 'card_ready',
    DELIVERED: 'delivered',
    REJECTED: 'rejected'
  };

  const STATUS_LABELS = {
    pending: 'قيد الانتظار',
    ai_review: 'فحص تلقائي',
    under_review: 'تحت المراجعة',
    approved: 'موافقة مبدئية',
    awaiting_payment: 'بانتظار الدفع',
    payment_under_review: 'الدفع تحت المراجعة',
    paid: 'تم الدفع',
    awaiting_membership_no: 'بانتظار رقم العضوية',
    membership_no_assigned: 'تم تعيين رقم العضوية',
    card_ready: 'الكارنية جاهز',
    delivered: 'تم التسليم',
    rejected: 'مرفوض'
  };

  const BUCKETS = {
    ATTACHMENTS: 'attachments',
    BRANDING: 'branding',
    CARDS: 'cards',
    AVATARS: 'avatars'
  };

  window.ROLES = ROLES;
  window.ROLE_LABELS = ROLE_LABELS;
  window.STATUS = STATUS;
  window.STATUS_LABELS = STATUS_LABELS;
  window.BUCKETS = BUCKETS;

  /* ============================================
     4. AUTH HELPERS
     ============================================ */
  let _cachedUser = null;
  let _cacheTime = 0;
  const CACHE_TTL = 5000;

  async function getCurrentUser(force = false) {
    const now = Date.now();
    if (!force && _cachedUser && (now - _cacheTime) < CACHE_TTL) {
      return _cachedUser;
    }

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) return null;

      const { data: profile, error } = await sb
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) console.warn('getCurrentUser profile:', error);

      const user = {
        ...session.user,
        ...(profile || {}),
        id: session.user.id,
        email: session.user.email,
        role: profile?.role || 'guest',
        status: profile?.status || 'active'
      };

      _cachedUser = user;
      _cacheTime = now;
      return user;
    } catch (e) {
      console.error('getCurrentUser:', e);
      return null;
    }
  }
  window.getCurrentUser = getCurrentUser;

  function clearUserCache() { _cachedUser = null; _cacheTime = 0; }
  window.clearUserCache = clearUserCache;

  async function isLoggedIn() {
    const { data: { session } } = await sb.auth.getSession();
    return !!session?.user;
  }
  window.isLoggedIn = isLoggedIn;

  async function requireRole(allowed = []) {
    const user = await getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    if (!allowed.length) return true;
    if (!allowed.includes(user.role)) {
      if (typeof window.toast === 'function') toast('ليس لديك صلاحية', 'error');
      setTimeout(() => window.location.href = 'home.html', 1200);
      return false;
    }
    return true;
  }
  window.requireRole = requireRole;

  async function requireAuth() {
    const ok = await isLoggedIn();
    if (!ok) {
      const back = encodeURIComponent(window.location.pathname.split('/').pop());
      window.location.href = `login.html?redirect=${back}`;
      return false;
    }
    return true;
  }
  window.requireAuth = requireAuth;

  async function logout() {
    try {
      await sb.auth.signOut();
      clearUserCache();
    } catch (e) { console.error('logout:', e); }
    window.location.href = 'login.html';
  }
  window.logout = logout;

  /* ============================================
     5. ROLE CHECKS
     ============================================ */
  async function hasRole(role) {
    const u = await getCurrentUser();
    if (!u) return false;
    if (Array.isArray(role)) return role.includes(u.role);
    return u.role === role;
  }
  window.hasRole = hasRole;

  async function isHead()      { return hasRole(['head', 'vice_president', 'deputy']); }
  async function isCommittee() { return hasRole(['committee']); }
  async function isGovHead()   { return hasRole(['governorate_head']); }
  async function isGovBoard()  { return hasRole(['governorate_head', 'governorate_board']); }
  async function isBranchesManager() { return hasRole(['branches_manager']); }
  async function isSocialCommittee() { return hasRole(['social_committee_head', 'social_committee_vice']); }
  async function isPublicRelations() { return hasRole(['public_relations_head', 'public_relations_vice']); }
  async function isCommitteesManager() { return hasRole(['committees_manager_head', 'committees_manager_vice']); }
  async function isStaff() {
    return hasRole(['head', 'vice_president', 'deputy', 'committee', 'governorate_head', 'governorate_board', 'branches_manager']);
  }

  window.isHead = isHead;
  window.isCommittee = isCommittee;
  window.isGovHead = isGovHead;
  window.isGovBoard = isGovBoard;
  window.isBranchesManager = isBranchesManager;
  window.isSocialCommittee = isSocialCommittee;
  window.isPublicRelations = isPublicRelations;
  window.isCommitteesManager = isCommitteesManager;
  window.isStaff = isStaff;

  /* ============================================
     6. STORAGE HELPERS
     ============================================ */
  async function uploadFile(bucket, path, file, options = {}) {
    const { data, error } = await sb.storage
      .from(bucket)
      .upload(path, file, { upsert: true, cacheControl: '3600', ...options });
    if (error) throw error;
    return data;
  }
  window.uploadFile = uploadFile;

  function getPublicUrl(bucket, path) {
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || '';
  }
  window.getPublicUrl = getPublicUrl;

  async function deleteFile(bucket, path) {
    const { error } = await sb.storage.from(bucket).remove([path]);
    if (error) throw error;
    return true;
  }
  window.deleteFile = deleteFile;

  async function uploadAndGetUrl(bucket, file, prefix = '') {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `${prefix}${prefix ? '_' : ''}${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await uploadFile(bucket, path, file);
    return { path, url: getPublicUrl(bucket, path) };
  }
  window.uploadAndGetUrl = uploadAndGetUrl;

  /* ============================================
     7. SETTINGS HELPERS
     ============================================ */
  let _settingsCache = null;
  let _settingsTime = 0;

  async function getAllSettings(force = false) {
    const now = Date.now();
    if (!force && _settingsCache && (now - _settingsTime) < 30000) return _settingsCache;

    const { data, error } = await sb.from('settings').select('key, value');
    if (error) throw error;

    const map = {};
    (data || []).forEach(r => { map[r.key] = r.value; });
    _settingsCache = map;
    _settingsTime = now;
    return map;
  }
  window.getAllSettings = getAllSettings;

  async function getSetting(key, defaultValue = null) {
    try {
      const all = await getAllSettings();
      return (key in all) ? all[key] : defaultValue;
    } catch { return defaultValue; }
  }
  window.getSetting = getSetting;

  async function setSetting(key, value) {
    const { error } = await sb.from('settings').upsert({ key, value }, { onConflict: 'key' });
    if (error) throw error;
    if (_settingsCache) _settingsCache[key] = value;
    return true;
  }
  window.setSetting = setSetting;

  function clearSettingsCache() { _settingsCache = null; _settingsTime = 0; }
  window.clearSettingsCache = clearSettingsCache;

  /* ============================================
     8. UTILS
     ============================================ */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  window.escapeHtml = escapeHtml;
  window.esc = escapeHtml;

  function formatDate(d, withTime = true) {
    if (!d) return '—';
    try {
      const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
      if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
      return new Date(d).toLocaleString('ar-EG', opts);
    } catch { return '—'; }
  }
  window.formatDate = formatDate;

  function formatCurrency(n) {
    const num = Number(n) || 0;
    return num.toLocaleString('ar-EG') + ' ج.م';
  }
  window.formatCurrency = formatCurrency;

  function roleLabel(r) { return ROLE_LABELS[r] || r || '—'; }
  window.roleLabel = roleLabel;

  function statusLabel(s) { return STATUS_LABELS[s] || s || '—'; }
  window.statusLabel = statusLabel;

  function debounce(fn, wait = 300) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
  window.debounce = debounce;

  function throttle(fn, wait = 300) {
    let last = 0;
    return function (...args) {
      const now = Date.now();
      if (now - last >= wait) { last = now; fn.apply(this, args); }
    };
  }
  window.throttle = throttle;

  /* ============================================
     9. TOAST (fallback)
     ============================================ */
  if (typeof window.toast !== 'function') {
    window.toast = function (msg, type = 'info') {
      const colors = {
        success: '#22c55e',
        error:   '#ef4444',
        warning: '#f59e0b',
        info:    '#00f0ff'
      };
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        padding: '14px 22px',
        background: 'rgba(10,12,20,0.95)',
        border: `1.5px solid ${colors[type] || colors.info}`,
        color: colors[type] || colors.info,
        borderRadius: '12px',
        fontFamily: 'Cairo, sans-serif',
        fontSize: '13.5px',
        fontWeight: '700',
        zIndex: '99999',
        boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${colors[type] || colors.info}40`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s',
        opacity: '0',
        transform: 'translateY(20px)'
      });
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => el.remove(), 300);
      }, 3200);
    };
  }

  /* ============================================
     10. ERROR HANDLER
     ============================================ */
  window.handleError = function (e, context = '') {
    console.error(`[${context}]`, e);
    const msg = e?.message || e?.error_description || 'حدث خطأ غير متوقع';
    if (typeof window.toast === 'function') toast(msg, 'error');
    return msg;
  };

  /* ============================================
     11. SESSION TRACKING
     ============================================ */
  async function trackSession() {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      await sb.from('user_sessions').upsert({
        user_id: user.id,
        user_name: user.full_name || user.email,
        role: user.role,
        last_seen: new Date().toISOString(),
        device: navigator.userAgent.slice(0, 120)
      }, { onConflict: 'user_id' });
    } catch (e) { /* silent */ }
  }
  window.trackSession = trackSession;

  async function trackAction(action, details = null, entity = null, entityId = null) {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      await sb.from('user_actions').insert({
        user_id: user.id,
        user_name: user.full_name || user.email,
        role: user.role,
        action, details, entity, entity_id: entityId
      });
    } catch (e) { /* silent */ }
  }
  window.trackAction = trackAction;

  /* ============================================
     12. AUTH STATE LISTENER
     ============================================ */
  sb.auth.onAuthStateChange((event, session) => {
    clearUserCache();
    if (event === 'SIGNED_OUT') {
      _cachedUser = null;
      const protectedPages = ['admin.html','dashboard.html','members.html','revenue.html',
        'subscriptions.html','head-approval.html','branches.html','governorate.html',
        'social-committee.html','public-relations.html','committees-manager.html','profile.html'];
      const current = window.location.pathname.split('/').pop();
      if (protectedPages.includes(current)) window.location.href = 'login.html';
    }
  });

  /* ============================================
     13. READY
     ============================================ */
  console.log('%c⚡ IT Syndicate', 'color:#00f0ff;font-weight:bold;font-size:14px;', 'Supabase ready');

  window.dispatchEvent(new CustomEvent('supabase:ready'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackSession);
  } else {
    trackSession();
  }

})();

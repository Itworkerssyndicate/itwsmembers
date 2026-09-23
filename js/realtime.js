/* =====================================================
   IT SYNDICATE — REALTIME ENGINE
   Version: 3.1.0
   Path: js/realtime.js
   =====================================================
   يوفر:
   - watch()       : مراقبة جدول واحد
   - watchMany()   : مراقبة عدة جداول
   - unwatch()     : إيقاف مراقبة جدول
   - unwatchAll()  : إيقاف كل المراقبات
   - sendBroadcast(): إرسال حدث لباقي التابات
   - onBroadcast() : الاستماع لأحداث التابات
   - Debounce ذكي لمنع refresh المتكرر
   - دعم governorate_subscriptions تلقائيًا
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  const channels = new Map();       // key -> channel object
  const debounceTimers = new Map(); // key -> timeout id
  const broadcastListeners = new Map(); // event -> Set of callbacks

  let broadcastChannel = null;
  let client = null;
  let isReady = false;
  let initRetries = 0;
  const MAX_INIT_RETRIES = 50;

  /* ============================================
     HELPERS
     ============================================ */
  function safeString(v) {
    try {
      return String(v ?? '');
    } catch (e) {
      return '';
    }
  }

  function makeKey(table, filter) {
    if (!filter) return `rt:${table}`;
    const parts = Object.keys(filter)
      .sort()
      .map(k => `${k}=${safeString(filter[k])}`)
      .join('&');
    return `rt:${table}?${parts}`;
  }

  function debounce(key, fn, ms) {
    const delay = Math.max(50, Number(ms) || 300);
    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
    }
    const t = setTimeout(() => {
      debounceTimers.delete(key);
      try {
        fn();
      } catch (e) {
        console.error(`[Realtime] debounced callback error (${key}):`, e);
      }
    }, delay);
    debounceTimers.set(key, t);
  }

  function log(...args) {
    // console.log('[Realtime]', ...args);
  }

  function warn(...args) {
    console.warn('[Realtime]', ...args);
  }

  /* ============================================
     BROADCAST CHANNEL
     ============================================ */
  function initBroadcast() {
    if (broadcastChannel) return broadcastChannel;
    if (!client) return null;

    try {
      broadcastChannel = client.channel('its-broadcast', {
        config: {
          broadcast: { self: false }
        }
      });

      broadcastChannel
        .on('broadcast', { event: '*' }, (payload) => {
          const eventName = payload?.event || payload?.type || '*';
          const data = payload?.payload ?? payload?.data ?? {};

          log('broadcast received:', eventName, data);

          const listeners = broadcastListeners.get(eventName);
          if (listeners) {
            listeners.forEach(cb => {
              try { cb(data, eventName); } catch (e) {}
            });
          }

          const globalListeners = broadcastListeners.get('*');
          if (globalListeners) {
            globalListeners.forEach(cb => {
              try { cb(data, eventName); } catch (e) {}
            });
          }
        })
        .subscribe((status) => {
          log('broadcast channel status:', status);
        });

      return broadcastChannel;
    } catch (e) {
      warn('initBroadcast failed:', e);
      broadcastChannel = null;
      return null;
    }
  }

  /* ============================================
     CORE: WATCH
     ============================================ */
  function watch(table, callback, options = {}) {
    if (!table || typeof callback !== 'function') {
      warn('watch: invalid args');
      return () => {};
    }

    if (!client) {
      setTimeout(() => watch(table, callback, options), 150);
      return () => {};
    }

    const event = options.event || '*';
    const filter = options.filter || null;
    const debounceMs = options.debounceMs != null ? options.debounceMs : 400;
    const customKey = options.key || null;

    const key = customKey || makeKey(table, filter);

    // لو موجود بالفعل، أضف الـ callback
    if (channels.has(key)) {
      const existing = channels.get(key);
      existing.callbacks.add(callback);
      return () => unwatchByKey(key, callback);
    }

    // إنشاء channel جديد
    let channel;
    try {
      const channelName = `rt-${table}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      channel = client.channel(channelName);

      const callbacks = new Set([callback]);

      const handler = (payload) => {
        debounce(key, () => {
          log(`change on ${table}:`, payload?.eventType);
          callbacks.forEach(cb => {
            try { cb(payload, table); } catch (e) {}
          });
        }, debounceMs);
      };

      // بناء الـ on() حسب event و filter
      if (filter && typeof filter === 'object') {
        const filterStr = Object.keys(filter)
          .map(col => `${col}=eq.${filter[col]}`)
          .join('&');

        channel.on(
          'postgres_changes',
          { event, schema: 'public', table, filter: filterStr },
          handler
        );
      } else {
        channel.on(
          'postgres_changes',
          { event, schema: 'public', table },
          handler
        );
      }

      channel.subscribe((status) => {
        log(`channel ${key} status:`, status);
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          warn(`channel ${key} error: ${status}`);
        }
      });

      channels.set(key, {
        channel, table, callbacks, event, filter, debounceMs
      });

      log('watching:', key);
    } catch (e) {
      warn('watch failed:', e);
      return () => {};
    }

    return () => unwatchByKey(key, callback);
  }

  /* ============================================
     UNWATCH
     ============================================ */
  function unwatchByKey(key, callback) {
    const entry = channels.get(key);
    if (!entry) return;

    if (callback) {
      entry.callbacks.delete(callback);
      if (entry.callbacks.size === 0) {
        closeChannel(key);
      }
    } else {
      closeChannel(key);
    }
  }

  function closeChannel(key) {
    const entry = channels.get(key);
    if (!entry) return;

    try {
      if (entry.channel && typeof entry.channel.unsubscribe === 'function') {
        entry.channel.unsubscribe();
      }
    } catch (e) {
      warn('closeChannel error:', e);
    }

    if (debounceTimers.has(key)) {
      clearTimeout(debounceTimers.get(key));
      debounceTimers.delete(key);
    }

    channels.delete(key);
    log('unwatched:', key);
  }

  function unwatch(table, filter) {
    const key = makeKey(table, filter || null);
    closeChannel(key);
  }

  function unwatchAll() {
    Array.from(channels.keys()).forEach(closeChannel);

    if (broadcastChannel) {
      try { broadcastChannel.unsubscribe(); } catch (e) {}
      broadcastChannel = null;
    }

    debounceTimers.forEach(t => clearTimeout(t));
    debounceTimers.clear();
    broadcastListeners.clear();
  }

  /* ============================================
     WATCH MANY
     ============================================ */
  function watchMany(tables, callback, options = {}) {
    if (!Array.isArray(tables) || !tables.length) {
      warn('watchMany: invalid tables');
      return () => {};
    }
    if (typeof callback !== 'function') {
      warn('watchMany: invalid callback');
      return () => {};
    }

    const unsubscribers = tables.map(t => watch(t, callback, options));

    return () => {
      unsubscribers.forEach(fn => {
        try { fn(); } catch (e) {}
      });
    };
  }

  /* ============================================
     BROADCAST API
     ============================================ */
  function sendBroadcast(event, payload = {}) {
    if (!event) return false;

    const ch = initBroadcast();
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: event,
          payload: payload || {}
        });
      } catch (e) {
        warn('sendBroadcast error:', e);
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('broadcast-' + event, {
        detail: payload || {}
      }));
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('broadcast', {
        detail: { event, payload: payload || {} }
      }));
    } catch (e) {}

    return true;
  }

  function onBroadcast(event, callback) {
    if (!event || typeof callback !== 'function') return () => {};

    if (!broadcastListeners.has(event)) {
      broadcastListeners.set(event, new Set());
    }
    broadcastListeners.get(event).add(callback);

    initBroadcast();

    return () => {
      const set = broadcastListeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) broadcastListeners.delete(event);
      }
    };
  }

  /* ============================================
     INIT
     ============================================ */
  function init() {
    if (isReady) return;

    if (typeof window.onSupabaseReady !== 'function') {
      initRetries++;
      if (initRetries > MAX_INIT_RETRIES) {
        warn('onSupabaseReady not found after max retries');
        return;
      }
      setTimeout(init, 200);
      return;
    }

    window.onSupabaseReady((c) => {
      client = c;
      isReady = true;
      log('Realtime ready');

      initBroadcast();
    });
  }

  /* ============================================
     EXPORT
     ============================================ */
  window.Realtime = {
    watch,
    watchMany,
    unwatch,
    unwatchAll,
    sendBroadcast,
    onBroadcast,

    get isReady() { return isReady; },
    get activeCount() { return channels.size; },
    getChannelKeys() { return Array.from(channels.keys()); }
  };

  /* ============================================
     AUTO INIT
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

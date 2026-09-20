/* =====================================================
   IT SYNDICATE — Realtime Manager
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  const channels = new Map();
  const listeners = new Map();
  const tableCounts = new Map();
  const channelStatus = new Map();

  let client = null;
  let initialized = false;
  let connectionStatus = 'disconnected';
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  const MAX_RECONNECT_ATTEMPTS = 10;
  const RECONNECT_DELAY_BASE = 2000;

  /* ============================================
     CONSTANTS
     ============================================ */
  const WATCHED_TABLES = [
    'membership_types',
    'applications',
    'attachments',
    'status_history',
    'payments',
    'settings',
    'members',
    'user_preferences',
    'branches',
    'users',
    'membership_subscriptions',
    'user_sessions',
    'user_actions',
    'audit_log'
  ];

  const BROADCAST_CHANNEL = 'its:broadcast';
  const PRESENCE_CHANNEL = 'its:presence';

  /* ============================================
     STATUS
     ============================================ */
  function setStatus(newStatus) {
    if (connectionStatus === newStatus) return;
    const oldStatus = connectionStatus;
    connectionStatus = newStatus;

    window.dispatchEvent(new CustomEvent('realtime-status', {
      detail: { status: newStatus, previous: oldStatus }
    }));

    if (newStatus === 'connected') {
      reconnectAttempts = 0;
      console.log('[Realtime] Connected');
    } else if (newStatus === 'error') {
      console.warn('[Realtime] Error occurred');
      scheduleReconnect();
    } else if (newStatus === 'disconnected') {
      console.warn('[Realtime] Disconnected');
    }
  }

  function getStatus() {
    return connectionStatus;
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Realtime] Max reconnect attempts reached');
      return;
    }

    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY_BASE * Math.pow(1.5, reconnectAttempts - 1), 30000);

    console.log(`[Realtime] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})`);

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      await reconnectAll();
    }, delay);
  }

  /* ============================================
     LISTENERS
     ============================================ */
  function listenerKey(table, event) {
    return `${table}:${event}`;
  }

  function addListener(table, event, callback) {
    if (typeof callback !== 'function') return () => {};

    const key = listenerKey(table, event);
    if (!listeners.has(key)) listeners.set(key, []);
    listeners.get(key).push(callback);

    tableCounts.set(table, (tableCounts.get(table) || 0) + 1);

    return function unsubscribe() {
      const arr = listeners.get(key);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx > -1) arr.splice(idx, 1);
        if (arr.length === 0) listeners.delete(key);
      }
      const c = tableCounts.get(table) || 1;
      tableCounts.set(table, Math.max(0, c - 1));
    };
  }

  function emit(table, event, payload) {
    const specific = listeners.get(listenerKey(table, event)) || [];
    const general = listeners.get(listenerKey(table, '*')) || [];
    const allTable = listeners.get(listenerKey('*', event)) || [];
    const allAll = listeners.get(listenerKey('*', '*')) || [];

    const all = [...specific, ...general, ...allTable, ...allAll];
    const seen = new Set();

    all.forEach(cb => {
      if (seen.has(cb)) return;
      seen.add(cb);
      try {
        cb({
          table,
          event,
          payload,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error('[Realtime] Listener error:', e);
      }
    });
  }

  /* ============================================
     SUBSCRIBE
     ============================================ */
  function subscribeToTable(table) {
    if (!client) return null;
    if (channels.has(table)) {
      const existing = channels.get(table);
      // لو القناة مشتركة، رجعها
      if (channelStatus.get(table) === 'subscribed') return existing;
    }

    const channelName = `its:realtime:${table}`;

    const channel = client
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          const eventType = (payload.eventType || '').toLowerCase();
          emit(table, eventType, payload);
        }
      )
      .subscribe((status, err) => {
        channelStatus.set(table, status.toLowerCase());

        if (status === 'SUBSCRIBED') {
          // لو كل الجداول مشتركة، اعتبر الاتصال سليم
          const allSubscribed = WATCHED_TABLES.every(t => {
            const s = channelStatus.get(t);
            return s === 'subscribed' || !channels.has(t);
          });
          if (allSubscribed || channels.size > 0) {
            setStatus('connected');
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[Realtime] ${table}: ${status}`, err);
          channelStatus.set(table, 'error');
          setStatus('error');
        } else if (status === 'CLOSED') {
          channelStatus.set(table, 'closed');
        }
      });

    channels.set(table, channel);
    return channel;
  }

  async function unsubscribeFromTable(table) {
    const channel = channels.get(table);
    if (!channel || !client) return;

    try {
      await client.removeChannel(channel);
    } catch (e) {
      console.warn('[Realtime] Remove channel failed:', e);
    }
    channels.delete(table);
    channelStatus.delete(table);
  }

  async function reconnectAll() {
    const tables = Array.from(channels.keys());
    for (const t of tables) {
      await unsubscribeFromTable(t);
    }
    tables.forEach(t => subscribeToTable(t));
  }

  /* ============================================
     PUBLIC: watch
     ============================================ */
  function watch(table, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = { event: '*' };
    }
    options = options || {};
    const event = options.event || '*';

    if (client && !channels.has(table) && table !== '*') {
      subscribeToTable(table);
    }

    return addListener(table, event, callback);
  }

  function watchMany(tables, callback) {
    const unsubs = [];
    tables.forEach(t => {
      unsubs.push(watch(t, '*', callback));
    });
    return function () {
      unsubs.forEach(fn => { try { fn(); } catch (e) {} });
    };
  }

  function watchRow(table, rowId, callback) {
    return watch(table, '*', (info) => {
      const record = info.payload.new || info.payload.old || {};
      if (String(record.id) === String(rowId)) {
        callback(info);
      }
    });
  }

  async function unwatch(table) {
    return unsubscribeFromTable(table);
  }

  async function unwatchAll() {
    const tables = Array.from(channels.keys());
    for (const t of tables) {
      await unsubscribeFromTable(t);
    }
    listeners.clear();
    tableCounts.clear();
    channelStatus.clear();
  }

  /* ============================================
     WATCH & RELOAD HELPERS
     ============================================ */
  function watchAndReload(table, loaderFn, options) {
    options = options || {};
    if (options.immediate !== false && typeof loaderFn === 'function') {
      loaderFn();
    }
    return watch(table, '*', window.debounce(() => {
      if (typeof loaderFn === 'function') loaderFn();
    }, options.debounceMs || 250));
  }

  function watchManyAndReload(tables, loaderFn, options) {
    options = options || {};
    if (options.immediate !== false && typeof loaderFn === 'function') {
      loaderFn();
    }
    const debounced = window.debounce(() => {
      if (typeof loaderFn === 'function') loaderFn();
    }, options.debounceMs || 250);

    const unsubs = tables.map(t => watch(t, '*', debounced));
    return function () {
      unsubs.forEach(fn => { try { fn(); } catch (e) {} });
    };
  }

  /* ============================================
     BROADCAST CHANNEL
     ============================================ */
  let broadcastChannel = null;
  let broadcastReady = false;

  function initBroadcast() {
    if (!client || broadcastChannel) return broadcastChannel;

    broadcastChannel = client.channel(BROADCAST_CHANNEL, {
      config: {
        broadcast: { self: false, ack: false }
      }
    });

    broadcastChannel
      .on('broadcast', { event: 'notification' }, (payload) => {
        window.dispatchEvent(new CustomEvent('broadcast-notification', {
          detail: payload.payload || payload
        }));
      })
      .on('broadcast', { event: 'settings-updated' }, (payload) => {
        window.dispatchEvent(new CustomEvent('broadcast-settings', {
          detail: payload.payload || payload
        }));
      })
      .on('broadcast', { event: 'logo-updated' }, (payload) => {
        window.dispatchEvent(new CustomEvent('broadcast-logo', {
          detail: payload.payload || payload
        }));
      })
      .on('broadcast', { event: 'data-changed' }, (payload) => {
        window.dispatchEvent(new CustomEvent('broadcast-data', {
          detail: payload.payload || payload
        }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastReady = true;
        }
      });

    return broadcastChannel;
  }

  function sendBroadcast(event, data) {
    if (!broadcastChannel) initBroadcast();
    if (!broadcastChannel) return;
    try {
      broadcastChannel.send({
        type: 'broadcast',
        event: event || 'notification',
        payload: data || {}
      });
    } catch (e) {
      console.warn('[Realtime] Broadcast failed:', e);
    }
  }

  /* ============================================
     PRESENCE
     ============================================ */
  let presenceChannel = null;
  const presenceState = new Map();
  let currentPresenceInfo = null;

  function initPresence(userInfo) {
    if (!client) return null;

    if (presenceChannel) {
      if (userInfo) trackPresence(userInfo);
      return presenceChannel;
    }

    const key = userInfo?.id || 'anon-' + Math.random().toString(36).slice(2, 9);

    presenceChannel = client.channel(PRESENCE_CHANNEL, {
      config: {
        presence: { key }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        presenceState.clear();
        Object.entries(state).forEach(([k, arr]) => {
          presenceState.set(k, arr);
        });
        window.dispatchEvent(new CustomEvent('presence-sync', {
          detail: { state: Object.fromEntries(presenceState) }
        }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        window.dispatchEvent(new CustomEvent('presence-join', {
          detail: { key, presences: newPresences }
        }));
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        window.dispatchEvent(new CustomEvent('presence-leave', {
          detail: { key, presences: leftPresences }
        }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && userInfo) {
          currentPresenceInfo = userInfo;
          try {
            await presenceChannel.track(userInfo);
          } catch (e) {}
        }
      });

    return presenceChannel;
  }

  async function trackPresence(userInfo) {
    if (!userInfo) return;

    if (!presenceChannel) {
      initPresence(userInfo);
      currentPresenceInfo = userInfo;
      return;
    }

    try {
      await presenceChannel.track(userInfo);
      currentPresenceInfo = userInfo;
    } catch (e) {}
  }

  function getOnlineUsers() {
    const all = [];
    presenceState.forEach((arr) => {
      arr.forEach(p => all.push(p));
    });
    return all;
  }

  function getPresenceState() {
    return Object.fromEntries(presenceState);
  }

  /* ============================================
     AUTO PRESENCE (لو المستخدم مسجل دخول)
     ============================================ */
  async function autoPresence() {
    if (!client) return;
    try {
      const { data } = await client.auth.getSession();
      const user = data?.session?.user;
      if (!user) return;

      // جيب اسم المستخدم ودوره
      let fullName = user.email;
      let role = 'committee';

      try {
        const { data: userData } = await client
          .from('users')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle();

        if (userData) {
          fullName = userData.full_name || fullName;
          role = userData.role || role;
        }
      } catch (e) {}

      const info = {
        id: user.id,
        email: user.email,
        full_name: fullName,
        role,
        online_at: new Date().toISOString()
      };

      initPresence(info);
    } catch (e) {}
  }

  /* ============================================
     BATCH OPERATIONS
     ============================================ */
  async function batchSubscribe(tables) {
    if (!client) return;
    tables.forEach(t => subscribeToTable(t));
  }

  /* ============================================
     INIT
     ============================================ */
  async function init() {
    if (initialized) return;
    if (typeof window.onSupabaseReady !== 'function') {
      setTimeout(init, 100);
      return;
    }

    window.onSupabaseReady((c) => {
      client = c;
      initialized = true;

      setStatus('connecting');

      // Subscribe to all watched tables
      WATCHED_TABLES.forEach(t => subscribeToTable(t));

      // Init broadcast
      initBroadcast();

      // Init presence if logged in
      setTimeout(autoPresence, 1000);

      window.dispatchEvent(new CustomEvent('realtime-initialized'));
    });

    // Network status
    window.addEventListener('online', () => {
      console.log('[Realtime] Back online');
      reconnectAll();
    });

    window.addEventListener('offline', () => {
      console.log('[Realtime] Offline');
      setStatus('disconnected');
    });
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.Realtime = {
    // Subscribe
    watch,
    watchMany,
    watchRow,
    unwatch,
    unwatchAll,

    // Helpers
    watchAndReload,
    watchManyAndReload,

    // Listener management
    addListener,
    emit,

    // Broadcast
    initBroadcast,
    sendBroadcast,

    // Presence
    initPresence,
    trackPresence,
    getOnlineUsers,
    getPresenceState,

    // Status
    getStatus,
    getChannels: () => Array.from(channels.keys()),
    getListeners: () => Object.fromEntries(listeners),
    getChannelStatus: () => Object.fromEntries(channelStatus),

    // Batch
    batchSubscribe,
    reconnectAll,

    // Constants
    WATCHED_TABLES
  };

  /* ============================================
     START
     ============================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

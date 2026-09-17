/* =====================================================
   IT SYNDICATE — Realtime Manager
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     STATE
     ============================================ */
  const channels = new Map();       // channelName → channel
  const listeners = new Map();      // "table:event" → [callbacks]
  const tableCounts = new Map();    // tableName → number of subscribers

  let client = null;
  let initialized = false;
  let connectionStatus = 'disconnected'; // disconnected | connecting | connected | error

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
    'user_preferences'
  ];

  /* ============================================
     STATUS HELPERS
     ============================================ */
  function setStatus(newStatus) {
    if (connectionStatus === newStatus) return;
    connectionStatus = newStatus;
    window.dispatchEvent(new CustomEvent('realtime-status', {
      detail: { status: newStatus }
    }));
  }

  function getStatus() {
    return connectionStatus;
  }

  /* ============================================
     LISTENER MANAGEMENT
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

    // Return unsubscribe function
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
    const key = listenerKey(table, event);
    const generalKey = listenerKey(table, '*');

    const specific = listeners.get(key) || [];
    const general = listeners.get(generalKey) || [];

    // Also fire all-table listeners
    const allTableKey = listenerKey('*', event);
    const allTableAllEventsKey = listenerKey('*', '*');
    const allTable = listeners.get(allTableKey) || [];
    const allAll = listeners.get(allTableAllEventsKey) || [];

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
     SUBSCRIBE TO TABLE
     ============================================ */
  function subscribeToTable(table) {
    if (!client) return null;
    if (channels.has(table)) return channels.get(table);

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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('error');
        } else if (status === 'TIMED_OUT') {
          setStatus('error');
        } else if (status === 'CLOSED') {
          // Channel closed
        }
      });

    channels.set(table, channel);
    return channel;
  }

  /* ============================================
     UNSUBSCRIBE FROM TABLE
     ============================================ */
  async function unsubscribeFromTable(table) {
    const channel = channels.get(table);
    if (!channel || !client) return;

    try {
      await client.removeChannel(channel);
    } catch (e) {
      console.warn('[Realtime] Remove channel failed:', e);
    }
    channels.delete(table);
  }

  /* ============================================
     PUBLIC: watch
     Subscribe to changes on a table.
     Returns unsubscribe function.
     ============================================ */
  function watch(table, options, callback) {
    // Support: watch(table, callback)
    if (typeof options === 'function') {
      callback = options;
      options = { event: '*' };
    }
    options = options || {};
    const event = options.event || '*';

    // Make sure table is subscribed at the channel level
    if (client && !channels.has(table) && table !== '*') {
      subscribeToTable(table);
    }

    return addListener(table, event, callback);
  }

  /* ============================================
     PUBLIC: watchMany
     ============================================ */
  function watchMany(tables, callback) {
    const unsubs = [];
    tables.forEach(t => {
      unsubs.push(watch(t, '*', callback));
    });
    return function () {
      unsubs.forEach(fn => { try { fn(); } catch (e) {} });
    };
  }

  /* ============================================
     PUBLIC: watchRow
     Watch specific row (by id) on a table.
     ============================================ */
  function watchRow(table, rowId, callback) {
    return watch(table, '*', (info) => {
      const record = info.payload.new || info.payload.old || {};
      if (String(record.id) === String(rowId)) {
        callback(info);
      }
    });
  }

  /* ============================================
     PUBLIC: unwatch
     ============================================ */
  function unwatch(table) {
    return unsubscribeFromTable(table);
  }

  /* ============================================
     PUBLIC: unwatchAll
     ============================================ */
  async function unwatchAll() {
    const tables = Array.from(channels.keys());
    for (const t of tables) {
      await unsubscribeFromTable(t);
    }
    listeners.clear();
    tableCounts.clear();
  }

  /* ============================================
     BROADCAST CHANNEL (for custom messages)
     ============================================ */
  let broadcastChannel = null;

  function initBroadcast() {
    if (!client || broadcastChannel) return broadcastChannel;

    broadcastChannel = client.channel('its:broadcast', {
      config: {
        broadcast: { self: false }
      }
    });

    broadcastChannel
      .on('broadcast', { event: 'notification' }, (payload) => {
        window.dispatchEvent(new CustomEvent('broadcast-notification', {
          detail: payload.payload
        }));
      })
      .subscribe();

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
     PRESENCE (who's online)
     ============================================ */
  let presenceChannel = null;
  const presenceState = new Map();

  function initPresence(userInfo) {
    if (!client) return null;

    if (presenceChannel) {
      if (userInfo) trackPresence(userInfo);
      return presenceChannel;
    }

    presenceChannel = client.channel('its:presence', {
      config: {
        presence: {
          key: userInfo?.id || 'anon-' + Math.random().toString(36).slice(2, 9)
        }
      }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        presenceState.clear();
        Object.entries(state).forEach(([key, arr]) => {
          presenceState.set(key, arr);
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
          try {
            await presenceChannel.track(userInfo);
          } catch (e) {}
        }
      });

    return presenceChannel;
  }

  async function trackPresence(userInfo) {
    if (!presenceChannel) {
      initPresence(userInfo);
      return;
    }
    try {
      await presenceChannel.track(userInfo);
    } catch (e) {}
  }

  function getOnlineUsers() {
    const all = [];
    presenceState.forEach((arr) => {
      arr.forEach(p => all.push(p));
    });
    return all;
  }

  /* ============================================
     POSTGRES CHANGE HELPERS
     ============================================ */

  /* Auto-reload data when table changes */
  function watchAndReload(table, loaderFn, options) {
    options = options || {};
    if (options.immediate !== false && typeof loaderFn === 'function') {
      loaderFn();
    }
    return watch(table, '*', window.debounce(() => {
      if (typeof loaderFn === 'function') loaderFn();
    }, options.debounceMs || 250));
  }

  /* Watch multiple tables, reload once */
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
     INIT
     ============================================ */
  async function init() {
    if (initialized) return;
    if (typeof window.onSupabaseReady !== 'function') {
      // Wait for supabase-config to define it
      setTimeout(init, 100);
      return;
    }

    window.onSupabaseReady((c) => {
      client = c;
      initialized = true;

      // Subscribe to all watched tables eagerly
      WATCHED_TABLES.forEach(t => subscribeToTable(t));

      // Init broadcast + presence channels
      initBroadcast();

      window.dispatchEvent(new CustomEvent('realtime-initialized'));
    });
  }

  /* ============================================
     EXPOSE PUBLIC API
     ============================================ */
  window.Realtime = {
    watch,
    watchMany,
    watchRow,
    unwatch,
    unwatchAll,
    watchAndReload,
    watchManyAndReload,
    emit,
    addListener,

    initBroadcast,
    sendBroadcast,

    initPresence,
    trackPresence,
    getOnlineUsers,

    getStatus,
    getChannels: () => Array.from(channels.keys()),
    getListeners: () => Object.fromEntries(listeners),

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

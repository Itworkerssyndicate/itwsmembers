/* =====================================================
   IT SYNDICATE — REALTIME MANAGER
   Version: 3.0.0
   Path: js/realtime.js
   =====================================================
   يحتوي على:
   - watch (مراقبة جدول كامل)
   - watchRow (مراقبة صف واحد)
   - watchMany (مراقبة عدة جداول)
   - watchManyAndReload (مراقبة + reload callback)
   - broadcast (إرسال رسائل للتابات التانية)
   - debounce للحماية من السبام
   - cleanup تلقائي
   ===================================================== */

(function () {
  'use strict';

  /* ============================================
     CONSTANTS
     ============================================ */
  const BROADCAST_CHANNEL = 'its_global_broadcast';
  const DEFAULT_DEBOUNCE = 400;

  /* ============================================
     STATE
     ============================================ */
  let client = null;
  let isReady = false;
  const channels = new Map(); // channelName -> channel
  const watchers = new Map(); // watcherId -> { channel, cleanup }
  let broadcastChannel = null;
  let watcherCounter = 0;

  /* ============================================
     HELPERS
     ============================================ */
  function log(...args) {
    if (window.ITS_DEBUG) console.log('[Realtime]', ...args);
  }

  function warn(...args) {
    console.warn('[Realtime]', ...args);
  }

  function genId(prefix) {
    watcherCounter++;
    return `${prefix}-${Date.now()}-${watcherCounter}`;
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* ============================================
     GET OR CREATE CHANNEL
     ============================================ */
  function getChannel(name) {
    if (channels.has(name)) {
      return channels.get(name);
    }

    if (!client) {
      warn('Client not ready');
      return null;
    }

    const channel = client.channel(name);
    channels.set(name, channel);

    channel.subscribe((status, err) => {
      log(`Channel "${name}" status:`, status);
      if (err) warn(`Channel "${name}" error:`, err);
    });

    return channel;
  }

  function removeChannel(name) {
    if (channels.has(name)) {
      try {
        const ch = channels.get(name);
        client.removeChannel(ch);
      } catch (e) {}
      channels.delete(name);
    }
  }

  /* ============================================
     WATCH (Table)
     ============================================ */
  /**
   * Watch a full table for any change
   * @param {string} table - Table name
   * @param {Function} callback - Called on any change
   * @param {Object} options - { event: '*', schema: 'public', debounceMs, immediate }
   * @returns {Function} - Unsubscribe function
   */
  function watch(table, callback, options) {
    if (!client) {
      warn('watch: client not ready');
      return () => {};
    }

    const opts = options || {};
    const event = opts.event || '*';
    const schema = opts.schema || 'public';
    const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE;
    const channelName = opts.channelName || `watch-${table}`;

    const channel = getChannel(channelName);
    if (!channel) return () => {};

    const id = genId('watch');
    const wrappedCallback = debounceMs > 0
      ? debounce((payload) => callback(payload), debounceMs)
      : callback;

    const handler = (payload) => {
      log(`Change on ${table}:`, payload.eventType);
      wrappedCallback(payload);
    };

    channel.on(
      'postgres_changes',
      { event, schema, table },
      handler
    );

    const cleanup = () => {
      try {
        channel.unsubscribe();
      } catch (e) {}
      watchers.delete(id);
      // Remove channel if no other watchers
      if (watchers.size === 0) {
        removeChannel(channelName);
      }
    };

    watchers.set(id, { channel, cleanup });

    log(`Watching table "${table}" (id: ${id})`);
    return cleanup;
  }

  /* ============================================
     WATCH ROW (Specific row)
     ============================================ */
  /**
   * Watch a specific row in a table
   * @param {string} table - Table name
   * @param {string|number} rowId - Row ID (usually UUID)
   * @param {Function} callback
   * @param {Object} options - { idColumn: 'id', schema, debounceMs }
   * @returns {Function} - Unsubscribe
   */
  function watchRow(table, rowId, callback, options) {
    if (!client) {
      warn('watchRow: client not ready');
      return () => {};
    }

    const opts = options || {};
    const idColumn = opts.idColumn || 'id';
    const schema = opts.schema || 'public';
    const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE;
    const channelName = opts.channelName || `watchrow-${table}-${rowId}`;

    const channel = getChannel(channelName);
    if (!channel) return () => {};

    const id = genId('watchrow');
    const wrappedCallback = debounceMs > 0
      ? debounce((payload) => callback(payload), debounceMs)
      : callback;

    const handler = (payload) => {
      // Only trigger if the changed row matches
      const newData = payload.new || {};
      const oldData = payload.old || {};
      const matchId = newData[idColumn] || oldData[idColumn];

      if (String(matchId) === String(rowId)) {
        log(`Row change on ${table}:${rowId}:`, payload.eventType);
        wrappedCallback(payload);
      }
    };

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema,
        table,
        filter: `${idColumn}=eq.${rowId}`
      },
      handler
    );

    const cleanup = () => {
      try {
        channel.unsubscribe();
      } catch (e) {}
      watchers.delete(id);
      if (watchers.size === 0) {
        removeChannel(channelName);
      }
    };

    watchers.set(id, { channel, cleanup });

    log(`Watching row "${table}:${rowId}" (id: ${id})`);
    return cleanup;
  }

  /* ============================================
     WATCH MANY (Multiple tables)
     ============================================ */
  /**
   * Watch multiple tables with a single callback
   * @param {string[]} tables
   * @param {Function} callback
   * @param {Object} options
   * @returns {Function} - Unsubscribe all
   */
  function watchMany(tables, callback, options) {
    if (!Array.isArray(tables) || tables.length === 0) {
      return () => {};
    }

    const cleanups = tables.map(table => watch(table, callback, options));

    return () => {
      cleanups.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    };
  }

  /* ============================================
     WATCH MANY AND RELOAD
     ============================================ */
  /**
   * Convenience: watch multiple tables and call reload on any change
   * @param {string[]} tables
   * @param {Function} reloadFn - async function to call
   * @param {Object} options - { debounceMs, immediate }
   * @returns {Function} - Unsubscribe
   */
  function watchManyAndReload(tables, reloadFn, options) {
    if (!Array.isArray(tables) || typeof reloadFn !== 'function') {
      return () => {};
    }

    const opts = options || {};
    const debounceMs = opts.debounceMs ?? 600;

    // Use a single debounced reload for all tables
    const debouncedReload = debounce(async () => {
      try {
        await reloadFn();
      } catch (e) {
        warn('Reload callback failed:', e.message);
      }
    }, debounceMs);

    const handleChange = (payload) => {
      log('Change detected, scheduling reload...', payload?.table);
      debouncedReload();
    };

    // Watch each table
    const cleanups = tables.map(table =>
      watch(table, handleChange, { ...opts, debounceMs: 0 })
    );

    // Optional immediate call
    if (opts.immediate) {
      setTimeout(() => {
        debouncedReload();
      }, 100);
    }

    return () => {
      cleanups.forEach(fn => {
        try {
          fn();
        } catch (e) {}
      });
    };
  }

  /* ============================================
     BROADCAST (Cross-tab messaging)
     ============================================ */
  function ensureBroadcastChannel() {
    if (broadcastChannel) return broadcastChannel;
    if (!client) return null;

    broadcastChannel = client.channel(BROADCAST_CHANNEL, {
      config: {
        broadcast: { self: false }
      }
    });

    broadcastChannel
      .on('broadcast', { event: 'message' }, (payload) => {
        log('Broadcast received:', payload);
        window.dispatchEvent(new CustomEvent('broadcast-notification', {
          detail: payload.payload
        }));
      })
      .subscribe((status) => {
        log('Broadcast channel status:', status);
      });

    return broadcastChannel;
  }

  /**
   * Send a broadcast message to all tabs
   * @param {string} type - Message type
   * @param {Object} data - Payload
   */
  function sendBroadcast(type, data) {
    const channel = ensureBroadcastChannel();
    if (!channel) return;

    try {
      channel.send({
        type: 'broadcast',
        event: 'message',
        payload: {
          type,
          ...data,
          timestamp: new Date().toISOString()
        }
      });
      log('Broadcast sent:', type);
    } catch (e) {
      warn('Broadcast failed:', e.message);
    }
  }

  /* ============================================
     CLEANUP
     ============================================ */
  function cleanup() {
    watchers.forEach(({ cleanup: fn }) => {
      try {
        fn();
      } catch (e) {}
    });
    watchers.clear();
    channels.clear();
    if (broadcastChannel) {
      try {
        client.removeChannel(broadcastChannel);
      } catch (e) {}
      broadcastChannel = null;
    }
  }

  function count() {
    return watchers.size;
  }

  /* ============================================
     PUBLIC API
     ============================================ */
  window.Realtime = {
    // Watchers
    watch,
    watchRow,
    watchMany,
    watchManyAndReload,

    // Broadcast
    sendBroadcast,
    broadcast: sendBroadcast,

    // Utilities
    cleanup,
    count: () => count(),
    isReady: () => isReady,
    status: () => ({
      isReady,
      watchers: watchers.size,
      channels: channels.size,
      hasBroadcast: !!broadcastChannel
    })
  };

  /* ============================================
     INIT
     ============================================ */
  function start(c) {
    client = c;
    isReady = true;

    // Ensure broadcast channel
    ensureBroadcastChannel();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cleanup();
    });

    log('Ready');
    window.dispatchEvent(new CustomEvent('realtime-ready'));
  }

  // Wait for Supabase
  if (typeof window.onSupabaseReady === 'function') {
    window.onSupabaseReady(start);
  } else if (window.supabaseClient) {
    start(window.supabaseClient);
  } else {
    window.addEventListener('supabase-ready', (e) => {
      start(e.detail?.client || window.supabaseClient);
    }, { once: true });
  }

})();

// Trigger Store (persistent)
(function (scope) {
  const STORAGE_KEY = 'conduit_trigger_state_v1';
  const STALE_MS = 10 * 60 * 1000;

  function defaultState() {
    return { pending: {}, lastRequestId: null, notice: null };
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  async function loadState() {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const state = data[STORAGE_KEY];
    if (!isObject(state)) return defaultState();
    const pending = isObject(state.pending) ? state.pending : {};
    return {
      pending,
      lastRequestId: typeof state.lastRequestId === 'string' ? state.lastRequestId : null,
      notice: isObject(state.notice) ? state.notice : null,
    };
  }

  async function saveState(state) {
    await browser.storage.local.set({ [STORAGE_KEY]: state });
  }

  async function sweepStale() {
    const state = await loadState();
    const now = Date.now();
    let changed = false;

    Object.keys(state.pending).forEach((key) => {
      const entry = state.pending[key];
      if (!entry || !entry.createdAt) return;
      if (now - entry.createdAt > STALE_MS) {
        delete state.pending[key];
        changed = true;
      }
    });

    if (state.lastRequestId && !state.pending[state.lastRequestId]) {
      state.lastRequestId = null;
      changed = true;
    }

    if (state.notice && state.notice.createdAt && now - state.notice.createdAt > STALE_MS) {
      state.notice = null;
      changed = true;
    }

    if (changed) {
      await saveState(state);
    }
  }

  async function addPending(trigger) {
    const state = await loadState();
    state.pending[trigger.requestId] = {
      trigger,
      createdAt: Date.now(),
    };
    state.lastRequestId = trigger.requestId;
    await saveState(state);
    return trigger;
  }

  async function getLatestPending() {
    const state = await loadState();
    if (state.lastRequestId && state.pending[state.lastRequestId]) {
      return state.pending[state.lastRequestId].trigger;
    }
    const entries = Object.values(state.pending);
    if (entries.length === 0) return null;
    entries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return entries[0].trigger || null;
  }

  async function getPending(requestId) {
    const state = await loadState();
    const entry = state.pending[requestId];
    return entry ? entry.trigger : null;
  }

  async function removePending(requestId) {
    const state = await loadState();
    if (state.pending[requestId]) {
      delete state.pending[requestId];
    }
    if (state.lastRequestId === requestId) {
      state.lastRequestId = null;
    }
    await saveState(state);
  }

  async function setNotice(notice) {
    const state = await loadState();
    state.notice = {
      code: notice.code || 'unknown',
      message: notice.message || 'Unknown error',
      detail: notice.detail,
      createdAt: Date.now(),
    };
    await saveState(state);
  }

  async function consumeNotice() {
    const state = await loadState();
    const notice = state.notice;
    state.notice = null;
    await saveState(state);
    return notice;
  }

  scope.ConduitTriggerStore = {
    sweepStale,
    addPending,
    getLatestPending,
    getPending,
    removePending,
    setNotice,
    consumeNotice,
  };
})(globalThis);

// ─── In-memory Session (per-request) ─────────────────────────────────────────
// Cloudflare Workers are stateless — each request is independent.
// We use grammY's built-in session with a KV-backed storage adapter.
//
// Session stores:
//   step        — current wizard step (null | 'await_token' | 'add_*' | 'edit_*')
//   zoneId      — currently selected zone ID
//   zoneName    — currently selected zone name
//   recordId    — currently selected record ID
//   addData     — partial data during add-record flow
//   editData    — partial data during edit-record flow

export function initialSession() {
  return {
    step: null,
    zoneId: null,
    zoneName: null,
    recordId: null,
    addData: {},
    editData: {},
  };
}

/**
 * Simple KV-backed session storage adapter for grammY.
 * Usage: pass env.SESSION_KV as the kv parameter.
 */
export function kvSessionStorage(kv) {
  return {
    async read(key) {
      const val = await kv.get(key, 'json');
      return val ?? undefined;
    },
    async write(key, value) {
      // Sessions expire after 1 hour of inactivity
      await kv.put(key, JSON.stringify(value), { expirationTtl: 3600 });
    },
    async delete(key) {
      await kv.delete(key);
    },
  };
}

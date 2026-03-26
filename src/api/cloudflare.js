// ─── Cloudflare API Client ───────────────────────────────────────────────────
// All requests go through cfFetch(). Errors are always thrown as Error objects
// with a human-readable message from the CF API response.

const CF_API = 'https://api.cloudflare.com/client/v4';

/**
 * Base fetch wrapper for Cloudflare API.
 * @throws {Error} with CF error messages joined
 */
async function cfFetch(token, path, options = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json();

  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join('; ') ?? 'Unknown CF API error';
    throw new Error(msg);
  }

  return data;
}

// ─── Token validation ─────────────────────────────────────────────────────────

/**
 * Verify a token by calling /user/tokens/verify.
 * Returns true if valid and has at least DNS read access.
 */
export async function verifyToken(token) {
  try {
    const data = await cfFetch(token, '/user/tokens/verify');
    return data.result?.status === 'active';
  } catch {
    return false;
  }
}

// ─── Zones ────────────────────────────────────────────────────────────────────

/**
 * List all zones for the account.
 * @returns {Array} zones
 */
export async function listZones(token) {
  const results = [];
  let page = 1;

  while (true) {
    const data = await cfFetch(token, `/zones?per_page=50&page=${page}`);
    results.push(...data.result);
    if (page >= data.result_info.total_pages) break;
    page++;
  }

  return results;
}

// ─── DNS Records ──────────────────────────────────────────────────────────────

/**
 * List DNS records for a zone, with optional pagination.
 * @param {string} token
 * @param {string} zoneId
 * @param {number} page   - 1-based page number
 * @param {number} perPage
 * @returns {{ records: Array, totalPages: number, totalCount: number }}
 */
export async function listRecords(token, zoneId, page = 1, perPage = 20) {
  const data = await cfFetch(
    token,
    `/zones/${zoneId}/dns_records?per_page=${perPage}&page=${page}&order=type&direction=asc`
  );
  return {
    records: data.result,
    totalPages: data.result_info.total_pages,
    totalCount: data.result_info.total_count,
  };
}

/**
 * Get a single DNS record.
 */
export async function getRecord(token, zoneId, recordId) {
  const data = await cfFetch(token, `/zones/${zoneId}/dns_records/${recordId}`);
  return data.result;
}

/**
 * Create a new DNS record.
 * @param {string} token
 * @param {string} zoneId
 * @param {{ type, name, content, ttl, proxied }} record
 */
export async function createRecord(token, zoneId, record) {
  const data = await cfFetch(token, `/zones/${zoneId}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(record),
  });
  return data.result;
}

/**
 * Update an existing DNS record (PATCH — only changed fields).
 * @param {string} token
 * @param {string} zoneId
 * @param {string} recordId
 * @param {object} patch - fields to update
 */
export async function updateRecord(token, zoneId, recordId, patch) {
  const data = await cfFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return data.result;
}

/**
 * Delete a DNS record.
 */
export async function deleteRecord(token, zoneId, recordId) {
  await cfFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
  });
}

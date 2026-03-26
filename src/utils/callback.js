// ─── Callback Data Codec ──────────────────────────────────────────────────────
// Telegram limits callback_data to 64 bytes.
// We use a compact pipe-delimited format: "action|arg1|arg2|..."
// Zone IDs and Record IDs are stored in session state, so we only pass
// short tokens (page numbers, field names) in callbacks where needed.

export const CB = {
  // Navigation
  MAIN_MENU:       'mm',
  ZONES:           'z',
  ZONES_PAGE:      'zp',   // zp|page
  ZONE_SELECT:     'zs',   // zs|zoneId
  RECORDS_PAGE:    'rp',   // rp|page
  RECORD_SELECT:   'rs',   // rs|recordId

  // Record actions
  RECORD_PROXY:    'px',   // px|recordId
  RECORD_EDIT:     'ed',   // ed|recordId
  RECORD_DELETE:   'dl',   // dl|recordId
  RECORD_DEL_CONF: 'dc',   // dc|recordId  (confirmed)
  RECORD_ADD:      'ra',   // ra  (start add flow)
  RECORD_ADD_TYPE: 'rt',   // rt|type

  // Edit fields
  EDIT_NAME:       'en',
  EDIT_CONTENT:    'ec',
  EDIT_TTL:        'et',

  // Proxy toggle answer
  PROXY_YES:       'py',
  PROXY_NO:        'pn',

  // Cancel
  CANCEL:          'cx',

  // Help & token from menu
  HELP:            'hp',
  TOKEN:           'tk',
};

/** Encode callback data: action + optional args → pipe-delimited string */
export function encode(...parts) {
  return parts.join('|');
}

/** Decode callback data string → { action, args[] } */
export function decode(data) {
  const [action, ...args] = (data ?? '').split('|');
  return { action, args };
}

// ─── Keyboard Builders ───────────────────────────────────────────────────────
// All inline keyboards are built here. Each function returns an
// InlineKeyboardMarkup object (plain object, not a grammY builder instance)
// so it's easy to test and reuse.

import { InlineKeyboard } from 'grammy';
import { CB, encode } from '../utils/callback.js';
import { t } from '../i18n/index.js';

const ZONES_PER_PAGE  = 8;
const RECORDS_PER_PAGE = 10;

// ─── Main menu ────────────────────────────────────────────────────────────────

export function mainMenuKb(lang) {
  return new InlineKeyboard()
    .text(t(lang, 'btnZones'), CB.ZONES).row()
    .text(t(lang, 'btnToken'), CB.TOKEN).row()
    .text(t(lang, 'btnHelp'),  CB.HELP);
}

// ─── Zones list ───────────────────────────────────────────────────────────────

export function zonesKb(lang, zones, page = 1) {
  const totalPages = Math.ceil(zones.length / ZONES_PER_PAGE);
  const slice = zones.slice((page - 1) * ZONES_PER_PAGE, page * ZONES_PER_PAGE);

  const kb = new InlineKeyboard();

  for (const zone of slice) {
    const icon = zone.status === 'active' ? '🟢' : '🔴';
    kb.text(`${icon} ${zone.name}`, encode(CB.ZONE_SELECT, zone.id, zone.name)).row();
  }

  // Pagination row
  if (totalPages > 1) {
    const hasPrev = page > 1;
    const hasNext = page < totalPages;
    if (hasPrev) kb.text(t(lang, 'prev'), encode(CB.ZONES_PAGE, page - 1));
    kb.text(t(lang, 'pageOf', page, totalPages), 'noop');
    if (hasNext) kb.text(t(lang, 'next'), encode(CB.ZONES_PAGE, page + 1));
    kb.row();
  }

  kb.text(t(lang, 'back'), CB.MAIN_MENU);
  return kb;
}

// ─── Records list ─────────────────────────────────────────────────────────────

export function recordsKb(lang, records, page = 1, totalPages = 1) {
  const kb = new InlineKeyboard();

  for (const r of records) {
    kb.text(t(lang, 'recordLine', r), encode(CB.RECORD_SELECT, r.id)).row();
  }

  // Pagination row
  if (totalPages > 1) {
    const hasPrev = page > 1;
    const hasNext = page < totalPages;
    if (hasPrev) kb.text(t(lang, 'prev'), encode(CB.RECORDS_PAGE, page - 1));
    kb.text(t(lang, 'pageOf', page, totalPages), 'noop');
    if (hasNext) kb.text(t(lang, 'next'), encode(CB.RECORDS_PAGE, page + 1));
    kb.row();
  }

  kb
    .text(t(lang, 'addRecord'), CB.RECORD_ADD).row()
    .text(t(lang, 'back'), CB.ZONES);
  return kb;
}

// ─── Record detail ────────────────────────────────────────────────────────────

export function recordDetailKb(lang, record) {
  const kb = new InlineKeyboard();

  if (record.proxiable) {
    const label = record.proxied ? t(lang, 'toggleProxyOff') : t(lang, 'toggleProxyOn');
    kb.text(label, encode(CB.RECORD_PROXY, record.id)).row();
  }

  kb
    .text(t(lang, 'editRecord'),   encode(CB.RECORD_EDIT,   record.id)).row()
    .text(t(lang, 'deleteRecord'), encode(CB.RECORD_DELETE, record.id)).row()
    .text(t(lang, 'back'), CB.ZONES); // back to records list via zone in session
  return kb;
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

export function deleteConfirmKb(lang, recordId) {
  return new InlineKeyboard()
    .text(t(lang, 'yes'), encode(CB.RECORD_DEL_CONF, recordId))
    .text(t(lang, 'no'),  encode(CB.RECORD_SELECT,   recordId));
}

// ─── Add record — select type ─────────────────────────────────────────────────

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

export function recordTypeKb(lang) {
  const kb = new InlineKeyboard();
  for (let i = 0; i < RECORD_TYPES.length; i += 3) {
    const row = RECORD_TYPES.slice(i, i + 3);
    for (const type of row) {
      kb.text(type, encode(CB.RECORD_ADD_TYPE, type));
    }
    kb.row();
  }
  kb.text(t(lang, 'cancel'), CB.CANCEL);
  return kb;
}

// ─── Add/Edit — proxy yes/no ──────────────────────────────────────────────────

export function proxyKb(lang) {
  return new InlineKeyboard()
    .text('🟠 Yes', CB.PROXY_YES)
    .text('⚪ No',  CB.PROXY_NO);
}

// ─── Edit — select field ──────────────────────────────────────────────────────

export function editFieldKb(lang) {
  return new InlineKeyboard()
    .text(t(lang, 'editFieldName'),    CB.EDIT_NAME).row()
    .text(t(lang, 'editFieldContent'), CB.EDIT_CONTENT).row()
    .text(t(lang, 'editFieldTtl'),     CB.EDIT_TTL).row()
    .text(t(lang, 'cancel'), CB.CANCEL);
}

// ─── Cancel-only keyboard ─────────────────────────────────────────────────────

export function cancelKb(lang) {
  return new InlineKeyboard().text(t(lang, 'cancel'), CB.CANCEL);
}

// ─── Callback Query Handler ───────────────────────────────────────────────────

import { t, getLang } from '../i18n/index.js';
import { getUser } from '../api/db.js';
import { InlineKeyboard } from 'grammy';
import {
  listZones,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from '../api/cloudflare.js';
import { CB, decode, encode } from '../utils/callback.js';
import {
  mainMenuKb,
  zonesKb,
  recordsKb,
  recordDetailKb,
  deleteConfirmKb,
  recordTypeKb,
  proxyKb,
  editFieldKb,
  cancelKb,
} from '../utils/keyboards.js';

/** Route all callback queries */
export async function handleCallback(ctx) {
  const lang = getLang(ctx);
  const { action, args } = decode(ctx.callbackQuery.data);

  // Always answer the callback to remove the loading spinner
  await ctx.answerCallbackQuery().catch(() => {});

  // Guard: user must have a saved token for most actions
  const user = await getUser(ctx.env.DB, ctx.from.id);
  if (!user && action !== CB.CANCEL) {
    await ctx.editMessageText(t(lang, 'noToken'), { parse_mode: 'Markdown' });
    return;
  }

  try {
    switch (action) {
      case CB.MAIN_MENU:  return await showMainMenu(ctx, lang);
      case CB.HELP:       return await showHelp(ctx, lang);
      case CB.TOKEN:      return await showTokenPrompt(ctx, lang);
      case CB.ZONES:      return await showZones(ctx, lang, user, 1);
      case CB.ZONES_PAGE: return await showZones(ctx, lang, user, parseInt(args[0]));
      case CB.ZONE_SELECT:return await selectZone(ctx, lang, user, args[0], args[1]);
      case CB.RECORDS_PAGE:return await showRecords(ctx, lang, user, parseInt(args[0]));
      case CB.RECORD_SELECT:return await showRecord(ctx, lang, user, args[0]);

      case CB.RECORD_PROXY:  return await toggleProxy(ctx, lang, user, args[0]);
      case CB.RECORD_EDIT:   return await startEdit(ctx, lang, args[0]);
      case CB.RECORD_DELETE: return await confirmDelete(ctx, lang, user, args[0]);
      case CB.RECORD_DEL_CONF: return await doDelete(ctx, lang, user, args[0]);

      case CB.RECORD_ADD:      return await startAdd(ctx, lang);
      case CB.RECORD_ADD_TYPE: return await addSelectType(ctx, lang, args[0]);

      case CB.PROXY_YES: return await finishAdd(ctx, lang, user, true);
      case CB.PROXY_NO:  return await finishAdd(ctx, lang, user, false);

      case CB.EDIT_NAME:    return await startEditField(ctx, lang, 'name');
      case CB.EDIT_CONTENT: return await startEditField(ctx, lang, 'content');
      case CB.EDIT_TTL:     return await startEditField(ctx, lang, 'ttl');

      case CB.CANCEL:  return await handleCancel(ctx, lang);

      case 'noop': return; // pagination label button

      default:
        await ctx.answerCallbackQuery({ text: '?' });
    }
  } catch (err) {
    console.error(`[callback:${action}]`, err);
    await ctx.editMessageText(t(lang, 'error'), { parse_mode: 'Markdown' }).catch(() =>
      ctx.reply(t(lang, 'error'), { parse_mode: 'Markdown' })
    );
  }
}

// ─── Screens ──────────────────────────────────────────────────────────────────

async function showMainMenu(ctx, lang) {
  ctx.session.step = null;
  await edit(ctx, t(lang, 'mainMenu'), mainMenuKb(lang));
}

async function showHelp(ctx, lang) {
  const kb = new InlineKeyboard().text(t(lang, 'back'), CB.MAIN_MENU);
  await edit(ctx, t(lang, 'help'), kb);
}

async function showTokenPrompt(ctx, lang) {
  ctx.session.step = 'await_token';
  await edit(ctx, t(lang, 'askToken'), cancelKb(lang));
}

async function showZones(ctx, lang, user, page) {
  await edit(ctx, t(lang, 'zonesLoading'));
  const zones = await listZones(user.cf_api_token);

  if (!zones.length) {
    return edit(ctx, t(lang, 'zonesEmpty'), mainMenuKb(lang));
  }

  await edit(ctx, t(lang, 'zonesTitle'), zonesKb(lang, zones, page));
}

async function selectZone(ctx, lang, user, zoneId, zoneName) {
  ctx.session.zoneId   = zoneId;
  ctx.session.zoneName = decodeURIComponent(zoneName ?? zoneId);
  await showRecords(ctx, lang, user, 1);
}

async function showRecords(ctx, lang, user, page) {
  await edit(ctx, t(lang, 'recordsLoading'));
  const { records, totalPages } = await listRecords(
    user.cf_api_token,
    ctx.session.zoneId,
    page
  );

  if (!records.length) {
    return edit(ctx, t(lang, 'recordsEmpty'), recordsKb(lang, [], page, 1));
  }

  await edit(
    ctx,
    t(lang, 'recordsTitle', ctx.session.zoneName),
    recordsKb(lang, records, page, totalPages)
  );
}

async function showRecord(ctx, lang, user, recordId) {
  ctx.session.recordId = recordId;
  const record = await getRecord(user.cf_api_token, ctx.session.zoneId, recordId);
  await edit(ctx, t(lang, 'recordDetail', record), recordDetailKb(lang, record));
}

// ─── Proxy toggle ─────────────────────────────────────────────────────────────

async function toggleProxy(ctx, lang, user, recordId) {
  const record = await getRecord(user.cf_api_token, ctx.session.zoneId, recordId);
  const updated = await updateRecord(
    user.cf_api_token,
    ctx.session.zoneId,
    recordId,
    { proxied: !record.proxied }
  );
  const freshRecord = await getRecord(user.cf_api_token, ctx.session.zoneId, recordId);
  await edit(
    ctx,
    t(lang, 'proxyUpdated', freshRecord.proxied) + '\n\n' + t(lang, 'recordDetail', freshRecord),
    recordDetailKb(lang, freshRecord)
  );
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function confirmDelete(ctx, lang, user, recordId) {
  const record = await getRecord(user.cf_api_token, ctx.session.zoneId, recordId);
  await edit(ctx, t(lang, 'deleteConfirm', record), deleteConfirmKb(lang, recordId));
}

async function doDelete(ctx, lang, user, recordId) {
  await deleteRecord(user.cf_api_token, ctx.session.zoneId, recordId);
  // Go back to records list after deletion
  await showRecords(ctx, lang, user, 1);
  // Send a separate notification (editMessageText already replaced the message)
  await ctx.reply(t(lang, 'deleteSuccess'), { parse_mode: 'Markdown' });
}

// ─── Add record wizard ────────────────────────────────────────────────────────

async function startAdd(ctx, lang) {
  ctx.session.addData = {};
  await edit(ctx, t(lang, 'addSelectType'), recordTypeKb(lang));
}

async function addSelectType(ctx, lang, type) {
  ctx.session.addData.type = type;
  ctx.session.step = 'add_name';
  await edit(ctx, t(lang, 'addAskName', type), cancelKb(lang));
}

async function finishAdd(ctx, lang, user, proxied) {
  const { type, name, content, ttl } = ctx.session.addData;
  ctx.session.step = null;

  try {
    const record = await createRecord(user.cf_api_token, ctx.session.zoneId, {
      type, name, content, ttl, proxied,
    });
    await edit(
      ctx,
      t(lang, 'addSuccess') + '\n\n' + t(lang, 'recordDetail', record),
      recordDetailKb(lang, record)
    );
  } catch (err) {
    console.error('[add record]', err.message);
    await edit(ctx, t(lang, 'addFailed') + `\n\n_${err.message}_`, cancelKb(lang));
  }
}

// ─── Edit record ──────────────────────────────────────────────────────────────

async function startEdit(ctx, lang, recordId) {
  ctx.session.recordId = recordId;
  ctx.session.editData = {};
  await edit(ctx, t(lang, 'editSelectField'), editFieldKb(lang));
}

async function startEditField(ctx, lang, field) {
  ctx.session.editData.field = field;
  ctx.session.step = 'edit_value';
  const fieldLabel = {
    name:    t(lang, 'editFieldName'),
    content: t(lang, 'editFieldContent'),
    ttl:     t(lang, 'editFieldTtl'),
  }[field];
  await edit(ctx, t(lang, 'editAskValue', fieldLabel), cancelKb(lang));
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

async function handleCancel(ctx, lang) {
  ctx.session.step = null;
  ctx.session.addData = {};
  ctx.session.editData = {};
  await edit(ctx, t(lang, 'mainMenu'), mainMenuKb(lang));
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Edit the current message text + keyboard, or fall back to a new message. */
async function edit(ctx, text, keyboard) {
  const opts = {
    parse_mode: 'Markdown',
    ...(keyboard ? { reply_markup: keyboard } : {}),
  };
  try {
    await ctx.editMessageText(text, opts);
  } catch {
    await ctx.reply(text, opts);
  }
}

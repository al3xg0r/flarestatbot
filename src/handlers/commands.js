// ─── Command Handlers ─────────────────────────────────────────────────────────

import { t, getLang } from '../i18n/index.js';
import { getUser, saveUser } from '../api/db.js';
import { verifyToken } from '../api/cloudflare.js';
import { mainMenuKb, cancelKb } from '../utils/keyboards.js';

/**
 * /start
 * - New user: ask for token
 * - Existing user: show main menu
 */
export async function handleStart(ctx) {
  const lang = getLang(ctx);
  const user = await getUser(ctx.env.DB, ctx.from.id);

  if (!user) {
    ctx.session.step = 'await_token';
    await ctx.reply(t(lang, 'askToken'), {
      parse_mode: 'Markdown',
      reply_markup: cancelKb(lang),
      link_preview_options: { is_disabled: true },
    });
  } else {
    ctx.session.step = null;
    await ctx.reply(t(lang, 'mainMenu'), {
      parse_mode: 'Markdown',
      reply_markup: mainMenuKb(lang),
    });
  }
}

/**
 * /token — force token update
 */
export async function handleToken(ctx) {
  const lang = getLang(ctx);
  ctx.session.step = 'await_token';
  await ctx.reply(t(lang, 'askToken'), {
    parse_mode: 'Markdown',
    reply_markup: cancelKb(lang),
    link_preview_options: { is_disabled: true },
  });
}

/**
 * /help
 */
export async function handleHelp(ctx) {
  const lang = getLang(ctx);
  await ctx.reply(t(lang, 'help'), { parse_mode: 'Markdown' });
}

/**
 * Process incoming text messages based on current session step.
 * Returns true if the message was consumed, false otherwise.
 */
export async function handleText(ctx) {
  const lang = getLang(ctx);
  const step = ctx.session.step;
  const text = ctx.message?.text ?? '';

  // ── Ignore commands ──
  if (text.startsWith('/')) return false;

  switch (step) {
    case 'await_token':
      return await processToken(ctx, lang, text.trim());

    case 'add_name':
      ctx.session.addData.name = text.trim();
      ctx.session.step = 'add_content';
      await ctx.reply(t(lang, 'addAskContent', ctx.session.addData.type), {
        parse_mode: 'Markdown',
      });
      return true;

    case 'add_content':
      ctx.session.addData.content = text.trim();
      ctx.session.step = 'add_ttl';
      await ctx.reply(t(lang, 'addAskTtl'), { parse_mode: 'Markdown' });
      return true;

    case 'add_ttl': {
      const ttl = parseTtl(text);
      if (ttl === null) {
        await ctx.reply(t(lang, 'invalidTtl'), { parse_mode: 'Markdown' });
        return true;
      }
      ctx.session.addData.ttl = ttl;
      ctx.session.step = 'add_proxy';
      const { proxyKb } = await import('../utils/keyboards.js');
      await ctx.reply(t(lang, 'addAskProxy'), {
        parse_mode: 'Markdown',
        reply_markup: proxyKb(lang),
      });
      return true;
    }

    case 'edit_value':
      return await processEditValue(ctx, lang, text.trim());

    default:
      return false;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function processToken(ctx, lang, token) {
  const isValid = await verifyToken(token);
  if (!isValid) {
    await ctx.reply(t(lang, 'tokenInvalid'), { parse_mode: 'Markdown' });
    return true;
  }

  const isUpdate = !!(await getUser(ctx.env.DB, ctx.from.id));
  await saveUser(ctx.env.DB, ctx.from.id, token, lang);
  ctx.session.step = null;

  const msg = isUpdate ? t(lang, 'tokenUpdated') : t(lang, 'tokenSaved');
  await ctx.reply(msg, {
    parse_mode: 'Markdown',
    reply_markup: isUpdate ? mainMenuKb(lang) : undefined,
  });
  return true;
}

async function processEditValue(ctx, lang, value) {
  const { zoneId, recordId, editData } = ctx.session;
  const field = editData.field;

  let patch = {};
  if (field === 'name')    patch.name    = value;
  if (field === 'content') patch.content = value;
  if (field === 'ttl') {
    const ttl = parseTtl(value);
    if (ttl === null) {
      await ctx.reply(t(lang, 'invalidTtl'), { parse_mode: 'Markdown' });
      return true;
    }
    patch.ttl = ttl;
  }

  const { updateRecord, getRecord } = await import('../api/cloudflare.js');
  const { recordDetailKb } = await import('../utils/keyboards.js');
  const user = await getUser(ctx.env.DB, ctx.from.id);

  try {
    await updateRecord(user.cf_api_token, zoneId, recordId, patch);
    const updated = await getRecord(user.cf_api_token, zoneId, recordId);
    ctx.session.step = null;
    await ctx.reply(
      t(lang, 'editSuccess') + '\n\n' + t(lang, 'recordDetail', updated),
      { parse_mode: 'Markdown', reply_markup: recordDetailKb(lang, updated) }
    );
  } catch (err) {
    await ctx.reply(t(lang, 'editFailed'), { parse_mode: 'Markdown' });
  }
  return true;
}

function parseTtl(text) {
  const n = parseInt(text, 10);
  if (isNaN(n) || n < 0) return null;
  return n === 0 ? 1 : n; // CF uses 1 for "auto"
}

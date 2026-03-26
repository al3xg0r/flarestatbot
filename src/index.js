// ─── Flare Stat Bot — Entry Point ────────────────────────────────────────────
// Cloudflare Worker: handles Telegram webhook POST requests.
// Tech: grammY + Cloudflare D1 (DB) + Cloudflare KV (sessions)

import { Bot, webhookCallback, session } from 'grammy';
import { handleStart, handleToken, handleHelp, handleText } from './handlers/commands.js';
import { handleCallback } from './handlers/callbacks.js';
import { initialSession, kvSessionStorage } from './utils/session.js';
import { t, getLang } from './i18n/index.js';

// ─── Build bot ────────────────────────────────────────────────────────────────

function buildBot(env) {
  const bot = new Bot(env.BOT_TOKEN);

  // ── Session middleware (KV-backed) ──
  bot.use(session({
    initial: initialSession,
    storage: kvSessionStorage(env.SESSION_KV),
    getSessionKey: (ctx) => ctx.from?.id?.toString() ?? undefined,
  }));

  // ── Inject env into ctx so handlers can access DB, KV, etc. ──
  bot.use(async (ctx, next) => {
    ctx.env = env;
    await next();
  });

  // ── Commands ──
  bot.command('start', handleStart);
  bot.command('token', handleToken);
  bot.command('help',  handleHelp);

  // ── Callback queries ──
  bot.on('callback_query:data', handleCallback);

  // ── Text messages (wizard steps) ──
  bot.on('message:text', async (ctx) => {
    const handled = await handleText(ctx);
    if (!handled) {
      const lang = getLang(ctx);
      await ctx.reply(t(lang, 'unknownCommand'), { parse_mode: 'Markdown' });
    }
  });

  // ── Global error handler ──
  bot.catch((err) => {
    console.error('[bot error]', err.message, err.ctx?.update);
  });

  return bot;
}

// ─── Worker fetch handler ─────────────────────────────────────────────────────

export default {
  async fetch(request, env, _ctx) {
    // Only accept POST to /webhook
    if (request.method !== 'POST') {
      return new Response('Flare Stat Bot is running.', { status: 200 });
    }

    try {
      const bot = buildBot(env);
      const handler = webhookCallback(bot, 'cloudflare-mod');
      return await handler(request);
    } catch (err) {
      console.error('[worker error]', err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};

import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { cfApi } from "./modules/api.js";
import { getI18n, zonesKb, recordsKb } from "./modules/keyboards.js";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        // --- START & WELCOME ---
        bot.command("start", async (ctx) => {
            const lang = getI18n(ctx);
            await env.DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(ctx.from.id).run();
            await ctx.reply(lang.welcome, { parse_mode: "Markdown", disable_web_page_preview: true });
        });

        // --- TOKEN SAVING ---
        bot.on("message:text", async (ctx) => {
            const token = ctx.message.text.trim();
            if (token.length > 30) {
                const lang = getI18n(ctx);
                await env.DB.prepare("UPDATE users SET cf_token = ? WHERE user_id = ?").bind(token, ctx.from.id).run();
                const kb = new InlineKeyboard().text(lang.my_zones, "list_zones");
                await ctx.reply(lang.token_saved, { reply_markup: kb });
            }
        });

        // --- LIST ZONES ---
        bot.callbackQuery("list_zones", async (ctx) => {
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const zones = await cfApi(user.cf_token, "/zones");
            if (!zones.success) return ctx.answerCallbackQuery("Error");

            await ctx.editMessageText(getI18n(ctx).choose_zone, { reply_markup: zonesKb(zones.result) });
            await ctx.answerCallbackQuery();
        });

        // --- LIST RECORDS ---
        bot.callbackQuery(/^z:(.+)$/, async (ctx) => {
            const zoneId = ctx.match[1];
            await env.DB.prepare("UPDATE users SET current_zone_id = ? WHERE user_id = ?").bind(zoneId, ctx.from.id).run();
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            
            const records = await cfApi(user.cf_token, `/zones/${zoneId}/dns_records`);
            await ctx.editMessageText(getI18n(ctx).records, { reply_markup: recordsKb(records.result, getI18n(ctx)) });
            await ctx.answerCallbackQuery();
        });

        // --- RECORD MENU (PROXY/DELETE) ---
        bot.callbackQuery(/^r:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const recInfo = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`);
            
            const lang = getI18n(ctx);
            const rec = recInfo.result;
            const kb = new InlineKeyboard()
                .text(rec.proxied ? lang.proxy_on : lang.proxy_off, `toggle:${recId}`).row()
                .text(lang.del, `del:${recId}`).row()
                .text(lang.back, `z:${user.current_zone_id}`);

            await ctx.editMessageText(`📝 *${rec.type}* ${rec.name}\nValue: \`${rec.content}\``, { 
                reply_markup: kb, parse_mode: "Markdown" 
            });
            await ctx.answerCallbackQuery();
        });

        // --- TOGGLE PROXY ---
        bot.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const current = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`);
            
            await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`, 'PATCH', {
                proxied: !current.result.proxied
            });

            // Обновляем это же меню
            bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `r:${recId}` } });
            await ctx.answerCallbackQuery();
        });

        if (request.method === "POST") return webhookCallback(bot, "cloudflare-mod")(request);
        return new Response("OK");
    }
};
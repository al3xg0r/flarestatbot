import { Bot, webhookCallback, InlineKeyboard } from "grammy";
import { cfApi } from "./modules/api.js";
import { getI18n, zonesKb, recordsKb, recordMenuKb, recordTypesKb } from "./modules/keyboards.js";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        bot.command("start", async (ctx) => {
            await env.DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(ctx.from.id).run();
            await env.DB.prepare("UPDATE users SET state = NULL, state_data = NULL WHERE user_id = ?").bind(ctx.from.id).run();
            await ctx.reply(getI18n(ctx).welcome, { parse_mode: "Markdown", disable_web_page_preview: true });
        });

        // --- STATE MACHINE (Обработка текста) ---
        bot.on("message:text", async (ctx) => {
            const text = ctx.message.text.trim();
            const lang = getI18n(ctx);
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();

            if (!user.state && text.length > 30) {
                await env.DB.prepare("UPDATE users SET cf_token = ? WHERE user_id = ?").bind(text, ctx.from.id).run();
                const kb = new InlineKeyboard().text(lang.my_zones, "list_zones");
                return ctx.reply(lang.token_saved, { reply_markup: kb });
            }

            // Обработка редактирования записи
            if (user.state === 'wait_edit') {
                const recId = user.state_data;
                const res = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`, 'PATCH', { content: text });
                await env.DB.prepare("UPDATE users SET state = NULL, state_data = NULL WHERE user_id = ?").bind(ctx.from.id).run();
                return ctx.reply(res.success ? lang.success : lang.error, { reply_markup: new InlineKeyboard().text(lang.my_zones, "list_zones") });
            }

            // Обработка добавления (Имя)
            if (user.state === 'wait_add_name') {
                await env.DB.prepare("UPDATE users SET state = 'wait_add_content', state_data = ? WHERE user_id = ?").bind(JSON.stringify({ type: user.state_data, name: text }), ctx.from.id).run();
                return ctx.reply(lang.wait_add_content);
            }

            // Обработка добавления (Значение)
            if (user.state === 'wait_add_content') {
                const data = JSON.parse(user.state_data);
                const res = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records`, 'POST', {
                    type: data.type,
                    name: data.name,
                    content: text,
                    proxied: data.type !== 'TXT' && data.type !== 'MX' // Авто-прокси кроме TXT/MX
                });
                await env.DB.prepare("UPDATE users SET state = NULL, state_data = NULL WHERE user_id = ?").bind(ctx.from.id).run();
                return ctx.reply(res.success ? lang.success : lang.error, { reply_markup: new InlineKeyboard().text(lang.my_zones, "list_zones") });
            }
        });

        bot.callbackQuery("list_zones", async (ctx) => {
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const zones = await cfApi(user.cf_token, "/zones");
            if (!zones.success) return ctx.answerCallbackQuery("Error");
            await ctx.editMessageText(getI18n(ctx).choose_zone, { reply_markup: zonesKb(zones.result) });
        });

        bot.callbackQuery(/^z:(.+)$/, async (ctx) => {
            const zoneId = ctx.match[1];
            await env.DB.prepare("UPDATE users SET current_zone_id = ? WHERE user_id = ?").bind(zoneId, ctx.from.id).run();
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const records = await cfApi(user.cf_token, `/zones/${zoneId}/dns_records`);
            await ctx.editMessageText(getI18n(ctx).records, { reply_markup: recordsKb(records.result, getI18n(ctx)) });
        });

        bot.callbackQuery(/^r:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const recInfo = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`);
            const rec = recInfo.result;
            await ctx.editMessageText(`📝 *${rec.type}* ${rec.name}\nValue: \`${rec.content}\``, { 
                reply_markup: recordMenuKb(rec, getI18n(ctx), user.current_zone_id), parse_mode: "Markdown" 
            });
        });

        // --- УПРАВЛЕНИЕ: PROXY, EDIT, DELETE, ADD ---
        bot.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const current = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`);
            await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`, 'PATCH', { proxied: !current.result.proxied });
            bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `r:${recId}` } });
            await ctx.answerCallbackQuery();
        });

        bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recId}`, 'DELETE');
            bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `z:${user.current_zone_id}` } });
            await ctx.answerCallbackQuery(getI18n(ctx).success);
        });

        bot.callbackQuery(/^edit:(.+)$/, async (ctx) => {
            const recId = ctx.match[1];
            await env.DB.prepare("UPDATE users SET state = 'wait_edit', state_data = ? WHERE user_id = ?").bind(recId, ctx.from.id).run();
            await ctx.reply(getI18n(ctx).wait_edit);
            await ctx.answerCallbackQuery();
        });

        bot.callbackQuery("add_record", async (ctx) => {
            await ctx.editMessageText(getI18n(ctx).wait_add_type, { reply_markup: recordTypesKb() });
            await ctx.answerCallbackQuery();
        });

        bot.callbackQuery(/^type:(.+)$/, async (ctx) => {
            const type = ctx.match[1];
            await env.DB.prepare("UPDATE users SET state = 'wait_add_name', state_data = ? WHERE user_id = ?").bind(type, ctx.from.id).run();
            await ctx.reply(getI18n(ctx).wait_add_name);
            await ctx.answerCallbackQuery();
        });

        bot.callbackQuery("cancel_state", async (ctx) => {
            await env.DB.prepare("UPDATE users SET state = NULL, state_data = NULL WHERE user_id = ?").bind(ctx.from.id).run();
            const user = await env.DB.prepare("SELECT current_zone_id FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `z:${user.current_zone_id}` } });
            await ctx.answerCallbackQuery();
        });

        if (request.method === "POST") return webhookCallback(bot, "cloudflare-mod")(request);
        return new Response("OK");
    }
};
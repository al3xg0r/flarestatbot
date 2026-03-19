import { Bot, webhookCallback, InlineKeyboard } from "grammy";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        // --- ЛОКАЛИЗАЦИЯ ---
        const i18n = {
            ru: {
                start: "👋 *Flare Stat Manager*\n\nОтправьте ваш Cloudflare API Token:",
                saved: "✅ Токен сохранен!",
                my_zones: "🌐 Мои домены",
                choose_zone: "Выберите домен:",
                back_zones: "⬅️ К доменам",
                records: "DNS записи",
                err_api: "❌ Ошибка API. Проверьте токен.",
                proxy_on: "Прокси: Включен 🟠",
                proxy_off: "Прокси: Выключен 🔘",
                delete: "🗑 Удалить",
                deleted: "✅ Запись удалена"
            },
            en: {
                start: "👋 *Flare Stat Manager*\n\nSend your Cloudflare API Token:",
                saved: "✅ Token saved!",
                my_zones: "🌐 My Domains",
                choose_zone: "Select a domain:",
                back_zones: "⬅️ Back to domains",
                records: "DNS Records",
                err_api: "❌ API Error. Check token.",
                proxy_on: "Proxy: ON 🟠",
                proxy_off: "Proxy: OFF 🔘",
                delete: "🗑 Delete",
                deleted: "✅ Record deleted"
            }
        };

        const getLang = (ctx) => {
            const lang = ctx.from?.language_code === 'ru' ? 'ru' : 'en';
            return i18n[lang];
        };

        // --- ФУНКЦИЯ CLOUDFLARE API ---
        const cfApi = async (token, path, method = 'GET', body = null) => {
            const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            return await res.json();
        };

        // --- START ---
        bot.command("start", async (ctx) => {
            const lang = getLang(ctx);
            await env.DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(ctx.from.id).run();
            // Сбрасываем стейт
            await env.DB.prepare("UPDATE users SET state = NULL, state_data = NULL WHERE user_id = ?").bind(ctx.from.id).run();
            await ctx.reply(lang.start, { parse_mode: "Markdown" });
        });

        // --- ОБРАБОТКА ТЕКСТА (Токены и Стейты) ---
        bot.on("message:text", async (ctx) => {
            const text = ctx.message.text.trim();
            const lang = getLang(ctx);
            const user = await env.DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(ctx.from.id).first();

            // Если это длинная строка — скорее всего токен
            if (text.length > 30 && !user.state) {
                await env.DB.prepare("UPDATE users SET cf_token = ? WHERE user_id = ?").bind(text, ctx.from.id).run();
                const kb = new InlineKeyboard().text(lang.my_zones, "list_zones");
                return ctx.reply(lang.saved, { reply_markup: kb });
            }

            // Место для будущей логики добавления записей (state == 'add_record_name' и т.д.)
        });

        // --- СПИСОК ДОМЕНОВ ---
        bot.callbackQuery("list_zones", async (ctx) => {
            const lang = getLang(ctx);
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const zones = await cfApi(user.cf_token, "/zones");

            if (!zones.success) return ctx.answerCallbackQuery(lang.err_api);

            const kb = new InlineKeyboard();
            zones.result.forEach(z => kb.text(z.name, `z:${z.id}`).row());

            await ctx.editMessageText(lang.choose_zone, { reply_markup: kb });
            await ctx.answerCallbackQuery();
        });

        // --- ВЫБОР ДОМЕНА -> КЭШИРОВАНИЕ И СПИСОК DNS ---
        bot.callbackQuery(/^z:(.+)$/, async (ctx) => {
            const lang = getLang(ctx);
            const zoneId = ctx.match[1];
            
            // Кэшируем Zone ID в БД, чтобы не таскать его в кнопках
            await env.DB.prepare("UPDATE users SET current_zone_id = ? WHERE user_id = ?").bind(zoneId, ctx.from.id).run();
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            
            const records = await cfApi(user.cf_token, `/zones/${zoneId}/dns_records`);
            if (!records.success) return ctx.answerCallbackQuery(lang.err_api);

            const kb = new InlineKeyboard();
            records.result.slice(0, 15).forEach(rec => {
                const proxy = rec.proxied ? "🟠" : "🔘";
                // Передаем только Record ID! Zone ID мы возьмем из БД
                kb.text(`${proxy} ${rec.type} | ${rec.name}`, `r:${rec.id}`).row();
            });
            kb.text(lang.back_zones, "list_zones");

            await ctx.editMessageText(`${lang.records}:`, { reply_markup: kb });
            await ctx.answerCallbackQuery();
        });

        // --- УПРАВЛЕНИЕ КОНКРЕТНОЙ ЗАПИСЬЮ (PROXY И УДАЛЕНИЕ) ---
        bot.callbackQuery(/^r:(.+)$/, async (ctx) => {
            const lang = getLang(ctx);
            const recordId = ctx.match[1];
            const user = await env.DB.prepare("SELECT cf_token, current_zone_id FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            
            if (!user.current_zone_id) return ctx.answerCallbackQuery("Error: Zone lost");

            // Получаем инфу о записи
            const recInfo = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recordId}`);
            if (!recInfo.success) return ctx.answerCallbackQuery(lang.err_api);

            const rec = recInfo.result;
            const isProxied = rec.proxied;

            const kb = new InlineKeyboard()
                .text(isProxied ? lang.proxy_on : lang.proxy_off, `toggle:${recordId}`).row()
                .text(lang.delete, `del:${recordId}`).row()
                .text("⬅️ Назад", `z:${user.current_zone_id}`);

            await ctx.editMessageText(`📝 **${rec.type}** ${rec.name}\nСодержимое: \`${rec.content}\``, { reply_markup: kb, parse_mode: "Markdown" });
            await ctx.answerCallbackQuery();
        });

        // --- TOGGLE PROXY ---
        bot.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
            const lang = getLang(ctx);
            const recordId = ctx.match[1];
            const user = await env.DB.prepare("SELECT cf_token, current_zone_id FROM users WHERE user_id = ?").bind(ctx.from.id).first();

            const current = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recordId}`);
            
            await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recordId}`, 'PATCH', {
                proxied: !current.result.proxied
            });

            // Эмулируем нажатие на запись для обновления меню
            ctx.match[1] = recordId;
            bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `r:${recordId}` } });
            await ctx.answerCallbackQuery();
        });

        // --- DELETE RECORD ---
        bot.callbackQuery(/^del:(.+)$/, async (ctx) => {
            const lang = getLang(ctx);
            const recordId = ctx.match[1];
            const user = await env.DB.prepare("SELECT cf_token, current_zone_id FROM users WHERE user_id = ?").bind(ctx.from.id).first();

            const del = await cfApi(user.cf_token, `/zones/${user.current_zone_id}/dns_records/${recordId}`, 'DELETE');
            
            if (del.success) {
                await ctx.answerCallbackQuery(lang.deleted);
                // Возвращаемся в список записей
                bot.handleUpdate({ callback_query: { ...ctx.update.callback_query, data: `z:${user.current_zone_id}` } });
            } else {
                await ctx.answerCallbackQuery(lang.err_api);
            }
        });

        if (request.method === "POST") return webhookCallback(bot, "cloudflare-mod")(request);
        return new Response("OK");
    }
};
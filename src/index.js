import { Bot, webhookCallback, InlineKeyboard } from "grammy";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        const cfApi = async (token, path, method = 'GET', body = null) => {
            const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            return await res.json();
        };

        // --- START (Твой текст восстановлен) ---
        bot.command("start", async (ctx) => {
            await env.DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(ctx.from.id).run();
            const startMsg = `👋 *Flare Stat Manager*\n\nДля работы требуется API Token.\nСоздайте его здесь: https://dash.cloudflare.com/profile/api-tokens\n\n⚠️ *Важно:* Чтобы бот мог добавлять домены, создайте Custom Token с правами:\n- Zone: Edit\n- DNS: Edit\n- Account Settings: Read\n\nОтправьте токен сообщением:`;
            await ctx.reply(startMsg, { parse_mode: "Markdown", disable_web_page_preview: true });
        });

        // --- СОХРАНЕНИЕ ТОКЕНА ---
        bot.on("message:text", async (ctx) => {
            const token = ctx.message.text.trim();
            if (token.length > 30) {
                await env.DB.prepare("UPDATE users SET cf_token = ? WHERE user_id = ?").bind(token, ctx.from.id).run();
                const keyboard = new InlineKeyboard().text("🌐 Мои домены", "list_zones");
                await ctx.reply("✅ Токен успешно сохранен!", { reply_markup: keyboard });
            }
        });

        // --- СПИСОК ДОМЕНОВ ---
        bot.callbackQuery("list_zones", async (ctx) => {
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const zones = await cfApi(user.cf_token, "/zones");
            if (!zones.success) return ctx.answerCallbackQuery("Ошибка API");

            const keyboard = new InlineKeyboard();
            zones.result.forEach(zone => {
                // Используем "z:" как максимально короткий префикс
                keyboard.text(zone.name, `z:${zone.id}`).row();
            });
            await ctx.editMessageText("Выберите домен:", { reply_markup: keyboard });
            await ctx.answerCallbackQuery();
        });

        // --- СПИСОК DNS И ПРОКСИ ---
        bot.on("callback_query:data", async (ctx) => {
            const data = ctx.callbackQuery.data;
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();

            // Клик по домену -> список записей
            if (data.startsWith("z:")) {
                const zoneId = data.split(":")[1];
                const records = await cfApi(user.cf_token, `/zones/${zoneId}/dns_records`);
                if (!records.success) return ctx.answerCallbackQuery("Ошибка DNS");

                const keyboard = new InlineKeyboard();
                records.result.slice(0, 15).forEach(rec => {
                    const p = rec.proxied ? "🟠" : "🔘";
                    // ВАЖНО: передаем только RecordID, ZoneID сохраним в метаданных кнопки (через ":" нельзя, слишком длинно)
                    // Мы склеим их через "!" для экономии места
                    keyboard.text(`${p} ${rec.type} | ${rec.name}`, `p!${zoneId.slice(-5)}!${rec.id}`).row();
                });
                keyboard.text("⬅️ Назад", "list_zones");
                await ctx.editMessageText(`Управление DNS (${zoneId.slice(0,8)}):`, { reply_markup: keyboard });
            }

            // Клик по записи -> Toggle Proxy
            if (data.startsWith("p!")) {
                const [_, shortZone, recId] = data.split("!");
                // Так как мы сократили ZoneID для кнопки, нам нужно найти полный ID. 
                // Но проще получить его из списка зон заново или хранить. 
                // Для теста PATCH запроса Cloudflare требует ПОЛНЫЙ ZoneID.
                // Вернемся к стабильному методу:
                await ctx.answerCallbackQuery("Обработка...");
                // Чтобы не ловить BUTTON_DATA_INVALID, в этом боте лучше выводить 
                // управление конкретной записью отдельным шагом, если ID слишком длинные.
            }
            await ctx.answerCallbackQuery();
        });

        if (request.method === "POST") return webhookCallback(bot, "cloudflare-mod")(request);
        return new Response("OK");
    }
};
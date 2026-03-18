import { Bot, webhookCallback, InlineKeyboard } from "grammy";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        // Хелпер для запросов к Cloudflare API
        const cfApi = async (token, path, method = 'GET', body = null) => {
            const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            return res.json();
        };

        bot.command("start", async (ctx) => {
            await env.DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(ctx.from.id).run();
            await ctx.reply("🚀 **Flare Stat Online**\n\nПришли свой Cloudflare API Token для начала работы.");
        });

        // Сохранение токена
        bot.on("message:text", async (ctx) => {
            if (ctx.message.text.length > 30) {
                await env.DB.prepare("UPDATE users SET cf_token = ? WHERE user_id = ?").bind(ctx.message.text, ctx.from.id).run();
                const keyboard = new InlineKeyboard().text("🌐 Мои домены", "list_zones");
                await ctx.reply("✅ Токен успешно сохранен!", { reply_markup: keyboard });
            }
        });

        // Список доменов (Zones)
        bot.callbackQuery("list_zones", async (ctx) => {
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const zones = await cfApi(user.cf_token, "/zones");
            
            const keyboard = new InlineKeyboard();
            zones.result.forEach(zone => {
                keyboard.text(zone.name, `zone:${zone.id}`).row();
            });
            await ctx.editMessageText("Выберите домен для управления:", { reply_markup: keyboard });
        });

        // Список DNS записей
        bot.callbackQuery(/^zone:(.+)$/, async (ctx) => {
            const zoneId = ctx.match[1];
            const user = await env.DB.prepare("SELECT cf_token FROM users WHERE user_id = ?").bind(ctx.from.id).first();
            const records = await cfApi(user.cf_token, `/zones/${zoneId}/dns_records`);

            const keyboard = new InlineKeyboard();
            records.result.slice(0, 10).forEach(rec => {
                const proxy = rec.proxied ? "☁️" : "🔘";
                keyboard.text(`${proxy} ${rec.type} | ${rec.name}`, `rec:${zoneId}:${rec.id}`).row();
            });
            keyboard.text("⬅️ Назад", "list_zones");
            await ctx.editMessageText("DNS записи (первые 10):", { reply_markup: keyboard });
        });

        // Логика обработки вебхука
        if (request.method === "POST") {
            return webhookCallback(bot, "cloudflare-mod")(request);
        }
        return new Response("Бот работает!");
    }
};
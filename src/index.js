import { Bot, webhookCallback } from "grammy";

export default {
    async fetch(request, env) {
        const bot = new Bot(env.BOT_TOKEN);

        // Команда /start
        bot.command("start", async (ctx) => {
            await env.DB.prepare(
                "INSERT OR IGNORE INTO users (user_id) VALUES (?)"
            ).bind(ctx.from.id).run();
            
            await ctx.reply("Привет! Отправь мне свой Cloudflare API Token для начала работы.");
        });

        // Хендлер для сохранения токена
        bot.on("message:text", async (ctx) => {
            const token = ctx.message.text;
            if (token.length > 30) { // Простая проверка на длину токена
                await env.DB.prepare(
                    "UPDATE users SET cf_token = ? WHERE user_id = ?"
                ).bind(token, ctx.from.id).run();
                await ctx.reply("✅ Токен сохранен! Теперь я могу управлять твоими доменами.");
            }
        });

        // Обработка Webhook
        if (request.method === "POST") {
            return webhookCallback(bot, "cloudflare-mod")(request);
        }

        return new Response("Bot is running!");
    },
};

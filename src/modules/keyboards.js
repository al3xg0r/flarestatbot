import { InlineKeyboard } from "grammy";

export const getI18n = (ctx) => {
    const isRu = ctx.from?.language_code === 'ru';
    return {
        welcome: `👋 *Flare Stat Manager*\n\nДля работы требуется API Token.\nСоздайте его здесь: https://dash.cloudflare.com/profile/api-tokens\n\n⚠️ *Важно:* Чтобы бот мог добавлять домены, создайте Custom Token с правами:\n- Zone: Edit\n- DNS: Edit\n- Account Settings: Read\n\nОтправьте токен сообщением:`,
        my_zones: isRu ? "🌐 Мои домены" : "🌐 My Domains",
        choose_zone: isRu ? "Выберите домен:" : "Select domain:",
        records: isRu ? "DNS записи" : "DNS Records",
        proxy_on: isRu ? "Прокси: Вкл 🟠" : "Proxy: ON 🟠",
        proxy_off: isRu ? "Прокси: Выкл 🔘" : "Proxy: OFF 🔘",
        del: isRu ? "🗑 Удалить" : "🗑 Delete",
        back: isRu ? "⬅️ Назад" : "⬅️ Back",
        token_saved: isRu ? "✅ Токен сохранен!" : "✅ Token saved!"
    };
};

export const zonesKb = (zones) => {
    const kb = new InlineKeyboard();
    zones.forEach(z => kb.text(z.name, `z:${z.id}`).row());
    return kb;
};

export const recordsKb = (records, lang) => {
    const kb = new InlineKeyboard();
    records.slice(0, 15).forEach(rec => {
        const p = rec.proxied ? "🟠" : "🔘";
        kb.text(`${p} ${rec.type} | ${rec.name}`, `r:${rec.id}`).row();
    });
    kb.text(lang.back, "list_zones");
    return kb;
};

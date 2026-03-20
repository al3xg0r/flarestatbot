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
        edit: isRu ? "✏️ Изменить IP/Target" : "✏️ Edit IP/Target",
        add: isRu ? "➕ Добавить запись" : "➕ Add Record",
        back: isRu ? "⬅️ Назад" : "⬅️ Back",
        token_saved: isRu ? "✅ Токен сохранен!" : "✅ Token saved!",
        wait_edit: isRu ? "Отправьте новый IP или Target для этой записи:" : "Send new IP or Target for this record:",
        wait_add_type: isRu ? "Выберите тип записи:" : "Select record type:",
        wait_add_name: isRu ? "Отправьте имя (например, @ для корня или sub):" : "Send name (e.g., @ for root or sub):",
        wait_add_content: isRu ? "Отправьте значение (IP или Target):" : "Send value (IP or Target):",
        success: isRu ? "✅ Успешно выполнено!" : "✅ Successfully executed!",
        error: isRu ? "❌ Ошибка API." : "❌ API Error."
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
    kb.text(lang.add, "add_record").row(); // Кнопка добавления
    kb.text(lang.back, "list_zones");
    return kb;
};

export const recordMenuKb = (rec, lang, zoneId) => {
    return new InlineKeyboard()
        .text(rec.proxied ? lang.proxy_on : lang.proxy_off, `toggle:${rec.id}`).row()
        .text(lang.edit, `edit:${rec.id}`).row() // Кнопка редактирования
        .text(lang.del, `del:${rec.id}`).row()
        .text(lang.back, `z:${zoneId}`);
};

export const recordTypesKb = () => {
    return new InlineKeyboard()
        .text("A", "type:A").text("CNAME", "type:CNAME").row()
        .text("TXT", "type:TXT").text("MX", "type:MX").row()
        .text("Отмена", "cancel_state");
};
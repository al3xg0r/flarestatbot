MESSAGES = {
    "start_auth": {
        "ru": "👋 <b>Flare Stat Manager</b>\n\nДля работы требуется <b>API Token</b>.\nСоздайте его здесь: https://dash.cloudflare.com/profile/api-tokens\n\n⚠️ <b>Важно:</b> Чтобы бот мог добавлять домены, создайте Custom Token с правами:\n- <code>Zone: Edit</code>\n- <code>DNS: Edit</code>\n- <code>Account Settings: Read</code>\n\nОтправьте токен сообщением:",
        "en": "👋 <b>Flare Stat Manager</b>\n\nTo proceed, please provide your <b>API Token</b>.\nCreate it here: https://dash.cloudflare.com/profile/api-tokens\n\n⚠️ <b>Important:</b> To add new domains, create a Custom Token with permissions:\n- <code>Zone: Edit</code>\n- <code>DNS: Edit</code>\n- <code>Account Settings: Read</code>\n\nSend the token as a message:"
    },
    "token_checking": {
        "ru": "⏳ Проверяю токен...",
        "en": "⏳ Verifying token..."
    },
    "token_success": {
        "ru": "✅ Токен принят! Загружаю зоны...",
        "en": "✅ Token accepted! Loading zones..."
    },
    "token_invalid": {
        "ru": "❌ Токен невалиден или не имеет нужных прав.",
        "en": "❌ Invalid token or insufficient permissions."
    },
    "welcome_back": {
        "ru": "Рады видеть вас снова, {name}! Ваши домены:",
        "en": "Welcome back, {name}! Your domains:"
    },
    "token_outdated": {
        "ru": "Ваш сохраненный токен устарел. Введите новый:",
        "en": "Your saved token is outdated. Please enter a new one:"
    },
    "logout_msg": {
        "ru": "Вы вышли из системы. Введите новый токен:",
        "en": "Logged out successfully. Enter a new token:"
    },
    "zone_menu_title": {
        "ru": "Управление зоной:",
        "en": "Zone Management:"
    },
    "session_expired": {
        "ru": "Сессия истекла. Выберите домен заново.",
        "en": "Session expired. Please select the domain again."
    },
    "records_found": {
        "ru": "Найдено записей (A/CNAME): {count}",
        "en": "Records found (A/CNAME): {count}"
    },
    "records_found_limit": {
        "ru": "\n(Показаны первые 30)",
        "en": "\n(First 30 shown)"
    },
    "record_not_found": {
        "ru": "Запись не найдена",
        "en": "Record not found"
    },
    "enter_new_ip": {
        "ru": "Введите новый IP адрес:",
        "en": "Enter the new IP address:"
    },
    "ip_changed": {
        "ru": "✅ IP изменен на {ip}",
        "en": "✅ IP changed to {ip}"
    },
    "enter_name": {
        "ru": "Введите имя (например: app):",
        "en": "Enter name (e.g., app):"
    },
    "record_added": {
        "ru": "✅ Запись добавлена!",
        "en": "✅ Record added successfully!"
    },
    "deleted": {
        "ru": "Удалено",
        "en": "Deleted"
    },
    "error_generic": {
        "ru": "Ошибка: {error}",
        "en": "Error: {error}"
    },
    "error_zones": {
        "ru": "Ошибка получения зон",
        "en": "Error fetching zones"
    },
    "zones_empty": {
        "ru": "Зон не найдено. Попробуйте обновить.",
        "en": "No zones found. Try refreshing."
    },
    "btn_refresh": {
        "ru": "🔄 Обновить",
        "en": "🔄 Refresh"
    },
    "btn_logout": {
        "ru": "🚪 Выйти",
        "en": "🚪 Logout"
    },
    "btn_dns_list": {
        "ru": "📋 DNS Записи",
        "en": "📋 DNS Records"
    },
    "btn_add": {
        "ru": "➕ Добавить запись",
        "en": "➕ Add Record"
    },
    "btn_back_zones": {
        "ru": "🔙 К списку доменов",
        "en": "🔙 Back to Domains"
    },
    "btn_back_menu": {
        "ru": "🔙 Назад в меню",
        "en": "🔙 Back to Menu"
    },
    "btn_edit_ip": {
        "ru": "✏️ Сменить IP",
        "en": "✏️ Edit IP"
    },
    "btn_delete": {
        "ru": "❌ Удалить",
        "en": "❌ Delete"
    },
    "btn_back_list": {
        "ru": "🔙 Назад к записям",
        "en": "🔙 Back to List"
    },
    "btn_add_domain": {
        "ru": "➕ Добавить домен",
        "en": "➕ Add Domain"
    },
    "enter_domain_name": {
        "ru": "Введите имя нового домена (например: example.com):",
        "en": "Enter the new domain name (e.g., example.com):"
    },
    "domain_added": {
        "ru": "✅ Домен {zone} успешно добавлен!",
        "en": "✅ Domain {zone} added successfully!"
    },
    "error_account": {
        "ru": "❌ Ошибка: У токена нет прав на просмотр аккаунта (Account Settings: Read) или создание зон (Zone: Edit).",
        "en": "❌ Error: Token lacks Account Settings: Read or Zone: Edit permissions."
    }
}

def t(key, lang_code, **kwargs):
    lang = 'ru' if lang_code == 'ru' else 'en'
    text = MESSAGES.get(key, {}).get(lang, MESSAGES.get(key, {}).get('en', key))
    if kwargs:
        return text.format(**kwargs)
    return text
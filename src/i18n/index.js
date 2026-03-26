// ─── i18n ────────────────────────────────────────────────────────────────────
// Supported: en, ru. Auto-detected from ctx.from.language_code.

const MESSAGES = {
  en: {
    // General
    welcome: `👋 *Welcome to Flare Stat!*\n\nI help you manage your Cloudflare DNS records right from Telegram.\n\nTo get started, send me your Cloudflare API Token.\n📖 [How to get a token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)`,
    help: `*Available commands:*\n\n/start — Main menu\n/token — Update API token\n/help — This message`,
    mainMenu: '🏠 *Main Menu*\n\nWhat would you like to do?',
    cancelled: '❌ Action cancelled.',
    unknownCommand: '❓ Unknown command. Use /help.',
    error: '⚠️ An error occurred. Please try again.',
    noToken: '🔑 No API token saved. Send /start to add one.',
    back: '« Back',
    cancel: '✖ Cancel',
    yes: '✅ Yes, delete',
    no: '❌ No',

    // Token
    askToken: `🔑 *Enter your Cloudflare API Token*\n\nThe token needs *DNS:Edit* permission.\n📖 [How to create a token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)`,
    tokenSaved: '✅ Token saved! Use /start to open the main menu.',
    tokenInvalid: '❌ Token is invalid or has insufficient permissions. Please check and try again.',
    tokenUpdated: '✅ Token updated successfully.',

    // Zones
    zonesLoading: '⏳ Loading zones…',
    zonesEmpty: '📭 No zones found in your Cloudflare account.',
    zonesTitle: '🌐 *Your Zones*\n\nSelect a domain:',
    pageOf: (cur, total) => `Page ${cur} / ${total}`,
    prev: '‹ Prev',
    next: 'Next ›',

    // Records
    recordsLoading: '⏳ Loading DNS records…',
    recordsEmpty: '📭 No DNS records found for this zone.',
    recordsTitle: (zone) => `📋 *DNS Records — ${zone}*`,
    recordLine: (r) => {
      const proxy = r.proxiable ? (r.proxied ? '🟠' : '⚪') : '➖';
      const name = r.name.length > 30 ? r.name.slice(0, 28) + '…' : r.name;
      return `${proxy} ${r.type} ${name}`;
    },

    // Record detail
    recordDetail: (r) => {
      const proxy = r.proxiable
        ? (r.proxied ? '🟠 Proxied' : '⚪ DNS only')
        : '➖ Not proxiable';
      return `📄 *Record Details*\n\n` +
        `*Type:* \`${r.type}\`\n` +
        `*Name:* \`${r.name}\`\n` +
        `*Content:* \`${r.content}\`\n` +
        `*TTL:* \`${r.ttl === 1 ? 'Auto' : r.ttl + 's'}\`\n` +
        `*Proxy:* ${proxy}`;
    },
    toggleProxyOn: '🟠 Enable Proxy',
    toggleProxyOff: '⚪ Disable Proxy',
    proxyUpdated: (proxied) => proxied ? '🟠 Proxy enabled.' : '⚪ Proxy disabled.',
    editRecord: '✏️ Edit',
    deleteRecord: '🗑 Delete',

    // Delete confirm
    deleteConfirm: (r) =>
      `⚠️ *Are you sure?*\n\nDeleting:\n` +
      `\`${r.type}\` *${r.name}* → \`${r.content}\`\n\n` +
      `This action *cannot* be undone.`,
    deleteSuccess: '✅ Record deleted.',
    deleteFailed: '❌ Failed to delete record. Please try again.',

    // Add record
    addRecord: '➕ Add Record',
    addSelectType: '📝 *Select record type:*',
    addAskName: (type) => `📝 *New ${type} record*\n\nEnter the *name*\n(e.g. \`@\`, \`www\`, \`mail\`):`,
    addAskContent: (type) => {
      const hints = {
        A: 'IPv4 address (e.g. `1.2.3.4`)',
        AAAA: 'IPv6 address',
        CNAME: 'target hostname (e.g. `example.com`)',
        MX: 'mail server hostname',
        TXT: 'text value',
        NS: 'nameserver hostname',
      };
      return `📝 Enter *content* — ${hints[type] ?? 'record value'}:`;
    },
    addAskTtl: '⏱ Enter *TTL* in seconds, or `0` for Auto:',
    addAskProxy: '🔶 *Enable Cloudflare Proxy?*',
    addSuccess: '✅ Record added successfully.',
    addFailed: '❌ Failed to add record. Please try again.',
    invalidTtl: '❌ Invalid TTL. Enter a number in seconds or `0` for Auto.',
    invalidContent: '❌ Invalid value. Please try again.',

    // Edit record
    editSelectField: '✏️ *What would you like to edit?*',
    editFieldName: '📝 Name',
    editFieldContent: '📄 Content',
    editFieldTtl: '⏱ TTL',
    editAskValue: (field) => `✏️ Enter new value for *${field}*:`,
    editSuccess: '✅ Record updated.',
    editFailed: '❌ Failed to update record. Please try again.',

    // Buttons
    btnZones: '🌐 My Zones',
    btnToken: '🔑 Update Token',
    btnHelp: '❓ Help',
  },

  ru: {
    // General
    welcome: `👋 *Добро пожаловать в Flare Stat!*\n\nЯ помогу управлять DNS-записями Cloudflare прямо из Telegram.\n\nДля начала отправь свой Cloudflare API Token.\n📖 [Как получить токен](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)`,
    help: `*Доступные команды:*\n\n/start — Главное меню\n/token — Обновить API токен\n/help — Это сообщение`,
    mainMenu: '🏠 *Главное меню*\n\nЧто хочешь сделать?',
    cancelled: '❌ Действие отменено.',
    unknownCommand: '❓ Неизвестная команда. Используй /help.',
    error: '⚠️ Произошла ошибка. Попробуй ещё раз.',
    noToken: '🔑 Токен не сохранён. Отправь /start чтобы добавить.',
    back: '« Назад',
    cancel: '✖ Отмена',
    yes: '✅ Да, удалить',
    no: '❌ Нет',

    // Token
    askToken: `🔑 *Введи Cloudflare API Token*\n\nТокен должен иметь разрешение *DNS:Edit*.\n📖 [Как создать токен](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)`,
    tokenSaved: '✅ Токен сохранён! Используй /start для открытия меню.',
    tokenInvalid: '❌ Токен недействителен или недостаточно прав. Проверь и попробуй снова.',
    tokenUpdated: '✅ Токен успешно обновлён.',

    // Zones
    zonesLoading: '⏳ Загружаю зоны…',
    zonesEmpty: '📭 Зоны не найдены в аккаунте Cloudflare.',
    zonesTitle: '🌐 *Твои зоны*\n\nВыбери домен:',
    pageOf: (cur, total) => `Страница ${cur} / ${total}`,
    prev: '‹ Назад',
    next: 'Вперёд ›',

    // Records
    recordsLoading: '⏳ Загружаю DNS-записи…',
    recordsEmpty: '📭 DNS-записи не найдены.',
    recordsTitle: (zone) => `📋 *DNS-записи — ${zone}*`,
    recordLine: (r) => {
      const proxy = r.proxiable ? (r.proxied ? '🟠' : '⚪') : '➖';
      const name = r.name.length > 30 ? r.name.slice(0, 28) + '…' : r.name;
      return `${proxy} ${r.type} ${name}`;
    },

    // Record detail
    recordDetail: (r) => {
      const proxy = r.proxiable
        ? (r.proxied ? '🟠 Проксируется' : '⚪ Только DNS')
        : '➖ Проксирование недоступно';
      return `📄 *Детали записи*\n\n` +
        `*Тип:* \`${r.type}\`\n` +
        `*Имя:* \`${r.name}\`\n` +
        `*Содержимое:* \`${r.content}\`\n` +
        `*TTL:* \`${r.ttl === 1 ? 'Авто' : r.ttl + 's'}\`\n` +
        `*Прокси:* ${proxy}`;
    },
    toggleProxyOn: '🟠 Включить прокси',
    toggleProxyOff: '⚪ Выключить прокси',
    proxyUpdated: (proxied) => proxied ? '🟠 Прокси включён.' : '⚪ Прокси выключен.',
    editRecord: '✏️ Редактировать',
    deleteRecord: '🗑 Удалить',

    // Delete confirm
    deleteConfirm: (r) =>
      `⚠️ *Ты уверен?*\n\nБудет удалена запись:\n` +
      `\`${r.type}\` *${r.name}* → \`${r.content}\`\n\n` +
      `Действие *необратимо*.`,
    deleteSuccess: '✅ Запись удалена.',
    deleteFailed: '❌ Не удалось удалить запись. Попробуй ещё раз.',

    // Add record
    addRecord: '➕ Добавить запись',
    addSelectType: '📝 *Выбери тип записи:*',
    addAskName: (type) => `📝 *Новая ${type}-запись*\n\nВведи *имя*\n(например \`@\`, \`www\`, \`mail\`):`,
    addAskContent: (type) => {
      const hints = {
        A: 'IPv4-адрес (например `1.2.3.4`)',
        AAAA: 'IPv6-адрес',
        CNAME: 'целевой хост (например `example.com`)',
        MX: 'почтовый сервер',
        TXT: 'текстовое значение',
        NS: 'nameserver',
      };
      return `📝 Введи *содержимое* — ${hints[type] ?? 'значение'}:`;
    },
    addAskTtl: '⏱ Введи *TTL* в секундах, или `0` для Авто:',
    addAskProxy: '🔶 *Включить Cloudflare Proxy?*',
    addSuccess: '✅ Запись успешно добавлена.',
    addFailed: '❌ Не удалось добавить запись. Попробуй ещё раз.',
    invalidTtl: '❌ Неверный TTL. Введи число в секундах или `0` для Авто.',
    invalidContent: '❌ Неверное значение. Попробуй ещё раз.',

    // Edit record
    editSelectField: '✏️ *Что хочешь изменить?*',
    editFieldName: '📝 Имя',
    editFieldContent: '📄 Содержимое',
    editFieldTtl: '⏱ TTL',
    editAskValue: (field) => `✏️ Введи новое значение для *${field}*:`,
    editSuccess: '✅ Запись обновлена.',
    editFailed: '❌ Не удалось обновить запись. Попробуй ещё раз.',

    // Buttons
    btnZones: '🌐 Мои зоны',
    btnToken: '🔑 Обновить токен',
    btnHelp: '❓ Помощь',
  },
};

/** Resolve language from Telegram's language_code. Defaults to 'en'. */
export function getLang(ctx) {
  return (ctx.from?.language_code ?? '').startsWith('ru') ? 'ru' : 'en';
}

/** Get a message by key. If the message is a function, call it with args. */
export function t(lang, key, ...args) {
  const msg = MESSAGES[lang]?.[key] ?? MESSAGES.en[key];
  if (msg === undefined) return `[missing: ${key}]`;
  return typeof msg === 'function' ? msg(...args) : msg;
}

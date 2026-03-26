// ─── Database helpers (Cloudflare D1) ────────────────────────────────────────

/**
 * Get a user row by Telegram ID. Returns null if not found.
 */
export async function getUser(db, telegramId) {
  const result = await db
    .prepare('SELECT * FROM users WHERE telegram_id = ?')
    .bind(telegramId)
    .first();
  return result ?? null;
}

/**
 * Save (insert or replace) a user's token and language.
 */
export async function saveUser(db, telegramId, cfToken, language) {
  await db
    .prepare(`
      INSERT INTO users (telegram_id, cf_api_token, language, created_at, updated_at)
      VALUES (?, ?, ?, unixepoch(), unixepoch())
      ON CONFLICT(telegram_id) DO UPDATE SET
        cf_api_token = excluded.cf_api_token,
        language     = excluded.language,
        updated_at   = unixepoch()
    `)
    .bind(telegramId, cfToken, language)
    .run();
}

/**
 * Update only the language for a user.
 */
export async function updateLanguage(db, telegramId, language) {
  await db
    .prepare('UPDATE users SET language = ?, updated_at = unixepoch() WHERE telegram_id = ?')
    .bind(language, telegramId)
    .run();
}

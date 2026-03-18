CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    cf_token TEXT,
    lang TEXT DEFAULT 'en'
);

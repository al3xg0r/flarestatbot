# Flare Stat | Cloudflare DNS Manager Bot

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![GrammY](https://img.shields.io/badge/Framework-GrammY-blue)
![Database](https://img.shields.io/badge/Database-Cloudflare_D1-orange)
![KV](https://img.shields.io/badge/Sessions-Cloudflare_KV-yellow)
![License](https://img.shields.io/badge/License-Non--Commercial-red)

**Flare Stat** is a lightweight, serverless Telegram bot for managing your Cloudflare DNS records — right from Telegram. Runs entirely on **Cloudflare Edge** with zero infrastructure to maintain.

---

## ✨ Features

- **Serverless** — runs on Cloudflare Workers, Free Tier compatible
- **DNS Management:**
  - 🌐 List all zones (domains) in your account
  - 📋 Browse DNS records with pagination
  - ➕ Add new records (A, AAAA, CNAME, MX, TXT, NS)
  - ✏️ Edit existing records (name, content, TTL)
  - 🗑 Delete records with confirmation prompt
  - 🟠 Toggle Cloudflare Proxy (orange / grey cloud) per record
- **Smart UX** — inline keyboards, paginated lists, confirm-before-delete
- **Multi-language** — auto-detects Russian or English from Telegram settings
- **Secure** — API tokens stored in Cloudflare D1 (SQLite)
- **Stateful sessions** — wizard flows (add/edit) backed by Cloudflare KV

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Cloudflare Workers (JS ES modules) |
| Bot framework | [GrammY](https://grammy.dev) |
| Database | Cloudflare D1 (SQLite) |
| Session storage | Cloudflare KV |
| Deployment | Wrangler CLI |

---

## 📁 Project Structure

```
flarestatbot/
├── src/
│   ├── index.js              # Worker entry point
│   ├── i18n/
│   │   └── index.js          # EN/RU strings, t() and getLang()
│   ├── api/
│   │   ├── cloudflare.js     # Cloudflare API client
│   │   └── db.js             # D1 database helpers
│   ├── handlers/
│   │   ├── commands.js       # /start, /token, /help + wizard steps
│   │   └── callbacks.js      # All inline button handlers
│   └── utils/
│       ├── callback.js       # Callback data encode/decode (≤64 bytes)
│       ├── keyboards.js      # All inline keyboards
│       └── session.js        # KV-backed session adapter
├── schema.sql
├── wrangler.toml
└── package.json
```

---

## 📦 Deployment

### 1. Clone & install

```bash
git clone https://github.com/al3xg0r/flarestatbot.git
cd flarestatbot
npm install
```

### 2. Create D1 database

```bash
npx wrangler d1 create flarestat_db
```

Copy the `database_id` into `wrangler.toml`.

### 3. Create KV namespace for sessions

```bash
npx wrangler kv namespace create SESSION_KV
```

Copy the `id` into `wrangler.toml`.

### 4. Initialize the database schema

```bash
npx wrangler d1 execute flarestat_db --remote --file=./schema.sql
```

### 5. Set your bot token

```bash
npx wrangler secret put BOT_TOKEN
```

### 6. Deploy

```bash
npx wrangler deploy
```

### 7. Register the webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://<YOUR_WORKER>.<YOUR_SUBDOMAIN>.workers.dev"
```

---

## 🔑 Cloudflare API Token

The bot requires a Cloudflare API token with **DNS:Edit** permission.

👉 [How to create a token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)

---

## 📄 License

This project is licensed under the **Flare Stat Non-Commercial License**.
Commercial use is strictly prohibited. See [LICENSE](LICENSE) for full terms.
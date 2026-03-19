# Flare Stat | Cloudflare Manager Bot (Serverless)

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![GrammY](https://img.shields.io/badge/Framework-GrammY-blue)
![Database](https://img.shields.io/badge/Database-Cloudflare_D1-orange)
![License](https://img.shields.io/badge/License-MIT-green)

**Flare Stat** is a lightweight, serverless Telegram bot built to manage your Cloudflare DNS records. Unlike traditional bots, this one runs on **Cloudflare Edge**, ensuring 100% uptime and minimal latency without the need for a dedicated server.

## 🚀 Key Features

* **Serverless Architecture:** Runs on Cloudflare Workers (Free Tier compatible).
* **Persistent Storage:** Uses Cloudflare D1 (SQLite) to securely store user tokens.
* **DNS Management:**
    * 📋 List all zones (domains) linked to your account.
    * 🔍 View DNS records (A, CNAME, TXT, etc.).
    * 🟠 Toggle Proxy status (Orange/Grey cloud) with one tap.
    * 🗑 Delete records directly from Telegram.
* **Smart UX:** Optimized callback data to bypass Telegram's 64-byte limit.
* **Multi-Language:** Auto-detects user language (English/Russian).

## 🛠 Tech Stack

* **JavaScript (ES6+)**
* **GrammY** (High-performance Telegram Bot Framework)
* **Cloudflare D1** (Serverless SQL Database)
* **Wrangler CLI** (Deployment & Management)

## 📦 Installation & Deployment

1.  **Clone & Install:**
    ```bash
    git clone https://github.com/al3xg0r/flarestatbot.git
    cd flarestatbot
    npm install
    ```

2.  **Database Setup:**
    ```bash
    npx wrangler d1 create flarestat_db
    # Copy the database_id to your wrangler.toml
    npx wrangler d1 execute flarestat_db --remote --file=./schema.sql
    ```

3.  **Secrets Configuration:**
    ```bash
    npx wrangler secret put BOT_TOKEN
    ```

4.  **Deploy:**
    ```bash
    npx wrangler deploy
    ```

5.  **Set Webhook:**
    ```bash
    curl -X POST "[https://api.telegram.org/bot](https://api.telegram.org/bot)<YOUR_TOKEN>/setWebhook?url=https://<YOUR_WORKER>.<YOUR_SUBDOMAIN>.workers.dev"
    ```

## 📄 License
Distributed under the [MIT License](LICENSE).

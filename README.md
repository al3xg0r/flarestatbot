# Flare Stat | Cloudflare Manager Bot

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Aiogram](https://img.shields.io/badge/Aiogram-3.x-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**Flare Stat** is a powerful and secure Telegram bot for managing your Cloudflare DNS records directly from your messenger. Designed for system administrators and developers who need quick access to their infrastructure.

## 🚀 Features

* **Multi-User Support:** Built on SQLite, allowing multiple users to use the bot simultaneously with their own accounts.
* **Secure:** API Tokens are stored locally in the database and are never exposed in logs or config files.
* **Domain Management:** * ➕ **Add new domains (zones)** directly from Telegram.
    * Automatically fetches all zones available to your token.
* **DNS Management:**
    * 📋 **View all DNS record types** (A, CNAME, TXT, MX, NS, etc.).
    * ✏️ Edit record content (IP addresses, text values, targets).
    * ☁️ Toggle Proxy status (Orange/Grey cloud) for supported records.
    * ➕ Add new records.
    * ❌ Delete records.
* **Smart UX:** Caches Zone IDs for faster navigation; handles Telegram button limits automatically.
* **Multi-Language:** Auto-detects user language.

## 🛠 Tech Stack

* **Python 3.10+**
* **aiogram 3.x** (Asynchronous framework)
* **aiohttp** (Async HTTP requests)
* **SQLite3** (Database)

## 📦 Installation

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/al3xg0r/flarestatbot.git
    cd flarestatbot
    ```

2.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configuration:**
    Create a `.env` file in the root directory:
    ```ini
    BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
    ```

5.  **Run the bot:**
    ```bash
    python main.py
    ```

### 🚀 Server Deployment (Systemd)

1.  **Setup directory:**
    ```bash
    mkdir -p /home/user/apps/flarestatbot
    # Clone repo and install requirements as shown above
    ```

2.  **Create Systemd service:**
    `sudo nano /etc/systemd/system/flarestatbot.service`

    ```ini
    [Unit]
    Description=Flare Stat Telegram Bot
    After=network.target

    [Service]
    User=root
    WorkingDirectory=/home/user/apps/flarestatbot
    ExecStart=/home/user/apps/flarestatbot/venv/bin/python main.py
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    ```

3.  **Start the service:**
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable flarestatbot
    sudo systemctl start flarestatbot
    ```

## 🔑 How to get Cloudflare Token?

To fully use the bot (including adding new domains), you need to create a **Custom Token**.

1.  Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2.  Click **Create Token**.
3.  Scroll to the bottom and click **Get started** in the **Custom Token** section.
4.  Configure the following **Permissions**:
    * `Zone` -> `Zone` -> `Edit`
    * `Zone` -> `DNS` -> `Edit`
    * `Account` -> `Account Settings` -> `Read`
5.  Set **Zone Resources** to `Include -> All zones`.
6.  Click **Continue to summary** -> **Create Token**.
7.  Copy the token and send it to the bot.

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)
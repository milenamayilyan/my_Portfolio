# Milena Mayilyan — Portfolio

A modern, production-ready personal portfolio built with Flask + SocketIO, served via Gunicorn + Nginx. Features two independent chat systems: a live human chat and an AI assistant powered by OpenAI GPT.

---

## 🌐 Live URLs

| Version | URL | Notes |
|---|---|---|
| HTTP | http://51.21.162.125 | Main server (EC2) |
| HTTPS | https://hierarchy-int-insurance-largest.trycloudflare.com | Cloudflare tunnel |

> **Speech-to-Text (mic input) requires HTTPS.** Use the Cloudflare URL above to test voice input in the AI Assistant. The HTTP version works for everything except the microphone.

---

## Project Structure

```
milena-portfolio/
├── app.py                  # Flask app + SocketIO + OpenAI proxy routes
├── gunicorn.conf.py        # Gunicorn configuration
├── nginx.conf              # Nginx reverse-proxy config
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (never commit this)
├── .gitignore              # Excludes .env and other sensitive files
├── templates/
│   └── index.html          # Main page (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css       # All styles
    └── js/
        ├── main.js         # Human chat + general frontend logic
        └── ai-assistant.js # AI Assistant widget (chat, TTS, STT)
```

---

## Features

### Portfolio
- Fully responsive (mobile + desktop)
- Custom cursor with hover effects
- Scroll-triggered reveal animations
- Sticky shrinking navbar with active section tracking
- Smooth scroll navigation

### Chat With Me (Human Chat)
- Multi-step form: collects name → email → message
- Real-time delivery via WebSocket (SocketIO) to admin panel
- Contact form with email notification via Flask-Mail
- No AI involved — direct human-to-human messaging

### AI Assistant ✨
- Separate floating button (blue/indigo, distinct from the human chat)
- Powered by OpenAI `gpt-4o-mini`
- Answers only from Milena's CV, projects, skills, volunteer work, and portfolio content — never invents information
- Friendly, conversational tone

**Text-to-Speech:** Web Speech API (`SpeechSynthesis`) — reads AI replies aloud. Works on all browsers without HTTPS.

**Speech-to-Text:** Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) — tap the mic, speak, transcript appears in the input field. **Requires HTTPS** (browser security requirement — not a code limitation). Use the Cloudflare URL to test this feature.

---

## Environment Variables

Create a `.env` file in the project root (never commit it):

```
SECRET_KEY=your-flask-secret-key
ADMIN_PASSWORD=your-admin-password
OPENAI_API_KEY=your-openai-api-key
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-gmail-app-password
TELEGRAM_BOT_TOKEN=your-telegram-bot-token   # optional
TELEGRAM_CHAT_ID=your-telegram-chat-id       # optional
```

---

## Local Development

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables
cp .env.example .env
# Edit .env with your values

# 4. Run the dev server
python app.py
# Visit http://localhost:5000
```

> For Speech-to-Text during local development, run over HTTPS or use `localhost` (browsers allow mic on localhost without HTTPS).

---

## Production Deployment (Ubuntu/Debian VPS)

### 1. System packages

```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx
```

### 2. App setup

```bash
sudo mkdir -p /var/www/milena-portfolio
sudo cp -r . /var/www/milena-portfolio/
cd /var/www/milena-portfolio
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Systemd service

Create `/etc/systemd/system/portfolio.service`:

```ini
[Unit]
Description=Milena Mayilyan Portfolio
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/portfolio
EnvironmentFile=/home/ubuntu/portfolio/.env
ExecStart=/home/ubuntu/portfolio/flaskenv/bin/gunicorn -c gunicorn.conf.py app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable portfolio
sudo systemctl start portfolio
```

### 4. Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/portfolio
sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL — Let's Encrypt (enables mic on all devices)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Once SSL is active, Speech-to-Text works on every browser and device automatically — no code changes needed.

---

## Useful Commands

```bash
# Restart the app
sudo systemctl restart portfolio

# View live logs
journalctl -fu portfolio.service

# Pull latest from GitHub and restart
git pull origin main && sudo systemctl restart portfolio

# Check Nginx logs
sudo tail -30 /var/log/nginx/error.log
sudo tail -30 /var/log/nginx/access.log
```

---

## Email Configuration

For live email notifications, create a Gmail App Password:

1. Google Account → Security → 2-Step Verification → App Passwords
2. Set `MAIL_USERNAME` and `MAIL_PASSWORD` in `.env`

If email is not configured, messages are stored in memory and broadcast via SocketIO to the admin panel. In production, replace the in-memory store with a database (SQLite / PostgreSQL).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Flask, Flask-SocketIO, Flask-Mail |
| AI | OpenAI GPT-4o-mini (chat), Web Speech API (STT/TTS) |
| App server | Gunicorn + Eventlet |
| Web server | Nginx |
| Hosting | AWS EC2 (Ubuntu 24) |
| HTTPS tunnel | Cloudflare |
| Frontend | Vanilla JS, CSS3, Jinja2 |
| Version control | Git + GitHub |

---

## Dependencies

```
flask
flask-socketio
flask-mail
gevent
gevent-websocket
requests
python-dotenv
```

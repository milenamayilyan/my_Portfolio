# Milena Mayilyan — Portfolio

A modern, production-ready personal portfolio built with Flask + SocketIO, served via Gunicorn + Nginx.

## Project Structure

```
milena-portfolio/
├── app.py                  # Flask application + SocketIO + email
├── gunicorn.conf.py        # Gunicorn configuration
├── nginx.conf              # Nginx reverse-proxy config
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── templates/
│   └── index.html          # Main page (Jinja2 template)
└── static/
    ├── css/
    │   └── style.css       # All styles
    └── js/
        └── main.js         # Frontend logic
```

## Local Development

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables (copy .env.example → .env)
cp .env.example .env
# Edit .env with your values

# 4. Run the dev server
python app.py
# Visit http://localhost:5000
```

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
Create `/etc/systemd/system/milena-portfolio.service`:

```ini
[Unit]
Description=Milena Mayilyan Portfolio
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/milena-portfolio
Environment="PATH=/var/www/milena-portfolio/venv/bin"
EnvironmentFile=/var/www/milena-portfolio/.env
ExecStart=/var/www/milena-portfolio/venv/bin/gunicorn -c gunicorn.conf.py app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable milena-portfolio
sudo systemctl start milena-portfolio
sudo mkdir -p /var/log/milena-portfolio
```

### 4. Nginx
```bash
sudo cp nginx.conf /etc/nginx/sites-available/milena-portfolio
# Edit nginx.conf: replace yourdomain.com with your actual domain
sudo ln -s /etc/nginx/sites-available/milena-portfolio /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL (Let's Encrypt)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## Gunicorn — run command (manual)
```bash
gunicorn -c gunicorn.conf.py app:app
```

## Email Configuration

For live email notifications, create a Gmail App Password:
1. Google Account → Security → 2-Step Verification → App Passwords
2. Set `MAIL_USERNAME` and `MAIL_PASSWORD` in `.env`

If email is not configured, the form still works — messages are stored in memory and broadcast via SocketIO. In production, replace the in-memory store with a database (SQLite / PostgreSQL).

## Features
- Fully responsive (mobile + desktop)
- Custom cursor with hover effects
- Scroll-triggered reveal animations
- Sticky shrinking navbar with active section tracking
- Contact form with auto-reply and owner email notification
- SocketIO real-time toast notifications for owner
- Smooth scroll navigation

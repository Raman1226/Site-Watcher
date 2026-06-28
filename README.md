# 🔍 SiteWatcher

> Paste a down website URL, get emailed the moment it comes back online.

A lightweight Node.js app that monitors a website by pinging it on a schedule and sends a Gmail alert when it responds successfully. Auto-stops after your chosen time limit.

---

## Features

- 🔁 Ping a URL every 20, 30, or 60 seconds
- 📧 Gmail alert when the site comes back up
- ⏰ Auto-stop after 30 min, 1 hour, or 2 hours
- 🛑 Manual stop button
- 📊 Live status: ping count + time remaining

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/site-watcher.git
cd site-watcher
npm install
```

### 2. Set up Gmail App Password

You need a Gmail **App Password** (not your real password):

1. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Sign in → Select app: **Mail** → Select device: **Other** → name it "SiteWatcher"
3. Copy the 16-character password

### 3. Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env`:

```
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

### 4. Run it

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

---

## How it works

```
User enters URL + email + interval + duration
        ↓
Express server starts a setInterval loop
        ↓
axios.get(url) every X seconds
        ↓
Got 200 response?
  YES → Nodemailer sends Gmail → stop monitoring
  NO  → keep pinging
        ↓
Time limit hit? → auto stop (no infinite loops)
```

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Backend | Node.js + Express |
| HTTP requests | axios |
| Email | Nodemailer + Gmail |
| Frontend | Vanilla HTML/CSS/JS |
| Scheduling | setInterval + setTimeout |

---

## Project Structure

```
site-watcher/
├── src/
│   └── server.js      # Express server + monitor logic
├── public/
│   └── index.html     # Frontend UI
├── .env.example       # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## What this demonstrates

- HTTP request handling (axios, status codes)
- REST API design (POST /start, GET /status, POST /stop)
- Async/await patterns
- Scheduled jobs with auto-cleanup
- Third-party API integration (Gmail via Nodemailer)
- Resource management (preventing infinite loops)

---

Made by [Your Name](https://github.com/YOUR_USERNAME)

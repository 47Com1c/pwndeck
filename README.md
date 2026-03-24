<div align="center">

```
██╗  ██╗████████╗██████╗     ██████╗  █████╗ ███████╗██╗  ██╗██████╗  ██████╗  █████╗ ██████╗ ██████╗ 
██║  ██║╚══██╔══╝██╔══██╗    ██╔══██╗██╔══██╗██╔════╝██║  ██║██╔══██╗██╔═══██╗██╔══██╗██╔══██╗██╔══██╗
███████║   ██║   ██████╔╝    ██║  ██║███████║███████╗███████║██████╔╝██║   ██║███████║██████╔╝██║  ██║
██╔══██║   ██║   ██╔══██╗    ██║  ██║██╔══██║╚════██║██╔══██║██╔══██╗██║   ██║██╔══██║██╔══██╗██║  ██║
██║  ██║   ██║   ██████╔╝    ██████╔╝██║  ██║███████║██║  ██║██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
╚═╝  ╚═╝   ╚═╝   ╚═════╝     ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
```

<img src="https://img.shields.io/badge/version-1.0.0-00ff99?style=for-the-badge&logo=hackthebox&logoColor=00ff99&labelColor=0a0c0f" />
<img src="https://img.shields.io/badge/python-flask-00ff99?style=for-the-badge&logo=flask&logoColor=00ff99&labelColor=0a0c0f" />
<img src="https://img.shields.io/badge/docker-ready-00ff99?style=for-the-badge&logo=docker&logoColor=00ff99&labelColor=0a0c0f" />
<img src="https://img.shields.io/badge/license-MIT-00ff99?style=for-the-badge&labelColor=0a0c0f" />

</div>

---

## ⚡ Quick Start

```bash
git clone https://github.com/yourusername/htb-dashboard.git
cd htb-dashboard
docker compose up -d
```

Open **http://localhost:5000** — done.

```bash
# Stop
docker compose down
```

---

## 🗂️ Project Structure

```
htb-dashboard/
├── app.py                  ← Flask server
├── requirements.txt
├── templates/
│   └── index.html          ← HTML structure
├── static/
│   ├── style.css           ← All styles + theme variables
│   └── app.js              ← All frontend logic
├── Dockerfile              ← python:alpine + flask
├── docker-compose.yml
└── .dockerignore
```

---

## 🐍 Running without Docker

```bash
pip install -r requirements.txt
python app.py
```

Open **http://localhost:5000**.

---

## 🗺️ Features

| Module | Description |
|---|---|
| **⬡ Machines** | Track HTB machines — IP, OS, difficulty, status |
| **🔍 Recon** | Log open ports and services per machine |
| **⚡ Payloads** | Reverse shells, web shells, MSF — auto-filled with LHOST/LPORT |
| **🗄 Loot Vault** | Flags, credentials, hashes, secrets with one-click copy |
| **🗺 Net Map** | Interactive network topology canvas with drag, zoom & minimap |
| **📝 Writeup** | Auto-generate markdown writeup templates from session data |

---

## 🔌 Adding API Routes

`app.py` is ready for backend routes whenever you need them:

```python
@app.route('/api/export')
def export_session():
    # Future: export session as JSON file
    pass

@app.route('/api/import/nmap', methods=['POST'])
def import_nmap():
    # Future: parse nmap XML and populate ports
    pass
```

---

## 💾 Data Persistence

All data is stored in **browser `localStorage`** — nothing leaves your machine.

```js
// Export session — paste in browser console
copy(localStorage.getItem('htb_v2'))

// Import
localStorage.setItem('htb_v2', '<paste json>')
```

---

## ⚠️ Disclaimer

For **legal, authorized** penetration testing only — CTFs, HackTheBox, TryHackMe, and similar platforms.

---

## 📄 License

MIT

---

<div align="center"><sub>Built for the grind. ⬡</sub></div>

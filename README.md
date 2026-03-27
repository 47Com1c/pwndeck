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

## Setup

```bash
git clone https://github.com/yourusername/htb-dashboard.git
cd htb-dashboard
docker compose up -d
```

Open **http://localhost:5000** 

```bash
# Stop
docker compose down
```

---

## Features

| Module | Description |
|---|---|
| **Machines** | HTB machines tracker|
| **Recon** | Log open ports and services per machine |
| **Payloads** | Reverse shells, web shells, msfvenom|
| **Loot Vault** | Flags, credentials, hashes |
| **Net Map** | Interactive network topology canvas|
| **Writeup** | Auto-generate markdown writeup templates from session data |



---

## Data Persistence

All data is stored in **browser `localStorage`** — nothing leaves your machine.

```js
// Export session — paste in browser console
copy(localStorage.getItem('htb_v2'))

// Import
localStorage.setItem('htb_v2', '<paste json>')
```




## License

MIT


<div align="center"><sub>Built for the grind. ⬡</sub></div>

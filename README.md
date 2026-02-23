# 🍀 Lucky Downloader — Cara Deploy ke Vercel

## Langkah-langkah (5 menit)

### 1. Buat akun Vercel
Daftar gratis di https://vercel.com — bisa login pakai GitHub/Google.

### 2. Upload project
Ada 2 cara:

**Cara A — Pakai GitHub (recommended):**
1. Buat repo baru di GitHub
2. Upload semua file ini (index.html, api/download.js, vercel.json, package.json)
3. Di Vercel → "New Project" → pilih repo kamu → Deploy

**Cara B — Pakai Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### 3. Selesai!
Vercel akan kasih URL seperti `https://lucky-downloader-xxx.vercel.app`
Buka URL itu — Lucky Downloader kamu sudah online!

## Struktur File
```
lucky-downloader/
├── index.html          ← Frontend (UI Lucky Downloader)
├── api/
│   └── download.js     ← Backend (fetch API TikTok, tidak kena CORS)
├── vercel.json         ← Config Vercel
└── package.json        ← Info project
```

## Cara Kerja
- Browser → fetch `/api/download?url=...` (backend sendiri, tidak ada CORS)
- Backend (Vercel serverless) → fetch tikwm.com / tiklydown (dari server, bebas CORS)
- Backend kirim data JSON ke browser
- Klik download → browser fetch `/api/download?proxy=1&url=...`
- Backend stream file video ke browser → auto download

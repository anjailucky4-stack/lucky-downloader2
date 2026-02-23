// server.js — Lucky Downloader Backend
// Jalankan: node server.js
// Buka browser: http://localhost:3000

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT = process.env.PORT || 3000;

/* ════════════════════════════════════════════
   DOWNLOAD ENGINE — fetch API TikTok
   (jalan di Node.js, tidak kena CORS)
   ════════════════════════════════════════════ */

async function fetchTikTok(tiktokUrl) {
  const errors = [];

  // ── API 1: tikwm.com
  try {
    const data = await httpGet(`https://www.tikwm.com/api/?url=${enc(tiktokUrl)}&hd=1`);
    const json = JSON.parse(data);
    if (json.code === 0 && json.data) {
      const d = json.data;
      return {
        ok: true, source: 'tikwm',
        title:    d.title || 'TikTok Video',
        author:   d.author?.nickname || d.author?.unique_id || '',
        cover:    d.cover || d.origin_cover || '',
        duration: d.duration || 0,
        likes:    d.digg_count || 0,
        comments: d.comment_count || 0,
        shares:   d.share_count || 0,
        music:    d.music_info?.title || '',
        nowm:     d.hdplay || d.play || '',
        wm:       d.wmplay || d.play || '',
        audio:    d.music || '',
        images:   d.images || [],
      };
    }
    errors.push('tikwm: ' + (json.msg || 'no data'));
  } catch(e) { errors.push('tikwm: ' + e.message); }

  // ── API 2: tiklydown v3
  try {
    const data = await httpGet(`https://api.tiklydown.eu.org/api/download/v3?url=${enc(tiktokUrl)}`);
    const json = JSON.parse(data);
    if (json.data) {
      const d = json.data;
      return {
        ok: true, source: 'tiklydown',
        title:    d.title || 'TikTok Video',
        author:   d.author?.name || '',
        cover:    d.cover || '',
        duration: 0,
        likes:    d.stats?.likeCount || 0,
        comments: d.stats?.commentCount || 0,
        shares:   d.stats?.shareCount || 0,
        music:    d.music?.title || '',
        nowm:     d.video?.noWatermark || d.video?.downloadAddr || '',
        wm:       d.video?.watermark || d.video?.downloadAddr || '',
        audio:    d.music?.play || '',
        images:   [],
      };
    }
    errors.push('tiklydown: no data');
  } catch(e) { errors.push('tiklydown: ' + e.message); }

  // ── API 3: tiklydown v1
  try {
    const data = await httpGet(`https://api.tiklydown.eu.org/api/download?url=${enc(tiktokUrl)}`);
    const json = JSON.parse(data);
    if (json.data) {
      const d = json.data;
      return {
        ok: true, source: 'tiklydown-v1',
        title:    d.title || 'TikTok Video',
        author:   d.author?.name || '',
        cover:    d.cover || '',
        duration: 0,
        likes:    0, comments: 0, shares: 0,
        music:    d.music?.title || '',
        nowm:     d.video?.noWatermark || '',
        wm:       d.video?.watermark || '',
        audio:    d.music?.play || '',
        images:   [],
      };
    }
    errors.push('tiklydown-v1: no data');
  } catch(e) { errors.push('tiklydown-v1: ' + e.message); }

  return { ok: false, error: 'Semua API gagal', details: errors };
}

/* ── HTTP GET helper (pakai https bawaan Node, no dependency) ── */
function httpGet(targetUrl, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === 'https:' ? require('https') : require('http');
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        'Accept': 'application/json, */*',
        ...extraHeaders,
      },
    };
    const req = lib.request(options, res => {
      // Ikuti redirect
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return httpGet(res.headers.location, extraHeaders).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

/* ── HTTP GET stream (untuk proxy download) ── */
function httpStream(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === 'https:' ? require('https') : require('http');
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    };
    const req = lib.request(options, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        return httpStream(res.headers.location).then(resolve).catch(reject);
      }
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function enc(s) { return encodeURIComponent(s); }

/* ════════════════════════════════════════════
   HTTP SERVER
   ════════════════════════════════════════════ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const query    = parsed.query;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // ── Route: GET /api/download?url=...
  if (pathname === '/api/download' && query.url) {

    // Mode proxy: stream file ke client
    if (query.proxy === '1') {
      try {
        console.log('⬇ Proxy download:', query.url.slice(0,80));
        const upstream = await httpStream(query.url);
        const ct = upstream.headers['content-type'] || 'video/mp4';
        const cl = upstream.headers['content-length'];
        const filename = query.name || 'lucky_download.mp4';
        res.setHeader('Content-Type', ct);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        if (cl) res.setHeader('Content-Length', cl);
        upstream.pipe(res);
      } catch(e) {
        res.writeHead(502, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ ok:false, error: e.message }));
      }
      return;
    }

    // Mode info: fetch metadata
    try {
      console.log('🔍 Fetch:', query.url.slice(0,80));
      const data = await fetchTikTok(query.url);
      res.writeHead(data.ok ? 200 : 502, {'Content-Type':'application/json'});
      res.end(JSON.stringify(data));
    } catch(e) {
      res.writeHead(500, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ ok:false, error: e.message }));
    }
    return;
  }

  // ── Route: serve static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('404 Not Found');
      return;
    }
    const ext  = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': mime});
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('🍀 Lucky Downloader berjalan!');
  const publicUrl = process.env.REPL_SLUG
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : `http://localhost:${PORT}`;
  console.log(`👉 Buka: ${publicUrl}`);
  console.log('   (Tekan Ctrl+C untuk stop)');
  console.log('');
});

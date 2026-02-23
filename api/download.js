// api/download.js — Lucky Downloader Backend
// Deploy ke Vercel: serverless function, jalan di server bukan browser

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url, proxy, name } = req.query;

  if (proxy === '1' && url) {
    try {
      const r = await fetchTimeout(url, 30000);
      if (!r.ok) return res.status(502).json({ error: 'Upstream HTTP ' + r.status });
      const contentType = r.headers.get('content-type') || 'video/mp4';
      const filename = name || 'lucky_download.mp4';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const buf = await r.arrayBuffer();
      return res.send(Buffer.from(buf));
    } catch(e) {
      return res.status(502).json({ error: 'Proxy gagal: ' + e.message });
    }
  }

  if (!url) return res.status(400).json({ error: 'Parameter ?url= wajib diisi' });

  const errors = [];

  try {
    const r = await fetchTimeout(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, 10000);
    const json = await r.json();
    if (json.code === 0 && json.data) {
      const d = json.data;
      return res.status(200).json({
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
      });
    }
    errors.push('tikwm: ' + (json.msg || 'no data'));
  } catch(e) { errors.push('tikwm: ' + e.message); }

  try {
    const r = await fetchTimeout(`https://api.tiklydown.eu.org/api/download/v3?url=${encodeURIComponent(url)}`, 10000);
    const json = await r.json();
    if (json.data) {
      const d = json.data;
      return res.status(200).json({
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
      });
    }
    errors.push('tiklydown: no data');
  } catch(e) { errors.push('tiklydown: ' + e.message); }

  try {
    const r = await fetchTimeout(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, 10000);
    const json = await r.json();
    if (json.data) {
      const d = json.data;
      return res.status(200).json({
        ok: true, source: 'tiklydown-v1',
        title:    d.title || 'TikTok Video',
        author:   d.author?.name || '',
        cover:    d.cover || '',
        duration: 0,
        likes: 0, comments: 0, shares: 0,
        music:    d.music?.title || '',
        nowm:     d.video?.noWatermark || '',
        wm:       d.video?.watermark || '',
        audio:    d.music?.play || '',
        images:   [],
      });
    }
    errors.push('tiklydown-v1: no data');
  } catch(e) { errors.push('tiklydown-v1: ' + e.message); }

  return res.status(502).json({ ok: false, error: 'Semua API gagal', details: errors });
}

function fetchTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}
  

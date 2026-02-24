// ============================================================
//  Climate Resilience Countermeasures — local dev server
//  Node.js built-ins only — no npm required
//  Usage: node server.js
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT     = 3000;
const ROOT     = __dirname;
const CSV_FILE = path.join(ROOT, 'collectionCountermeasures.csv');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.csv':  'text/csv',
  '.ico':  'image/x-icon',
};

const CSV_HEADERS = [
  'County', 'State', 'Country', 'Hazards',
  'Action Title', 'Description', 'Target Groups', 'Phases', 'Links'
];

function csvQuote(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

// ============================================================
//  POST /api/save  — append row + git commit
// ============================================================
function handleSave(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const d = JSON.parse(body);

      const row = [
        d.county   || '',
        d.state    || '',
        d.country  || '',
        (d.hazards  || []).join('; '),
        d.title    || '',
        d.desc     || '',
        (d.targets  || []).join('; '),
        (d.phases   || []).join('; '),
        (d.links    || []).join('; '),
      ].map(csvQuote).join(',');

      // Add header row if the file is empty or missing
      let needsHeader = false;
      try {
        needsHeader = fs.statSync(CSV_FILE).size === 0;
      } catch (_) {
        needsHeader = true;
      }

      const headerLine = CSV_HEADERS.map(csvQuote).join(',') + '\r\n';
      const dataLine   = row + '\r\n';
      fs.appendFileSync(CSV_FILE, (needsHeader ? headerLine : '') + dataLine, 'utf8');

      // Git commit (best-effort — fails gracefully if no git repo or nothing new)
      try {
        execSync(`git -C "${ROOT}" add "${CSV_FILE}"`, { stdio: 'pipe' });
        const msg = `Add countermeasure: ${d.title || 'unnamed'}`;
        execSync(`git -C "${ROOT}" commit -m "${msg.replace(/"/g, "'")}"`, { stdio: 'pipe' });
      } catch (_) { /* git not configured or nothing to commit — non-fatal */ }

      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
}

// ============================================================
//  Static file serving
// ============================================================
function handleStatic(req, res) {
  const urlPath  = req.url.split('?')[0];
  const filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);

  // Prevent path traversal outside ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ============================================================
//  Server
// ============================================================
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/save') return handleSave(req, res);
  if (req.method === 'GET')                              return handleStatic(req, res);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log('\nClimate Resilience Countermeasures');
  console.log(`  Local:  http://localhost:${PORT}`);
  console.log('  Press Ctrl+C to stop\n');
});

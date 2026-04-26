const http = require('http');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`Request: ${req.url}`);

  if (req.url === '/api/runtime/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bridge_status: 'ok', version: '1.0.0-mock' }));
    return;
  }

  if (req.url.startsWith('/api/runtime/jobs')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  if (req.url.startsWith('/api/runtime/recent-renders')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ recent: [] }));
    return;
  }

  if (req.url.startsWith('/api/runtime/timeline')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ events: [] }));
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(8787, () => {
  console.log('Mock DirectorOS Runtime running on http://localhost:8787');
});

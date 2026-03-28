const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3847;
const DATA_FILE = path.join(__dirname, 'data.json');
const INDEX_FILE = path.join(__dirname, 'index.html');

// ===== DATA STORE =====
const DEFAULT_DATA = {
  config: {
    cliente: 'Espaço Viv',
    dateStart: '2026-03-11',
    dateEnd: '2026-04-24',
    valor: 3500,
    metaPosts: 20,
    adsBudget: 0
  },
  tasks: [],
  posts: [],
  campaigns: [],
  ads: { budgetTotal: 0, budgetUsed: 0 },
  performance: {},
  dash_metrics: { adsUsed: 0, adsTotal: 0 },
  report: {},
  report_history: [],
  social_posts: []
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim()) return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving data:', e.message);
  }
}

let appData = loadData();

// ===== SSE CLIENTS =====
const sseClients = new Map();
let clientIdCounter = 0;

function broadcast(section, data, fromUser, excludeId) {
  const msg = JSON.stringify({ section, data, user: fromUser, time: Date.now() });
  for (const [id, client] of sseClients) {
    if (id !== excludeId) {
      try { client.res.write('data: ' + msg + '\n\n'); } catch (e) {}
    }
  }
}

function broadcastUsers() {
  const users = [];
  for (const [id, client] of sseClients) {
    users.push({ id, user: client.user });
  }
  const msg = JSON.stringify({ section: '_users', data: users, time: Date.now() });
  for (const [, client] of sseClients) {
    try { client.res.write('data: ' + msg + '\n\n'); } catch (e) {}
  }
}

// ===== MIME TYPES =====
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// ===== HTTP SERVER =====
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ===== SSE ENDPOINT =====
  if (pathname === '/api/events' && req.method === 'GET') {
    const user = url.searchParams.get('user') || 'Anonimo';
    const clientId = ++clientIdCounter;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('data: ' + JSON.stringify({ section: '_connected', data: { id: clientId } }) + '\n\n');

    sseClients.set(clientId, { res, user });
    broadcastUsers();

    req.on('close', () => {
      sseClients.delete(clientId);
      broadcastUsers();
    });
    return;
  }

  // ===== GET ALL DATA =====
  if (pathname === '/api/data' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(appData));
    return;
  }

  // ===== POST UPDATE SECTION =====
  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        const parsed = JSON.parse(body);
        const section = parsed.section;
        const data = parsed.data;
        const user = parsed.user || 'Sistema';
        const cid = parsed.clientId;

        if (!section || data === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'section and data required' }));
          return;
        }

        appData[section] = data;
        saveData(appData);
        broadcast(section, data, user, cid);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ===== GET ONLINE USERS =====
  if (pathname === '/api/users' && req.method === 'GET') {
    const users = [];
    for (const [id, client] of sseClients) {
      users.push({ id, user: client.user });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
    return;
  }

  // ===== STATIC FILES =====
  let filePath;
  if (pathname === '/') {
    filePath = INDEX_FILE;
  } else {
    filePath = path.join(__dirname, pathname);
  }

  const ext = path.extname(filePath);
  const contentType = (MIME[ext] || 'application/octet-stream') + '; charset=utf-8';

  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, function() {
  console.log('Espaço Viv server running on http://localhost:' + PORT);
  console.log('Data file: ' + DATA_FILE);
});

// Live chat + media upload server (single-port WebSocket at /ws)
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
const PUBLIC_DIR = __dirname;
app.use(express.static(PUBLIC_DIR));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + String(file.originalname || 'file').replace(/[^\w.\-]+/g, '_');
    cb(null, safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/|^video\//.test(file.mimetype)) return cb(new Error('Only images/videos allowed'));
    cb(null, true);
  }
});

app.post('/upload', upload.array('media', 10), (req, res) => {
  const files = (req.files || []).map(f => ({
    name: f.filename,
    url: `/uploads/${f.filename}`
  }));
  res.json({ ok: true, files });
});
app.use('/uploads', express.static(uploadsDir));

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'sys', text: 'Welcome to Green Bandit chat.' }));
  ws.on('message', (msg) => {
    let data; try { data = JSON.parse(msg); } catch (e) { return; }
    if (data.type === 'chat') {
      const outbound = JSON.stringify({
        type: 'chat',
        name: (data.name || 'anon').toString().slice(0, 24),
        text: (data.text || '').toString().slice(0, 500)
      });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(outbound);
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Site available at http://localhost:${PORT}`);
  console.log(`WebSocket on ws://localhost:${PORT}/ws`);
});

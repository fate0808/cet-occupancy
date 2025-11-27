const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { rooms, schedules } = require('./sample-data');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// -----------------------------
// Define STATUS constants first
// -----------------------------
const STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  SOON: 'soon'
};

// -----------------------------
// Helper functions
// -----------------------------
function recomputeOccupancy(rooms, schedules) {
  const now = new Date();
  const out = {};

  rooms.forEach(r => {
    const events = schedules
      .filter(s => s.roomId === r.id)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    const current = events.find(e => new Date(e.start) <= now && new Date(e.end) >= now);
    const next = events.find(e => new Date(e.start) > now);

    let status = STATUS.AVAILABLE;
    let untilFree = null;

    if (current) {
      status = STATUS.OCCUPIED;
      untilFree = current.end;

      const minsLeft = Math.round((new Date(current.end) - now) / 60000);
      if (minsLeft <= 10) status = STATUS.SOON;
    }

    out[r.id] = {
      status,
      untilFree,
      currentEvent: current || null,
      nextEvent: next || null
    };
  });

  return out;
}

function computeInitialOccupancy(rooms, schedules) {
  return recomputeOccupancy(rooms, schedules);
}

// -----------------------------
// Initial occupancy
// -----------------------------
let occupancy = computeInitialOccupancy(rooms, schedules);

// -----------------------------
// APIs
// -----------------------------
app.get('/api/rooms', (req, res) => res.json(rooms));
app.get('/api/schedules', (req, res) => res.json(schedules));
app.get('/api/occupancy', (req, res) => res.json(occupancy));

app.post('/api/schedules', (req, res) => {
  const { roomId, title, start, end } = req.body || {};
  if (!roomId || !title || !start || !end) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  schedules.push({ id: `EVT-${Date.now()}`, roomId, title, start, end });
  occupancy = recomputeOccupancy(rooms, schedules);

  io.emit('schedules:update', schedules);
  io.emit('occupancy:update', occupancy);

  res.status(201).json({ ok: true });
});

// -----------------------------
// Real-time updates
// -----------------------------
setInterval(() => {
  occupancy = recomputeOccupancy(rooms, schedules);
  io.emit('occupancy:update', occupancy);
}, 10000);

io.on('connection', (socket) => {
  socket.emit('schedules:update', schedules);
  socket.emit('occupancy:update', occupancy);
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`CET Occupancy server running at http://localhost:${PORT}`);
});

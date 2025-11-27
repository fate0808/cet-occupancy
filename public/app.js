/* Globals */
const API_BASE = '';
const socket = io();
let rooms = [];
let schedules = [];
let occupancy = {}; // {roomId: {status, untilFree, currentEvent}}

const els = {
  lastUpdated: document.getElementById('lastUpdated'),
  searchInput: document.getElementById('searchInput'),
  statusFilter: document.getElementById('statusFilter'),
  floorFilter: document.getElementById('floorFilter'),
  capacityFilter: document.getElementById('capacityFilter'),
  roomCards: document.getElementById('roomCards'),
  scheduleList: document.getElementById('scheduleList'),
  cetMap: document.getElementById('cetMap'),
  mapTooltip: document.getElementById('mapTooltip'),
  calendarRoom: document.getElementById('calendarRoom'),
};

const STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  SOON: 'soon'
};

function fmt(t) {
  return new Date(t).toLocaleString([], { hour: '2-digit', minute: '2-digit' });
}
function minutesUntil(t) {
  const diffMs = new Date(t).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / 60000));
}
function humanMinutes(m) {
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m/60), mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
function statusToBadge(status) {
  const map = { available: 'green', occupied: 'red', soon: 'yellow' };
  const label = { available: 'Available', occupied: 'Occupied', soon: 'Soon' }[status] || '—';
  return `<span class="badge ${map[status] || ''}">${label}</span>`;
}
function progressPct(start, end) {
  const total = new Date(end) - new Date(start);
  const done = Date.now() - new Date(start);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((done/total)*100)));
}

/* Initial load */
async function loadData() {
  const [roomsRes, schedRes, occRes] = await Promise.all([
    fetch('/api/rooms'),
    fetch('/api/schedules'),
    fetch('/api/occupancy')
  ]);
  rooms = await roomsRes.json();
  schedules = await schedRes.json();
  occupancy = await occRes.json();

  populateCalendarRoomSelect();
  renderAll();
}

function populateCalendarRoomSelect() {
  els.calendarRoom.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  initCalendar(rooms[0]?.id);
}

function filteredRooms() {
  const q = els.searchInput.value.trim().toLowerCase();
  const status = els.statusFilter.value;
  const floor = els.floorFilter.value;
  const cap = els.capacityFilter.value;

  return rooms.filter(r => {
    const occ = occupancy[r.id];
    const statOk = !status || (occ?.status === status);
    const floorOk = !floor || String(r.floor) === floor;
    const capOk =
      !cap ||
      (cap === '<=30' && r.capacity <= 30) ||
      (cap === '31-50' && r.capacity >= 31 && r.capacity <= 50) ||
      (cap === '>50' && r.capacity > 50);
    const qOk = !q || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    return statOk && floorOk && capOk && qOk;
  });
}

function renderCards() {
  const list = filteredRooms();
  els.roomCards.innerHTML = list.map(r => {
    const occ = occupancy[r.id] || {};
    const statusBadge = statusToBadge(occ.status);
    const until = occ.untilFree ? humanMinutes(minutesUntil(occ.untilFree)) : '—';
    const current = occ.currentEvent ? `${occ.currentEvent.title} (${fmt(occ.currentEvent.start)}–${fmt(occ.currentEvent.end)})` : 'No ongoing class';
    const progress = occ.currentEvent ? progressPct(occ.currentEvent.start, occ.currentEvent.end) : 0;

    return `
      <article class="card" tabindex="0" aria-label="${r.name} ${occ.status || ''}">
        <h3>${r.name}</h3>
        <div class="meta">Floor ${r.floor} • Capacity ${r.capacity}</div>
        <div>${statusBadge}</div>
        <div class="meta">Until free: <strong>${until}</strong></div>
        <div class="meta">Now: ${current}</div>
        <div class="progress" aria-label="Class progress"><span style="width:${progress}%"></span></div>
      </article>
    `;
  }).join('');
}

function renderScheduleList() {
  // For each room, show current or next event and time until free
  const items = filteredRooms().map(r => {
    const occ = occupancy[r.id] || {};
    const nowEvent = occ.currentEvent;
    let info = '';
    let timeleft = '';

    if (nowEvent) {
      const minsLeft = minutesUntil(nowEvent.end);
      info = `${nowEvent.title} • ${fmt(nowEvent.start)}–${fmt(nowEvent.end)}`;
      timeleft = `${humanMinutes(minsLeft)} left`;
    } else {
      // next event
      const upcoming = schedules
        .filter(e => e.roomId === r.id && new Date(e.start) > new Date())
        .sort((a,b) => new Date(a.start) - new Date(b.start))[0];
      if (upcoming) {
        const minsTo = minutesUntil(upcoming.start);
        info = `Next: ${upcoming.title} • ${fmt(upcoming.start)}–${fmt(upcoming.end)}`;
        timeleft = `Starts in ${humanMinutes(minsTo)}`;
      } else {
        info = 'No upcoming classes today';
        timeleft = '—';
      }
    }

    const statusBadge = statusToBadge(occ.status);

    return `
      <div class="schedule-item" role="listitem">
        <div class="room">${r.name}</div>
        <div class="info">${info}</div>
        <div class="timeleft">${statusBadge} • ${timeleft}</div>
      </div>
    `;
  }).join('');
  els.scheduleList.innerHTML = items;
}

function initMapInteractions() {
  els.cetMap.querySelectorAll('.room').forEach(g => {
    g.addEventListener('mouseenter', onRoomHover);
    g.addEventListener('mouseleave', onRoomLeave);
    g.addEventListener('mousemove', onRoomMove);
    g.addEventListener('click', onRoomClick);
    g.style.cursor = 'pointer';
  });
}
function onRoomHover(e) {
  const roomId = e.currentTarget.dataset.roomId;
  showTooltip(roomId, e);
}
function onRoomMove(e) {
  const tt = els.mapTooltip;
  tt.style.left = `${e.offsetX}px`;
  tt.style.top = `${e.offsetY}px`;
}
function onRoomLeave() {
  els.mapTooltip.style.display = 'none';
}
function onRoomClick(e) {
  const roomId = e.currentTarget.dataset.roomId;
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  // Focus calendar on clicked room
  els.calendarRoom.value = roomId;
  refreshCalendar(roomId);
}
function showTooltip(roomId, e) {
  const room = rooms.find(r => r.id === roomId);
  const occ = occupancy[roomId] || {};
  const next = schedules
    .filter(ev => ev.roomId === roomId && new Date(ev.start) > new Date())
    .sort((a,b) => new Date(a.start) - new Date(b.start))[0];

  const until = occ.untilFree ? humanMinutes(minutesUntil(occ.untilFree)) : '—';
  els.mapTooltip.style.display = 'block';
  els.mapTooltip.innerHTML = `
    <div><strong>${room?.name || roomId}</strong></div>
    <div>Status: ${statusToBadge(occ.status)}</div>
    <div>Until free: <strong>${until}</strong></div>
    <div>Current: ${occ.currentEvent ? occ.currentEvent.title : 'None'}</div>
    <div>Next: ${next ? `${next.title} (${fmt(next.start)})` : 'None'}</div>
  `;
  onRoomMove(e);
}

/* Calendar */
let calendar;
function initCalendar(initialRoomId) {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    nowIndicator: true,
    height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' },
    events: [],
    eventColor: '#3b82f6',
    eventTextColor: '#04121e',
  });
  calendar.render();
  refreshCalendar(initialRoomId);
}
function refreshCalendar(roomId) {
  const events = schedules
    .filter(e => e.roomId === roomId)
    .map(e => ({ title: e.title, start: e.start, end: e.end }));
  calendar.removeAllEvents();
  calendar.addEventSource(events);
}

/* Rendering */
function renderAll() {
  renderCards();
  renderScheduleList();
  initMapInteractions();
  els.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

/* Filters */
['input','change'].forEach(evt => {
  els.searchInput.addEventListener(evt, renderAll);
  els.statusFilter.addEventListener(evt, renderAll);
  els.floorFilter.addEventListener(evt, renderAll);
  els.capacityFilter.addEventListener(evt, renderAll);
});
els.calendarRoom.addEventListener('change', (e) => refreshCalendar(e.target.value));

/* Real-time via Socket.IO */
socket.on('occupancy:update', (payload) => {
  occupancy = payload;
  renderAll();
});
socket.on('schedules:update', (payload) => {
  schedules = payload;
  renderAll();
});

/* Start */
loadData();

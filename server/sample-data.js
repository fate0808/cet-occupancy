/* Branding-friendly sample data */
const rooms = [
  { id: 'CET-101', name: 'CET-101', floor: 1, capacity: 40 },
  { id: 'CET-102', name: 'CET-102', floor: 1, capacity: 35 },
  { id: 'CET-201', name: 'CET-201', floor: 2, capacity: 50 },
  { id: 'CET-202', name: 'CET-202', floor: 2, capacity: 30 },
  { id: 'CET-301', name: 'CET-301', floor: 3, capacity: 45 },
  { id: 'CET-302', name: 'CET-302', floor: 3, capacity: 60 },
];

// Generate a few events around now
function isoShift(minutes) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

const schedules = [
  { id: 'EVT-1', roomId: 'CET-101', title: 'Calculus I', start: isoShift(-45), end: isoShift(30) },
  { id: 'EVT-2', roomId: 'CET-102', title: 'Physics Lab', start: isoShift(15), end: isoShift(105) },
  { id: 'EVT-3', roomId: 'CET-201', title: 'Programming 2', start: isoShift(-10), end: isoShift(50) },
  { id: 'EVT-4', roomId: 'CET-202', title: 'Free Study', start: isoShift(120), end: isoShift(180) },
  { id: 'EVT-5', roomId: 'CET-301', title: 'Electronics', start: isoShift(-120), end: isoShift(-30) },
  { id: 'EVT-6', roomId: 'CET-302', title: 'Design Thinking', start: isoShift(5), end: isoShift(65) },
];

module.exports = { rooms, schedules };

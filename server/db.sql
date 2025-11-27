-- Rooms
CREATE TABLE rooms (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  floor INT NOT NULL,
  capacity INT NOT NULL
);

-- Schedules
CREATE TABLE schedules (
  id VARCHAR(64) PRIMARY KEY,
  room_id VARCHAR(32) NOT NULL,
  title VARCHAR(128) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- Example query: current occupancy
-- SELECT r.id, r.name, s.title, s.start_time, s.end_time
-- FROM rooms r
-- LEFT JOIN schedules s
--   ON s.room_id = r.id
--  AND s.start_time <= NOW()
--  AND s.end_time >= NOW();

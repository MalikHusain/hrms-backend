-- ─────────────────────────────────────────────────────────────────────────────
-- HRMS – Attendance Schema Migration
-- Run once: psql -U <user> -d <dbname> -f attendance_migration.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Attendance Records ─────────────────────────────────────────────────────
-- One row per employee per day. Stores status + clock-in/out times.
CREATE TABLE IF NOT EXISTS attendance (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          DATE    NOT NULL DEFAULT CURRENT_DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'absent'
                  CHECK (status IN ('present','absent','late','leave','wfh')),
  clock_in      TIMESTAMPTZ,
  clock_out     TIMESTAMPTZ,
  notes         TEXT,
  marked_by     INTEGER REFERENCES users(id),   -- NULL = self, else admin id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Only one record per user per day
  CONSTRAINT uq_attendance_user_date UNIQUE (user_id, date)
);

-- ── 2. Leave Requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type    VARCHAR(30) NOT NULL DEFAULT 'casual'
                  CHECK (leave_type IN ('casual','sick','earned','unpaid','wfh')),
  from_date     DATE NOT NULL,
  to_date       DATE NOT NULL,
  reason        TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected')),
  reviewed_by   INTEGER REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_date_order CHECK (to_date >= from_date)
);

-- ── 3. Auto-update updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_attendance_updated ON attendance;
CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_leave_updated ON leave_requests;
CREATE TRIGGER trg_leave_updated
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_user   ON attendance (user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date   ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_leave_user        ON leave_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_leave_status      ON leave_requests (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Tables created: attendance, leave_requests
-- ─────────────────────────────────────────────────────────────────────────────

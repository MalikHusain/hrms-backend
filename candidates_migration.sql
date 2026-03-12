-- ─────────────────────────────────────────────────────────────────────────────
-- HRMS – Candidates Schema Migration
-- Run in pgAdmin Query Tool
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Candidates Table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone         VARCHAR(20),
  position      VARCHAR(100),
  department    VARCHAR(100),
  status        VARCHAR(30) NOT NULL DEFAULT 'applied'
                  CHECK (status IN ('applied','interviewed','offered','onboarded','rejected')),
  applied_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  -- JSONB array of document objects:
  -- [{ "name": "resume.pdf", "path": "uploads/resume.pdf", "size": 204800, "uploaded_at": "..." }]
  documents     JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Auto-update updated_at ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidates_updated ON candidates;
CREATE TRIGGER trg_candidates_updated
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_candidates_status  ON candidates (status);
CREATE INDEX IF NOT EXISTS idx_candidates_email   ON candidates (email);

-- ── 4. Seed mock data (matches your existing mockData.js) ────────────────────
INSERT INTO candidates (name, email, phone, position, department, status, applied_date) VALUES
  ('Karthik Iyer',   'karthik.iyer@email.com',   '+91 98765 00001', 'QA Engineer',       'Engineering', 'applied',     '2026-03-05'),
  ('Vikram Patel',   'vikram.patel@email.com',    '+91 98765 00002', 'Product Designer',  'Design',      'applied',     '2026-03-01'),
  ('Arjun Nair',     'arjun.nair@email.com',      '+91 98765 00003', 'DevOps Engineer',   'Engineering', 'interviewed', '2026-02-28'),
  ('Rahul Verma',    'rahul.verma@email.com',      '+91 98765 00004', 'Backend Engineer',  'Engineering', 'interviewed', '2026-02-20'),
  ('Meera Gupta',    'meera.gupta@email.com',      '+91 98765 00005', 'Marketing Lead',    'Marketing',   'offered',     '2026-02-18'),
  ('Priya Sharma',   'priya.sharma@email.com',     '+91 98765 00006', 'Frontend Developer','Engineering', 'offered',     '2026-02-15'),
  ('Ravi Kumar',     'ravi.kumar@email.com',        '+91 98765 00007', 'Data Analyst',      'Finance',     'onboarded',   '2026-02-01'),
  ('Sneha Joshi',    'sneha.joshi@email.com',      '+91 98765 00008', 'HR Executive',      'HR',          'rejected',    '2026-01-20')
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Table created: candidates
-- ─────────────────────────────────────────────────────────────────────────────

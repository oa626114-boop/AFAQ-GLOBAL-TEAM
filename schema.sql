PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS applicants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  country TEXT NOT NULL,
  languages TEXT,
  education TEXT,
  profession TEXT,
  skills TEXT,
  experience TEXT,
  interests TEXT,
  group_preference TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  membership_id TEXT UNIQUE,
  sequence_no INTEGER UNIQUE,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewer_note TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  applicant_id INTEGER,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

CREATE INDEX IF NOT EXISTS idx_applicants_status ON applicants(status);
CREATE INDEX IF NOT EXISTS idx_applicants_submitted ON applicants(submitted_at);

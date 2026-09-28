CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'worker' CHECK (role IN ('worker','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_modules (
  id VARCHAR(120) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  sector VARCHAR(120) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id VARCHAR(120) NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, module_id, completed_at)
);

CREATE TABLE IF NOT EXISTS assessment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id VARCHAR(120) REFERENCES training_modules(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Domain-based assessment engine columns (see server.js for the full,
  -- defensively-migrated schema that actually runs at startup):
  session_id UUID,
  domain VARCHAR(255),
  is_practice BOOLEAN NOT NULL DEFAULT FALSE,
  correct_count INTEGER,
  incorrect_count INTEGER,
  total_questions INTEGER,
  difficulty_breakdown JSONB,
  weak_topics JSONB,
  recommendations JSONB,
  time_taken_seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS certificates (
  id VARCHAR(80) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_name VARCHAR(120) NOT NULL,
  avg_score INTEGER NOT NULL CHECK (avg_score BETWEEN 0 AND 100),
  domains JSONB NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform VARCHAR(120) NOT NULL DEFAULT 'KHATRA — SIH26041',
  revoked BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── Certification & Assessment engine ───────────────────────────────────────
-- question_bank: the validated, hand-authored question pool (125 questions:
-- 25 per domain × 5 domains), seeded from backend/src/data/questionBank.json.
CREATE TABLE IF NOT EXISTS question_bank (
  id VARCHAR(20) PRIMARY KEY,
  domain VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  question_type VARCHAR(30) NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer JSONB NOT NULL,
  explanation TEXT NOT NULL,
  safety_principle TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- assessment_sessions: one row per attempt (real or practice); engine_state
-- holds the adaptive engine's bookkeeping (remaining quota, served question
-- ids, topic-balance counters, and the current pending question + its
-- option-shuffle permutation).
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  is_practice BOOLEAN NOT NULL DEFAULT FALSE,
  blueprint JSONB NOT NULL,
  engine_state JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- assessment_answers: one row per question answered, for full attempt audit
-- trail (question, topic, difficulty, correctness, time taken).
CREATE TABLE IF NOT EXISTS assessment_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  question_id VARCHAR(20) NOT NULL REFERENCES question_bank(id),
  domain VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  difficulty VARCHAR(10) NOT NULL,
  submitted_answer JSONB NOT NULL,
  correct BOOLEAN NOT NULL,
  time_taken_ms INTEGER NOT NULL DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_session ON assessment_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user ON assessment_sessions(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_assessment_results_user_domain ON assessment_results(user_id, domain);

CREATE INDEX IF NOT EXISTS idx_progress_user ON training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_user ON assessment_results(user_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

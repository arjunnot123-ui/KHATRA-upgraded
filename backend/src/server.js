import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as aiService from './services/aiService.js';
import * as assistantService from './services/assistantService.js';
import * as textTo3DService from './services/textTo3DService.js';
import * as engine from './services/assessmentEngine.js';
import { QUESTION_BANK, DOMAINS, DEFAULT_BLUEPRINT, PRACTICE_BLUEPRINT, PASS_THRESHOLD, questionsForDomain, questionById } from './data/questionBank.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const modelsDir = path.resolve(__dirname, '../../frontend/public/models');

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'dev-only-change-me';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const schemaSql = `CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(120) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'worker' CHECK (role IN ('worker','admin')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS training_modules (id VARCHAR(120) PRIMARY KEY, title VARCHAR(255) NOT NULL, domain VARCHAR(255) NOT NULL, sector VARCHAR(120) NOT NULL, content JSONB NOT NULL DEFAULT '{}'::jsonb, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS training_progress (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, module_id VARCHAR(120) NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE, score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100), completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS assessment_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, module_id VARCHAR(120) REFERENCES training_modules(id) ON DELETE CASCADE, score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100), passed BOOLEAN NOT NULL, answers JSONB NOT NULL DEFAULT '[]'::jsonb, attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS certificates (id VARCHAR(80) PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, worker_name VARCHAR(120) NOT NULL, avg_score INTEGER NOT NULL CHECK (avg_score BETWEEN 0 AND 100), domains JSONB NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), platform VARCHAR(120) NOT NULL DEFAULT 'KHATRA — SIH26041', revoked BOOLEAN NOT NULL DEFAULT FALSE);

-- ── Certification & Assessment engine ───────────────────────────────────────
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

-- ── Machine Inspections ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machine_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_id VARCHAR(80) NOT NULL,
  machine_name VARCHAR(120) NOT NULL,
  mode VARCHAR(30) NOT NULL DEFAULT 'inspection',
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  identified_hazards JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_ppe JSONB NOT NULL DEFAULT '[]'::jsonb,
  weak_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_domain VARCHAR(255),
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_machine_inspections_user ON machine_inspections(user_id, completed_at DESC);

-- ── Hazard Scans (AI Detection & Human Verification) ──────────────────────
CREATE TABLE IF NOT EXISTS hazard_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Hazard Scan',
  image_preview TEXT,
  hazards JSONB NOT NULL DEFAULT '[]'::jsonb,
  overall_risk JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  human_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'saved',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hazard_scans_user ON hazard_scans(user_id, created_at DESC);

-- ── Custom / Text-to-3D Generated Models ─────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_3d_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  prompt TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'local',
  model_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size_bytes BIGINT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_custom_3d_models_machine ON custom_3d_models(machine_id);

-- Defensive migration: an earlier version of this project already created a
-- module-based assessment_results table. Widen it in place (never drop) so
-- both the legacy module_id shape and the new domain-based columns coexist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_results' AND column_name='module_id') THEN
    ALTER TABLE assessment_results ALTER COLUMN module_id DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES assessment_sessions(id) ON DELETE CASCADE;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS is_practice BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS correct_count INTEGER;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS incorrect_count INTEGER;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS total_questions INTEGER;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS difficulty_breakdown JSONB;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS weak_topics JSONB;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS recommendations JSONB;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_assessment_results_user_domain ON assessment_results(user_id, domain);
`;

async function initializeDatabase() { await pool.query(schemaSql); }

async function seedQuestionBank() {
  for (const q of QUESTION_BANK) {
    await pool.query(
      `INSERT INTO question_bank (id, domain, topic, difficulty, question_type, question, options, correct_answer, explanation, safety_principle)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         domain=$2, topic=$3, difficulty=$4, question_type=$5, question=$6,
         options=$7, correct_answer=$8, explanation=$9, safety_principle=$10, active=TRUE`,
      [q.id, q.domain, q.topic, q.difficulty, q.questionType, q.question, JSON.stringify(q.options), JSON.stringify(q.correctAnswer), q.explanation, q.safetyPrinciple]
    );
  }
}

app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '12mb' }));

const signToken = (user) => jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, jwtSecret, { expiresIn: '7d' });

function auth(requiredRoles = []) {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const payload = jwt.verify(token, jwtSecret);
      if (requiredRoles.length && !requiredRoles.includes(payload.role)) return res.status(403).json({ error: 'FORBIDDEN' });
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }
  };
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 8) return res.status(400).json({ error: 'NAME_EMAIL_PASSWORD_REQUIRED' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role', [name.trim(), email.trim().toLowerCase(), passwordHash]);
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
    console.error(err); res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'EMAIL_PASSWORD_REQUIRED' });
  try {
    const { rows } = await pool.query('SELECT id,name,email,role,password_hash FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    delete user.password_hash;
    res.json({ token: signToken(user), user });
  } catch (err) { console.error(err); res.status(500).json({ error: 'SERVER_ERROR' }); }
});

app.get('/api/auth/me', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,role,created_at FROM users WHERE id=$1', [req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: 'USER_NOT_FOUND' });
  res.json({ user: rows[0] });
});

app.get('/api/admin/users', auth(['admin']), async (_req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC');
  res.json({ users: rows });
});

app.get('/api/admin/certificates', auth(['admin']), async (_req, res) => {
  const { rows } = await pool.query('SELECT c.*, u.email FROM certificates c JOIN users u ON u.id=c.user_id ORDER BY c.issued_at DESC');
  res.json({ certificates: rows });
});

/** GET /api/admin/analytics — Comprehensive workforce safety analytics for administrators */
app.get('/api/admin/analytics', auth(), async (_req, res) => {
  try {
    const [usersRes, progressRes, inspectionsRes, scansRes, assessmentsRes, certsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total_users,
                         COUNT(CASE WHEN role='worker' THEN 1 END)::int AS total_workers,
                         COUNT(CASE WHEN role='admin' THEN 1 END)::int AS total_admins
                  FROM users`),
      pool.query(`SELECT COUNT(*)::int AS total_sessions,
                         ROUND(COALESCE(AVG(score), 0))::int AS avg_score
                  FROM training_progress`),
      pool.query(`SELECT COUNT(*)::int AS total_inspections,
                         ROUND(COALESCE(AVG(score), 0))::int AS avg_score,
                         COUNT(CASE WHEN passed THEN 1 END)::int AS passed_count
                  FROM machine_inspections`),
      pool.query(`SELECT COUNT(*)::int AS total_scans,
                         ROUND(COALESCE(AVG(risk_score), 0))::int AS avg_risk,
                         COUNT(CASE WHEN human_verified THEN 1 END)::int AS verified_count
                  FROM hazard_scans`),
      pool.query(`SELECT COUNT(*)::int AS total_assessments,
                         COUNT(CASE WHEN passed THEN 1 END)::int AS passed_count,
                         ROUND(COALESCE(AVG(score), 0))::int AS avg_score
                  FROM assessment_results`),
      pool.query(`SELECT COUNT(*)::int AS total_certs,
                         ROUND(COALESCE(AVG(avg_score), 0))::int AS avg_score,
                         COUNT(CASE WHEN revoked THEN 1 END)::int AS revoked_count
                  FROM certificates`),
    ]);

    const domainStats = await pool.query(`
      SELECT domain,
             COUNT(*)::int AS attempts,
             COUNT(CASE WHEN passed THEN 1 END)::int AS passes,
             COUNT(CASE WHEN NOT passed THEN 1 END)::int AS failures,
             ROUND(COALESCE(AVG(score), 0))::int AS avg_score
      FROM assessment_results
      WHERE domain IS NOT NULL
      GROUP BY domain
      ORDER BY failures DESC
    `);

    const totalWorkers = usersRes.rows[0]?.total_workers || 0;
    const totalTrainings = progressRes.rows[0]?.total_sessions || 0;
    const totalMachineInspections = inspectionsRes.rows[0]?.total_inspections || 0;
    const avgMachineScore = inspectionsRes.rows[0]?.avg_score || 0;
    const totalHazardScans = scansRes.rows[0]?.total_scans || 0;
    const totalAssessments = assessmentsRes.rows[0]?.total_assessments || 0;
    const passCount = assessmentsRes.rows[0]?.passed_count || 0;
    const passRate = totalAssessments > 0 ? Math.round((passCount / totalAssessments) * 100) : 0;
    const totalCerts = certsRes.rows[0]?.total_certs || 0;

    const highRiskDomains = domainStats.rows.map(d => ({
      domain: d.domain,
      failedAttempts: d.failures,
      totalAttempts: d.attempts,
      failureRate: d.attempts > 0 ? Math.round((d.failures / d.attempts) * 100) : 0,
      avgScore: d.avg_score,
    }));

    res.json({
      overview: {
        totalWorkers,
        totalTrainings,
        totalMachineInspections,
        avgMachineScore,
        totalHazardScans,
        totalAssessments,
        passRate,
        totalCertificates: totalCerts,
      },
      highRiskDomains,
      workers: usersRes.rows[0],
      training: progressRes.rows[0],
      inspections: inspectionsRes.rows[0],
      hazardScans: scansRes.rows[0],
      assessments: assessmentsRes.rows[0],
      certificates: certsRes.rows[0],
      domainStats: domainStats.rows,
    });
  } catch (err) {
    console.error('[API] admin analytics error:', err);
    res.status(500).json({ error: 'ANALYTICS_FAILED' });
  }
});

app.post('/api/progress', auth(), async (req, res) => {
  const { moduleId, score } = req.body || {};
  if (!moduleId || !Number.isInteger(score) || score < 0 || score > 100) return res.status(400).json({ error: 'INVALID_PROGRESS' });
  try {
    await pool.query(
      `INSERT INTO training_modules (id, title, domain, sector)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [moduleId, moduleId, moduleId, 'Industrial']
    );
    const { rows } = await pool.query('INSERT INTO training_progress(user_id,module_id,score) VALUES($1,$2,$3) RETURNING *', [req.user.sub, moduleId, score]);
    res.status(201).json({ progress: rows[0] });
  } catch (err) {
    console.error('[API] progress error:', err);
    res.status(500).json({ error: 'PROGRESS_SAVE_FAILED' });
  }
});

app.get('/api/dashboard', auth(), async (req, res) => {
  try {
    const [progress, assessments, certificates, inspections, scans] = await Promise.all([
      pool.query('SELECT * FROM training_progress WHERE user_id=$1 ORDER BY completed_at DESC', [req.user.sub]),
      pool.query('SELECT * FROM assessment_results WHERE user_id=$1 ORDER BY attempted_at DESC', [req.user.sub]),
      pool.query('SELECT * FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.sub]),
      pool.query('SELECT * FROM machine_inspections WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 20', [req.user.sub]),
      pool.query('SELECT * FROM hazard_scans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.sub]),
    ]);

    const inspRows = inspections.rows;
    const scanRows = scans.rows;
    const assessRows = assessments.rows;

    const inspectionStats = {
      total: inspRows.length,
      avgScore: inspRows.length ? Math.round(inspRows.reduce((a, b) => a + Number(b.score), 0) / inspRows.length) : 0,
      passedCount: inspRows.filter((r) => r.passed).length,
      recentWeakAreas: inspRows.flatMap((r) => Array.isArray(r.weak_areas) ? r.weak_areas : []).slice(0, 10),
    };

    const scanStats = {
      total: scanRows.length,
      totalScans: scanRows.length,
      avgRisk: scanRows.length ? Math.round(scanRows.reduce((a, b) => a + Number(b.risk_score), 0) / scanRows.length) : 0,
      totalHazardsFound: scanRows.reduce((acc, s) => acc + (Array.isArray(s.hazards) ? s.hazards.length : 0), 0),
    };

    const failedAssessments = assessRows.filter((a) => !a.passed);
    const assessmentWeakTopics = failedAssessments.flatMap((a) => Array.isArray(a.weak_topics) ? a.weak_topics : []);
    const recommendedDomain = failedAssessments[0]?.domain || inspRows[0]?.recommended_domain || 'Fire & Explosion Response';

    const domainSlugMap = {
      'Fire & Explosion Response': 'fire-explosion',
      'Gas Leaks & Confined Space': 'gas-leak-confined-space',
      'Heavy Machinery & Lockout-Tagout': 'machinery-loto',
      'Electrical Hazards & Arc Flash': 'electrical-arc-flash',
      'Chemical Spills & Hazardous Materials': 'chemical-spill-hazmat',
      'fire-explosion': 'fire-explosion',
      'gas-leak-confined-space': 'gas-leak-confined-space',
      'machinery-loto': 'machinery-loto',
      'electrical-arc-flash': 'electrical-arc-flash',
      'chemical-spill-hazmat': 'chemical-spill-hazmat',
    };

    const domainSlug = domainSlugMap[recommendedDomain] || 'machinery-loto';

    res.json({
      worker: {
        id: req.user.sub,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      progress: progress.rows,
      assessments: assessRows,
      certificates: certificates.rows,
      inspections: inspRows,
      inspectionStats,
      hazardScans: scanRows,
      scanStats,
      recommendations: {
        recommendedDomain,
        domainSlug,
        reason: failedAssessments.length > 0
          ? 'Requires retraining due to assessment score below 70% threshold.'
          : inspectionStats.recentWeakAreas.length > 0
          ? 'Defects flagged during 3D machine pre-shift walkaround inspection.'
          : 'Refresher training recommended to maintain industrial certification readiness.',
        weakTopics: assessmentWeakTopics.slice(0, 5),
        assessmentWeakTopics: assessmentWeakTopics.slice(0, 5),
        machineWeakAreas: inspectionStats.recentWeakAreas.slice(0, 5),
        hasFailedDomains: failedAssessments.length > 0,
      },
    });
  } catch (err) {
    console.error('[API] dashboard error:', err);
    res.status(500).json({ error: 'DASHBOARD_FAILED' });
  }
});

// ── Machine Inspection Endpoints ──────────────────────────────────────────

/** POST /api/inspections — Record completed 3D machine inspection or training */
app.post('/api/inspections', auth(), async (req, res) => {
  const {
    machineId,
    machineName,
    mode = 'inspection',
    checklist = [],
    answers = [],
    score = 0,
    passed = false,
    identifiedHazards = [],
    selectedPpe = [],
    weakAreas = [],
    recommendedDomain = null,
    notes = '',
  } = req.body || {};

  if (!machineId || !machineName) {
    return res.status(400).json({ error: 'MACHINE_ID_AND_NAME_REQUIRED' });
  }

  try {
    const clampedScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const { rows } = await pool.query(
      `INSERT INTO machine_inspections (
        user_id, machine_id, machine_name, mode, checklist, answers, score, passed,
        identified_hazards, selected_ppe, weak_areas, recommended_domain, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        req.user.sub,
        machineId,
        machineName,
        mode,
        JSON.stringify(checklist),
        JSON.stringify(answers),
        clampedScore,
        Boolean(passed),
        JSON.stringify(identifiedHazards),
        JSON.stringify(selectedPpe),
        JSON.stringify(weakAreas),
        recommendedDomain,
        notes,
      ]
    );

    res.status(201).json({ inspection: rows[0] });
  } catch (err) {
    console.error('[API] save inspection error:', err);
    res.status(500).json({ error: 'INSPECTION_SAVE_FAILED' });
  }
});

/** GET /api/inspections/history — Fetch user's past machine inspections */
app.get('/api/inspections/history', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM machine_inspections WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json({ inspections: rows });
  } catch (err) {
    console.error('[API] get inspections error:', err);
    res.status(500).json({ error: 'INSPECTIONS_FETCH_FAILED' });
  }
});

/** GET /api/inspections/weak-areas — Connect machine inspection weaknesses to adaptive assessment */
app.get('/api/inspections/weak-areas', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, machine_name, weak_areas, recommended_domain, score, completed_at
       FROM machine_inspections
       WHERE user_id=$1 AND weak_areas != '[]'::jsonb
       ORDER BY completed_at DESC LIMIT 15`,
      [req.user.sub]
    );

    const allWeakAreas = [];
    const recommendedDomains = new Set();

    rows.forEach((r) => {
      if (r.recommended_domain) recommendedDomains.add(r.recommended_domain);
      const items = Array.isArray(r.weak_areas) ? r.weak_areas : [];
      items.forEach((item) => {
        allWeakAreas.push({
          ...item,
          inspectionId: r.id,
          machineName: r.machine_name,
          completedAt: r.completed_at,
        });
        if (item.relatedDomain) recommendedDomains.add(item.relatedDomain);
      });
    });

    res.json({
      weakAreas: allWeakAreas.slice(0, 20),
      recommendedDomains: Array.from(recommendedDomains),
      recentInspectionsWithWeaknesses: rows.length,
    });
  } catch (err) {
    console.error('[API] get weak areas error:', err);
    res.status(500).json({ error: 'WEAK_AREAS_FETCH_FAILED' });
  }
});

// ── Hazard Scan Endpoints (AI Detection & Human Verification) ─────────────

/** POST /api/scans — Save completed hazard scan inspection */
app.post('/api/scans', auth(), async (req, res) => {
  const {
    title = 'Workplace Hazard Scan',
    imagePreview = null,
    hazards = [],
    notes = '',
  } = req.body || {};

  try {
    // Rule 15: Do not allow the frontend to modify AI confidence/severity.
    // Recompute overallRisk authoritatively on the server from active hazards.
    const activeHazards = Array.isArray(hazards)
      ? hazards.filter((h) => h && h.status !== 'rejected')
      : [];

    let riskPoints = 0;
    for (const h of activeHazards) {
      const sev = String(h.severity || 'medium').toLowerCase();
      const weight = sev === 'high' ? 35 : sev === 'medium' ? 20 : 10;
      let conf = Number(h.confidence);
      if (isNaN(conf)) conf = 0.75;
      if (conf > 1) conf = conf / 100;
      riskPoints += weight * conf;
    }

    const calculatedScore = activeHazards.length === 0 ? 0 : Math.min(100, Math.round(riskPoints));
    const calculatedLevel = calculatedScore >= 60 ? 'high' : calculatedScore >= 30 ? 'medium' : 'low';
    const overallRisk = { score: calculatedScore, level: calculatedLevel };

    const humanVerified = Array.isArray(hazards) && hazards.some((h) => h && h.status === 'confirmed');

    const { rows } = await pool.query(
      `INSERT INTO hazard_scans (
        user_id, title, image_preview, hazards, overall_risk, risk_score, risk_level, human_verified, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.sub,
        title.trim() || 'Workplace Hazard Scan',
        imagePreview,
        JSON.stringify(hazards),
        JSON.stringify(overallRisk),
        calculatedScore,
        calculatedLevel,
        humanVerified,
        'saved',
        notes,
      ]
    );

    res.status(201).json({ scan: rows[0] });
  } catch (err) {
    console.error('[API] save hazard scan error:', err);
    res.status(500).json({ error: 'SCAN_SAVE_FAILED' });
  }
});

app.get('/api/scans/history', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, risk_score, risk_level, human_verified, status, hazards, notes, created_at FROM hazard_scans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json({ scans: rows });
  } catch (err) {
    console.error('[API] get hazard scans error:', err);
    res.status(500).json({ error: 'SCANS_FETCH_FAILED' });
  }
});

app.get('/api/hazard-scans', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, risk_score, risk_level, human_verified, status, hazards, notes, created_at FROM hazard_scans WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.sub]
    );
    res.json({ scans: rows });
  } catch (err) {
    console.error('[API] get hazard scans error:', err);
    res.status(500).json({ error: 'SCANS_FETCH_FAILED' });
  }
});

app.post('/api/hazard-scans', auth(), async (req, res, next) => {
  req.url = '/api/scans';
  return app._router.handle(req, res, next);
});

// ── Text-to-3D Pipeline & Custom Model Management ─────────────────────────

/** GET /api/3d/status — Check provider status (Meshy, Luma, Local) */
app.get('/api/3d/status', auth(), (_req, res) => {
  res.json(textTo3DService.getProviderInfo());
});

/** POST /api/3d/generate-prompt — Generate structured industrial prompt */
app.post('/api/3d/generate-prompt', auth(), async (req, res) => {
  try {
    const { object, style, material, shape, useCase, description } = req.body || {};
    const result = await textTo3DService.generateStudioPrompt({ object, style, material, shape, useCase, description });
    res.json(result);
  } catch (err) {
    console.error('[3D] generate prompt error:', err);
    res.status(500).json({ error: 'PROMPT_GENERATION_FAILED' });
  }
});

/** POST /api/3d/generate-model — Start Text-to-3D generation */
app.post('/api/3d/generate-model', auth(), async (req, res) => {
  const { prompt, provider } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'PROMPT_REQUIRED' });
  try {
    const result = await textTo3DService.startModelGeneration({ prompt: prompt.trim(), provider });
    res.json(result);
  } catch (err) {
    console.error('[3D] generate model error:', err);
    res.status(502).json({ error: 'GENERATION_REQUEST_FAILED', detail: err.message });
  }
});

/** GET /api/3d/status/:taskId — Poll generation status */
app.get('/api/3d/status/:taskId', auth(), async (req, res) => {
  const { taskId } = req.params;
  const { provider = 'meshy' } = req.query;
  try {
    const status = await textTo3DService.queryGenerationStatus(taskId, provider);
    res.json(status);
  } catch (err) {
    console.error('[3D] query status error:', err);
    res.status(502).json({ error: 'STATUS_QUERY_FAILED', detail: err.message });
  }
});

/** POST /api/3d/upload-model — Validate and save custom GLB/GLTF model */
app.post('/api/3d/upload-model', auth(), async (req, res) => {
  const { machineId = 'conveyor', name = 'Custom Model', prompt = '', fileBase64, filename = 'model.glb' } = req.body || {};
  if (!fileBase64) return res.status(400).json({ error: 'FILE_BASE64_REQUIRED' });

  try {
    const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const saved = await textTo3DService.saveCustomModelFile(buffer, filename, modelsDir);

    let createdBy = null;
    if (req.user?.sub) {
      const u = await pool.query('SELECT id FROM users WHERE id = $1', [req.user.sub]);
      if (u.rows.length > 0) createdBy = req.user.sub;
    }

    const { rows } = await pool.query(
      `INSERT INTO custom_3d_models (machine_id, name, prompt, provider, model_url, file_size_bytes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [machineId, name.trim(), prompt.trim() || 'Uploaded model', 'upload', saved.modelUrl, saved.fileSizeBytes, createdBy]
    );

    res.status(201).json({ model: rows[0] });
  } catch (err) {
    console.error('[3D] upload model error:', err);
    res.status(400).json({ error: err.message || 'MODEL_UPLOAD_FAILED' });
  }
});

/** GET /api/3d/models — Fetch registered custom 3D models */
app.get('/api/3d/models', auth(), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM custom_3d_models ORDER BY created_at DESC LIMIT 50'
    );
    res.json({ models: rows });
  } catch (err) {
    console.error('[3D] get models error:', err);
    res.status(500).json({ error: 'MODELS_FETCH_FAILED' });
  }
});

/** DELETE /api/3d/models/:id — Remove custom 3D model */
app.delete('/api/3d/models/:id', auth(), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM custom_3d_models WHERE id=$1 RETURNING *',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'MODEL_NOT_FOUND' });
    res.json({ deleted: true, model: rows[0] });
  } catch (err) {
    console.error('[3D] delete model error:', err);
    res.status(500).json({ error: 'MODEL_DELETE_FAILED' });
  }
});

// Server-computed, backend-validated domain standing for the logged-in
// worker: best passing score per domain, from real assessment_results rows
// only (never trusts anything the client claims).
async function computeDomainStanding(userId) {
  const { rows } = await pool.query(
    `SELECT domain, MAX(score) FILTER (WHERE passed) AS best_passed_score, MAX(score) AS best_score, bool_or(passed) AS ever_passed
     FROM assessment_results WHERE user_id=$1 AND is_practice=FALSE AND domain IS NOT NULL GROUP BY domain`,
    [userId]
  );
  const byDomain = {};
  rows.forEach((r) => { byDomain[r.domain] = r; });
  return DOMAINS.map((domain) => {
    const r = byDomain[domain];
    const bestPassedScore = r?.best_passed_score != null ? Number(r.best_passed_score) : null;
    return {
      domain,
      bestScore: r?.best_score != null ? Number(r.best_score) : 0,
      passed: Boolean(r?.ever_passed),
      certifiableScore: bestPassedScore ?? 0,
    };
  });
}

app.get('/api/certificates/eligibility', auth(), async (req, res) => {
  const standing = await computeDomainStanding(req.user.sub);
  const eligible = standing.every((d) => d.passed);
  res.json({ eligible, isEligible: eligible, domains: standing });
});

app.post('/api/certificates', auth(), async (req, res) => {
  const workerName = req.body?.workerName || req.user.name || 'Worker';
  const standing = await computeDomainStanding(req.user.sub);
  if (!standing.every((d) => d.passed)) return res.status(400).json({ error: 'CERTIFICATION_REQUIREMENTS_NOT_MET', domains: standing });
  const domains = standing.map((d) => ({ domain: d.domain, score: d.certifiableScore }));
  const avgScore = Math.round(domains.reduce((s, d) => s + d.score, 0) / domains.length);
  const id = `KHT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const verificationUrl = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/certificate/${id}`;
  const { rows } = await pool.query('INSERT INTO certificates(id,user_id,worker_name,avg_score,domains) VALUES($1,$2,$3,$4,$5) RETURNING *', [id, req.user.sub, workerName.trim(), avgScore, JSON.stringify(domains)]);
  const cert = { ...rows[0], verification_url: verificationUrl };
  res.status(201).json({ certificate: cert });
});

app.get('/api/certificates/mine', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM certificates WHERE user_id=$1 ORDER BY issued_at DESC', [req.user.sub]);
  res.json({ certificates: rows });
});

// IMPORTANT: this wildcard :id route must stay registered AFTER the literal
// /eligibility and /mine routes above — Express matches routes in
// registration order, and a param route registered first would otherwise
// swallow those literal paths (e.g. id="eligibility").
app.get('/api/certificates/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT id,worker_name,avg_score,domains,issued_at,platform,revoked FROM certificates WHERE id=$1', [req.params.id]);
  const cert = rows[0];
  if (!cert || cert.revoked) return res.status(404).json({ valid: false });
  res.json({ valid: true, status: 'valid', cert, certificate: cert });
});

// ── Certification & Assessment engine ───────────────────────────────────────

function rowToQuestion(row) {
  return {
    id: row.id,
    domain: row.domain,
    topic: row.topic,
    difficulty: row.difficulty,
    questionType: row.question_type,
    question: row.question,
    options: row.options,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    safetyPrinciple: row.safety_principle,
  };
}

async function poolForDomain(domain) {
  const { rows } = await pool.query('SELECT * FROM question_bank WHERE domain=$1 AND active=TRUE', [domain]);
  return rows.map(rowToQuestion);
}

/** Per-domain aggregate stats + weak topics for the "Available Assessments" list. */
app.get('/api/assessment/domains', auth(), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT domain, MAX(score) AS best_score, COUNT(*) AS attempts, bool_or(passed) AS ever_passed, MAX(attempted_at) AS last_attempt_at
     FROM assessment_results WHERE user_id=$1 AND is_practice=FALSE AND domain IS NOT NULL GROUP BY domain`,
    [req.user.sub]
  );
  const byDomain = {};
  rows.forEach((r) => { byDomain[r.domain] = r; });

  // Weak topics: pull from the most recent non-passing attempt per domain.
  const weakRows = await pool.query(
    `SELECT DISTINCT ON (domain) domain, weak_topics FROM assessment_results
     WHERE user_id=$1 AND is_practice=FALSE AND domain IS NOT NULL ORDER BY domain, attempted_at DESC`,
    [req.user.sub]
  );
  const weakByDomain = {};
  weakRows.rows.forEach((r) => { weakByDomain[r.domain] = r.weak_topics || []; });

  const result = DOMAINS.map((domain) => {
    const r = byDomain[domain];
    return {
      domain,
      bestScore: r ? Number(r.best_score) : 0,
      attempts: r ? Number(r.attempts) : 0,
      status: r ? (r.ever_passed ? 'passed' : 'failed') : 'not_started',
      weakTopics: (weakByDomain[domain] || []).map((w) => w.topic),
      lastAttemptAt: r?.last_attempt_at || null,
      totalQuestionsAvailable: questionsForDomain(domain).length,
    };
  });
  res.json({ domains: result });
});

/** Start a new adaptive assessment (or practice) session for a domain. */
app.post('/api/assessment/start', auth(), async (req, res) => {
  const rawDomain = req.body?.domain || req.body?.domainSlug;
  const isPractice = req.body?.mode === 'practice' || req.query?.mode === 'practice';
  const slugToDomain = {
    'fire-explosion': 'Fire & Explosion Response',
    'gas-leak-confined-space': 'Gas Leak & Confined Space Protocol',
    'gas-confined-space': 'Gas Leak & Confined Space Protocol',
    'machinery-loto': 'Machinery Safety & Lockout-Tagout',
    'electrical-arc-flash': 'Electrical Hazard Response',
    'electrical-hazard': 'Electrical Hazard Response',
    'chemical-spill-hazmat': 'Dust & Respiratory Hazard Protection',
    'dust-respiratory': 'Dust & Respiratory Hazard Protection',
  };
  const domain = DOMAINS.includes(rawDomain) ? rawDomain : (slugToDomain[rawDomain] || rawDomain);
  if (!DOMAINS.includes(domain)) return res.status(400).json({ error: 'INVALID_DOMAIN' });

  const pool_ = await poolForDomain(domain);
  let blueprint = isPractice ? { ...PRACTICE_BLUEPRINT } : { ...DEFAULT_BLUEPRINT };

  if (isPractice) {
    // Bias the pool toward the worker's weak topics from their latest attempt.
    const { rows } = await pool.query(
      `SELECT weak_topics FROM assessment_results WHERE user_id=$1 AND domain=$2 AND is_practice=FALSE ORDER BY attempted_at DESC LIMIT 1`,
      [req.user.sub, domain]
    );
    const weakTopics = (rows[0]?.weak_topics || []).map((w) => w.topic);
    if (weakTopics.length > 0) {
      const weakPool = pool_.filter((q) => weakTopics.includes(q.topic));
      // Only use the narrowed pool if it can actually satisfy the blueprint;
      // otherwise fall back to the full domain pool.
      const canSatisfy = ['easy', 'medium', 'hard'].every((t) => weakPool.filter((q) => q.difficulty === t).length >= (blueprint[t] || 0));
      if (canSatisfy) pool_.splice(0, pool_.length, ...weakPool);
    }
  }

  let state = engine.initEngineState(blueprint);
  const { state: newState, next } = engine.serveNext(pool_, state);
  if (!next) return res.status(500).json({ error: 'QUESTION_POOL_TOO_SMALL' });
  state = newState;

  const { rows } = await pool.query(
    `INSERT INTO assessment_sessions (user_id, domain, is_practice, blueprint, engine_state) VALUES ($1,$2,$3,$4,$5) RETURNING id, started_at`,
    [req.user.sub, domain, isPractice, JSON.stringify(blueprint), JSON.stringify(state)]
  );
  const session = rows[0];
  res.status(201).json({
    sessionId: session.id,
    domain,
    isPractice,
    blueprint,
    totalQuestions: engine.totalRemaining({ remaining: blueprint }) ,
    progress: { index: 1, min: Number(blueprint.minQuestions || 0), max: Number(blueprint.maxQuestions || engine.targetQuestionCount({ blueprint })), adaptive: Boolean(blueprint.adaptive), total: null },
    question: next,
  });
});

async function loadSession(sessionId, userId) {
  const { rows } = await pool.query('SELECT * FROM assessment_sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
  return rows[0] || null;
}

/** Fetch current session status (pending question + progress, or final result if completed). */
app.get('/api/assessment/:sessionId', auth(), async (req, res) => {
  const session = await loadSession(req.params.sessionId, req.user.sub);
  if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
  const minQuestions = Number(session.blueprint.minQuestions || engine.targetQuestionCount({ blueprint: session.blueprint }));
  const maxQuestions = Number(session.blueprint.maxQuestions || engine.targetQuestionCount({ blueprint: session.blueprint }));
  if (session.status === 'completed') {
    const { rows } = await pool.query('SELECT * FROM assessment_results WHERE session_id=$1', [session.id]);
    return res.json({ status: 'completed', domain: session.domain, result: rows[0] || null });
  }
  const state = session.engine_state;
  const servedCount = Number(state.servedCount || state.servedIds.length || 0) + (state.pending ? 1 : 0);
  let question = null;
  if (state.pending) {
    const q = questionById(state.pending.questionId);
    // Re-derive the displayed (shuffled) view from the stored permutation.
    question = {
      id: q.id, domain: q.domain, topic: q.topic, difficulty: q.difficulty, questionType: q.questionType,
      question: q.question, options: state.pending.perm.map((origIdx) => q.options[origIdx]),
    };
  }
  res.json({ status: 'in_progress', domain: session.domain, question, progress: { index: servedCount, min: minQuestions, max: maxQuestions, adaptive: Boolean(session.blueprint.adaptive), total: null } });
});

/** Submit an answer to the current pending question; server grades it. */
app.post('/api/assessment/:sessionId/answer', auth(), async (req, res) => {
  const session = await loadSession(req.params.sessionId, req.user.sub);
  if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
  if (session.status !== 'in_progress') return res.status(400).json({ error: 'SESSION_NOT_ACTIVE' });

  let state = session.engine_state;
  if (!state.pending) return res.status(400).json({ error: 'NO_PENDING_QUESTION' });

  const { answer, timeTakenMs } = req.body || {};
  if (answer === undefined || answer === null) return res.status(400).json({ error: 'ANSWER_REQUIRED' });

  const q = questionById(state.pending.questionId);
  if (!q) return res.status(500).json({ error: 'QUESTION_NOT_FOUND' });
  const correct = engine.gradeAnswer(q, state.pending.perm, answer);
  const safeTimeTakenMs = Number.isFinite(timeTakenMs) && timeTakenMs >= 0 ? Math.min(timeTakenMs, 30 * 60 * 1000) : 0;

  await pool.query(
    `INSERT INTO assessment_answers (session_id, question_id, domain, topic, difficulty, submitted_answer, correct, time_taken_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [session.id, q.id, q.domain, q.topic, q.difficulty, JSON.stringify(answer), correct, safeTimeTakenMs]
  );

  state = engine.recordAnswer(state, q, correct);
  const feedback = { correct, explanation: q.explanation, safetyPrinciple: q.safetyPrinciple, correctAnswer: q.correctAnswer, questionType: q.questionType, options: q.options };

  const pool_ = await poolForDomain(session.domain);
  const { state: newState, next } = engine.serveNext(pool_, state);
  state = newState;
  const minQuestions = Number(session.blueprint.minQuestions || engine.targetQuestionCount({ blueprint: session.blueprint }));
  const maxQuestions = Number(session.blueprint.maxQuestions || engine.targetQuestionCount({ blueprint: session.blueprint }));

  if (!next) {
    // Assessment complete — compute and persist the final result.
    const { rows: answerRows } = await pool.query('SELECT * FROM assessment_answers WHERE session_id=$1 ORDER BY answered_at ASC', [session.id]);
    const answers = answerRows.map((a) => ({ questionId: a.question_id, domain: a.domain, topic: a.topic, difficulty: a.difficulty, correct: a.correct, timeTakenMs: a.time_taken_ms }));
    const result = engine.buildResult(answers, PASS_THRESHOLD);

    await pool.query(
      `UPDATE assessment_sessions SET status='completed', engine_state=$2, completed_at=NOW() WHERE id=$1`,
      [session.id, JSON.stringify(state)]
    );
    const { rows: resultRows } = await pool.query(
      `INSERT INTO assessment_results (user_id, session_id, domain, is_practice, score, passed, correct_count, incorrect_count, total_questions, difficulty_breakdown, weak_topics, recommendations, time_taken_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.sub, session.id, session.domain, session.is_practice, result.score, result.passed, result.correctCount, result.incorrectCount, result.totalQuestions,
        JSON.stringify(result.difficultyBreakdown), JSON.stringify(result.weakTopics), JSON.stringify(result.recommendations), result.timeTakenSeconds]
    );
    return res.json({ completed: true, feedback, result: resultRows[0] });
  }

  await pool.query(`UPDATE assessment_sessions SET engine_state=$2 WHERE id=$1`, [session.id, JSON.stringify(state)]);
  const servedCount = Number(state.servedCount || state.servedIds.length || 0) + 1;
  res.json({ completed: false, feedback, nextQuestion: next, progress: { index: servedCount, min: minQuestions, max: maxQuestions, adaptive: Boolean(session.blueprint.adaptive), total: null } });
});

// ── AI proxy endpoints ─────────────────────────────────────────────────────
// Keys are ONLY in backend/.env — never sent to or stored by the frontend.

const MAX_B64_LEN = 10 * 1024 * 1024 * 1.4; // ~10 MB source → base64 overhead

function validateImagePayload(base64) {
  if (!base64 || typeof base64 !== 'string') return 'imageBase64 is required.';
  if (base64.length > MAX_B64_LEN) return 'Image too large (max ~10 MB).';
  return null;
}

/** GET /api/ai/status — returns provider name and configuration state */
app.get('/api/ai/status', auth(), (_req, res) => {
  res.json({
    provider: aiService.providerName(),
    configured: aiService.isConfigured(),
  });
});

/** POST /api/ai/hazard-analysis — analyze image for workplace hazards */
app.post('/api/ai/hazard-analysis', auth(), async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  const imgErr = validateImagePayload(imageBase64);
  if (imgErr) return res.status(400).json({ error: imgErr });
  if (!aiService.isConfigured()) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  try {
    const result = await aiService.analyzeHazardImage(imageBase64, mimeType);
    res.json(result);
  } catch (e) {
    console.error('[AI] hazard-analysis:', e.message);
    res.status(502).json({ error: 'AI_REQUEST_FAILED', detail: e.message });
  }
});

/** POST /api/ai/machine-analysis — analyze image for AR machine annotation */
app.post('/api/ai/machine-analysis', auth(), async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body || {};
  const imgErr = validateImagePayload(imageBase64);
  if (imgErr) return res.status(400).json({ error: imgErr });
  if (!aiService.isConfigured()) return res.status(503).json({ error: 'AI_NOT_CONFIGURED' });
  try {
    const result = await aiService.analyzeMachineImage(imageBase64, mimeType);
    res.json(result);
  } catch (e) {
    console.error('[AI] machine-analysis:', e.message);
    res.status(502).json({ error: 'AI_REQUEST_FAILED', detail: e.message });
  }
});

/** POST /api/ai/chat — conversational AI assistant with multi-turn support and robust retry */
app.post('/api/ai/chat', auth(), async (req, res) => {
  const { messages, language, systemContext, clientContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required.' });
  }
  try {
    const reply = await assistantService.chat({
      messages,
      language,
      customSystemContext: systemContext,
      clientContext,
    });
    res.json({ reply });
  } catch (e) {
    console.error('[AI] chat error:', e.message);
    const isOverload = e.status === 429 || (e.message || '').toLowerCase().includes('demand');
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 502;
    res.status(status).json({
      error: 'AI_REQUEST_FAILED',
      detail: isOverload
        ? 'The AI assistant is temporarily experiencing high demand. Please try again in a few moments.'
        : 'The AI assistant encountered a temporary issue. Please try again.'
    });
  }
});

/** POST /api/ai/generate-3d-prompt — Text-to-3D prompt generator */
app.post('/api/ai/generate-3d-prompt', auth(), async (req, res) => {
  const { description } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: 'description is required.' });
  if (!aiService.isConfigured()) return res.json({ prompt: aiService.fallback3DPrompt(description.trim()), generatedBy: 'local-template' });
  try {
    const prompt = await aiService.generate3DPrompt(description.trim());
    res.json({ prompt });
  } catch (e) {
    console.error('[AI] generate-3d-prompt:', e.message);
    res.status(502).json({ error: 'AI_REQUEST_FAILED', detail: e.message });
  }
});

app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'SERVER_ERROR' }); });
app.listen(port, async () => {
  console.log(`KHATRA API listening on http://localhost:${port}`);
  try {
    await initializeDatabase();
    console.log('KHATRA database is ready.');
    await seedQuestionBank();
    console.log(`Question bank seeded: ${QUESTION_BANK.length} questions across ${DOMAINS.length} domains.`);
  }
  catch (err) { console.error('Database connection failed. Start PostgreSQL and check backend/.env'); console.error(err.message); }
});

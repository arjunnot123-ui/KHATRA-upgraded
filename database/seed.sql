-- KHATRA seed data
-- Compatible with the current KHATRA PostgreSQL schema.
-- Safe to re-run: users/modules are upserted, demo progress/certificates are refreshed.
-- Demo credentials:
--   Admin  : admin@khatra.local / Admin@1234
--   Worker : worker@khatra.local / Worker@1234

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Demo users
-- -----------------------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role)
VALUES
  ('KHATRA Administrator', 'admin@khatra.local', crypt('Admin@1234', gen_salt('bf', 12)), 'admin'),
  ('Demo Worker', 'worker@khatra.local', crypt('Worker@1234', gen_salt('bf', 12)), 'worker')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 2. Training modules + starter question banks
--    The question bank is stored in JSONB so this seed works with the
--    existing schema. The upgraded adaptive-assessment engine can later
--    migrate these questions into dedicated question_bank tables.
-- -----------------------------------------------------------------------------
INSERT INTO training_modules (id, title, domain, sector, content, active)
VALUES
(
  'fire-explosion',
  'Fire & Explosion Response',
  'Fire & Explosion Response',
  'Steel Plant',
  '{
    "intro": "Recognize fire hazards, raise alarms, evacuate safely, and select appropriate controls.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"fe-q01","difficulty":"easy","type":"mcq","prompt":"What should you do first when you discover a fire?","options":["Ignore it","Raise the alarm and identify a safe exit","Run toward the fire","Finish your task first"],"answerIndex":1,"topic":"alarm-and-evacuation"},
      {"id":"fe-q02","difficulty":"medium","type":"mcq","prompt":"Before using an extinguisher, what must you confirm?","options":["Its color only","The correct extinguisher class and a safe escape route","That nobody is watching","That the fire is large"],"answerIndex":1,"topic":"extinguisher-selection"},
      {"id":"fe-q03","difficulty":"hard","type":"scenario","prompt":"A fire grows rapidly and smoke reduces visibility. What is the safest decision?","options":["Continue fighting it","Evacuate using the safe route and report to the muster point","Search for the source","Wait for someone else"],"answerIndex":1,"topic":"escalation-response"},
      {"id":"fe-q04","difficulty":"medium","type":"mcq","prompt":"What should you do with an extinguisher that has an expired inspection tag?","options":["Use it anyway","Report it for inspection or replacement","Hide it","Remove the tag"],"answerIndex":1,"topic":"equipment-readiness"}
    ]
  }'::jsonb,
  TRUE
),
(
  'gas-leak-confined-space',
  'Gas Leak & Confined Space Protocol',
  'Gas Leak & Confined Space Protocol',
  'Mining',
  '{
    "intro": "Use gas testing, ventilation, communication, PPE and confined-space controls before entry.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"gc-q01","difficulty":"easy","type":"mcq","prompt":"What must be checked before entering a confined space?","options":["Only lighting","Atmospheric conditions and entry controls","Only the floor","Nothing if the task is short"],"answerIndex":1,"topic":"pre-entry-check"},
      {"id":"gc-q02","difficulty":"medium","type":"scenario","prompt":"A gas detector shows elevated gas levels. What should happen next?","options":["Enter quickly","Stop entry and follow the gas/emergency procedure","Turn off the detector","Ignore the reading"],"answerIndex":1,"topic":"gas-response"},
      {"id":"gc-q03","difficulty":"hard","type":"mcq","prompt":"Why is a low-battery gas detector unsafe to rely on?","options":["It is heavier","Its readings may not be reliable","It makes more noise","It uses less oxygen"],"answerIndex":1,"topic":"detector-reliability"},
      {"id":"gc-q04","difficulty":"medium","type":"mcq","prompt":"Which principle is important for confined-space work?","options":["Work alone","Maintain communication and rescue arrangements","Skip atmospheric testing","Enter before authorization"],"answerIndex":1,"topic":"confined-space-controls"}
    ]
  }'::jsonb,
  TRUE
),
(
  'machinery-lockout-tagout',
  'Machinery Safety & Lockout-Tagout',
  'Machinery Safety & Lockout-Tagout',
  'Mining / Industrial',
  '{
    "intro": "Inspect machines, isolate hazardous energy, verify zero energy and use appropriate guarding and PPE.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"ms-q01","difficulty":"easy","type":"mcq","prompt":"What is the purpose of lockout-tagout?","options":["Speed up maintenance","Prevent unexpected energization or release of hazardous energy","Reduce paperwork","Start equipment remotely"],"answerIndex":1,"topic":"lototo-purpose"},
      {"id":"ms-q02","difficulty":"medium","type":"scenario","prompt":"A machine emergency stop is pressed but the power source is still connected. Is it safe to start maintenance?","options":["Yes","No; isolate and verify hazardous energy before maintenance","Only if maintenance is short","Yes if wearing gloves"],"answerIndex":1,"topic":"energy-isolation"},
      {"id":"ms-q03","difficulty":"hard","type":"mcq","prompt":"After isolation, what should be done before work begins?","options":["Assume zero energy","Verify isolation/zero energy using the approved procedure","Remove the lock","Restart the machine"],"answerIndex":1,"topic":"zero-energy-verification"},
      {"id":"ms-q04","difficulty":"medium","type":"hazard-identification","prompt":"Which machine condition should be reported immediately?","options":["A clean guard","An exposed moving part","A readable label","A working emergency stop"],"answerIndex":1,"topic":"machine-guarding"}
    ]
  }'::jsonb,
  TRUE
),
(
  'electrical-hazard-response',
  'Electrical Hazard Response',
  'Electrical Hazard Response',
  'Industrial',
  '{
    "intro": "Identify electrical hazards, isolate energy, use appropriate PPE and prevent contact with energized parts.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"el-q01","difficulty":"easy","type":"mcq","prompt":"What should you do when you see damaged electrical insulation?","options":["Touch it to inspect it","Keep clear and report/isolate it according to procedure","Tape it while energized","Ignore it"],"answerIndex":1,"topic":"damaged-cable"},
      {"id":"el-q02","difficulty":"medium","type":"scenario","prompt":"Before electrical maintenance, what is the key control?","options":["Work faster","Isolate and verify the electrical energy source","Remove PPE","Use a wet cloth"],"answerIndex":1,"topic":"electrical-isolation"},
      {"id":"el-q03","difficulty":"hard","type":"mcq","prompt":"Why must electrical PPE match the task and hazard?","options":["For appearance","Different hazards require different levels/types of protection","It makes tools lighter","It replaces isolation"],"answerIndex":1,"topic":"electrical-ppe"},
      {"id":"el-q04","difficulty":"medium","type":"multi-select","prompt":"Which actions help control electrical risk?","options":["Isolate energy","Verify absence of hazardous energy","Use appropriate PPE","Bypass safety controls"],"answerIndices":[0,1,2],"topic":"risk-controls"}
    ]
  }'::jsonb,
  TRUE
),
(
  'dust-respiratory-hazard',
  'Dust & Respiratory Hazard Protection',
  'Dust & Respiratory Hazard Protection',
  'Mining / Industrial',
  '{
    "intro": "Control airborne dust exposure using engineering controls, monitoring, work practices and appropriate respiratory protection.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"dr-q01","difficulty":"easy","type":"mcq","prompt":"What is an important first step when airborne dust increases?","options":["Ignore it","Use the required exposure-control procedure and report the condition","Remove ventilation","Work faster"],"answerIndex":1,"topic":"dust-control"},
      {"id":"dr-q02","difficulty":"medium","type":"mcq","prompt":"Why is ventilation important in dusty work areas?","options":["It increases noise","It helps control airborne contaminants","It removes PPE requirements","It replaces monitoring"],"answerIndex":1,"topic":"ventilation"},
      {"id":"dr-q03","difficulty":"hard","type":"scenario","prompt":"A new dust-generating process is introduced without an updated risk assessment. What should happen?","options":["Continue normally","Request an updated exposure/risk assessment before continuing","Remove the warning sign","Ignore the change"],"answerIndex":1,"topic":"risk-assessment"},
      {"id":"dr-q04","difficulty":"medium","type":"mcq","prompt":"What determines the appropriate respiratory protection?","options":["Personal preference","The identified hazard, exposure and approved respiratory-protection program","The cheapest option","Weather only"],"answerIndex":1,"topic":"respiratory-protection"}
    ]
  }'::jsonb,
  TRUE
),
(
  'manual-handling',
  'Manual Handling Safety',
  'Manual Handling Safety',
  'Industrial',
  '{
    "intro": "Use safe lifting, movement planning, team handling and mechanical aids to reduce injury risk.",
    "difficulty_levels": ["easy", "medium", "hard"],
    "questions": [
      {"id":"mh-q01","difficulty":"easy","type":"mcq","prompt":"Before lifting a heavy load, what should you do?","options":["Lift immediately","Assess the load, route and available handling aid","Twist while lifting","Lift alone regardless of weight"],"answerIndex":1,"topic":"pre-lift-assessment"},
      {"id":"mh-q02","difficulty":"medium","type":"scenario","prompt":"A load is awkward and too heavy for one person. What is the safer option?","options":["Lift faster","Use a mechanical aid or team lift according to procedure","Drag it blindly","Carry it overhead"],"answerIndex":1,"topic":"handling-aids"}
    ]
  }'::jsonb,
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  domain = EXCLUDED.domain,
  sector = EXCLUDED.sector,
  content = EXCLUDED.content,
  active = EXCLUDED.active;

-- -----------------------------------------------------------------------------
-- 3. Demo worker progress and assessment history
-- -----------------------------------------------------------------------------
WITH demo AS (
  SELECT id AS user_id FROM users WHERE email = 'worker@khatra.local'
), modules AS (
  SELECT id FROM training_modules
  WHERE id IN ('fire-explosion','gas-leak-confined-space','machinery-lockout-tagout','electrical-hazard-response','dust-respiratory-hazard')
)
INSERT INTO training_progress (user_id, module_id, score, completed_at)
SELECT demo.user_id, m.id, 82,
       NOW() - (ROW_NUMBER() OVER (ORDER BY m.id) * INTERVAL '1 day')
FROM demo CROSS JOIN modules m
ON CONFLICT DO NOTHING;

WITH demo AS (
  SELECT id AS user_id FROM users WHERE email = 'worker@khatra.local'
)
INSERT INTO assessment_results (user_id, module_id, score, passed, answers, attempted_at)
VALUES
  ((SELECT user_id FROM demo), 'fire-explosion', 86, TRUE, '[{"questionId":"fe-q01","correct":true},{"questionId":"fe-q02","correct":true},{"questionId":"fe-q03","correct":false}]'::jsonb, NOW() - INTERVAL '5 days'),
  ((SELECT user_id FROM demo), 'gas-leak-confined-space', 78, TRUE, '[{"questionId":"gc-q01","correct":true},{"questionId":"gc-q02","correct":true},{"questionId":"gc-q03","correct":false}]'::jsonb, NOW() - INTERVAL '4 days'),
  ((SELECT user_id FROM demo), 'machinery-lockout-tagout', 92, TRUE, '[{"questionId":"ms-q01","correct":true},{"questionId":"ms-q02","correct":true},{"questionId":"ms-q03","correct":true}]'::jsonb, NOW() - INTERVAL '3 days'),
  ((SELECT user_id FROM demo), 'electrical-hazard-response', 84, TRUE, '[{"questionId":"el-q01","correct":true},{"questionId":"el-q02","correct":true},{"questionId":"el-q04","correct":true}]'::jsonb, NOW() - INTERVAL '2 days'),
  ((SELECT user_id FROM demo), 'dust-respiratory-hazard', 88, TRUE, '[{"questionId":"dr-q01","correct":true},{"questionId":"dr-q02","correct":true},{"questionId":"dr-q03","correct":true}]'::jsonb, NOW() - INTERVAL '1 day');

-- -----------------------------------------------------------------------------
-- 4. Demo certificate
-- -----------------------------------------------------------------------------
INSERT INTO certificates (id, user_id, worker_name, avg_score, domains, issued_at, platform, revoked)
SELECT
  'KHT-DEMO-2026-001',
  id,
  'Demo Worker',
  86,
  '[
    {"domain":"Fire & Explosion Response","score":86},
    {"domain":"Gas Leak & Confined Space Protocol","score":78},
    {"domain":"Machinery Safety & Lockout-Tagout","score":92},
    {"domain":"Electrical Hazard Response","score":84},
    {"domain":"Dust & Respiratory Hazard Protection","score":88}
  ]'::jsonb,
  NOW(),
  'KHATRA — SIH26041',
  FALSE
FROM users
WHERE email = 'worker@khatra.local'
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  worker_name = EXCLUDED.worker_name,
  avg_score = EXCLUDED.avg_score,
  domains = EXCLUDED.domains,
  platform = EXCLUDED.platform,
  revoked = EXCLUDED.revoked;

COMMIT;

-- Quick verification queries:
-- SELECT id,name,email,role FROM users ORDER BY role,email;
-- SELECT id,title,domain,active FROM training_modules ORDER BY id;
-- SELECT * FROM assessment_results ORDER BY attempted_at DESC;
-- SELECT id,worker_name,avg_score,revoked FROM certificates;

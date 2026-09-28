/**
 * KHATRA frontend API client.
 *
 * AI calls now go through the KHATRA backend — no provider keys are stored
 * in the browser or sent directly to Gemini / OpenAI.
 *
 * Architecture:
 *   React → KHATRA Express backend → Gemini / OpenAI → response → React
 */

const TOKEN_KEY = 'khatra_access_token'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

// ── internal helpers ──────────────────────────────────────────────────────────

async function _post(path, body) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('SERVER_UNAVAILABLE')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.error || 'REQUEST_FAILED')
  return data
}

async function _get(path) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { headers })
  } catch {
    throw new Error('SERVER_UNAVAILABLE')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'REQUEST_FAILED')
  return data
}
async function _del(path) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'DELETE', headers })
  } catch {
    throw new Error('SERVER_UNAVAILABLE')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'REQUEST_FAILED')
  return data
}

// ── AI functions (all routed through the backend) ─────────────────────────────

/**
 * Analyze a workplace photo for industrial safety hazards.
 * @param {string} imageBase64 - Raw base64 (no data: prefix)
 * @param {string} mimeType
 * @returns {{ hazards, summary, riskScore }}
 */
export async function analyzeHazardImage(imageBase64, mimeType = 'image/jpeg') {
  return _post('/ai/hazard-analysis', { imageBase64, mimeType })
}

/**
 * Analyze a machine/work-area photo for AR Machine Inspector annotation.
 * @param {string} imageBase64 - Raw base64 (no data: prefix)
 * @param {string} mimeType
 * @returns {{ hazards, ppeRecommendations, components, summary, riskScore }}
 */
export async function analyzeMachineImage(imageBase64, mimeType = 'image/jpeg') {
  return _post('/ai/machine-analysis', { imageBase64, mimeType })
}

/**
 * Conversational AI trainer — scenario coaching and site assistant.
 * @param {string} systemContext - System/persona prompt
 * @param {{ role: 'user'|'assistant', content: string }[]} messages
 * @returns {string} Reply text
 */
export async function askTrainer(systemContext, messages) {
  const data = await _post('/ai/chat', { systemContext, messages })
  return data.reply || ''
}

/**
 * Query current AI provider status from the backend.
 * @returns {{ provider: string, configured: boolean }}
 */
export async function getAiStatus() {
  return _get('/ai/status')
}

/**
 * Generate a Text-to-3D prompt from a plain description.
 * @param {string} description
 * @returns {string} Formatted prompt string
 */
export async function generate3DPrompt(description) {
  const data = await _post('/ai/generate-3d-prompt', { description })
  return data.prompt || ''
}

// ── Text-to-3D Provider Pipeline ──────────────────────────────────────────────

/**
 * Get Text-to-3D provider status (Meshy, Luma, Local).
 */
export async function get3DProviderStatus() {
  return _get('/3d/status')
}

/**
 * Build a structured industrial prompt with Object, Style, Material, Shape, Use Case.
 */
export async function build3DStudioPrompt(params) {
  return _post('/3d/generate-prompt', params)
}

/**
 * Submit generation request to Text-to-3D provider.
 */
export async function start3DModelGeneration({ prompt, provider }) {
  return _post('/3d/generate-model', { prompt, provider })
}

/**
 * Poll generation progress and retrieve model URL.
 */
export async function query3DModelStatus(taskId, provider = 'meshy') {
  return _get(`/3d/status/${taskId}?provider=${provider}`)
}

/**
 * Upload custom validated GLB/GLTF model file to server and register in PostgreSQL.
 */
export async function uploadCustom3DModel(data) {
  return _post('/3d/upload-model', data)
}

/**
 * Fetch all registered custom 3D models.
 */
export async function getCustom3DModels() {
  return _get('/3d/models')
}

/**
 * Delete a custom 3D model.
 */
export async function deleteCustom3DModel(id) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}/3d/models/${id}`, { method: 'DELETE', headers })
  return res.json()
}

// ── Machine Inspections (PostgreSQL) ──────────────────────────────────────────

/**
 * Save completed 3D machine inspection or training session to PostgreSQL.
 */
export async function saveInspectionResult(data) {
  return _post('/inspections', data)
}

/**
 * Fetch past 3D machine inspections from PostgreSQL.
 */
export async function getInspectionHistory() {
  return _get('/inspections/history')
}

/**
 * Fetch aggregated weak inspection areas for adaptive assessment recommendations.
 */
export async function getInspectionWeakAreas() {
  return _get('/inspections/weak-areas')
}

// ── Hazard Scans (AI Detection & Human Verification) ──────────────────────────

/**
 * Save verified hazard scan inspection to PostgreSQL.
 */
export async function saveHazardScan(scanData) {
  return _post('/scans', scanData)
}

/**
 * Fetch past saved hazard scan inspections from PostgreSQL.
 */
export async function getHazardScanHistory() {
  return _get('/scans/history')
}

// ── Certification & Assessment engine ─────────────────────────────────────────
// All questions, scoring, and pass/fail decisions are computed and validated
// on the backend — the browser only renders what it's given and forwards the
// worker's raw selections. Never trust a client-side "correct" calculation.

/**
 * Per-domain assessment stats for the current worker: best score, attempts,
 * status (not_started/failed/passed), and weak topics from their latest attempt.
 */
export async function getAssessmentDomains() {
  return _get('/assessment/domains')
}

/**
 * Start a new adaptive assessment session for a domain.
 * @param {string} domain - one of the 5 certification domain names
 * @param {'assessment'|'practice'} mode
 */
export async function startAssessment(domain, mode = 'assessment') {
  return _post('/assessment/start', { domain, mode })
}

/** Resume/poll a session's current question + progress, or its final result. */
export async function getAssessmentSession(sessionId) {
  return _get(`/assessment/${sessionId}`)
}

/**
 * Submit an answer to the session's current pending question.
 * @param {string} sessionId
 * @param {number|number[]} answer - index (or indices) into the DISPLAYED options
 * @param {number} timeTakenMs
 */
export async function submitAssessmentAnswer(sessionId, answer, timeTakenMs) {
  return _post(`/assessment/${sessionId}/answer`, { answer, timeTakenMs })
}

/** Server-validated pass/fail standing per domain, used to gate certificate issuance. */
export async function getCertificateEligibility() {
  return _get('/certificates/eligibility')
}

/** Issue a certificate — the backend re-derives domain scores itself. */
export async function issueCertificateBackend(workerName) {
  return _post('/certificates', { workerName })
}

/** All certificates issued to the current worker. */
export async function getMyCertificates() {
  return _get('/certificates/mine')
}

/** Public certificate verification by ID (no auth required). */
export async function verifyCertificateBackend(id) {
  return _get(`/certificates/${id}`)
}

/** Admin-only: all certificates issued across every worker. */
export async function getAdminCertificates() {
  return _get('/admin/certificates')
}

// ── Site assistant (ChatBox) ──────────────────────────────────────────────────

/**
 * Full-site knowledge base for the KHATRA assistant chatbot, so it can answer
 * "how does this app work" style questions accurately for any page/feature.
 */
export const SITE_KNOWLEDGE = `You are the in-app assistant for KHATRA, an AI-powered industrial safety training web app for mining and manufacturing workers in Jharkhand, India (built for SIH problem statement CY-1).

You know every part of this app in detail:

1. HOME (/) — Landing page explaining what KHATRA does: trains workers to recognize hazards using a phone camera and an AI safety inspector, no headset or classroom needed. Has two main call-to-action buttons: "Scan a Hazard" (goes to Hazard Scan) and "Start Simulator" (goes to Simulator). Also explains the 3-step flow: point camera, see hazards marked, train the reflex with scenarios.

2. HAZARD SCAN (/scan) — User uploads or photographs (via phone camera, using capture="environment") a real work-area photo. The app sends the image to the KHATRA backend which forwards it to an AI vision model (Gemini or OpenAI, configured by the administrator). The AI returns a JSON list of hazards, each with a label, severity (low/medium/high), a plain-language description, and a bounding box position. These are drawn directly on top of the photo as colored boxes (green=safe context, amber=medium, red=high severity). A risk score (0-100) and a spoken summary (read aloud via the browser's built-in text-to-speech) are also shown.

3. MACHINE INSPECTOR (/inspector) — An AR-style annotation tool for a single uploaded machine or work-area photo. Users can hit "Auto-Detect" to have the AI place hazard-zone boxes, PPE-recommendation pins, and clickable component labels on the photo automatically, and/or switch to Edit mode to manually draw their own hazard zones or drop PPE/component pins and write custom labels and descriptions. Each marker shows as a pulsing HUD-style beacon (or a bracket-cornered box for hazard zones); tapping one opens a connected callout card with the label, description, severity, and recommended PPE icons. A "Training Mode" toggle turns the same photo into a find-the-hazard exercise.

4. SIMULATOR (/train and /train/:id) — A list of branching decision scenarios covering the 5 safety domains: Fire & Explosion, Gas & Confined Space, Machinery Safety, Electrical Hazard, and Dust & Respiratory. Each scenario has multiple decision points with two choices per step, awarding or deducting points with detailed feedback explaining why each choice was safe or unsafe. At the end, the user sees a safety score.

5. DASHBOARD (/dashboard) — Shows the user's training history: total sessions, hazard scans, scenarios completed, and average score.

6. SETTINGS (/settings) — Language selection (English, Hindi, Bengali, Odia, Urdu). The AI provider and keys are configured by the administrator on the server — workers do not need to set any API key.

TECHNICAL FACTS you may be asked about:
- Built with React + Vite, styled with Tailwind CSS.
- Express backend handles all AI calls server-side — API keys are never stored in the browser.
- Voice narration uses the free browser Web Speech API.
- Supports 5 languages: English, Hindi (हिन्दी), Bengali (বাংলা), Odia (ଓଡ଼ିଆ), and Urdu (اردو).

HOW TO ANSWER:
- Be concise, warm, and practical — like a helpful in-app guide, not a formal document.
- If asked "how do I..." questions, give clear step-by-step direction using the actual page/button names above.
- If asked about something outside this app's scope (unrelated topics), gently redirect back to what you can help with regarding KHATRA.
- If you don't know a specific answer, say so honestly rather than making it up.
- Reply in the same language the user is asking in, or in the app's currently selected language if given.`

// ── Training Progress (PostgreSQL) ──────────────────────────────────────────

/**
 * Save scenario / training module progress to PostgreSQL.
 */
export async function saveTrainingProgress(moduleId, score) {
  return _post('/progress', { moduleId, score: Math.round(Number(score)) })
}

/**
 * Fetch past saved hazard scans alias.
 */
export async function getHazardScans() {
  return _get('/hazard-scans')
}

/**
 * Fetch workforce safety analytics for admin dashboard.
 */
export async function getAdminAnalytics() {
  return _get('/admin/analytics')
}

/**
 * General-purpose assistant chat, aware of the whole site, general topics,
 * and live application context (route, selected hazard, recent assessment).
 * Calls backend assistantService with multi-turn history and user language.
 */
export async function askSiteAssistant(messages, languageName, clientContext = null) {
  const data = await _post('/ai/chat', { messages, language: languageName, clientContext })
  return data.reply || ''
}

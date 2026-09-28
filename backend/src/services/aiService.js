/**
 * KHATRA AI Service — v2
 * ─────────────────────
 * Changes from v1:
 *  • Per-request timeout (AbortController, 30s default)
 *  • HTTP status codes attached to thrown errors
 *  • Exponential-backoff retry (500 ms → 1 s → 2 s) for 429 / 5xx / overload
 *  • Cleaner primary → fallback chaining
 *  • Structured `callProvider` abstraction so all public functions share the same
 *    retry + fallback behaviour automatically
 */

import { QUESTION_BANK } from '../data/questionBank.js';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent'

// ── env helpers ───────────────────────────────────────────────────────────────

function getProvider() { return (process.env.AI_PROVIDER || 'gemini').toLowerCase() }
function geminiKey()  { return process.env.GEMINI_API_KEY || '' }
function openaiKey()  { return process.env.OPENAI_API_KEY || '' }

export function isConfigured() {
  return getProvider() === 'local' || Boolean(geminiKey() || openaiKey())
}
export function providerName() {
  if (getProvider() === 'local') return 'Local safety guide (offline)'
  const primary = getProvider() === 'openai' ? 'OpenAI GPT-4o-mini' : 'Google Gemini 3.6 Flash'
  const fallback = getProvider() === 'openai' ? geminiKey() : openaiKey()
  return fallback ? `${primary} · fallback enabled` : primary
}

// ── network helpers ───────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000

/** Wraps fetch with an AbortController timeout. */
async function timedFetch(url, options) {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: ctrl.signal })
  } catch (err) {
    if (err.name === 'AbortError') {
      const te = new Error('Request timed out after 30s')
      te.status = 408
      throw te
    }
    throw err
  } finally {
    clearTimeout(tid)
  }
}

/** Parse JSON response; attach HTTP status to any thrown error. */
async function parseProviderResponse(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

// ── retry logic ───────────────────────────────────────────────────────────────

function isRetryable(err) {
  if ([429, 502, 503, 504, 408].includes(err.status)) return true
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('overload') ||
    msg.includes('high demand') ||
    msg.includes('rate limit') ||
    msg.includes('quota') ||
    msg.includes('temporarily') ||
    msg.includes('try again') ||
    msg.includes('timed out')
  )
}

const RETRY_DELAYS_MS = [500, 1000, 2000]

async function withRetry(fn) {
  let lastErr
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length + 1; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1]
      console.warn(`[aiService] Retry ${attempt}/${RETRY_DELAYS_MS.length} after ${delay}ms — ${lastErr.message}`)
      await new Promise(r => setTimeout(r, delay))
    }
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err)) throw err   // non-retryable: fail immediately
    }
  }
  throw lastErr
}

/**
 * Run primaryFn (with retries). If it exhausts all retries AND a fallbackFn is
 * provided, run the fallback (with its own retries).
 */
async function callWithFallback(primaryFn, fallbackFn) {
  try {
    return await withRetry(primaryFn)
  } catch (primaryErr) {
    if (fallbackFn) {
      console.warn('[aiService] Primary exhausted, trying fallback provider:', primaryErr.message)
      try {
        return await withRetry(fallbackFn)
      } catch (fbErr) {
        console.error('[aiService] Fallback also failed:', fbErr.message)
        throw primaryErr   // surface the original error to the endpoint
      }
    }
    throw primaryErr
  }
}

// ── low-level provider calls ──────────────────────────────────────────────────

async function _geminiText(prompt, temperature = 0.4) {
  const key = geminiKey()
  if (!key) throw Object.assign(new Error('GEMINI_NOT_CONFIGURED'), { status: 503 })
  const res = await timedFetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature },
    }),
  })
  const data = await parseProviderResponse(res)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function _geminiVision(prompt, base64, mimeType, temperature = 0.3) {
  const key = geminiKey()
  if (!key) throw Object.assign(new Error('GEMINI_NOT_CONFIGURED'), { status: 503 })
  const res = await timedFetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ]}],
      generationConfig: { temperature },
    }),
  })
  const data = await parseProviderResponse(res)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function _geminiChat(systemContext, messages, temperature = 0.7) {
  const key = geminiKey()
  if (!key) throw Object.assign(new Error('GEMINI_NOT_CONFIGURED'), { status: 503 })
  const res = await timedFetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemContext }] },
      contents: messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature },
    }),
  })
  const data = await parseProviderResponse(res)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function _openaiChat(messages, temperature = 0.7) {
  const key = openaiKey()
  if (!key) throw Object.assign(new Error('OPENAI_NOT_CONFIGURED'), { status: 503 })
  const res = await timedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', temperature, messages }),
  })
  const data = await parseProviderResponse(res)
  return data.choices?.[0]?.message?.content || ''
}

async function _openaiVision(prompt, base64, mimeType, temperature = 0.3) {
  const key = openaiKey()
  if (!key) throw Object.assign(new Error('OPENAI_NOT_CONFIGURED'), { status: 503 })
  const res = await timedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      messages: [{ role: 'user', content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ]}],
    }),
  })
  const data = await parseProviderResponse(res)
  return data.choices?.[0]?.message?.content || ''
}

function findAssessmentQuestion(category, label) {
  if (!Array.isArray(QUESTION_BANK) || QUESTION_BANK.length === 0) return null;
  const cat = (category || '').toLowerCase();
  const lbl = (label || '').toLowerCase();

  let targetDomain = 'Machinery Safety & Lockout-Tagout';
  if (cat.includes('electr') || lbl.includes('wire') || lbl.includes('cable') || lbl.includes('shock') || lbl.includes('voltage')) {
    targetDomain = 'Electrical Hazard Response';
  } else if (cat.includes('fire') || cat.includes('flam') || lbl.includes('fire') || lbl.includes('extinguish') || lbl.includes('combust')) {
    targetDomain = 'Fire & Explosion Response';
  } else if (cat.includes('dust') || cat.includes('respir') || lbl.includes('dust') || lbl.includes('fume') || lbl.includes('mask') || lbl.includes('silica')) {
    targetDomain = 'Dust & Respiratory Hazard Protection';
  } else if (cat.includes('gas') || cat.includes('chem') || cat.includes('confined') || lbl.includes('gas') || lbl.includes('leak') || lbl.includes('ventilation')) {
    targetDomain = 'Gas Leak & Confined Space Protocol';
  }

  const matches = QUESTION_BANK.filter(q => q.domain === targetDomain);
  const q = matches[Math.floor(Math.random() * matches.length)] || matches[0];
  if (!q) return null;
  return {
    id: q.id,
    domain: q.domain,
    topic: q.topic,
    question: q.question,
  };
}

function findTrainingModule(category, label) {
  const cat = (category || '').toLowerCase();
  const lbl = (label || '').toLowerCase();
  if (cat.includes('electr') || lbl.includes('wire') || lbl.includes('cable')) {
    return { id: 'electrical-hazard-response', title: 'Electrical Hazard Response', slug: 'electrical-hazard' };
  }
  if (cat.includes('fire') || cat.includes('flam') || lbl.includes('fire')) {
    return { id: 'fire-explosion-response', title: 'Fire & Explosion Response', slug: 'fire-explosion' };
  }
  if (cat.includes('dust') || cat.includes('respir') || lbl.includes('dust')) {
    return { id: 'dust-respiratory-hazard-protection', title: 'Dust & Respiratory Hazard Protection', slug: 'dust-respiratory' };
  }
  if (cat.includes('gas') || cat.includes('chem') || cat.includes('confined')) {
    return { id: 'gas-leak-confined-space-protocol', title: 'Gas Leak & Confined Space Protocol', slug: 'gas-confined-space' };
  }
  return { id: 'machinery-lockout-tagout', title: 'Machinery Safety & Lockout-Tagout', slug: 'machinery-loto' };
}

function computeIoU(b1, b2) {
  const x1 = Math.max(b1.x, b2.x);
  const y1 = Math.max(b1.y, b2.y);
  const x2 = Math.min(b1.x + b1.width, b2.x + b2.width);
  const y2 = Math.min(b1.y + b1.height, b2.y + b2.height);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const b1Area = b1.width * b1.height;
  const b2Area = b2.width * b2.height;
  const unionArea = b1Area + b2Area - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

export function _parseHazardJsonSafe(text) {
  try {
    const raw = JSON.parse(text.replace(/```json|```/g, '').trim());
    const rawHazards = Array.isArray(raw.hazards) ? raw.hazards : [];
    const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

    const processedHazards = [];

    rawHazards.forEach((h, idx) => {
      // 1. Visible Evidence check - never invent hazards without evidence
      const evidence = (h.evidence || '').trim();
      const label = (h.label || 'Unidentified Hazard').trim();
      if (!evidence || evidence.length < 3) return;

      // 2. Confidence normalization: 0.0 - 1.0
      let conf = Number(h.confidence);
      if (isNaN(conf)) conf = 0.75;
      if (conf > 1) conf = conf / 100;
      conf = Math.max(0.1, Math.min(0.99, Number(conf.toFixed(2))));

      // 3. Rule: Confidence below 60% must be marked: Needs Human Verification
      const needsVerification = conf < 0.60 || Boolean(h.needsVerification);

      // Severity check
      let severity = String(h.severity || 'medium').toLowerCase();
      if (!['low', 'medium', 'high'].includes(severity)) severity = 'medium';

      const category = String(h.category || 'General').trim();

      // 4. Bounding box validation: normalized [0, 1]
      let bx = 0.1, by = 0.1, bw = 0.2, bh = 0.2;
      if (h.bbox) {
        if (Array.isArray(h.bbox)) {
          bx = clamp01(h.bbox[0]);
          by = clamp01(h.bbox[1]);
          bw = Math.max(0.02, Math.min(1 - bx, Number(h.bbox[2]) || 0.02));
          bh = Math.max(0.02, Math.min(1 - by, Number(h.bbox[3]) || 0.02));
        } else if (typeof h.bbox === 'object') {
          bx = clamp01(h.bbox.x);
          by = clamp01(h.bbox.y);
          bw = Math.max(0.02, Math.min(1 - bx, Number(h.bbox.width || h.bbox.w) || 0.02));
          bh = Math.max(0.02, Math.min(1 - by, Number(h.bbox.height || h.bbox.h) || 0.02));
        }
      }

      // 6. Thin objects (cables, hoses, wires) must receive smallest practical box
      const isThin = /cable|wire|hose|cord|line|leak|crack/i.test(label) || /cable|wire|hose|cord/i.test(evidence);
      if (isThin) {
        bw = Math.min(bw, 0.35);
        bh = Math.min(bh, 0.25);
      }

      const bboxObj = {
        x: Number(bx.toFixed(3)),
        y: Number(by.toFixed(3)),
        width: Number(bw.toFixed(3)),
        height: Number(bh.toFixed(3)),
      };

      const ppe = Array.isArray(h.ppe || h.ppeRecommendation)
        ? (h.ppe || h.ppeRecommendation).map((p) => String(p).toLowerCase().trim())
        : ['helmet', 'boots'];

      const trainingMod = findTrainingModule(category, label);
      const assessmentQ = findAssessmentQuestion(category, label);

      processedHazards.push({
        id: h.id || `haz_${idx + 1}`,
        label,
        category,
        severity,
        confidence: conf,
        evidence: evidence || `Visible ${label.toLowerCase()} observed directly in work area.`,
        description: h.description || `${label} presents an active ${severity} industrial safety risk.`,
        recommendedAction: h.recommendedAction || 'Immediately isolate the area and apply approved corrective safety procedures.',
        ppe,
        needsVerification,
        status: needsVerification ? 'needs_verification' : 'ai_detected',
        bbox: bboxObj,
        // Backward-compatible array format [x, y, w, h] for existing annotators
        bboxArray: [bboxObj.x, bboxObj.y, bboxObj.width, bboxObj.height],
        relatedTraining: trainingMod,
        relatedAssessmentQuestion: assessmentQ,
      });
    });

    // 7. Remove duplicate hazards using IoU and label similarity
    const deduped = [];
    for (const haz of processedHazards) {
      const isDuplicate = deduped.some((existing) => {
        const iou = computeIoU(existing.bbox, haz.bbox);
        const sameCategory = existing.category.toLowerCase() === haz.category.toLowerCase();
        const sameLabel = existing.label.toLowerCase() === haz.label.toLowerCase();
        return (iou > 0.45 && (sameCategory || sameLabel)) || iou > 0.70;
      });
      if (!isDuplicate) {
        deduped.push(haz);
      }
    }

    // 8. Sort hazards by severity (high > medium > low) and confidence descending
    const severityRank = { high: 3, medium: 2, low: 1 };
    deduped.sort((a, b) => {
      const rankDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (rankDiff !== 0) return rankDiff;
      return b.confidence - a.confidence;
    });

    // 14. Calculate risk consistently
    let riskPoints = 0;
    for (const h of deduped) {
      const weight = h.severity === 'high' ? 35 : h.severity === 'medium' ? 20 : 10;
      riskPoints += weight * h.confidence;
    }
    const score = deduped.length === 0 ? 0 : Math.min(100, Math.round(riskPoints));
    const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

    const overallRisk = {
      score,
      level,
    };

    return {
      hazards: deduped,
      overallRisk,
      // Backwards-compatibility fields:
      riskScore: score,
      summary:
        raw.summary ||
        (deduped.length > 0
          ? `Detected ${deduped.length} verified safety hazard(s) with ${level.toUpperCase()} overall risk (${score}/100). Review visible evidence and required actions below.`
          : 'No visible workplace safety hazards identified in this photo.'),
    };
  } catch (err) {
    console.error('Error parsing hazard json:', err);
    return {
      hazards: [],
      overallRisk: { score: 0, level: 'low' },
      riskScore: 0,
      summary: 'Hazard image analysis could not identify visible risks.',
    };
  }
}

function _parseJsonSafe(text) {
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return { hazards: [], summary: 'AI response could not be parsed.', riskScore: 0 };
  }
}

/** Returns primary and fallback vision functions based on configured provider. */
function visionFns(prompt, base64, mimeType, temp) {
  if (getProvider() === 'openai') {
    return [
      () => _openaiVision(prompt, base64, mimeType, temp),
      geminiKey() ? () => _geminiVision(prompt, base64, mimeType, temp) : null,
    ]
  }
  return [
    () => _geminiVision(prompt, base64, mimeType, temp),
    openaiKey() ? () => _openaiVision(prompt, base64, mimeType, temp) : null,
  ]
}

// ── public service functions ──────────────────────────────────────────────────

export async function analyzeHazardImage(base64, mimeType = 'image/jpeg') {
  const prompt = `You are a certified industrial safety AI inspector for mining and manufacturing workplaces.
Analyze this photo and identify VISIBLE safety hazards or regulatory violations.

CRITICAL RULES:
1. DO NOT INVENT HAZARDS. Every hazard MUST have direct, verifiable physical evidence visible in this image.
2. DO NOT INFER the facility type or assumptions without visible evidence.
3. Coordinates for bbox must be normalized between 0 and 1, formatted as { "x": 0, "y": 0, "width": 0, "height": 0 }.
4. Bounding boxes must tightly surround the detected object.
5. Thin objects (cables, wires, hoses, fluid lines, small leaks) must receive the SMALLEST practical enclosing bounding box.
6. Provide an honest confidence score between 0.0 and 1.0. If confidence < 0.60, set needsVerification: true.
7. Assign severity: "low", "medium", or "high".
8. Explain the exact visible evidence observed in the "evidence" field.
9. Provide practical recommendedAction and relevant PPE.

Respond ONLY with valid JSON (no markdown, no code block backticks):
{
  "hazards": [
    {
      "id": "haz_1",
      "label": "short hazard title",
      "category": "Electrical | Mechanical | Chemical | Physical | Fire | PPE | Housekeeping",
      "severity": "low" | "medium" | "high",
      "confidence": 0.85,
      "evidence": "concise description of visible physical evidence",
      "description": "one sentence explaining why this is hazardous",
      "recommendedAction": "one sentence immediate corrective action",
      "ppe": ["helmet", "gloves", "boots"],
      "needsVerification": false,
      "bbox": {
        "x": 0.25,
        "y": 0.40,
        "width": 0.15,
        "height": 0.10
      }
    }
  ],
  "overallRisk": {
    "score": 0,
    "level": "low" | "medium" | "high"
  }
}
If no visible hazards are observed, return { "hazards": [], "overallRisk": { "score": 0, "level": "low" } }.`;

  const [primary, fallback] = visionFns(prompt, base64, mimeType, 0.2)
  const text = await callWithFallback(primary, fallback)
  return _parseHazardJsonSafe(text)
}

export async function analyzeMachineImage(base64, mimeType = 'image/jpeg') {
  const prompt = `You are an industrial safety inspector AI annotating a photo of a machine or work area for an AR-style training overlay.

Identify:
1. Hazard zones — visible dangers (exposed wiring, unguarded moving parts, pinch points, missing signage, etc.)
2. PPE recommendations — spots where protection is needed
3. Components — notable machine parts or controls worth labeling for a trainee

Respond ONLY with valid JSON, no markdown, no backticks:
{
  "hazards": [
    { "label": "short name", "category": "Electrical|Mechanical|Chemical|Physical|Fire|PPE|General", "severity": "low"|"medium"|"high", "confidence": 0-100, "evidence": "visible evidence", "description": "one sentence", "recommendedAction": "one sentence", "bbox": [x,y,w,h], "ppe": ["helmet","gloves"] }
  ],
  "ppeRecommendations": [
    { "label": "short name", "description": "one sentence", "point": [x,y], "icons": ["helmet"] }
  ],
  "components": [
    { "label": "short name", "description": "one sentence explaining function or safety relevance", "point": [x,y] }
  ],
  "summary": "one or two sentence overall assessment",
  "riskScore": 0-100
}
All coordinates normalized 0–1. Only identify components and hazards that are visibly supported. For thin hoses/cables, use the smallest practical enclosing box. Valid icon ids: helmet, goggles, gloves, mask, earpro, vest, boots, harness.`

  const [primary, fallback] = visionFns(prompt, base64, mimeType, 0.3)
  const text = await callWithFallback(primary, fallback)
  return _parseJsonSafe(text)
}

/**
 * General-purpose conversational assistant.
 * @param {string} systemContext — full system/persona prompt
 * @param {{ role: 'user'|'assistant', content: string }[]} messages
 */
export async function askAssistant(systemContext, messages) {
  if (getProvider() === 'openai') {
    return callWithFallback(
      () => _openaiChat([{ role: 'system', content: systemContext }, ...messages], 0.7),
      geminiKey() ? () => _geminiChat(systemContext, messages, 0.7) : null,
    )
  }
  return callWithFallback(
    () => _geminiChat(systemContext, messages, 0.7),
    openaiKey() ? () => _openaiChat([{ role: 'system', content: systemContext }, ...messages], 0.7) : null,
  )
}

/**
 * Generate a Text-to-3D prompt from a plain description.
 * @param {string} description
 */

export function fallback3DPrompt(description) {
  const object = description.trim().replace(/[.!?]+$/, '')
  return `Create a realistic ${object} in a rugged industrial style, made from steel, reinforced rubber and durable composite materials, with a modular heavy-duty engineering form, designed for interactive worker safety training and AR machine inspection.`
}

export async function generate3DPrompt(description) {
  const prompt = `You are a 3D prompt engineer specialising in industrial safety training assets.

The user described: "${description}"

Generate ONE concise Text-to-3D prompt using this exact template:
"Create a [OBJECT] in a [STYLE] style, made from [MATERIAL], with a [SHAPE/FORM], designed for [USE CASE]."

Rules:
- Object: the main physical thing
- Style: realistic, industrial, rugged, technical, scientific, etc.
- Material: primary material (steel, polymer, rubber, composite, etc.)
- Shape/Form: geometric or structural description
- Use Case: safety training, AR inspection, PPE training, 3D machine inspection, etc.
- ONE sentence only, under 50 words
- No preamble, no explanation — just the prompt string itself

Respond with the prompt string only.`

  if (getProvider() === 'openai') {
    const raw = await callWithFallback(
      () => _openaiChat([{ role: 'user', content: prompt }], 0.4),
      geminiKey() ? () => _geminiText(prompt, 0.4) : null,
    )
    return raw.trim().replace(/^["']|["']$/g, '')
  }
  const raw = await callWithFallback(
    () => _geminiText(prompt, 0.4),
    openaiKey() ? () => _openaiChat([{ role: 'user', content: prompt }], 0.4) : null,
  )
  return raw.trim().replace(/^["']|["']$/g, '')
}

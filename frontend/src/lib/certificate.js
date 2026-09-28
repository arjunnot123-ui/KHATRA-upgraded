import { CERTIFICATION_DOMAINS } from './scenarios.js'

const PASS_THRESHOLD = 70 // percent, per-domain, to count as "passed" for certification
const CERT_KEY = 'khatra_certificates'
const WORKER_KEY = 'khatra_worker_profile'

// --- Worker profile (name used on the certificate) ---
export function getWorkerProfile() {
  try {
    return JSON.parse(localStorage.getItem(WORKER_KEY)) || { name: '' }
  } catch {
    return { name: '' }
  }
}
export function setWorkerProfile(profile) {
  localStorage.setItem(WORKER_KEY, JSON.stringify(profile))
}

// --- Domain pass tracking ---
// Given the training log (from store.js getLog()) and the scenario list,
// compute the best score achieved per domain and whether each domain is
// "passed" (>= PASS_THRESHOLD).
export function computeDomainProgress(log, scenarios) {
  const byDomain = {}
  for (const domain of CERTIFICATION_DOMAINS) {
    byDomain[domain] = { domain, bestScore: 0, attempts: 0, passed: false }
  }

  const scenarioDomain = {}
  scenarios.forEach((s) => {
    scenarioDomain[s.id] = s.domain
  })

  log
    .filter((entry) => entry.type === 'scenario')
    .forEach((entry) => {
      const domain = scenarioDomain[entry.scenarioId]
      if (!domain || !byDomain[domain]) return
      byDomain[domain].attempts += 1
      if (entry.score > byDomain[domain].bestScore) {
        byDomain[domain].bestScore = entry.score
      }
    })

  Object.values(byDomain).forEach((d) => {
    d.passed = d.bestScore >= PASS_THRESHOLD
  })

  return byDomain
}

export function isEligibleForCertificate(domainProgress) {
  return Object.values(domainProgress).every((d) => d.passed)
}

export function overallCompliance(domainProgress) {
  const values = Object.values(domainProgress)
  const passedCount = values.filter((d) => d.passed).length
  return {
    passedCount,
    totalDomains: values.length,
    percent: Math.round((passedCount / values.length) * 100),
  }
}

// --- Certificate generation ---
function genCertId() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  const ts = Date.now().toString(36).toUpperCase()
  return `KHT-${ts}-${rand}`
}

export function getCertificates() {
  try {
    return JSON.parse(localStorage.getItem(CERT_KEY)) || []
  } catch {
    return []
  }
}

export function getCertificateById(id) {
  return getCertificates().find((c) => c.id === id) || null
}

/**
 * Issues a certificate if the worker is eligible (all 5 domains passed).
 * Returns the certificate object, or null if not eligible.
 */
export function issueCertificate(domainProgress, workerName) {
  if (!isEligibleForCertificate(domainProgress)) return null

  const cert = {
    id: genCertId(),
    workerName: workerName || 'Unnamed Worker',
    issuedAt: Date.now(),
    domains: Object.values(domainProgress).map((d) => ({ domain: d.domain, score: d.bestScore })),
    avgScore: Math.round(
      Object.values(domainProgress).reduce((s, d) => s + d.bestScore, 0) / Object.values(domainProgress).length
    ),
    platform: 'KHATRA — SIH CY-1',
  }

  const all = getCertificates()
  all.unshift(cert)
  localStorage.setItem(CERT_KEY, JSON.stringify(all))
  return cert
}

export function verifyCertificate(id) {
  const cert = getCertificateById(id)
  if (!cert) return { valid: false, cert: null }
  return { valid: true, cert }
}

export { PASS_THRESHOLD }

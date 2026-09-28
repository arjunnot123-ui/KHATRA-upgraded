import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { getLog } from '../lib/store.js'
import { SCENARIOS } from '../lib/scenarios.js'
import {
  computeDomainProgress,
  overallCompliance,
  getWorkerProfile,
  setWorkerProfile,
  PASS_THRESHOLD,
} from '../lib/certificate.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { ASSESSMENT_DOMAINS } from '../lib/domains.js'
import { getAssessmentDomains, getCertificateEligibility, issueCertificateBackend, getMyCertificates } from '../lib/api.js'

export default function Certification() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [name, setName] = useState(getWorkerProfile().name || '')

  // Local training progress remains useful for the learning dashboard, but certification
  // standing below is always derived from the backend assessment results.
  const log = getLog()
  const localDomainProgress = computeDomainProgress(log, SCENARIOS)
  const localCompliance = overallCompliance(localDomainProgress)

  // New: backend-validated assessment standing and certificate flow.
  const [assessmentDomains, setAssessmentDomains] = useState(null)
  const [eligibility, setEligibility] = useState(null)
  const [certificates, setCertificates] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')

  async function loadAll() {
    setLoadError('')
    try {
      const [domainsRes, eligRes, certsRes] = await Promise.all([
        getAssessmentDomains(),
        getCertificateEligibility(),
        getMyCertificates(),
      ])
      setAssessmentDomains(domainsRes.domains)
      setEligibility(eligRes)
      setCertificates(certsRes.certificates)
    } catch (e) {
      setLoadError(e.message)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const latestCert = certificates?.[0] || null
  const eligible = Boolean(eligibility?.eligible)
  const passedCount = assessmentDomains ? assessmentDomains.filter((d) => d.status === 'passed').length : localCompliance.passedCount
  const totalDomains = assessmentDomains?.length || localCompliance.totalDomains
  const compliancePercent = totalDomains ? Math.round((passedCount / totalDomains) * 100) : 0

  const handleIssue = async () => {
    setIssuing(true)
    setIssueError('')
    try {
      const trimmed = name.trim() || 'Unnamed Worker'
      setWorkerProfile({ name: trimmed })
      await issueCertificateBackend(trimmed)
      await loadAll()
    } catch (e) {
      setIssueError(e.message)
    } finally {
      setIssuing(false)
    }
  }

  const verifyUrl = latestCert ? `${window.location.origin}${window.location.pathname}#/verify/${latestCert.id}` : ''

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('cert_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-2">{t('cert_title')}</h1>
      <p className="text-concrete mb-8 max-w-xl">{t('cert_desc')}</p>

      {/* Compliance summary (existing) */}
      <div className="bg-steel-light border border-steel-lighter rounded-lg p-6 mb-8 flex items-center gap-6 flex-wrap">
        <div className="text-center">
          <div className="font-display font-bold text-5xl text-amber">{passedCount}/{totalDomains}</div>
          <div className="font-mono text-[10px] text-concrete uppercase tracking-widest mt-1">{t('cert_domains_passed')}</div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="h-3 bg-steel rounded-full overflow-hidden">
            <div className="h-full bg-amber transition-all" style={{ width: `${compliancePercent}%` }} />
          </div>
          <p className="text-xs text-concrete font-mono mt-2">
            {t('cert_pass_threshold')} {PASS_THRESHOLD}%
          </p>
        </div>
      </div>

      {/* Server-validated certification standing */}
      <div className="space-y-3 mb-10">
        {(assessmentDomains || []).map((d) => (
          <div key={d.domain} className="bg-steel-light border border-steel-lighter rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${d.status === 'passed' ? 'bg-safe text-white' : 'bg-steel-lighter text-concrete'}`}>{d.status === 'passed' ? '✓' : ''}</span>
              <span className="font-bold text-sm">{d.domain}</span>
            </div>
            <div className="text-right">
              <span className={`font-mono text-sm font-bold ${d.status === 'passed' ? 'text-safe' : 'text-concrete'}`}>{d.bestScore}%</span>
              {d.status === 'not_started' && <p className="text-[10px] text-concrete font-mono">{t('cert_not_attempted')}</p>}
            </div>
          </div>
        ))}
        {!assessmentDomains && !loadError && <div className="text-concrete font-mono text-sm py-4 text-center">Loading certification standing…</div>}
      </div>

      {/* NEW: Available Assessments — the actual certification gate */}
      <div className="mb-10">
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="font-display font-bold text-2xl uppercase">Available Assessments</h2>
          <span className="font-mono text-[10px] text-concrete uppercase tracking-widest">Server-validated</span>
        </div>
        <p className="text-concrete text-sm mb-4 max-w-xl">
          Each domain uses a fresh adaptive sequence from a validated question bank. The assessment starts at 8 questions and can continue up to 15 when more evidence is needed; score 70% or higher to pass.
        </p>

        {loadError && (
          <div className="border border-hazard rounded-lg p-4 text-hazard text-sm font-mono mb-4">
            Could not reach the assessment server: {loadError}
          </div>
        )}

        {!assessmentDomains && !loadError && (
          <div className="text-concrete font-mono text-sm py-6 text-center">Loading assessments…</div>
        )}

        {assessmentDomains && (
          <div className="space-y-3">
            {ASSESSMENT_DOMAINS.map(({ domain, slug }) => {
              const d = assessmentDomains.find((x) => x.domain === domain)
              if (!d) return null
              return <AssessmentDomainCard key={domain} domain={domain} slug={slug} data={d} navigate={navigate} />
            })}
          </div>
        )}
      </div>

      {!eligible && assessmentDomains && (
        <div className="border border-steel-lighter rounded-lg p-6 text-center text-concrete text-sm mb-6">
          Pass all 5 domain assessments above to unlock certificate generation.
        </div>
      )}

      {eligible && !latestCert && (
        <div className="bg-steel-light border border-amber rounded-lg p-6">
          <p className="font-bold text-lg mb-3">{t('cert_eligible_title')}</p>
          <label className="font-mono text-xs uppercase tracking-widest text-concrete block mb-2">{t('cert_name_label')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('cert_name_placeholder')}
            className="w-full bg-steel border border-steel-lighter rounded px-4 py-3 font-mono text-sm mb-4 focus:border-amber outline-none"
          />
          {issueError && <p className="text-hazard text-xs font-mono mb-3">{issueError}</p>}
          <button
            onClick={handleIssue}
            disabled={issuing}
            className="w-full bg-amber disabled:bg-steel-lighter disabled:text-concrete text-steel font-display font-bold text-lg uppercase py-3 rounded"
          >
            {issuing ? 'Issuing…' : t('cert_issue_btn')}
          </button>
        </div>
      )}

      {latestCert && (
        <div className="bg-steel-light border border-amber rounded-lg p-8 text-center">
          <p className="font-mono text-amber text-xs uppercase tracking-widest mb-4">{t('cert_issued_label')}</p>
          <h2 className="font-display font-bold text-3xl uppercase mb-2">{latestCert.worker_name}</h2>
          <p className="text-concrete text-sm mb-1">{t('cert_avg_score')}: <span className="text-amber font-bold">{latestCert.avg_score}%</span></p>
          <p className="text-concrete text-xs font-mono mb-6">{new Date(latestCert.issued_at).toLocaleDateString()}</p>

          <div className="bg-white rounded-lg p-4 inline-block mb-4">
            <QRCodeSVG value={verifyUrl} size={160} />
          </div>
          <p className="font-mono text-xs text-concrete break-all mb-1">{latestCert.id}</p>
          <p className="text-[11px] text-concrete">{t('cert_qr_hint')}</p>

          <div className="flex gap-4 justify-center mt-6">
            <Link
              to={`/verify/${latestCert.id}`}
              className="border border-concrete rounded px-5 py-2.5 font-mono text-xs hover:border-amber hover:text-amber"
            >
              {t('cert_view_verification')}
            </Link>
            <button
              onClick={() => window.print()}
              className="bg-amber text-steel font-bold text-xs uppercase px-5 py-2.5 rounded"
            >
              {t('cert_print')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const STATUS_STYLE = {
  passed: { label: 'Passed', className: 'bg-safe text-white' },
  failed: { label: 'Not Passed', className: 'bg-hazard text-white' },
  not_started: { label: 'Not Started', className: 'bg-steel-lighter text-concrete' },
}

function AssessmentDomainCard({ domain, slug, data, navigate }) {
  const status = STATUS_STYLE[data.status] || STATUS_STYLE.not_started
  const buttonLabel = data.status === 'not_started' ? 'Start Assessment' : 'Retry Assessment'

  return (
    <div className="bg-steel-light border border-steel-lighter rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-sm">{domain}</span>
            <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="flex gap-4 font-mono text-xs text-concrete">
            <span>Best Score: <span className="text-chalk font-bold">{data.bestScore}%</span></span>
            <span>Attempts: <span className="text-chalk font-bold">{data.attempts}</span></span><span>Adaptive: <span className="text-chalk font-bold">8–15 Q</span></span>
          </div>
          {data.weakTopics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {data.weakTopics.map((topic) => (
                <span key={topic} className="text-[10px] font-mono bg-hazard/10 border border-hazard/40 text-hazard px-2 py-0.5 rounded">
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => navigate(`/certification/assessment/${slug}`)}
          className="bg-amber text-steel font-bold uppercase text-xs px-4 py-2.5 rounded whitespace-nowrap"
        >
          {buttonLabel} →
        </button>
      </div>
    </div>
  )
}

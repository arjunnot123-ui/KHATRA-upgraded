import { useEffect, useState } from 'react'
import { getAdminCertificates, getAdminAnalytics } from '../lib/api.js'
import { CERTIFICATION_DOMAINS } from '../lib/scenarios.js'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Admin() {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [certificates, setCertificates] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminCertificates()
      .then((data) => setCertificates(data.certificates))
      .catch((e) => setError(e.message))

    getAdminAnalytics()
      .then((data) => setAnalytics(data))
      .catch((e) => console.warn('[Admin] Analytics fetch error:', e.message))
  }, [])

  const list = certificates || []
  const filtered = list.filter((c) => c.worker_name.toLowerCase().includes(search.toLowerCase()))

  const avgCompliance = list.length
    ? Math.round(list.reduce((s, c) => s + c.avg_score, 0) / list.length)
    : 0

  const domainAverages = CERTIFICATION_DOMAINS.map((domain) => {
    const scores = list
      .map((c) => c.domains.find((d) => d.domain === domain)?.score)
      .filter((s) => s !== undefined)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
    return { domain, avg, count: scores.length }
  })

  const exportCsv = () => {
    const header = ['Worker Name', 'Certificate ID', 'Issued Date', 'Average Score', ...CERTIFICATION_DOMAINS]
    const rows = list.map((c) => [
      c.worker_name,
      c.id,
      new Date(c.issued_at).toLocaleDateString(),
      c.avg_score,
      ...CERTIFICATION_DOMAINS.map((domain) => c.domains.find((d) => d.domain === domain)?.score ?? ''),
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'khatra_compliance_export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const overview = analytics?.overview || {}
  const highRisk = analytics?.highRiskDomains || []

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('admin_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-3">{t('admin_title')}</h1>

      <div className="bg-hazard/10 border border-hazard/40 rounded p-3 mb-8 text-xs text-concrete">
        {t('admin_demo_notice')}
      </div>

      {error && (
        <div className="border border-hazard rounded-lg p-4 text-hazard text-sm font-mono mb-8">
          {error === 'FORBIDDEN'
            ? 'Your account does not have admin access to this data.'
            : `Could not reach the admin server: ${error}`}
        </div>
      )}

      {!certificates && !error && (
        <div className="text-concrete font-mono text-sm py-10 text-center">Loading…</div>
      )}

      {/* ── Workforce Safety Analytics (PostgreSQL Authoritative) ── */}
      {analytics && (
        <div className="mb-12">
          <h2 className="font-display font-bold text-2xl uppercase mb-4 text-chalk flex items-center gap-2">
            <span>📊</span> Workforce Safety Analytics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            <StatBlock label="Registered Workers" value={overview.totalWorkers || 0} />
            <StatBlock label="Scenario Sessions" value={overview.totalTrainings || 0} />
            <StatBlock label="Machine Checks" value={overview.totalMachineInspections || 0} accent />
            <StatBlock label="Avg Inspection" value={`${overview.avgMachineScore || 0}%`} />
            <StatBlock label="Hazard Scans" value={overview.totalHazardScans || 0} />
            <StatBlock label="Pass Rate" value={`${overview.passRate || 0}%`} accent />
          </div>

          {/* High Risk Domains */}
          {highRisk.length > 0 && (
            <div className="bg-steel-light border border-hazard/40 rounded-xl p-5 mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-hazard text-lg">⚠️</span>
                <h3 className="font-display font-bold text-base uppercase text-hazard">
                  Workforce Safety Risk Alert · Domains with Highest Failure Rates
                </h3>
              </div>
              <p className="text-xs text-concrete mb-4">
                The following domains have the highest non-compliance and failure rates across all workers. Prioritize these for company-wide safety retraining.
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {highRisk.map((r, i) => (
                  <div key={i} className="bg-steel p-3 rounded-lg border border-steel-lighter">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-chalk truncate pr-2">{r.domain}</span>
                      <span className="font-mono text-hazard font-bold text-xs shrink-0">{r.failureRate}% Fail</span>
                    </div>
                    <span className="font-mono text-[10px] text-concrete block mt-1">
                      {r.failedAttempts} failed / {r.totalAttempts} total attempts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {certificates && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatBlock label={t('admin_total_certs')} value={list.length} />
            <StatBlock label={t('admin_avg_compliance')} value={`${avgCompliance}%`} accent />
            <StatBlock label={t('admin_domains')} value={CERTIFICATION_DOMAINS.length} />
            <StatBlock label={t('admin_pass_rate')} value={list.length ? '100%' : '—'} />
          </div>

          {/* Domain breakdown */}
          <h2 className="font-display font-bold text-2xl uppercase mb-4">{t('admin_domain_breakdown')}</h2>
          <div className="space-y-2 mb-10">
            {domainAverages.map((d) => (
              <div key={d.domain} className="bg-steel-light border border-steel-lighter rounded p-3 flex items-center justify-between">
                <span className="text-sm font-bold">{d.domain}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-concrete font-mono">
                    {d.count} {t('admin_records')}
                  </span>
                  <span className="font-mono text-amber font-bold text-sm">{d.avg !== null ? `${d.avg}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Worker table */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-display font-bold text-2xl uppercase">{t('admin_certified_workers')}</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('admin_search')}
                className="bg-steel-light border border-steel-lighter rounded px-3 py-2 text-sm font-mono focus:border-amber outline-none"
              />
              <button
                onClick={exportCsv}
                disabled={list.length === 0}
                className="bg-amber text-steel font-bold text-xs uppercase px-4 py-2 rounded disabled:opacity-40"
              >
                {t('admin_export_csv')}
              </button>
            </div>
          </div>

          {filtered.length === 0 && (
            <p className="text-concrete font-mono text-sm border border-steel-lighter rounded-lg p-8 text-center">
              {t('admin_no_certs')}
            </p>
          )}

          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id} className="bg-steel-light border border-steel-lighter rounded p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-bold text-sm">{c.worker_name}</p>
                  <p className="font-mono text-[10px] text-concrete">{c.id} · {c.email} · {new Date(c.issued_at).toLocaleDateString()}</p>
                </div>
                <span className="font-mono text-amber font-bold">{c.avg_score}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StatBlock({ label, value, accent }) {
  return (
    <div className="bg-steel-light border border-steel-lighter rounded-lg p-5">
      <p className={`font-display font-bold text-4xl ${accent ? 'text-amber' : 'text-chalk'}`}>{value}</p>
      <p className="font-mono text-[10px] text-concrete uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}

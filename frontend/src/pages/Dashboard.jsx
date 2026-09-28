import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLog, computeStats, clearLog } from '../lib/store.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { apiFetch } from '../context/AuthContext.jsx'
import { useAiAssistant } from '../context/AiAssistantContext.jsx'

export default function Dashboard() {
  const { t } = useLanguage()
  const { setRecentMachineWeaknesses, setRecommendedDomain } = useAiAssistant()
  const [, forceUpdate] = useState(0)

  // Local storage fallback data
  const localLog = getLog()
  const localStats = computeStats()

  // Backend PostgreSQL data
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/dashboard')
      .then((data) => {
        setDashboardData(data)
        if (data?.inspectionStats?.recentWeakAreas?.length) {
          setRecentMachineWeaknesses(data.inspectionStats.recentWeakAreas)
        }
        if (data?.recommendations?.domainSlug) {
          setRecommendedDomain(data.recommendations.domainSlug)
        }
      })
      .catch((err) => {
        console.warn('[Dashboard] Falling back to local training log:', err.message)
      })
      .finally(() => setLoading(false))
  }, [setRecentMachineWeaknesses, setRecommendedDomain])

  const inspections = dashboardData?.inspections || []
  const hazardScans = dashboardData?.hazardScans || []
  const scanStats = dashboardData?.scanStats || { totalScans: 0, totalHazards: 0, avgRiskScore: 0 }
  const recommendations = dashboardData?.recommendations || null
  const inspectionStats = dashboardData?.inspectionStats || {
    total: 0,
    avgScore: 0,
    passedCount: 0,
    recentWeakAreas: [],
  }

  // Calculate overall metrics
  const totalAssessments = dashboardData?.assessments?.length || 0
  const totalInspections = inspectionStats.total || 0
  const totalHazardScans = scanStats.totalScans || 0
  const totalSessions = (dashboardData?.progress?.length || localStats.scenarios) + totalAssessments + totalInspections + totalHazardScans
  const avgInspectionScore = inspectionStats.avgScore || 0

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('dash_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-10 text-chalk">{t('dash_title')}</h1>

      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatBlock label="Total Sessions" value={totalSessions} />
        <StatBlock label="Assessments Taken" value={totalAssessments} />
        <StatBlock label="3D Machine Inspections" value={totalInspections} accent />
        <StatBlock label="AI Hazard Scans" value={totalHazardScans} accent={totalHazardScans > 0} />
      </div>

      {/* ── Actionable AI Safety Recommendations (End-to-End Retraining) ── */}
      {recommendations && (
        <div className="bg-gradient-to-r from-amber/15 via-steel-light to-steel-light border-2 border-amber/60 rounded-xl p-6 mb-10 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber/30 pb-4 mb-4">
            <div>
              <span className="font-mono text-[10px] text-amber uppercase tracking-widest block mb-1">
                Personalized Learning Engine · Real-Time Retraining
              </span>
              <h2 className="font-display font-bold text-2xl uppercase text-chalk flex items-center gap-2">
                <span>⚡</span> Targeted Practice Recommendation
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/certification/assessment/${recommendations.domainSlug}?mode=practice`}
                className="font-mono text-xs bg-amber text-steel font-bold uppercase px-4 py-2 rounded-lg hover:bg-white transition-colors"
              >
                Start Adaptive Practice →
              </Link>
              <Link
                to="/train"
                className="font-mono text-xs border border-steel-lighter text-chalk hover:text-amber uppercase px-3 py-2 rounded-lg transition-colors"
              >
                Review Modules
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-steel/80 p-3 rounded-lg border border-steel-lighter">
              <span className="font-mono text-[10px] text-concrete uppercase block">Recommended Domain</span>
              <span className="font-bold text-sm text-chalk mt-1 block">{recommendations.recommendedDomain}</span>
            </div>
            <div className="bg-steel/80 p-3 rounded-lg border border-steel-lighter">
              <span className="font-mono text-[10px] text-concrete uppercase block">Identified Reason</span>
              <span className="text-concrete mt-1 block leading-tight">{recommendations.reason}</span>
            </div>
            <div className="bg-steel/80 p-3 rounded-lg border border-steel-lighter">
              <span className="font-mono text-[10px] text-concrete uppercase block">Target Weak Topics</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {recommendations.weakTopics?.length > 0 ? (
                  recommendations.weakTopics.map((t, idx) => (
                    <span key={idx} className="bg-hazard/20 text-hazard text-[10px] font-mono px-1.5 py-0.5 rounded">
                      {t}
                    </span>
                  ))
                ) : (
                  <span className="text-safe font-mono text-[11px]">Core compliance reinforcement</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Machine Inspection Standing & Weak Areas ── */}
      <div className="bg-steel-light border border-steel-lighter rounded-xl p-6 mb-10 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-steel-lighter pb-4 mb-5">
          <div>
            <span className="font-mono text-[10px] text-amber uppercase tracking-widest block mb-1">
              Industrial Safety Competence
            </span>
            <h2 className="font-display font-bold text-2xl uppercase text-chalk">
              3D Machine Inspection Standing
            </h2>
          </div>
          <Link
            to="/inspector"
            className="font-mono text-xs bg-amber text-steel font-bold uppercase px-4 py-2 rounded-lg hover:bg-white transition-colors"
          >
            Launch 3D Lab →
          </Link>
        </div>

        {/* Machine Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-steel p-4 rounded-lg border border-steel-lighter">
            <span className="font-mono text-[10px] text-concrete uppercase block">Inspections Completed</span>
            <span className="font-display font-bold text-3xl text-chalk mt-1 block">{totalInspections}</span>
          </div>
          <div className="bg-steel p-4 rounded-lg border border-steel-lighter">
            <span className="font-mono text-[10px] text-concrete uppercase block">Pre-Shift Pass Rate</span>
            <span className={`font-display font-bold text-3xl mt-1 block ${totalInspections ? 'text-safe' : 'text-concrete'}`}>
              {totalInspections ? `${Math.round((inspectionStats.passedCount / totalInspections) * 100)}%` : '—'}
            </span>
          </div>
          <div className="bg-steel p-4 rounded-lg border border-steel-lighter">
            <span className="font-mono text-[10px] text-concrete uppercase block">Average Safety Score</span>
            <span className={`font-display font-bold text-3xl mt-1 block ${avgInspectionScore >= 70 ? 'text-safe' : 'text-hazard'}`}>
              {avgInspectionScore}%
            </span>
          </div>
        </div>

        {/* Weak Areas -> Adaptive Assessment Recommendations */}
        {inspectionStats.recentWeakAreas?.length > 0 ? (
          <div className="border border-amber/40 bg-amber/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎯</span>
              <h3 className="font-display font-bold text-base uppercase text-amber">
                Identified Weak Areas · Adaptive Assessment Recommendations
              </h3>
            </div>
            <p className="text-xs text-concrete mb-3 leading-relaxed">
              Based on your pre-shift checklists and 3D machine simulations, the following safety domains require refresher practice:
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {inspectionStats.recentWeakAreas.slice(0, 4).map((w, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-steel rounded-lg border border-steel-lighter text-xs">
                  <span className="text-chalk truncate pr-2 font-medium">{w.label || w.hazard || 'Component check'}</span>
                  <Link
                    to={`/certification/assessment/${w.domainSlug || 'machinery-loto'}?mode=practice`}
                    className="text-amber font-mono text-[10px] hover:underline shrink-0 font-bold"
                  >
                    Practice Domain →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-concrete font-mono">
            {totalInspections > 0
              ? '✓ No critical defect patterns identified across your recent machine inspections.'
              : 'Complete a pre-shift machine inspection in the 3D Training Lab to analyze competency and identify weak areas.'}
          </p>
        )}
      </div>

      {/* ── Recent PostgreSQL Machine Inspections ── */}
      {inspections.length > 0 && (
        <div className="mb-10">
          <h2 className="font-display font-bold text-2xl uppercase mb-4 text-chalk">Recent Machine Inspections</h2>
          <div className="space-y-2">
            {inspections.slice(0, 5).map((insp) => (
              <div key={insp.id} className="bg-steel-light border border-steel-lighter rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-chalk">{insp.machine_name}</span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 bg-steel rounded text-concrete border border-steel-lighter">
                      {insp.mode}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-concrete mt-1">
                    {new Date(insp.completed_at).toLocaleString()} · {insp.notes || 'Inspection completed'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`font-display font-bold text-xl block ${insp.passed ? 'text-safe' : 'text-hazard'}`}>
                    {insp.score}%
                  </span>
                  <span className="font-mono text-[10px] text-concrete uppercase">
                    {insp.passed ? 'PASSED' : 'DEFECTS DETECTED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent PostgreSQL AI Hazard Scans ── */}
      {hazardScans.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-2xl uppercase text-chalk">Recent AI Hazard Scans</h2>
            <Link
              to="/scan"
              className="font-mono text-xs text-amber hover:underline uppercase"
            >
              New Scan →
            </Link>
          </div>
          <div className="space-y-2">
            {hazardScans.slice(0, 5).map((scan) => (
              <div key={scan.id} className="bg-steel-light border border-steel-lighter rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-chalk">
                      Hazard Scan #{scan.id.substring(0, 8)}
                    </span>
                    <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      scan.risk_level === 'high' ? 'bg-hazard/20 text-hazard' :
                      scan.risk_level === 'medium' ? 'bg-amber/20 text-amber' : 'bg-safe/20 text-safe'
                    }`}>
                      {scan.risk_level || 'LOW'} RISK
                    </span>
                  </div>
                  <p className="font-mono text-xs text-concrete mt-1">
                    {new Date(scan.scanned_at || scan.created_at).toLocaleString()} · {scan.hazard_count || 0} hazards detected
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-display font-bold text-xl block text-amber">
                    {scan.risk_score}/100
                  </span>
                  <span className="font-mono text-[10px] text-concrete uppercase">
                    Risk Score
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── General Activity Log ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-2xl uppercase text-chalk">{t('dash_log')}</h2>
        {localLog.length > 0 && (
          <button
            onClick={() => {
              clearLog()
              forceUpdate((n) => n + 1)
            }}
            className="font-mono text-xs text-concrete hover:text-hazard underline"
          >
            {t('dash_clear')}
          </button>
        )}
      </div>

      {localLog.length === 0 && inspections.length === 0 && (
        <p className="text-concrete font-mono text-sm border border-steel-lighter rounded-lg p-8 text-center bg-steel-light">
          {t('dash_empty')}
        </p>
      )}

      <div className="space-y-2">
        {localLog.map((entry, i) => (
          <div key={i} className="bg-steel-light border border-steel-lighter rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm uppercase text-chalk">
                {entry.type === 'scan' ? t('dash_hazard_scan') : entry.type === 'inspection' ? 'Photo Machine Inspection' : t('dash_scenario_training')}
                {entry.scenarioId ? ` — ${entry.scenarioId}` : ''}
              </p>
              <p className="font-mono text-xs text-concrete">{new Date(entry.timestamp).toLocaleString()}</p>
            </div>
            <div className="text-right">
              {entry.type === 'scan' ? (
                <>
                  <p className="font-mono text-amber font-bold">{entry.riskScore}/100</p>
                  <p className="text-[10px] text-concrete font-mono">
                    {entry.hazardCount} {t('dash_hazards_word')}
                  </p>
                </>
              ) : entry.type === 'inspection' ? (
                <>
                  <p className="font-mono text-amber font-bold">{entry.riskScore}/100</p>
                  <p className="text-[10px] text-concrete font-mono">{entry.markerCount} markers</p>
                </>
              ) : (
                <p className="font-mono text-amber font-bold">{entry.score}%</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBlock({ label, value, accent }) {
  return (
    <div className="bg-steel-light border border-steel-lighter rounded-xl p-5 shadow-sm">
      <p className={`font-display font-bold text-4xl ${accent ? 'text-amber' : 'text-chalk'}`}>{value}</p>
      <p className="font-mono text-[10px] text-concrete uppercase tracking-widest mt-1">{label}</p>
    </div>
  )
}

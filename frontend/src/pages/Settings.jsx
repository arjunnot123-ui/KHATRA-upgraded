import { useState, useEffect } from 'react'
import { getAiStatus } from '../lib/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'
import { LANGUAGES } from '../lib/i18n.js'

export default function Settings() {
  const { t, lang, setLang } = useLanguage()
  const [aiStatus, setAiStatus] = useState(null) // { provider, configured }
  const [aiLoading, setAiLoading] = useState(true)
  const [aiError, setAiError] = useState(false)

  useEffect(() => {
    getAiStatus()
      .then((s) => { setAiStatus(s); setAiLoading(false) })
      .catch(() => { setAiError(true); setAiLoading(false) })
  }, [])

  return (
    <div className="max-w-xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('set_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl uppercase mb-8">{t('set_title')}</h1>

      <div className="space-y-6">
        {/* ── Language ── */}
        <div className="bg-steel-light border border-steel-lighter rounded-lg p-6">
          <label className="font-mono text-xs uppercase tracking-widest text-concrete block mb-3">
            {t('set_language_label')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded p-2.5 font-mono text-sm border ${
                  lang === l.code ? 'border-amber text-amber bg-amber/10' : 'border-steel-lighter text-concrete'
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>
        </div>

        {/* ── AI Service Status ── */}
        <div className="bg-steel-light border border-steel-lighter rounded-lg p-6">
          <p className="font-mono text-xs uppercase tracking-widest text-concrete mb-4">
            AI Service
          </p>

          {aiLoading && (
            <p className="font-mono text-xs text-concrete animate-pulse">Checking AI status…</p>
          )}

          {!aiLoading && aiError && (
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-hazard mt-1 shrink-0" />
              <div>
                <p className="font-bold text-sm text-chalk">Server Unreachable</p>
                <p className="text-xs text-concrete mt-1">
                  Could not connect to the KHATRA backend. Make sure the server is running on port 4000.
                </p>
              </div>
            </div>
          )}

          {!aiLoading && !aiError && aiStatus && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-concrete uppercase tracking-widest">Provider</span>
                <span className="font-mono text-xs text-chalk">{aiStatus.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-concrete uppercase tracking-widest">Status</span>
                <span className={`flex items-center gap-1.5 font-mono text-xs ${aiStatus.configured ? 'text-safe' : 'text-hazard'}`}>
                  <span className={`w-2 h-2 rounded-full ${aiStatus.configured ? 'bg-safe' : 'bg-hazard'}`} />
                  {aiStatus.configured ? 'Connected' : 'Not configured'}
                </span>
              </div>

              {!aiStatus.configured && (
                <div className="mt-3 border border-amber/40 bg-amber/5 rounded p-3">
                  <p className="font-mono text-[11px] text-amber uppercase tracking-wider mb-1">
                    Admin action required
                  </p>
                  <p className="text-xs text-concrete leading-relaxed">
                    Add <code className="text-chalk bg-steel px-1 rounded">GEMINI_API_KEY</code> or{' '}
                    <code className="text-chalk bg-steel px-1 rounded">OPENAI_API_KEY</code> to{' '}
                    <code className="text-chalk bg-steel px-1 rounded">backend/.env</code>, then restart the backend.
                    AI features will become available automatically — workers do not need to enter any key.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Info note ── */}
        <p className="text-xs text-concrete leading-relaxed">
          AI provider keys are managed by the system administrator on the server.
          Workers and trainees never need to provide or manage API keys.
        </p>
      </div>
    </div>
  )
}

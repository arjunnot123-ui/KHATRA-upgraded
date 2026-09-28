import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { verifyCertificateBackend } from '../lib/api.js'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function Verify() {
  const { certId } = useParams()
  const { t } = useLanguage()
  const [state, setState] = useState({ loading: true, valid: false, cert: null })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, valid: false, cert: null })
    verifyCertificateBackend(certId)
      .then((data) => {
        if (!cancelled) setState({ loading: false, valid: Boolean(data.valid), cert: data.cert || null })
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, valid: false, cert: null })
      })
    return () => { cancelled = true }
  }, [certId])

  const { loading, valid, cert } = state

  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3 text-center">{t('verify_eyebrow')}</p>
      <h1 className="font-display font-bold text-3xl md:text-4xl uppercase mb-8 text-center">{t('verify_title')}</h1>

      {loading && (
        <div className="text-center text-concrete font-mono text-sm py-16">Verifying…</div>
      )}

      {!loading && valid && cert && (
        <div className="bg-steel-light border-2 border-safe rounded-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-safe text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">✓</div>
          <p className="font-bold text-safe uppercase tracking-widest text-sm mb-6">{t('verify_valid')}</p>

          <h2 className="font-display font-bold text-2xl uppercase mb-1">{cert.worker_name}</h2>
          <p className="text-concrete text-xs font-mono mb-6">
            {t('verify_issued')} {new Date(cert.issued_at).toLocaleDateString()} · {cert.platform}
          </p>

          <div className="text-left space-y-2 border-t border-steel-lighter pt-6">
            {(cert.domains || []).map((d) => (
              <div key={d.domain} className="flex justify-between text-sm">
                <span>{d.domain}</span>
                <span className="font-mono text-amber font-bold">{d.score}%</span>
              </div>
            ))}
          </div>

          <div className="border-t border-steel-lighter mt-6 pt-4 flex justify-between text-sm">
            <span className="font-bold">{t('verify_avg')}</span>
            <span className="font-mono text-amber font-bold">{cert.avg_score}%</span>
          </div>

          <p className="font-mono text-[10px] text-concrete break-all mt-6">{cert.id}</p>
        </div>
      )}

      {!loading && !valid && (
        <div className="bg-steel-light border-2 border-hazard rounded-lg p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-hazard text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">×</div>
          <p className="font-bold text-hazard uppercase tracking-widest text-sm mb-2">{t('verify_invalid')}</p>
          <p className="text-concrete text-sm">{t('verify_invalid_desc')}</p>
        </div>
      )}

      <div className="text-center mt-8">
        <Link to="/" className="text-amber underline text-sm">{t('nav_home')}</Link>
      </div>
    </div>
  )
}

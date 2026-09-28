import { Link } from 'react-router-dom'
import { SCENARIOS } from '../lib/scenarios.js'
import { translateScenario } from '../lib/scenarioTranslations.js'
import { useLanguage } from '../context/LanguageContext.jsx'

export default function ScenarioList() {
  const { t, lang } = useLanguage()
  const scenarios = SCENARIOS.map((s) => translateScenario(s, lang))

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('list_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-2">{t('list_title')}</h1>
      <p className="text-concrete mb-10 max-w-xl">{t('list_desc')}</p>

      <div className="grid md:grid-cols-2 gap-6">
        {scenarios.map((s) => (
          <Link
            key={s.id}
            to={`/train/${s.id}`}
            className="bg-steel-light border border-steel-lighter rounded-lg p-6 hover:border-amber transition-colors group"
          >
            <p className="font-mono text-amber text-xs uppercase tracking-widest mb-3">{s.sector}</p>
            <h2 className="font-display font-bold text-2xl uppercase mb-3 group-hover:text-amber">{s.title}</h2>
            <p className="text-concrete text-sm leading-relaxed mb-4">{s.intro}</p>
            <span className="font-mono text-xs uppercase text-concrete">
              {s.steps.length} {t('list_points')} →
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

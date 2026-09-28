import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getScenario } from '../lib/scenarios.js'
import { translateScenario } from '../lib/scenarioTranslations.js'
import { askTrainer, saveTrainingProgress } from '../lib/api.js'
import { speak, stopSpeaking } from '../lib/speech.js'
import { addLogEntry } from '../lib/store.js'
import RiskGauge from '../components/RiskGauge.jsx'
import SafetyScene3D from '../components/SafetyScene3D.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { langName } from '../lib/i18n.js'

export default function Scenario() {
  const { id } = useParams()
  const { t, lang } = useLanguage()
  const baseScenario = getScenario(id)
  const scenario = baseScenario ? translateScenario(baseScenario, lang) : null
  const [stepIndex, setStepIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [aiCoaching, setAiCoaching] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [finished, setFinished] = useState(false)
  const introSpoken = useRef(false)

  const step = scenario?.steps[stepIndex]

  useEffect(() => {
    if (scenario && !introSpoken.current) {
      speak(scenario.intro)
      introSpoken.current = true
    }
    return () => stopSpeaking()
  }, [scenario])

  if (!scenario) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-16 text-center">
        <p className="text-concrete mb-4">Scenario not found.</p>
        <Link to="/train" className="text-amber underline">
          {t('sc_more')}
        </Link>
      </div>
    )
  }

  const choose = async (choice) => {
    setFeedback(choice)
    setScore((s) => s + choice.points)
    speak(choice.feedback)

    // AI coaching tip — optional enhancement; fails silently if AI not configured
    setAiLoading(true)
    try {
      const context = `You are a firm but encouraging industrial safety trainer for mining and manufacturing workers in India. Keep responses to 2 short sentences, plain language, practical tone. Respond in ${langName(lang)}.`
      const msg = `Scenario: ${scenario.title}. Situation: "${step.prompt}" Worker chose: "${choice.text}" (${choice.points > 0 ? 'a safe choice' : 'an unsafe choice'}). Give one short additional coaching tip beyond the base feedback, specific to this situation.`
      const aiText = await askTrainer(context, [{ role: 'user', content: msg }])
      setAiCoaching(aiText)
    } catch {
      setAiCoaching('') // coaching is optional — silently omit on failure
    } finally {
      setAiLoading(false)
    }
  }

  const next = () => {
    setFeedback(null)
    setAiCoaching('')
    if (stepIndex + 1 < scenario.steps.length) {
      setStepIndex((i) => i + 1)
    } else {
      setFinished(true)
      const maxScore = scenario.steps.reduce((s, st) => s + Math.max(...st.choices.map((c) => c.points)), 0)
      const pct = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)))
      addLogEntry({ type: 'scenario', scenarioId: scenario.id, score: pct })
      saveTrainingProgress(scenario.id, pct).catch((err) => {
        console.warn('[Scenario] Failed to persist progress to PostgreSQL:', err.message)
      })
    }
  }

  if (finished) {
    const maxScore = scenario.steps.reduce((s, st) => s + Math.max(...st.choices.map((c) => c.points)), 0)
    const pct = Math.max(0, Math.round((score / maxScore) * 100))
    const riskDisplay = 100 - pct
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('sc_complete')}</p>
        <h1 className="font-display font-bold text-4xl uppercase mb-8">{scenario.title}</h1>
        <RiskGauge score={riskDisplay} />
        <p className="text-concrete mt-6 mb-10">
          {t('sc_score_label')} <span className="text-amber font-bold">{pct}%</span> {t('sc_score_of')}
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/train" className="border border-concrete rounded px-6 py-3 font-mono text-sm hover:border-amber hover:text-amber">
            {t('sc_more')}
          </Link>
          <Link to="/dashboard" className="bg-amber text-steel font-display font-bold uppercase px-6 py-3 rounded">
            {t('sc_dashboard')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">
        {scenario.sector} · {t('sc_decision')} {stepIndex + 1} {t('sc_of')} {scenario.steps.length}
      </p>
      <h1 className="font-display font-bold text-3xl uppercase mb-6">{scenario.title}</h1><SafetyScene3D scenarioId={scenario.id} />

      {stepIndex === 0 && !feedback && (
        <p className="text-concrete mb-8 leading-relaxed border-l-2 border-amber pl-4">{scenario.intro}</p>
      )}

      <div className="bg-steel-light border border-steel-lighter rounded-lg p-6 mb-6">
        <p className="text-lg leading-relaxed">{step.prompt}</p>
      </div>

      {!feedback && (
        <div className="grid gap-3">
          {step.choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => choose(choice)}
              className="text-left bg-steel-light hover:bg-steel-lighter border border-steel-lighter hover:border-amber rounded-lg p-4 transition-colors"
            >
              {choice.text}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <div className="space-y-4">
          <div
            className="rounded-lg p-5 border-l-4"
            style={{ borderColor: feedback.points > 0 ? '#2E7D4F' : '#D93025', background: 'rgba(255,255,255,0.03)' }}
          >
            <p className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: feedback.points > 0 ? '#2E7D4F' : '#D93025' }}>
              {feedback.points > 0 ? t('sc_safe') : t('sc_unsafe')}
            </p>
            <p className="text-sm leading-relaxed">{feedback.feedback}</p>
            {aiLoading && <p className="text-xs text-concrete mt-3 font-mono">{t('sc_trainer_thinking')}</p>}
            {aiCoaching && (
              <p className="text-xs text-amber mt-3 border-t border-steel-lighter pt-3 leading-relaxed">🎙 {aiCoaching}</p>
            )}
          </div>
          <button onClick={next} className="w-full bg-amber text-steel font-display font-bold text-lg uppercase py-3 rounded">
            {stepIndex + 1 < scenario.steps.length ? t('sc_continue') : t('sc_finish')}
          </button>
        </div>
      )}
    </div>
  )
}

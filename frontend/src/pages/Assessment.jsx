import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { domainForSlug } from '../lib/domains.js'
import { startAssessment, submitAssessmentAnswer, getAssessmentSession } from '../lib/api.js'
import { useAiAssistant } from '../context/AiAssistantContext.jsx'

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
const DIFFICULTY_COLOR = { easy: 'text-safe', medium: 'text-amber', hard: 'text-hazard' }
const TYPE_HINT = {
  MCQ: 'Choose the best answer.',
  'true-false': 'True or false?',
  scenario: 'Choose the best response to this situation.',
  'hazard-identification': 'Choose the best answer.',
  'PPE-selection': 'Choose the best answer.',
  'multi-select': 'Select ALL that apply, then submit.',
  'sequence-order': 'Click the steps in the correct order, then submit.',
}

export default function Assessment() {
  const { domainSlug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = searchParams.get('mode') === 'practice' ? 'practice' : 'assessment'
  const domain = domainForSlug(domainSlug)

  const { setAiAssessmentResult } = useAiAssistant()

  const [phase, setPhase] = useState('loading') // loading | question | feedback | completed | error
  const [error, setError] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [question, setQuestion] = useState(null)
  const [progress, setProgress] = useState({ index: 0, total: 0 })
  const [feedback, setFeedback] = useState(null)
  const [feedbackQuestion, setFeedbackQuestion] = useState(null)
  const [result, setResult] = useState(null)

  const [singleSelected, setSingleSelected] = useState(null)
  const [multiSelected, setMultiSelected] = useState([])
  const [sequence, setSequence] = useState([])
  const [questionStartedAt, setQuestionStartedAt] = useState(null)

  function resetSelections() {
    setSingleSelected(null)
    setMultiSelected([])
    setSequence([])
  }

  async function begin() {
    setPhase('loading')
    setError('')
    try {
      const resumeKey = `khatra_assessment_session:${domainSlug}:${mode}`
      const savedSessionId = sessionStorage.getItem(resumeKey)
      if (savedSessionId) {
        try {
          const resumed = await getAssessmentSession(savedSessionId)
          if (resumed.status === 'in_progress' && resumed.question) {
            setSessionId(savedSessionId)
            setQuestion(resumed.question)
            setProgress(resumed.progress)
            resetSelections()
            setQuestionStartedAt(Date.now())
            setPhase('question')
            return
          }
          if (resumed.status === 'completed' && resumed.result) {
            setSessionId(savedSessionId)
            setResult(resumed.result)
            setAiAssessmentResult({ ...resumed.result, domain })
            setPhase('completed')
            return
          }
        } catch {
          sessionStorage.removeItem(resumeKey)
        }
      }

      const data = await startAssessment(domain, mode)
      setSessionId(data.sessionId)
      setQuestion(data.question)
      setProgress(data.progress)
      resetSelections()
      setQuestionStartedAt(Date.now())
      sessionStorage.setItem(resumeKey, data.sessionId)
      setPhase('question')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  useEffect(() => {
    if (!domain) { setPhase('error'); setError('UNKNOWN_DOMAIN'); return }
    begin()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainSlug, mode])

  const canSubmit = useMemo(() => {
    if (!question) return false
    if (question.questionType === 'multi-select') return multiSelected.length > 0
    if (question.questionType === 'sequence-order') return sequence.length === question.options.length
    return singleSelected !== null
  }, [question, singleSelected, multiSelected, sequence])

  async function handleSubmit() {
    if (!canSubmit || !sessionId) return
    const timeTakenMs = questionStartedAt ? Date.now() - questionStartedAt : 0
    let answer
    if (question.questionType === 'multi-select') answer = multiSelected
    else if (question.questionType === 'sequence-order') answer = sequence
    else answer = singleSelected

    setPhase('loading')
    try {
      const data = await submitAssessmentAnswer(sessionId, answer, timeTakenMs)
      setFeedback(data.feedback)
      setFeedbackQuestion(question)
      if (data.completed) {
        sessionStorage.removeItem(`khatra_assessment_session:${domainSlug}:${mode}`)
        setResult(data.result)
        setAiAssessmentResult({ ...data.result, domain })
        setPhase('completed')
      } else {
        setQuestion(data.nextQuestion)
        setProgress(data.progress)
        setPhase('feedback')
      }
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  function handleContinue() {
    resetSelections()
    setFeedback(null)
    setFeedbackQuestion(null)
    setQuestionStartedAt(Date.now())
    setPhase('question')
  }

  if (!domain) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <p className="text-hazard font-bold mb-4">Unknown safety domain.</p>
        <Link to="/certification" className="text-amber underline">Back to Certification</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase">
          {mode === 'practice' ? 'Practice Session' : 'Certification Assessment'}
        </p>
        <Link to="/certification" className="font-mono text-[11px] text-concrete hover:text-amber uppercase">
          Exit to Certification
        </Link>
      </div>
      <h1 className="font-display font-bold text-3xl md:text-4xl uppercase mb-6">{domain}</h1>

      {phase === 'error' && (
        <div className="bg-steel-light border border-hazard rounded-lg p-6 text-center">
          <p className="text-hazard font-bold mb-2">Something went wrong.</p>
          <p className="text-concrete text-sm font-mono mb-4">{error}</p>
          <button onClick={begin} className="bg-amber text-steel font-bold uppercase text-xs px-5 py-2.5 rounded">
            Try Again
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="text-center py-20 text-concrete font-mono text-sm">Loading…</div>
      )}

      {(phase === 'question' || phase === 'feedback') && question && (
        <>
          <ProgressBar progress={progress} />

          <div className="bg-steel-light border border-steel-lighter rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${DIFFICULTY_COLOR[question.difficulty] || 'text-concrete'}`}>
                {DIFFICULTY_LABEL[question.difficulty] || question.difficulty}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-concrete">· {question.topic}</span>
            </div>
            <p className="text-lg font-bold mb-1 leading-snug">{question.question}</p>
            <p className="text-xs text-concrete font-mono mb-5">{TYPE_HINT[question.questionType] || ''}</p>
            {progress.adaptive && <div className="mb-4 rounded border border-amber/30 bg-amber/5 px-3 py-2 text-[11px] text-concrete font-mono">Adaptive mode: difficulty and topic selection respond to your previous answer.</div>}

            {phase === 'question' && (
              <QuestionInput
                question={question}
                singleSelected={singleSelected}
                setSingleSelected={setSingleSelected}
                multiSelected={multiSelected}
                setMultiSelected={setMultiSelected}
                sequence={sequence}
                setSequence={setSequence}
              />
            )}

            {phase === 'feedback' && feedback && feedbackQuestion && (
              <FeedbackPanel feedback={feedback} question={feedbackQuestion} />
            )}
          </div>

          {phase === 'question' && (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-amber disabled:bg-steel-lighter disabled:text-concrete text-steel font-display font-bold text-lg uppercase py-3 rounded"
            >
              Submit Answer
            </button>
          )}
          {phase === 'feedback' && (
            <button
              onClick={handleContinue}
              className="w-full bg-amber text-steel font-display font-bold text-lg uppercase py-3 rounded"
            >
              Continue
            </button>
          )}
        </>
      )}

      {phase === 'completed' && result && (
        <ResultScreen
          result={result}
          domain={domain}
          domainSlug={domainSlug}
          mode={mode}
          feedback={feedback}
          navigate={navigate}
        />
      )}
    </div>
  )
}

function ProgressBar({ progress }) {
  const index = Math.max(1, Number(progress.index || 1))
  const min = Number(progress.min || progress.total || 1)
  const max = Number(progress.max || progress.total || min)
  const pct = Math.min(100, Math.round(((index - 1) / Math.max(max, 1)) * 100))
  return (
    <div className="mb-6">
      <div className="flex justify-between font-mono text-[11px] text-concrete mb-1">
        <span>{progress.adaptive ? `Adaptive assessment · Question ${index}` : `Question ${index} of ${progress.total}`}</span>
        <span>{progress.adaptive ? `${min} min · ${max} max` : `${pct}%`}</span>
      </div>
      <div className="h-2 bg-steel rounded-full overflow-hidden">
        <div className="h-full bg-amber transition-all" style={{ width: `${pct}%` }} />
      </div>
      {progress.adaptive && (
        <p className="text-[10px] text-concrete font-mono mt-2">
          The next question adapts to your answers. The assessment may finish once enough evidence of competency is collected.
        </p>
      )}
    </div>
  )
}

function QuestionInput({ question, singleSelected, setSingleSelected, multiSelected, setMultiSelected, sequence, setSequence }) {
  const { questionType, options } = question

  if (questionType === 'multi-select') {
    return (
      <div className="space-y-2">
        {options.map((opt, i) => {
          const checked = multiSelected.includes(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => setMultiSelected(checked ? multiSelected.filter((x) => x !== i) : [...multiSelected, i])}
              className={`w-full text-left px-4 py-3 rounded border font-mono text-sm flex items-center gap-3 transition-colors ${
                checked ? 'border-amber bg-amber/10 text-chalk' : 'border-steel-lighter hover:border-amber/60'
              }`}
            >
              <span className={`w-4 h-4 rounded border flex-shrink-0 ${checked ? 'bg-amber border-amber' : 'border-concrete'}`} />
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (questionType === 'sequence-order') {
    const remaining = options.map((_, i) => i).filter((i) => !sequence.includes(i))
    return (
      <div>
        {sequence.length > 0 && (
          <div className="space-y-2 mb-4">
            {sequence.map((idx, orderPos) => (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5 rounded border border-amber bg-amber/10 font-mono text-sm">
                <span className="font-display font-bold text-amber">{orderPos + 1}</span>
                <span className="flex-1">{options[idx]}</span>
                <button
                  type="button"
                  onClick={() => setSequence(sequence.filter((x) => x !== idx))}
                  className="text-concrete hover:text-hazard text-xs uppercase font-bold"
                >
                  Undo
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {remaining.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSequence([...sequence, i])}
              className="w-full text-left px-4 py-3 rounded border border-steel-lighter hover:border-amber/60 font-mono text-sm"
            >
              {options[i]}
            </button>
          ))}
        </div>
        {remaining.length === 0 && (
          <p className="text-xs text-concrete font-mono mt-2">All steps placed — submit, or press Undo to reorder.</p>
        )}
      </div>
    )
  }

  // MCQ / true-false / scenario / hazard-identification / PPE-selection — single choice
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setSingleSelected(i)}
          className={`w-full text-left px-4 py-3 rounded border font-mono text-sm transition-colors ${
            singleSelected === i ? 'border-amber bg-amber/10 text-chalk' : 'border-steel-lighter hover:border-amber/60'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function FeedbackPanel({ feedback, question }) {
  const correctText = renderCorrectAnswer(feedback, question)
  return (
    <div className={`border-t pt-4 mt-2 ${feedback.correct ? 'border-safe' : 'border-hazard'}`}>
      <p className={`font-display font-bold text-xl uppercase mb-2 ${feedback.correct ? 'text-safe' : 'text-hazard'}`}>
        {feedback.correct ? '✓ Correct' : '✕ Not Quite'}
      </p>
      {!feedback.correct && correctText && (
        <p className="text-sm mb-2"><span className="text-concrete">Correct answer: </span><span className="font-bold">{correctText}</span></p>
      )}
      <p className="text-sm text-chalk mb-2">{feedback.explanation}</p>
      <p className="text-xs font-mono text-amber uppercase tracking-wide">Safety principle: {feedback.safetyPrinciple}</p>
    </div>
  )
}

function renderCorrectAnswer(feedback, question) {
  const { correctAnswer, options, questionType } = feedback
  if (questionType === 'multi-select' && Array.isArray(correctAnswer)) {
    return correctAnswer.map((i) => options[i]).join('; ')
  }
  if (questionType === 'sequence-order' && Array.isArray(correctAnswer)) {
    return correctAnswer.map((i, pos) => `${pos + 1}. ${options[i]}`).join('  ')
  }
  if (typeof correctAnswer === 'number') return options[correctAnswer]
  return ''
}

function ResultScreen({ result, domain, domainSlug, mode, navigate }) {
  const passed = result.passed
  const isPractice = result.is_practice
  const breakdown = result.difficulty_breakdown || {}
  const weakTopics = result.weak_topics || []
  const recommendations = result.recommendations || []
  const competencyMet = result.score >= 75 && Number(breakdown?.hard?.correct || 0) >= 1 && Number(result.total_questions || 0) < 15

  return (
    <div>
      <div className={`bg-steel-light border-2 rounded-lg p-8 text-center mb-6 ${passed ? 'border-safe' : 'border-hazard'}`}>
        <p className={`font-mono text-xs uppercase tracking-widest mb-2 ${passed ? 'text-safe' : 'text-hazard'}`}>
          {isPractice ? 'Practice Complete' : passed ? 'Domain Passed' : 'Domain Not Passed'}
        </p>
        <p className="font-display font-bold text-6xl text-amber mb-1">{result.score}%</p>
        <p className="text-concrete text-xs font-mono mb-2">Pass threshold: 70% · Questions answered: {result.total_questions}</p>
        <p className={`text-[11px] font-mono mb-6 ${competencyMet ? 'text-safe' : 'text-concrete'}`}>{competencyMet ? 'Competency evidence threshold met before the maximum question limit.' : 'Assessment completed after collecting additional evidence or reaching the adaptive limit.'}</p>

        <div className="grid grid-cols-3 gap-3 text-sm mb-6">
          <Stat label="Correct" value={result.correct_count} />
          <Stat label="Incorrect" value={result.incorrect_count} />
          <Stat label="Time" value={`${Math.round(result.time_taken_seconds / 60) || 0}m ${result.time_taken_seconds % 60}s`} />
        </div>

        <div className="space-y-2 mb-6 text-left">
          <p className="font-mono text-[10px] uppercase tracking-widest text-concrete mb-1 text-center">Difficulty Breakdown</p>
          {['easy', 'medium', 'hard'].map((tier) => {
            const b = breakdown[tier]
            if (!b || b.total === 0) return null
            return (
              <div key={tier} className="flex items-center gap-3">
                <span className="w-16 font-mono text-xs uppercase text-concrete">{tier}</span>
                <div className="flex-1 h-2 bg-steel rounded-full overflow-hidden">
                  <div className="h-full bg-amber" style={{ width: `${Math.round((b.correct / b.total) * 100)}%` }} />
                </div>
                <span className="font-mono text-xs text-concrete w-12 text-right">{b.correct}/{b.total}</span>
              </div>
            )
          })}
        </div>

        {weakTopics.length > 0 && (
          <div className="text-left mb-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-concrete mb-2">Weak Topics</p>
            <div className="flex flex-wrap gap-2">
              {weakTopics.map((w) => (
                <span key={w.topic} className="text-xs font-mono bg-hazard/10 border border-hazard/40 text-hazard px-2.5 py-1 rounded">
                  {w.topic} ({w.correct}/{w.total})
                </span>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="text-left border-t border-steel-lighter pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-concrete mb-2">Recommendations</p>
            <ul className="text-sm text-chalk space-y-1 list-disc list-inside">
              {recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {!passed && weakTopics.length > 0 && (
          <button
            onClick={() => navigate(`/certification/assessment/${domainSlug}?mode=practice`)}
            className="flex-1 border border-amber text-amber font-bold uppercase text-sm px-5 py-3 rounded hover:bg-amber/10"
          >
            Practice Weak Areas
          </button>
        )}
        {(!passed || isPractice) && (
          <button
            onClick={() => navigate(`/certification/assessment/${domainSlug}`)}
            className="flex-1 bg-amber text-steel font-bold uppercase text-sm px-5 py-3 rounded"
          >
            {isPractice ? 'Take Real Assessment' : 'Retry Assessment'}
          </button>
        )}
        <Link
          to="/certification"
          className="flex-1 text-center border border-steel-lighter text-concrete font-bold uppercase text-sm px-5 py-3 rounded hover:border-amber hover:text-amber"
        >
          Back to Certification
        </Link>
      </div>
      {isPractice && (
        <p className="text-center text-[11px] text-concrete font-mono mt-4">
          Practice sessions don't count toward your {domain} certification status.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-display font-bold text-2xl text-chalk">{value}</p>
      <p className="font-mono text-[9px] uppercase tracking-widest text-concrete">{label}</p>
    </div>
  )
}

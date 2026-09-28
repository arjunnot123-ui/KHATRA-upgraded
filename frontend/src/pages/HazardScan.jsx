import { useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { analyzeHazardImage, saveHazardScan } from '../lib/api.js'
import { addLogEntry } from '../lib/store.js'
import { speak } from '../lib/speech.js'
import RiskGauge from '../components/RiskGauge.jsx'
import { useLanguage } from '../context/LanguageContext.jsx'
import { useAiAssistant } from '../context/AiAssistantContext.jsx'
import { PPE_ICONS } from '../lib/arMarkers.js'

const severityColor = { low: '#2E7D4F', medium: '#FFB020', high: '#D93025' }

export default function HazardScan() {
  const { t } = useLanguage()
  const { setAiHazard } = useAiAssistant()
  const fileInputRef = useRef(null)
  const imgRef = useRef(null)

  const [imageSrc, setImageSrc] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Interactive Verification State
  const [hazards, setHazards] = useState([])
  const [selectedHazardId, setSelectedHazardId] = useState(null)

  // Synchronize active hazard with AI Assistant Context
  useEffect(() => {
    if (selectedHazardId) {
      const active = hazards.find((h) => h.id === selectedHazardId)
      setAiHazard(active || null)
    } else {
      setAiHazard(null)
    }
  }, [selectedHazardId, hazards, setAiHazard])
  const [editingHazard, setEditingHazard] = useState(null)
  const [isAddingManual, setIsAddingManual] = useState(false)

  // Save to PostgreSQL State
  const [savingScan, setSavingScan] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [inspectionNotes, setInspectionNotes] = useState('')

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setResult(null)
    setHazards([])
    setSelectedHazardId(null)
    setSavedSuccess(false)
    setMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      setImageSrc(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }, [])

  const runScan = async () => {
    setLoading(true)
    setError(null)
    setSavedSuccess(false)
    try {
      const data = await analyzeHazardImage(imageBase64, mimeType)
      setResult(data)
      setHazards(data.hazards || [])
      addLogEntry({
        type: 'scan',
        riskScore: data.overallRisk?.score ?? data.riskScore ?? 0,
        hazardCount: data.hazards?.length || 0,
      })
      if (data.summary) speak(data.summary)
    } catch (e) {
      setError(e.message || 'Something went wrong analyzing the image.')
    } finally {
      setLoading(false)
    }
  }

  // ── Verification Actions: Confirm, Reject, Edit ──

  const handleConfirmHazard = (id) => {
    setHazards((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, status: 'confirmed', needsVerification: false }
          : h
      )
    )
  }

  const handleRejectHazard = (id) => {
    setHazards((prev) =>
      prev.map((h) =>
        h.id === id
          ? { ...h, status: 'rejected' }
          : h
      )
    )
  }

  const handleSaveEdit = (editedFields) => {
    setHazards((prev) =>
      prev.map((h) =>
        h.id === editingHazard.id
          ? { ...h, ...editedFields, status: 'confirmed', needsVerification: false }
          : h
      )
    )
    setEditingHazard(null)
  }

  const handleAddManualHazard = (newHazard) => {
    setHazards((prev) => [
      ...prev,
      {
        ...newHazard,
        id: `manual_${Date.now()}`,
        confidence: 1.0,
        status: 'confirmed',
        needsVerification: false,
      },
    ])
    setIsAddingManual(false)
  }

  // Calculate dynamic risk score based on active (non-rejected) hazards
  const activeHazards = hazards.filter((h) => h.status !== 'rejected')
  const currentRiskScore = activeHazards.reduce((acc, h) => {
    const w = h.severity === 'high' ? 35 : h.severity === 'medium' ? 20 : 10
    const conf = Number(h.confidence) || 0.75
    return acc + w * (conf > 1 ? conf / 100 : conf)
  }, 0)
  const displayScore = activeHazards.length === 0 ? 0 : Math.min(100, Math.round(currentRiskScore))

  // ── Save Inspection to PostgreSQL ──
  const handleSaveInspection = async () => {
    if (savingScan) return
    setSavingScan(true)
    try {
      await saveHazardScan({
        title: `Workplace Inspection — ${new Date().toLocaleDateString()}`,
        imagePreview: imageSrc?.slice(0, 500), // Preview token/snippet
        hazards,
        notes: inspectionNotes || `Verified ${activeHazards.length} hazards (${displayScore}/100 risk).`,
      })
      setSavedSuccess(true)
    } catch (e) {
      console.warn('Failed to save inspection:', e.message)
      setError('Could not save inspection to PostgreSQL. Verify backend connection.')
    } finally {
      setSavingScan(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-3">{t('scan_eyebrow')}</p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-2 text-chalk">{t('scan_title')}</h1>
      <p className="text-concrete mb-8 max-w-2xl leading-relaxed">
        Upload or capture a work area photo. The certified AI safety inspector analyzes visible evidence, marks tight bounding boxes, suggests corrective procedures, and supports human verification.
      </p>

      {/* Upload Box */}
      {!imageSrc && (
        <div className="border-2 border-dashed border-steel-lighter rounded-xl p-14 text-center bg-steel-light shadow-lg">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-amber text-steel font-display font-bold text-xl uppercase px-8 py-4 rounded-lg hover:bg-white transition-all shadow-md active:scale-95"
          >
            {t('scan_open')}
          </button>
          <p className="text-concrete text-xs mt-4 font-mono">{t('scan_hint')}</p>
        </div>
      )}

      {/* Main Analysis Screen */}
      {imageSrc && (
        <div className="grid lg:grid-cols-[1.3fr_1.1fr] gap-8">
          {/* Left Column: Image with Bounding Boxes & Toolbar */}
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-steel-lighter bg-steel-light shadow-2xl">
              <img ref={imgRef} src={imageSrc} alt="Captured work area" className="w-full block select-none" />

              {/* Render Bounding Boxes */}
              {activeHazards.map((h) => (
                <HazardBox
                  key={h.id}
                  hazard={h}
                  isSelected={selectedHazardId === h.id}
                  onSelect={() => setSelectedHazardId(h.id)}
                />
              ))}

              {/* Pre-scan Run Button Overlay */}
              {!result && (
                <div className="absolute bottom-3 left-3 right-3 flex gap-3 z-20">
                  <button
                    onClick={runScan}
                    disabled={loading}
                    className="flex-1 bg-amber text-steel font-display font-bold text-lg uppercase py-3 rounded-lg disabled:opacity-60 shadow-lg hover:bg-white transition-all"
                  >
                    {loading ? t('scan_analyzing') : t('scan_run')}
                  </button>
                  <button
                    onClick={() => {
                      setImageSrc(null)
                      setResult(null)
                      setHazards([])
                    }}
                    className="px-4 bg-steel/90 border border-concrete rounded-lg text-sm font-mono text-chalk hover:bg-steel"
                  >
                    {t('scan_retake')}
                  </button>
                </div>
              )}
            </div>

            {/* Post-Scan Helper Toolbar */}
            {result && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-steel-light border border-steel-lighter p-3 rounded-xl">
                <button
                  onClick={() => setIsAddingManual(true)}
                  className="px-3 py-1.5 rounded-lg border border-steel-lighter text-xs font-mono text-chalk hover:border-amber hover:text-amber transition-colors flex items-center gap-1.5"
                >
                  <span>+</span> Add Manual Hazard
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-concrete">
                    {activeHazards.length} Active Hazard(s)
                  </span>
                  <button
                    onClick={() => {
                      setImageSrc(null)
                      setResult(null)
                      setHazards([])
                    }}
                    className="text-xs font-mono text-concrete hover:text-chalk underline ml-2"
                  >
                    New Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Hazards List & Verification Details */}
          <div className="space-y-6">
            {error && (
              <div className="bg-hazard/10 border border-hazard rounded-xl p-4 text-sm">
                <p className="font-bold text-hazard mb-1">Notice</p>
                <p className="text-concrete">{error}</p>
              </div>
            )}

            {savedSuccess && (
              <div className="bg-safe/10 border border-safe rounded-xl p-4 text-sm animate-fadeIn">
                <p className="font-bold text-safe mb-1">✓ Inspection Saved</p>
                <p className="text-concrete">
                  Hazard inspection record has been stored in your permanent PostgreSQL database.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-6">
                {/* Risk Gauge Header */}
                <div className="bg-steel-light border border-steel-lighter p-5 rounded-xl shadow-lg">
                  <RiskGauge score={displayScore} />
                  <p className="text-xs text-concrete leading-relaxed border-t border-steel-lighter pt-3 mt-3">
                    {result.summary}
                  </p>
                </div>

                {/* Verification Status Legend */}
                <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/40 text-cyan-300">
                    🔍 AI Detected
                  </span>
                  <span className="px-2 py-0.5 rounded bg-safe/10 border border-safe/40 text-safe">
                    ✓ Human Confirmed
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber/10 border border-amber/40 text-amber">
                    ⚠️ Needs Verification
                  </span>
                </div>

                {/* Hazards List */}
                <div className="space-y-3">
                  {hazards.length === 0 && (
                    <p className="font-mono text-safe text-sm border border-safe/30 bg-safe/5 rounded-xl p-4">
                      {t('scan_no_hazards')}
                    </p>
                  )}

                  {hazards.map((h) => {
                    const isRejected = h.status === 'rejected'
                    const isConfirmed = h.status === 'confirmed'
                    const needsReview = h.needsVerification || h.status === 'needs_verification'
                    const isSel = selectedHazardId === h.id
                    const sevColor = severityColor[h.severity] || '#FFB020'

                    return (
                      <div
                        key={h.id}
                        onClick={() => setSelectedHazardId(h.id)}
                        className={`bg-steel-light border rounded-xl p-4 transition-all space-y-3 ${
                          isRejected
                            ? 'opacity-40 border-steel-lighter bg-steel/50'
                            : isSel
                            ? 'border-amber shadow-md'
                            : 'border-steel-lighter'
                        }`}
                        style={{ borderLeftWidth: 4, borderLeftColor: sevColor }}
                      >
                        {/* Title & Status Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-chalk uppercase">{h.label}</span>
                            <span
                              className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-bold"
                              style={{ color: sevColor, backgroundColor: `${sevColor}20` }}
                            >
                              {h.severity}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isRejected ? (
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-steel text-concrete line-through">
                                Rejected
                              </span>
                            ) : isConfirmed ? (
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-safe/20 text-safe border border-safe/40 font-bold">
                                ✓ Confirmed
                              </span>
                            ) : needsReview ? (
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-amber/20 text-amber border border-amber/40 animate-pulse font-bold">
                                ⚠️ Needs Verification
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                AI Detected ({Math.round((h.confidence > 1 ? h.confidence : h.confidence * 100)) || 80}%)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Visible Evidence Statement */}
                        <div className="bg-steel/80 p-2.5 rounded-lg border border-steel-lighter">
                          <span className="font-mono text-[10px] text-amber uppercase tracking-wider block font-bold">
                            Visible Physical Evidence:
                          </span>
                          <p className="text-xs text-chalk leading-relaxed mt-0.5">
                            {h.evidence || 'Visible hazard indicators present in captured frame.'}
                          </p>
                        </div>

                        {/* Description & Danger */}
                        <p className="text-xs text-concrete leading-relaxed">
                          {h.description}
                        </p>

                        {/* Recommended Corrective Action */}
                        <div>
                          <span className="font-mono text-[10px] text-concrete uppercase tracking-wider block">
                            Recommended Safe Action:
                          </span>
                          <p className="text-xs text-safe font-medium mt-0.5">
                            {h.recommendedAction}
                          </p>
                        </div>

                        {/* Required PPE */}
                        {h.ppe && h.ppe.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-mono text-concrete mr-1">Required PPE:</span>
                            {h.ppe.map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center gap-1 bg-steel border border-steel-lighter text-[10px] px-2 py-0.5 rounded font-mono text-chalk capitalize"
                              >
                                <span>{PPE_ICONS[item]?.icon || '🛡️'}</span>
                                <span>{item}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Related Training & Assessment Links */}
                        <div className="pt-2 border-t border-steel-lighter flex flex-wrap items-center justify-between gap-2 text-xs">
                          {h.relatedTraining && (
                            <Link
                              to={`/assessment/${h.relatedTraining.slug || 'machinery-loto'}`}
                              className="text-amber font-mono text-[11px] hover:underline flex items-center gap-1"
                            >
                              <span>📚 Training:</span>
                              <span>{h.relatedTraining.title} →</span>
                            </Link>
                          )}

                          {h.relatedAssessmentQuestion && (
                            <span className="text-concrete font-mono text-[10px] block truncate max-w-xs" title={h.relatedAssessmentQuestion.question}>
                              Target Q: {h.relatedAssessmentQuestion.topic}
                            </span>
                          )}
                        </div>

                        {/* Verification Action Buttons (Confirm / Reject / Edit) */}
                        <div className="flex gap-2 pt-2 border-t border-steel-lighter">
                          {!isConfirmed && !isRejected && (
                            <button
                              onClick={() => handleConfirmHazard(h.id)}
                              className="flex-1 py-1.5 rounded-lg bg-safe/10 border border-safe/40 text-safe hover:bg-safe hover:text-steel text-xs font-mono font-bold transition-all"
                            >
                              ✓ Confirm Hazard
                            </button>
                          )}
                          {!isRejected && (
                            <button
                              onClick={() => setEditingHazard(h)}
                              className="px-3 py-1.5 rounded-lg border border-steel-lighter text-xs font-mono text-chalk hover:border-amber transition-all"
                            >
                              ✎ Edit
                            </button>
                          )}
                          {!isRejected ? (
                            <button
                              onClick={() => handleRejectHazard(h.id)}
                              className="px-3 py-1.5 rounded-lg border border-hazard/40 text-hazard hover:bg-hazard hover:text-chalk text-xs font-mono transition-all"
                            >
                              ✕ Reject
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConfirmHazard(h.id)}
                              className="px-3 py-1.5 rounded-lg border border-steel-lighter text-xs font-mono text-concrete hover:text-chalk"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Save Inspection Card */}
                <div className="bg-steel-light border border-steel-lighter p-4 rounded-xl space-y-3">
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-concrete">
                    Inspector Observations / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={inspectionNotes}
                    onChange={(e) => setInspectionNotes(e.target.value)}
                    placeholder="e.g. Shift 1 pre-start inspection, maintenance alerted for cable replacement."
                    className="w-full bg-steel border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none"
                  />
                  <button
                    onClick={handleSaveInspection}
                    disabled={savingScan}
                    className="w-full bg-amber text-steel font-display font-bold text-base uppercase py-3 rounded-lg hover:bg-white transition-all disabled:opacity-50 shadow-md"
                  >
                    {savingScan ? 'Saving to Database...' : 'Save Inspection'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Hazard Modal */}
      {editingHazard && (
        <EditHazardModal
          hazard={editingHazard}
          onSave={handleSaveEdit}
          onCancel={() => setEditingHazard(null)}
        />
      )}

      {/* Add Manual Hazard Modal */}
      {isAddingManual && (
        <AddManualHazardModal
          onAdd={handleAddManualHazard}
          onCancel={() => setIsAddingManual(false)}
        />
      )}
    </div>
  )
}

// ── Bounding Box Component ──
function HazardBox({ hazard, isSelected, onSelect }) {
  const b = hazard.bbox || { x: 0.1, y: 0.1, width: 0.3, height: 0.3 }
  const x = Array.isArray(hazard.bbox) ? hazard.bbox[0] : (b.x ?? 0.1)
  const y = Array.isArray(hazard.bbox) ? hazard.bbox[1] : (b.y ?? 0.1)
  const w = Array.isArray(hazard.bbox) ? hazard.bbox[2] : (b.width ?? 0.25)
  const h = Array.isArray(hazard.bbox) ? hazard.bbox[3] : (b.height ?? 0.2)

  const color = severityColor[hazard.severity] || '#FFB020'
  const isConfirmed = hazard.status === 'confirmed'
  const needsReview = hazard.needsVerification || hazard.status === 'needs_verification'

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={`absolute border-2 rounded cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-white z-30' : 'z-10'
      }`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        borderColor: color,
        backgroundColor: isSelected ? `${color}22` : 'transparent',
      }}
    >
      <span
        className="absolute -top-6 left-0 font-mono text-[9px] uppercase px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-md flex items-center gap-1"
        style={{ backgroundColor: color, color: '#111518' }}
      >
        <span>{isConfirmed ? '✓' : needsReview ? '⚠️' : '🔍'}</span>
        <span>{hazard.label}</span>
      </span>
    </div>
  )
}

// ── Edit Hazard Modal ──
function EditHazardModal({ hazard, onSave, onCancel }) {
  const [label, setLabel] = useState(hazard.label || '')
  const [severity, setSeverity] = useState(hazard.severity || 'medium')
  const [evidence, setEvidence] = useState(hazard.evidence || '')
  const [recommendedAction, setRecommendedAction] = useState(hazard.recommendedAction || '')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-steel border border-steel-lighter rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
        <h3 className="font-display font-bold uppercase text-lg text-chalk">
          Edit Hazard Verification
        </h3>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Hazard Title</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Severity</label>
          <div className="flex gap-2">
            {['low', 'medium', 'high'].map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={`flex-1 font-mono text-xs uppercase py-1.5 rounded-lg border transition-all ${
                  severity === s ? 'font-bold' : 'border-steel-lighter text-concrete'
                }`}
                style={{
                  borderColor: severity === s ? severityColor[s] : undefined,
                  backgroundColor: severity === s ? `${severityColor[s]}25` : undefined,
                  color: severity === s ? severityColor[s] : undefined,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Visible Physical Evidence</label>
          <textarea
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Recommended Safe Action</label>
          <textarea
            rows={2}
            value={recommendedAction}
            onChange={(e) => setRecommendedAction(e.target.value)}
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-steel-lighter text-xs font-mono text-concrete hover:text-chalk"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ label, severity, evidence, recommendedAction })}
            className="flex-1 py-2 rounded-lg bg-amber text-steel font-mono text-xs uppercase font-bold hover:bg-white transition-colors"
          >
            Save & Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Manual Hazard Modal ──
function AddManualHazardModal({ onAdd, onCancel }) {
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('General')
  const [severity, setSeverity] = useState('medium')
  const [evidence, setEvidence] = useState('')
  const [recommendedAction, setRecommendedAction] = useState('')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-steel border border-steel-lighter rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
        <h3 className="font-display font-bold uppercase text-lg text-chalk">
          Add Manual Hazard Observation
        </h3>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Hazard Title</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Missing Ground Cable"
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-steel-light border border-steel-lighter rounded-lg px-2 py-2 text-xs text-chalk outline-none"
            >
              <option>Electrical</option>
              <option>Mechanical</option>
              <option>Fire</option>
              <option>Chemical</option>
              <option>PPE</option>
              <option>Housekeeping</option>
              <option>General</option>
            </select>
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-steel-light border border-steel-lighter rounded-lg px-2 py-2 text-xs text-chalk outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Visible Physical Evidence</label>
          <textarea
            rows={2}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Describe exactly what is visible in the work area..."
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none resize-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Recommended Safe Action</label>
          <textarea
            rows={2}
            value={recommendedAction}
            onChange={(e) => setRecommendedAction(e.target.value)}
            placeholder="e.g. Isolate circuit and install protective bonding..."
            className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-xs text-chalk focus:border-amber outline-none resize-none"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-steel-lighter text-xs font-mono text-concrete hover:text-chalk"
          >
            Cancel
          </button>
          <button
            disabled={!label.trim()}
            onClick={() =>
              onAdd({
                label,
                category,
                severity,
                evidence,
                description: `${label} manually marked by certified safety inspector.`,
                recommendedAction: recommendedAction || 'Follow standard site safety procedure.',
                ppe: ['helmet', 'boots'],
                bbox: { x: 0.35, y: 0.35, width: 0.25, height: 0.25 },
              })
            }
            className="flex-1 py-2 rounded-lg bg-amber text-steel font-mono text-xs uppercase font-bold hover:bg-white transition-colors disabled:opacity-50"
          >
            Add Hazard
          </button>
        </div>
      </div>
    </div>
  )
}

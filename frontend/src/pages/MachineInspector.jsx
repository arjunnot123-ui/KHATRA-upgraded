import { useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ARAnnotator from '../components/ARAnnotator.jsx'
import { analyzeMachineImage, generate3DPrompt, getInspectionHistory, getInspectionWeakAreas } from '../lib/api.js'
import Machine3DViewer from '../components/Machine3DViewer.jsx'
import TextTo3DStudio from '../components/TextTo3DStudio.jsx'
import { addLogEntry } from '../lib/store.js'
import {
  MARKER_TYPES,
  PPE_ICONS,
  SEVERITY_COLOR,
  newMarker,
  markersFromAiResult,
  getInspections,
  saveInspection,
  deleteInspection,
  uid,
} from '../lib/arMarkers.js'

const TOOLS = [
  { id: 'hazard', label: 'Hazard Zone', hint: 'Drag a box over the danger area' },
  { id: 'ppe', label: 'PPE Marker', hint: 'Click a spot to require protection' },
  { id: 'component', label: 'Component', hint: 'Click a spot to label a part' },
]

export default function MachineInspector() {
  const fileInputRef = useRef(null)

  // Top-level tab: '3d-lab' | '3d-studio' | 'photo-ai' | 'history'
  const [activeLabTab, setActiveLabTab] = useState('3d-lab')
  const [selectedCustomModel, setSelectedCustomModel] = useState(null)

  // 3D Lab History & Weak Areas from PostgreSQL
  const [dbInspections, setDbInspections] = useState([])
  const [dbWeakAreas, setDbWeakAreas] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Existing Photo Annotator state
  const [imageSrc, setImageSrc] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [mimeType, setMimeType] = useState('image/jpeg')
  const [markers, setMarkers] = useState([])
  const [activeTool, setActiveTool] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [pendingMarker, setPendingMarker] = useState(null)
  const [trainingMode, setTrainingMode] = useState(false)
  const [foundIds, setFoundIds] = useState(() => new Set())
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [inspectionId, setInspectionId] = useState(null)
  const [gallery, setGallery] = useState(() => getInspections())

  // Text-to-3D Prompt generator state
  const [promptDescription, setPromptDescription] = useState('')
  const [generated3DPrompt, setGenerated3DPrompt] = useState('')
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  const fetchInspectionData = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const [histRes, weakRes] = await Promise.all([
        getInspectionHistory().catch(() => ({ inspections: [] })),
        getInspectionWeakAreas().catch(() => ({ weakAreas: [] })),
      ])
      setDbInspections(histRes.inspections || [])
      setDbWeakAreas(weakRes.weakAreas || [])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchInspectionData()
  }, [fetchInspectionData])

  const handleFile = useCallback((file) => {
    if (!file) return
    setError(null)
    setSummary(null)
    setMarkers([])
    setSelectedId(null)
    setInspectionId(null)
    setFoundIds(new Set())
    setMimeType(file.type || 'image/jpeg')
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      setImageSrc(dataUrl)
      setImageBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }, [])

  const runAutoDetect = async () => {
    setScanning(true)
    setError(null)
    try {
      const data = await analyzeMachineImage(imageBase64, mimeType)
      const detected = markersFromAiResult(data)
      setMarkers((prev) => [...prev, ...detected])
      setSummary(data.summary || null)
      addLogEntry({ type: 'inspection', riskScore: data.riskScore || 0, markerCount: detected.length })
    } catch (e) {
      setError(e.message || 'Something went wrong analyzing the image.')
    } finally {
      setScanning(false)
    }
  }

  const handleGenerate3DPrompt = async () => {
    if (!promptDescription.trim() || generatingPrompt) return
    setGeneratingPrompt(true)
    try {
      const res = await generate3DPrompt(promptDescription.trim())
      setGenerated3DPrompt(res || '')
    } catch (e) {
      console.warn('3D prompt error:', e.message)
    } finally {
      setGeneratingPrompt(false)
    }
  }

  const handlePlace = (draft) => {
    setActiveTool(null)
    setPendingMarker(newMarker(draft.type, draft))
  }

  const confirmPendingMarker = (fields) => {
    setMarkers((prev) => [...prev, { ...pendingMarker, ...fields }])
    setPendingMarker(null)
  }

  const handleSelect = (id) => {
    setSelectedId(id)
    if (trainingMode && id) {
      setFoundIds((prev) => new Set(prev).add(id))
    }
  }

  const handleDelete = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
    setSelectedId(null)
  }

  const handleSave = () => {
    const id = inspectionId || uid()
    const record = { id, title: `Inspection ${new Date().toLocaleDateString()}`, imageSrc, markers, createdAt: Date.now() }
    saveInspection(record)
    setInspectionId(id)
    setGallery(getInspections())
  }

  const loadInspection = (record) => {
    setImageSrc(record.imageSrc)
    setImageBase64(record.imageSrc.split(',')[1])
    setMarkers(record.markers)
    setInspectionId(record.id)
    setSelectedId(null)
    setFoundIds(new Set())
    setSummary(null)
    setError(null)
  }

  const removeInspection = (id) => {
    setGallery(deleteInspection(id))
    if (inspectionId === id) setInspectionId(null)
  }

  const reset = () => {
    setImageSrc(null)
    setImageBase64(null)
    setMarkers([])
    setSelectedId(null)
    setActiveTool(null)
    setTrainingMode(false)
    setFoundIds(new Set())
    setSummary(null)
    setError(null)
    setInspectionId(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      {/* Top Title & Eyebrow */}
      <p className="font-mono text-amber text-xs tracking-[0.2em] uppercase mb-2">
        Industrial Machine Inspection · AR/3D Simulation
      </p>
      <h1 className="font-display font-bold text-4xl md:text-5xl uppercase mb-2 text-chalk">
        Machine Inspector & 3D Lab
      </h1>
      <p className="text-concrete mb-8 max-w-2xl leading-relaxed">
        Interactive 3D machinery simulations, pre-shift checklists, and AI photo hazard detection for mining and processing equipment.
      </p>

      {/* Main Top Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-steel-lighter pb-3">
        <button
          onClick={() => setActiveLabTab('3d-lab')}
          className={`font-mono text-xs uppercase px-4 py-2.5 rounded-lg border transition-all flex items-center gap-2 ${
            activeLabTab === '3d-lab'
              ? 'bg-amber text-steel border-amber font-bold shadow-md'
              : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
          }`}
        >
          <span>🏗️</span>
          <span>3D Training Lab & Checklist</span>
        </button>
        <button
          onClick={() => setActiveLabTab('3d-studio')}
          className={`font-mono text-xs uppercase px-4 py-2.5 rounded-lg border transition-all flex items-center gap-2 ${
            activeLabTab === '3d-studio'
              ? 'bg-amber text-steel border-amber font-bold shadow-md'
              : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
          }`}
        >
          <span>✨</span>
          <span>Text-to-3D Studio</span>
        </button>
        <button
          onClick={() => setActiveLabTab('photo-ai')}
          className={`font-mono text-xs uppercase px-4 py-2.5 rounded-lg border transition-all flex items-center gap-2 ${
            activeLabTab === 'photo-ai'
              ? 'bg-amber text-steel border-amber font-bold shadow-md'
              : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
          }`}
        >
          <span>📷</span>
          <span>AI Photo Inspector & Annotator</span>
        </button>
        <button
          onClick={() => {
            setActiveLabTab('history')
            fetchInspectionData()
          }}
          className={`font-mono text-xs uppercase px-4 py-2.5 rounded-lg border transition-all flex items-center gap-2 ${
            activeLabTab === 'history'
              ? 'bg-amber text-steel border-amber font-bold shadow-md'
              : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
          }`}
        >
          <span>📊</span>
          <span>Inspection Records ({dbInspections.length})</span>
        </button>
      </div>

      {/* ── TAB 1: 3D Machine Training Lab ── */}
      {activeLabTab === '3d-lab' && (
        <div className="space-y-8">
          <Machine3DViewer onInspectionSaved={fetchInspectionData} activeCustomModel={selectedCustomModel} />

          {/* Quick Text-to-3D Prompt generator & Link to Studio */}
          <div className="bg-steel-light border border-steel-lighter rounded-xl p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="font-display font-bold text-lg uppercase text-chalk">Quick Text-to-3D Prompt</h3>
              </div>
              <button
                onClick={() => setActiveLabTab('3d-studio')}
                className="text-xs font-mono font-bold text-amber hover:underline flex items-center gap-1"
              >
                <span>Open Full 3D Studio & GLB Generator</span>
                <span>→</span>
              </button>
            </div>
            <p className="text-xs text-concrete mb-4">
              Generate structured, high-precision prompts for text-to-3D tools (Meshy, Luma, Shap-E) using industrial safety specifications.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                placeholder="e.g. Underground continuous haulage conveyor with emergency stop and nip point guards"
                className="flex-1 bg-steel border border-steel-lighter rounded-lg px-3.5 py-2.5 text-xs text-chalk focus:border-amber outline-none"
              />
              <button
                onClick={handleGenerate3DPrompt}
                disabled={generatingPrompt || !promptDescription.trim()}
                className="bg-amber text-steel font-mono font-bold text-xs uppercase px-5 py-2.5 rounded-lg disabled:opacity-50 hover:bg-white transition-colors"
              >
                {generatingPrompt ? 'Generating…' : 'Generate 3D Prompt'}
              </button>
            </div>
            {generated3DPrompt && (
              <div className="mt-3 p-3 bg-steel rounded-lg border border-amber/30 text-xs font-mono text-amber leading-relaxed flex items-start justify-between gap-3">
                <div>
                  <span className="text-concrete text-[10px] uppercase block mb-1">Generated Prompt:</span>
                  "{generated3DPrompt}"
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generated3DPrompt)
                    alert('Copied prompt to clipboard!')
                  }}
                  className="bg-steel-light border border-amber/50 px-2 py-1 rounded text-[10px] text-chalk font-mono hover:bg-amber hover:text-steel transition-colors whitespace-nowrap"
                >
                  Copy Prompt
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Text-to-3D Studio & Model Pipeline ── */}
      {activeLabTab === '3d-studio' && (
        <TextTo3DStudio
          onUseInInspector={(modelRecord) => {
            setSelectedCustomModel(modelRecord)
            setActiveLabTab('3d-lab')
          }}
        />
      )}

      {/* ── TAB 2: AI Photo Inspector & Annotator (Preserved 100%) ── */}
      {activeLabTab === 'photo-ai' && (
        <div>
          {!imageSrc && (
            <div className="border-2 border-dashed border-steel-lighter rounded-xl p-14 text-center bg-steel-light">
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
                className="bg-amber text-steel font-display font-bold text-xl uppercase px-8 py-4 rounded-lg hover:bg-white transition-colors shadow-lg"
              >
                Upload Machine Photo
              </button>
              <p className="text-concrete text-xs mt-4 font-mono">
                Capture via mobile camera or upload JPG/PNG. Auto-Detect uses backend AI vision models to highlight hazards and PPE.
              </p>

              {gallery.length > 0 && (
                <div className="mt-10 text-left">
                  <p className="font-mono text-xs text-concrete uppercase tracking-widest mb-3">Saved Local Inspections</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {gallery.map((g) => (
                      <div key={g.id} className="relative rounded-lg overflow-hidden border border-steel-lighter group">
                        <img src={g.imageSrc} alt={g.title} className="w-full h-28 object-cover cursor-pointer" onClick={() => loadInspection(g)} />
                        <div className="absolute inset-x-0 bottom-0 bg-steel/90 px-2.5 py-1.5 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-concrete truncate">{g.markers.length} markers</span>
                          <button onClick={() => removeInspection(g.id)} className="text-hazard text-xs hover:underline">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {imageSrc && (
            <div className="grid md:grid-cols-[1.4fr_1fr] gap-8">
              <div>
                {!trainingMode && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                        title={tool.hint}
                        className="font-mono text-xs uppercase tracking-wide px-3 py-2 rounded-lg border flex items-center gap-2 transition-colors"
                        style={{
                          borderColor: MARKER_TYPES[tool.id].color,
                          backgroundColor: activeTool === tool.id ? MARKER_TYPES[tool.id].color : 'transparent',
                          color: activeTool === tool.id ? '#1C1F22' : MARKER_TYPES[tool.id].color,
                        }}
                      >
                        {tool.label}
                      </button>
                    ))}
                    <button
                      onClick={runAutoDetect}
                      disabled={scanning}
                      className="font-mono text-xs uppercase tracking-wide px-3 py-2 rounded-lg bg-amber text-steel font-bold disabled:opacity-60"
                    >
                      {scanning ? 'Scanning…' : 'Auto-Detect (AI)'}
                    </button>
                  </div>
                )}

                <ARAnnotator
                  imageSrc={imageSrc}
                  markers={markers}
                  mode={trainingMode ? 'view' : 'edit'}
                  activeTool={activeTool}
                  selectedId={selectedId}
                  onSelect={handleSelect}
                  onPlace={handlePlace}
                  onRequestDelete={trainingMode ? null : handleDelete}
                  foundMarkerIds={foundIds}
                />

                {trainingMode && (
                  <div className="mt-3 p-3 bg-steel-light border border-steel-lighter rounded-lg flex items-center justify-between text-xs font-mono">
                    <span className="text-concrete">Found {foundIds.size} of {markers.length} hazards</span>
                    {foundIds.size === markers.length && markers.length > 0 && (
                      <span className="text-safe font-bold">✓ All hazards identified!</span>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar with inspection controls */}
              <div className="space-y-4">
                <div className="bg-steel-light border border-steel-lighter rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg uppercase text-chalk">Inspection Tools</h3>
                    <button onClick={reset} className="text-xs font-mono text-concrete hover:text-hazard underline">
                      Close Photo
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrainingMode((m) => !m)}
                      className={`flex-1 py-2 rounded-lg border font-mono text-xs uppercase font-bold transition-all ${
                        trainingMode ? 'bg-amber text-steel border-amber' : 'border-steel-lighter text-concrete hover:text-chalk'
                      }`}
                    >
                      {trainingMode ? 'Exit Practice' : 'Start Find-the-Hazard Mode'}
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-steel border border-steel-lighter hover:border-amber rounded-lg font-mono text-xs uppercase text-chalk"
                    >
                      Save
                    </button>
                  </div>

                  {summary && (
                    <div className="p-3 bg-steel rounded-lg border border-steel-lighter text-xs text-concrete leading-relaxed">
                      <strong className="text-chalk block mb-1 font-mono uppercase text-[10px]">AI Assessment:</strong>
                      {summary}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-hazard/10 border border-hazard rounded-lg text-xs text-hazard">
                      {error}
                    </div>
                  )}

                  {/* Marker List */}
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-concrete block mb-2">
                      Markers on Photo ({markers.length})
                    </span>
                    {markers.length === 0 ? (
                      <p className="text-xs text-concrete font-mono">No markers yet. Tap a tool to place one or hit Auto-Detect.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {markers.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => setSelectedId(m.id)}
                            className={`p-2 rounded border text-xs cursor-pointer flex items-center justify-between ${
                              selectedId === m.id ? 'border-amber bg-amber/10 text-chalk font-bold' : 'border-steel-lighter text-concrete hover:text-chalk'
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded ml-2" style={{ color: MARKER_TYPES[m.type].color }}>
                              {m.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {pendingMarker && (
            <MarkerForm
              marker={pendingMarker}
              onConfirm={confirmPendingMarker}
              onCancel={() => setPendingMarker(null)}
            />
          )}
        </div>
      )}

      {/* ── TAB 3: Machine Inspection Records from PostgreSQL ── */}
      {activeLabTab === 'history' && (
        <div className="space-y-6">
          {/* Weak Areas Recommendation Banner */}
          {dbWeakAreas.length > 0 && (
            <div className="bg-amber/10 border border-amber/40 rounded-xl p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚠️</span>
                <h3 className="font-display font-bold text-lg uppercase text-amber">
                  Inspection Areas Requiring Improvement
                </h3>
              </div>
              <p className="text-xs text-chalk leading-relaxed mb-4">
                Your past machine inspections revealed safety gaps in the following competencies. Practice these specific domains in the Adaptive Assessment Engine to achieve certification eligibility.
              </p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {dbWeakAreas.slice(0, 6).map((w, i) => (
                  <div key={i} className="bg-steel p-3 rounded-lg border border-steel-lighter flex flex-col justify-between">
                    <div>
                      <span className="font-mono text-[10px] text-concrete uppercase block truncate">
                        {w.machineName}
                      </span>
                      <p className="text-xs font-bold text-chalk mt-0.5">{w.label || w.hazard || 'Inspection checkpoint'}</p>
                    </div>
                    <Link
                      to={`/assessment/${w.domainSlug || 'machinery-loto'}`}
                      className="mt-3 inline-block font-mono text-[11px] text-amber hover:underline font-bold"
                    >
                      Practice in Assessment →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inspection Records Table */}
          <div className="bg-steel-light border border-steel-lighter rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-steel-lighter flex items-center justify-between">
              <h3 className="font-display font-bold text-lg uppercase text-chalk">
                PostgreSQL Machine Inspection Log
              </h3>
              <button
                onClick={fetchInspectionData}
                disabled={loadingHistory}
                className="text-xs font-mono text-amber hover:underline disabled:opacity-50"
              >
                {loadingHistory ? 'Refreshing…' : '↻ Refresh Log'}
              </button>
            </div>

            {dbInspections.length === 0 ? (
              <div className="p-10 text-center text-concrete font-mono text-xs">
                No 3D machine inspections recorded in the database yet. Launch the 3D Training Lab to perform your first pre-shift inspection.
              </div>
            ) : (
              <div className="divide-y divide-steel-lighter">
                {dbInspections.map((insp) => (
                  <div key={insp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-steel/50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-chalk">{insp.machine_name}</span>
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 bg-steel rounded text-concrete border border-steel-lighter">
                          {insp.mode}
                        </span>
                      </div>
                      <p className="text-xs text-concrete mt-1 font-mono">
                        {new Date(insp.completed_at).toLocaleString()} · {insp.notes || 'Inspection completed'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 sm:text-right">
                      <div>
                        <span className={`text-base font-display font-bold ${insp.passed ? 'text-safe' : 'text-hazard'}`}>
                          {insp.score}%
                        </span>
                        <span className="block text-[10px] font-mono text-concrete uppercase">
                          {insp.passed ? 'Passed' : 'Defects Found'}
                        </span>
                      </div>
                      {insp.recommended_domain && (
                        <Link
                          to="/assessment"
                          className="font-mono text-xs bg-amber/10 border border-amber/40 text-amber px-3 py-1.5 rounded hover:bg-amber hover:text-steel font-bold transition-all shrink-0"
                        >
                          Review Domain
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MarkerForm({ marker, onConfirm, onCancel }) {
  const [label, setLabel] = useState(marker.label || '')
  const [description, setDescription] = useState(marker.description || '')
  const [severity, setSeverity] = useState(marker.severity || 'medium')
  const [icons, setIcons] = useState(marker.ppeIcons || [])

  const toggleIcon = (id) => {
    setIcons((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const color = MARKER_TYPES[marker.type].color

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-steel border border-steel-lighter rounded-xl max-w-sm w-full p-5 shadow-2xl animate-fadeIn">
        <h3 className="font-display font-bold uppercase text-lg mb-1" style={{ color }}>
          New {MARKER_TYPES[marker.type].label}
        </h3>
        <p className="text-xs text-concrete mb-4">Add details for this machine marker</p>

        <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={marker.type === 'hazard' ? 'e.g. Exposed live wire' : marker.type === 'ppe' ? 'e.g. Hearing protection zone' : 'e.g. Emergency stop button'}
          className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-amber text-chalk"
        />

        <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full bg-steel-light border border-steel-lighter rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-amber resize-none text-chalk"
        />

        {marker.type === 'hazard' && (
          <>
            <label className="block font-mono text-[10px] uppercase text-concrete mb-1">Severity</label>
            <div className="flex gap-2 mb-3">
              {['low', 'medium', 'high'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className="flex-1 font-mono text-xs uppercase py-1.5 rounded border transition-all"
                  style={{
                    borderColor: SEVERITY_COLOR[s],
                    backgroundColor: severity === s ? SEVERITY_COLOR[s] : 'transparent',
                    color: severity === s ? '#1C1F22' : SEVERITY_COLOR[s],
                    fontWeight: severity === s ? 'bold' : 'normal',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {(marker.type === 'ppe' || marker.type === 'hazard') && (
          <>
            <label className="block font-mono text-[10px] uppercase text-concrete mb-1">
              {marker.type === 'ppe' ? 'PPE Icon' : 'Recommended PPE (optional)'}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {PPE_ICONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleIcon(p.id)}
                  title={p.label}
                  className="w-9 h-9 rounded border flex items-center justify-center text-lg transition-all"
                  style={{
                    borderColor: icons.includes(p.id) ? color : '#3A3F45',
                    backgroundColor: icons.includes(p.id) ? `${color}33` : 'transparent',
                  }}
                >
                  {p.emoji}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 border border-concrete rounded-lg py-2 font-mono text-xs uppercase text-concrete hover:text-chalk">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ label: label || MARKER_TYPES[marker.type].label, description, severity, ppeIcons: icons })}
            className="flex-1 rounded-lg py-2 font-mono text-xs uppercase font-bold transition-all shadow-md"
            style={{ backgroundColor: color, color: '#1C1F22' }}
          >
            Add marker
          </button>
        </div>
      </div>
    </div>
  )
}

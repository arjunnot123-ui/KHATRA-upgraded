import { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import {
  get3DProviderStatus,
  build3DStudioPrompt,
  start3DModelGeneration,
  query3DModelStatus,
  uploadCustom3DModel,
  getCustom3DModels,
  deleteCustom3DModel,
} from '../lib/api.js'

const OBJECT_PRESETS = [
  'underground mining conveyor',
  'hydraulic drill rig',
  'primary jaw crusher',
  'heavy crawler excavator',
  'ventilation exhaust fan',
  'confined space gas scrubber',
]

const STYLE_PRESETS = [
  'rugged industrial',
  'photorealistic modern',
  'heavy-duty mining',
  'high-contrast training',
  'stylized low-poly',
]

const MATERIAL_PRESETS = [
  'reinforced steel and durable rubber',
  'machined alloy and high-pressure hydraulic hoses',
  'hardened manganese plate and structural iron',
  'corrosion-resistant coated steel and brass valves',
]

const SHAPE_PRESETS = [
  'modular heavy-duty rectangular form',
  'articulated track-mounted chassis with vertical mast',
  'heavy pyramidal hopper with dual cylindrical flywheels',
  '360-degree rotating turret with articulated boom',
]

const USE_CASE_PRESETS = [
  'interactive worker safety training and AR machine inspection',
  'hazard hotspot identification and pre-shift checklist practice',
  'preventative maintenance and lockout/tagout simulation',
]

function ModelPreviewViewer({ url }) {
  const { scene } = useGLTF(url)
  return <primitive object={scene} scale={1.8} position={[0, -0.5, 0]} />
}

export default function TextTo3DStudio({ onUseInInspector }) {
  // Inputs
  const [object, setObject] = useState(OBJECT_PRESETS[0])
  const [style, setStyle] = useState(STYLE_PRESETS[0])
  const [material, setMaterial] = useState(MATERIAL_PRESETS[0])
  const [shape, setShape] = useState(SHAPE_PRESETS[0])
  const [useCase, setUseCase] = useState(USE_CASE_PRESETS[0])

  // Editable prompt
  const [prompt, setPrompt] = useState(
    `Create a ${OBJECT_PRESETS[0]} in a ${STYLE_PRESETS[0]} style, made from ${MATERIAL_PRESETS[0]}, with a ${SHAPE_PRESETS[0]}, designed for ${USE_CASE_PRESETS[0]}.`
  )
  const [copied, setCopied] = useState(false)

  // Provider info
  const [providerInfo, setProviderInfo] = useState({ provider: 'local', configured: false, availableProviders: ['local'] })
  const [generatingPrompt, setGeneratingPrompt] = useState(false)

  // Generation status
  const [generationTaskId, setGenerationTaskId] = useState(null)
  const [generatingModel, setGeneratingModel] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationNotice, setGenerationNotice] = useState('')
  const [generationError, setGenerationError] = useState('')

  // Preview & Model Library
  const [activePreviewUrl, setActivePreviewUrl] = useState(null)
  const [customModels, setCustomModels] = useState([])
  const [loadingModels, setLoadingModels] = useState(false)

  // Upload model state
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Load provider info and custom models on mount
  useEffect(() => {
    get3DProviderStatus()
      .then((info) => setProviderInfo(info))
      .catch(() => {})

    fetchModels()
  }, [])

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const res = await getCustom3DModels()
      setCustomModels(res.models || [])
    } catch {
      // ignore
    } finally {
      setLoadingModels(false)
    }
  }

  // Update prompt whenever dropdown inputs change
  const handleDropdownChange = (setter, val, fieldName) => {
    setter(val)
    const newObj = fieldName === 'object' ? val : object
    const newSty = fieldName === 'style' ? val : style
    const newMat = fieldName === 'material' ? val : material
    const newShp = fieldName === 'shape' ? val : shape
    const newUsc = fieldName === 'useCase' ? val : useCase

    setPrompt(
      `Create a ${newObj} in a ${newSty} style, made from ${newMat}, with a ${newShp}, designed for ${newUsc}.`
    )
  }

  // Generate Prompt using AI enhancement or formula
  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true)
    setGenerationError('')
    try {
      const res = await build3DStudioPrompt({ object, style, material, shape, useCase })
      if (res.prompt) setPrompt(res.prompt)
    } catch (e) {
      // Fallback local formula
      setPrompt(
        `Create a ${object} in a ${style} style, made from ${material}, with a ${shape}, designed for ${useCase}.`
      )
    } finally {
      setGeneratingPrompt(false)
    }
  }

  // Copy to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Start generation (Meshy / Luma / Local)
  const handleStartGeneration = async () => {
    setGeneratingModel(true)
    setGenerationError('')
    setGenerationNotice('')
    setGenerationProgress(10)

    try {
      const res = await start3DModelGeneration({ prompt, provider: providerInfo.provider })
      if (!res.success) {
        setGenerationNotice(res.message || 'No external Text-to-3D provider configured.')
        setGeneratingModel(false)
        return
      }

      setGenerationTaskId(res.taskId)
      pollStatus(res.taskId, res.provider)
    } catch (e) {
      setGenerationError(e.message || 'Generation request failed.')
      setGeneratingModel(false)
    }
  }

  // Poll status for Meshy / Luma
  const pollStatus = async (taskId, provider) => {
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      try {
        const res = await query3DModelStatus(taskId, provider)
        setGenerationProgress(res.progress || attempts * 10)

        if (res.status === 'SUCCEEDED' || res.status === 'completed') {
          clearInterval(interval)
          setGeneratingModel(false)
          if (res.modelUrl) {
            setActivePreviewUrl(res.modelUrl)
            fetchModels()
          }
        } else if (res.status === 'FAILED' || res.status === 'failed') {
          clearInterval(interval)
          setGeneratingModel(false)
          setGenerationError('Text-to-3D generation failed on provider.')
        } else if (attempts > 30) {
          clearInterval(interval)
          setGeneratingModel(false)
          setGenerationError('Generation timed out.')
        }
      } catch {
        clearInterval(interval)
        setGeneratingModel(false)
      }
    }, 4000)
  }

  // Upload custom GLB/GLTF model
  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)

    // Check extension
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (ext !== '.glb' && ext !== '.gltf') {
      setUploadError('Only .glb and .gltf 3D model files are accepted.')
      setUploading(false)
      return
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds 25 MB limit for mobile optimization.')
      setUploading(false)
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = reader.result
        const res = await uploadCustom3DModel({
          machineId: object.includes('conveyor') ? 'conveyor' : object.includes('drill') ? 'drill-rig' : object.includes('crusher') ? 'crusher' : 'excavator',
          name: file.name.replace(/\.[^/.]+$/, ''),
          prompt,
          fileBase64: base64,
          filename: file.name,
        })
        if (res.model) {
          setActivePreviewUrl(res.model.model_url)
          fetchModels()
        }
      } catch (err) {
        setUploadError(err.message || 'Failed to upload model.')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteModel = async (id) => {
    try {
      await deleteCustom3DModel(id)
      fetchModels()
      if (activePreviewUrl) setActivePreviewUrl(null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-steel-light border border-steel-lighter rounded-xl p-6 shadow-xl space-y-6 animate-fadeIn">
      {/* ── Studio Header & Provider Status ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-steel-lighter pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-amber uppercase tracking-widest">
              Industrial Model Creation
            </span>
            <span
              className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded font-bold ${
                providerInfo.configured ? 'bg-safe/20 text-safe border border-safe/40' : 'bg-steel text-concrete border border-steel-lighter'
              }`}
            >
              {providerInfo.configured ? `Provider: ${providerInfo.provider}` : 'Provider: Local Studio'}
            </span>
          </div>
          <h2 className="font-display font-bold text-2xl uppercase tracking-tight text-chalk">
            Text-to-3D Prompt & Model Studio
          </h2>
        </div>

        <div className="text-right">
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,.gltf"
            className="hidden"
            onChange={handleUploadFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="font-mono text-xs px-3.5 py-2 rounded-lg border border-steel-lighter bg-steel hover:border-amber text-chalk transition-all"
          >
            {uploading ? 'Validating & Uploading…' : '📁 Upload .GLB / .GLTF'}
          </button>
        </div>
      </div>

      {/* ── 1. Structured Inputs (Object, Style, Material, Shape/Form, Use Case) ── */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wider text-concrete mb-3">
          1. Build Structured Industrial Prompt Elements
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* OBJECT */}
          <div className="bg-steel p-3 rounded-lg border border-steel-lighter">
            <label className="block font-mono text-[10px] uppercase text-amber font-bold mb-1">
              [OBJECT]
            </label>
            <select
              value={object}
              onChange={(e) => handleDropdownChange(setObject, e.target.value, 'object')}
              className="w-full bg-steel-light border border-steel-lighter rounded px-2.5 py-1.5 text-xs text-chalk outline-none"
            >
              {OBJECT_PRESETS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          {/* STYLE */}
          <div className="bg-steel p-3 rounded-lg border border-steel-lighter">
            <label className="block font-mono text-[10px] uppercase text-amber font-bold mb-1">
              [STYLE]
            </label>
            <select
              value={style}
              onChange={(e) => handleDropdownChange(setStyle, e.target.value, 'style')}
              className="w-full bg-steel-light border border-steel-lighter rounded px-2.5 py-1.5 text-xs text-chalk outline-none"
            >
              {STYLE_PRESETS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* MATERIAL */}
          <div className="bg-steel p-3 rounded-lg border border-steel-lighter">
            <label className="block font-mono text-[10px] uppercase text-amber font-bold mb-1">
              [MATERIAL]
            </label>
            <select
              value={material}
              onChange={(e) => handleDropdownChange(setMaterial, e.target.value, 'material')}
              className="w-full bg-steel-light border border-steel-lighter rounded px-2.5 py-1.5 text-xs text-chalk outline-none"
            >
              {MATERIAL_PRESETS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* SHAPE / FORM */}
          <div className="bg-steel p-3 rounded-lg border border-steel-lighter">
            <label className="block font-mono text-[10px] uppercase text-amber font-bold mb-1">
              [SHAPE/FORM]
            </label>
            <select
              value={shape}
              onChange={(e) => handleDropdownChange(setShape, e.target.value, 'shape')}
              className="w-full bg-steel-light border border-steel-lighter rounded px-2.5 py-1.5 text-xs text-chalk outline-none"
            >
              {SHAPE_PRESETS.map((sh) => (
                <option key={sh} value={sh}>{sh}</option>
              ))}
            </select>
          </div>

          {/* USE CASE */}
          <div className="bg-steel p-3 rounded-lg border border-steel-lighter sm:col-span-2">
            <label className="block font-mono text-[10px] uppercase text-amber font-bold mb-1">
              [USE CASE]
            </label>
            <select
              value={useCase}
              onChange={(e) => handleDropdownChange(setUseCase, e.target.value, 'useCase')}
              className="w-full bg-steel-light border border-steel-lighter rounded px-2.5 py-1.5 text-xs text-chalk outline-none"
            >
              {USE_CASE_PRESETS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── 2, 3, 4. Generated Prompt & Editable Textarea ── */}
      <div className="bg-steel p-4 rounded-xl border border-steel-lighter space-y-3">
        <div className="flex items-center justify-between">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-concrete font-bold">
            2. Generated Production 3D Prompt (Editable)
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleGeneratePrompt}
              disabled={generatingPrompt}
              className="text-xs font-mono text-amber hover:underline flex items-center gap-1"
            >
              {generatingPrompt ? 'Enhancing…' : '✨ AI Enhance'}
            </button>
            <button
              onClick={handleCopy}
              className="text-xs font-mono text-concrete hover:text-chalk px-2.5 py-1 rounded bg-steel-light border border-steel-lighter flex items-center gap-1"
            >
              {copied ? '✓ Copied!' : '📋 Copy Prompt'}
            </button>
          </div>
        </div>

        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full bg-steel-light border border-amber/40 rounded-lg p-3 text-xs text-chalk font-mono leading-relaxed focus:border-amber outline-none resize-none"
        />

        {/* Action button row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-[11px] font-mono text-concrete">
            Template: <code className="text-chalk">"Create a [OBJECT] in a [STYLE] style, made from [MATERIAL], with a [SHAPE/FORM], designed for [USE CASE]."</code>
          </div>

          <button
            onClick={handleStartGeneration}
            disabled={generatingModel}
            className="bg-amber text-steel font-display font-bold text-xs uppercase px-5 py-2.5 rounded-lg hover:bg-white transition-all shadow-md disabled:opacity-50"
          >
            {generatingModel ? `Generating (${generationProgress}%)…` : 'Generate 3D Model'}
          </button>
        </div>

        {/* Honest Notice if no external provider is configured (Rule 14) */}
        {generationNotice && (
          <div className="p-3 bg-steel-light border border-cyan-400/40 rounded-lg text-xs text-cyan-200 font-mono leading-relaxed animate-fadeIn">
            <p className="font-bold text-chalk mb-1">ℹ️ Studio Notice: Prompt Ready</p>
            <p>{generationNotice}</p>
            <p className="mt-1 text-concrete">
              You can paste this prompt into <strong>Meshy.ai</strong>, <strong>Luma Dream Machine</strong>, <strong>Tripo3D</strong>, or <strong>Spline</strong>, download the resulting <code>.glb</code>, and upload it directly with the button above!
            </p>
          </div>
        )}

        {generationError && (
          <div className="p-3 bg-hazard/10 border border-hazard rounded-lg text-xs text-hazard font-mono">
            {generationError}
          </div>
        )}

        {uploadError && (
          <div className="p-3 bg-hazard/10 border border-hazard rounded-lg text-xs text-hazard font-mono">
            {uploadError}
          </div>
        )}
      </div>

      {/* ── 11. Interactive Model Preview (when active) ── */}
      {activePreviewUrl && (
        <div className="bg-[#0b0e10] border border-amber/50 rounded-xl overflow-hidden shadow-2xl space-y-3">
          <div className="p-3 bg-steel border-b border-steel-lighter flex items-center justify-between">
            <span className="font-display font-bold text-sm uppercase text-amber">
              3D Model Interactive Preview
            </span>
            <button
              onClick={() => setActivePreviewUrl(null)}
              className="text-xs font-mono text-concrete hover:text-chalk"
            >
              ✕ Close Preview
            </button>
          </div>

          <div className="h-64 relative">
            <Canvas camera={{ position: [3.5, 2.5, 4.5], fov: 45 }}>
              <ambientLight intensity={1.5} />
              <directionalLight position={[5, 6, 5]} intensity={2.0} />
              <directionalLight position={[-4, 3, -3]} intensity={0.8} />
              <gridHelper args={[8, 16, '#555', '#222']} position={[0, -0.6, 0]} />
              <Suspense fallback={null}>
                <ModelPreviewViewer url={activePreviewUrl} />
              </Suspense>
              <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
            </Canvas>
          </div>
        </div>
      )}

      {/* ── 10. Saved Models Library in PostgreSQL ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-concrete">
            Registered 3D Models Library ({customModels.length})
          </p>
          <button
            onClick={fetchModels}
            disabled={loadingModels}
            className="text-xs font-mono text-amber hover:underline disabled:opacity-50"
          >
            {loadingModels ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>

        {customModels.length === 0 ? (
          <div className="p-8 text-center text-concrete font-mono text-xs border border-steel-lighter rounded-xl bg-steel">
            No custom 3D models registered yet. Build a prompt and generate via Meshy/Luma, or upload a .glb model.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {customModels.map((m) => (
              <div
                key={m.id}
                className="bg-steel p-4 rounded-xl border border-steel-lighter flex flex-col justify-between space-y-3 hover:border-amber/60 transition-colors shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-chalk truncate">{m.name}</span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-steel-light text-concrete border border-steel-lighter">
                      {m.provider}
                    </span>
                  </div>
                  <p className="text-[11px] text-concrete font-mono line-clamp-2 mt-1">
                    "{m.prompt}"
                  </p>
                  <span className="text-[10px] text-concrete font-mono block mt-2">
                    {new Date(m.created_at).toLocaleDateString()} · {(Number(m.file_size_bytes || 0) / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-steel-lighter">
                  <button
                    onClick={() => setActivePreviewUrl(m.model_url)}
                    className="flex-1 py-1.5 rounded bg-steel-light border border-steel-lighter text-xs font-mono text-chalk hover:border-amber transition-colors"
                  >
                    Preview
                  </button>
                  {onUseInInspector && (
                    <button
                      onClick={() => onUseInInspector(m)}
                      className="flex-1 py-1.5 rounded bg-amber text-steel font-bold text-xs font-mono hover:bg-white transition-colors"
                    >
                      Use in Lab
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteModel(m.id)}
                    title="Delete model"
                    className="px-2 py-1.5 rounded text-xs text-hazard hover:bg-hazard/20"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

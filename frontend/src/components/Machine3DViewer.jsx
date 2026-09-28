import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { MACHINE_MODELS, MACHINE_MODEL_LIST, SEVERITY_COLORS, createCustomMachineModel } from '../lib/machineModels.js'
import { PPE_ICONS } from '../lib/arMarkers.js'
import { saveInspectionResult } from '../lib/api.js'
import { Link } from 'react-router-dom'

// ── Model Error Boundary for Safe GLTF Fallback ──────────────────────────────
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err) {
    // Expected when .glb file is not yet deployed in public/models
    console.warn('[Machine3DViewer] GLTF model unavailable, utilizing procedural fallback:', err?.message || err)
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null
    }
    return this.props.children
  }
}

// ── Hotspot Tag Label ────────────────────────────────────────────────────────
function HotspotLabel({ children, color = '#FFB020', visible = true }) {
  if (!visible) return null
  return (
    <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
      <span
        style={{
          background: color,
          color: '#111518',
          padding: '3px 6px',
          borderRadius: 4,
          fontFamily: 'monospace',
          fontSize: 9,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        {children}
      </span>
    </Html>
  )
}

// ── Hotspot Sphere ───────────────────────────────────────────────────────────
function Hotspot({ item, selected, onSelect, showLabels }) {
  const color = SEVERITY_COLORS[item.severity] || (item.kind === 'hazard' ? '#D93025' : '#5EC8E0')
  const isSel = selected?.id === item.id

  return (
    <group position={item.position}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect(item)
        }}
        cursor="pointer"
      >
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial
          color={isSel ? '#FFFFFF' : color}
          emissive={isSel ? '#FFB020' : color}
          emissiveIntensity={isSel ? 0.9 : 0.45}
          roughness={0.2}
          metalness={0.5}
        />
      </mesh>
      {/* Outer pulsing ring / halo */}
      <mesh scale={isSel ? 1.6 : 1.3}>
        <ringGeometry args={[0.14, 0.17, 24]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={isSel ? 0.9 : 0.4} />
      </mesh>
      <HotspotLabel color={isSel ? '#FFB020' : color} visible={showLabels}>
        {item.label}
      </HotspotLabel>
    </group>
  )
}

// ── Procedural Fallback 3D Models ───────────────────────────────────────────

function ProceduralConveyor() {
  return (
    <group>
      {/* Base frame structure */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[4.0, 0.25, 1.6]} />
        <meshStandardMaterial color="#2E3940" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Rubber Conveyor Belt Top Run */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[3.8, 0.14, 1.25]} />
        <meshStandardMaterial color="#16181A" roughness={0.9} metalness={0.1} />
      </mesh>
      {/* Carrying idler rollers */}
      {[-1.5, -0.75, 0, 0.75, 1.5].map((x) => (
        <mesh key={x} position={[x, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 1.3, 24]} />
          <meshStandardMaterial color="#B0BEC5" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Drive Drum / Pulley */}
      <mesh position={[-1.6, 0.74, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 1.35, 28]} />
        <meshStandardMaterial color="#455A64" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Drive Motor & Reduction Gearbox */}
      <mesh position={[-1.6, 0.74, 1.0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.7, 24]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#1E88E5" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-1.6, 0.74, 0.6]}>
        <boxGeometry args={[0.5, 0.6, 0.4]} />
        <meshStandardMaterial color="#37474F" metalness={0.7} roughness={0.5} />
      </mesh>
      {/* Safety Mesh Guard over V-Belt / Drive */}
      <mesh position={[-0.2, 0.98, 0.75]}>
        <boxGeometry args={[3.0, 0.6, 0.08]} />
        <meshStandardMaterial color="#FFB020" transparent opacity={0.5} wireframe={false} />
      </mesh>
      {/* Emergency Trip-Wire Pull Switch Post */}
      <mesh position={[1.35, 0.8, 0.5]}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
        <meshStandardMaterial color="#D93025" />
      </mesh>
      {/* Structural Support Legs */}
      {[-1.6, 1.6].map((x) => (
        <group key={x}>
          <mesh position={[x, -0.55, 0.6]}>
            <boxGeometry args={[0.12, 1.2, 0.12]} />
            <meshStandardMaterial color="#78909C" />
          </mesh>
          <mesh position={[x, -0.55, -0.6]}>
            <boxGeometry args={[0.12, 1.2, 0.12]} />
            <meshStandardMaterial color="#78909C" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ProceduralDrillRig() {
  return (
    <group>
      {/* Track crawler chassis */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.4, 0.45, 1.8]} />
        <meshStandardMaterial color="#37474F" metalness={0.6} />
      </mesh>
      {/* Crawler tracks */}
      {[-1.2, 1.2].map((x) => (
        <mesh key={x} position={[x, -0.32, 0]}>
          <boxGeometry args={[0.6, 0.38, 2.1]} />
          <meshStandardMaterial color="#1B1F22" roughness={0.8} />
        </mesh>
      ))}
      {/* Rotating Drill Mast */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[0.4, 2.8, 0.5]} />
        <meshStandardMaterial color="#546E7A" metalness={0.7} />
      </mesh>
      {/* Rotary Drill Head (sliding along mast) */}
      <mesh position={[0, 0.7, 0.75]}>
        <boxGeometry args={[0.6, 0.65, 0.7]} />
        <meshStandardMaterial color="#FFB020" metalness={0.7} />
      </mesh>
      {/* Drill Steel Rod */}
      <mesh position={[0, -0.2, 1.2]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 1.6, 16]} />
        <meshStandardMaterial color="#ECEFF1" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Hydraulic Hose Bundles */}
      <mesh position={[-1.0, 0.75, 0.4]}>
        <cylinderGeometry args={[0.12, 0.12, 1.2, 16]} rotation={[0.4, 0, 0.3]} />
        <meshStandardMaterial color="#212121" roughness={0.9} />
      </mesh>
      {/* FOPS Operator Cabin */}
      <mesh position={[1.05, 0.75, -0.2]}>
        <boxGeometry args={[0.9, 1.0, 1.0]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh position={[1.05, 0.95, 0.32]}>
        <boxGeometry args={[0.7, 0.4, 0.02]} />
        <meshStandardMaterial color="#80DEEA" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function ProceduralCrusher() {
  return (
    <group>
      {/* Heavy Crusher Body */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[3.2, 1.4, 2.2]} />
        <meshStandardMaterial color="#455A64" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Feed Hopper Chute */}
      <mesh position={[0, 1.6, 0.5]}>
        <cylinderGeometry args={[1.1, 0.7, 1.2, 8]} />
        <meshStandardMaterial color="#37474F" metalness={0.8} />
      </mesh>
      {/* Massive Counterweight Flywheels */}
      {[-1.65, 1.65].map((x) => (
        <mesh key={x} position={[x, 0.6, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.8, 0.8, 0.25, 32]} />
          <meshStandardMaterial color="#607D8B" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* Flywheel Guarding */}
      <mesh position={[0, 0.75, 1.1]}>
        <boxGeometry args={[3.5, 0.9, 0.1]} />
        <meshStandardMaterial color="#F57C00" transparent opacity={0.6} />
      </mesh>
      {/* Drive Motor */}
      <mesh position={[-1.7, 0.55, -0.7]}>
        <cylinderGeometry args={[0.45, 0.45, 0.9, 24]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#1565C0" metalness={0.6} />
      </mesh>
      {/* Maintenance Platform Walkway with Handrails */}
      <mesh position={[0, 0.95, 1.3]}>
        <boxGeometry args={[2.8, 0.06, 0.5]} />
        <meshStandardMaterial color="#90A4AE" />
      </mesh>
      <mesh position={[0, 1.35, 1.55]}>
        <boxGeometry args={[2.8, 0.8, 0.04]} />
        <meshStandardMaterial color="#FDD835" wireframe />
      </mesh>
    </group>
  )
}

function ProceduralExcavator() {
  return (
    <group>
      {/* Crawler Undercarriage */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[3.4, 0.4, 2.2]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      {/* Dual Heavy Tracks */}
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} position={[x, -0.35, 0]}>
          <boxGeometry args={[0.7, 0.5, 2.8]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
        </mesh>
      ))}
      {/* Rotating Upper Turret / Body */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[2.8, 1.1, 2.2]} />
        <meshStandardMaterial color="#FBC02D" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Counterweight rear */}
      <mesh position={[0, 0.65, -1.2]}>
        <boxGeometry args={[2.7, 0.9, 0.6]} />
        <meshStandardMaterial color="#37474F" metalness={0.7} />
      </mesh>
      {/* Operator Cabin */}
      <mesh position={[1.05, 1.1, 0.5]}>
        <boxGeometry args={[0.85, 0.95, 0.95]} />
        <meshStandardMaterial color="#263238" />
      </mesh>
      <mesh position={[1.05, 1.15, 0.98]}>
        <boxGeometry args={[0.65, 0.65, 0.02]} />
        <meshStandardMaterial color="#80DEEA" transparent opacity={0.65} />
      </mesh>
      {/* Articulated Boom */}
      <mesh position={[-0.3, 1.6, 1.1]} rotation={[-Math.PI / 4, 0, 0]}>
        <boxGeometry args={[0.45, 2.2, 0.45]} />
        <meshStandardMaterial color="#FBC02D" metalness={0.6} />
      </mesh>
      {/* Hydraulic Digging Arm (Stick) */}
      <mesh position={[-0.3, 1.1, 2.2]} rotation={[Math.PI / 6, 0, 0]}>
        <boxGeometry args={[0.35, 1.7, 0.35]} />
        <meshStandardMaterial color="#FBC02D" metalness={0.6} />
      </mesh>
      {/* Heavy Rock Bucket */}
      <mesh position={[-0.3, 0.45, 2.7]}>
        <boxGeometry args={[0.9, 0.75, 0.9]} />
        <meshStandardMaterial color="#37474F" metalness={0.8} />
      </mesh>
      {/* Bucket Carbide Teeth */}
      {[-0.3, 0, 0.3].map((x) => (
        <mesh key={x} position={[-0.3 + x, 0.15, 3.15]} rotation={[0.4, 0, 0]}>
          <coneGeometry args={[0.07, 0.25, 8]} />
          <meshStandardMaterial color="#FFB020" metalness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function FallbackMachineRouter({ modelId }) {
  if (modelId === 'drill-rig') return <ProceduralDrillRig />
  if (modelId === 'crusher') return <ProceduralCrusher />
  if (modelId === 'excavator') return <ProceduralExcavator />
  return <ProceduralConveyor />
}

// ── Real GLB/GLTF Model Loader with Fallback ─────────────────────────────────
function GLTFModel({ url }) {
  const { scene } = useGLTF(url)
  // The four local assets use the same scene coordinates as the training pins.
  // Imported custom models retain their independent scale below.
  const isBuiltIn = /^\/models\/(conveyor|drill-rig|crusher|excavator)\.glb$/.test(url)
  return <primitive object={scene} scale={isBuiltIn ? 1 : 1.8} />
}

// ── Three.js Camera Controller for Reset & Zoom ──────────────────────────────
function CameraController({ resetTrigger, zoomTrigger }) {
  const { camera } = useThree()

  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(4.5, 3.2, 6.5)
      camera.lookAt(0, 0, 0)
    }
  }, [resetTrigger, camera])

  useEffect(() => {
    if (zoomTrigger === 'in') {
      camera.position.multiplyScalar(0.85)
    } else if (zoomTrigger === 'out') {
      camera.position.multiplyScalar(1.15)
    }
  }, [zoomTrigger, camera])

  return null
}

// WebXR hit-test placement. The full machine and its inspection pins share one
// transform; touching the detected floor anchors the training model in space.
function XRPlacement({ session, children }) {
  const { gl } = useThree()
  const placedGroup = useRef()
  const reticle = useRef()
  const hitSource = useRef(null)
  const latestPose = useRef(null)
  const anchored = useRef(false)

  useEffect(() => {
    if (!session) return undefined
    let mounted = true
    const onSelect = () => {
      if (!latestPose.current) return
      anchored.current = true
      placedGroup.current?.position.copy(latestPose.current.position)
      placedGroup.current?.quaternion.copy(latestPose.current.quaternion)
    }
    session.addEventListener('select', onSelect)
    session.requestReferenceSpace('viewer').then((viewerSpace) =>
      session.requestHitTestSource({ space: viewerSpace })
    ).then((source) => {
      if (mounted) hitSource.current = source
      else source.cancel()
    }).catch(() => {})
    return () => {
      mounted = false
      session.removeEventListener('select', onSelect)
      hitSource.current?.cancel()
      hitSource.current = null
    }
  }, [session])

  useFrame((_, delta, frame) => {
    if (!frame || !session || !hitSource.current) return
    const hit = frame.getHitTestResults(hitSource.current)[0]
    const pose = hit?.getPose(gl.xr.getReferenceSpace())
    if (!pose) {
      if (reticle.current) reticle.current.visible = false
      return
    }
    const { position, orientation } = pose.transform
    latestPose.current = {
      position: new THREE.Vector3(position.x, position.y, position.z),
      quaternion: new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w),
    }
    if (reticle.current) {
      reticle.current.visible = !anchored.current
      reticle.current.position.copy(latestPose.current.position)
      reticle.current.quaternion.copy(latestPose.current.quaternion)
    }
    if (!anchored.current && placedGroup.current) {
      placedGroup.current.visible = true
      placedGroup.current.position.copy(latestPose.current.position)
      placedGroup.current.quaternion.copy(latestPose.current.quaternion)
    }
  })

  return <>
    <group ref={placedGroup} visible={false}>
      <group position={[0, 0.46, 0]} scale={0.46}>{children}</group>
    </group>
    <group ref={reticle} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.31, 48]} />
        <meshBasicMaterial color="#ffbf38" side={THREE.DoubleSide} />
      </mesh>
    </group>
  </>
}

// ── 3D Scene Root ────────────────────────────────────────────────────────────
function Scene({ model, selected, onSelect, showLabels, resetTrigger, zoomTrigger, cameraMode, xrSession }) {
  const Fallback = <FallbackMachineRouter modelId={model.id} />

  const machineAndPins = <>
    {model.modelUrl ? (
      <ModelErrorBoundary key={model.modelUrl} fallback={Fallback}>
        <Suspense fallback={Fallback}>
          <GLTFModel url={model.modelUrl} />
        </Suspense>
      </ModelErrorBoundary>
    ) : Fallback}
    {model.components.map((item) => (
      <Hotspot key={item.id} item={item} selected={selected} onSelect={onSelect} showLabels={showLabels} />
    ))}
  </>

  return (
    <>
      <ambientLight intensity={0.85} />
      <hemisphereLight args={['#cde4f1', '#3a3328', 1.0]} />
      <directionalLight position={[6, 8, 6]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-5, 4, -4]} intensity={0.9} color="#87b5ce" />
      {!cameraMode && !xrSession && <>
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.06, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#182125" roughness={0.98} />
        </mesh>
        <gridHelper args={[14, 28, '#5a6766', '#2b3739']} position={[0, -1.052, 0]} />
        <ContactShadows position={[0, -1.045, 0]} opacity={0.48} scale={11} blur={2.2} far={5} resolution={256} color="#000000" />
      </>}

      {xrSession ? <XRPlacement session={xrSession}>{machineAndPins}</XRPlacement> : machineAndPins}

      {!xrSession && <CameraController resetTrigger={resetTrigger} zoomTrigger={zoomTrigger} />}
      {!xrSession && <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2.5}
        maxDistance={12}
        maxPolarAngle={Math.PI / 1.95}
      />}
    </>
  )
}

// ── Main Machine3DViewer Component ───────────────────────────────────────────
export default function Machine3DViewer({ onInspectionSaved, activeCustomModel }) {
  const [modelId, setModelId] = useState('conveyor')
  const [customModelItem, setCustomModelItem] = useState(null)
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('inspect') // 'inspect' | 'checklist' | 'training'
  const [showLabels, setShowLabels] = useState(true)
  const [cameraMode, setCameraMode] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [webXRSupported, setWebXRSupported] = useState(false)
  const [xrSession, setXRSession] = useState(null)
  const glRef = useRef(null)

  // Camera & view controls triggers
  const [resetTrigger, setResetTrigger] = useState(0)
  const [zoomTrigger, setZoomTrigger] = useState(null)

  // Checklist state
  const [checklistChecks, setChecklistChecks] = useState({})
  const [checklistScore, setChecklistScore] = useState(null)
  const [checklistSaved, setChecklistSaved] = useState(false)
  const [savingInspection, setSavingInspection] = useState(false)

  // Training Mode state
  const [trainingIndex, setTrainingIndex] = useState(0)
  const [trainingAnswers, setTrainingAnswers] = useState({})
  const [trainingFinished, setTrainingFinished] = useState(false)
  const [trainingScore, setTrainingScore] = useState(0)
  const [weakAreas, setWeakAreas] = useState([])

  const containerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  // Automatically adapt when an active custom model is passed
  useEffect(() => {
    if (activeCustomModel) {
      const customObj = createCustomMachineModel(activeCustomModel)
      setCustomModelItem(customObj)
      setModelId(customObj.id)
      setSelected(null)
      setChecklistChecks({})
      setChecklistScore(null)
      setChecklistSaved(false)
      setTrainingIndex(0)
      setTrainingAnswers({})
      setTrainingFinished(false)
      setWeakAreas([])
    }
  }, [activeCustomModel])

  const model = customModelItem && modelId === customModelItem.id
    ? customModelItem
    : (MACHINE_MODELS[modelId] || MACHINE_MODELS.conveyor)

  // Detect WebXR capability on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'xr' in navigator && navigator.xr?.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
        setWebXRSupported(Boolean(supported))
      }).catch(() => setWebXRSupported(false))
    }
  }, [])

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      glRef.current?.xr.getSession()?.end().catch(() => {})
    }
  }, [])

  const toggleSpatialAR = async () => {
    if (xrSession) {
      await xrSession.end()
      return
    }
    try {
      setCameraError('')
      if (cameraMode) toggleCamera()
      const gl = glRef.current
      if (!gl) throw new Error('The 3D viewer is still loading.')
      gl.xr.enabled = true
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'local-floor'],
        domOverlay: { root: document.body },
      })
      session.addEventListener('end', () => setXRSession(null), { once: true })
      await gl.xr.setSession(session)
      setXRSession(session)
    } catch (err) {
      setCameraError(`Spatial AR could not start: ${err.message}. Use the camera preview or the 3D model.`)
    }
  }

  // The video is mounted after cameraMode changes, so attach its stream then.
  useEffect(() => {
    if (cameraMode && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraMode])

  // Reset selected component and inspection state on model switch
  const handleModelChange = (id) => {
    setModelId(id)
    setSelected(null)
    setChecklistChecks({})
    setChecklistScore(null)
    setChecklistSaved(false)
    setTrainingIndex(0)
    setTrainingAnswers({})
    setTrainingFinished(false)
    setWeakAreas([])
  }

  // Toggle Camera AR preview
  const toggleCamera = async () => {
    if (cameraMode) {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setCameraMode(false)
      return
    }
    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraMode(true)
    } catch {
      setCameraError('Camera access was not permitted. The 3D interactive model remains fully functional.')
    }
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Checklist verification & score calculation
  const handleChecklistToggle = (stepId) => {
    setChecklistChecks((prev) => ({ ...prev, [stepId]: !prev[stepId] }))
  }

  const submitChecklistInspection = async () => {
    setSavingInspection(true)
    const steps = model.inspectionSteps || []
    const totalSteps = steps.length
    const checkedCount = steps.filter((s) => checklistChecks[s.id]).length
    const score = Math.round((checkedCount / (totalSteps || 1)) * 100)
    const passed = score >= 70

    // Identify weak areas from missed steps
    const missed = steps
      .filter((s) => !checklistChecks[s.id])
      .map((s) => {
        const comp = model.components.find((c) => c.id === s.relatedComponentId)
        return {
          stepId: s.id,
          label: s.label,
          componentId: s.relatedComponentId,
          relatedDomain: comp?.relatedDomain || 'Machinery Safety & Lockout-Tagout',
          domainSlug: comp?.domainSlug || 'machinery-loto',
        }
      })

    setChecklistScore(score)
    setWeakAreas(missed)

    try {
      await saveInspectionResult({
        machineId: model.id,
        machineName: model.name,
        mode: 'checklist',
        checklist: steps.map((s) => ({ id: s.id, label: s.label, checked: Boolean(checklistChecks[s.id]) })),
        score,
        passed,
        weakAreas: missed,
        recommendedDomain: missed[0]?.relatedDomain || 'Machinery Safety & Lockout-Tagout',
        notes: `Pre-shift inspection: ${checkedCount}/${totalSteps} items verified.`,
      })
      setChecklistSaved(true)
      if (onInspectionSaved) onInspectionSaved()
    } catch (e) {
      console.warn('[Machine3DViewer] Failed to save inspection to PostgreSQL:', e.message)
    } finally {
      setSavingInspection(false)
    }
  }

  // Training Mode Answer Handler
  const handleTrainingAnswer = (questionIndex, optionIndex) => {
    if (trainingAnswers[questionIndex] !== undefined) return
    const q = model.trainingQuestions[questionIndex]
    const isCorrect = optionIndex === q.correctIndex

    setTrainingAnswers((prev) => ({
      ...prev,
      [questionIndex]: { optionIndex, isCorrect },
    }))

    if (!isCorrect) {
      const comp = model.components.find((c) => c.id === q.componentId)
      setWeakAreas((prev) => [
        ...prev,
        {
          questionId: q.id,
          componentId: q.componentId,
          relatedDomain: q.relatedDomain || comp?.relatedDomain || 'Machinery Safety & Lockout-Tagout',
          domainSlug: comp?.domainSlug || 'machinery-loto',
        },
      ])
    }
  }

  const finishTraining = async () => {
    const totalQ = model.trainingQuestions?.length || 1
    const correctCount = Object.values(trainingAnswers).filter((a) => a.isCorrect).length
    const score = Math.round((correctCount / totalQ) * 100)
    const passed = score >= 70

    setTrainingScore(score)
    setTrainingFinished(true)

    try {
      await saveInspectionResult({
        machineId: model.id,
        machineName: model.name,
        mode: 'training',
        answers: Object.entries(trainingAnswers).map(([k, v]) => ({
          questionIndex: Number(k),
          isCorrect: v.isCorrect,
        })),
        score,
        passed,
        weakAreas,
        recommendedDomain: weakAreas[0]?.relatedDomain || 'Machinery Safety & Lockout-Tagout',
        notes: `Interactive training simulation score: ${score}%`,
      })
      if (onInspectionSaved) onInspectionSaved()
    } catch (e) {
      console.warn('[Machine3DViewer] Failed to save training result:', e.message)
    }
  }

  return (
    <section ref={containerRef} className="bg-steel-light border border-steel-lighter rounded-xl overflow-hidden shadow-2xl">
      {/* ── Top Header Bar ── */}
      <div className="p-4 border-b border-steel-lighter flex flex-wrap items-center justify-between gap-4 bg-steel">
        <div className="flex items-center gap-3">
          <span className="text-3xl p-1.5 bg-steel-lighter rounded-lg">{model.thumbnail}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-amber">3D Machine Training Lab</p>
              {webXRSupported ? (
                <span className="bg-safe/20 text-safe text-[9px] font-mono uppercase px-1.5 py-0.5 rounded">WebXR Ready</span>
              ) : (
                <span className="bg-steel-lighter text-concrete text-[9px] font-mono uppercase px-1.5 py-0.5 rounded">Camera Overlay</span>
              )}
            </div>
            <h2 className="font-display font-bold text-2xl uppercase tracking-tight text-chalk">{model.name}</h2>
          </div>
        </div>

        {/* Machine Selector Buttons */}
        <div className="flex flex-wrap gap-1.5">
          {MACHINE_MODEL_LIST.map((item) => (
            <button
              key={item.id}
              onClick={() => handleModelChange(item.id)}
              className={`font-mono text-xs px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                modelId === item.id
                  ? 'bg-amber text-steel border-amber font-bold shadow-md'
                  : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
              }`}
            >
              <span>{item.thumbnail}</span>
              <span>{item.name.split(' ')[0]}</span>
            </button>
          ))}
          {customModelItem && (
            <button
              key={customModelItem.id}
              onClick={() => handleModelChange(customModelItem.id)}
              title={customModelItem.name}
              className={`font-mono text-xs px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
                modelId === customModelItem.id
                  ? 'bg-amber text-steel border-amber font-bold shadow-md'
                  : 'border-steel-lighter text-concrete hover:border-amber/80 hover:text-chalk'
              }`}
            >
              <span>✨</span>
              <span className="truncate max-w-[110px]">{customModelItem.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="flex border-b border-steel-lighter bg-steel-light/70 px-4 pt-2 gap-2 text-xs font-mono uppercase tracking-wider">
        <button
          onClick={() => setActiveTab('inspect')}
          className={`px-4 py-2.5 rounded-t-lg border-t border-x transition-colors ${
            activeTab === 'inspect'
              ? 'border-steel-lighter bg-steel text-amber font-bold'
              : 'border-transparent text-concrete hover:text-chalk'
          }`}
        >
          🔍 3D Hotspot Inspection
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`px-4 py-2.5 rounded-t-lg border-t border-x transition-colors flex items-center gap-1.5 ${
            activeTab === 'checklist'
              ? 'border-steel-lighter bg-steel text-amber font-bold'
              : 'border-transparent text-concrete hover:text-chalk'
          }`}
        >
          <span>📋 Pre-Shift Checklist</span>
          {checklistScore !== null && (
            <span className={`text-[10px] px-1 rounded ${checklistScore >= 70 ? 'bg-safe text-steel font-bold' : 'bg-hazard text-chalk font-bold'}`}>
              {checklistScore}%
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('training')}
          className={`px-4 py-2.5 rounded-t-lg border-t border-x transition-colors flex items-center gap-1.5 ${
            activeTab === 'training'
              ? 'border-steel-lighter bg-steel text-amber font-bold'
              : 'border-transparent text-concrete hover:text-chalk'
          }`}
        >
          <span>🎯 Interactive Training Mode</span>
          {trainingFinished && (
            <span className={`text-[10px] px-1 rounded ${trainingScore >= 70 ? 'bg-safe text-steel font-bold' : 'bg-hazard text-chalk font-bold'}`}>
              {trainingScore}%
            </span>
          )}
        </button>
      </div>

      {/* ── Main Interactive Layout ── */}
      <div className="grid lg:grid-cols-[1.65fr_1.1fr] min-h-[520px]">
        {/* Left: 3D Canvas / Camera AR View */}
        <div className="relative h-[480px] lg:h-auto min-h-[480px] bg-[#0A0D0F] overflow-hidden border-b lg:border-b-0 lg:border-r border-steel-lighter">
          {/* Camera AR Background Stream (if active) */}
          {cameraMode && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-55 z-0"
            />
          )}

          {/* 3D WebGL Canvas */}
          <div className="absolute inset-0 z-10">
            <Canvas shadows dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}
              onCreated={({ gl }) => { glRef.current = gl; gl.setClearColor('#0A0D0F', 0) }}
              camera={{ position: [4.5, 3.2, 6.5], fov: 45 }}>
              <Scene
                model={model}
                cameraMode={cameraMode}
                xrSession={xrSession}
                selected={selected}
                onSelect={setSelected}
                showLabels={showLabels}
                resetTrigger={resetTrigger}
                zoomTrigger={zoomTrigger}
              />
            </Canvas>
          </div>

          {/* 3D Floating Controls Toolbar */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5 bg-steel/90 backdrop-blur-md p-1.5 rounded-lg border border-steel-lighter shadow-lg">
            <button
              onClick={() => setResetTrigger((n) => n + 1)}
              title="Reset Camera View"
              className="px-2.5 py-1 text-xs font-mono text-concrete hover:text-chalk rounded hover:bg-steel-lighter border border-transparent hover:border-steel-lighter transition-colors"
            >
              🔄 Reset View
            </button>
            <button
              onClick={() => {
                setZoomTrigger('in')
                setTimeout(() => setZoomTrigger(null), 100)
              }}
              title="Zoom In"
              className="px-2.5 py-1 text-xs font-mono text-concrete hover:text-chalk rounded hover:bg-steel-lighter transition-colors"
            >
              ➕
            </button>
            <button
              onClick={() => {
                setZoomTrigger('out')
                setTimeout(() => setZoomTrigger(null), 100)
              }}
              title="Zoom Out"
              className="px-2.5 py-1 text-xs font-mono text-concrete hover:text-chalk rounded hover:bg-steel-lighter transition-colors"
            >
              ➖
            </button>
            <button
              onClick={() => setShowLabels((v) => !v)}
              title="Toggle Hotspot Labels"
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                showLabels ? 'text-amber bg-amber/10 border border-amber/30' : 'text-concrete hover:text-chalk'
              }`}
            >
              🏷️ Labels
            </button>
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="px-2.5 py-1 text-xs font-mono text-concrete hover:text-chalk rounded hover:bg-steel-lighter transition-colors"
            >
              ⛶ Fullscreen
            </button>
          </div>

          {/* Camera AR Action Button */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 items-end">
            {webXRSupported && <button onClick={toggleSpatialAR}
              className="font-mono text-xs px-3 py-1.5 rounded-lg border bg-amber text-steel border-amber font-bold shadow-md">
              {xrSession ? 'Exit Spatial AR' : 'Place in Spatial AR'}
            </button>}
            {!xrSession && <button
              onClick={toggleCamera}
              className={`font-mono text-xs px-3 py-1.5 rounded-lg border backdrop-blur-md transition-all shadow-md flex items-center gap-1.5 ${
                cameraMode
                  ? 'bg-hazard text-chalk border-hazard font-bold'
                  : 'bg-steel/90 border-cyan-400/50 text-cyan-200 hover:border-amber hover:text-amber'
              }`}
            >
              <span>📷</span>
              <span>{cameraMode ? 'Exit Camera AR' : 'Camera AR Preview'}</span>
            </button>}
          </div>

          {/* Bottom Controls Legend */}
          <div className="absolute bottom-3 left-0 right-0 z-20 text-center pointer-events-none px-4">
            <span className="inline-block bg-steel/85 backdrop-blur-md border border-steel-lighter text-concrete text-[10px] font-mono px-3 py-1 rounded-full shadow-md">
              {xrSession
                ? 'Point at a floor, then tap to anchor the machine · Tap pins to inspect'
                : 'Left Drag: Rotate · Right Drag: Pan · Scroll: Zoom · Click Hotspots'}
            </span>
          </div>

          {/* Camera Overlay Disclaimer */}
          {cameraMode && (
            <div className="absolute top-14 right-3 z-20 max-w-xs bg-steel/95 border border-cyan-400/30 text-cyan-100 text-[10px] font-mono p-2.5 rounded-lg shadow-lg">
              <p className="font-bold text-cyan-300 mb-0.5">Camera Preview Active</p>
              <p className="text-concrete leading-tight">
                Rotate and inspect the 3D study model over the camera. For floor detection and placement, use Spatial AR on a compatible device.
              </p>
            </div>
          )}

          {cameraError && (
            <div className="absolute bottom-12 left-4 right-4 z-20 bg-hazard/20 border border-hazard text-hazard text-xs p-2.5 rounded-lg backdrop-blur-md">
              {cameraError}
            </div>
          )}
        </div>

        {/* Right: Detailed Inspection & Training Panel */}
        <div className="p-5 flex flex-col justify-between bg-steel max-h-[640px] overflow-y-auto">
          {/* TAB 1: 3D Hotspot Inspection */}
          {activeTab === 'inspect' && (
            <div className="space-y-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-concrete block mb-1">
                  Category: {model.category}
                </span>
                <h3 className="font-display font-bold text-xl uppercase tracking-wide text-chalk">
                  Component Inspection
                </h3>
                <p className="text-xs text-concrete leading-relaxed mt-1">{model.description}</p>
              </div>

              {/* Hotspot List Chips */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-concrete mb-2">
                  Select a Machine Hotspot ({model.components.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {model.components.map((c) => {
                    const isSel = selected?.id === c.id
                    const color = SEVERITY_COLORS[c.severity]
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelected(c)}
                        className={`text-left p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                          isSel
                            ? 'border-amber bg-amber/10 shadow-sm'
                            : 'border-steel-lighter bg-steel-light hover:border-steel-lighter/80'
                        }`}
                      >
                        <span className="text-xs font-bold text-chalk truncate">{c.label}</span>
                        <span
                          className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{
                            backgroundColor: `${color}20`,
                            color: color,
                            border: `1px solid ${color}40`,
                          }}
                        >
                          {c.severity}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Detailed Component View Card */}
              {selected ? (
                <div className="bg-steel-light border border-amber/40 rounded-xl p-4 space-y-3 mt-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-steel-lighter pb-2">
                    <h4 className="font-display font-bold text-lg text-chalk uppercase">{selected.label}</h4>
                    <span
                      className="font-mono text-[10px] uppercase px-2 py-0.5 rounded font-bold"
                      style={{
                        backgroundColor: `${SEVERITY_COLORS[selected.severity]}25`,
                        color: SEVERITY_COLORS[selected.severity],
                        border: `1px solid ${SEVERITY_COLORS[selected.severity]}`,
                      }}
                    >
                      {selected.severity} RISK
                    </span>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-concrete uppercase tracking-wider block">Component Purpose</span>
                    <p className="text-xs text-chalk leading-relaxed mt-0.5">{selected.purpose}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-hazard uppercase tracking-wider block">Hazard Identification</span>
                    <p className="text-xs text-hazard/90 leading-relaxed mt-0.5">{selected.hazard}</p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] text-concrete uppercase tracking-wider block mb-1">Required PPE</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.ppe?.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1 bg-steel border border-steel-lighter text-[11px] px-2 py-0.5 rounded font-mono text-chalk">
                          <span>{PPE_ICONS[id]?.icon || '🛡️'}</span>
                          <span className="capitalize">{id}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-steel-lighter pt-2">
                    <span className="font-mono text-[10px] text-cyan-300 uppercase tracking-wider block">Inspection Procedure</span>
                    <p className="text-xs text-concrete leading-relaxed mt-0.5">{selected.procedure}</p>
                  </div>

                  <div className="bg-steel/80 p-2.5 rounded-lg border border-steel-lighter">
                    <span className="font-mono text-[10px] text-amber uppercase tracking-wider block font-bold">Mandatory Safe Action</span>
                    <p className="text-xs text-chalk leading-relaxed mt-0.5">{selected.action}</p>
                  </div>

                  {/* Link to related training domain */}
                  {selected.domainSlug && (
                    <div className="pt-1 flex items-center justify-between text-xs">
                      <span className="text-concrete font-mono text-[10px]">Related Competency:</span>
                      <Link
                        to={`/assessment/${selected.domainSlug}`}
                        className="text-amber font-mono text-[11px] hover:underline flex items-center gap-1"
                      >
                        Practice in Assessment →
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-steel-lighter rounded-xl p-6 text-center text-concrete text-xs font-mono">
                  Tap any 3D marker on the machine or select a component above to inspect its purpose, hazard profile, and safe procedures.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Pre-Shift Inspection Checklist */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display font-bold text-xl uppercase tracking-wide text-chalk">
                  Pre-Operation Checklist
                </h3>
                <p className="text-xs text-concrete leading-relaxed">
                  Verify every critical safety checkpoint on the {model.name} before starting operations.
                </p>
              </div>

              <div className="space-y-2">
                {model.inspectionSteps?.map((step) => {
                  const isChecked = Boolean(checklistChecks[step.id])
                  return (
                    <label
                      key={step.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-safe/60 bg-safe/10 text-chalk'
                          : 'border-steel-lighter bg-steel-light text-concrete hover:border-steel-lighter/80'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleChecklistToggle(step.id)}
                        className="mt-0.5 w-4 h-4 rounded border-steel-lighter text-amber focus:ring-0 focus:ring-offset-0 bg-steel cursor-pointer"
                      />
                      <span className="text-xs leading-relaxed flex-1 select-none">{step.label}</span>
                    </label>
                  )
                })}
              </div>

              {/* Checklist Result & Score Card */}
              {checklistScore !== null && (
                <div className={`p-4 rounded-xl border ${checklistScore >= 70 ? 'bg-safe/10 border-safe' : 'bg-hazard/10 border-hazard'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display font-bold text-lg uppercase">
                      Inspection Score: {checklistScore}%
                    </span>
                    <span className={`font-mono text-xs uppercase px-2 py-0.5 rounded font-bold ${checklistScore >= 70 ? 'bg-safe text-steel' : 'bg-hazard text-chalk'}`}>
                      {checklistScore >= 70 ? 'PASSED — SAFE TO RUN' : 'DEFECTS FOUND'}
                    </span>
                  </div>
                  <p className="text-xs text-concrete">
                    {checklistScore >= 70
                      ? 'Machine passes mandatory pre-shift inspection criteria. Results saved to your permanent worker profile.'
                      : 'Critical safety checks were missed. Equipment must remain tagged out until deficiencies are corrected.'}
                  </p>

                  {/* Connected Weak Areas -> Adaptive Assessment */}
                  {weakAreas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-hazard/30 space-y-2">
                      <span className="font-mono text-[10px] text-amber uppercase tracking-wider block font-bold">
                        Weak Areas Identified for Assessment:
                      </span>
                      {weakAreas.map((w, i) => (
                        <div key={i} className="flex items-center justify-between text-xs bg-steel p-2 rounded border border-steel-lighter">
                          <span className="text-chalk text-xs truncate">{w.label}</span>
                          <Link
                            to={`/assessment/${w.domainSlug || 'machinery-loto'}`}
                            className="text-amber font-mono text-[10px] hover:underline shrink-0 ml-2"
                          >
                            Practice Domain →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit Checklist Button */}
              <button
                onClick={submitChecklistInspection}
                disabled={savingInspection}
                className="w-full bg-amber text-steel font-display font-bold text-sm uppercase py-3 rounded-lg hover:bg-white transition-all disabled:opacity-50 shadow-md"
              >
                {savingInspection ? 'Saving to Database...' : checklistSaved ? 'Update Inspection Record' : 'Submit Inspection Checklist'}
              </button>
            </div>
          )}

          {/* TAB 3: Interactive Training Mode */}
          {activeTab === 'training' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display font-bold text-xl uppercase tracking-wide text-chalk">
                  Interactive Training Simulation
                </h3>
                <p className="text-xs text-concrete leading-relaxed">
                  Step through guided scenario challenges for the {model.name}. Identify hazards, select protective controls, and earn safety points.
                </p>
              </div>

              {!trainingFinished && model.trainingQuestions?.length > 0 ? (
                <div className="bg-steel-light border border-steel-lighter rounded-xl p-4 space-y-4">
                  {/* Progress Indicator */}
                  <div className="flex items-center justify-between text-xs font-mono text-concrete border-b border-steel-lighter pb-2">
                    <span>Question {trainingIndex + 1} of {model.trainingQuestions.length}</span>
                    <span className="text-amber font-bold">
                      Domain: {model.trainingQuestions[trainingIndex]?.relatedDomain || 'Machinery Safety'}
                    </span>
                  </div>

                  {/* Question Prompt */}
                  <p className="text-sm font-semibold text-chalk leading-relaxed">
                    {model.trainingQuestions[trainingIndex]?.prompt}
                  </p>

                  {/* Options */}
                  <div className="space-y-2">
                    {model.trainingQuestions[trainingIndex]?.options.map((opt, optIdx) => {
                      const ans = trainingAnswers[trainingIndex]
                      const isChosen = ans?.optionIndex === optIdx
                      const isCorrectOpt = optIdx === model.trainingQuestions[trainingIndex].correctIndex

                      let btnStyle = 'border-steel-lighter bg-steel text-chalk hover:border-amber/80'
                      if (ans) {
                        if (isCorrectOpt) {
                          btnStyle = 'border-safe bg-safe/20 text-safe font-bold'
                        } else if (isChosen) {
                          btnStyle = 'border-hazard bg-hazard/20 text-hazard font-bold'
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={ans !== undefined}
                          onClick={() => handleTrainingAnswer(trainingIndex, optIdx)}
                          className={`w-full text-left p-3 rounded-lg border text-xs leading-relaxed transition-all ${btnStyle}`}
                        >
                          <span className="font-mono mr-2">{String.fromCharCode(65 + optIdx)}.</span>
                          <span>{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Answer Feedback */}
                  {trainingAnswers[trainingIndex] && (
                    <div className="bg-steel p-3 rounded-lg border border-steel-lighter space-y-1.5 animate-fadeIn">
                      <p className={`text-xs font-bold font-mono ${trainingAnswers[trainingIndex].isCorrect ? 'text-safe' : 'text-hazard'}`}>
                        {trainingAnswers[trainingIndex].isCorrect ? '✓ Correct Safety Decision' : '✗ Unsafe Practice'}
                      </p>
                      <p className="text-xs text-concrete leading-relaxed">
                        {model.trainingQuestions[trainingIndex].explanation}
                      </p>
                      <p className="text-[11px] text-chalk font-mono pt-1">
                        <strong>Mandatory Action:</strong> {model.trainingQuestions[trainingIndex].safeAction}
                      </p>
                    </div>
                  )}

                  {/* Next / Finish Button */}
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => setTrainingIndex((i) => Math.max(0, i - 1))}
                      disabled={trainingIndex === 0}
                      className="px-3 py-1.5 rounded border border-steel-lighter text-xs font-mono text-concrete disabled:opacity-30"
                    >
                      ← Previous
                    </button>
                    {trainingIndex < model.trainingQuestions.length - 1 ? (
                      <button
                        onClick={() => setTrainingIndex((i) => i + 1)}
                        disabled={trainingAnswers[trainingIndex] === undefined}
                        className="px-4 py-1.5 rounded bg-amber text-steel font-bold text-xs font-mono disabled:opacity-30"
                      >
                        Next Step →
                      </button>
                    ) : (
                      <button
                        onClick={finishTraining}
                        disabled={trainingAnswers[trainingIndex] === undefined}
                        className="px-4 py-1.5 rounded bg-safe text-steel font-bold text-xs font-mono disabled:opacity-30"
                      >
                        Complete Training & Save Score
                      </button>
                    )}
                  </div>
                </div>
              ) : trainingFinished ? (
                /* Training Completed Summary */
                <div className="p-4 rounded-xl border bg-steel-light border-steel-lighter space-y-4 text-center">
                  <div className="text-4xl">🎉</div>
                  <h4 className="font-display font-bold text-2xl uppercase text-chalk">
                    Training Complete!
                  </h4>
                  <div className="inline-block px-4 py-2 rounded-xl bg-steel border border-steel-lighter">
                    <span className="text-xs font-mono text-concrete uppercase block">Final Score</span>
                    <span className={`text-3xl font-display font-bold ${trainingScore >= 70 ? 'text-safe' : 'text-hazard'}`}>
                      {trainingScore}%
                    </span>
                  </div>
                  <p className="text-xs text-concrete max-w-sm mx-auto">
                    {trainingScore >= 70
                      ? 'Excellent work! You demonstrated strong hazard identification and procedural discipline.'
                      : 'You completed the training simulation, but several hazard controls were missed. Review the weak areas below.'}
                  </p>

                  {/* Connected Weak Areas -> Adaptive Assessment */}
                  {weakAreas.length > 0 && (
                    <div className="text-left bg-steel p-3 rounded-lg border border-hazard/40 space-y-2">
                      <span className="font-mono text-[10px] text-amber uppercase tracking-wider block font-bold">
                        Targeted Practice Recommended:
                      </span>
                      {weakAreas.map((w, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-chalk text-xs">Improvement needed in: {w.relatedDomain}</span>
                          <Link
                            to={`/assessment/${w.domainSlug || 'machinery-loto'}`}
                            className="text-amber font-mono text-[11px] underline ml-2 shrink-0"
                          >
                            Start Assessment
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setTrainingIndex(0)
                      setTrainingAnswers({})
                      setTrainingFinished(false)
                      setWeakAreas([])
                    }}
                    className="w-full border border-concrete rounded-lg py-2.5 font-mono text-xs text-chalk hover:border-amber hover:text-amber"
                  >
                    Restart Training Session
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

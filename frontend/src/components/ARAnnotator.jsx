import { useRef, useState, useCallback } from 'react'
import { MARKER_TYPES, SEVERITY_COLOR, ppeIcon } from '../lib/arMarkers.js'

const CLICK_DRAG_THRESHOLD = 0.015 // normalized distance below which a drag counts as a plain click

/**
 * Renders an image with interactive AR-HUD-style annotations on top of it:
 *  - hazard zones as bracket-cornered boxes
 *  - PPE / component markers as pulsing beacon pins
 *  - a leader-line callout card for whichever marker is selected
 *  - an optional scanning sweep while `scanning` is true (AI analysis in flight)
 *
 * This component owns no marker data — the parent passes `markers` and
 * receives `onPlace` (new marker drawn) / `onSelect` (marker tapped) so it
 * can be dropped into any page that needs photo annotation.
 */
export default function ARAnnotator({
  imageSrc,
  markers = [],
  mode = 'view', // 'view' (training/preview) | 'edit' (authoring)
  activeTool = null, // 'hazard' | 'ppe' | 'component' | null
  selectedId = null,
  onSelect = () => {},
  onPlace = () => {},
  onRequestDelete = null,
  foundIds = null, // Set of marker ids already "discovered" in training mode
  scanning = false, // true while an AI pass is analyzing the image
}) {
  const containerRef = useRef(null)
  const [draft, setDraft] = useState(null) // { x, y, w, h } in-progress drag box, normalized

  const toNorm = useCallback((clientX, clientY) => {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }, [])

  const handlePointerDown = (e) => {
    if (mode !== 'edit' || !activeTool) return
    e.preventDefault()
    const start = toNorm(e.clientX, e.clientY)
    setDraft({ x: start.x, y: start.y, w: 0, h: 0, startX: start.x, startY: start.y })

    const handleMove = (ev) => {
      const cur = toNorm(ev.clientX, ev.clientY)
      setDraft((d) => {
        if (!d) return d
        const x = Math.min(d.startX, cur.x)
        const y = Math.min(d.startY, cur.y)
        const w = Math.abs(cur.x - d.startX)
        const h = Math.abs(cur.y - d.startY)
        return { ...d, x, y, w, h }
      })
    }
    const handleUp = (ev) => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      const end = toNorm(ev.clientX, ev.clientY)
      const dist = Math.hypot(end.x - start.x, end.y - start.y)
      setDraft(null)
      if (activeTool === 'hazard') {
        if (dist < CLICK_DRAG_THRESHOLD) {
          // treat as a click: default-sized hazard box centered on the point
          const size = 0.14
          onPlace({
            type: 'hazard',
            x: Math.max(0, start.x - size / 2),
            y: Math.max(0, start.y - size / 2),
            w: size,
            h: size,
          })
        } else {
          const x = Math.min(start.x, end.x)
          const y = Math.min(start.y, end.y)
          onPlace({ type: 'hazard', x, y, w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) })
        }
      } else {
        onPlace({ type: activeTool, x: start.x, y: start.y })
      }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="relative select-none"
      style={{ cursor: mode === 'edit' && activeTool ? 'crosshair' : 'default', touchAction: mode === 'edit' && activeTool ? 'none' : 'auto' }}
    >
      {/* clipped layer: only the photo + its purely-visual decoration live here,
          so callout cards below are free to render outside the photo's edges */}
      <div className="relative overflow-hidden rounded-lg border border-steel-lighter bg-steel-light">
        <img src={imageSrc} alt="Annotated machine" className="w-full block pointer-events-none" draggable={false} />

        {/* AR viewfinder corner brackets — purely decorative HUD framing */}
        <ViewfinderFrame />

        {/* scanning sweep during AI analysis */}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="ar-scan-line" />
            <div className="absolute inset-0 ar-scan-grid" />
          </div>
        )}

        {draft && draft.w > 0.001 && (
          <div
            className="absolute border-2 border-dashed rounded pointer-events-none"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.w * 100}%`,
              height: `${draft.h * 100}%`,
              borderColor: MARKER_TYPES.hazard.color,
              background: MARKER_TYPES.hazard.dim,
            }}
          />
        )}
      </div>

      {markers.map((m) =>
        m.w ? (
          <ZoneMarker
            key={m.id}
            marker={m}
            selected={selectedId === m.id}
            onSelect={() => onSelect(selectedId === m.id ? null : m.id)}
          />
        ) : (
          <PinMarker
            key={m.id}
            marker={m}
            selected={selectedId === m.id}
            found={foundIds ? foundIds.has(m.id) : true}
            onSelect={() => onSelect(selectedId === m.id ? null : m.id)}
          />
        )
      )}

      {markers
        .filter((m) => m.id === selectedId)
        .map((m) => (
          <Callout key={m.id} marker={m} editable={mode === 'edit'} onDelete={onRequestDelete} onClose={() => onSelect(null)} />
        ))}
    </div>
  )
}

function ViewfinderFrame() {
  const corner = 'absolute w-6 h-6 border-amber/70'
  return (
    <div className="pointer-events-none absolute inset-3">
      <div className={`${corner} top-0 left-0 border-t-2 border-l-2`} />
      <div className={`${corner} top-0 right-0 border-t-2 border-r-2`} />
      <div className={`${corner} bottom-0 left-0 border-b-2 border-l-2`} />
      <div className={`${corner} bottom-0 right-0 border-b-2 border-r-2`} />
    </div>
  )
}

function ZoneMarker({ marker, selected, onSelect }) {
  const color = marker.type === 'hazard' ? SEVERITY_COLOR[marker.severity] || MARKER_TYPES.hazard.color : MARKER_TYPES[marker.type].color
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className="absolute group"
      style={{
        left: `${marker.x * 100}%`,
        top: `${marker.y * 100}%`,
        width: `${marker.w * 100}%`,
        height: `${marker.h * 100}%`,
      }}
    >
      <div
        className="absolute inset-0 rounded-sm transition-all"
        style={{
          border: `2px solid ${color}`,
          background: selected ? `${color}22` : 'transparent',
          boxShadow: selected ? `0 0 0 3px ${color}55` : 'none',
        }}
      />
      {/* corner brackets, AR-object-detection style */}
      {['tl', 'tr', 'bl', 'br'].map((c) => (
        <span
          key={c}
          className="absolute w-3 h-3"
          style={{
            ...(c.includes('t') ? { top: -2 } : { bottom: -2 }),
            ...(c.includes('l') ? { left: -2 } : { right: -2 }),
            borderColor: color,
            borderTopWidth: c.includes('t') ? 3 : 0,
            borderBottomWidth: c.includes('b') ? 3 : 0,
            borderLeftWidth: c.includes('l') ? 3 : 0,
            borderRightWidth: c.includes('r') ? 3 : 0,
            borderStyle: 'solid',
          }}
        />
      ))}
      <span
        className="absolute -top-6 left-0 font-mono text-[10px] uppercase px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1"
        style={{ backgroundColor: color, color: '#1C1F22' }}
      >
        {marker.label || 'Hazard'}
      </span>
    </button>
  )
}

function PinMarker({ marker, selected, found, onSelect }) {
  const color = MARKER_TYPES[marker.type]?.color || '#FFB020'
  const icon = marker.type === 'ppe' ? marker.ppeIcons?.[0] && ppeIcon(marker.ppeIcons[0]).emoji : marker.type === 'component' ? '🔧' : '⚠️'
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
      style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%`, width: 34, height: 34 }}
      aria-label={marker.label}
    >
      {!found && (
        <>
          <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ backgroundColor: color }} />
          <span className="absolute inline-flex h-[140%] w-[140%] rounded-full opacity-20" style={{ border: `1px solid ${color}` }} />
        </>
      )}
      <span
        className="relative flex items-center justify-center rounded-full text-sm shadow-lg transition-transform"
        style={{
          width: 30,
          height: 30,
          backgroundColor: found ? '#2A2E33' : color,
          border: `2px solid ${color}`,
          transform: selected ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        {found ? '✓' : icon || '•'}
      </span>
    </button>
  )
}

function Callout({ marker, editable, onDelete, onClose }) {
  const color = marker.type === 'hazard' ? SEVERITY_COLOR[marker.severity] || MARKER_TYPES.hazard.color : MARKER_TYPES[marker.type]?.color
  const anchorX = marker.x + (marker.w || 0) / 2
  const anchorY = marker.y + (marker.h || 0)
  // flip the card to the opposite side when the anchor is near an edge, so it stays on-screen
  const flipX = anchorX > 0.62
  const flipY = anchorY > 0.6

  return (
    <div
      className="absolute z-10 pointer-events-none"
      style={{
        left: `${anchorX * 100}%`,
        top: `${anchorY * 100}%`,
      }}
    >
      {/* leader line */}
      <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0 }} width="1" height="1">
        <line
          x1="0"
          y1="0"
          x2={flipX ? -46 : 46}
          y2={flipY ? -30 : 30}
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="3 2"
        />
        <circle cx="0" cy="0" r="3" fill={color} />
      </svg>

      <div
        className="pointer-events-auto absolute bg-steel border rounded-md shadow-xl w-60 text-left"
        style={{
          borderColor: color,
          left: flipX ? -46 - 240 : 46,
          top: flipY ? -30 - 10 : 30 - 10,
        }}
      >
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>
              {MARKER_TYPES[marker.type]?.label}
              {marker.type === 'hazard' && marker.severity ? ` · ${marker.severity}` : ''}
            </span>
          </div>
          <button onClick={onClose} className="text-concrete hover:text-chalk text-xs leading-none">
            ✕
          </button>
        </div>
        <div className="px-3 pb-3 pt-1">
          <p className="font-bold text-sm text-chalk">{marker.label || 'Untitled'}</p>
          {marker.description && <p className="text-xs text-concrete mt-1 leading-relaxed">{marker.description}</p>}
          {marker.ppeIcons?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {marker.ppeIcons.map((id) => (
                <span key={id} className="bg-steel-light border border-steel-lighter rounded px-1.5 py-0.5 text-xs" title={ppeIcon(id).label}>
                  {ppeIcon(id).emoji} <span className="font-mono text-[9px] text-concrete uppercase">{ppeIcon(id).label}</span>
                </span>
              ))}
            </div>
          )}
          {editable && onDelete && (
            <button
              onClick={() => onDelete(marker.id)}
              className="mt-3 w-full font-mono text-[10px] uppercase tracking-widest text-hazard border border-hazard/50 rounded py-1.5 hover:bg-hazard/10"
            >
              Delete marker
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

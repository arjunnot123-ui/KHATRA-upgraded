// Shared data model + persistence for the AR-style machine annotation system.
// Markers come in three flavors:
//   hazard    — a danger zone on the machine, usually drawn as a bounding box
//   ppe       — a point marker recommending protective equipment for that spot
//   component — a clickable label identifying a machine part
//
// All coordinates are normalized 0-1 (fraction of image width/height) so
// annotations survive any image resize/crop and match the pattern already
// used by HazardScan's hazard bboxes.

export const MARKER_TYPES = {
  hazard: { color: '#D93025', dim: 'rgba(217,48,37,0.18)', label: 'Hazard Zone' },
  ppe: { color: '#FFB020', dim: 'rgba(255,176,32,0.18)', label: 'PPE Required' },
  component: { color: '#5EC8E0', dim: 'rgba(94,200,224,0.18)', label: 'Component' },
}

export const SEVERITY_COLOR = { low: '#2E7D4F', medium: '#FFB020', high: '#D93025' }

// Small, dependency-free PPE icon set (emoji keeps bundle size at zero and
// renders consistently across phone browsers, which is this app's target).
export const PPE_ICONS = [
  { id: 'helmet', emoji: '⛑️', label: 'Helmet' },
  { id: 'goggles', emoji: '🥽', label: 'Eye Protection' },
  { id: 'gloves', emoji: '🧤', label: 'Gloves' },
  { id: 'mask', emoji: '😷', label: 'Respirator / Mask' },
  { id: 'earpro', emoji: '🎧', label: 'Hearing Protection' },
  { id: 'vest', emoji: '🦺', label: 'Hi-Vis Vest' },
  { id: 'boots', emoji: '🥾', label: 'Steel-Toe Boots' },
  { id: 'harness', emoji: '🪢', label: 'Fall-Arrest Harness' },
]

export function ppeIcon(id) {
  return PPE_ICONS.find((p) => p.id === id) || { id, emoji: '⚠️', label: id }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function newMarker(type, coords) {
  return {
    id: uid(),
    type,
    label: '',
    description: '',
    severity: 'medium',
    ppeIcons: [],
    ...coords,
  }
}

/**
 * Convert a combined AI response (see api.js#analyzeMachineImage) into the
 * unified marker shape the annotator renders.
 */
export function markersFromAiResult(data) {
  const markers = []
  const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0))
  const safeBox = (box) => {
    const [x0, y0, w0, h0] = Array.isArray(box) ? box : [0.1, 0.1, 0.2, 0.2]
    const x = clamp(x0)
    const y = clamp(y0)
    const w = Math.max(0.02, Math.min(1 - x, Number(w0) || 0.02))
    const h = Math.max(0.02, Math.min(1 - y, Number(h0) || 0.02))
    return [x, y, w, h]
  }
  for (const hazard of data?.hazards || []) {
    const confidence = Number(hazard.confidence ?? 100)
    if (confidence < 60) continue
    const [x, y, w, h] = safeBox(hazard.bbox)
    markers.push(
      Object.assign(newMarker('hazard', { x, y, w, h }), {
        label: hazard.label || 'Hazard',
        description: hazard.evidence ? `${hazard.description || ''} Evidence: ${hazard.evidence}`.trim() : hazard.description || '',
        severity: hazard.severity || 'medium',
        ppeIcons: hazard.ppe || hazard.ppeRecommendation || [],
        confidence,
        needsVerification: confidence < 75,
        recommendedAction: hazard.recommendedAction || '',
      })
    )
  }
  for (const p of data?.ppeRecommendations || []) {
    const [x, y] = Array.isArray(p.point) ? p.point : [0.5, 0.5]
    markers.push(Object.assign(newMarker('ppe', { x: clamp(x), y: clamp(y) }), { label: p.label || 'PPE', description: p.description || '', ppeIcons: p.icons || [] }))
  }
  for (const c of data?.components || []) {
    const [x, y] = Array.isArray(c.point) ? c.point : [0.5, 0.5]
    markers.push(Object.assign(newMarker('component', { x: clamp(x), y: clamp(y) }), { label: c.label || 'Component', description: c.description || '' }))
  }
  return markers
}

// ---- Saved inspections (localStorage gallery) ----

const INSPECTIONS_KEY = 'khatra_inspections'

export function getInspections() {
  try {
    return JSON.parse(localStorage.getItem(INSPECTIONS_KEY)) || []
  } catch {
    return []
  }
}

export function saveInspection(inspection) {
  const list = getInspections()
  const idx = list.findIndex((i) => i.id === inspection.id)
  if (idx >= 0) list[idx] = inspection
  else list.unshift(inspection)
  localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(list.slice(0, 30)))
  return list
}

export function deleteInspection(id) {
  const list = getInspections().filter((i) => i.id !== id)
  localStorage.setItem(INSPECTIONS_KEY, JSON.stringify(list))
  return list
}

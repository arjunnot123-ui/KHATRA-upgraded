# KHATRA Upgrade Notes

This build includes the controlled completion of the adaptive assessment and AI/3D improvements.

## Implemented

- Adaptive certification assessments: minimum 8, maximum 15 questions.
- Early completion requires stronger competency evidence (>=75% and at least one correct hard question).
- Assessment can continue to the maximum when more evidence is needed.
- Questions remain randomized and are never repeated within an attempt.
- Server-side grading remains authoritative.
- Assessment progress can resume after a browser refresh during the current session.
- Certification standing is driven by backend assessment results instead of local training logs.
- AI provider configuration remains server-side; frontend no longer stores provider keys.
- AI provider status now reports fallback availability.
- AI hazard/machine responses are normalized for confidence and bounding-box safety.
- Low-confidence hazards are filtered from automatic marker creation.
- Added interactive 3D machine training lab with conveyor, drill rig and crusher models.
- Added component/hazard hotspots, PPE and safe-action information.
- Added camera overlay preview labelled as Camera AR Preview. It is a camera overlay, not full spatial WebXR tracking.
- Added Text-to-3D Prompt Studio using object + style + material + shape + use case.
- Added deterministic local Text-to-3D prompt fallback when no AI provider is configured.
- Added GLB/GLTF loading support through React Three Drei when real models are supplied.
- Removed shared environment secrets from the distributable ZIP; configure `backend/.env` locally from `backend/.env.example`.

## Important

Real spatial AR tracking and production-quality photorealistic machine models still require device/WebXR support and actual GLB/GLTF assets. The included 3D lab is a richer procedural training fallback and is designed to accept real models later.

## Run

Frontend:

```cmd
npm install
npm run dev
```

Backend:

```cmd
cd server
npm install
npm start
```

Configure `backend/.env` before starting the backend.

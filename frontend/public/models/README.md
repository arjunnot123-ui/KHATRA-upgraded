# KHATRA 3D Machine Models Directory

Four locally generated `.glb` machine study models are included here. They ship
with the app, work offline, and align with the existing inspection hotspot data.
Regenerate them with `python3 scripts/build-machine-assets.py` at the project root.
The generator uses the Python standard library only.

Supported model filenames matching the machine registry:
- `conveyor.glb` — Heavy Industrial Belt Conveyor
- `drill-rig.glb` — Hydraulic Underground Mining Drill Rig
- `crusher.glb` — Heavy Primary Jaw Crusher
- `excavator.glb` — Open-Pit Mining Hydraulic Excavator

These detailed illustrated machines are training visuals, not engineering-grade
digital twins or photo scans of specific equipment. Validate component locations,
hazard procedures, and all safety instructions with a qualified site trainer.

### Fallback Architecture:
If any GLB/GLTF model file is not present in this folder or fails to load, the KHATRA 3D viewer automatically activates high-detail procedural Three.js geometry with exact hotspot positions, so the application and training flows never crash.

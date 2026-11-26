# Ryu Pet — Codex project instructions

## Goal
Build an interactive, browser-based experience that faithfully represents a particular dog ("Ryu") being petted. This is **not a game**. No scoring, locomotion, or generated novel behaviors are required.

## Guiding principles
- Distinguish **observed behavior in video** from **hypotheses** and generic dog behavior. Never invent measurements or claim that a specific stroke causes a specific reaction without evidence.
- Start with a small, validated interaction (e.g., head petting), then expand.
- Keep dog-specific appearance/response data separate from reusable rendering and input code so the approach may eventually serve other dogs.
- Prioritize naturalness, visual identity, smooth motion, and a simple mobile/desktop interface.
- Keep original photos/videos private: don't commit personal media to a public repository. Use local assets, sample/demo fixtures, and .gitignore.
- Prefer TypeScript, React, and Vite. PixiJS may be used in the petting app; Canvas is sufficient for the motion-annotation tool.
- Run type checks/build/tests when feasible and report exactly what was and wasn't verified.

## First development milestone — Motion annotation tool
Implement a browser-local tool in which a human annotates a real dog video:
1. Load a playable video locally; show a helpful message for unsupported MOV codecs.
2. Play, pause, scrub, change playback speed, and step approximately one frame with stated accuracy limits.
3. Allow manual placement of head/nose/eye/ear landmarks at chosen timestamps, including editing existing values.
4. Mark petting interval, contact region, and direction; never auto-label affection/comfort.
5. Show time-series landmarks and head-relative movement, noting that camera motion and viewpoint affect measurements.
6. Export/import versioned JSON containing video metadata, timestamps, landmark coordinates, and contact annotations.
7. Use Japanese UI labels. Start with a usable MVP, not automatic computer vision.

## Working style
- Inspect repository contents first; do not overwrite existing work.
- Deliver a working, small increment before complex model-building.
- Add a README with setup/run instructions and known limitations.
- Keep analysis tool and petting app modular and separate.

## Current priority — Interactive dog model (supersedes annotation-first order)
The owner has explicitly deprioritized manual video annotation and human-operated analysis workflows. **Build and iterate on the pettable dog model now.** Preserve the existing annotation tool, but do not extend it unless needed for later model calibration.
- Build a visible, interactive front-end prototype with modular anatomical rig and reaction engine.
- Use reference photos/videos for likeness when they are available locally. Do not claim exact resemblance from placeholders or fabricate observed reactions.
- Make the animation work without requiring the owner to label points or manually annotate clips.
- For all missing reference media, use a clearly marked provisional fallback and document where private assets should be placed (gitignored).
- Favor fast iterative visual tests, deterministic touch-to-reaction mappings, browser usability, and private asset handling.

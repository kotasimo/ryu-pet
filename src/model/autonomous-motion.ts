import { sampleTrack, type MotionLibrary, type TrackedSample } from './motion-library'
import { video003Motion, type AppearanceKey } from './video-003-motion'

export const demoDuration = video003Motion.durationSec
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const smooth = (n: number) => { const x = clamp(n, 0, 1); return x * x * (3 - 2 * x) }
const interpolate = (a: number, b: number, fraction: number) => a + (b - a) * fraction

function appearanceAt(second: number): AppearanceKey {
  const keys = video003Motion.appearance
  const right = keys.findIndex(key => key.sourceSecond >= second)
  if (right <= 0) return keys[Math.max(0, right)]
  const next = keys[right]
  const previous = keys[right - 1]
  const fraction = smooth((second - previous.sourceSecond) / (next.sourceSecond - previous.sourceSecond))
  return { sourceSecond: second, up: interpolate(previous.up, next.up, fraction),
    left: interpolate(previous.left, next.left, fraction),
    down: interpolate(previous.down, next.down, fraction), provenance: 'provisional' }
}

function observedResidual(samples: TrackedSample[], second: number) {
  if (samples.length < 4 || second < samples[0].timeSec || second > samples[samples.length - 1].timeSec) return null
  const first = sampleTrack(samples, 0)
  const span = samples[samples.length - 1].timeSec - samples[0].timeSec
  const fraction = (second - samples[0].timeSec) / span
  const last = sampleTrack(samples, span)
  const current = sampleTrack(samples, second - samples[0].timeSec)
  // Endpoint displacement is represented by the provisional pose path.
  // The measured residual preserves local timing without a jump at boundaries.
  return { sourceSecond: current.timeSec, confidence: current.confidence,
    x: current.x - interpolate(first.x, last.x, fraction),
    y: current.y - interpolate(first.y, last.y, fraction),
    roll: current.roll - interpolate(first.roll, last.roll, fraction) }
}

export function sampleAutonomousMotion(seconds: number, library: MotionLibrary) {
  const time = clamp(seconds, 0, demoDuration)
  const controls = appearanceAt(time)
  const observation = [...video003Motion.observations].reverse().find(item => item.sourceSecond <= time)!
  const measured = observedResidual(library.rise, time) ?? observedResidual(library.turn, time) ??
    observedResidual(library.returnToFront, time)
  const x = -6 * controls.left + (measured?.x ?? 0) * 180
  const y = 16 * controls.down - 13 * controls.up + (measured?.y ?? 0) * 180
  const tilt = -.025 * controls.left + (measured?.roll ?? 0) * .35
  return { time, up: controls.up, view: controls.left, down: controls.down,
    x: clamp(x, -22, 22), y: clamp(y, -18, 18), tilt: clamp(tilt, -.07, .07),
    observation, measured, appearanceProvenance: controls.provenance }
}

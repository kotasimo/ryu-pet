// Numerical tracking is loaded from ignored local assets. No source media or
// derived tracking coordinates are bundled into the public build.
export type TrackedSample = {
  timeSec: number
  confidence: number
  head: null | { xNormalized: number; yNormalized: number; rollRad: number }
}
type PrivateClip = { schemaVersion: number; clipId: string; samples: TrackedSample[] }

export type MotionLibrary = { rise: TrackedSample[]; turn: TrackedSample[]; returnToFront: TrackedSample[] }

function segment(clip: PrivateClip, start: number, end: number): TrackedSample[] {
  if (clip.schemaVersion !== 1 || !Array.isArray(clip.samples)) return []
  return clip.samples.filter(sample => sample.timeSec >= start && sample.timeSec <= end &&
    sample.confidence >= .38 && sample.head &&
    Number.isFinite(sample.head.xNormalized) && Number.isFinite(sample.head.yNormalized) &&
    Number.isFinite(sample.head.rollRad))
}

export async function loadMotionLibrary(base: string): Promise<MotionLibrary | null> {
  try {
    const [riseResponse, turnResponse, returnResponse] = await Promise.all([
      fetch(`${base}/motion-video-3-rise.json`, { cache: 'no-store' }),
      fetch(`${base}/motion-video-3.json`, { cache: 'no-store' }),
      fetch(`${base}/motion-video-3-return.json`, { cache: 'no-store' }),
    ])
    if (!turnResponse.ok || !returnResponse.ok) return null
    const rise = riseResponse.ok ? segment(await riseResponse.json() as PrivateClip, 2.6, 3.4) : []
    const turn = segment(await turnResponse.json() as PrivateClip, 3.2, 4.0)
    const returnToFront = segment(await returnResponse.json() as PrivateClip, 7.6, 9.0)
    if (turn.length < 4 || returnToFront.length < 4) return null
    return { rise, turn, returnToFront }
  } catch { return null }
}

function mix(a: number, b: number, fraction: number) { return a + (b - a) * fraction }

export function sampleTrack(samples: TrackedSample[], seconds: number) {
  const start = samples[0]
  const last = samples[samples.length - 1]
  const time = Math.min(last.timeSec, Math.max(start.timeSec, start.timeSec + seconds))
  let right = samples.findIndex(sample => sample.timeSec >= time)
  if (right < 0) right = samples.length - 1
  const next = samples[right]
  const previous = samples[Math.max(0, right - 1)]
  const fraction = next.timeSec === previous.timeSec ? 0 : (time - previous.timeSec) / (next.timeSec - previous.timeSec)
  const head = next.head!
  const before = previous.head!
  return {
    timeSec: time,
    x: mix(before.xNormalized, head.xNormalized, fraction),
    y: mix(before.yNormalized, head.yNormalized, fraction),
    roll: mix(before.rollRad, head.rollRad, fraction),
    confidence: mix(previous.confidence, next.confidence, fraction),
  }
}

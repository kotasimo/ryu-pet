import type { Zone } from './config'

type Frame = {
  second: number
  visible: string
  // Pixel translation and planar tilt are provisional 2D render values.
  // The source video does not provide these measurements or touch causality.
  x: number
  y: number
  tilt: number
}

export const observedMotion: Partial<Record<Zone, { clip: number; frames: Frame[] }>> = {
  forehead: { clip: 3, frames: [
    { second: 0, visible: '顔はやや下向き', x: 0, y: 4, tilt: 0 },
    { second: 2, visible: '頭が上がり始める', x: -2, y: -4, tilt: -.01 },
    { second: 4, visible: '画面左側へ向く', x: -10, y: -12, tilt: -.04 },
    { second: 7, visible: '横向きを保つ', x: -10, y: -12, tilt: -.04 },
    { second: 9, visible: '正面側へ戻る', x: -2, y: -3, tilt: -.01 },
    { second: 12, visible: '正面寄り', x: 0, y: 0, tilt: 0 },
    { second: 15, visible: '顔が下を向く', x: 0, y: 7, tilt: .015 },
    { second: 16, visible: '映像終了', x: 0, y: 0, tilt: 0 },
  ] },
  chin: { clip: 851, frames: [
    { second: 0, visible: '顔は横向き', x: -7, y: 0, tilt: -.025 },
    { second: 5, visible: '鼻先が上を向く', x: -7, y: -9, tilt: -.035 },
    { second: 9, visible: '大きく横向き', x: -11, y: -4, tilt: -.045 },
    { second: 13, visible: '再び斜め上を向く', x: -8, y: -9, tilt: -.03 },
    { second: 17, visible: '正面寄りになり、顔が下がる', x: -2, y: 4, tilt: -.01 },
    { second: 21, visible: '正面寄り', x: 0, y: 0, tilt: 0 },
    { second: 30, visible: '横向きに変わる', x: -8, y: 0, tilt: -.03 },
    { second: 32, visible: '映像終了', x: 0, y: 0, tilt: 0 },
  ] },
}

export function sampleObservedMotion(zone: Zone, seconds: number) {
  const frames = observedMotion[zone]?.frames
  if (!frames) return null
  if (seconds <= frames[0].second) return frames[0]
  for (let i = 1; i < frames.length; i++) {
    const next = frames[i]
    if (seconds <= next.second) {
      const previous = frames[i - 1]
      const raw = (seconds - previous.second) / (next.second - previous.second)
      const mix = raw * raw * (3 - 2 * raw)
      return {
        second: seconds,
        visible: next.visible,
        x: previous.x + (next.x - previous.x) * mix,
        y: previous.y + (next.y - previous.y) * mix,
        tilt: previous.tilt + (next.tilt - previous.tilt) * mix,
      }
    }
  }
  return frames[frames.length - 1]
}

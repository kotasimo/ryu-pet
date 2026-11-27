import { sampleTrack, type MotionLibrary } from './motion-library'

export const demoDuration = 5.8
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const smooth = (n: number) => { const x = clamp(n, 0, 1); return x * x * (3 - 2 * x) }

// Appearance (view) and observed 2D texture motion are separate. The timing
// between tracked spans is an editorial reconstruction of the visible order
// in clip 3; it is not a measured 3D yaw or a touch response.
export function sampleAutonomousMotion(seconds: number, library: MotionLibrary) {
  const time = clamp(seconds, 0, demoDuration)
  const turnAmount = smooth((time - .55) / 1.35)
  const returnAmount = smooth((time - 3.15) / 1.45)
  const view = turnAmount * (1 - returnAmount)
  const turn = library.turn
  const back = library.returnToFront
  const turnSpan = turn[turn.length - 1].timeSec - turn[0].timeSec
  const returnSpan = back[back.length - 1].timeSec - back[0].timeSec
  const first = sampleTrack(turn, 0)
  const atTurn = sampleTrack(turn, turnSpan * turnAmount)
  const endTurn = sampleTrack(turn, turnSpan)
  const atReturn = sampleTrack(back, returnSpan * returnAmount)
  const firstReturn = sampleTrack(back, 0)
  const endReturn = sampleTrack(back, returnSpan)
  const residualX = atReturn.x - (firstReturn.x + (endReturn.x - firstReturn.x) * returnAmount)
  const residualY = atReturn.y - (firstReturn.y + (endReturn.y - firstReturn.y) * returnAmount)
  const residualRoll = atReturn.roll - (firstReturn.roll + (endReturn.roll - firstReturn.roll) * returnAmount)
  const x = (atTurn.x - first.x) * 220 * (1 - returnAmount) + residualX * 220 * turnAmount
  const y = ((atTurn.y - first.y) * 220 - 6 * turnAmount) * (1 - returnAmount) + residualY * 220 * turnAmount
  const tilt = (atTurn.roll - first.roll) * (1 - returnAmount) + residualRoll * turnAmount
  return { view, x: clamp(x, -24, 24), y: clamp(y, -17, 17), tilt: clamp(tilt, -.09, .09),
    source: time < 1.9 ? 'video-3-turn' : time >= 3.15 && time <= 4.6 ? 'video-3-return' : 'interpolated-hold' }
}

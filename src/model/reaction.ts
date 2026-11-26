import type { DogModelConfig, Zone } from './config'
import { sampleObservedMotion } from './observed-motion'
import { sampleTrack, type MotionLibrary } from './motion-library'

export type Gesture = { zone: Zone; dx: number; dy: number; speed: number; holdSeconds: number }
export type Pose = {
  headX: number; headY: number; headTilt: number
  eyeLeft: number; eyeRight: number
  earLeft: number; earRight: number
  cheekLeft: number; cheekRight: number; mouth: number; breath: number
  viewBlend: number
}
type MotionKey = Exclude<keyof Pose, 'breath'>
const keys: MotionKey[] = ['headX','headY','headTilt','eyeLeft','eyeRight','earLeft','earRight','cheekLeft','cheekRight','mouth','viewBlend']
const zero = (): Pose => ({ headX: 0, headY: 0, headTilt: 0, eyeLeft: 0, eyeRight: 0, earLeft: 0, earRight: 0, cheekLeft: 0, cheekRight: 0, mouth: 0, breath: 0, viewBlend: 0 })
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class ReactionEngine {
  private pose = zero()
  private velocity = zero()
  private gesture: Gesture | null = null
  private downAt = 0
  private lastPoint = { x: 0, y: 0, at: 0 }
  private totalX = 0
  private totalY = 0
  private motionLibrary: MotionLibrary | null = null
  constructor(private readonly config: DogModelConfig) {}
  setMotionLibrary(library: MotionLibrary | null) { this.motionLibrary = library }
  get hasMeasuredMotion() { return this.motionLibrary !== null }

  begin(zone: Zone, x: number, y: number, at: number) {
    this.downAt = at
    this.lastPoint = { x, y, at }
    this.totalX = 0; this.totalY = 0
    this.gesture = { zone, dx: 0, dy: 0, speed: 0, holdSeconds: 0 }
  }
  move(x: number, y: number, at: number) {
    if (!this.gesture) return
    const elapsed = Math.max((at - this.lastPoint.at) / 1000, .008)
    const dx = x - this.lastPoint.x
    const dy = y - this.lastPoint.y
    this.totalX += dx; this.totalY += dy
    const instantaneous = Math.hypot(dx, dy) / elapsed
    this.gesture = {
      ...this.gesture,
      dx: clamp(this.totalX, -100, 100), dy: clamp(this.totalY, -100, 100),
      speed: clamp(this.gesture.speed * .7 + instantaneous * .3, 0, 900),
      holdSeconds: (at - this.downAt) / 1000,
    }
    this.lastPoint = { x, y, at }
  }
  end() { this.gesture = null }
  get activeZone() { return this.gesture?.zone ?? null }
  get gestureInfo() { return this.gesture }
  get currentPose() { return { ...this.pose } }

  update(deltaSeconds: number, nowSeconds: number): Pose {
    const dt = clamp(deltaSeconds, 0, .05)
    const target = zero()
    if (this.gesture) {
      this.gesture.holdSeconds = Math.max(0, nowSeconds - this.downAt / 1000)
      this.gesture.speed *= Math.exp(-dt * 4)
      const rule = this.config.rules[this.gesture.zone]
      const hold = clamp(this.gesture.holdSeconds / .55, .25, 1)
      const speed = clamp(this.gesture.speed / 450, .35, 1.15)
      const intensity = clamp(hold * speed, .15, 1.15)
      // The photographic mesh now carries local touch feedback. Keep the
      // whole-head motion restrained so it does not mask the local movement.
      const cheek = this.gesture.zone === 'cheekLeft' || this.gesture.zone === 'cheekRight'
      const headScale = cheek ? .22 : .55
      target.headX = rule.headX * intensity * headScale + this.gesture.dx * (cheek ? .015 : .05)
      target.headY = rule.headY * intensity * headScale + this.gesture.dy * (cheek ? .012 : .04)
      target.headTilt = rule.headTilt * intensity * headScale + this.gesture.dx * (cheek ? .00007 : .0002)
      const observed = this.gesture.zone === 'forehead' && this.motionLibrary
        ? null : sampleObservedMotion(this.gesture.zone, this.gesture.holdSeconds)
      if (observed) {
        // Preserve the visible order and approximate source-video timing.
        // Starting this sequence on touch is a provisional interaction choice.
        target.headX = observed.x
        target.headY = observed.y
        target.headTilt = observed.tilt
      }
      if (this.gesture.zone === 'forehead' && this.motionLibrary) {
        const { turn, returnToFront } = this.motionLibrary
        const turnStart = sampleTrack(turn, 0)
        const turnEndTime = turn[turn.length - 1].timeSec - turn[0].timeSec
        const turnEnd = sampleTrack(turn, turnEndTime)
        const elapsed = this.gesture.holdSeconds
        const smooth = (t: number) => { const n = clamp(t, 0, 1); return n * n * (3 - 2 * n) }
        if (elapsed < 2.3) {
          const measured = sampleTrack(turn, elapsed)
          const rise = smooth(elapsed / .75)
          target.headX = clamp((measured.x - turnStart.x) * 220, -25, 25)
          target.headY = clamp((measured.y - turnStart.y) * 220 - rise * 9, -17, 17)
          target.headTilt = clamp(measured.roll - turnStart.roll, -.1, .1)
          target.viewBlend = rise
        } else {
          const back = smooth((elapsed - 2.3) / 1.25)
          const returnSpan = returnToFront[returnToFront.length - 1].timeSec - returnToFront[0].timeSec
          const measured = sampleTrack(returnToFront, (elapsed - 2.3) / 1.25 * returnSpan)
          const returnStart = sampleTrack(returnToFront, 0)
          const returnEnd = sampleTrack(returnToFront, returnSpan)
          const residualX = (measured.x - (returnStart.x + (returnEnd.x - returnStart.x) * back)) * 220
          const residualY = (measured.y - (returnStart.y + (returnEnd.y - returnStart.y) * back)) * 220
          target.headX = clamp((turnEnd.x - turnStart.x) * 220 * (1 - back) + residualX, -25, 25)
          target.headY = clamp(((turnEnd.y - turnStart.y) * 220 - 9) * (1 - back) + residualY, -17, 17)
          target.headTilt = clamp((turnEnd.roll - turnStart.roll) * (1 - back) +
            measured.roll - (returnStart.roll + (returnEnd.roll - returnStart.roll) * back), -.1, .1)
          target.viewBlend = 1 - back
        }
      }
      target.eyeLeft = rule.eyes * intensity
      target.eyeRight = rule.eyes * intensity
      target.earLeft = rule.earLeft * intensity
      target.earRight = rule.earRight * intensity
      target.cheekLeft = rule.cheekLeft * intensity
      target.cheekRight = rule.cheekRight * intensity
      target.mouth = rule.mouth * intensity
    }
    // Deterministic, restrained idle blink. It is not a measured Ryu rhythm.
    const phase = nowSeconds % 5.7
    const blinkPhase = (phase - 5.38) / .32
    const blink = blinkPhase > 0 && blinkPhase < 1 ? Math.sin(blinkPhase * Math.PI) ** 2 * .62 : 0
    target.eyeLeft = Math.max(target.eyeLeft, blink)
    target.eyeRight = Math.max(target.eyeRight, blink)
    for (const key of keys) {
      const stiffness = key.startsWith('eye') ? 105 : 65
      const damping = key.startsWith('eye') ? 18 : 15
      this.velocity[key] += (target[key] - this.pose[key]) * stiffness * dt
      this.velocity[key] *= Math.exp(-damping * dt)
      this.pose[key] += this.velocity[key] * dt
    }
    this.pose.breath = Math.sin(nowSeconds * 2.1) * .006
    return { ...this.pose }
  }
}

import type { DogModelConfig, Zone } from './config'

export type Gesture = { zone: Zone; dx: number; dy: number; speed: number; holdSeconds: number }
export type Pose = {
  headX: number; headY: number; headTilt: number
  eyeLeft: number; eyeRight: number
  earLeft: number; earRight: number
  cheekLeft: number; cheekRight: number; mouth: number; breath: number
}
type MotionKey = Exclude<keyof Pose, 'breath'>
const keys: MotionKey[] = ['headX','headY','headTilt','eyeLeft','eyeRight','earLeft','earRight','cheekLeft','cheekRight','mouth']
const zero = (): Pose => ({ headX: 0, headY: 0, headTilt: 0, eyeLeft: 0, eyeRight: 0, earLeft: 0, earRight: 0, cheekLeft: 0, cheekRight: 0, mouth: 0, breath: 0 })
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export class ReactionEngine {
  private pose = zero()
  private velocity = zero()
  private gesture: Gesture | null = null
  private downAt = 0
  private lastPoint = { x: 0, y: 0, at: 0 }
  private totalX = 0
  private totalY = 0
  constructor(private readonly config: DogModelConfig) {}

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
      const rule = this.config.rules[this.gesture.zone]
      const hold = clamp(this.gesture.holdSeconds / .55, .25, 1)
      const speed = clamp(this.gesture.speed / 450, .35, 1.15)
      const intensity = clamp(hold * speed, .15, 1.15)
      // The photographic mesh now carries local touch feedback. Keep the
      // whole-head motion restrained so it does not mask the local movement.
      target.headX = rule.headX * intensity * .55 + this.gesture.dx * .05
      target.headY = rule.headY * intensity * .55 + this.gesture.dy * .04
      target.headTilt = rule.headTilt * intensity * .55 + this.gesture.dx * .0002
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

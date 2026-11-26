import type { Zone } from './config'

export type Point = { x: number; y: number }
type Triangle = [Point, Point, Point]
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

// These are visual, provisional parameters; no touch force was measured.
const radius: Record<Zone, number> = {
  forehead: 108, cheekLeft: 92, cheekRight: 92,
  chin: 82, earLeft: 70, earRight: 70,
}

export class SoftMeshMotion {
  center: Point = { x: 0, y: 0 }
  offset: Point = { x: 0, y: 0 }
  press = 0
  private velocity: Point = { x: 0, y: 0 }
  private pressVelocity = 0
  private target: Point = { x: 0, y: 0 }
  private trailing: Point = { x: 0, y: 0 }
  private active = false
  private zone: Zone = 'forehead'

  begin(zone: Zone, point: Point) {
    this.zone = zone
    this.center = point
    this.trailing = point
    this.target = { x: 0, y: 0 }
    this.active = true
  }

  move(point: Point) {
    if (!this.active) return
    this.center = point
  }

  end() { this.active = false; this.target = { x: 0, y: 0 } }

  update(deltaSeconds: number) {
    const dt = clamp(deltaSeconds, 0, .05)
    if (this.active) {
      // A trailing contact point makes the displacement depend on actual
      // pointer travel over time, not the browser's pointermove event rate.
      const follow = 1 - Math.exp(-dt * 7)
      this.trailing.x += (this.center.x - this.trailing.x) * follow
      this.trailing.y += (this.center.y - this.trailing.y) * follow
      this.target.x = clamp((this.center.x - this.trailing.x) * .85, -15, 15)
      this.target.y = clamp((this.center.y - this.trailing.y) * .85, -15, 15)
    }
    for (const axis of ['x', 'y'] as const) {
      this.velocity[axis] += (this.target[axis] - this.offset[axis]) * 95 * dt
      this.velocity[axis] *= Math.exp(-15 * dt)
      this.offset[axis] += this.velocity[axis] * dt
    }
    this.pressVelocity += ((this.active ? 1 : 0) - this.press) * 95 * dt
    this.pressVelocity *= Math.exp(-15 * dt)
    this.press += this.pressVelocity * dt
  }

  get strength() { return Math.abs(this.offset.x) + Math.abs(this.offset.y) + Math.abs(this.press) * 3 }
  get activeZone() { return this.active ? this.zone : null }

  displaced(point: Point): Point {
    const dx = point.x - this.center.x
    const dy = point.y - this.center.y
    const sigma = radius[this.zone]
    const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    // Press gathers nearby pixels slightly toward contact. The 15 px motion
    // cap and Gaussian edge keep photo features and silhouette intact.
    const gather = .055 * clamp(this.press, 0, 1)
    return {
      x: point.x + weight * (this.offset.x - dx * gather),
      y: point.y + weight * (this.offset.y + 3 * this.press - dy * gather),
    }
  }
}

function drawTriangle(ctx: CanvasRenderingContext2D, texture: HTMLCanvasElement, source: Triangle, dest: Triangle) {
  const [s0, s1, s2] = source
  const [d0, d1, d2] = dest
  const sx1 = s1.x - s0.x, sy1 = s1.y - s0.y
  const sx2 = s2.x - s0.x, sy2 = s2.y - s0.y
  const det = sx1 * sy2 - sx2 * sy1
  if (Math.abs(det) < .001) return
  const dx1 = d1.x - d0.x, dy1 = d1.y - d0.y
  const dx2 = d2.x - d0.x, dy2 = d2.y - d0.y
  const a = (dx1 * sy2 - dx2 * sy1) / det
  const b = (dy1 * sy2 - dy2 * sy1) / det
  const c = (dx2 * sx1 - dx1 * sx2) / det
  const d = (dy2 * sx1 - dy1 * sx2) / det
  const e = d0.x - a * s0.x - c * s0.y
  const f = d0.y - b * s0.x - d * s0.y
  const cx = (d0.x + d1.x + d2.x) / 3
  const cy = (d0.y + d1.y + d2.y) / 3
  const extend = (point: Point) => {
    const length = Math.hypot(point.x - cx, point.y - cy) || 1
    return { x: point.x + (point.x - cx) / length * .65, y: point.y + (point.y - cy) / length * .65 }
  }
  const p0 = extend(d0), p1 = extend(d1), p2 = extend(d2)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(p0.x, p0.y)
  ctx.lineTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.closePath()
  ctx.clip()
  ctx.transform(a, b, c, d, e, f)
  const minX = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - 1)
  const minY = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - 1)
  const maxX = Math.min(texture.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + 1)
  const maxY = Math.min(texture.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + 1)
  ctx.drawImage(texture, minX, minY, maxX - minX, maxY - minY, minX, minY, maxX - minX, maxY - minY)
  ctx.restore()
}

export function drawSoftMesh(ctx: CanvasRenderingContext2D, texture: HTMLCanvasElement, motion: SoftMeshMotion) {
  ctx.clearRect(0, 0, texture.width, texture.height)
  ctx.drawImage(texture, 0, 0)
  if (motion.strength < .04) return 0
  const step = 40
  const reach = 3 * 108 + step
  const x0 = Math.max(0, Math.floor((motion.center.x - reach) / step) * step)
  const y0 = Math.max(0, Math.floor((motion.center.y - reach) / step) * step)
  const x1 = Math.min(texture.width, Math.ceil((motion.center.x + reach) / step) * step)
  const y1 = Math.min(texture.height, Math.ceil((motion.center.y + reach) / step) * step)
  ctx.clearRect(x0, y0, x1 - x0, y1 - y0)
  let maxVertexDisplacement = 0
  const displaced = (point: Point) => {
    const result = motion.displaced(point)
    maxVertexDisplacement = Math.max(maxVertexDisplacement, Math.hypot(result.x - point.x, result.y - point.y))
    return result
  }
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const a = { x, y }, b = { x: Math.min(x + step, x1), y }
      const c = { x: Math.min(x + step, x1), y: Math.min(y + step, y1) }
      const d = { x, y: Math.min(y + step, y1) }
      drawTriangle(ctx, texture, [a, b, c], [displaced(a), displaced(b), displaced(c)])
      drawTriangle(ctx, texture, [a, c, d], [displaced(a), displaced(c), displaced(d)])
    }
  }
  return maxVertexDisplacement
}

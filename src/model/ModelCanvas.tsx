import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { hitTest, type DogModelConfig, type Zone } from './config'
import { ReactionEngine, type Pose } from './reaction'
import { drawSoftMesh, SoftMeshMotion, type Point } from './mesh'

type Manifest = { source_dimensions: [number, number]; layers: Record<string, { box: [number, number, number, number] }> }
type Assets = { manifest: Manifest; images: Record<string, HTMLImageElement> }
type Props = {
  config: DogModelConfig
  onZone: (zone: Zone | null) => void
  onAssets: (ready: boolean) => void
  onGesture: (text: string) => void
  engineRef: React.RefObject<ReactionEngine | null>
}
const names = ['body','head','ear_left','ear_right','eye_left','eye_right','cheek_left','cheek_right','mouth','eyelid_left','eyelid_right']

function validateAssets(manifest: Manifest, images: Record<string, HTMLImageElement>, width: number, height: number) {
  if (!Array.isArray(manifest.source_dimensions) || manifest.source_dimensions[0] !== width || manifest.source_dimensions[1] !== height) throw new Error('Source dimensions mismatch')
  for (const name of names) {
    const box = manifest.layers?.[name]?.box
    const image = images[name]
    if (!Array.isArray(box) || box.length !== 4 || !box.every(Number.isInteger) || !image) throw new Error(`Invalid layer: ${name}`)
    const [x0, y0, x1, y1] = box
    if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0 || x1 > width || y1 > height || image.naturalWidth !== x1 - x0 || image.naturalHeight !== y1 - y0) throw new Error(`Layer size mismatch: ${name}`)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Image unavailable: ${url}`))
    image.src = url
  })
}

function drawFallback(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.fillStyle = '#b9c5b6'
  ctx.beginPath(); ctx.ellipse(554, 803, 285, 330, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#aab9a6'
  ctx.beginPath(); ctx.moveTo(313, 420); ctx.lineTo(310, 165); ctx.lineTo(465, 313); ctx.fill()
  ctx.beginPath(); ctx.moveTo(798, 315); ctx.lineTo(964, 168); ctx.lineTo(929, 427); ctx.fill()
  ctx.beginPath(); ctx.ellipse(554, 520, 330, 310, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#58745f'
  ctx.font = 'bold 41px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('仮の代替表示', 554, 585)
  ctx.font = '25px sans-serif'
  ctx.fillText('写真素材を配置すると実物モデルになります', 554, 630)
  ctx.restore()
}

function drawModel(ctx: CanvasRenderingContext2D, assets: Assets, pose: Pose, motion: SoftMeshMotion, headSurface: HTMLCanvasElement, warpedSurface: HTMLCanvasElement) {
  const { manifest, images } = assets
  const headCtx = headSurface.getContext('2d')
  const warpedCtx = warpedSurface.getContext('2d')
  if (!headCtx || !warpedCtx) return 0
  const part = (name: string) => {
    const box = manifest.layers[name]?.box
    if (!box || !images[name]) return
    headCtx.drawImage(images[name], box[0], box[1], box[2] - box[0], box[3] - box[1])
  }
  const around = (x: number, y: number, angle: number, draw: () => void) => {
    headCtx.save(); headCtx.translate(x, y); headCtx.rotate(angle); headCtx.translate(-x, -y); draw(); headCtx.restore()
  }
  ctx.save()
  ctx.translate(554, 930); ctx.scale(1 + pose.breath * .35, 1 + pose.breath); ctx.translate(-554, -930)
  const bodyBox = manifest.layers.body.box
  ctx.drawImage(images.body, bodyBox[0], bodyBox[1], bodyBox[2] - bodyBox[0], bodyBox[3] - bodyBox[1])
  ctx.restore()
  headCtx.clearRect(0, 0, headSurface.width, headSurface.height)
  around(421, 359, pose.earLeft, () => part('ear_left'))
  around(822, 369, pose.earRight, () => part('ear_right'))
  part('head')
  // Keep photographed features registered to the same deforming texture.
  part('cheek_left'); part('cheek_right')
  if (pose.mouth > .025) {
    headCtx.save(); headCtx.fillStyle = `rgba(36, 27, 27, ${Math.min(.38, pose.mouth * 1.3)})`
    headCtx.beginPath(); headCtx.ellipse(574, 655, 109, 14 + pose.mouth * 28, 0, 0, Math.PI * 2); headCtx.fill(); headCtx.restore()
  }
  part('mouth')
  part('eye_left'); part('eye_right')
  headCtx.save(); headCtx.globalAlpha = Math.max(0, Math.min(1, pose.eyeLeft)); part('eyelid_left'); headCtx.restore()
  headCtx.save(); headCtx.globalAlpha = Math.max(0, Math.min(1, pose.eyeRight)); part('eyelid_right'); headCtx.restore()
  const maxVertexDisplacement = drawSoftMesh(warpedCtx, headSurface, motion)
  ctx.save()
  ctx.translate(574 + pose.headX, 616 + pose.headY)
  ctx.rotate(pose.headTilt)
  ctx.translate(-574, -616)
  ctx.drawImage(warpedSurface, 0, 0)
  ctx.restore()
  return maxVertexDisplacement
}

export default function ModelCanvas({ config, onZone, onAssets, onGesture, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [assets, setAssets] = useState<Assets | null>(null)
  const [hover, setHover] = useState<Zone | null>(null)
  const pointerId = useRef<number | null>(null)
  const softMotion = useRef(new SoftMeshMotion())
  const debugMesh = import.meta.env.DEV && new URLSearchParams(window.location.search).has('debugMesh')
  const debugEvents = useRef({ down: 0, move: 0, up: 0, last: 'none' })

  useEffect(() => {
    let live = true
    async function load() {
      try {
        const response = await fetch(`${config.assetBase}/manifest.json`, { cache: 'no-store' })
        if (!response.ok) throw new Error('manifest unavailable')
        const manifest = await response.json() as Manifest
        const images = Object.fromEntries(await Promise.all(names.map(async name => [name, await loadImage(`${config.assetBase}/${name}.png`)] as const)))
        validateAssets(manifest, images, config.sourceWidth, config.sourceHeight)
        if (live) { setAssets({ manifest, images }); onAssets(true) }
      } catch {
        if (live) { setAssets(null); onAssets(false) }
      }
    }
    void load()
    return () => { live = false }
  }, [config.assetBase, config.sourceWidth, config.sourceHeight, onAssets])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const headSurface = document.createElement('canvas')
    const warpedSurface = document.createElement('canvas')
    headSurface.width = warpedSurface.width = config.sourceWidth
    headSurface.height = warpedSurface.height = config.stageHeight
    let frame = 0
    let last = performance.now()
    const draw = (now: number) => {
      const delta = (now - last) / 1000
      const pose = engineRef.current?.update(delta, now / 1000)
      softMotion.current.update(delta)
      last = now
      ctx.clearRect(0, 0, config.sourceWidth, config.stageHeight)
      const gradient = ctx.createLinearGradient(0, 0, 0, config.stageHeight)
      gradient.addColorStop(0, '#edf2e8'); gradient.addColorStop(1, '#d5e3d6')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, config.sourceWidth, config.stageHeight)
      ctx.fillStyle = 'rgba(255,255,255,.24)'
      ctx.beginPath(); ctx.ellipse(554, 570, 430, 505, 0, 0, Math.PI * 2); ctx.fill()
      const maxVertex = assets && pose ? drawModel(ctx, assets, pose, softMotion.current, headSurface, warpedSurface) : 0
      if (!assets || !pose) drawFallback(ctx)
      if (debugMesh) {
        const motion = softMotion.current
        const data = {
          ...debugEvents.current, zone: motion.activeZone,
          center: { x: +motion.center.x.toFixed(1), y: +motion.center.y.toFixed(1) },
          offset: { x: +motion.offset.x.toFixed(2), y: +motion.offset.y.toFixed(2) },
          press: +motion.press.toFixed(3), maxVertex: +maxVertex.toFixed(2),
          head: { x: +((pose?.headX) ?? 0).toFixed(2), y: +((pose?.headY) ?? 0).toFixed(2) },
        }
        canvas.dataset.meshDiagnostics = JSON.stringify(data)
        ctx.save()
        ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(12, 12, 620, 112)
        ctx.fillStyle = '#173327'; ctx.font = '19px monospace'
        ctx.fillText(`${data.last}  zone=${data.zone ?? '-'}  down/move/up=${data.down}/${data.move}/${data.up}`, 24, 42)
        ctx.fillText(`center=${data.center.x},${data.center.y}  offset=${data.offset.x},${data.offset.y}`, 24, 73)
        ctx.fillText(`press=${data.press}  max vertex=${data.maxVertex}px`, 24, 104)
        ctx.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [assets, config.sourceWidth, config.stageHeight, engineRef, debugMesh])

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * config.sourceWidth, y: (event.clientY - rect.top) / rect.height * config.stageHeight }
  }
  function headPoint(point: Point): Point {
    const pose = engineRef.current?.currentPose
    if (!pose) return point
    const x = point.x - 574 - pose.headX
    const y = point.y - 616 - pose.headY
    const cosine = Math.cos(pose.headTilt), sine = Math.sin(pose.headTilt)
    return softMotion.current.inversePoint({ x: x * cosine + y * sine + 574, y: -x * sine + y * cosine + 616 })
  }
  function down(event: PointerEvent<HTMLCanvasElement>) {
    const p = point(event)
    const local = headPoint(p)
    const zone = hitTest(local.x, local.y, config)
    if (!zone) return
    pointerId.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    engineRef.current?.begin(zone, p.x, p.y, performance.now())
    softMotion.current.begin(zone, local)
    if (debugMesh) { debugEvents.current.down++; debugEvents.current.last = 'pointerdown'; console.debug('mesh pointerdown', zone, local) }
    onZone(zone)
    onGesture(`${config.rules[zone].label}に触れています。動きの強さ・タイミングは仮設定です。`)
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const p = point(event)
    if (pointerId.current === event.pointerId) {
      engineRef.current?.move(p.x, p.y, performance.now())
      const local = headPoint(p)
      softMotion.current.move(local)
      if (debugMesh) { debugEvents.current.move++; debugEvents.current.last = 'pointermove'; console.debug('mesh pointermove', local) }
      const gesture = engineRef.current?.gestureInfo
      if (gesture) onGesture(`${config.rules[gesture.zone].label}を撫でています · ${gesture.speed > 300 ? '速め' : 'ゆっくり'} · ${gesture.holdSeconds.toFixed(1)}秒`)
    } else { const local = headPoint(p); setHover(hitTest(local.x, local.y, config)) }
  }
  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerId.current !== event.pointerId) return
    engineRef.current?.end()
    softMotion.current.end()
    if (debugMesh) { debugEvents.current.up++; debugEvents.current.last = 'pointerup'; console.debug('mesh pointerup') }
    pointerId.current = null
    onZone(null)
    onGesture('手を離しました。自然に元の姿勢へ戻ります。')
  }
  return <canvas ref={canvasRef} className="model-canvas" width={config.sourceWidth} height={config.stageHeight}
    aria-label="りゅうを撫でるモデル。おでこ、頬、あご、耳をドラッグできます"
    data-testid="model-canvas" data-hover-zone={hover || ''}
    style={{ cursor: hover ? 'grab' : 'default', touchAction: 'none' }}
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} />
}

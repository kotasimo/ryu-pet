import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { hitTest, type DogModelConfig, type Zone } from './config'
import { ReactionEngine, type Pose } from './reaction'

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

function drawModel(ctx: CanvasRenderingContext2D, assets: Assets, pose: Pose) {
  const { manifest, images } = assets
  const part = (name: string) => {
    const box = manifest.layers[name]?.box
    if (!box || !images[name]) return
    ctx.drawImage(images[name], box[0], box[1], box[2] - box[0], box[3] - box[1])
  }
  const around = (x: number, y: number, angle: number, draw: () => void) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.translate(-x, -y); draw(); ctx.restore()
  }
  ctx.save()
  ctx.translate(554, 930); ctx.scale(1 + pose.breath * .35, 1 + pose.breath); ctx.translate(-554, -930)
  part('body')
  ctx.restore()
  ctx.save()
  ctx.translate(574 + pose.headX, 616 + pose.headY)
  ctx.rotate(pose.headTilt)
  ctx.translate(-574, -616)
  around(421, 359, pose.earLeft, () => part('ear_left'))
  around(822, 369, pose.earRight, () => part('ear_right'))
  part('head')
  // Keep photographed feature patches registered to the head texture. Moving
  // them independently exposes the same eye/cheek underneath as a ghost.
  part('cheek_left'); part('cheek_right')
  if (pose.mouth > .025) {
    ctx.save(); ctx.fillStyle = `rgba(36, 27, 27, ${Math.min(.38, pose.mouth * 1.3)})`
    ctx.beginPath(); ctx.ellipse(574, 655, 109, 14 + pose.mouth * 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  part('mouth')
  part('eye_left'); part('eye_right')
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, pose.eyeLeft)); part('eyelid_left'); ctx.restore()
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, pose.eyeRight)); part('eyelid_right'); ctx.restore()
  ctx.restore()
}

export default function ModelCanvas({ config, onZone, onAssets, onGesture, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [assets, setAssets] = useState<Assets | null>(null)
  const [hover, setHover] = useState<Zone | null>(null)
  const pointerId = useRef<number | null>(null)

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
    let frame = 0
    let last = performance.now()
    const draw = (now: number) => {
      const pose = engineRef.current?.update((now - last) / 1000, now / 1000)
      last = now
      ctx.clearRect(0, 0, config.sourceWidth, config.stageHeight)
      const gradient = ctx.createLinearGradient(0, 0, 0, config.stageHeight)
      gradient.addColorStop(0, '#edf2e8'); gradient.addColorStop(1, '#d5e3d6')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, config.sourceWidth, config.stageHeight)
      ctx.fillStyle = 'rgba(255,255,255,.24)'
      ctx.beginPath(); ctx.ellipse(554, 570, 430, 505, 0, 0, Math.PI * 2); ctx.fill()
      if (assets && pose) drawModel(ctx, assets, pose)
      else drawFallback(ctx)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [assets, config.sourceWidth, config.stageHeight, engineRef])

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * config.sourceWidth, y: (event.clientY - rect.top) / rect.height * config.stageHeight }
  }
  function down(event: PointerEvent<HTMLCanvasElement>) {
    const p = point(event)
    const zone = hitTest(p.x, p.y, config)
    if (!zone) return
    pointerId.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    engineRef.current?.begin(zone, p.x, p.y, performance.now())
    onZone(zone)
    onGesture(`${config.rules[zone].label}に触れています。動きの強さ・タイミングは仮設定です。`)
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    const p = point(event)
    if (pointerId.current === event.pointerId) {
      engineRef.current?.move(p.x, p.y, performance.now())
      const gesture = engineRef.current?.gestureInfo
      if (gesture) onGesture(`${config.rules[gesture.zone].label}を撫でています · ${gesture.speed > 300 ? '速め' : 'ゆっくり'} · ${gesture.holdSeconds.toFixed(1)}秒`)
    } else setHover(hitTest(p.x, p.y, config))
  }
  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (pointerId.current !== event.pointerId) return
    engineRef.current?.end()
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

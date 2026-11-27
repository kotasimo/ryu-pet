import { useEffect, useRef, useState } from 'react'
import { demoDuration, sampleAutonomousMotion } from './autonomous-motion'
import { loadMotionLibrary, type MotionLibrary } from './motion-library'
import './autonomous.css'

const base = '/private-assets/ryu/model-v1'
type PrivateAssets = { body: HTMLImageElement; bodyBox: [number, number, number, number]; frames: HTMLImageElement[]; motion: MotionLibrary }

function image(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const item = new Image()
    item.onload = () => resolve(item)
    item.onerror = () => reject(new Error(`Missing private image: ${url}`))
    item.src = url
  })
}

export default function AutonomousApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const assetsRef = useRef<PrivateAssets | null>(null)
  const playingRef = useRef(false)
  const speedRef = useRef(1)
  const timeRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [time, setTime] = useState(0)

  useEffect(() => {
    let live = true
    async function load() {
      try {
        const response = await fetch(`${base}/manifest.json`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Private manifest unavailable')
        const manifest = await response.json() as { layers: { body: { box: [number, number, number, number] } } }
        const motion = await loadMotionLibrary(base)
        if (!motion) throw new Error('Measured motion unavailable')
        const [body, ...frames] = await Promise.all([
          image(`${base}/body.png`),
          ...Array.from({ length: 33 }, (_, index) => image(`${base}/near_${String(index).padStart(2, '0')}.webp`)),
        ])
        if (live) { assetsRef.current = { body, bodyBox: manifest.layers.body.box, frames, motion }; setReady(true) }
      } catch {
        if (live) { assetsRef.current = null; setReady(false) }
      }
    }
    void load()
    return () => { live = false }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ctx: CanvasRenderingContext2D = context
    let frame = 0
    let previous = performance.now()
    let lastLabel = 0
    function draw(now: number) {
      const elapsed = Math.min(.05, (now - previous) / 1000)
      previous = now
      if (playingRef.current) {
        timeRef.current = Math.min(demoDuration, timeRef.current + elapsed * speedRef.current)
        if (timeRef.current >= demoDuration) { playingRef.current = false; setPlaying(false) }
      }
      if (now - lastLabel > 80) { setTime(timeRef.current); lastLabel = now }
      const width = 1108, height = 1170
      ctx.clearRect(0, 0, width, height)
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, '#edf2e8'); gradient.addColorStop(1, '#d5e3d6')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height)
      ctx.fillStyle = 'rgba(255,255,255,.24)'
      ctx.beginPath(); ctx.ellipse(554, 570, 430, 505, 0, 0, Math.PI * 2); ctx.fill()
      const assets = assetsRef.current
      if (assets) {
        const pose = sampleAutonomousMotion(timeRef.current, assets.motion)
        const [x0, y0, x1, y1] = assets.bodyBox
        ctx.drawImage(assets.body, x0, y0, x1 - x0, y1 - y0)
        const index = Math.max(0, Math.min(32, Math.round(pose.view * 32)))
        ctx.save()
        ctx.translate(574 + pose.x, 616 + pose.y)
        ctx.rotate(pose.tilt)
        ctx.translate(-574, -616)
        ctx.drawImage(assets.frames[index], 0, 0)
        ctx.restore()
        canvas!.dataset.poseDiagnostics = JSON.stringify({ time: +timeRef.current.toFixed(2), frame: index,
          view: +pose.view.toFixed(3), x: +pose.x.toFixed(2), y: +pose.y.toFixed(2),
          tilt: +pose.tilt.toFixed(3), source: pose.source, measuredMotion: true })
      } else {
        ctx.fillStyle = '#56705b'; ctx.textAlign = 'center'; ctx.font = '30px sans-serif'
        ctx.fillText('ローカル写真素材を準備してください', 554, 590)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  function toggle() {
    if (!ready) return
    if (timeRef.current >= demoDuration) timeRef.current = 0
    playingRef.current = !playingRef.current
    setPlaying(playingRef.current)
  }
  function reset() { playingRef.current = false; setPlaying(false); timeRef.current = 0; setTime(0) }
  function changeSpeed() { const next = speedRef.current === 1 ? .5 : 1; speedRef.current = next; setSpeed(next) }

  return <div className="autonomous-page">
    <header className="autonomous-header"><a href="/" className="autonomous-brand">りゅうと、ひととき。</a><a href="/analyze">動画分析ノート</a></header>
    <main className="autonomous-main">
      <p className="autonomous-eyebrow">RYU · MOTION PORTRAIT</p>
      <h1>りゅうを、見る。</h1>
      <p className="autonomous-lead">本人の写真と映像から、表情と頭の動きをつなぐ最初のモデルです。</p>
      <div className="autonomous-stage"><canvas ref={canvasRef} width={1108} height={1170} aria-label="りゅうの写真をもとにした動作モデル" data-testid="autonomous-canvas" /></div>
      <div className="autonomous-controls">
        <button className="autonomous-primary" type="button" onClick={toggle} disabled={!ready}>{playing ? '一時停止' : time >= demoDuration ? 'もう一度再生' : '再生'}</button>
        <button type="button" onClick={reset} disabled={!ready}>最初に戻す</button>
        <button type="button" onClick={changeSpeed} disabled={!ready}>速度 {speed}×</button>
        <span>{time.toFixed(1)} / {demoDuration.toFixed(1)} 秒</span>
      </div>
      <p className="autonomous-source">動画3の頭部追跡区間と、同じ撮影条件に近い実写真2枚を使用。姿勢間の補間とタイミングの接続は制作上の仮設定です。</p>
      {!ready && <p className="autonomous-missing">ローカルの非公開写真・動作データを配置すると再生できます。本番ビルドには個人素材を含めません。</p>}
    </main>
  </div>
}

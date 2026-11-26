import { useCallback, useEffect, useRef, useState } from 'react'
import ModelCanvas from './ModelCanvas'
import { ryuConfig, type Zone } from './config'
import { ReactionEngine } from './reaction'
import './model.css'

const zoneOrder: Zone[] = ['forehead', 'cheekLeft', 'cheekRight', 'chin', 'earLeft', 'earRight']

export default function ModelApp() {
  const engineRef = useRef<ReactionEngine | null>(null)
  if (!engineRef.current) engineRef.current = new ReactionEngine(ryuConfig)
  const [photoReady, setPhotoReady] = useState(false)
  const [activeZone, setActiveZone] = useState<Zone | null>(null)
  const [message, setMessage] = useState('画面のりゅうに触れて、ゆっくり撫でてみてください。')
  const timer = useRef<number | null>(null)
  const assetStatus = useCallback((ready: boolean) => setPhotoReady(ready), [])
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])

  function tryZone(zone: Zone) {
    const rect = ryuConfig.zones[zone]
    if (timer.current !== null) window.clearTimeout(timer.current)
    engineRef.current?.begin(zone, rect.x + rect.width / 2, rect.y + rect.height / 2, performance.now())
    setActiveZone(zone)
    setMessage(`${ryuConfig.rules[zone].label}の仮の反応を再生中です。画面上でも直接撫でられます。`)
    timer.current = window.setTimeout(() => {
      engineRef.current?.move(rect.x + rect.width / 2 + 35, rect.y + rect.height / 2 + 24, performance.now())
      timer.current = window.setTimeout(() => { engineRef.current?.end(); setActiveZone(null); timer.current = null }, 650)
    }, 160)
  }

  return <div className="model-page">
    <header className="model-topbar"><a className="model-brand" href="/"><span className="model-brand-icon">り</span><span><strong>りゅうと、ひととき。</strong><small>PHOTO-BASED MODEL PREVIEW</small></span></a><nav><a className="current" href="/">モデルプレビュー</a><a href="/analyze">動画分析ノート</a></nav></header>
    <main className="model-main"><div className="model-intro"><p className="model-eyebrow">A MOMENT WITH RYU</p><h1>そっと触れると、<br /><em>りゅうが動く。</em></h1><p>顔や耳、あごに触れて、指やマウスを動かしてください。実際の写真をもとにした、最初のインタラクティブモデルです。</p></div>
      <div className="model-layout"><section className="model-stage-wrap" aria-label="モデルプレビュー"><div className="model-stage-heading"><div><span className="model-live-dot" /> MODEL PREVIEW</div><span className={photoReady ? 'asset-ok' : 'asset-fallback'}>{photoReady ? 'ローカル写真素材を使用中' : '仮の代替表示 · 素材未配置'}</span></div>
        <div className="model-stage"><ModelCanvas config={ryuConfig} onZone={setActiveZone} onAssets={assetStatus} onGesture={setMessage} engineRef={engineRef} /><div className="model-stage-caption"><span>✦</span> 顔の上でゆっくりドラッグ</div></div>
        <div className="model-stage-footer"><span className="model-private">🔒 写真・動画はローカルに保存</span><span>マウス・タッチ対応</span></div>
      </section>
      <aside className="model-sidebar"><section className="model-card"><p className="model-card-kicker">HOW TO PET</p><h2>どこを撫でる？</h2><p>写真の上を直接撫でるか、下の部位を押して反応を試せます。</p><div className="model-zone-grid">{zoneOrder.map(zone => <button type="button" key={zone} className={activeZone === zone ? 'active' : ''} onClick={() => tryZone(zone)}><span>{zone === 'forehead' ? '◉' : zone === 'chin' ? '⌄' : zone.startsWith('ear') ? '⌃' : '◌'}</span>{ryuConfig.rules[zone].label}</button>)}</div></section>
        <section className="model-card model-response"><p className="model-card-kicker">CURRENT RESPONSE</p><h2>今の反応</h2><p className="model-message" role="status">{message}</p>{activeZone && <p className="model-observation">{ryuConfig.rules[activeZone].observation}</p>}<div className="model-provisional"><span>仮</span><p>動きの種類は手元の動画を参考にしています。撫で方との対応、量、タイミングはまだ測定していない仮設定です。</p></div></section>
        <section className="model-card model-note"><p className="model-card-kicker">ABOUT THIS MODEL</p><h2>写真から生まれた、最初の形</h2><p>顔の毛色や模様を保つため、実物写真から切り出したレイヤーを重ねています。耳・目・頬・口元は別々に動きます。</p><p>切り抜き境界や横向きの立体感には、まだ改善の余地があります。</p></section>
      </aside></div>
      <div className="model-bottom-note"><span>◌</span><div><strong>ゆっくり、少しずつ。</strong><p>このプレビューは制作途中です。りゅうらしさを確認しながら、見た目と動きの調整を重ねます。</p></div></div>
    </main><footer className="model-footer">RYU · INTERACTIVE PORTRAIT PROTOTYPE</footer>
  </div>
}

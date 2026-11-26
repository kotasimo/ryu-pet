import { useEffect, useRef, useState } from 'react'
import { colors, emptyAnnotation, labels, landmarks, parseAnnotation, roundTime, type Annotation, type Landmark, type Point } from './data'

const timeLabel = (value: number) => `${value.toFixed(2)}秒`
const percent = (value: number) => `${(value * 100).toFixed(1)}%`

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [data, setData] = useState<Annotation>(emptyAnnotation)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [active, setActive] = useState<Landmark>('headTop')
  const [region, setRegion] = useState('頭')
  const [direction, setDirection] = useState('上から下')
  const [note, setNote] = useState('')
  const [start, setStart] = useState<number | null>(null)
  const [end, setEnd] = useState<number | null>(null)
  const [chartPoint, setChartPoint] = useState<Landmark>('nose')
  const [chartMode, setChartMode] = useState<'x' | 'y' | 'relative'>('relative')
  const [message, setMessage] = useState('動画はブラウザ内だけで開きます。サーバーへ送信しません。')

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])
  const current = data.samples.find(s => Math.abs(s.time - roundTime(time)) < 0.016)

  function openVideo(file?: File) {
    if (!file) return
    if (!/\.(mp4|mov)$/i.test(file.name) && !['video/mp4', 'video/quicktime'].includes(file.type)) {
      setMessage('MP4 または MOV ファイルを選んでください。')
      return
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const nextUrl = URL.createObjectURL(file)
    urlRef.current = nextUrl
    setUrl(nextUrl)
    setTime(0)
    setPlaying(false)
    setStart(null)
    setEnd(null)
    setData({ ...emptyAnnotation(), video: { name: file.name, type: file.type, size: file.size, duration: 0, width: 0, height: 0 } })
    setMessage('動画を読み込み中です。')
  }
  function seek(next: number) {
    const video = videoRef.current
    if (!video) return
    const clamped = Math.max(0, Math.min(next, Number.isFinite(video.duration) ? video.duration : next))
    video.currentTime = clamped
    setTime(clamped)
  }
  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play().catch(() => setMessage('動画を再生できません。形式やコーデックを確認してください。'))
    else video.pause()
  }
  function placePoint(event: React.MouseEvent<SVGSVGElement>) {
    if (!url) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point: Point = { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
    const at = roundTime(time)
    setData(previous => {
      const samples = [...previous.samples]
      const index = samples.findIndex(s => Math.abs(s.time - at) < 0.016)
      if (index < 0) samples.push({ time: at, points: { [active]: point } })
      else samples[index] = { ...samples[index], points: { ...samples[index].points, [active]: point } }
      samples.sort((a, b) => a.time - b.time)
      return { ...previous, samples }
    })
    setMessage(`${timeLabel(at)} の${labels[active]}を記録しました。`)
  }
  function removePoint(key: Landmark) {
    const at = current?.time
    if (at === undefined) return
    setData(previous => ({ ...previous, samples: previous.samples.map(s => s.time === at ? { ...s, points: Object.fromEntries(Object.entries(s.points).filter(([name]) => name !== key)) } : s).filter(s => Object.keys(s.points).length) }))
  }
  function addContact() {
    if (start === null || end === null) { setMessage('動画上の時刻で開始と終了を記録してください。'); return }
    if (end <= start) { setMessage('終了時刻は開始時刻より後にしてください。'); return }
    setData(previous => ({ ...previous, contacts: [...previous.contacts, { id: crypto.randomUUID(), start, end, region, direction, note: note.trim() }].sort((a, b) => a.start - b.start) }))
    setStart(null); setEnd(null); setNote('')
    setMessage('撫でた区間を記録しました。反応との因果関係は記録していません。')
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const href = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `${data.video.name.replace(/\.[^.]+$/, '') || 'video'}.annotation.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  }
  async function importJson(file?: File) {
    if (!file) return
    try {
      const imported = parseAnnotation(JSON.parse(await file.text()))
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = null; setUrl(null); setPlaying(false); setTime(0)
      setData(imported)
      setMessage(`JSONを読み込みました。映像を確認するには「${imported.video.name}」を再度選んでください。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'JSONを読み込めませんでした。') }
    if (importRef.current) importRef.current.value = ''
  }
  function relinkVideo(file?: File) {
    if (!file) return
    if (data.video.name && file.name !== data.video.name) { setMessage(`記録された動画「${data.video.name}」とファイル名が違います。`); return }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const next = URL.createObjectURL(file)
    urlRef.current = next; setUrl(next); setMessage('動画を再接続しました。記録済みデータを表示できます。')
  }
  const chartValues = data.samples.map(sample => {
    const p = sample.points[chartPoint]
    const head = sample.points.headTop
    const value = chartMode === 'relative' ? p && head ? Math.hypot(p.x - head.x, p.y - head.y) : undefined : p?.[chartMode]
    return value === undefined ? null : { time: sample.time, value }
  }).filter((v): v is { time: number; value: number } => v !== null)
  const chartMax = Math.max(data.video.duration || 0, ...data.samples.map(s => s.time), 1)
  const chartPath = chartValues.map((p, i) => `${i ? 'L' : 'M'} ${40 + p.time / chartMax * 520} ${170 - Math.min(p.value, 1) * 140}`).join(' ')

  return <div className="app">
    <header className="topbar"><div className="brand"><span className="brand-mark">り</span><div><strong>りゅう 動画分析ノート</strong><small>触れ方と動きを、観察したまま記録する</small></div></div><span className="version">MVP · v1</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">MOTION ANNOTATION</p><h1>りゅうの動きを、<br /><em>一つずつ記録する。</em></h1><p>動画の時刻を選び、特徴点と撫でた区間を手で記録します。推測した感情や因果関係は付けません。</p></div><div className="file-actions"><input ref={fileRef} type="file" accept=".mp4,.mov,video/mp4,video/quicktime" hidden onChange={e => { if (data.samples.length || data.contacts.length) relinkVideo(e.target.files?.[0]); else openVideo(e.target.files?.[0]); e.currentTarget.value = '' }} /><button className="primary" onClick={() => fileRef.current?.click()}>{data.video.name ? '動画を再接続' : '動画を開く'}</button>{data.video.name && <button onClick={() => { setData(emptyAnnotation()); setUrl(null); if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = null; setTimeout(() => fileRef.current?.click(), 0) }}>新しい分析を始める</button>}<span>MP4 / 再生可能な MOV</span></div></section>
      <p className="status" role="status">{message}</p>
      <div className="workspace"><section className="panel video-panel"><div className="panel-heading"><div><span className="step">01</span><h2>動画を観察</h2></div><span className="muted">{data.video.name || '動画未選択'}</span></div>
        <div className="stage" style={data.video.width && data.video.height ? { aspectRatio: `${data.video.width}/${data.video.height}` } : undefined}>
          {url ? <><video ref={videoRef} src={url} playsInline onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onLoadedMetadata={e => { const v = e.currentTarget; v.playbackRate = speed; setData(previous => ({ ...previous, video: { ...previous.video, duration: v.duration, width: v.videoWidth, height: v.videoHeight } })); setMessage('動画を読み込みました。時刻を選んで特徴点を置いてください。') }} onError={() => setMessage('この動画を再生できません。MOV はブラウザが対応するコーデックで保存されている必要があります。MP4 (H.264) への変換を試してください。')} /><svg className="point-layer" viewBox="0 0 100 100" preserveAspectRatio="none" onClick={placePoint} aria-label="特徴点を配置">{landmarks.map(key => current?.points[key] && <g key={key} transform={`translate(${current.points[key]!.x * 100} ${current.points[key]!.y * 100})`}><circle r="1.6" fill={colors[key]} stroke="white" strokeWidth=".35" vectorEffect="non-scaling-stroke" /><text y="-2.4" textAnchor="middle" fill="white" fontSize="2.5" paintOrder="stroke" stroke="#24312d" strokeWidth=".5">{labels[key]}</text></g>)}</svg></> : <div className="empty-stage"><span>✦</span><strong>ここに動画が表示されます</strong><p>ローカルの動画を選択してください</p></div>}
        </div>
        <div className="controls"><button onClick={togglePlay} disabled={!url}>{playing ? '停止' : '再生'}</button><button onClick={() => seek(time - 1 / 30)} disabled={!url} title="約1/30秒戻す">− 1コマ</button><button onClick={() => seek(time + 1 / 30)} disabled={!url} title="約1/30秒進める">＋ 1コマ</button><span className="time">{timeLabel(time)} / {timeLabel(data.video.duration)}</span><select value={speed} aria-label="再生速度" onChange={e => { const next = Number(e.target.value); setSpeed(next); if (videoRef.current) videoRef.current.playbackRate = next }}><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></div>
        <input className="timeline" aria-label="再生位置" type="range" min="0" max={data.video.duration || 1} step="0.001" value={Math.min(time, data.video.duration || 1)} disabled={!url} onChange={e => seek(Number(e.target.value))} /><p className="hint">コマ送りは約1/30秒のシークです。実際の表示フレームは動画のフレームレートとブラウザのデコードに左右されます。</p>
      </section>
      <aside className="side"><section className="panel"><div className="panel-heading"><div><span className="step">02</span><h2>特徴点を置く</h2></div><span className="muted">{timeLabel(time)}</span></div><p className="hint">部位を選び、動画上の位置をクリック。 同じ時刻・部位をクリックすると更新します。</p><div className="landmark-grid">{landmarks.map(key => <button key={key} className={active === key ? 'selected' : ''} onClick={() => setActive(key)}><i style={{ background: colors[key] }} />{labels[key]}</button>)}</div><div className="current-points"><strong>この時刻の記録</strong>{landmarks.map(key => <div key={key}><span>{labels[key]}</span><span>{current?.points[key] ? `${percent(current.points[key]!.x)}, ${percent(current.points[key]!.y)}` : '—'}</span><button disabled={!current?.points[key]} onClick={() => removePoint(key)} aria-label={`${labels[key]}を削除`}>×</button></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><div><span className="step">03</span><h2>撫でた区間</h2></div></div><div className="interval-buttons"><button onClick={() => setStart(roundTime(time))} disabled={!url}>開始を記録</button><button onClick={() => setEnd(roundTime(time))} disabled={!url}>終了を記録</button></div><p className="interval-value">開始 {start === null ? '—' : timeLabel(start)}　→　終了 {end === null ? '—' : timeLabel(end)}</p><div className="form-row"><label>接触部位<select value={region} onChange={e => setRegion(e.target.value)}><option>頭</option><option>左頬</option><option>右頬</option><option>顎</option><option>耳周辺</option><option>その他</option></select></label><label>方向<select value={direction} onChange={e => setDirection(e.target.value)}><option>上から下</option><option>下から上</option><option>左から右</option><option>右から左</option><option>円を描く</option><option>静止</option><option>その他</option></select></label></div><label className="note-label">観察メモ<input value={note} onChange={e => setNote(e.target.value)} placeholder="見えたことだけを書く" /></label><button className="secondary" onClick={addContact}>区間を追加</button></section></aside></div>
      <section className="panel results"><div className="panel-heading"><div><span className="step">04</span><h2>記録を確認</h2></div><span className="muted">特徴点 {data.samples.length} 時刻 · 区間 {data.contacts.length} 件</span></div><div className="result-grid"><div><h3>特徴点の時系列</h3><div className="chart-controls"><select value={chartPoint} onChange={e => setChartPoint(e.target.value as Landmark)} aria-label="グラフの特徴点">{landmarks.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><select value={chartMode} onChange={e => setChartMode(e.target.value as typeof chartMode)} aria-label="グラフの測定値"><option value="relative">頭頂部との距離</option><option value="x">横位置</option><option value="y">縦位置</option></select></div><div className="chart"><svg viewBox="0 0 600 200" role="img" aria-label="特徴点の時系列グラフ"><path d="M40 30 V170 H560" className="axis" /><path d={chartPath} className="line" />{chartValues.map((p, i) => <circle key={i} cx={40 + p.time / chartMax * 520} cy={170 - Math.min(p.value, 1) * 140} r="3.5" className="dot" />)}<text x="40" y="190">0秒</text><text x="560" y="190" textAnchor="end">{timeLabel(chartMax)}</text><text x="44" y="24">正規化座標</text></svg>{!chartValues.length && <span className="chart-empty">2点以上を記録すると変化が見やすくなります</span>}</div><p className="hint">座標は映像内の比率です。頭頂部との距離もカメラ移動、顔の向き、遠近の影響を受けます。</p></div><div><h3>記録一覧</h3><div className="table-wrap"><table><thead><tr><th>時刻</th>{landmarks.map(key => <th key={key}>{labels[key]}</th>)}<th></th></tr></thead><tbody>{data.samples.map(sample => <tr key={sample.time}><td><button className="link-button" onClick={() => seek(sample.time)}>{timeLabel(sample.time)}</button></td>{landmarks.map(key => <td key={key}>{sample.points[key] ? `${percent(sample.points[key]!.x)} / ${percent(sample.points[key]!.y)}` : '—'}</td>)}<td><button className="link-button danger" onClick={() => setData(previous => ({ ...previous, samples: previous.samples.filter(s => s.time !== sample.time) }))}>削除</button></td></tr>)}</tbody></table>{!data.samples.length && <p className="empty-list">まだ特徴点はありません。</p>}</div><h3>撫でた区間</h3><div className="contact-list">{data.contacts.map(contact => <div key={contact.id}><span>{timeLabel(contact.start)} – {timeLabel(contact.end)}</span><strong>{contact.region} · {contact.direction}</strong><small>{contact.note}</small><button className="link-button danger" onClick={() => setData(previous => ({ ...previous, contacts: previous.contacts.filter(c => c.id !== contact.id) }))}>削除</button></div>)}{!data.contacts.length && <p className="empty-list">まだ区間はありません。</p>}</div></div></div></section>
      <section className="export-panel"><div><p className="eyebrow">SAVE YOUR WORK</p><h2>記録を JSON で保存</h2><p>動画そのものは含まれません。再読み込み後は同じ動画ファイルを選択してください。</p></div><div><input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => void importJson(e.target.files?.[0])} /><button onClick={() => importRef.current?.click()}>JSONを読み込む</button><button className="primary" onClick={exportJson} disabled={!data.samples.length && !data.contacts.length}>JSONを書き出す</button></div></section>
    </main><footer>りゅう 動画分析ノート · 観察記録用ツール</footer>
  </div>
}

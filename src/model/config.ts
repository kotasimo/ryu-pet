export type Zone = 'forehead' | 'cheekLeft' | 'cheekRight' | 'chin' | 'earLeft' | 'earRight'

export type Rule = {
  label: string
  status: '仮'
  headX: number
  headY: number
  headTilt: number
  eyes: number
  earLeft: number
  earRight: number
  cheekLeft: number
  cheekRight: number
  mouth: number
  observation: string
}

export type Rect = { x: number; y: number; width: number; height: number }
export type DogModelConfig = {
  name: string
  assetBase: string
  sourceWidth: number
  sourceHeight: number
  stageHeight: number
  zones: Record<Zone, Rect>
  rules: Record<Zone, Rule>
}

// Coordinates align with the locally prepared reference photo. All response
// amplitudes/timing are provisional; selected footage establishes movement
// types only, not a measured touch-to-motion mapping. Forehead and chin head
// values are superseded by the qualitative timeline in observed-motion.ts.
export const ryuConfig: DogModelConfig = {
  name: 'りゅう',
  assetBase: '/private-assets/ryu/model-v1',
  sourceWidth: 1108,
  sourceHeight: 1478,
  stageHeight: 1170,
  zones: {
    forehead: { x: 470, y: 248, width: 290, height: 160 },
    cheekLeft: { x: 336, y: 444, width: 200, height: 255 },
    cheekRight: { x: 632, y: 445, width: 213, height: 255 },
    chin: { x: 441, y: 641, width: 293, height: 211 },
    earLeft: { x: 280, y: 125, width: 202, height: 282 },
    earRight: { x: 742, y: 142, width: 242, height: 276 },
  },
  rules: {
    forehead: { label: 'おでこ', status: '仮', headX: -10, headY: -13, headTilt: -0.055, eyes: .42, earLeft: .015, earRight: -.018, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '動画3で見える頭の上昇→画面左→正面→下向きの順序と概略時刻を参考にしています。接触との因果・描画量は仮です。' },
    cheekLeft: { label: '左の頬', status: '仮', headX: 12, headY: -3, headTilt: .044, eyes: .25, earLeft: -.065, earRight: .025, cheekLeft: 6, cheekRight: 0, mouth: .05, observation: '頬単独の反応は未確認。仮の動き。' },
    cheekRight: { label: '右の頬', status: '仮', headX: -12, headY: -3, headTilt: -.044, eyes: .25, earLeft: -.025, earRight: .065, cheekLeft: 0, cheekRight: -6, mouth: .05, observation: '頬単独の反応は未確認。仮の動き。' },
    chin: { label: 'あごの下', status: '仮', headX: 0, headY: -16, headTilt: .02, eyes: .19, earLeft: .018, earRight: -.018, cheekLeft: 0, cheekRight: 0, mouth: .12, observation: '動画851で見える横向き→上向き→正面寄りの順序と概略時刻を参考にしています。接触との因果・描画量は仮です。' },
    earLeft: { label: '左の耳', status: '仮', headX: 2, headY: 0, headTilt: .012, eyes: .12, earLeft: -.125, earRight: 0, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '耳への接触反応は未確認。仮の動き。' },
    earRight: { label: '右の耳', status: '仮', headX: -2, headY: 0, headTilt: -.012, eyes: .12, earLeft: 0, earRight: .125, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '耳への接触反応は未確認。仮の動き。' },
  },
}

export function hitTest(x: number, y: number, config: DogModelConfig): Zone | null {
  // The photo's ears are triangular; rectangular hit boxes included large
  // areas of background and could keep an ear selected over the cheek.
  const ears: Record<'earLeft' | 'earRight', [number, number][]> = {
    earLeft: [[292,148],[312,126],[347,138],[408,192],[459,294],[458,368],[398,393],[337,364],[304,307]],
    earRight: [[756,334],[790,272],[845,202],[920,164],[971,177],[974,238],[947,317],[905,390],[833,393]],
  }
  const inPolygon = (points: [number, number][]) => {
    let inside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i], [xj, yj] = points[j]
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  for (const zone of ['earLeft', 'earRight'] as const) if (inPolygon(ears[zone])) return zone
  // Ellipses follow the soft facial areas and avoid background at box corners.
  for (const zone of ['chin', 'cheekLeft', 'cheekRight', 'forehead'] as Zone[]) {
    const bounds = config.zones[zone]
    const dx = (x - bounds.x - bounds.width / 2) / (bounds.width / 2)
    const dy = (y - bounds.y - bounds.height / 2) / (bounds.height / 2)
    if (dx * dx + dy * dy <= 1) return zone
  }
  return null
}

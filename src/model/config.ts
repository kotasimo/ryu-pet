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
// types only, not a measured touch-to-motion mapping.
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
    forehead: { label: 'おでこ', status: '仮', headX: -10, headY: -13, headTilt: -0.055, eyes: .42, earLeft: .015, earRight: -.018, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '頭頂への接触中、頭が上がり左を向いて戻る映像を参照。時間と原因は未測定。' },
    cheekLeft: { label: '左の頬', status: '仮', headX: 12, headY: -3, headTilt: .044, eyes: .25, earLeft: -.065, earRight: .025, cheekLeft: 6, cheekRight: 0, mouth: .05, observation: '頬単独の反応は未確認。仮の動き。' },
    cheekRight: { label: '右の頬', status: '仮', headX: -12, headY: -3, headTilt: -.044, eyes: .25, earLeft: -.025, earRight: .065, cheekLeft: 0, cheekRight: -6, mouth: .05, observation: '頬単独の反応は未確認。仮の動き。' },
    chin: { label: 'あごの下', status: '仮', headX: 0, headY: -16, headTilt: .02, eyes: .19, earLeft: .018, earRight: -.018, cheekLeft: 0, cheekRight: 0, mouth: .12, observation: '首・顎下への接触中に顔向きが変わる映像を参照。時間と原因は未測定。' },
    earLeft: { label: '左の耳', status: '仮', headX: 2, headY: 0, headTilt: .012, eyes: .12, earLeft: -.125, earRight: 0, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '耳への接触反応は未確認。仮の動き。' },
    earRight: { label: '右の耳', status: '仮', headX: -2, headY: 0, headTilt: -.012, eyes: .12, earLeft: 0, earRight: .125, cheekLeft: 0, cheekRight: 0, mouth: 0, observation: '耳への接触反応は未確認。仮の動き。' },
  },
}

export function hitTest(x: number, y: number, config: DogModelConfig): Zone | null {
  // Smaller features take precedence where hit regions overlap.
  for (const zone of ['earLeft', 'earRight', 'chin', 'cheekLeft', 'cheekRight', 'forehead'] as Zone[]) {
    const bounds = config.zones[zone]
    if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) return zone
  }
  return null
}

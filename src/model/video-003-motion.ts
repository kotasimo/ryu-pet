// Dog-specific motion definition. Visual observations and render controls are
// separate; none of these controls is a measured yaw or pitch angle.
export type VisiblePhase = 'down' | 'rise' | 'left-hold' | 'return' | 'settle'
export type Observation = {
  sourceSecond: number
  phase: VisiblePhase
  visible: string
  provenance: 'observed'
  confidence: 'limited' | 'moderate'
}
export type AppearanceKey = {
  sourceSecond: number
  up: number
  left: number
  down: number
  provenance: 'provisional'
}

export const video003Motion = {
  id: 'video-003',
  durationSec: 16.17,
  observations: [
    { sourceSecond: 0, phase: 'down', visible: '頭と鼻先が下向き。頭頂と胴体に手', provenance: 'observed', confidence: 'limited' },
    { sourceSecond: 2, phase: 'rise', visible: '頭が上がり始める。動きブレあり', provenance: 'observed', confidence: 'limited' },
    { sourceSecond: 3, phase: 'rise', visible: '鼻先が上がり、正面から少し斜め', provenance: 'observed', confidence: 'moderate' },
    { sourceSecond: 4, phase: 'left-hold', visible: '画面左へ向く', provenance: 'observed', confidence: 'moderate' },
    { sourceSecond: 7, phase: 'left-hold', visible: '左向き姿勢を保つ', provenance: 'observed', confidence: 'moderate' },
    { sourceSecond: 8, phase: 'return', visible: '正面へ戻り始める', provenance: 'observed', confidence: 'moderate' },
    { sourceSecond: 10, phase: 'return', visible: '正面寄りで目が細く見える', provenance: 'observed', confidence: 'limited' },
    { sourceSecond: 13, phase: 'settle', visible: '顔が下がり始める', provenance: 'observed', confidence: 'moderate' },
    { sourceSecond: 15, phase: 'down', visible: '鼻先が下を向く', provenance: 'observed', confidence: 'moderate' },
  ] as Observation[],
  // Fit-to-photo controls inferred from the above seconds, not measurements.
  appearance: [
    { sourceSecond: 0, up: 0, left: 0, down: .65, provenance: 'provisional' },
    { sourceSecond: 1, up: 0, left: 0, down: .55, provenance: 'provisional' },
    { sourceSecond: 2, up: 0, left: 0, down: .18, provenance: 'provisional' },
    { sourceSecond: 2.3, up: 0, left: 0, down: 0, provenance: 'provisional' },
    { sourceSecond: 3, up: .9, left: 0, down: 0, provenance: 'provisional' },
    { sourceSecond: 3.5, up: 0, left: 0, down: 0, provenance: 'provisional' },
    { sourceSecond: 4.3, up: 0, left: .9, down: 0, provenance: 'provisional' },
    { sourceSecond: 5, up: 0, left: 1, down: 0, provenance: 'provisional' },
    { sourceSecond: 7, up: 0, left: 1, down: 0, provenance: 'provisional' },
    { sourceSecond: 8, up: 0, left: .8, down: 0, provenance: 'provisional' },
    { sourceSecond: 9, up: 0, left: .3, down: 0, provenance: 'provisional' },
    { sourceSecond: 10, up: 0, left: 0, down: 0, provenance: 'provisional' },
    { sourceSecond: 12, up: 0, left: 0, down: 0, provenance: 'provisional' },
    { sourceSecond: 13, up: 0, left: 0, down: .2, provenance: 'provisional' },
    { sourceSecond: 15, up: 0, left: 0, down: .65, provenance: 'provisional' },
    { sourceSecond: 16.17, up: 0, left: 0, down: .65, provenance: 'provisional' },
  ] as AppearanceKey[],
} as const

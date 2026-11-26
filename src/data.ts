export const landmarks = ['headTop', 'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar'] as const
export type Landmark = typeof landmarks[number]
export type Point = { x: number; y: number }
export type Sample = { time: number; points: Partial<Record<Landmark, Point>> }
export type Contact = { id: string; start: number; end: number; region: string; direction: string; note: string }
export type Annotation = {
  version: 1
  video: { name: string; type: string; size: number; duration: number; width: number; height: number }
  samples: Sample[]
  contacts: Contact[]
}
export const labels: Record<Landmark, string> = {
  headTop: '頭頂部', nose: '鼻', leftEye: '左目', rightEye: '右目', leftEar: '左耳', rightEar: '右耳'
}
export const colors: Record<Landmark, string> = {
  headTop: '#f5a623', nose: '#e45b4b', leftEye: '#79bf76', rightEye: '#47a9a0', leftEar: '#8d72c7', rightEar: '#d477a7'
}
export function emptyAnnotation(): Annotation {
  return { version: 1, video: { name: '', type: '', size: 0, duration: 0, width: 0, height: 0 }, samples: [], contacts: [] }
}
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const point = (value: unknown): value is Point => {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return number(p.x) && number(p.y) && (p.x as number) >= 0 && (p.x as number) <= 1 && (p.y as number) >= 0 && (p.y as number) <= 1
}
export function parseAnnotation(value: unknown): Annotation {
  if (!value || typeof value !== 'object') throw new Error('JSONの形式が正しくありません。')
  const a = value as Record<string, unknown>
  if (a.version !== 1) throw new Error('対応していないJSONバージョンです。')
  const video = a.video as Record<string, unknown> | undefined
  if (!video || typeof video.name !== 'string' || typeof video.type !== 'string' || !number(video.size) || !number(video.duration) || !number(video.width) || !number(video.height)) throw new Error('動画情報が正しくありません。')
  if (!Array.isArray(a.samples) || !a.samples.every((s: unknown) => {
    if (!s || typeof s !== 'object') return false
    const sample = s as Record<string, unknown>
    return number(sample.time) && (sample.time as number) >= 0 && sample.points && typeof sample.points === 'object' &&
      Object.entries(sample.points).every(([key, value]) => landmarks.includes(key as Landmark) && point(value))
  })) throw new Error('特徴点データが正しくありません。')
  if (!Array.isArray(a.contacts) || !a.contacts.every((c: unknown) => {
    if (!c || typeof c !== 'object') return false
    const contact = c as Record<string, unknown>
    return typeof contact.id === 'string' && number(contact.start) && number(contact.end) && (contact.start as number) <= (contact.end as number) && typeof contact.region === 'string' && typeof contact.direction === 'string' && typeof contact.note === 'string'
  })) throw new Error('撫でた区間のデータが正しくありません。')
  return value as Annotation
}
export const roundTime = (time: number) => Math.round(time * 1000) / 1000

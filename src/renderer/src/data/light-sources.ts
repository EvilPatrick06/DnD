export interface LightSourceDef {
  durationSeconds: number
  brightRadius: number
  dimRadius: number
}

export const LIGHT_SOURCES: Record<string, LightSourceDef> = {
  torch: { durationSeconds: 3600, brightRadius: 20, dimRadius: 40 },
  'lantern-hooded': { durationSeconds: 21600, brightRadius: 30, dimRadius: 60 },
  'lantern-bullseye': { durationSeconds: 21600, brightRadius: 60, dimRadius: 120 },
  candle: { durationSeconds: 3600, brightRadius: 5, dimRadius: 10 },
  'light-cantrip': { durationSeconds: 3600, brightRadius: 20, dimRadius: 40 },
  'continual-flame': { durationSeconds: Infinity, brightRadius: 20, dimRadius: 40 },
  'daylight-spell': { durationSeconds: 3600, brightRadius: 60, dimRadius: 120 },
  lamp: { durationSeconds: 21600, brightRadius: 15, dimRadius: 45 },
  'dancing-lights': { durationSeconds: 60, brightRadius: 10, dimRadius: 10 }
}

export const LIGHT_SOURCE_LABELS: Record<string, string> = {
  torch: 'Torch',
  'lantern-hooded': 'Lantern (Hooded)',
  'lantern-bullseye': 'Lantern (Bullseye)',
  candle: 'Candle',
  'light-cantrip': 'Light (Cantrip)',
  'continual-flame': 'Continual Flame',
  'daylight-spell': 'Daylight (Spell)',
  lamp: 'Lamp',
  'dancing-lights': 'Dancing Lights'
}

// DMG 2024 inspired weather generation — random weather by climate and season
// with mechanical effects per DMG environmental hazards.

export type Climate = 'arctic' | 'temperate' | 'tropical' | 'desert' | 'coastal'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type TemperatureLevel = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot' | 'extreme-heat'
export type WindLevel = 'calm' | 'light' | 'moderate' | 'strong' | 'severe'
export type PrecipitationLevel = 'none' | 'light' | 'heavy'

export interface WeatherConditions {
  temperature: TemperatureLevel
  temperatureFahrenheit: number
  wind: WindLevel
  precipitation: PrecipitationLevel
  description: string
  mechanicalEffects: string[]
  preset: string
}

// ---- Temperature Ranges (°F) -----------------------------------------------

const TEMP_RANGES: Record<TemperatureLevel, { min: number; max: number }> = {
  'freezing': { min: -20, max: 20 },
  'cold': { min: 20, max: 40 },
  'mild': { min: 40, max: 65 },
  'warm': { min: 65, max: 85 },
  'hot': { min: 85, max: 100 },
  'extreme-heat': { min: 100, max: 120 }
}

// ---- Climate/Season → Temperature Weights ----------------------------------

type TempWeight = [TemperatureLevel, number][]

const CLIMATE_SEASON_TEMPS: Record<Climate, Record<Season, TempWeight>> = {
  arctic: {
    winter: [['freezing', 80], ['cold', 20]],
    spring: [['freezing', 40], ['cold', 50], ['mild', 10]],
    summer: [['cold', 40], ['mild', 50], ['warm', 10]],
    autumn: [['freezing', 30], ['cold', 55], ['mild', 15]]
  },
  temperate: {
    winter: [['freezing', 20], ['cold', 60], ['mild', 20]],
    spring: [['cold', 15], ['mild', 60], ['warm', 25]],
    summer: [['mild', 15], ['warm', 55], ['hot', 30]],
    autumn: [['cold', 20], ['mild', 55], ['warm', 25]]
  },
  tropical: {
    winter: [['warm', 60], ['hot', 40]],
    spring: [['warm', 40], ['hot', 50], ['extreme-heat', 10]],
    summer: [['warm', 20], ['hot', 50], ['extreme-heat', 30]],
    autumn: [['warm', 50], ['hot', 45], ['extreme-heat', 5]]
  },
  desert: {
    winter: [['cold', 30], ['mild', 50], ['warm', 20]],
    spring: [['mild', 20], ['warm', 40], ['hot', 30], ['extreme-heat', 10]],
    summer: [['warm', 10], ['hot', 40], ['extreme-heat', 50]],
    autumn: [['mild', 20], ['warm', 45], ['hot', 30], ['extreme-heat', 5]]
  },
  coastal: {
    winter: [['cold', 40], ['mild', 50], ['warm', 10]],
    spring: [['cold', 10], ['mild', 55], ['warm', 35]],
    summer: [['mild', 20], ['warm', 55], ['hot', 25]],
    autumn: [['cold', 15], ['mild', 55], ['warm', 30]]
  }
}

// ---- Climate/Season → Wind Weights -----------------------------------------

type WindWeight = [WindLevel, number][]

const CLIMATE_SEASON_WIND: Record<Climate, Record<Season, WindWeight>> = {
  arctic: {
    winter: [['moderate', 20], ['strong', 50], ['severe', 30]],
    spring: [['light', 20], ['moderate', 40], ['strong', 30], ['severe', 10]],
    summer: [['calm', 15], ['light', 40], ['moderate', 35], ['strong', 10]],
    autumn: [['light', 15], ['moderate', 35], ['strong', 35], ['severe', 15]]
  },
  temperate: {
    winter: [['calm', 10], ['light', 25], ['moderate', 35], ['strong', 25], ['severe', 5]],
    spring: [['calm', 15], ['light', 35], ['moderate', 35], ['strong', 15]],
    summer: [['calm', 30], ['light', 40], ['moderate', 25], ['strong', 5]],
    autumn: [['calm', 10], ['light', 30], ['moderate', 35], ['strong', 20], ['severe', 5]]
  },
  tropical: {
    winter: [['calm', 25], ['light', 40], ['moderate', 30], ['strong', 5]],
    spring: [['calm', 20], ['light', 35], ['moderate', 30], ['strong', 15]],
    summer: [['calm', 15], ['light', 25], ['moderate', 30], ['strong', 20], ['severe', 10]],
    autumn: [['calm', 10], ['light', 25], ['moderate', 30], ['strong', 25], ['severe', 10]]
  },
  desert: {
    winter: [['calm', 30], ['light', 40], ['moderate', 25], ['strong', 5]],
    spring: [['calm', 20], ['light', 30], ['moderate', 30], ['strong', 15], ['severe', 5]],
    summer: [['calm', 25], ['light', 30], ['moderate', 25], ['strong', 15], ['severe', 5]],
    autumn: [['calm', 25], ['light', 35], ['moderate', 30], ['strong', 10]]
  },
  coastal: {
    winter: [['light', 15], ['moderate', 35], ['strong', 35], ['severe', 15]],
    spring: [['calm', 10], ['light', 30], ['moderate', 40], ['strong', 20]],
    summer: [['calm', 20], ['light', 40], ['moderate', 30], ['strong', 10]],
    autumn: [['light', 15], ['moderate', 30], ['strong', 35], ['severe', 20]]
  }
}

// ---- Climate/Season → Precipitation Weights --------------------------------

type PrecipWeight = [PrecipitationLevel, number][]

const CLIMATE_SEASON_PRECIP: Record<Climate, Record<Season, PrecipWeight>> = {
  arctic: {
    winter: [['none', 30], ['light', 40], ['heavy', 30]],
    spring: [['none', 40], ['light', 40], ['heavy', 20]],
    summer: [['none', 60], ['light', 30], ['heavy', 10]],
    autumn: [['none', 35], ['light', 40], ['heavy', 25]]
  },
  temperate: {
    winter: [['none', 40], ['light', 35], ['heavy', 25]],
    spring: [['none', 35], ['light', 40], ['heavy', 25]],
    summer: [['none', 55], ['light', 30], ['heavy', 15]],
    autumn: [['none', 35], ['light', 40], ['heavy', 25]]
  },
  tropical: {
    winter: [['none', 50], ['light', 35], ['heavy', 15]],
    spring: [['none', 30], ['light', 35], ['heavy', 35]],
    summer: [['none', 20], ['light', 30], ['heavy', 50]],
    autumn: [['none', 30], ['light', 35], ['heavy', 35]]
  },
  desert: {
    winter: [['none', 75], ['light', 20], ['heavy', 5]],
    spring: [['none', 85], ['light', 12], ['heavy', 3]],
    summer: [['none', 90], ['light', 8], ['heavy', 2]],
    autumn: [['none', 80], ['light', 15], ['heavy', 5]]
  },
  coastal: {
    winter: [['none', 25], ['light', 40], ['heavy', 35]],
    spring: [['none', 35], ['light', 40], ['heavy', 25]],
    summer: [['none', 45], ['light', 35], ['heavy', 20]],
    autumn: [['none', 25], ['light', 35], ['heavy', 40]]
  }
}

// ---- Weighted Random Selection ---------------------------------------------

function weightedPick<T>(weights: [T, number][]): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [value, weight] of weights) {
    r -= weight
    if (r <= 0) return value
  }
  return weights[weights.length - 1][0]
}

function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

// ---- Description Builders --------------------------------------------------

const TEMP_DESCRIPTIONS: Record<TemperatureLevel, string> = {
  'freezing': 'Freezing',
  'cold': 'Cold',
  'mild': 'Mild',
  'warm': 'Warm',
  'hot': 'Hot',
  'extreme-heat': 'Extremely hot'
}

const WIND_DESCRIPTIONS: Record<WindLevel, string> = {
  calm: 'calm winds',
  light: 'a light breeze',
  moderate: 'moderate winds',
  strong: 'strong winds',
  severe: 'severe gale-force winds'
}

const PRECIP_DESCRIPTIONS: Record<PrecipitationLevel, Record<'rain' | 'snow', string>> = {
  none: { rain: 'clear skies', snow: 'clear skies' },
  light: { rain: 'light rain', snow: 'light snowfall' },
  heavy: { rain: 'heavy downpour', snow: 'heavy blizzard' }
}

function getMapPreset(precipitation: PrecipitationLevel, temperature: TemperatureLevel): string {
  const isSnow = temperature === 'freezing' || temperature === 'cold'
  if (precipitation === 'heavy') return isSnow ? 'blizzard' : 'storm'
  if (precipitation === 'light') return isSnow ? 'snow' : 'rain'
  return 'clear'
}

// ---- Mechanical Effects (DMG 2024) -----------------------------------------

function getMechanicalEffects(
  temp: TemperatureLevel,
  wind: WindLevel,
  precip: PrecipitationLevel
): string[] {
  const effects: string[] = []

  if (temp === 'freezing') {
    effects.push(
      'Extreme Cold: DC 10 CON save each hour or gain 1 level of Exhaustion. Resistance/immunity to Cold damage or natural cold adaptation grants auto-success.'
    )
  }
  if (temp === 'extreme-heat') {
    effects.push(
      'Extreme Heat: DC 5 CON save each hour (+1 per hour) or gain 1 level of Exhaustion. Heavy armor or heavy clothing imposes Disadvantage. Resistance/immunity to Fire damage grants auto-success.'
    )
  }

  if (wind === 'strong' || wind === 'severe') {
    effects.push('Strong Wind: Disadvantage on ranged weapon attack rolls and Wisdom (Perception) checks relying on hearing.')
    if (wind === 'severe') {
      effects.push('Severe Wind: Ranged weapon attacks beyond normal range are impossible. Open flames are extinguished.')
    }
  }

  if (precip === 'heavy') {
    effects.push('Heavy Precipitation: The area is Lightly Obscured. Disadvantage on Wisdom (Perception) checks relying on sight.')
  }

  return effects
}

// ---- Public API ------------------------------------------------------------

/**
 * Generate random weather conditions for a given climate and season.
 * Returns a full WeatherConditions object compatible with the game store's weatherOverride.
 */
export function generateWeather(climate: Climate, season: Season): WeatherConditions {
  const temp = weightedPick(CLIMATE_SEASON_TEMPS[climate][season])
  const wind = weightedPick(CLIMATE_SEASON_WIND[climate][season])
  const precip = weightedPick(CLIMATE_SEASON_PRECIP[climate][season])

  const range = TEMP_RANGES[temp]
  const fahrenheit = randomInRange(range.min, range.max)
  const isSnow = temp === 'freezing' || temp === 'cold'
  const precipDesc = PRECIP_DESCRIPTIONS[precip][isSnow ? 'snow' : 'rain']

  const description = `${TEMP_DESCRIPTIONS[temp]} (${fahrenheit}°F) with ${WIND_DESCRIPTIONS[wind]} and ${precipDesc}.`
  const mechanicalEffects = getMechanicalEffects(temp, wind, precip)
  const preset = getMapPreset(precip, temp)

  return {
    temperature: temp,
    temperatureFahrenheit: fahrenheit,
    wind,
    precipitation: precip,
    description,
    mechanicalEffects,
    preset
  }
}

/** Convert weather conditions to the game store's weatherOverride format. */
export function weatherToOverride(weather: WeatherConditions): {
  description: string
  temperature: number
  temperatureUnit: 'F'
  windSpeed: string
  mechanicalEffects: string[]
  preset: string
} {
  return {
    description: weather.description,
    temperature: weather.temperatureFahrenheit,
    temperatureUnit: 'F',
    windSpeed: weather.wind,
    mechanicalEffects: weather.mechanicalEffects,
    preset: weather.preset
  }
}

export const CLIMATES: { value: Climate; label: string }[] = [
  { value: 'arctic', label: 'Arctic' },
  { value: 'temperate', label: 'Temperate' },
  { value: 'tropical', label: 'Tropical' },
  { value: 'desert', label: 'Desert' },
  { value: 'coastal', label: 'Coastal' }
]

export const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' }
]

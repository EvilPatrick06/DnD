import type { CalendarConfig, CalendarMonth, CalendarPresetId } from '../types/campaign'

interface CalendarPresetData {
  months: CalendarMonth[]
  daysPerYear: number
  yearLabel: string
  hoursPerDay: number
}

export const CALENDAR_PRESETS: Record<CalendarPresetId, CalendarPresetData> = {
  gregorian: {
    months: [
      { name: 'January', days: 31 },
      { name: 'February', days: 28 },
      { name: 'March', days: 31 },
      { name: 'April', days: 30 },
      { name: 'May', days: 31 },
      { name: 'June', days: 30 },
      { name: 'July', days: 31 },
      { name: 'August', days: 31 },
      { name: 'September', days: 30 },
      { name: 'October', days: 31 },
      { name: 'November', days: 30 },
      { name: 'December', days: 31 }
    ],
    daysPerYear: 365,
    yearLabel: 'AD',
    hoursPerDay: 24
  },
  harptos: {
    months: [
      { name: 'Hammer', days: 30 },
      { name: 'Midwinter', days: 1 },
      { name: 'Alturiak', days: 30 },
      { name: 'Ches', days: 30 },
      { name: 'Tarsakh', days: 30 },
      { name: 'Greengrass', days: 1 },
      { name: 'Mirtul', days: 30 },
      { name: 'Kythorn', days: 30 },
      { name: 'Flamerule', days: 30 },
      { name: 'Midsummer', days: 1 },
      { name: 'Eleasis', days: 30 },
      { name: 'Eleint', days: 30 },
      { name: 'Highharvestide', days: 1 },
      { name: 'Marpenoth', days: 30 },
      { name: 'Uktar', days: 30 },
      { name: 'Feast of the Moon', days: 1 },
      { name: 'Nightal', days: 30 }
    ],
    daysPerYear: 365,
    yearLabel: 'DR',
    hoursPerDay: 24
  },
  'simple-day-counter': {
    months: [],
    daysPerYear: 0,
    yearLabel: 'Day',
    hoursPerDay: 24
  },
  custom: {
    months: [{ name: 'Month 1', days: 30 }],
    daysPerYear: 30,
    yearLabel: 'Year',
    hoursPerDay: 24
  }
}

export const PRESET_LABELS: Record<CalendarPresetId, string> = {
  gregorian: 'Gregorian',
  harptos: 'Calendar of Harptos',
  'simple-day-counter': 'Simple Day Counter',
  custom: 'Custom'
}

export function buildCalendarConfig(
  preset: CalendarPresetId,
  startingYear: number,
  exactTimeDefault: CalendarConfig['exactTimeDefault'] = 'contextual',
  customMonths?: CalendarMonth[],
  customYearLabel?: string
): CalendarConfig {
  const data = CALENDAR_PRESETS[preset]
  const months = preset === 'custom' && customMonths ? customMonths : data.months
  const daysPerYear = preset === 'simple-day-counter' ? 0 : months.reduce((sum, m) => sum + m.days, 0)

  return {
    preset,
    months,
    daysPerYear,
    yearLabel: customYearLabel ?? data.yearLabel,
    startingYear,
    hoursPerDay: data.hoursPerDay,
    exactTimeDefault
  }
}

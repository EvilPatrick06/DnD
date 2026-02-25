import { load5eAlignmentDescriptions } from '../services/data-provider'

export const ALIGNMENT_DESCRIPTIONS: Record<string, string> = {}

load5eAlignmentDescriptions()
  .then((data) => {
    Object.assign(ALIGNMENT_DESCRIPTIONS, data)
  })
  .catch(() => {})

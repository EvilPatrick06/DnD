import { load5eLanguages } from '../services/data-provider'

export const LANGUAGE_DESCRIPTIONS: Record<string, string> = {}

load5eLanguages()
  .then((languages) => {
    for (const lang of languages) {
      const scriptPart = lang.script ? `Script: ${lang.script}. ` : 'Script: None. '
      LANGUAGE_DESCRIPTIONS[lang.name] = `${scriptPart}${lang.description}`
    }
  })
  .catch(() => {})

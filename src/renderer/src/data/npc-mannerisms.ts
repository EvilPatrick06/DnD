import { load5eNpcMannerisms } from '../services/data-provider'

export const NPC_VOICE_DESCRIPTIONS: readonly string[] = []
export const NPC_MANNERISMS: readonly string[] = []

load5eNpcMannerisms()
  .then((data) => {
    ;(NPC_VOICE_DESCRIPTIONS as string[]).push(...(data.voiceDescriptions ?? []))
    ;(NPC_MANNERISMS as string[]).push(...(data.mannerisms ?? []))
  })
  .catch(() => {})

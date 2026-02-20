export const DEFAULT_BLOCKED_WORDS: string[] = [
  'fuck',
  'shit',
  'ass',
  'bitch',
  'damn',
  'crap',
  'dick',
  'pussy',
  'cock',
  'cunt',
  'bastard',
  'slut',
  'whore',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'retarded'
]

export function filterMessage(message: string, blockedWords: string[]): string {
  let filtered = message
  for (const word of blockedWords) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    filtered = filtered.replace(regex, '***')
  }
  return filtered
}

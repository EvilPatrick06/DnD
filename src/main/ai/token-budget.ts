/**
 * Approximate token counting — ~4 chars per token on average.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface ContextTokenBreakdown {
  rulebookChunks: number
  srdData: number
  characterData: number
  campaignData: number
  creatures: number
  gameState: number
  memory: number
  total: number
}

export const TOKEN_BUDGETS = {
  systemPrompt: 1500,
  retrievedChunks: 8000,
  srdData: 2000,
  campaignData: 2000,
  creatures: 2000,
  gameState: 1500,
  memory: 2000,
  conversationHistory: 4000,
  responseBuffer: 4000,
  total: 25000
} as const

/**
 * Trim text to fit within a token budget, cutting at paragraph boundaries.
 */
export function trimToTokenBudget(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text

  const maxChars = maxTokens * 4
  const trimmed = text.slice(0, maxChars)
  const lastParagraph = trimmed.lastIndexOf('\n\n')
  if (lastParagraph > maxChars * 0.5) {
    return `${trimmed.slice(0, lastParagraph)}\n\n[...truncated]`
  }
  return `${trimmed}\n[...truncated]`
}

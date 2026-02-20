import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ModelChoice, StreamCallbacks } from './types'

let client: Anthropic | null = null
let currentApiKey: string | null = null

export function initClaudeClient(apiKey: string): void {
  currentApiKey = apiKey
  client = new Anthropic({ apiKey })
}

export function isClaudeConfigured(): boolean {
  return client !== null && currentApiKey !== null
}

function getClient(): Anthropic {
  if (!client) {
    throw new Error('Claude client not initialized. Call initClaudeClient() first.')
  }
  return client
}

function getModelId(model: ModelChoice): string {
  switch (model) {
    case 'opus':
      return 'claude-opus-4-6'
    case 'sonnet':
      return 'claude-sonnet-4-6'
    case 'haiku':
      return 'claude-haiku-4-5'
  }
}

export async function claudeStreamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  model: ModelChoice = 'sonnet',
  abortSignal?: AbortSignal
): Promise<void> {
  const anthropic = getClient()
  const modelId = getModelId(model)

  try {
    const stream = anthropic.messages.stream(
      {
        model: modelId,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        }))
      },
      abortSignal ? { signal: abortSignal } : undefined
    )

    let fullText = ''

    stream.on('text', (text) => {
      if (abortSignal?.aborted) return
      fullText += text
      callbacks.onText(text)
    })

    const finalMessage = await stream.finalMessage()
    const content = finalMessage.content[0]
    if (content.type === 'text') {
      fullText = content.text
    }
    callbacks.onDone(fullText)
  } catch (error) {
    if (abortSignal?.aborted) return
    callbacks.onError(error instanceof Error ? error : new Error(String(error)))
  }
}

export async function claudeChatOnce(
  systemPrompt: string,
  messages: ChatMessage[],
  model: ModelChoice = 'haiku'
): Promise<string> {
  const anthropic = getClient()
  const modelId = getModelId(model)

  const response = await anthropic.messages.create({
    model: modelId,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content
    }))
  })

  const content = response.content[0]
  if (content.type === 'text') {
    return content.text
  }
  return ''
}

/** Test the Claude API connection. */
export async function testClaudeConnection(apiKey: string): Promise<boolean> {
  try {
    const testClient = new Anthropic({ apiKey })
    const response = await testClient.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "ok"' }]
    })
    return response.content.length > 0
  } catch {
    return false
  }
}

import { describe, expect, it } from 'vitest'
import { ActiveCreatureSchema, AiChatRequestSchema, AiConfigSchema } from './ipc-schemas'

describe('ipc-schemas', () => {
  describe('AiConfigSchema', () => {
    it('should accept valid config', () => {
      const result = AiConfigSchema.safeParse({
        ollamaModel: 'llama3',
        ollamaUrl: 'http://localhost:11434'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing ollamaModel', () => {
      const result = AiConfigSchema.safeParse({
        ollamaUrl: 'http://localhost:11434'
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing ollamaUrl', () => {
      const result = AiConfigSchema.safeParse({
        ollamaModel: 'llama3'
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-string values', () => {
      const result = AiConfigSchema.safeParse({
        ollamaModel: 123,
        ollamaUrl: true
      })
      expect(result.success).toBe(false)
    })
  })

  describe('ActiveCreatureSchema', () => {
    it('should accept valid active creature', () => {
      const result = ActiveCreatureSchema.safeParse({
        label: 'Goblin 1',
        currentHP: 7,
        maxHP: 12,
        ac: 15,
        conditions: ['poisoned']
      })
      expect(result.success).toBe(true)
    })

    it('should accept creature with optional monsterStatBlockId', () => {
      const result = ActiveCreatureSchema.safeParse({
        label: 'Dragon',
        currentHP: 200,
        maxHP: 200,
        ac: 19,
        conditions: [],
        monsterStatBlockId: 'adult-red-dragon'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing required fields', () => {
      const result = ActiveCreatureSchema.safeParse({
        label: 'Goblin'
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-array conditions', () => {
      const result = ActiveCreatureSchema.safeParse({
        label: 'Goblin',
        currentHP: 7,
        maxHP: 12,
        ac: 15,
        conditions: 'poisoned'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AiChatRequestSchema', () => {
    it('should accept valid chat request', () => {
      const result = AiChatRequestSchema.safeParse({
        campaignId: '12345678-1234-1234-1234-123456789abc',
        message: 'What do I see?',
        characterIds: ['char-1', 'char-2']
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with all optional fields', () => {
      const result = AiChatRequestSchema.safeParse({
        campaignId: 'campaign-id',
        message: 'Attack the goblin',
        characterIds: ['char-1'],
        senderName: 'Player 1',
        activeCreatures: [{ label: 'Goblin', currentHP: 7, maxHP: 12, ac: 15, conditions: [] }],
        gameState: 'combat'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing campaignId', () => {
      const result = AiChatRequestSchema.safeParse({
        message: 'Hello',
        characterIds: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing message', () => {
      const result = AiChatRequestSchema.safeParse({
        campaignId: 'id',
        characterIds: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing characterIds', () => {
      const result = AiChatRequestSchema.safeParse({
        campaignId: 'id',
        message: 'Hello'
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-array characterIds', () => {
      const result = AiChatRequestSchema.safeParse({
        campaignId: 'id',
        message: 'Hello',
        characterIds: 'not-array'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('module exports', () => {
    it('should export all schemas and types', async () => {
      const mod = await import('./ipc-schemas')
      expect(mod.AiConfigSchema).toBeDefined()
      expect(mod.AiChatRequestSchema).toBeDefined()
      expect(mod.ActiveCreatureSchema).toBeDefined()
    })
  })
})

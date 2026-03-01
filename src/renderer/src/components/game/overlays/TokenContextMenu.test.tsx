import { describe, expect, it } from 'vitest'

describe('TokenContextMenu', () => {
  it('can be imported', async () => {
    const mod = await import('./TokenContextMenu')
    expect(mod).toBeDefined()
  })
})

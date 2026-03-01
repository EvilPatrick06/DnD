import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('window', { api: { storage: {}, game: {} } })

describe('map-token-slice', () => {
  it('can be imported', async () => {
    const mod = await import('./map-token-slice')
    expect(mod).toBeDefined()
  })

  it('exports createMapTokenSlice as a function', async () => {
    const mod = await import('./map-token-slice')
    expect(typeof mod.createMapTokenSlice).toBe('function')
  })
})

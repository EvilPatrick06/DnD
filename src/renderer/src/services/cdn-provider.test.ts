import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock logger ---
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

// --- Mock data-provider loadJson ---
vi.mock('./data-provider', () => ({
  loadJson: vi.fn()
}))

// --- Mock global fetch ---
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import cdnProvider from './cdn-provider'
// Must import after mocks are set up
import { loadJson } from './data-provider'

const mockLoadJson = vi.mocked(loadJson)

describe('cdn-provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the CDN provider state by setting a known base URL
    cdnProvider.setBaseUrl('https://cdn.test.com')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // setBaseUrl
  // =========================================================================

  describe('setBaseUrl', () => {
    it('strips trailing slash from the URL', () => {
      cdnProvider.setBaseUrl('https://cdn.example.com/')
      const url = cdnProvider.getMapImageUrl('map1')
      expect(url).toBe('https://cdn.example.com/maps/map1.webp')
    })

    it('does not modify URL without trailing slash', () => {
      cdnProvider.setBaseUrl('https://cdn.example.com')
      const url = cdnProvider.getMapImageUrl('map1')
      expect(url).toBe('https://cdn.example.com/maps/map1.webp')
    })
  })

  // =========================================================================
  // getMapImageUrl
  // =========================================================================

  describe('getMapImageUrl', () => {
    it('constructs the correct URL for a map id', () => {
      cdnProvider.setBaseUrl('https://cdn.test.com')
      expect(cdnProvider.getMapImageUrl('dungeon-level-1')).toBe('https://cdn.test.com/maps/dungeon-level-1.webp')
    })
  })

  // =========================================================================
  // fetchGameData
  // =========================================================================

  describe('fetchGameData', () => {
    it('fetches data from CDN and caches the result', async () => {
      const data = [{ id: 'spell1', name: 'Fireball' }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => data
      })

      const result = await cdnProvider.fetchGameData('data/5e/spells.json')
      expect(result).toEqual(data)

      // Second call should use cache and not fetch again
      const result2 = await cdnProvider.fetchGameData('data/5e/spells.json')
      expect(result2).toEqual(data)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('falls back to local loadJson when CDN fetch fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))
      const localData = [{ id: 'spell2', name: 'Shield' }]
      mockLoadJson.mockResolvedValue(localData)

      const result = await cdnProvider.fetchGameData('data/5e/spells.json')

      expect(result).toEqual(localData)
      expect(mockLoadJson).toHaveBeenCalledWith('./data/5e/spells.json')
    })

    it('falls back to local loadJson when CDN returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      const localData = [{ id: 'class1' }]
      mockLoadJson.mockResolvedValue(localData)

      const result = await cdnProvider.fetchGameData('data/5e/classes.json')

      expect(result).toEqual(localData)
    })

    it('throws when both CDN and local fallback fail', async () => {
      mockFetch.mockRejectedValue(new Error('CDN down'))
      mockLoadJson.mockRejectedValue(new Error('File not found'))

      await expect(cdnProvider.fetchGameData('data/5e/missing.json')).rejects.toThrow('File not found')
    })

    it('prepends ./ to the local path when path does not start with ./', async () => {
      mockFetch.mockRejectedValue(new Error('CDN down'))
      mockLoadJson.mockResolvedValue([])

      await cdnProvider.fetchGameData('data/5e/feats.json')

      expect(mockLoadJson).toHaveBeenCalledWith('./data/5e/feats.json')
    })

    it('does not double-prepend ./ when path already starts with ./', async () => {
      mockFetch.mockRejectedValue(new Error('CDN down'))
      mockLoadJson.mockResolvedValue([])

      await cdnProvider.fetchGameData('./data/5e/feats.json')

      expect(mockLoadJson).toHaveBeenCalledWith('./data/5e/feats.json')
    })
  })

  // =========================================================================
  // uploadMapImage
  // =========================================================================

  describe('uploadMapImage', () => {
    it('requests a presigned URL and then uploads the image', async () => {
      // Step 1: presign response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://r2.example.com/upload?signed=abc' })
      })
      // Step 2: upload response
      mockFetch.mockResolvedValueOnce({
        ok: true
      })

      const blob = new Blob(['image data'], { type: 'image/webp' })
      const resultUrl = await cdnProvider.uploadMapImage('map-123', blob)

      expect(resultUrl).toBe('https://cdn.test.com/maps/map-123.webp')
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify presign request
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://cdn.test.com/api/presign/maps/map-123.webp', {
        method: 'POST'
      })

      // Verify upload request
      expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://r2.example.com/upload?signed=abc', {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/webp' }
      })
    })

    it('throws when presign request fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      })

      const blob = new Blob(['image data'])
      await expect(cdnProvider.uploadMapImage('map-fail', blob)).rejects.toThrow('Presign request failed')
    })

    it('throws when upload request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://r2.example.com/upload?signed=abc' })
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error'
      })

      const blob = new Blob(['image data'])
      await expect(cdnProvider.uploadMapImage('map-fail2', blob)).rejects.toThrow('Upload failed')
    })
  })

  // =========================================================================
  // isAvailable
  // =========================================================================

  describe('isAvailable', () => {
    it('returns false before availability is checked', () => {
      cdnProvider.setBaseUrl('https://cdn.new.com')
      // Mock the HEAD request that checkAvailability makes
      mockFetch.mockResolvedValue({ ok: true })

      const result = cdnProvider.isAvailable()
      expect(result).toBe(false)
    })

    it('returns true after successful health check', async () => {
      cdnProvider.setBaseUrl('https://cdn.healthy.com')
      mockFetch.mockResolvedValue({ ok: true })

      // First call triggers async check
      cdnProvider.isAvailable()

      // Wait for the async check to complete
      await vi.waitFor(() => {
        expect(cdnProvider.isAvailable()).toBe(true)
      })
    })

    it('returns false after failed health check', async () => {
      cdnProvider.setBaseUrl('https://cdn.dead.com')
      mockFetch.mockRejectedValue(new Error('timeout'))

      // First call triggers async check, returns false immediately
      expect(cdnProvider.isAvailable()).toBe(false)

      // Wait for the async check to complete and verify it stays false
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })
      expect(cdnProvider.isAvailable()).toBe(false)
    })
  })
})

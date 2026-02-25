import { logger } from '../utils/logger'
import { loadJson } from './data-provider'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

class CdnProvider {
  private baseUrl = 'https://cdn.yourdomain.com'
  private available = false
  private availabilityChecked = false
  private readonly dataCache = new Map<string, CacheEntry<unknown>>()

  /** Configure the CDN base URL (no trailing slash). */
  setBaseUrl(url: string): void {
    // Strip trailing slash for consistent URL construction
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url
    // Reset availability when URL changes
    this.available = false
    this.availabilityChecked = false
    this.dataCache.clear()
  }

  /**
   * Returns the CDN URL for a map image.
   * The browser handles caching for image requests.
   */
  getMapImageUrl(mapId: string): string {
    return `${this.baseUrl}/maps/${mapId}.webp`
  }

  /**
   * Fetch JSON data from CDN with local fallback.
   * Results are cached in-memory for 5 minutes.
   *
   * @param path - The CDN path (e.g., "data/5e/character/classes.json")
   * @returns The parsed JSON data
   */
  async fetchGameData<T>(path: string): Promise<T> {
    // Check in-memory cache first
    const cached = this.dataCache.get(path) as CacheEntry<T> | undefined
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }

    // Try CDN first
    const cdnUrl = `${this.baseUrl}/${path}`
    try {
      const response = await fetch(cdnUrl)
      if (!response.ok) {
        throw new Error(`CDN fetch failed: ${response.status} ${response.statusText}`)
      }
      const data = (await response.json()) as T
      this.dataCache.set(path, { data, timestamp: Date.now() })
      return data
    } catch (cdnError) {
      logger.warn(`[CdnProvider] CDN fetch failed for "${path}", falling back to local data:`, cdnError)
    }

    // Fall back to local data via data-provider's loadJson
    // Convert CDN path like "data/5e/character/classes.json" to local path "./data/5e/character/classes.json"
    const localPath = path.startsWith('./') ? path : `./${path}`
    try {
      const data = await loadJson<T>(localPath)
      this.dataCache.set(path, { data, timestamp: Date.now() })
      return data
    } catch (localError) {
      logger.error(`[CdnProvider] Local fallback also failed for "${path}":`, localError)
      throw localError
    }
  }

  /**
   * Upload a map image to R2 via a presigned URL obtained from the server.
   *
   * @param mapId - Unique identifier for the map
   * @param imageData - The image blob to upload
   * @returns The CDN URL of the uploaded image
   */
  async uploadMapImage(mapId: string, imageData: Blob): Promise<string> {
    // Step 1: Request a presigned upload URL from the Pi server
    const presignUrl = `${this.baseUrl}/api/presign/maps/${mapId}.webp`
    let uploadUrl: string

    try {
      const presignResponse = await fetch(presignUrl, { method: 'POST' })
      if (!presignResponse.ok) {
        throw new Error(`Presign request failed: ${presignResponse.status} ${presignResponse.statusText}`)
      }
      const presignData = (await presignResponse.json()) as { url: string }
      uploadUrl = presignData.url
    } catch (err) {
      logger.error(`[CdnProvider] Failed to get presigned URL for map ${mapId}:`, err)
      throw err
    }

    // Step 2: Upload the image to the presigned URL
    try {
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: imageData,
        headers: {
          'Content-Type': 'image/webp'
        }
      })
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }
    } catch (err) {
      logger.error(`[CdnProvider] Failed to upload map image ${mapId}:`, err)
      throw err
    }

    return this.getMapImageUrl(mapId)
  }

  /**
   * Check if the CDN is reachable.
   * Caches the result until the base URL changes.
   */
  isAvailable(): boolean {
    if (!this.availabilityChecked) {
      // Trigger an async availability check but return false until confirmed
      this.checkAvailability()
      return false
    }
    return this.available
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })
      this.available = response.ok
    } catch {
      this.available = false
    }
    this.availabilityChecked = true
  }
}

const cdnProvider = new CdnProvider()
export default cdnProvider

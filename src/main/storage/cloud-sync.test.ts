import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn()
}))

vi.mock('@aws-sdk/client-s3', () => {
  // Must use regular function (not arrow) so `new` works
  function S3Client(this: any) {
    this.send = mockSend
  }
  function PutObjectCommand(this: any, input: unknown) {
    this.input = input
  }
  function GetObjectCommand(this: any, input: unknown) {
    this.input = input
  }
  function ListObjectsV2Command(this: any, input: unknown) {
    this.input = input
  }
  function DeleteObjectCommand(this: any, input: unknown) {
    this.input = input
  }
  return { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand }
})

vi.mock('../log', () => ({
  logToFile: vi.fn()
}))

import type { CloudSyncConfig } from './cloud-sync'
import { CloudSync } from './cloud-sync'

const testConfig: CloudSyncConfig = {
  bucket: 'test-bucket',
  region: 'us-east-1',
  prefix: 'backups',
  accessKeyId: 'AKID',
  secretAccessKey: 'SECRET'
}

const DEVICE_KEY = 'device-123'

describe('CloudSync', () => {
  let sync: CloudSync

  beforeEach(() => {
    vi.clearAllMocks()
    sync = new CloudSync(testConfig)
  })

  describe('constructor', () => {
    it('should create an instance with credentials', () => {
      expect(sync).toBeInstanceOf(CloudSync)
    })

    it('should create an instance without explicit credentials', () => {
      const configNoAuth: CloudSyncConfig = { bucket: 'b', region: 'us-west-2' }
      const instance = new CloudSync(configNoAuth)
      expect(instance).toBeInstanceOf(CloudSync)
    })
  })

  describe('uploadCharacter', () => {
    it('should upload character data to S3', async () => {
      mockSend.mockResolvedValue({})

      const character = { id: 'char-1', name: 'Hero' }
      await sync.uploadCharacter(character, DEVICE_KEY)

      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should throw on upload error', async () => {
      mockSend.mockRejectedValue(new Error('network error'))

      const character = { id: 'char-1', name: 'Hero' }
      await expect(sync.uploadCharacter(character, DEVICE_KEY)).rejects.toThrow('network error')
    })
  })

  describe('downloadCharacter', () => {
    it('should download and parse character data', async () => {
      const charData = { id: 'char-1', name: 'Hero' }
      mockSend.mockResolvedValue({
        Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify(charData)) }
      })

      const result = await sync.downloadCharacter('char-1', DEVICE_KEY)
      expect(result).toEqual(charData)
    })

    it('should return null when key does not exist', async () => {
      mockSend.mockRejectedValue({ name: 'NoSuchKey' })

      const result = await sync.downloadCharacter('missing-id', DEVICE_KEY)
      expect(result).toBeNull()
    })

    it('should return null when body is empty', async () => {
      mockSend.mockResolvedValue({ Body: { transformToString: vi.fn().mockResolvedValue('') } })

      const result = await sync.downloadCharacter('char-1', DEVICE_KEY)
      expect(result).toBeNull()
    })

    it('should return null on non-NoSuchKey error', async () => {
      mockSend.mockRejectedValue(new Error('access denied'))

      const result = await sync.downloadCharacter('char-1', DEVICE_KEY)
      expect(result).toBeNull()
    })
  })

  describe('uploadCampaign', () => {
    it('should upload campaign data to S3', async () => {
      mockSend.mockResolvedValue({})

      const campaign = { id: 'camp-1', name: 'Adventure' }
      await sync.uploadCampaign(campaign, DEVICE_KEY)

      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should throw on upload error', async () => {
      mockSend.mockRejectedValue(new Error('timeout'))

      await expect(sync.uploadCampaign({ id: 'camp-1' }, DEVICE_KEY)).rejects.toThrow('timeout')
    })
  })

  describe('downloadCampaign', () => {
    it('should download and parse campaign data', async () => {
      const campData = { id: 'camp-1', name: 'Adventure' }
      mockSend.mockResolvedValue({
        Body: { transformToString: vi.fn().mockResolvedValue(JSON.stringify(campData)) }
      })

      const result = await sync.downloadCampaign('camp-1', DEVICE_KEY)
      expect(result).toEqual(campData)
    })

    it('should return null when key does not exist', async () => {
      mockSend.mockRejectedValue({ name: 'NoSuchKey' })

      const result = await sync.downloadCampaign('missing', DEVICE_KEY)
      expect(result).toBeNull()
    })
  })

  describe('listBackups', () => {
    it('should return parsed backup entries', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          {
            Key: `backups/${DEVICE_KEY}/characters/char-1.json`,
            LastModified: new Date('2024-01-01'),
            Size: 500
          },
          {
            Key: `backups/${DEVICE_KEY}/campaigns/camp-1.json`,
            LastModified: new Date('2024-01-02'),
            Size: 1000
          }
        ],
        IsTruncated: false
      })

      const entries = await sync.listBackups(DEVICE_KEY)
      expect(entries).toHaveLength(2)
      expect(entries[0].type).toBe('character')
      expect(entries[0].name).toBe('char-1')
      expect(entries[1].type).toBe('campaign')
      expect(entries[1].name).toBe('camp-1')
    })

    it('should return empty array on error', async () => {
      mockSend.mockRejectedValue(new Error('access denied'))

      const entries = await sync.listBackups(DEVICE_KEY)
      expect(entries).toEqual([])
    })

    it('should handle paginated results', async () => {
      mockSend
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: `backups/${DEVICE_KEY}/characters/c1.json`,
              LastModified: new Date(),
              Size: 100
            }
          ],
          IsTruncated: true,
          NextContinuationToken: 'token-2'
        })
        .mockResolvedValueOnce({
          Contents: [
            {
              Key: `backups/${DEVICE_KEY}/characters/c2.json`,
              LastModified: new Date(),
              Size: 200
            }
          ],
          IsTruncated: false
        })

      const entries = await sync.listBackups(DEVICE_KEY)
      expect(entries).toHaveLength(2)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should skip entries without Key, LastModified, or Size', async () => {
      mockSend.mockResolvedValue({
        Contents: [
          { Key: null, LastModified: new Date(), Size: 100 },
          { Key: 'backups/dev/characters/c1.json', LastModified: null, Size: 100 }
        ],
        IsTruncated: false
      })

      const entries = await sync.listBackups(DEVICE_KEY)
      expect(entries).toEqual([])
    })
  })

  describe('deleteBackup', () => {
    it('should send delete command', async () => {
      mockSend.mockResolvedValue({})

      await sync.deleteBackup('backups/device/characters/c1.json')
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should not throw on delete error', async () => {
      mockSend.mockRejectedValue(new Error('not found'))

      await expect(sync.deleteBackup('nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('syncAll', () => {
    it('should upload new characters and campaigns', async () => {
      // listBackups returns empty
      mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false })
      // Upload calls
      mockSend.mockResolvedValue({})

      const result = await sync.syncAll(DEVICE_KEY, {
        characters: [{ id: 'c1' }],
        campaigns: [{ id: 'camp1' }]
      })

      expect(result.uploaded).toBe(2)
      expect(result.skipped).toBe(0)
      expect(result.errors).toEqual([])
    })

    it('should skip items that are older than existing backups', async () => {
      mockSend.mockResolvedValueOnce({
        Contents: [
          {
            Key: `backups/${DEVICE_KEY}/characters/c1.json`,
            LastModified: new Date('2024-06-01'),
            Size: 100
          }
        ],
        IsTruncated: false
      })

      const result = await sync.syncAll(DEVICE_KEY, {
        characters: [{ id: 'c1', updatedAt: '2024-01-01' }],
        campaigns: []
      })

      expect(result.skipped).toBe(1)
      expect(result.uploaded).toBe(0)
    })

    it('should collect errors for failed uploads', async () => {
      // listBackups returns empty
      mockSend.mockResolvedValueOnce({ Contents: [], IsTruncated: false })
      // Upload fails
      mockSend.mockRejectedValue(new Error('upload failed'))

      const result = await sync.syncAll(DEVICE_KEY, {
        characters: [{ id: 'c1' }],
        campaigns: []
      })

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('upload failed')
    })
  })
})

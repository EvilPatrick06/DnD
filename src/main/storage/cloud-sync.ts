import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig
} from '@aws-sdk/client-s3'
import { logToFile } from '../log'

/** Generic record with id and optional timestamps — matches both Character and Campaign. */
interface Identifiable {
  id: string
  updatedAt?: string | number
  [key: string]: unknown
}

export interface BackupEntry {
  key: string
  name: string
  type: 'character' | 'campaign'
  lastModified: Date
  size: number
}

export interface SyncResult {
  uploaded: number
  skipped: number
  errors: string[]
}

export interface CloudSyncConfig {
  bucket: string
  region: string
  prefix?: string
  accessKeyId?: string
  secretAccessKey?: string
}

function buildS3Key(deviceKey: string, type: 'characters' | 'campaigns', id: string, prefix?: string): string {
  const base = prefix ? `${prefix}/${deviceKey}` : deviceKey
  return `${base}/${type}/${id}.json`
}

function parseS3Key(key: string, prefix?: string): { type: 'character' | 'campaign'; id: string } | null {
  const prefixPart = prefix ? `${prefix}/` : ''
  const withoutPrefix = key.startsWith(prefixPart) ? key.slice(prefixPart.length) : key
  const segments = withoutPrefix.split('/')
  if (segments.length < 3) return null

  const typeSegment = segments[segments.length - 2]
  const fileSegment = segments[segments.length - 1]

  if (typeSegment !== 'characters' && typeSegment !== 'campaigns') return null
  if (!fileSegment.endsWith('.json')) return null

  const type = typeSegment === 'characters' ? 'character' : 'campaign'
  const id = fileSegment.replace('.json', '')
  return { type, id }
}

export class CloudSync {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly prefix: string | undefined

  constructor(config: CloudSyncConfig) {
    this.bucket = config.bucket
    this.prefix = config.prefix

    const clientConfig: S3ClientConfig = {
      region: config.region
    }

    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    }

    this.client = new S3Client(clientConfig)
  }

  async uploadCharacter(character: Identifiable, deviceKey: string): Promise<void> {
    const key = buildS3Key(deviceKey, 'characters', character.id, this.prefix)
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify(character, null, 2),
          ContentType: 'application/json'
        })
      )
    } catch (err) {
      logToFile('ERROR', `[CloudSync] Failed to upload character ${character.id}:`, String(err))
      throw err
    }
  }

  async downloadCharacter(id: string, deviceKey: string): Promise<Identifiable | null> {
    const key = buildS3Key(deviceKey, 'characters', id, this.prefix)
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key
        })
      )
      const body = await response.Body?.transformToString('utf-8')
      if (!body) return null
      return JSON.parse(body) as Identifiable
    } catch (err) {
      const error = err as { name?: string }
      if (error.name === 'NoSuchKey') return null
      logToFile('ERROR', `[CloudSync] Failed to download character ${id}:`, String(err))
      return null
    }
  }

  async uploadCampaign(campaign: Identifiable, deviceKey: string): Promise<void> {
    const key = buildS3Key(deviceKey, 'campaigns', campaign.id, this.prefix)
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: JSON.stringify(campaign, null, 2),
          ContentType: 'application/json'
        })
      )
    } catch (err) {
      logToFile('ERROR', `[CloudSync] Failed to upload campaign ${campaign.id}:`, String(err))
      throw err
    }
  }

  async downloadCampaign(id: string, deviceKey: string): Promise<Identifiable | null> {
    const key = buildS3Key(deviceKey, 'campaigns', id, this.prefix)
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key
        })
      )
      const body = await response.Body?.transformToString('utf-8')
      if (!body) return null
      return JSON.parse(body) as Identifiable
    } catch (err) {
      const error = err as { name?: string }
      if (error.name === 'NoSuchKey') return null
      logToFile('ERROR', `[CloudSync] Failed to download campaign ${id}:`, String(err))
      return null
    }
  }

  async listBackups(deviceKey: string): Promise<BackupEntry[]> {
    const prefixPath = this.prefix ? `${this.prefix}/${deviceKey}/` : `${deviceKey}/`
    const entries: BackupEntry[] = []

    try {
      let continuationToken: string | undefined

      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefixPath,
            ContinuationToken: continuationToken
          })
        )

        for (const obj of response.Contents ?? []) {
          if (!obj.Key || !obj.LastModified || obj.Size === undefined) continue

          const parsed = parseS3Key(obj.Key, this.prefix)
          if (!parsed) continue

          entries.push({
            key: obj.Key,
            name: parsed.id,
            type: parsed.type,
            lastModified: obj.LastModified,
            size: obj.Size
          })
        }

        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined
      } while (continuationToken)
    } catch (err) {
      logToFile('ERROR', '[CloudSync] Failed to list backups:', String(err))
    }

    return entries
  }

  async deleteBackup(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key
        })
      )
    } catch (err) {
      logToFile('ERROR', `[CloudSync] Failed to delete backup ${key}:`, String(err))
    }
  }

  async syncAll(
    deviceKey: string,
    localData: { characters: Identifiable[]; campaigns: Identifiable[] }
  ): Promise<SyncResult> {
    const result: SyncResult = {
      uploaded: 0,
      skipped: 0,
      errors: []
    }

    const existingBackups = await this.listBackups(deviceKey)
    const existingKeys = new Set(existingBackups.map((b) => b.key))

    for (const character of localData.characters) {
      const key = buildS3Key(deviceKey, 'characters', character.id, this.prefix)
      if (existingKeys.has(key)) {
        const existing = existingBackups.find((b) => b.key === key)
        if (existing && character.updatedAt) {
          const localDate = new Date(character.updatedAt)
          if (localDate <= existing.lastModified) {
            result.skipped++
            continue
          }
        }
      }
      try {
        await this.uploadCharacter(character, deviceKey)
        result.uploaded++
      } catch (err) {
        result.errors.push(`Character ${character.id}: ${(err as Error).message}`)
      }
    }

    for (const campaign of localData.campaigns) {
      const key = buildS3Key(deviceKey, 'campaigns', campaign.id, this.prefix)
      if (existingKeys.has(key)) {
        const existing = existingBackups.find((b) => b.key === key)
        if (existing && campaign.updatedAt) {
          const localDate = new Date(campaign.updatedAt)
          if (localDate <= existing.lastModified) {
            result.skipped++
            continue
          }
        }
      }
      try {
        await this.uploadCampaign(campaign, deviceKey)
        result.uploaded++
      } catch (err) {
        result.errors.push(`Campaign ${campaign.id}: ${(err as Error).message}`)
      }
    }

    return result
  }
}

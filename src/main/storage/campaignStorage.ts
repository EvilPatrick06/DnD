import { app } from 'electron'
import { join } from 'path'
import { mkdir, readFile, writeFile, unlink, readdir, access } from 'fs/promises'
import { StorageResult } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

let campaignsDirReady: Promise<string> | null = null

function getCampaignsDir(): Promise<string> {
  if (!campaignsDirReady) {
    campaignsDirReady = (async () => {
      const dir = join(app.getPath('userData'), 'campaigns')
      await mkdir(dir, { recursive: true })
      return dir
    })()
  }
  return campaignsDirReady
}

async function getCampaignPath(id: string): Promise<string> {
  const dir = await getCampaignsDir()
  return join(dir, `${id}.json`)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function saveCampaign(
  campaign: Record<string, unknown>
): Promise<StorageResult<void>> {
  try {
    const id = campaign.id as string
    if (!id) {
      return { success: false, error: 'Campaign must have an id' }
    }
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid campaign ID' }
    }
    const path = await getCampaignPath(id)
    await writeFile(path, JSON.stringify(campaign, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: `Failed to save campaign: ${(err as Error).message}` }
  }
}

export async function loadCampaigns(): Promise<StorageResult<Record<string, unknown>[]>> {
  try {
    const dir = await getCampaignsDir()
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
    const results = await Promise.allSettled(
      files.map(async (f) => {
        const data = await readFile(join(dir, f), 'utf-8')
        return JSON.parse(data)
      })
    )
    const campaigns: Record<string, unknown>[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        campaigns.push(r.value)
      } else {
        console.error('Failed to load a campaign file:', r.reason)
      }
    }
    return { success: true, data: campaigns }
  } catch (err) {
    return { success: false, error: `Failed to load campaigns: ${(err as Error).message}` }
  }
}

export async function loadCampaign(
  id: string
): Promise<StorageResult<Record<string, unknown> | null>> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid campaign ID' }
  }
  try {
    const path = await getCampaignPath(id)
    if (!(await fileExists(path))) {
      return { success: true, data: null }
    }
    const data = await readFile(path, 'utf-8')
    return { success: true, data: JSON.parse(data) }
  } catch (err) {
    return { success: false, error: `Failed to load campaign: ${(err as Error).message}` }
  }
}

export async function deleteCampaign(id: string): Promise<StorageResult<boolean>> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid campaign ID' }
  }
  try {
    const path = await getCampaignPath(id)
    if (!(await fileExists(path))) {
      return { success: true, data: false }
    }
    await unlink(path)
    return { success: true, data: true }
  } catch (err) {
    return { success: false, error: `Failed to delete campaign: ${(err as Error).message}` }
  }
}

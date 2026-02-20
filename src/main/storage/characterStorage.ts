import { access, mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import type { StorageResult } from './types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidUUID(str: string): boolean {
  return UUID_RE.test(str)
}

let charactersDirReady: Promise<string> | null = null

function getCharactersDir(): Promise<string> {
  if (!charactersDirReady) {
    charactersDirReady = (async () => {
      const dir = join(app.getPath('userData'), 'characters')
      await mkdir(dir, { recursive: true })
      return dir
    })()
  }
  return charactersDirReady
}

async function getCharacterPath(id: string): Promise<string> {
  const dir = await getCharactersDir()
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

export async function saveCharacter(character: Record<string, unknown>): Promise<StorageResult<void>> {
  try {
    const id = character.id as string
    if (!id) {
      return { success: false, error: 'Character must have an id' }
    }
    if (!isValidUUID(id)) {
      return { success: false, error: 'Invalid character ID' }
    }
    const path = await getCharacterPath(id)
    await writeFile(path, JSON.stringify(character, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: `Failed to save character: ${(err as Error).message}` }
  }
}

export async function loadCharacters(): Promise<StorageResult<Record<string, unknown>[]>> {
  try {
    const dir = await getCharactersDir()
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
    const results = await Promise.allSettled(
      files.map(async (f) => {
        const data = await readFile(join(dir, f), 'utf-8')
        return JSON.parse(data)
      })
    )
    const characters: Record<string, unknown>[] = []
    for (const r of results) {
      if (r.status === 'fulfilled') {
        characters.push(r.value)
      } else {
        console.error('Failed to load a character file:', r.reason)
      }
    }
    return { success: true, data: characters }
  } catch (err) {
    return { success: false, error: `Failed to load characters: ${(err as Error).message}` }
  }
}

export async function loadCharacter(id: string): Promise<StorageResult<Record<string, unknown> | null>> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid character ID' }
  }
  try {
    const path = await getCharacterPath(id)
    if (!(await fileExists(path))) {
      return { success: true, data: null }
    }
    const data = await readFile(path, 'utf-8')
    return { success: true, data: JSON.parse(data) }
  } catch (err) {
    return { success: false, error: `Failed to load character: ${(err as Error).message}` }
  }
}

export async function deleteCharacter(id: string): Promise<StorageResult<boolean>> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid character ID' }
  }
  try {
    const path = await getCharacterPath(id)
    if (!(await fileExists(path))) {
      return { success: true, data: false }
    }
    await unlink(path)
    return { success: true, data: true }
  } catch (err) {
    return { success: false, error: `Failed to delete character: ${(err as Error).message}` }
  }
}

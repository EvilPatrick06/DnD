import { loadCharacter, saveCharacter } from '../storage/characterStorage'
import type { MutationResult, StatChange } from './types'

const STAT_CHANGES_RE = /\[STAT_CHANGES\]\s*([\s\S]*?)\s*\[\/STAT_CHANGES\]/

/** Extract stat changes JSON from AI response text. */
export function parseStatChanges(response: string): StatChange[] {
  const match = response.match(STAT_CHANGES_RE)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[1])
    if (parsed && Array.isArray(parsed.changes)) {
      return parsed.changes.filter(
        (c: unknown) => c && typeof c === 'object' && 'type' in (c as Record<string, unknown>)
      )
    }
  } catch {
    // Malformed JSON
  }
  return []
}

/** Remove the [STAT_CHANGES] block from response text for display. */
export function stripStatChanges(response: string): string {
  return response.replace(/\s*\[STAT_CHANGES\][\s\S]*?\[\/STAT_CHANGES\]\s*/g, '').trim()
}

/** Find the spell slot record for a given level, checking both regular and Pact Magic slots. */
function findSlotRecord(
  char: Record<string, unknown>,
  level: number
): { slot: { current: number; max: number }; isPact: boolean } | null {
  const regularSlots = char.spellSlotLevels as Record<number, { current: number; max: number }> | undefined
  if (regularSlots?.[level]) return { slot: regularSlots[level], isPact: false }
  const pactSlots = char.pactMagicSlotLevels as Record<number, { current: number; max: number }> | undefined
  if (pactSlots?.[level]) return { slot: pactSlots[level], isPact: true }
  return null
}

/** Validate a single change against a 5e character. */
function validateChange(char: Record<string, unknown>, change: StatChange): string | null {
  switch (change.type) {
    case 'damage':
      return change.value <= 0 ? 'Damage must be positive' : null
    case 'heal':
      return change.value <= 0 ? 'Heal amount must be positive' : null
    case 'temp_hp':
      return change.value < 0 ? 'Temp HP must be non-negative' : null
    case 'add_condition': {
      const conditions = (char.conditions as Array<{ name: string }>) || []
      return conditions.some((c) => c.name.toLowerCase() === change.name.toLowerCase())
        ? `Already has condition: ${change.name}`
        : null
    }
    case 'remove_condition': {
      const conditions = (char.conditions as Array<{ name: string }>) || []
      return !conditions.some((c) => c.name.toLowerCase() === change.name.toLowerCase())
        ? `Does not have condition: ${change.name}`
        : null
    }
    case 'death_save':
    case 'reset_death_saves':
      return null
    case 'expend_spell_slot': {
      const record = findSlotRecord(char, change.level)
      if (!record) return `No spell slots at level ${change.level}`
      if (record.slot.current <= 0) return `No remaining spell slots at level ${change.level}`
      return null
    }
    case 'restore_spell_slot': {
      const record = findSlotRecord(char, change.level)
      return !record ? `No spell slots at level ${change.level}` : null
    }
    case 'add_item':
      return null
    case 'remove_item': {
      const equipment = (char.equipment as Array<{ name: string; quantity: number }>) || []
      const item = equipment.find((e) => e.name.toLowerCase() === change.name.toLowerCase())
      if (!item) return `Item not found: ${change.name}`
      const qty = change.quantity ?? 1
      return item.quantity < qty ? `Not enough ${change.name} (have ${item.quantity}, need ${qty})` : null
    }
    case 'gold': {
      const denom = change.denomination ?? 'gp'
      const treasure = char.treasure as Record<string, number>
      const current = treasure?.[denom] ?? 0
      return current + change.value < 0 ? `Not enough ${denom} (have ${current}, need ${-change.value})` : null
    }
    case 'xp':
      return change.value <= 0 ? 'XP must be positive' : null
    case 'use_class_resource': {
      const resources = char.classResources as Array<{ name: string; current: number; max: number }> | undefined
      const resource = resources?.find((r) => r.name.toLowerCase() === change.name.toLowerCase())
      if (!resource) return `Class resource not found: ${change.name}`
      const amount = change.amount ?? 1
      return resource.current < amount ? `Not enough ${change.name} (have ${resource.current})` : null
    }
    case 'restore_class_resource': {
      const resources = char.classResources as Array<{ name: string; current: number; max: number }> | undefined
      return !resources?.find((r) => r.name.toLowerCase() === change.name.toLowerCase())
        ? `Class resource not found: ${change.name}`
        : null
    }
    case 'heroic_inspiration':
      return null
    case 'npc_attitude':
      return null // Informational only — logged in chat, not applied to character
    case 'hit_dice': {
      const remaining = char.hitDiceRemaining as number
      const level = char.level as number
      const newVal = remaining + change.value
      if (newVal < 0) return `Not enough hit dice (have ${remaining})`
      if (newVal > level) return `Hit dice cannot exceed level (${level})`
      return null
    }
    case 'creature_damage':
    case 'creature_heal':
    case 'creature_add_condition':
    case 'creature_remove_condition':
    case 'creature_kill':
      return null // Creature mutations pass through to renderer — validated there
    default:
      return `Unknown change type: ${(change as { type: string }).type}`
  }
}

/** Apply a single mutation to the character object in place. */
function applyChange(char: Record<string, unknown>, change: StatChange): void {
  switch (change.type) {
    case 'damage': {
      const hp = char.hitPoints as { current: number; maximum: number; temporary: number }
      let remaining = change.value
      if (hp.temporary > 0) {
        const absorbed = Math.min(hp.temporary, remaining)
        hp.temporary -= absorbed
        remaining -= absorbed
      }
      hp.current = Math.max(0, hp.current - remaining)
      break
    }
    case 'heal': {
      const hp = char.hitPoints as { current: number; maximum: number; temporary: number }
      const wasZero = hp.current === 0
      hp.current = Math.min(hp.maximum, hp.current + change.value)
      if (wasZero && hp.current > 0) {
        ;(char.deathSaves as { successes: number; failures: number }) = { successes: 0, failures: 0 }
      }
      break
    }
    case 'temp_hp': {
      const hp = char.hitPoints as { current: number; maximum: number; temporary: number }
      hp.temporary = Math.max(hp.temporary, change.value)
      break
    }
    case 'add_condition': {
      const conditions = char.conditions as Array<{ name: string; type: string; isCustom: boolean }>
      conditions.push({ name: change.name, type: 'condition', isCustom: false })
      break
    }
    case 'remove_condition': {
      char.conditions = (char.conditions as Array<{ name: string }>).filter(
        (c) => c.name.toLowerCase() !== change.name.toLowerCase()
      )
      break
    }
    case 'death_save': {
      const ds = char.deathSaves as { successes: number; failures: number }
      if (change.success) {
        ds.successes = Math.min(3, ds.successes + 1)
      } else {
        ds.failures = Math.min(3, ds.failures + 1)
      }
      break
    }
    case 'reset_death_saves': {
      ;(char.deathSaves as { successes: number; failures: number }) = { successes: 0, failures: 0 }
      break
    }
    case 'expend_spell_slot': {
      const record = findSlotRecord(char, change.level)!
      record.slot.current = Math.max(0, record.slot.current - 1)
      break
    }
    case 'restore_spell_slot': {
      const record = findSlotRecord(char, change.level)!
      const count = change.count ?? 1
      record.slot.current = Math.min(record.slot.max, record.slot.current + count)
      break
    }
    case 'add_item': {
      const equipment = char.equipment as Array<{ name: string; quantity: number; description?: string }>
      const existing = equipment.find((e) => e.name.toLowerCase() === change.name.toLowerCase())
      if (existing) {
        existing.quantity += change.quantity ?? 1
      } else {
        equipment.push({ name: change.name, quantity: change.quantity ?? 1, description: change.description })
      }
      break
    }
    case 'remove_item': {
      const equipment = char.equipment as Array<{ name: string; quantity: number }>
      const item = equipment.find((e) => e.name.toLowerCase() === change.name.toLowerCase())
      if (item) {
        item.quantity -= change.quantity ?? 1
        if (item.quantity <= 0) {
          char.equipment = equipment.filter((e) => e.name.toLowerCase() !== change.name.toLowerCase())
        }
      }
      break
    }
    case 'gold': {
      const denom = change.denomination ?? 'gp'
      const treasure = char.treasure as Record<string, number>
      treasure[denom] = Math.max(0, (treasure[denom] ?? 0) + change.value)
      break
    }
    case 'xp': {
      ;(char as Record<string, unknown>).xp = ((char.xp as number) || 0) + change.value
      break
    }
    case 'use_class_resource': {
      const resources = char.classResources as Array<{ name: string; current: number; max: number }>
      const resource = resources.find((r) => r.name.toLowerCase() === change.name.toLowerCase())!
      resource.current = Math.max(0, resource.current - (change.amount ?? 1))
      break
    }
    case 'restore_class_resource': {
      const resources = char.classResources as Array<{ name: string; current: number; max: number }>
      const resource = resources.find((r) => r.name.toLowerCase() === change.name.toLowerCase())!
      resource.current = Math.min(resource.max, resource.current + (change.amount ?? resource.max))
      break
    }
    case 'heroic_inspiration': {
      ;(char as Record<string, unknown>).heroicInspiration = change.grant
      break
    }
    case 'npc_attitude': {
      // NPC attitude changes are informational — logged but not stored on character
      break
    }
    case 'hit_dice': {
      const level = char.level as number
      ;(char as Record<string, unknown>).hitDiceRemaining = Math.max(
        0,
        Math.min(level, (char.hitDiceRemaining as number) + change.value)
      )
      break
    }
  }
}

/**
 * Apply stat mutations to a character, persisting to storage.
 */
export async function applyMutations(characterId: string, changes: StatChange[]): Promise<MutationResult> {
  const result = await loadCharacter(characterId)
  if (!result.success || !result.data) {
    return { applied: [], rejected: changes.map((c) => ({ change: c, reason: 'Character not found' })) }
  }

  const char = result.data as unknown as Record<string, unknown>
  const applied: StatChange[] = []
  const rejected: Array<{ change: StatChange; reason: string }> = []

  for (const change of changes) {
    const error = validateChange(char, change)
    if (error) {
      rejected.push({ change, reason: error })
    } else {
      applyChange(char, change)
      applied.push(change)
    }
  }

  if (applied.length > 0) {
    ;(char as Record<string, unknown>).updatedAt = new Date().toISOString()
    await saveCharacter(char as Record<string, unknown>)
  }

  return { applied, rejected }
}

/** Describe a stat change in human-readable text. */
export function describeChange(change: StatChange): string {
  switch (change.type) {
    case 'damage':
      return `${change.value} ${change.damageType ?? ''} damage (${change.reason})`
    case 'heal':
      return `Healed ${change.value} HP (${change.reason})`
    case 'temp_hp':
      return `${change.value} temporary HP (${change.reason})`
    case 'add_condition':
      return `Condition gained: ${change.name} (${change.reason})`
    case 'remove_condition':
      return `Condition removed: ${change.name} (${change.reason})`
    case 'death_save':
      return `Death save ${change.success ? 'success' : 'failure'} (${change.reason})`
    case 'reset_death_saves':
      return `Death saves reset (${change.reason})`
    case 'expend_spell_slot':
      return `Spell slot (level ${change.level}) expended (${change.reason})`
    case 'restore_spell_slot':
      return `Spell slot (level ${change.level}) restored (${change.reason})`
    case 'add_item':
      return `Gained: ${change.name}${change.quantity && change.quantity > 1 ? ` x${change.quantity}` : ''}`
    case 'remove_item':
      return `Lost: ${change.name}${change.quantity && change.quantity > 1 ? ` x${change.quantity}` : ''}`
    case 'gold':
      return `${change.value >= 0 ? '+' : ''}${change.value} ${change.denomination ?? 'gp'}`
    case 'xp':
      return `+${change.value} XP`
    case 'use_class_resource':
      return `${change.name} used`
    case 'restore_class_resource':
      return `${change.name} restored`
    case 'heroic_inspiration':
      return `Heroic Inspiration ${change.grant ? 'granted' : 'used'}`
    case 'hit_dice':
      return `Hit dice ${change.value >= 0 ? '+' : ''}${change.value}`
    case 'npc_attitude':
      return `${change.name} is now ${change.attitude} (${change.reason})`
    case 'creature_damage':
      return `${change.targetLabel}: ${change.value} ${change.damageType ?? ''} damage (${change.reason})`
    case 'creature_heal':
      return `${change.targetLabel}: healed ${change.value} HP (${change.reason})`
    case 'creature_add_condition':
      return `${change.targetLabel}: gained ${change.name} (${change.reason})`
    case 'creature_remove_condition':
      return `${change.targetLabel}: lost ${change.name} (${change.reason})`
    case 'creature_kill':
      return `${change.targetLabel}: killed (${change.reason})`
  }
}

/** Check if a stat change is negative (damage, resource spend, etc.) */
export function isNegativeChange(change: StatChange): boolean {
  return (
    change.type === 'damage' ||
    change.type === 'add_condition' ||
    (change.type === 'death_save' && !change.success) ||
    change.type === 'expend_spell_slot' ||
    change.type === 'use_class_resource' ||
    change.type === 'remove_item' ||
    (change.type === 'gold' && change.value < 0) ||
    (change.type === 'hit_dice' && change.value < 0) ||
    (change.type === 'npc_attitude' && change.attitude === 'hostile') ||
    change.type === 'creature_damage' ||
    change.type === 'creature_add_condition' ||
    change.type === 'creature_kill'
  )
}

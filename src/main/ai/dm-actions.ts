// ── DM Action Types & Parser ──
// Mirrors stat-mutations.ts pattern for game board actions

const DM_ACTIONS_RE = /\[DM_ACTIONS\]\s*([\s\S]*?)\s*\[\/DM_ACTIONS\]/

// ── Discriminated union of all DM actions ──

export type DmAction =
  // Token management
  | {
      action: 'place_token'
      label: string
      entityType: 'player' | 'npc' | 'enemy'
      gridX: number
      gridY: number
      sizeX?: number
      sizeY?: number
      hp?: number
      ac?: number
      speed?: number
      conditions?: string[]
      visibleToPlayers?: boolean
    }
  | { action: 'move_token'; label: string; gridX: number; gridY: number }
  | { action: 'remove_token'; label: string }
  | {
      action: 'update_token'
      label: string
      hp?: number
      ac?: number
      conditions?: string[]
      visibleToPlayers?: boolean
      label_new?: string
    }

  // Initiative
  | {
      action: 'start_initiative'
      entries: Array<{ label: string; roll: number; modifier: number; entityType: 'player' | 'npc' | 'enemy' }>
    }
  | {
      action: 'add_to_initiative'
      label: string
      roll: number
      modifier: number
      entityType: 'player' | 'npc' | 'enemy'
    }
  | { action: 'next_turn' }
  | { action: 'end_initiative' }
  | { action: 'remove_from_initiative'; label: string }

  // Fog of war
  | { action: 'reveal_fog'; cells: Array<{ x: number; y: number }> }
  | { action: 'hide_fog'; cells: Array<{ x: number; y: number }> }

  // Environment
  | { action: 'set_ambient_light'; level: 'bright' | 'dim' | 'darkness' }
  | { action: 'set_underwater_combat'; enabled: boolean }
  | { action: 'set_travel_pace'; pace: 'fast' | 'normal' | 'slow' | null }

  // Shop
  | {
      action: 'open_shop'
      name?: string
      items?: Array<{
        name: string
        category: string
        price: { gp?: number; sp?: number; cp?: number }
        quantity: number
        description?: string
      }>
    }
  | { action: 'close_shop' }
  | {
      action: 'add_shop_item'
      name: string
      category: string
      price: { gp?: number; sp?: number; cp?: number }
      quantity: number
      description?: string
    }
  | { action: 'remove_shop_item'; name: string }

  // Map
  | { action: 'switch_map'; mapName: string }

  // Sidebar
  | {
      action: 'add_sidebar_entry'
      category: 'allies' | 'enemies' | 'places'
      name: string
      description?: string
      visibleToPlayers?: boolean
    }
  | { action: 'remove_sidebar_entry'; category: 'allies' | 'enemies' | 'places'; name: string }

  // Timer
  | { action: 'start_timer'; seconds: number; targetName: string }
  | { action: 'stop_timer' }

  // Hidden dice
  | { action: 'hidden_dice_roll'; formula: string; reason: string }

  // Communication
  | { action: 'whisper_player'; playerName: string; message: string }
  | { action: 'system_message'; message: string }

  // Conditions on entities (tokens)
  | {
      action: 'add_entity_condition'
      entityLabel: string
      condition: string
      duration?: number | 'permanent'
      source?: string
      value?: number
    }
  | { action: 'remove_entity_condition'; entityLabel: string; condition: string }

/** Extract DM actions JSON from AI response text. */
export function parseDmActions(response: string): DmAction[] {
  const match = response.match(DM_ACTIONS_RE)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[1])
    if (parsed && Array.isArray(parsed.actions)) {
      return parsed.actions.filter(
        (a: unknown) => a && typeof a === 'object' && 'action' in (a as Record<string, unknown>)
      )
    }
  } catch {
    // Malformed JSON — ignore
  }
  return []
}

/** Remove the [DM_ACTIONS] block from response text for display. */
export function stripDmActions(response: string): string {
  return response.replace(/\s*\[DM_ACTIONS\][\s\S]*?\[\/DM_ACTIONS\]\s*/g, '').trim()
}

import { loadCampaign } from '../storage/campaignStorage'

export async function loadCampaignById(id: string): Promise<Record<string, unknown> | null> {
  const result = await loadCampaign(id)
  if (result.success && result.data) {
    return result.data
  }
  return null
}

export function formatCampaignForContext(campaign: Record<string, unknown>): string {
  const parts: string[] = []
  parts.push('[CAMPAIGN DATA]')

  parts.push(`Campaign: ${campaign.name || 'Unnamed'}`)
  if (campaign.description) {
    parts.push(`Description: ${campaign.description}`)
  }
  parts.push(`System: ${campaign.system || '5e'}`)
  parts.push(`Type: ${campaign.type || 'custom'}`)

  // Custom rules
  const customRules = campaign.customRules as Array<{ name: string; description: string }> | undefined
  if (customRules && customRules.length > 0) {
    parts.push('')
    parts.push('Custom Rules:')
    for (const rule of customRules) {
      parts.push(`- ${rule.name}: ${rule.description}`)
    }
  }

  // NPCs
  const npcs = campaign.npcs as
    | Array<{
        name: string
        description?: string
        location?: string
        isVisible?: boolean
        role?: string
        personality?: string
        motivation?: string
        notes?: string
      }>
    | undefined
  if (npcs && npcs.length > 0) {
    parts.push('')
    parts.push('NPCs:')
    for (const npc of npcs) {
      let line = `- ${npc.name}`
      if (npc.description) line += `: ${npc.description}`
      const details: string[] = []
      if (npc.role) details.push(`Role: ${npc.role}`)
      if (npc.location) details.push(`Location: ${npc.location}`)
      if (npc.personality) details.push(`Personality: ${npc.personality}`)
      if (npc.motivation) details.push(`Motivation: ${npc.motivation}`)
      if (npc.isVisible !== undefined) details.push(`Visible to players: ${npc.isVisible}`)
      if (details.length > 0) line += ` (${details.join(', ')})`
      parts.push(line)
    }
  }

  // Lore entries
  const lore = campaign.lore as
    | Array<{
        title: string
        content: string
        category?: string
      }>
    | undefined
  if (lore && lore.length > 0) {
    parts.push('')
    parts.push('Lore:')
    for (const entry of lore) {
      parts.push(`- ${entry.title} [${entry.category || 'other'}]: ${entry.content}`)
    }
  }

  // Maps (brief summary)
  const maps = campaign.maps as
    | Array<{
        name: string
        width?: number
        height?: number
        grid?: { cellSize?: number }
      }>
    | undefined
  if (maps && maps.length > 0) {
    parts.push('')
    parts.push('Maps:')
    for (const map of maps) {
      const grid = map.grid?.cellSize ? `, ${map.grid.cellSize}px cells` : ''
      const size = map.width && map.height ? ` (${map.width}x${map.height}${grid})` : ''
      parts.push(`- ${map.name}${size}`)
    }
  }

  // Settings
  const settings = campaign.settings as
    | {
        levelRange?: { min: number; max: number }
        maxPlayers?: number
      }
    | undefined
  if (settings) {
    const meta: string[] = []
    if (settings.levelRange) meta.push(`Level range: ${settings.levelRange.min}-${settings.levelRange.max}`)
    if (settings.maxPlayers) meta.push(`Max players: ${settings.maxPlayers}`)
    if (meta.length > 0) {
      parts.push('')
      parts.push(meta.join(', '))
    }
  }

  parts.push('[/CAMPAIGN DATA]')
  return parts.join('\n')
}

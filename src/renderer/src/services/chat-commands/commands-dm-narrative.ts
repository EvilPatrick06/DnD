import { load5eNpcNames, load5eRandomTables } from '../../services/data-provider'
import type { ChatCommand } from './types'

const npcCommand: ChatCommand = {
  name: 'npc',
  aliases: [],
  description: 'Speak as an NPC',
  usage: '/npc <name> <message>',
  dmOnly: true,
  category: 'dm',
  execute: (args, ctx) => {
    const match = args.match(/^(\S+)\s+(.+)$/s)
    if (!match) {
      ctx.addSystemMessage('Usage: /npc <name> <message>')
      return
    }
    const [, npcName, message] = match
    ctx.broadcastSystemMessage(`[${npcName}]: ${message.trim()}`)
  }
}

const announceCommand: ChatCommand = {
  name: 'announce',
  aliases: ['ann'],
  description: 'Make a dramatic announcement',
  usage: '/announce <message>',
  dmOnly: true,
  category: 'dm',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.addSystemMessage('Usage: /announce <message>')
      return
    }
    ctx.broadcastSystemMessage(`📢 ${args.trim()}`)
  }
}

const weatherCommand: ChatCommand = {
  name: 'weather',
  aliases: [],
  description: 'Set weather description',
  usage: '/weather <description>',
  dmOnly: true,
  category: 'dm',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.addSystemMessage('Usage: /weather <description>')
      return
    }
    const weather = args.trim()
    ctx.broadcastSystemMessage(`🌦️ Weather changed: ${weather}`)
  }
}

const noteCommand: ChatCommand = {
  name: 'note',
  aliases: [],
  description: 'Add a DM-only note',
  usage: '/note <text>',
  dmOnly: true,
  category: 'dm',
  execute: (args, ctx) => {
    if (!args.trim()) {
      ctx.addSystemMessage('Usage: /note <text>')
      return
    }
    ctx.addSystemMessage(`📝 DM Note: ${args.trim()}`)
  }
}

const nameCommand: ChatCommand = {
  name: 'name',
  aliases: [],
  description: 'Generate a random NPC name',
  usage: '/name [species] [gender]',
  dmOnly: true,
  category: 'dm',
  execute: async (args, ctx) => {
    try {
      const data = (await load5eNpcNames()) as unknown as Record<string, Record<string, string[]>>
      const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean)
      const speciesList = Object.keys(data)
      let species = parts[0]
      let gender = parts[1]

      if (!species || !speciesList.includes(species)) {
        species = speciesList[Math.floor(Math.random() * speciesList.length)]
      }

      const speciesData = data[species]
      if (!speciesData) {
        ctx.addSystemMessage(`No name data found for species: ${species}`)
        return
      }

      const genderOptions = Object.keys(speciesData).filter((k) => k !== 'last')
      if (!gender || !genderOptions.includes(gender)) {
        gender = genderOptions[Math.floor(Math.random() * genderOptions.length)]
      }

      const firstNames = speciesData[gender] || []
      const lastNames = speciesData.last || []

      if (firstNames.length === 0) {
        ctx.addSystemMessage(`No names found for ${species} ${gender}`)
        return
      }

      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames.length > 0 ? ` ${lastNames[Math.floor(Math.random() * lastNames.length)]}` : ''

      ctx.addSystemMessage(`Random name: ${firstName}${lastName}`)
    } catch {
      ctx.addSystemMessage('Failed to load NPC name data.')
    }
  }
}

const randomCommand: ChatCommand = {
  name: 'random',
  aliases: ['rtable'],
  description: 'Roll on a random table',
  usage: '/random <table>',
  dmOnly: true,
  category: 'dm',
  execute: async (args, ctx) => {
    const tableName = args.trim().toLowerCase()
    const validTables = [
      'personality',
      'ideals',
      'bonds',
      'flaws',
      'appearance',
      'mannerism',
      'tavern',
      'shop',
      'hook',
      'weather'
    ]

    if (!tableName || !validTables.includes(tableName)) {
      ctx.addSystemMessage(`Usage: /random <table>\nAvailable tables: ${validTables.join(', ')}`)
      return
    }

    try {
      const data = (await load5eRandomTables()) as unknown as Record<string, unknown>
      const table = data[tableName]

      if (!table || !Array.isArray(table) || table.length === 0) {
        ctx.addSystemMessage(`No entries found for table: ${tableName}`)
        return
      }

      const entry = table[Math.floor(Math.random() * table.length)]
      ctx.addSystemMessage(`🎲 [${tableName}]: ${entry}`)
    } catch {
      ctx.addSystemMessage('Failed to load random table data.')
    }
  }
}

const npcMoodCommand: ChatCommand = {
  name: 'npcmood',
  aliases: ['mood', 'attitude'],
  description: "Set an NPC's mood/attitude (friendly, indifferent, hostile)",
  usage: '/npcmood <npc name> <friendly|indifferent|hostile>',
  dmOnly: true,
  category: 'dm',
  execute: (args, ctx) => {
    const parts = args.trim().split(/\s+/)
    if (parts.length < 2) {
      ctx.addSystemMessage('Usage: /npcmood <npc name> <friendly|indifferent|hostile>')
      return
    }
    const mood = parts[parts.length - 1].toLowerCase()
    const validMoods = ['friendly', 'indifferent', 'hostile', 'neutral', 'suspicious', 'fearful']
    if (!validMoods.includes(mood)) {
      ctx.addSystemMessage(`Invalid mood. Options: ${validMoods.join(', ')}`)
      return
    }
    const npcName = parts.slice(0, -1).join(' ')
    ctx.broadcastSystemMessage(`**${npcName}**'s attitude: ${mood}`)
  }
}

export const commands: ChatCommand[] = [
  npcCommand,
  announceCommand,
  weatherCommand,
  noteCommand,
  nameCommand,
  randomCommand,
  npcMoodCommand
]

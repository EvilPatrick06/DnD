import type { ChatCommand } from './types'

const equipCommand: ChatCommand = {
  name: 'equip',
  aliases: [],
  description: 'Equip an item from inventory',
  usage: '/equip <item name>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const item = args.trim()
    if (!item) {
      return { type: 'error', content: 'Usage: /equip <item name>' }
    }
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** equips **${item}**.`
    }
  }
}

const unequipCommand: ChatCommand = {
  name: 'unequip',
  aliases: ['doff'],
  description: 'Unequip/doff an item',
  usage: '/unequip <item name>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const item = args.trim()
    if (!item) {
      return { type: 'error', content: 'Usage: /unequip <item name>' }
    }
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** unequips **${item}**.`
    }
  }
}

const attuneCommand: ChatCommand = {
  name: 'attune',
  aliases: [],
  description: 'Attune to a magic item (requires short rest)',
  usage: '/attune <item name>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const item = args.trim()
    if (!item) {
      return { type: 'error', content: 'Usage: /attune <item name>' }
    }
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** attunes to **${item}** (requires short rest, max 3 attuned items).`
    }
  }
}

const unattuneCommand: ChatCommand = {
  name: 'unattune',
  aliases: [],
  description: 'End attunement with a magic item',
  usage: '/unattune <item name>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const item = args.trim()
    if (!item) {
      return { type: 'error', content: 'Usage: /unattune <item name>' }
    }
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** ends attunement with **${item}**.`
    }
  }
}

const masteryCommand: ChatCommand = {
  name: 'mastery',
  aliases: ['weaponmastery', 'wm'],
  description: 'Declare or switch weapon mastery property',
  usage: '/mastery <weapon> <property>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const parts = args.trim().split(/\s+/)
    if (parts.length < 2) {
      return { type: 'error', content: 'Usage: /mastery <weapon> <property>' }
    }
    const weapon = parts.slice(0, -1).join(' ')
    const property = parts[parts.length - 1]
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** sets **${weapon}** mastery property to **${property}**.`
    }
  }
}

const useitemCommand: ChatCommand = {
  name: 'useitem',
  aliases: ['use'],
  description: 'Use a consumable item from inventory',
  usage: '/useitem <item name>',
  dmOnly: false,
  category: 'player',
  execute: (args, ctx) => {
    const item = args.trim()
    if (!item) {
      return { type: 'error', content: 'Usage: /useitem <item name>' }
    }
    return {
      type: 'broadcast',
      content: `**${ctx.playerName}** uses **${item}**.`
    }
  }
}

const inventoryCommand: ChatCommand = {
  name: 'inventory',
  aliases: ['inv', 'bag'],
  description: 'Show inventory summary',
  usage: '/inventory',
  dmOnly: false,
  category: 'player',
  execute: (_args, ctx) => {
    ctx.openModal?.('item')
  }
}

export const commands: ChatCommand[] = [
  equipCommand,
  unequipCommand,
  attuneCommand,
  unattuneCommand,
  masteryCommand,
  useitemCommand,
  inventoryCommand
]

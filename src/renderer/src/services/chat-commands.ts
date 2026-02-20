/**
 * Thin re-export from modular chat-commands directory.
 * All command logic now lives in services/chat-commands/*.ts
 */
export { executeCommand, getCommands, getFilteredCommands } from './chat-commands/index'
export type { ChatCommand, CommandContext, CommandResult } from './chat-commands/types'

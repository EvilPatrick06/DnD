export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MessageType =
  | 'player:join'
  | 'player:ready'
  | 'player:leave'
  | 'player:character-select'
  | 'player:buy-item'
  | 'player:sell-item'
  | 'game:state-update'
  | 'game:state-full'
  | 'game:dice-roll'
  | 'game:dice-result'
  | 'game:turn-advance'
  | 'dm:map-change'
  | 'dm:fog-reveal'
  | 'dm:token-move'
  | 'dm:initiative-update'
  | 'dm:condition-update'
  | 'dm:kick-player'
  | 'dm:ban-player'
  | 'dm:unban-player'
  | 'dm:force-mute'
  | 'dm:force-deafen'
  | 'dm:chat-timeout'
  | 'dm:promote-codm'
  | 'dm:demote-codm'
  | 'dm:game-start'
  | 'dm:game-end'
  | 'dm:character-update'
  | 'dm:shop-update'
  | 'dm:slow-mode'
  | 'dm:file-sharing'
  | 'chat:message'
  | 'chat:file'
  | 'chat:whisper'
  | 'player:color-change'
  | 'voice:mute-toggle'
  | 'ping'
  | 'pong'

export interface NetworkMessage<T = unknown> {
  type: MessageType
  payload: T
  senderId: string
  senderName: string
  timestamp: number
  sequence: number
}

export interface PeerInfo {
  peerId: string
  displayName: string
  characterId: string | null
  characterName: string | null
  isReady: boolean
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  isHost: boolean
  isForceMuted: boolean
  isForceDeafened: boolean
  color?: string
  isCoDM?: boolean
}

// Payload types for specific messages
export interface JoinPayload {
  displayName: string
  characterId: string | null
  characterName: string | null
  color?: string
}

export interface ChatPayload {
  message: string
  isSystem?: boolean
  isDiceRoll?: boolean
  diceResult?: { formula: string; total: number; rolls: number[] }
}

export interface WhisperPayload {
  message: string
  targetPeerId: string
  targetName: string
}

export interface DiceRollPayload {
  formula: string
  reason?: string
}

export interface DiceResultPayload {
  formula: string
  rolls: number[]
  total: number
  isCritical: boolean
  isFumble: boolean
  reason?: string
  rollerName: string
}

export interface StateUpdatePayload {
  path: string
  value: unknown
}

export interface TokenMovePayload {
  tokenId: string
  gridX: number
  gridY: number
}

export interface FogRevealPayload {
  cells: Array<{ x: number; y: number }>
  reveal: boolean
}

export interface MapChangePayload {
  mapId: string
}

export interface CharacterSelectPayload {
  characterId: string | null
  characterName: string | null
  characterData?: unknown
}

export interface InitiativeUpdatePayload {
  order: Array<{ id: string; name: string; initiative: number }>
  currentTurnIndex: number
}

export interface ConditionUpdatePayload {
  targetId: string
  condition: string
  active: boolean
}

export interface KickPayload {
  peerId: string
  reason?: string
}

export interface MuteTogglePayload {
  peerId: string
  isMuted: boolean
}

export interface ForceMutePayload {
  peerId: string
  isForceMuted: boolean
}

export interface ForceDeafenPayload {
  peerId: string
  isForceDeafened: boolean
}

export interface CharacterUpdatePayload {
  characterId: string
  characterData: unknown
}

export interface ShopUpdatePayload {
  shopInventory: ShopItem[]
  shopName?: string
}

export interface ShopItem {
  id: string
  name: string
  category: string
  price: { cp?: number; sp?: number; gp?: number; pp?: number }
  quantity: number
  description?: string
  weight?: number
  bulk?: number
}

export interface BuyItemPayload {
  itemId: string
  itemName: string
  price: { cp?: number; sp?: number; gp?: number; pp?: number }
}

export interface SellItemPayload {
  itemName: string
  price: { cp?: number; sp?: number; gp?: number; pp?: number }
}

export interface GameStateFullPayload {
  peers: PeerInfo[]
  campaignId?: string
}

export interface BanPayload {
  peerId: string
  reason?: string
}

export interface ChatTimeoutPayload {
  peerId: string
  durationMs: number
}

export interface CoDMPayload {
  peerId: string
  isCoDM: boolean
}

export interface ColorChangePayload {
  color: string
}

export interface ChatFilePayload {
  fileName: string
  fileType: string
  fileData: string
  mimeType: string
  senderId: string
  senderName: string
}

export interface SlowModePayload {
  seconds: number
}

export interface FileSharingPayload {
  enabled: boolean
}

export const PLAYER_COLORS = [
  '#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F97316', '#84CC16', '#6366F1', '#14B8A6', '#E11D48'
]

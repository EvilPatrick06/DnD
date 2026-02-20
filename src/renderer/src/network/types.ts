export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export const MESSAGE_TYPES = [
  'player:join',
  'player:ready',
  'player:leave',
  'player:character-select',
  'player:buy-item',
  'player:sell-item',
  'player:haggle-request',
  'dm:haggle-response',
  'game:state-update',
  'game:state-full',
  'game:dice-roll',
  'game:dice-result',
  'game:turn-advance',
  'game:opportunity-attack',
  'game:concentration-check',
  'game:map-ping',
  'game:dice-roll-3d',
  'game:dice-roll-hidden',
  'game:dice-reveal',
  'dm:map-change',
  'dm:fog-reveal',
  'dm:token-move',
  'dm:initiative-update',
  'dm:condition-update',
  'dm:kick-player',
  'dm:ban-player',
  'dm:unban-player',
  'dm:force-mute',
  'dm:force-deafen',
  'dm:chat-timeout',
  'dm:promote-codm',
  'dm:demote-codm',
  'dm:game-start',
  'dm:game-end',
  'dm:character-update',
  'dm:shop-update',
  'dm:slow-mode',
  'dm:file-sharing',
  'dm:timer-start',
  'dm:timer-stop',
  'dm:whisper-player',
  'dm:time-share',
  'dm:time-sync',
  'dm:roll-request',
  'dm:loot-award',
  'dm:xp-award',
  'dm:handout',
  'dm:share-handout',
  'dm:narration',
  'dm:play-sound',
  'dm:play-ambient',
  'dm:stop-ambient',
  'chat:message',
  'chat:file',
  'chat:whisper',
  'chat:announcement',
  'player:color-change',
  'player:time-request',
  'player:turn-end',
  'player:roll-result',
  'player:move-declare',
  'player:typing',
  'voice:mute-toggle',
  'voice:deafen-toggle',
  'ai:typing',
  'ping',
  'pong'
] as const

export type MessageType = (typeof MESSAGE_TYPES)[number]

export const KNOWN_MESSAGE_TYPES: ReadonlySet<string> = new Set<string>(MESSAGE_TYPES)

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
  mapId: string
  tokenId: string
  gridX: number
  gridY: number
}

export interface FogRevealPayload {
  mapId: string
  cells: Array<{ x: number; y: number }>
  reveal: boolean
}

export interface MapChangePayload {
  mapId: string
  mapData?: NetworkMap
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

export interface DeafenTogglePayload {
  peerId: string
  isDeafened: boolean
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
  targetPeerId?: string
}

export interface ShopUpdatePayload {
  shopInventory: ShopItem[]
  shopName?: string
}

export type ShopItemCategory =
  | 'weapon'
  | 'armor'
  | 'potion'
  | 'scroll'
  | 'wondrous'
  | 'tool'
  | 'adventuring'
  | 'trade'
  | 'other'

export type ShopItemRarity = 'common' | 'uncommon' | 'rare' | 'very rare' | 'legendary' | 'artifact'

export interface ShopItem {
  id: string
  name: string
  category: string
  price: { cp?: number; sp?: number; gp?: number; pp?: number }
  quantity: number
  description?: string
  weight?: number
  bulk?: number
  shopCategory?: ShopItemCategory
  rarity?: ShopItemRarity
  stockLimit?: number
  stockRemaining?: number
  dmNotes?: string
  hiddenFromPlayerIds?: string[]
  isHidden?: boolean
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
  gameState?: NetworkGameState
}

export interface NetworkGameState {
  activeMapId: string | null
  maps: NetworkMap[]
  turnMode: 'initiative' | 'free'
  initiative: unknown
  round: number
  conditions: unknown[]
  isPaused: boolean
  turnStates: Record<string, unknown>
  underwaterCombat: boolean
  flankingEnabled: boolean
  groupInitiativeEnabled: boolean
  ambientLight: 'bright' | 'dim' | 'darkness'
  diagonalRule: 'standard' | 'alternate'
  travelPace: 'fast' | 'normal' | 'slow' | null
  marchingOrder: string[]
  inGameTime: { totalSeconds: number } | null
  allies: unknown[]
  enemies: unknown[]
  places: unknown[]
  handouts: unknown[]
  shopOpen?: boolean
  shopName?: string
  shopInventory?: ShopItem[]
}

export interface NetworkMap {
  id: string
  name: string
  campaignId: string
  imageData?: string
  imagePath: string
  width: number
  height: number
  grid: unknown
  tokens: unknown[]
  fogOfWar: unknown
  wallSegments?: unknown[]
  terrain: unknown[]
  createdAt: string
}

export interface BanPayload {
  peerId: string
  reason?: string
}

export interface ChatTimeoutPayload {
  peerId: string
  duration: number // duration in seconds
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

export interface TimerStartPayload {
  seconds: number
  targetName: string
}

export interface WhisperPlayerPayload {
  targetPeerId: string
  targetName: string
  message: string
}

export interface TimeRequestPayload {
  requesterId: string
  requesterName: string
}

export interface TimeSharePayload {
  formattedTime: string
  targetPeerId?: string
  targetName?: string
}

export interface TimeSyncPayload {
  totalSeconds: number
}

export interface RollRequestPayload {
  id: string
  type: 'ability' | 'save' | 'skill'
  ability?: string
  skill?: string
  dc: number
  isSecret: boolean
  requesterId: string
  requesterName: string
}

export interface RollResultPayload {
  requestId: string
  entityId: string
  entityName: string
  roll: number
  modifier: number
  total: number
  success: boolean
}

export interface LootAwardPayload {
  targetPeerIds?: string[]
  items: Array<{ name: string; quantity: number }>
  currency?: { cp?: number; sp?: number; gp?: number; pp?: number }
}

export interface XpAwardPayload {
  targetPeerIds?: string[]
  xp: number
  reason?: string
}

export interface HandoutPayload {
  id: string
  title: string
  content: string
  imagePath?: string
  targetPeerIds?: string[]
}

export interface HandoutSharePayload {
  handout: import('../types/game-state').Handout
}

export interface AnnouncementPayload {
  message: string
  style?: 'info' | 'warning' | 'success' | 'dramatic'
}

export interface NarrationPayload {
  text: string
  style: 'chat' | 'dramatic'
}

export interface MapPingPayload {
  gridX: number
  gridY: number
  color?: string
  label?: string
}

export interface DiceRoll3dPayload {
  dice: Array<{ type: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100'; count: number }>
  results: number[]
  total: number
  formula: string
  reason?: string
  rollerName: string
  isSecret?: boolean
}

export interface DiceRollHiddenPayload {
  formula: string
  diceCount: number
  dieSides: number[]
  rollerName: string
}

export interface DiceRevealPayload {
  formula: string
  rolls: number[]
  total: number
  rollerName: string
  label?: string
}

export interface TurnEndPayload {
  entityId: string
}

export interface MoveDeclarePayload {
  entityId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  path?: Array<{ x: number; y: number }>
}

export interface TypingPayload {
  isTyping: boolean
}

export interface HaggleRequestPayload {
  itemId: string
  itemName: string
  originalPrice: { cp?: number; sp?: number; gp?: number; pp?: number }
  persuasionRoll: number
  persuasionModifier: number
  persuasionTotal: number
}

export interface HaggleResponsePayload {
  itemId: string
  accepted: boolean
  discountPercent: number // 0-20
  newPrice?: { cp?: number; sp?: number; gp?: number; pp?: number }
  targetPeerId: string
}

export interface PlaySoundPayload {
  event: string
}

export interface PlayAmbientPayload {
  ambient: string
  volume?: number
}

export type StopAmbientPayload = Record<string, never>

export const PLAYER_COLORS = [
  '#F59E0B',
  '#EF4444',
  '#3B82F6',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#84CC16',
  '#6366F1',
  '#14B8A6',
  '#E11D48'
]

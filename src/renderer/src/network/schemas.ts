import { z } from 'zod'
import { MESSAGE_TYPES } from './types'

// ── Envelope Schema ──

const MessageTypeSchema = z.enum(MESSAGE_TYPES)

const NetworkMessageEnvelopeSchema = z
  .object({
    type: MessageTypeSchema,
    payload: z.unknown(),
    senderId: z.string().max(100),
    senderName: z.string().max(100),
    timestamp: z.number(),
    sequence: z.number()
  })
  .passthrough()

// ── Payload Schemas ──

const JoinPayloadSchema = z
  .object({
    displayName: z.string(),
    characterId: z.string().nullable(),
    characterName: z.string().nullable(),
    color: z.string().optional()
  })
  .passthrough()

const ChatPayloadSchema = z
  .object({
    message: z.string(),
    isSystem: z.boolean().optional(),
    isDiceRoll: z.boolean().optional(),
    diceResult: z
      .object({
        formula: z.string(),
        total: z.number(),
        rolls: z.array(z.number())
      })
      .optional()
  })
  .passthrough()

const WhisperPayloadSchema = z
  .object({
    message: z.string(),
    targetPeerId: z.string(),
    targetName: z.string()
  })
  .passthrough()

const DiceRollPayloadSchema = z
  .object({
    formula: z.string(),
    reason: z.string().optional()
  })
  .passthrough()

const DiceResultPayloadSchema = z
  .object({
    formula: z.string(),
    rolls: z.array(z.number()),
    total: z.number(),
    isCritical: z.boolean(),
    isFumble: z.boolean(),
    reason: z.string().optional(),
    rollerName: z.string()
  })
  .passthrough()

const StateUpdatePayloadSchema = z
  .object({
    path: z.string(),
    value: z.unknown()
  })
  .passthrough()

const TokenMovePayloadSchema = z
  .object({
    tokenId: z.string(),
    gridX: z.number(),
    gridY: z.number()
  })
  .passthrough()

const FogRevealPayloadSchema = z
  .object({
    cells: z.array(z.object({ x: z.number(), y: z.number() })),
    reveal: z.boolean()
  })
  .passthrough()

const MapChangePayloadSchema = z
  .object({
    mapId: z.string()
  })
  .passthrough()

const CharacterSelectPayloadSchema = z
  .object({
    characterId: z.string().nullable(),
    characterName: z.string().nullable(),
    characterData: z.unknown().optional()
  })
  .passthrough()

const InitiativeUpdatePayloadSchema = z
  .object({
    order: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        initiative: z.number()
      })
    ),
    currentTurnIndex: z.number()
  })
  .passthrough()

const ConditionUpdatePayloadSchema = z
  .object({
    targetId: z.string(),
    condition: z.string(),
    active: z.boolean()
  })
  .passthrough()

const KickPayloadSchema = z
  .object({
    peerId: z.string(),
    reason: z.string().optional()
  })
  .passthrough()

const BanPayloadSchema = z
  .object({
    peerId: z.string(),
    reason: z.string().optional()
  })
  .passthrough()

const MuteTogglePayloadSchema = z
  .object({
    peerId: z.string(),
    isMuted: z.boolean()
  })
  .passthrough()

const DeafenTogglePayloadSchema = z
  .object({
    peerId: z.string(),
    isDeafened: z.boolean()
  })
  .passthrough()

const ForceMutePayloadSchema = z
  .object({
    peerId: z.string(),
    isForceMuted: z.boolean()
  })
  .passthrough()

const ForceDeafenPayloadSchema = z
  .object({
    peerId: z.string(),
    isForceDeafened: z.boolean()
  })
  .passthrough()

const CharacterUpdatePayloadSchema = z
  .object({
    characterId: z.string(),
    characterData: z.unknown(),
    targetPeerId: z.string().optional()
  })
  .passthrough()

const PriceSchema = z
  .object({
    cp: z.number().optional(),
    sp: z.number().optional(),
    gp: z.number().optional(),
    pp: z.number().optional()
  })
  .passthrough()

const ShopItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    price: PriceSchema,
    quantity: z.number(),
    description: z.string().optional(),
    weight: z.number().optional(),
    bulk: z.number().optional(),
    shopCategory: z
      .enum(['weapon', 'armor', 'potion', 'scroll', 'wondrous', 'tool', 'adventuring', 'trade', 'other'])
      .optional(),
    rarity: z.enum(['common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact']).optional(),
    stockLimit: z.number().optional(),
    stockRemaining: z.number().optional(),
    dmNotes: z.string().optional(),
    hiddenFromPlayerIds: z.array(z.string()).optional(),
    isHidden: z.boolean().optional()
  })
  .passthrough()

const ShopUpdatePayloadSchema = z
  .object({
    shopInventory: z.array(ShopItemSchema),
    shopName: z.string().optional()
  })
  .passthrough()

const BuyItemPayloadSchema = z
  .object({
    itemId: z.string(),
    itemName: z.string(),
    price: PriceSchema
  })
  .passthrough()

const SellItemPayloadSchema = z
  .object({
    itemName: z.string(),
    price: PriceSchema
  })
  .passthrough()

const GameStateFullPayloadSchema = z
  .object({
    peers: z.array(
      z
        .object({
          peerId: z.string(),
          displayName: z.string(),
          characterId: z.string().nullable(),
          characterName: z.string().nullable(),
          isReady: z.boolean(),
          isMuted: z.boolean(),
          isDeafened: z.boolean(),
          isSpeaking: z.boolean(),
          isHost: z.boolean(),
          isForceMuted: z.boolean(),
          isForceDeafened: z.boolean(),
          color: z.string().optional(),
          isCoDM: z.boolean().optional()
        })
        .passthrough()
    ),
    campaignId: z.string().optional()
  })
  .passthrough()

const ChatTimeoutPayloadSchema = z
  .object({
    peerId: z.string(),
    duration: z.number()
  })
  .passthrough()

const CoDMPayloadSchema = z
  .object({
    peerId: z.string(),
    isCoDM: z.boolean()
  })
  .passthrough()

const ColorChangePayloadSchema = z
  .object({
    color: z.string()
  })
  .passthrough()

const ChatFilePayloadSchema = z
  .object({
    fileName: z.string(),
    fileType: z.string(),
    fileData: z.string(),
    mimeType: z.string(),
    senderId: z.string(),
    senderName: z.string()
  })
  .passthrough()

const SlowModePayloadSchema = z
  .object({
    seconds: z.number()
  })
  .passthrough()

const FileSharingPayloadSchema = z
  .object({
    enabled: z.boolean()
  })
  .passthrough()

const TimerStartPayloadSchema = z
  .object({
    seconds: z.number(),
    targetName: z.string()
  })
  .passthrough()

const WhisperPlayerPayloadSchema = z
  .object({
    targetPeerId: z.string(),
    targetName: z.string(),
    message: z.string()
  })
  .passthrough()

const TimeRequestPayloadSchema = z
  .object({
    requesterId: z.string(),
    requesterName: z.string()
  })
  .passthrough()

const TimeSharePayloadSchema = z
  .object({
    formattedTime: z.string(),
    targetPeerId: z.string().optional(),
    targetName: z.string().optional()
  })
  .passthrough()

const TimeSyncPayloadSchema = z
  .object({
    totalSeconds: z.number()
  })
  .passthrough()

const RollRequestPayloadSchema = z
  .object({
    id: z.string(),
    type: z.enum(['ability', 'save', 'skill']),
    ability: z.string().optional(),
    skill: z.string().optional(),
    dc: z.number(),
    isSecret: z.boolean(),
    requesterId: z.string(),
    requesterName: z.string()
  })
  .passthrough()

const RollResultPayloadSchema = z
  .object({
    requestId: z.string(),
    entityId: z.string(),
    entityName: z.string(),
    roll: z.number(),
    modifier: z.number(),
    total: z.number(),
    success: z.boolean()
  })
  .passthrough()

const LootAwardPayloadSchema = z
  .object({
    targetPeerIds: z.array(z.string()).optional(),
    items: z.array(z.object({ name: z.string(), quantity: z.number() })),
    currency: PriceSchema.optional()
  })
  .passthrough()

const XpAwardPayloadSchema = z
  .object({
    targetPeerIds: z.array(z.string()).optional(),
    xp: z.number(),
    reason: z.string().optional()
  })
  .passthrough()

const HandoutPayloadSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    imagePath: z.string().optional(),
    targetPeerIds: z.array(z.string()).optional()
  })
  .passthrough()

const AnnouncementPayloadSchema = z
  .object({
    message: z.string(),
    style: z.enum(['info', 'warning', 'success', 'dramatic']).optional()
  })
  .passthrough()

const MapPingPayloadSchema = z
  .object({
    gridX: z.number(),
    gridY: z.number(),
    color: z.string().optional(),
    label: z.string().optional()
  })
  .passthrough()

const DiceRoll3dPayloadSchema = z
  .object({
    dice: z.array(
      z.object({
        type: z.enum(['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']),
        count: z.number()
      })
    ),
    results: z.array(z.number()),
    total: z.number(),
    formula: z.string(),
    reason: z.string().optional(),
    rollerName: z.string(),
    isSecret: z.boolean().optional()
  })
  .passthrough()

const TurnEndPayloadSchema = z
  .object({
    entityId: z.string()
  })
  .passthrough()

const MoveDeclarePayloadSchema = z
  .object({
    entityId: z.string(),
    fromX: z.number(),
    fromY: z.number(),
    toX: z.number(),
    toY: z.number(),
    path: z.array(z.object({ x: z.number(), y: z.number() })).optional()
  })
  .passthrough()

const TypingPayloadSchema = z
  .object({
    isTyping: z.boolean()
  })
  .passthrough()

const NarrationPayloadSchema = z
  .object({
    text: z.string(),
    style: z.enum(['chat', 'dramatic'])
  })
  .passthrough()

const PlaySoundPayloadSchema = z
  .object({
    event: z.string()
  })
  .passthrough()

const PlayAmbientPayloadSchema = z
  .object({
    ambient: z.string(),
    volume: z.number().optional()
  })
  .passthrough()

const StopAmbientPayloadSchema = z.object({}).passthrough()

// Generic passthrough for messages with no specific payload structure
const AnyPayloadSchema = z.unknown()

// ── Payload Registry ──

type MessageTypeString = (typeof MESSAGE_TYPES)[number]

const PAYLOAD_SCHEMAS: Partial<Record<MessageTypeString, z.ZodType>> = {
  'player:join': JoinPayloadSchema,
  'player:character-select': CharacterSelectPayloadSchema,
  'player:buy-item': BuyItemPayloadSchema,
  'player:sell-item': SellItemPayloadSchema,
  'player:color-change': ColorChangePayloadSchema,
  'player:time-request': TimeRequestPayloadSchema,
  'player:turn-end': TurnEndPayloadSchema,
  'player:roll-result': RollResultPayloadSchema,
  'player:move-declare': MoveDeclarePayloadSchema,
  'player:typing': TypingPayloadSchema,
  'game:state-update': StateUpdatePayloadSchema,
  'game:state-full': GameStateFullPayloadSchema,
  'game:dice-roll': DiceRollPayloadSchema,
  'game:dice-result': DiceResultPayloadSchema,
  'game:map-ping': MapPingPayloadSchema,
  'game:dice-roll-3d': DiceRoll3dPayloadSchema,
  'dm:map-change': MapChangePayloadSchema,
  'dm:fog-reveal': FogRevealPayloadSchema,
  'dm:token-move': TokenMovePayloadSchema,
  'dm:initiative-update': InitiativeUpdatePayloadSchema,
  'dm:condition-update': ConditionUpdatePayloadSchema,
  'dm:kick-player': KickPayloadSchema,
  'dm:ban-player': BanPayloadSchema,
  'dm:force-mute': ForceMutePayloadSchema,
  'dm:force-deafen': ForceDeafenPayloadSchema,
  'dm:chat-timeout': ChatTimeoutPayloadSchema,
  'dm:promote-codm': CoDMPayloadSchema,
  'dm:demote-codm': CoDMPayloadSchema,
  'dm:character-update': CharacterUpdatePayloadSchema,
  'dm:shop-update': ShopUpdatePayloadSchema,
  'dm:slow-mode': SlowModePayloadSchema,
  'dm:file-sharing': FileSharingPayloadSchema,
  'dm:timer-start': TimerStartPayloadSchema,
  'dm:whisper-player': WhisperPlayerPayloadSchema,
  'dm:time-share': TimeSharePayloadSchema,
  'dm:time-sync': TimeSyncPayloadSchema,
  'dm:roll-request': RollRequestPayloadSchema,
  'dm:loot-award': LootAwardPayloadSchema,
  'dm:xp-award': XpAwardPayloadSchema,
  'dm:handout': HandoutPayloadSchema,
  'dm:narration': NarrationPayloadSchema,
  'dm:play-sound': PlaySoundPayloadSchema,
  'dm:play-ambient': PlayAmbientPayloadSchema,
  'dm:stop-ambient': StopAmbientPayloadSchema,
  'chat:message': ChatPayloadSchema,
  'chat:file': ChatFilePayloadSchema,
  'chat:whisper': WhisperPayloadSchema,
  'chat:announcement': AnnouncementPayloadSchema,
  'voice:mute-toggle': MuteTogglePayloadSchema,
  'voice:deafen-toggle': DeafenTogglePayloadSchema
}

// ── Validation Function ──

export type ValidationResult =
  | { success: true; message: z.infer<typeof NetworkMessageEnvelopeSchema> }
  | { success: false; error: string }

/**
 * Validate an incoming network message.
 * Returns the validated message envelope if valid, or an error string.
 */
export function validateNetworkMessage(raw: unknown): ValidationResult {
  // Step 1: Validate envelope structure
  const envelopeResult = NetworkMessageEnvelopeSchema.safeParse(raw)
  if (!envelopeResult.success) {
    return {
      success: false,
      error: `Invalid message envelope: ${envelopeResult.error.issues[0]?.message ?? 'unknown'}`
    }
  }

  const msg = envelopeResult.data

  // Step 2: Validate payload if schema exists for this message type
  const payloadSchema = PAYLOAD_SCHEMAS[msg.type as MessageTypeString]
  if (payloadSchema) {
    const payloadResult = payloadSchema.safeParse(msg.payload)
    if (!payloadResult.success) {
      return {
        success: false,
        error: `Invalid ${msg.type} payload: ${payloadResult.error.issues[0]?.message ?? 'unknown'}`
      }
    }
  }

  return { success: true, message: msg }
}

// Export for testing
export { NetworkMessageEnvelopeSchema, PAYLOAD_SCHEMAS, AnyPayloadSchema }

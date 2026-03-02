// Client manager
export {
  connectToHost,
  disconnect,
  isConnected,
  onDisconnected,
  onMessage as onClientMessage,
  sendMessage as sendClientMessage,
  setCharacterInfo
} from './client-manager'
// Game sync
export { startGameSync, stopGameSync } from './game-sync'
// Host manager
export {
  banPeer,
  broadcastExcluding,
  broadcastMessage,
  chatMutePeer,
  getConnectedPeers,
  getInviteCode,
  getPeerInfo,
  isHosting,
  isModerationEnabled,
  kickPeer,
  onMessage as onHostMessage,
  onPeerJoined,
  onPeerLeft,
  sendToPeer,
  setCampaignId as setHostCampaignId,
  setGameStateProvider,
  setModerationEnabled,
  startHosting,
  stopHosting,
  updatePeerInfo
} from './host-manager'
// Message handler
export { createMessageRouter } from './message-handler'
// Peer manager
export {
  createPeer,
  destroyPeer,
  generateInviteCode,
  getIceConfig,
  getPeer,
  getPeerId,
  resetIceConfig,
  resetSignalingServer,
  setIceConfig,
  setSignalingServer
} from './peer-manager'
export type { ValidationResult } from './schemas'
// Schemas
export { AnyPayloadSchema, NetworkMessageEnvelopeSchema, PAYLOAD_SCHEMAS, validateNetworkMessage } from './schemas'
// Types (from message-types via types barrel)
export type {
  BuyItemPayload,
  CharacterSelectPayload,
  CharacterUpdatePayload,
  ChatFilePayload,
  ChatPayload,
  ChatTimeoutPayload,
  CoDMPayload,
  ColorChangePayload,
  ConditionUpdatePayload,
  ConnectionState,
  DiceResultPayload,
  DiceRevealPayload,
  DiceRollHiddenPayload,
  DiceRollPayload,
  FileSharingPayload,
  FogRevealPayload,
  GameStateFullPayload,
  HaggleRequestPayload,
  HandoutSharePayload,
  InitiativeUpdatePayload,
  InspectRequestPayload,
  InspectResponsePayload,
  JoinPayload,
  JournalAddPayload,
  JournalDeletePayload,
  JournalSyncPayload,
  JournalUpdatePayload,
  KickPayload,
  MacroPushPayload,
  MapChangePayload,
  MessageType,
  NarrationPayload,
  NetworkGameState,
  NetworkMap,
  NetworkMessage,
  PeerInfo,
  PlayAmbientPayload,
  PlaySoundPayload,
  ReactionPromptPayload,
  RollRequestPayload,
  RollResultPayload,
  SellItemPayload,
  ShopItem,
  ShopItemCategory,
  ShopItemRarity,
  ShopUpdatePayload,
  SlowModePayload,
  StateUpdatePayload,
  StopAmbientPayload,
  TimeRequestPayload,
  TimerStartPayload,
  TimeSharePayload,
  TimeSyncPayload,
  TokenMovePayload,
  TradeCancelPayload,
  TradeRequestPayload,
  TradeResponsePayload,
  TradeResultPayload,
  TurnEndPayload,
  TypingPayload,
  WhisperPayload,
  WhisperPlayerPayload
} from './types'
export { PLAYER_COLORS } from './types'

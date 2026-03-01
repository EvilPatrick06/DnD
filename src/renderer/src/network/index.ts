// Types

// Client manager
export {
  connectToHost,
  disconnect,
  isConnected,
  onDisconnected,
  onMessage as onClientMessage,
  sendMessage as sendClientMessage
} from './client-manager'
// Host manager
export {
  broadcastExcluding,
  broadcastMessage,
  getConnectedPeers,
  getInviteCode,
  isHosting,
  kickPeer,
  onMessage as onHostMessage,
  onPeerJoined,
  onPeerLeft,
  sendToPeer,
  startHosting,
  stopHosting
} from './host-manager'
// Message handler
export { createMessageRouter } from './message-handler'
// Peer manager
export {
  createPeer,
  destroyPeer,
  generateInviteCode,
  getPeer,
  getPeerId
} from './peer-manager'
export type {
  CharacterSelectPayload,
  ChatPayload,
  ConditionUpdatePayload,
  ConnectionState,
  DiceResultPayload,
  DiceRollPayload,
  FogRevealPayload,
  InitiativeUpdatePayload,
  JoinPayload,
  KickPayload,
  MapChangePayload,
  MessageType,
  NetworkMessage,
  PeerInfo,
  StateUpdatePayload,
  TokenMovePayload,
  WhisperPayload
} from './types'
